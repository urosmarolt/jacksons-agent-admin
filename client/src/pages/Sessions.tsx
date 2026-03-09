import { useEffect, useState } from "react";
import {
  Text,
  Card,
  Table,
  Badge,
  TextInput,
  Group,
  Skeleton,
  Alert,
  ActionIcon,
  Drawer,
  ScrollArea,
  Avatar,
  Divider,
  Box,
  Paper,
  Stack,
  Tooltip,
  SegmentedControl,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconSearch,
  IconMessages,
  IconAlertCircle,
  IconRobot,
  IconUser,
  IconTool,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { fetchSessions, fetchMessagesBySession } from "../lib/api";
import type { Session, Message } from "../lib/supabase";

dayjs.extend(relativeTime);

function sessionStatusColor(status: string, last_active: string) {
  if (status === "closed") return "gray";
  const mins = dayjs().diff(dayjs(last_active), "minute");
  if (mins < 30) return "green";
  if (mins < 120) return "yellow";
  return "gray";
}

function sessionStatusLabel(status: string, last_active: string) {
  if (status === "closed") return "Closed";
  const mins = dayjs().diff(dayjs(last_active), "minute");
  if (mins < 30) return "Active";
  if (mins < 120) return "Idle";
  return "Closed";
}

function roleMeta(role: string) {
  switch (role) {
    case "assistant":
      return { color: "blue", label: "Agent", icon: IconRobot };
    case "admin":
      return { color: "orange", label: "Admin", icon: IconUser };
    case "tool":
      return { color: "violet", label: "Tool", icon: IconTool };
    default:
      return { color: "gray", label: "User", icon: IconUser };
  }
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

export function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filtered, setFiltered] = useState<Session[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [opened, { open, close }] = useDisclosure(false);

  useEffect(() => {
    fetchSessions()
      .then((data) => {
        setSessions(data);
        setFiltered(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Apply search + status filter
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      sessions.filter((s) => {
        const matchesSearch =
          s.email.toLowerCase().includes(q) ||
          s.session_id.toLowerCase().includes(q);
        const effectiveStatus =
          s.status === "closed"
            ? "closed"
            : dayjs().diff(dayjs(s.last_active), "minute") < 120
              ? "active"
              : "closed";
        const matchesStatus =
          statusFilter === "all" || effectiveStatus === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    );
  }, [search, statusFilter, sessions]);

  const openThread = async (session: Session) => {
    setSelected(session);
    open();
    setMessagesLoading(true);
    try {
      setMessages(await fetchMessagesBySession(session.session_id));
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Counts for filter tabs
  const activeCnt = sessions.filter(
    (s) =>
      s.status !== "closed" &&
      dayjs().diff(dayjs(s.last_active), "minute") < 120,
  ).length;
  const closedCnt = sessions.filter(
    (s) =>
      s.status === "closed" ||
      dayjs().diff(dayjs(s.last_active), "minute") >= 120,
  ).length;

  const rows = filtered.map((s) => (
    <Table.Tr
      key={s.session_id}
      className="clickable-row"
      onClick={() => openThread(s)}
    >
      <Table.Td>
        <Group gap="xs">
          <Avatar
            size="sm"
            radius="xl"
            style={{
              background: "linear-gradient(135deg,#d88626,#e8a050)",
              color: "white",
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            {s.email[0]?.toUpperCase()}
          </Avatar>
          <Text size="sm" fw={500}>
            {s.email}
          </Text>
        </Group>
      </Table.Td>
      <Table.Td>
        <Text size="xs" c="dimmed" ff="monospace">
          {s.session_id.slice(0, 16)}…
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge
          color={sessionStatusColor(s.status, s.last_active)}
          variant="dot"
          size="sm"
        >
          {sessionStatusLabel(s.status, s.last_active)}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Tooltip label={dayjs(s.created_at).format("DD MMM YYYY HH:mm")}>
          <Text size="sm" c="dimmed">
            {dayjs(s.created_at).fromNow()}
          </Text>
        </Tooltip>
      </Table.Td>
      <Table.Td>
        <Tooltip label={dayjs(s.last_active).format("DD MMM YYYY HH:mm")}>
          <Text size="sm" c="dimmed">
            {dayjs(s.last_active).fromNow()}
          </Text>
        </Tooltip>
      </Table.Td>
      <Table.Td>
        <ActionIcon
          variant="subtle"
          color="brand"
          onClick={(e) => {
            e.stopPropagation();
            openThread(s);
          }}
        >
          <IconMessages size={15} />
        </ActionIcon>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <>
      <PageTitle
        title="Chat Sessions"
        sub="Browse and inspect all customer conversations"
      />

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
          {error}
        </Alert>
      )}

      <Card p="lg" style={{ border: "1px solid #f0ebe3" }}>
        <Group mb="md" justify="space-between">
          <TextInput
            leftSection={<IconSearch size={15} color="#a89880" />}
            placeholder="Search by email or session ID…"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
            styles={{
              input: {
                background: "#faf8f5",
                border: "1px solid #ede7dc",
                borderRadius: 8,
              },
            }}
          />
          <SegmentedControl
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { label: `All (${sessions.length})`, value: "all" },
              { label: `Active (${activeCnt})`, value: "active" },
              { label: `Closed (${closedCnt})`, value: "closed" },
            ]}
            styles={{
              root: { background: "#f0ebe3", border: "none" },
              indicator: {
                background: "white",
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              },
              label: { fontSize: 12, color: "#a89880" },
            }}
          />
        </Group>

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
              <Table.Th>User</Table.Th>
              <Table.Th>Session ID</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Started</Table.Th>
              <Table.Th>Last Active</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Table.Tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <Table.Td key={j}>
                        <Skeleton height={18} />
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))
              : rows}
          </Table.Tbody>
        </Table>
        {!loading && filtered.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            No sessions found.
          </Text>
        )}
      </Card>

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
              <Badge
                color={sessionStatusColor(
                  selected?.status ?? "active",
                  selected?.last_active ?? "",
                )}
                variant="dot"
                size="sm"
              >
                {sessionStatusLabel(
                  selected?.status ?? "active",
                  selected?.last_active ?? "",
                )}
              </Badge>
              <Text
                fw={600}
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {selected?.email}
              </Text>
            </Group>
            <Text size="xs" c="dimmed" ff="monospace">
              {selected?.session_id}
            </Text>
          </Stack>
        }
      >
        <ScrollArea h="calc(100vh - 100px)" p="lg">
          {messagesLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={60} mb="sm" radius="md" />
            ))
          ) : messages.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No messages in this session.
            </Text>
          ) : (
            messages.map((msg, i) => {
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
                    style={{
                      marginLeft: isAdmin ? "auto" : undefined,
                      maxWidth: "85%",
                      borderLeft: !isAdmin
                        ? `2px solid var(--mantine-color-${color}-4)`
                        : undefined,
                    }}
                    withBorder={!isAdmin}
                  >
                    <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                      {msg.content || (
                        <Text component="span" c="dimmed" fs="italic">
                          — no content —
                        </Text>
                      )}
                    </Text>
                  </Paper>
                  {i < messages.length - 1 && <Divider mt="sm" opacity={0.3} />}
                </Box>
              );
            })
          )}
        </ScrollArea>
      </Drawer>
    </>
  );
}
