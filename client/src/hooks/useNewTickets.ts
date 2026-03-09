import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Ticket } from "../lib/supabase";

/**
 * Global realtime hook — subscribes to new ticket INSERTs for the lifetime
 * of the app (mounted in App.tsx). Returns pending new tickets that haven't
 * been dismissed yet, and a total unread count.
 */
export function useNewTickets() {
  const [newTickets, setNewTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    console.log("🔌 Global tickets realtime — subscribing…");

    const channel = supabase
      .channel("global-tickets-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tickets" },
        (payload) => {
          console.log("🎫 New ticket (global):", payload.new);
          setNewTickets((prev) => [...prev, payload.new as Ticket]);
        },
      )
      .subscribe((status) => {
        console.log("🔌 Global tickets realtime status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const dismissTicket = (ticketId: number) => {
    setNewTickets((prev) => prev.filter((t) => t.ticket_id !== ticketId));
  };

  const dismissAll = () => setNewTickets([]);

  return {
    newTickets,
    unreadCount: newTickets.length,
    dismissTicket,
    dismissAll,
  };
}
