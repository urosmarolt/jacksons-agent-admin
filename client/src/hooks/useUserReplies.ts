import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Ticket } from "../lib/supabase";

export interface UserReply {
  id: string; // unique key for this notification
  messageId: number;
  sessionId: string;
  content: string;
  timestamp: Date;
  ticket: Ticket | null; // null if session has no ticket
}

/**
 * Subscribes to user messages inserted while the admin is online.
 * Only surfaces messages where the session has an associated ticket
 * (i.e. the user has previously escalated) so we don't notify on
 * every new chat — just replies to existing support threads.
 */
export function useUserReplies() {
  const [replies, setReplies] = useState<UserReply[]>([]);

  // Cache session→ticket lookups to avoid repeated queries
  const ticketCache = useRef<Record<string, Ticket | null>>({});

  useEffect(() => {
    const channel = supabase
      .channel("admin-user-replies")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: "role=eq.user",
        },
        async (payload) => {
          const msg = payload.new as {
            id: number;
            session_id: string;
            content: string;
            timestamp: string;
            role: string;
          };

          // Look up ticket for this session (cached)
          let ticket: Ticket | null = null;
          if (ticketCache.current[msg.session_id] !== undefined) {
            ticket = ticketCache.current[msg.session_id];
          } else {
            const { data } = await supabase
              .from("tickets")
              .select("*")
              .eq("session_id", msg.session_id)
              .eq("status", "open")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            ticket = data ?? null;
            ticketCache.current[msg.session_id] = ticket;
          }

          // Only notify if there's an open ticket for this session
          if (!ticket) return;

          const reply: UserReply = {
            id: `reply-${msg.id}`,
            messageId: msg.id,
            sessionId: msg.session_id,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
            ticket,
          };

          console.log("💬 User reply on open ticket:", reply);
          setReplies((prev) => [...prev, reply]);
        },
      )
      .subscribe((status) => {
        console.log("🔌 User replies realtime status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const dismissReply = (id: string) =>
    setReplies((prev) => prev.filter((r) => r.id !== id));

  const dismissAllReplies = () => setReplies([]);

  // Per-session unread count — used for badges on ticket rows
  const unreadBySession: Record<string, number> = {};
  replies.forEach((r) => {
    unreadBySession[r.sessionId] = (unreadBySession[r.sessionId] ?? 0) + 1;
  });

  return {
    replies,
    unreadBySession,
    dismissReply,
    dismissAllReplies,
  };
}
