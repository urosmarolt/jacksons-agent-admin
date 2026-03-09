import { useEffect, useRef, useState } from "react";
import {
  Text,
  Card,
  Table,
  Badge,
  Group,
  Stack,
  Skeleton,
  Alert,
  Drawer,
  Select,
  Divider,
  Avatar,
  Tooltip,
  ActionIcon,
  ScrollArea,
  Box,
  Textarea,
  Button,
  Paper,
  Menu,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconAlertCircle,
  IconExternalLink,
  IconSend,
  IconUserPlus,
  IconUserOff,
  IconChevronDown,
} from "@tabler/icons-react";
import { useParams, useSearch } from "wouter";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  fetchTickets,
  updateTicketStatus,
  fetchMessagesBySession,
  postAdminReply,
  updateTicketAssignee,
  fetchStaff,
} from "../lib/api";
import type { StaffMember } from "../lib/api";
import { useAuth } from "../context/AuthContext"; // for current user id (auto-assign)
import type { Ticket, Message } from "../lib/supabase";
import { supabase } from "../lib/supabase";
import { useNewTicketsContext } from "../context/NewTicketsContext";

dayjs.extend(relativeTime);

const STATUS_OPTIONS = ["open", "closed", "pending", "resolved"];

function statusColor(status: string) {
  switch (status) {
    case "open":
      return "orange";
    case "closed":
      return "gray";
    case "pending":
      return "yellow";
    case "resolved":
      return "green";
    default:
      return "blue";
  }
}

function roleMeta(role: string) {
  switch (role) {
    case "assistant":
      return { color: "blue", label: "Agent" };
    case "admin":
      return { color: "orange", label: "Admin" };
    case "tool":
      return { color: "violet", label: "Tool" };
    default:
      return { color: "gray", label: "User" };
  }
}

const AVATAR_COLORS = [
  "#d88626",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#f59e0b",
];
function avatarColor(id: string) {
  return AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];
}
function nameInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function AssigneeAvatar({
  member,
  size = "sm",
}: {
  member: StaffMember | null;
  size?: string;
}) {
  if (!member)
    return (
      <Tooltip label="Unassigned">
        <Avatar
          size={size}
          radius="xl"
          style={{ background: "#e8ddd0", color: "#a89880", fontSize: 11 }}
        >
          —
        </Avatar>
      </Tooltip>
    );
  return (
    <Tooltip label={member.display_name}>
      <Avatar
        size={size}
        radius="xl"
        style={{
          background: avatarColor(member.id),
          color: "white",
          fontWeight: 700,
          fontSize: 11,
        }}
      >
        {nameInitials(member.display_name)}
      </Avatar>
    </Tooltip>
  );
}

function MessageContent({ content }: { content: string }) {
  if (!content)
    return (
      <Text component="span" c="dimmed" fs="italic" size="sm">
        — no content —
      </Text>
    );
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return (
      <Box
        style={{ fontSize: 14, lineHeight: 1.6 }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  return (
    <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
      {content}
    </Text>
  );
}

const PageTitle = ({ title, sub }: { title: string; sub: string }) => (
  <Box mb="xl">
    <Text
      style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 28,
        fontWeight: 600,
        color: "#1a1410",
        lineHeight: 1.2,
      }}
    >
      {title}
    </Text>
    <Text size="sm" c="dimmed" mt={4}>
      {sub}
    </Text>
  </Box>
);

