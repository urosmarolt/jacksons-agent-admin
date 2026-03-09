import { useEffect, useState } from "react";
import {
  SimpleGrid,
  Card,
  Text,
  Group,
  ThemeIcon,
  rem,
  Skeleton,
  Box,
  Badge,
  Stack,
  RingProgress,
} from "@mantine/core";
import {
  IconTicket,
  IconMessages,
  IconUsers,
  IconTrendingUp,
  IconAlertCircle,
  IconStar,
} from "@tabler/icons-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import dayjs from "dayjs";
import {
  fetchDashboardStats,
  fetchExtendedDashboardStats,
  fetchRatingStats,
} from "../lib/api";
import type { TicketStatusCount, TicketsByDay, RecentTicket } from "../lib/api";
import { useNewTicketsContext } from "../context/NewTicketsContext";

const STATUS_COLORS: Record<string, string> = {
  open: "#d88626",
  pending: "#eab308",
  resolved: "#10b981",
  closed: "#94a3b8",
};
const DONUT_FALLBACK = ["#d88626", "#eab308", "#10b981", "#94a3b8", "#3b82f6"];

function statusColor(s: string) {
  return STATUS_COLORS[s] ?? "#94a3b8";
}

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  color,
  bg,
  loading,
  suffix = "",
}: {
  title: string;
  value: number | string;
  description: string;
  icon: React.FC<any>;
  color: string;
  bg: string;
  loading: boolean;
  suffix?: string;
}) {
  return (
    <Card p="xl" className="stat-card" style={{ border: "1px solid #f0ebe3" }}>
      <Group justify="space-between" align="flex-start">
        <Box>
          <Text
            size="xs"
            fw={600}
            tt="uppercase"
            style={{ letterSpacing: "0.1em", color: "#a89880" }}
          >
            {title}
          </Text>
          {loading ? (
            <Skeleton height={40} width={70} mt={8} />
          ) : (
            <Text
              mt={6}
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 42,
                fontWeight: 600,
                lineHeight: 1,
                color: "#1a1410",
              }}
            >
              {value}
              {suffix}
            </Text>
          )}
          <Text size="xs" c="dimmed" mt={6}>
            {description}
          </Text>
        </Box>
        <ThemeIcon
          size={44}
          radius="xl"
          style={{ background: bg, color, border: "none" }}
        >
          <Icon style={{ width: rem(20), height: rem(20) }} />
        </ThemeIcon>
      </Group>
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text
      mt="xl"
      mb="md"
      style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 20,
        fontWeight: 600,
        color: "#1a1410",
      }}
    >
      {children}
    </Text>
  );
}

function DonutLabel({
  cx,
  cy,
  total,
}: {
  cx: number;
  cy: number;
  total: number;
}) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan
        x={cx}
        dy="-6"
        style={{
          fontSize: 26,
          fontWeight: 600,
          fontFamily: "'Playfair Display', serif",
          fill: "#1a1410",
        }}
      >
        {total}
      </tspan>
      <tspan
        x={cx}
        dy="22"
        style={{
          fontSize: 11,
          fill: "#a89880",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        tickets
      </tspan>
    </text>
  );
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <Box
      style={{
        background: "white",
        border: "1px solid #f0ebe3",
        borderRadius: 8,
        padding: "8px 14px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      <Text size="xs" c="dimmed" mb={2}>
        {label}
      </Text>
      <Text size="sm" fw={600} style={{ color: "#d88626" }}>
        {payload[0].value} ticket{payload[0].value !== 1 ? "s" : ""}
      </Text>
    </Box>
  );
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <Group gap={2} mt={6}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Text
          key={s}
          style={{
            fontSize: 24,
            color: s <= Math.round(rating) ? "#d88626" : "#e8ddd0",
            lineHeight: 1,
          }}
        >
          ★
        </Text>
      ))}
    </Group>
  );
}

