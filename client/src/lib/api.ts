import { supabase, type Session, type Message, type Ticket } from "./supabase";
import dayjs from "dayjs";

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function fetchSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .order("last_active", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSessionById(
  sessionId: string,
): Promise<Session | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("session_id", sessionId)
    .single();
  if (error) throw error;
  return data;
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function fetchMessagesBySession(
  sessionId: string,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function postAdminReply(
  sessionId: string,
  content: string,
  staffId?: string, // if provided, auto-assigns open unassigned ticket to this agent
  agentName?: string, // stored on the message so the chat widget can show the agent name
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      session_id: sessionId,
      role: "admin",
      content,
      agent_name: agentName ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  // Auto-assign open unassigned ticket to the replying agent
  if (staffId && agentName) {
    try {
      const { data: tickets } = await supabase
        .from("tickets")
        .select("ticket_id")
        .eq("session_id", sessionId)
        .eq("status", "open")
        .is("assigned_to", null)
        .limit(1);
      if (tickets && tickets.length > 0) {
        await updateTicketAssignee(tickets[0].ticket_id, staffId, agentName);
      }
    } catch {
      /* non-critical — reply already sent */
    }
  }

  return data;
}

// ── Tickets ───────────────────────────────────────────────────────────────────

export async function fetchTickets(status?: string): Promise<Ticket[]> {
  let query = supabase
    .from("tickets")
    .select("*")
    .order("created_at", { ascending: false });
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchTicketById(
  ticketId: number,
): Promise<Ticket | null> {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("ticket_id", ticketId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateTicketStatus(
  ticketId: number,
  status: string,
): Promise<void> {
  const { error } = await supabase
    .from("tickets")
    .update({ status })
    .eq("ticket_id", ticketId);
  if (error) throw error;
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

export async function fetchDashboardStats() {
  const [ticketsRes, sessionsRes, uniqueUsersRes] = await Promise.all([
    supabase.from("tickets").select("ticket_id, status"),
    supabase.from("sessions").select("session_id"),
    supabase.from("sessions").select("email"),
  ]);

  if (ticketsRes.error) throw ticketsRes.error;
  if (sessionsRes.error) throw sessionsRes.error;
  if (uniqueUsersRes.error) throw uniqueUsersRes.error;

  const tickets = ticketsRes.data ?? [];
  const openTickets = tickets.filter((t) => t.status === "open").length;
  const totalSessions = sessionsRes.data?.length ?? 0;
  const uniqueEmails = new Set((uniqueUsersRes.data ?? []).map((s) => s.email))
    .size;

  return { openTickets, totalSessions, uniqueUsers: uniqueEmails };
}

// ── Extended dashboard stats ──────────────────────────────────────────────────

export type TicketStatusCount = { status: string; count: number };
export type TicketsByDay = { date: string; tickets: number };
export type RecentTicket = {
  ticket_id: number;
  email: string;
  subject: string;
  status: string;
  created_at: string;
};

export async function fetchExtendedDashboardStats(): Promise<{
  statusBreakdown: TicketStatusCount[];
  ticketsByDay: TicketsByDay[];
  recentTickets: RecentTicket[];
  escalationRate: number;
  totalTickets: number;
  sessionsWithTickets: number;
  totalSessions: number;
}> {
  const [ticketsRes, sessionsRes] = await Promise.all([
    supabase
      .from("tickets")
      .select("ticket_id, status, email, subject, created_at, session_id"),
    supabase.from("sessions").select("session_id"),
  ]);

  if (ticketsRes.error) throw ticketsRes.error;
  if (sessionsRes.error) throw sessionsRes.error;

  const tickets = ticketsRes.data ?? [];
  const totalSessions = sessionsRes.data?.length ?? 0;
  const totalTickets = tickets.length;

  // Status breakdown
  const statusMap: Record<string, number> = {};
  for (const t of tickets) {
    statusMap[t.status] = (statusMap[t.status] ?? 0) + 1;
  }
  const statusBreakdown: TicketStatusCount[] = Object.entries(statusMap).map(
    ([status, count]) => ({ status, count }),
  );

  // Tickets by day — last 14 days
  const today = dayjs();
  const ticketsByDay: TicketsByDay[] = Array.from({ length: 14 }, (_, i) => {
    const date = today.subtract(13 - i, "day");
    const dateStr = date.format("MM/DD");
    const count = tickets.filter(
      (t) => dayjs(t.created_at).format("MM/DD") === dateStr,
    ).length;
    return { date: dateStr, tickets: count };
  });

  // Recent tickets (last 5)
  const recentTickets: RecentTicket[] = [...tickets]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 5)
    .map((t) => ({
      ticket_id: t.ticket_id,
      email: t.email,
      subject: t.subject,
      status: t.status,
      created_at: t.created_at,
    }));

  // Escalation rate
  const sessionsWithTickets = new Set(tickets.map((t) => t.session_id)).size;
  const escalationRate =
    totalSessions > 0
      ? Math.round((sessionsWithTickets / totalSessions) * 100)
      : 0;

  return {
    statusBreakdown,
    ticketsByDay,
    recentTickets,
    escalationRate,
    totalTickets,
    sessionsWithTickets,
    totalSessions,
  };
}

// ── Ratings ───────────────────────────────────────────────────────────────────

export async function fetchRatingStats(): Promise<{
  averageRating: number;
  totalRated: number;
  distribution: { stars: number; count: number }[];
}> {
  const { data, error } = await supabase
    .from("tickets")
    .select("rating")
    .not("rating", "is", null);

  if (error) throw error;
  const ratings = (data ?? []).map((r) => r.rating as number);
  if (!ratings.length)
    return { averageRating: 0, totalRated: 0, distribution: [] };

  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const dist = [1, 2, 3, 4, 5].map((s) => ({
    stars: s,
    count: ratings.filter((r) => r === s).length,
  }));
  return {
    averageRating: Math.round(avg * 10) / 10,
    totalRated: ratings.length,
    distribution: dist,
  };
}

// ── Staff & Assignment ────────────────────────────────────────────────────────

export interface StaffMember {
  id: string;
  display_name: string;
  role: string;
  created_at: string;
}

export async function fetchStaff(): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from("staff_profiles")
    .select("id, display_name, role, created_at")
    .order("display_name");
  if (error) throw error;
  return data ?? [];
}

export async function updateTicketAssignee(
  ticketId: number,
  assignedTo: string | null,
  agentName?: string,
): Promise<void> {
  const { error } = await supabase
    .from("tickets")
    .update({ assigned_to: assignedTo })
    .eq("ticket_id", ticketId);
  if (error) throw error;

  // Insert system message so the customer sees the assignment in the chat
  if (assignedTo && agentName) {
    const { data: ticket } = await supabase
      .from("tickets")
      .select("session_id")
      .eq("ticket_id", ticketId)
      .single();

    if (ticket?.session_id) {
      await supabase.from("messages").insert({
        session_id: ticket.session_id,
        role: "system",
        content: `Ticket assigned to ${agentName}`,
        agent_name: agentName,
      });
    }
  }
}