export function Tickets() {
  const params = useParams<{ status?: string }>();
  const filterStatus = params.status ?? "all";

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [opened, { open, close }] = useDisclosure(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { unreadBySession, dismissReply, replies } = useNewTicketsContext();
  const { session, user } = useAuth(); // for auto-assign on reply

  function clearRepliesForSession(sessionId: string) {
    replies
      .filter((r) => r.sessionId === sessionId)
      .forEach((r) => dismissReply(r.id));
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    fetchTickets(filterStatus)
      .then(setTickets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filterStatus]);

  useEffect(() => {
    fetchStaff().then(setStaff).catch(console.error);
  }, []);

  // ── Auto-scroll thread ────────────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
  }, [messages]);

  // ── Auto-open from URL param ──────────────────────────────────────────────
  const search = useSearch();
  useEffect(() => {
    if (!search || loading) return;
    const p = new URLSearchParams(search);
    const openId = p.get("open");
    if (!openId) return;
    const ticketId = parseInt(openId, 10);
    const ticket = tickets.find((t) => t.ticket_id === ticketId);
    if (ticket) {
      openDetail(ticket);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [search, tickets, loading]);

  const openDetail = async (ticket: Ticket) => {
    setSelected(ticket);
    setReplyText("");
    setReplyError(null);
    open();
    clearRepliesForSession(ticket.session_id);
    setMessagesLoading(true);
    try {
      setMessages(await fetchMessagesBySession(ticket.session_id));
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleStatusChange = async (ticketId: number, newStatus: string) => {
    setUpdating(true);
    try {
      await updateTicketStatus(ticketId, newStatus);
      const isFiltered = filterStatus !== "all";
      setTickets((prev) =>
        prev
          .map((t) =>
            t.ticket_id === ticketId ? { ...t, status: newStatus } : t,
          )
          .filter((t) => !isFiltered || t.status === filterStatus),
      );
      if (selected?.ticket_id === ticketId)
        setSelected((prev) => (prev ? { ...prev, status: newStatus } : prev));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleAssign = async (
    ticketId: number,
    assignee: string | null,
    agentName?: string,
  ) => {
    setAssigning(true);
    try {
      await updateTicketAssignee(ticketId, assignee, agentName);
      setTickets((prev) =>
        prev.map((t) =>
          t.ticket_id === ticketId ? { ...t, assigned_to: assignee } : t,
        ),
      );
      if (selected?.ticket_id === ticketId)
        setSelected((prev) =>
          prev ? { ...prev, assigned_to: assignee } : prev,
        );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    setReplyError(null);
    try {
      const newMsg = await postAdminReply(
        selected.session_id,
        replyText.trim(),
        session?.user?.id,
        user?.display_name,
      );
      setMessages((prev) => [...prev, newMsg]);
      setReplyText("");
    } catch (e: any) {
      setReplyError(e.message);
    } finally {
      setSending(false);
    }
  };

  const isOpen = selected?.status === "open";
  const pageTitle =
    filterStatus === "all"
      ? "All Tickets"
      : filterStatus === "open"
        ? "Open Tickets"
        : filterStatus === "closed"
          ? "Closed Tickets"
          : `Tickets — ${filterStatus}`;
  const pageSub =
    filterStatus === "all"
      ? "All support tickets across every status"
      : `Showing ${filterStatus} tickets only`;

  // ── Table rows ────────────────────────────────────────────────────────────
  const rows = tickets.map((t) => (
    <Table.Tr
      key={t.ticket_id}
      className="clickable-row"
      onClick={() => openDetail(t)}
    >
      <Table.Td>
        <Text size="sm" fw={500} lineClamp={1}>
          {t.subject}
        </Text>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Avatar
            size="sm"
            radius="xl"
            style={{
              background: "linear-gradient(135deg,#10b981,#34d399)",
              color: "white",
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            {t.email[0]?.toUpperCase()}
          </Avatar>
          <Text size="sm">{t.email}</Text>
        </Group>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Badge color={statusColor(t.status)} variant="dot" size="sm">
            {t.status}
          </Badge>
          {(unreadBySession[t.session_id] ?? 0) > 0 && (
            <Badge color="blue" size="xs" circle>
              {unreadBySession[t.session_id]}
            </Badge>
          )}
        </Group>
      </Table.Td>
      {/* Assignee column */}
      <Table.Td onClick={(e) => e.stopPropagation()}>
        <Menu shadow="md" width={200} withinPortal>
          <Menu.Target>
            <Group gap={6} style={{ cursor: "pointer" }}>
              <AssigneeAvatar
                member={staff.find((s) => s.id === t.assigned_to) ?? null}
              />
              {t.assigned_to ? (
                <Text size="xs" style={{ color: "#5a5040" }}>
                  {staff.find((s) => s.id === t.assigned_to)?.display_name ??
                    "Unknown"}
                </Text>
              ) : (
                <Text size="xs" c="dimmed">
                  Unassigned
                </Text>
              )}
              <IconChevronDown size={11} color="#a89880" />
            </Group>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Assign to</Menu.Label>
            {staff.map((s) => (
              <Menu.Item
                key={s.id}
                leftSection={
                  <Avatar
                    size={20}
                    radius="xl"
                    style={{
                      background: avatarColor(s.id),
                      color: "white",
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {nameInitials(s.display_name)}
                  </Avatar>
                }
                fw={t.assigned_to === s.id ? 700 : 400}
                style={{
                  color: t.assigned_to === s.id ? "#d88626" : undefined,
                }}
                onClick={() => handleAssign(t.ticket_id, s.id, s.display_name)}
                disabled={assigning}
              >
                {s.display_name}
              </Menu.Item>
            ))}
            {t.assigned_to && (
              <>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconUserOff size={14} />}
                  color="gray"
                  onClick={() => handleAssign(t.ticket_id, null)}
                  disabled={assigning}
                >
                  Unassign
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
      <Table.Td>
        <Tooltip label={dayjs(t.created_at).format("DD MMM YYYY HH:mm")}>
          <Text size="sm" c="dimmed">
            {dayjs(t.created_at).fromNow()}
          </Text>
        </Tooltip>
      </Table.Td>
      <Table.Td onClick={(e) => e.stopPropagation()}>
        <Select
          size="xs"
          value={t.status}
          data={STATUS_OPTIONS}
          disabled={updating}
          onChange={(val) => val && handleStatusChange(t.ticket_id, val)}
          styles={{
            input: {
              background: "#faf8f5",
              border: "1px solid #ede7dc",
              fontSize: 12,
            },
          }}
          style={{ width: 120 }}
        />
      </Table.Td>
      <Table.Td>
        <ActionIcon
          variant="subtle"
          color="brand"
          onClick={(e) => {
            e.stopPropagation();
            openDetail(t);
          }}
        >
          <IconExternalLink size={15} />
        </ActionIcon>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <>
      <PageTitle title={pageTitle} sub={pageSub} />

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          mb="md"
          onClose={() => setError(null)}
          withCloseButton
        >
          {error}
        </Alert>
      )}

      <Card p="lg" style={{ border: "1px solid #f0ebe3" }}>
        <Table
          highlightOnHover
          verticalSpacing="sm"
          styles={{
            th: {
              color: "#a89880",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            },
          }}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Subject</Table.Th>
              <Table.Th>User</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Assignee</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th>Update Status</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Table.Tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <Table.Td key={j}>
                        <Skeleton height={18} />
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))
              : rows}
          </Table.Tbody>
        </Table>
        {!loading && tickets.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            No tickets found.
          </Text>
        )}
      </Card>

      {/* ── Ticket Detail Drawer ─────────────────────────────────────────────── */}
      <Drawer
        opened={opened}
        onClose={close}
        position="right"
        size="lg"
        styles={{
          header: { borderBottom: "1px solid #f0ebe3", paddingBottom: 16 },
          body: { padding: 0 },
        }}
        title={
          <Stack gap={2}>
            <Group gap="xs">
              <Badge color={statusColor(selected?.status ?? "")} variant="dot">
                {selected?.status}
              </Badge>
              <Text
                fw={600}
                lineClamp={1}
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {selected?.subject}
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              {selected?.email}
            </Text>
          </Stack>
        }
      >
        {selected && (
          <Stack
            gap={0}
            h="calc(100vh - 80px)"
            style={{ display: "flex", flexDirection: "column" }}
          >
            {/* Ticket meta bar */}
            <Box
              p="lg"
              style={{
                borderBottom: "1px solid #f0ebe3",
                background: "#fdf8f3",
              }}
            >
              <Group justify="space-between" align="flex-end">
                <Box>
                  <Text
                    size="xs"
                    c="dimmed"
                    tt="uppercase"
                    fw={600}
                    style={{ letterSpacing: "0.1em" }}
                  >
                    Ticket #{selected.ticket_id}
                  </Text>
                  <Text size="xs" c="dimmed" mt={2}>
                    Created{" "}
                    {dayjs(selected.created_at).format("DD MMM YYYY, HH:mm")}
                  </Text>
                </Box>
                <Group gap="sm" align="flex-end">
                  {/* Assignee picker in drawer */}
                  <Box>
                    <Text size="xs" c="dimmed" mb={4} fw={500}>
                      Assigned to
                    </Text>
                    <Menu shadow="md" width={200} withinPortal>
                      <Menu.Target>
                        <Button
                          variant="default"
                          size="xs"
                          radius="md"
                          disabled={assigning}
                          leftSection={
                            <AssigneeAvatar
                              member={
                                staff.find(
                                  (s) => s.id === selected.assigned_to,
                                ) ?? null
                              }
                              size="xs"
                            />
                          }
                          rightSection={<IconChevronDown size={12} />}
                          styles={{
                            root: {
                              border: "1px solid #ede7dc",
                              background: "white",
                              color: "#1a1410",
                              fontWeight: 400,
                            },
                          }}
                        >
                          {staff.find((s) => s.id === selected.assigned_to)
                            ?.display_name ?? "Unassigned"}
                        </Button>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Label>Assign to</Menu.Label>
                        {staff.map((s) => (
                          <Menu.Item
                            key={s.id}
                            leftSection={
                              <Avatar
                                size={20}
                                radius="xl"
                                style={{
                                  background: avatarColor(s.id),
                                  color: "white",
                                  fontSize: 9,
                                  fontWeight: 700,
                                }}
                              >
                                {nameInitials(s.display_name)}
                              </Avatar>
                            }
                            fw={selected.assigned_to === s.id ? 700 : 400}
                            style={{
                              color:
                                selected.assigned_to === s.id
                                  ? "#d88626"
                                  : undefined,
                            }}
                            onClick={() =>
                              handleAssign(
                                selected.ticket_id,
                                s.id,
                                s.display_name,
                              )
                            }
                            disabled={assigning}
                          >
                            {s.display_name}
                          </Menu.Item>
                        ))}
                        {selected.assigned_to && (
                          <>
                            <Menu.Divider />
                            <Menu.Item
                              leftSection={<IconUserOff size={14} />}
                              color="gray"
                              onClick={() =>
                                handleAssign(selected.ticket_id, null)
                              }
                              disabled={assigning}
                            >
                              Unassign
                            </Menu.Item>
                          </>
                        )}
                      </Menu.Dropdown>
                    </Menu>
                  </Box>
                  <Select
                    size="sm"
                    label="Status"
                    value={selected.status}
                    data={STATUS_OPTIONS}
                    disabled={updating}
                    onChange={(val) =>
                      val && handleStatusChange(selected.ticket_id, val)
                    }
                    styles={{
                      input: {
                        background: "white",
                        border: "1px solid #ede7dc",
                      },
                    }}
                    style={{ width: 140 }}
                  />
                </Group>
              </Group>
            </Box>

            <Divider
              label={
                <Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
                  Thread
                </Text>
              }
              labelPosition="center"
            />

            <ScrollArea style={{ flex: 1 }} p="lg" viewportRef={scrollRef}>
              {messagesLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} height={60} mb="sm" radius="md" />
                ))
              ) : messages.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  No messages in this session.
                </Text>
              ) : (
                messages
                  .filter((msg) => msg.role !== "system")
                  .map((msg) => {
                    const { color, label } = roleMeta(msg.role);
                    const isAdmin = msg.role === "admin";
                    return (
                      <Box key={msg.id} mb="sm">
                        <Group
                          gap="xs"
                          mb={4}
                          justify={isAdmin ? "flex-end" : "flex-start"}
                        >
                          {!isAdmin && (
                            <Badge size="xs" color={color} variant="dot">
                              {label}
                            </Badge>
                          )}
                          <Text size="xs" c="dimmed">
                            {dayjs(msg.timestamp).format("HH:mm:ss")}
                          </Text>
                          {isAdmin && (
                            <Badge size="xs" color={color} variant="dot">
                              {label}
                            </Badge>
                          )}
                        </Group>
                        <Paper
                          p="xs"
                          radius="md"
                          className={isAdmin ? "msg-bubble-admin" : undefined}
                          withBorder={!isAdmin}
                          style={{
                            marginLeft: isAdmin ? "auto" : undefined,
                            marginRight: isAdmin ? 0 : undefined,
                            maxWidth: "85%",
                            borderLeft: !isAdmin
                              ? `2px solid var(--mantine-color-${color}-4)`
                              : undefined,
                          }}
                        >
                          <MessageContent content={msg.content} />
                        </Paper>
                      </Box>
                    );
                  })
              )}
            </ScrollArea>

            {isOpen ? (
              <Box
                p="lg"
                style={{
                  borderTop: "1px solid #f0ebe3",
                  background: "#fdf8f3",
                }}
              >
                <Divider
                  mb="sm"
                  label={
                    <Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
                      Reply to customer
                    </Text>
                  }
                  labelPosition="center"
                />
                {replyError && (
                  <Alert
                    color="red"
                    mb="xs"
                    icon={<IconAlertCircle size={14} />}
                  >
                    {replyError}
                  </Alert>
                )}
                <Textarea
                  placeholder="Write a reply… (⌘Enter / Ctrl+Enter to send)"
                  value={replyText}
                  onChange={(e) => {
                    setReplyText(e.currentTarget.value);
                    if (selected?.session_id) {
                      if (!typingChannelRef.current) {
                        typingChannelRef.current = supabase.channel(
                          `admin-typing-${selected.session_id}`,
                        );
                        typingChannelRef.current.subscribe();
                      }
                      typingChannelRef.current.send({
                        type: "broadcast",
                        event: "typing",
                        payload: {},
                      });
                      if (typingTimerRef.current)
                        clearTimeout(typingTimerRef.current);
                      typingTimerRef.current = setTimeout(() => {
                        if (typingChannelRef.current) {
                          supabase.removeChannel(typingChannelRef.current);
                          typingChannelRef.current = null;
                        }
                      }, 5000);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleReply();
                    }
                  }}
                  minRows={3}
                  maxRows={6}
                  autosize
                  mb="sm"
                  disabled={sending}
                  styles={{
                    input: {
                      background: "white",
                      border: "1px solid #ede7dc",
                      borderRadius: 8,
                      fontSize: 13,
                    },
                  }}
                />
                <Group justify="flex-end">
                  <Button
                    leftSection={<IconSend size={14} />}
                    onClick={handleReply}
                    loading={sending}
                    disabled={!replyText.trim()}
                    style={{
                      background: "linear-gradient(135deg, #d88626, #e8a050)",
                      border: "none",
                    }}
                    radius="md"
                  >
                    Send Reply
                  </Button>
                </Group>
              </Box>
            ) : (
              <Box
                p="lg"
                style={{
                  borderTop: "1px solid #f0ebe3",
                  background: "#fdf8f3",
                }}
              >
                <Text
                  size="sm"
                  c="dimmed"
                  ta="center"
                  style={{ fontStyle: "italic" }}
                >
                  Replies available for <strong>open</strong> tickets only —
                  change status above to re-open.
                </Text>
              </Box>
            )}
          </Stack>
        )}
      </Drawer>
    </>
  );
}