export function Dashboard() {
  const [kpi, setKpi] = useState<{
    openTickets: number;
    totalSessions: number;
    uniqueUsers: number;
  } | null>(null);
  const [ext, setExt] = useState<{
    statusBreakdown: TicketStatusCount[];
    ticketsByDay: TicketsByDay[];
    recentTickets: RecentTicket[];
    escalationRate: number;
    totalTickets: number;
    sessionsWithTickets: number;
    totalSessions: number;
  } | null>(null);
  const [ratings, setRatings] = useState<{
    averageRating: number;
    totalRated: number;
    distribution: { stars: number; count: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [extLoading, setExtLoading] = useState(true);
  const [ratingsLoading, setRatingsLoading] = useState(true);

  const { newTickets } = useNewTicketsContext();
  const realtimeOpenCount = newTickets.filter(
    (t) => t.status === "open",
  ).length;
  const realtimeTotalCount = newTickets.length;

  useEffect(() => {
    fetchDashboardStats()
      .then(setKpi)
      .finally(() => setLoading(false));
    fetchExtendedDashboardStats()
      .then(setExt)
      .finally(() => setExtLoading(false));
    fetchRatingStats()
      .then(setRatings)
      .finally(() => setRatingsLoading(false));
  }, []);

  const kpiCards = [
    {
      title: "Open Tickets",
      value: (kpi?.openTickets ?? 0) + realtimeOpenCount,
      description: "Awaiting response",
      icon: IconTicket,
      color: "#d88626",
      bg: "#fdf6ee",
    },
    {
      title: "Chat Sessions",
      value: kpi?.totalSessions ?? 0,
      description: "Total conversations",
      icon: IconMessages,
      color: "#3b82f6",
      bg: "#eff6ff",
    },
    {
      title: "Unique Users",
      value: kpi?.uniqueUsers ?? 0,
      description: "Distinct customers",
      icon: IconUsers,
      color: "#10b981",
      bg: "#ecfdf5",
    },
    {
      title: "Total Tickets",
      value: (ext?.totalTickets ?? 0) + realtimeTotalCount,
      description: "All time",
      icon: IconAlertCircle,
      color: "#8b5cf6",
      bg: "#f5f3ff",
    },
  ];

  return (
    <Box>
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
          Dashboard
        </Text>
        <Text size="sm" c="dimmed" mt={4}>
          Overview of your support operations
        </Text>
      </Box>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
        {kpiCards.map((c) => (
          <KpiCard key={c.title} {...c} loading={loading || extLoading} />
        ))}
      </SimpleGrid>

      <SectionTitle>Ticket Analytics</SectionTitle>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        {/* Donut */}
        <Card p="xl" style={{ border: "1px solid #f0ebe3" }}>
          <Text
            size="sm"
            fw={600}
            tt="uppercase"
            style={{ letterSpacing: "0.1em", color: "#a89880" }}
            mb="lg"
          >
            Status Breakdown
          </Text>
          {extLoading ? (
            <Skeleton height={220} radius="md" />
          ) : !ext?.statusBreakdown.length ? (
            <Text c="dimmed" ta="center" py="xl" size="sm">
              No ticket data yet.
            </Text>
          ) : (
            <Group align="center" gap="xl">
              <PieChart width={180} height={180}>
                <Pie
                  data={ext.statusBreakdown}
                  cx={85}
                  cy={85}
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={3}
                  dataKey="count"
                  strokeWidth={0}
                >
                  {ext.statusBreakdown.map((entry, i) => (
                    <Cell
                      key={entry.status}
                      fill={DONUT_FALLBACK[i] ?? statusColor(entry.status)}
                    />
                  ))}
                </Pie>
                <DonutLabel cx={85} cy={85} total={ext.totalTickets} />
              </PieChart>
              <Stack gap={8} style={{ flex: 1 }}>
                {ext.statusBreakdown.map((entry, i) => (
                  <Group key={entry.status} justify="space-between">
                    <Group gap={8}>
                      <Box
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background:
                            DONUT_FALLBACK[i] ?? statusColor(entry.status),
                          flexShrink: 0,
                        }}
                      />
                      <Text
                        size="sm"
                        tt="capitalize"
                        style={{ color: "#5a5040" }}
                      >
                        {entry.status}
                      </Text>
                    </Group>
                    <Text size="sm" fw={600} style={{ color: "#1a1410" }}>
                      {entry.count}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Group>
          )}
        </Card>

        {/* Bar chart */}
        <Card p="xl" style={{ border: "1px solid #f0ebe3" }}>
          <Text
            size="sm"
            fw={600}
            tt="uppercase"
            style={{ letterSpacing: "0.1em", color: "#a89880" }}
            mb="lg"
          >
            Tickets — Last 14 Days
          </Text>
          {extLoading ? (
            <Skeleton height={220} radius="md" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={ext?.ticketsByDay ?? []}
                barSize={18}
                margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
              >
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#a89880" }}
                  tickLine={false}
                  axisLine={false}
                  interval={1}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#a89880" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <ReTooltip
                  content={<BarTooltip />}
                  cursor={{ fill: "#fdf6ee" }}
                />
                <Bar dataKey="tickets" radius={[4, 4, 0, 0]}>
                  {(ext?.ticketsByDay ?? []).map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.tickets > 0 ? "#d88626" : "#f0ebe3"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </SimpleGrid>

      <SectionTitle>Activity</SectionTitle>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        {/* Escalation rate */}
        <Card p="xl" style={{ border: "1px solid #f0ebe3" }}>
          <Text
            size="sm"
            fw={600}
            tt="uppercase"
            style={{ letterSpacing: "0.1em", color: "#a89880" }}
            mb="lg"
          >
            Escalation Rate
          </Text>
          {extLoading ? (
            <Skeleton height={160} radius="md" />
          ) : (
            <Group align="center" gap="xl">
              <RingProgress
                size={140}
                thickness={12}
                roundCaps
                sections={[
                  { value: ext?.escalationRate ?? 0, color: "#d88626" },
                ]}
                label={
                  <Box ta="center">
                    <Text
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: 28,
                        fontWeight: 600,
                        color: "#1a1410",
                        lineHeight: 1,
                      }}
                    >
                      {ext?.escalationRate ?? 0}%
                    </Text>
                  </Box>
                }
              />
              <Stack gap={6}>
                <Text size="sm" style={{ color: "#5a5040" }}>
                  <Text component="span" fw={600} style={{ color: "#1a1410" }}>
                    {ext?.sessionsWithTickets ?? 0}
                  </Text>{" "}
                  of{" "}
                  <Text component="span" fw={600} style={{ color: "#1a1410" }}>
                    {ext?.totalSessions ?? 0}
                  </Text>{" "}
                  sessions
                </Text>
                <Text size="sm" style={{ color: "#5a5040" }}>
                  raised a support ticket
                </Text>
                <Badge
                  mt={4}
                  variant="light"
                  size="sm"
                  color={
                    (ext?.escalationRate ?? 0) > 30
                      ? "red"
                      : (ext?.escalationRate ?? 0) > 10
                        ? "yellow"
                        : "green"
                  }
                >
                  {(ext?.escalationRate ?? 0) > 30
                    ? "High"
                    : (ext?.escalationRate ?? 0) > 10
                      ? "Moderate"
                      : "Low"}{" "}
                  escalation
                </Badge>
              </Stack>
            </Group>
          )}
        </Card>

        {/* Recent tickets */}
        <Card p="xl" style={{ border: "1px solid #f0ebe3" }}>
          <Text
            size="sm"
            fw={600}
            tt="uppercase"
            style={{ letterSpacing: "0.1em", color: "#a89880" }}
            mb="lg"
          >
            Recent Tickets
          </Text>
          {extLoading ? (
            <Stack gap="sm">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} height={36} radius="md" />
              ))}
            </Stack>
          ) : !ext?.recentTickets.length ? (
            <Text c="dimmed" ta="center" py="xl" size="sm">
              No tickets yet.
            </Text>
          ) : (
            <Stack gap={0}>
              {ext.recentTickets.map((t, i) => (
                <Box key={t.ticket_id}>
                  <Group
                    justify="space-between"
                    py={10}
                    style={{
                      borderBottom:
                        i < ext.recentTickets.length - 1
                          ? "1px solid #f0ebe3"
                          : "none",
                    }}
                  >
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Text
                        size="sm"
                        fw={500}
                        lineClamp={1}
                        style={{ color: "#1a1410" }}
                      >
                        {t.subject}
                      </Text>
                      <Text size="xs" c="dimmed" mt={1}>
                        {t.email} · {dayjs(t.created_at).fromNow()}
                      </Text>
                    </Box>
                    <Badge
                      size="xs"
                      variant="dot"
                      style={{ flexShrink: 0 }}
                      color={
                        t.status === "open"
                          ? "orange"
                          : t.status === "resolved"
                            ? "green"
                            : t.status === "pending"
                              ? "yellow"
                              : "gray"
                      }
                    >
                      {t.status}
                    </Badge>
                  </Group>
                </Box>
              ))}
            </Stack>
          )}
        </Card>
      </SimpleGrid>

      {/* ── Customer Satisfaction ─────────────────────────────────────────── */}
      <SectionTitle>Customer Satisfaction</SectionTitle>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        {/* Average rating KPI */}
        <Card p="xl" style={{ border: "1px solid #f0ebe3" }}>
          <Text
            size="sm"
            fw={600}
            tt="uppercase"
            style={{ letterSpacing: "0.1em", color: "#a89880" }}
            mb="lg"
          >
            Average Rating
          </Text>
          {ratingsLoading ? (
            <Skeleton height={120} radius="md" />
          ) : !ratings?.totalRated ? (
            <Text c="dimmed" ta="center" py="xl" size="sm">
              No ratings yet.
            </Text>
          ) : (
            <Group align="center" gap="xl">
              <Box ta="center">
                <Text
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 56,
                    fontWeight: 600,
                    color: "#1a1410",
                    lineHeight: 1,
                  }}
                >
                  {ratings.averageRating}
                </Text>
                <StarDisplay rating={ratings.averageRating} />
                <Text size="xs" c="dimmed" mt={8}>
                  {ratings.totalRated} rating
                  {ratings.totalRated !== 1 ? "s" : ""}
                </Text>
              </Box>
              <Stack gap={6} style={{ flex: 1 }}>
                {[5, 4, 3, 2, 1].map((s) => {
                  const entry = ratings.distribution.find((d) => d.stars === s);
                  const count = entry?.count ?? 0;
                  const pct =
                    ratings.totalRated > 0
                      ? Math.round((count / ratings.totalRated) * 100)
                      : 0;
                  return (
                    <Group key={s} gap={8} align="center">
                      <Text size="xs" w={8} style={{ color: "#a89880" }}>
                        {s}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#d88626" }}>★</Text>
                      <Box
                        style={{
                          flex: 1,
                          height: 6,
                          background: "#f0ebe3",
                          borderRadius: 3,
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background:
                              "linear-gradient(90deg,#d88626,#e8a050)",
                            borderRadius: 3,
                            transition: "width 0.6s ease",
                          }}
                        />
                      </Box>
                      <Text
                        size="xs"
                        w={28}
                        ta="right"
                        style={{ color: "#a89880" }}
                      >
                        {count}
                      </Text>
                    </Group>
                  );
                })}
              </Stack>
            </Group>
          )}
        </Card>

        {/* Rating distribution bar chart */}
        <Card p="xl" style={{ border: "1px solid #f0ebe3" }}>
          <Text
            size="sm"
            fw={600}
            tt="uppercase"
            style={{ letterSpacing: "0.1em", color: "#a89880" }}
            mb="lg"
          >
            Rating Distribution
          </Text>
          {ratingsLoading ? (
            <Skeleton height={180} radius="md" />
          ) : !ratings?.totalRated ? (
            <Text c="dimmed" ta="center" py="xl" size="sm">
              No ratings yet.
            </Text>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={ratings.distribution}
                barSize={32}
                margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
              >
                <XAxis
                  dataKey="stars"
                  tick={{ fontSize: 11, fill: "#a89880" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => "★".repeat(v)}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#a89880" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <ReTooltip
                  content={({ active, payload }: any) =>
                    active && payload?.length ? (
                      <Box
                        style={{
                          background: "white",
                          border: "1px solid #f0ebe3",
                          borderRadius: 8,
                          padding: "8px 14px",
                        }}
                      >
                        <Text size="xs" c="dimmed">
                          {"★".repeat(payload[0].payload.stars)}
                        </Text>
                        <Text size="sm" fw={600} style={{ color: "#d88626" }}>
                          {payload[0].value} response
                          {payload[0].value !== 1 ? "s" : ""}
                        </Text>
                      </Box>
                    ) : null
                  }
                  cursor={{ fill: "#fdf6ee" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#d88626" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </SimpleGrid>
    </Box>
  );
}
