import { createContext, useContext } from "react";
import type { Ticket } from "../lib/supabase";
import type { UserReply } from "../hooks/useUserReplies";

interface NewTicketsContextValue {
  // New ticket notifications
  newTickets: Ticket[];
  unreadCount: number;
  dismissTicket: (ticketId: number) => void;
  dismissAll: () => void;
  // User reply notifications
  replies: UserReply[];
  unreadBySession: Record<string, number>;
  dismissReply: (id: string) => void;
  dismissAllReplies: () => void;
}

export const NewTicketsContext = createContext<NewTicketsContextValue>({
  newTickets: [],
  unreadCount: 0,
  dismissTicket: () => {},
  dismissAll: () => {},
  replies: [],
  unreadBySession: {},
  dismissReply: () => {},
  dismissAllReplies: () => {},
});

export function useNewTicketsContext() {
  return useContext(NewTicketsContext);
}
