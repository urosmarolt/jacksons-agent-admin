import { AppShell, Box, Notification, Text, Button } from "@mantine/core";
import { Route, Switch, useLocation } from "wouter";
import { IconTicket, IconX, IconMessage } from "@tabler/icons-react";
import { NavbarNested } from "./components/NavbarNested";
import { LoginPage } from "./pages/LoginPage";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { TeamPage } from "./pages/TeamPage";
import { Dashboard } from "./pages/Dashboard";
import { Tickets } from "./pages/Tickets";
import { Sessions } from "./pages/Sessions";
import { useAuth } from "./context/AuthContext";
import { useNewTickets } from "./hooks/useNewTickets";
import { useUserReplies } from "./hooks/useUserReplies";
import { NewTicketsContext } from "./context/NewTicketsContext";
import type { Ticket } from "./lib/supabase";
import type { UserReply } from "./hooks/useUserReplies";

export default function App() {
  const [, navigate] = useLocation();
  const { session, user, loading: authLoading } = useAuth();

  // All hooks must run unconditionally before any early returns
  const { newTickets, unreadCount, dismissTicket, dismissAll } =
    useNewTickets();
  const { replies, unreadBySession, dismissReply, dismissAllReplies } =
    useUserReplies();

  // Accept-invite — always accessible, no auth needed
  if (window.location.pathname === "/accept-invite")
    return <AcceptInvitePage />;

  // Nothing while auth is resolving
  if (authLoading) return null;

  // Gate — not logged in
  if (!session || !user) return <LoginPage />;

  function handleTicketClick(ticket: Ticket) {
    dismissTicket(ticket.ticket_id);
    // Use window.location to ensure useSearch fires even if already on /tickets
    window.location.href = `/tickets?open=${ticket.ticket_id}`;
  }

  function handleReplyClick(reply: UserReply) {
    dismissReply(reply.id);
    if (reply.ticket)
      window.location.href = `/tickets?open=${reply.ticket.ticket_id}`;
  }

  const totalUnread = unreadCount + replies.length;

  return (
    <NewTicketsContext.Provider
      value={{
        newTickets,
        unreadCount,
        dismissTicket,
        dismissAll,
        replies,
        unreadBySession,
        dismissReply,
        dismissAllReplies,
      }}
    >
      <AppShell
        navbar={{ width: 260, breakpoint: "sm" }}
        padding="xl"
        styles={{ main: { background: "#faf8f5", minHeight: "100vh" } }}
      >
        <AppShell.Navbar style={{ border: "none" }}>
          <NavbarNested unreadTickets={totalUnread} />
        </AppShell.Navbar>

        <AppShell.Main>
          {/* ── Notifications ───────────────────────────────────────────── */}
          {(newTickets.length > 0 || replies.length > 0) && (
            <Box
              style={{
                position: "fixed",
                bottom: 24,
                right: 24,
                zIndex: 9999,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxWidth: 360,
                width: "100%",
              }}
            >
              {replies.slice(0, 2).map((reply) => (
                <Notification
                  key={reply.id}
                  icon={<IconMessage size={16} />}
                  color="blue"
                  title={
                    <Text size="sm" fw={600}>
                      Customer replied —{" "}
                      {reply.ticket?.subject ?? "Open ticket"}
                    </Text>
                  }
                  onClose={() => dismissReply(reply.id)}
                  onClick={() => handleReplyClick(reply)}
                  style={{
                    border: "1px solid #bfdbfe",
                    boxShadow: "0 4px 20px rgba(59,130,246,0.15)",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  <Text size="sm" lineClamp={2} style={{ color: "#374151" }}>
                    {reply.content.replace(/<[^>]*>/g, "").substring(0, 100)}
                    {reply.content.length > 100 ? "…" : ""}
                  </Text>
                  <Text size="xs" c="blue" mt={2} fw={500}>
                    Click to reply →
                  </Text>
                </Notification>
              ))}

              {newTickets.slice(0, 2).map((ticket) => (
                <Notification
                  key={ticket.ticket_id}
                  icon={<IconTicket size={16} />}
                  color="orange"
                  title={
                    <Text size="sm" fw={600}>
                      New ticket received
                    </Text>
                  }
                  onClose={() => dismissTicket(ticket.ticket_id)}
                  onClick={() => handleTicketClick(ticket)}
                  style={{
                    border: "1px solid #f0ddb8",
                    boxShadow: "0 4px 20px rgba(180,140,80,0.2)",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  <Text size="sm" fw={500} lineClamp={1}>
                    {ticket.subject}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {ticket.email}
                  </Text>
                  <Text size="xs" c="orange" mt={2} fw={500}>
                    Click to open →
                  </Text>
                </Notification>
              ))}

              {newTickets.length + replies.length > 4 && (
                <Box
                  style={{
                    background: "#1a1410",
                    borderRadius: 8,
                    padding: "8px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                  }}
                >
                  <Text size="sm" c="white" fw={600}>
                    +{newTickets.length + replies.length - 4} more notifications
                  </Text>
                  <Button
                    size="xs"
                    variant="white"
                    color="dark"
                    onClick={() => {
                      dismissAll();
                      dismissAllReplies();
                    }}
                    rightSection={<IconX size={12} />}
                  >
                    Dismiss all
                  </Button>
                </Box>
              )}
            </Box>
          )}

          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/tickets" component={Tickets} />
            <Route path="/tickets/:status" component={Tickets} />
            <Route path="/sessions" component={Sessions} />
            <Route path="/team">
              {user?.role === "super_admin" ? <TeamPage /> : <Dashboard />}
            </Route>
            <Route>
              <Dashboard />
            </Route>
          </Switch>
        </AppShell.Main>
      </AppShell>
    </NewTicketsContext.Provider>
  );
}
