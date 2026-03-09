/**
 * TeamPage.tsx — Super admin only
 * Place in: src/pages/TeamPage.tsx
 */
import { useEffect, useState } from "react";
import {
  Box,
  Card,
  Text,
  Group,
  Stack,
  Button,
  TextInput,
  Select,
  Badge,
  Avatar,
  Table,
  Skeleton,
  Alert,
  Modal,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconTrash,
  IconAlertCircle,
  IconMail,
  IconCircleCheck,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

dayjs.extend(relativeTime);

interface StaffMember {
  id: string;
  display_name: string;
  role: string;
  email: string;
  created_at: string;
}
interface Invite {
  id: string;
  email: string;
  role: string;
  display_name: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
  invited_by: string | null;
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
function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
function roleColor(role: string) {
  return role === "super_admin" ? "orange" : "blue";
}
function roleLabel(role: string) {
  return role === "super_admin" ? "Super Admin" : "Agent";
}

export function TeamPage() {
  const { session, user } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const [opened, { open, close }] = useDisclosure(false);
  const [invEmail, setInvEmail] = useState("");
  const [invName, setInvName] = useState("");
  const [invRole, setInvRole] = useState<string>("agent");
  const [sending, setSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [{ data: staffData }, { data: inviteData }] = await Promise.all([
        supabase
          .from("staff_profiles")
          .select("id, display_name, role, created_at")
          .order("created_at"),
        supabase
          .from("invites")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      setStaff(staffData ?? []);
      setInvites(inviteData ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const handleInvite = async () => {
    if (!invEmail.trim() || !invName.trim()) return;
    setSending(true);
    setInviteError(null);
    try {
      const { error } = await supabase.functions.invoke("send-invite", {
        body: {
          email: invEmail.trim(),
          display_name: invName.trim(),
          role: invRole,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) {
        setInviteError(error.message);
        return;
      }
      setInviteSent(true);
      await load();
      setTimeout(() => {
        setInviteSent(false);
        close();
        setInvEmail("");
        setInvName("");
        setInvRole("agent");
      }, 2500);
    } catch (e: any) {
      setInviteError(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevoking(id);
    try {
      const { error } = await supabase.from("invites").delete().eq("id", id);
      if (error) throw error;
      setInvites((prev) => prev.filter((i) => i.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRevoking(null);
    }
  };

  const pendingInvites = invites.filter(
    (i) => !i.used_at && dayjs(i.expires_at).isAfter(dayjs()),
  );
  const usedInvites = invites.filter((i) => i.used_at);

  return (
    <Box>
      <Group justify="space-between" mb="xl" align="flex-end">
        <Box>
          <Text
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 28,
              fontWeight: 600,
              color: "#1a1410",
            }}
          >
            Team
          </Text>
          <Text size="sm" c="dimmed" mt={4}>
            Manage staff access and invitations
          </Text>
        </Box>
        <Button
          leftSection={<IconPlus size={15} />}
          onClick={open}
          style={{
            background: "linear-gradient(135deg,#d88626,#e8a050)",
            border: "none",
          }}
          radius="md"
        >
          Invite staff
        </Button>
      </Group>

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          mb="md"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* Staff members */}
      <Text
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 18,
          fontWeight: 600,
          color: "#1a1410",
        }}
        mb="md"
      >
        Staff members
      </Text>
      <Card p="lg" mb="xl" style={{ border: "1px solid #f0ebe3" }}>
        <Table
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
              <Table.Th>Name</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Joined</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Table.Tr key={i}>
                    {Array.from({ length: 3 }).map((_, j) => (
                      <Table.Td key={j}>
                        <Skeleton height={18} />
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))
              : staff.map((s) => (
                  <Table.Tr key={s.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <Avatar
                          size="sm"
                          radius="xl"
                          style={{
                            background: avatarColor(s.id),
                            color: "white",
                            fontWeight: 700,
                            fontSize: 11,
                          }}
                        >
                          {initials(s.display_name)}
                        </Avatar>
                        <Text size="sm" fw={500}>
                          {s.display_name}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={roleColor(s.role)}
                        variant="light"
                        size="sm"
                      >
                        {roleLabel(s.role)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {dayjs(s.created_at).format("DD MMM YYYY")}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
          </Table.Tbody>
        </Table>
        {!loading && staff.length === 0 && (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            No staff members yet.
          </Text>
        )}
      </Card>

      {/* Pending invites */}
      <Text
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 18,
          fontWeight: 600,
          color: "#1a1410",
        }}
        mb="md"
      >
        Pending invites
      </Text>
      <Card p="lg" mb="xl" style={{ border: "1px solid #f0ebe3" }}>
        {loading ? (
          <Skeleton height={60} />
        ) : pendingInvites.length === 0 ? (
          <Text c="dimmed" ta="center" py="md" size="sm">
            No pending invites.
          </Text>
        ) : (
          <Stack gap={0}>
            {pendingInvites.map((inv, i) => (
              <Box key={inv.id}>
                <Group
                  justify="space-between"
                  py={12}
                  style={{
                    borderBottom:
                      i < pendingInvites.length - 1
                        ? "1px solid #f0ebe3"
                        : "none",
                  }}
                >
                  <Group gap="xs">
                    <IconMail size={16} color="#a89880" />
                    <Box>
                      <Text size="sm" fw={500}>
                        {inv.display_name}{" "}
                        <Text component="span" size="xs" c="dimmed">
                          ({inv.email})
                        </Text>
                      </Text>
                      <Text size="xs" c="dimmed">
                        Expires {dayjs(inv.expires_at).fromNow()}
                      </Text>
                    </Box>
                  </Group>
                  <Group gap="xs">
                    <Badge
                      color={roleColor(inv.role)}
                      variant="light"
                      size="xs"
                    >
                      {roleLabel(inv.role)}
                    </Badge>
                    <Tooltip label="Revoke invite">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        loading={revoking === inv.id}
                        onClick={() => handleRevoke(inv.id)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Box>
            ))}
          </Stack>
        )}
      </Card>

      {/* Accepted invites */}
      {usedInvites.length > 0 && (
        <>
          <Text
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 18,
              fontWeight: 600,
              color: "#1a1410",
            }}
            mb="md"
          >
            Accepted invites
          </Text>
          <Card p="lg" style={{ border: "1px solid #f0ebe3" }}>
            <Stack gap={0}>
              {usedInvites.map((inv, i) => (
                <Box key={inv.id}>
                  <Group
                    justify="space-between"
                    py={10}
                    style={{
                      borderBottom:
                        i < usedInvites.length - 1
                          ? "1px solid #f0ebe3"
                          : "none",
                    }}
                  >
                    <Group gap="xs">
                      <IconCircleCheck size={15} color="#10b981" />
                      <Text size="sm" c="dimmed">
                        {inv.display_name} ({inv.email})
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Accepted {dayjs(inv.used_at!).fromNow()}
                    </Text>
                  </Group>
                </Box>
              ))}
            </Stack>
          </Card>
        </>
      )}

      {/* Invite modal */}
      <Modal
        opened={opened}
        onClose={close}
        radius="lg"
        title={
          <Text
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 18,
              fontWeight: 600,
              color: "#1a1410",
            }}
          >
            Invite a team member
          </Text>
        }
        styles={{ body: { paddingTop: 8 } }}
      >
        {inviteSent ? (
          <Alert
            icon={<IconCircleCheck size={16} />}
            color="green"
            title="Invite sent!"
          >
            An invitation email has been sent to {invEmail}.
          </Alert>
        ) : (
          <Stack gap="md">
            {inviteError && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="red"
                variant="light"
              >
                {inviteError}
              </Alert>
            )}
            <TextInput
              label="Their name"
              placeholder="e.g. Alice Smith"
              value={invName}
              onChange={(e) => setInvName(e.currentTarget.value)}
              styles={{ input: { border: "1px solid #ede7dc" } }}
            />
            <TextInput
              label="Email address"
              placeholder="alice@example.com"
              value={invEmail}
              onChange={(e) => setInvEmail(e.currentTarget.value)}
              styles={{ input: { border: "1px solid #ede7dc" } }}
            />
            <Select
              label="Role"
              value={invRole}
              data={[
                { value: "agent", label: "Agent" },
                { value: "super_admin", label: "Super Admin" },
              ]}
              onChange={(v) => v && setInvRole(v)}
              styles={{ input: { border: "1px solid #ede7dc" } }}
            />
            <Button
              fullWidth
              mt="xs"
              loading={sending}
              disabled={!invEmail.trim() || !invName.trim()}
              onClick={handleInvite}
              style={{
                background: "linear-gradient(135deg,#d88626,#e8a050)",
                border: "none",
              }}
              radius="md"
            >
              Send invite
            </Button>
          </Stack>
        )}
      </Modal>
    </Box>
  );
}
