/**
 * NavbarNested.tsx
 * Place in: src/components/NavbarNested.tsx
 */
import { useState } from "react";
import { ScrollArea, Collapse, rem, Badge, Tooltip } from "@mantine/core";
import {
  IconTicket,
  IconMessages,
  IconChevronRight,
  IconLayoutDashboard,
  IconUsers,
  IconLogout,
} from "@tabler/icons-react";
import { useLocation } from "wouter";
import { useAuth } from "../context/AuthContext";
import classes from "./NavbarNested.module.css";

interface NavLinkProps {
  icon: React.FC<any>;
  label: string;
  href?: string;
  links?: { label: string; href: string }[];
  badge?: number;
}

function NavLink({ icon: Icon, label, href, links, badge }: NavLinkProps) {
  const [location, navigate] = useLocation();
  const [opened, setOpened] = useState(false);
  const hasLinks = Array.isArray(links) && links.length > 0;
  const active = href
    ? location === href
    : links?.some((l) => location === l.href);

  const items = hasLinks
    ? links!.map((link) => (
        <a
          className={classes.link}
          data-active={location === link.href || undefined}
          href={link.href}
          key={link.label}
          onClick={(e) => {
            e.preventDefault();
            navigate(link.href);
          }}
        >
          {link.label}
        </a>
      ))
    : null;

  return (
    <>
      <button
        onClick={() => {
          if (hasLinks) setOpened((o) => !o);
          else if (href) navigate(href);
        }}
        className={classes.control}
        data-active={active && !hasLinks ? true : undefined}
      >
        <Icon
          className={classes.icon}
          style={{ width: rem(16), height: rem(16) }}
        />
        <span style={{ flex: 1 }}>{label}</span>
        {badge != null && badge > 0 && (
          <Badge
            size="xs"
            circle
            color="orange"
            style={{
              marginRight: hasLinks ? 4 : 0,
              minWidth: 18,
              fontSize: 10,
            }}
          >
            {badge > 99 ? "99+" : badge}
          </Badge>
        )}
        {hasLinks && (
          <IconChevronRight
            className={classes.chevron}
            stroke={1.5}
            style={{
              width: rem(14),
              height: rem(14),
              transform: opened ? "rotate(90deg)" : "none",
            }}
          />
        )}
      </button>
      {hasLinks && <Collapse in={opened}>{items}</Collapse>}
    </>
  );
}

function avatarInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface NavbarNestedProps {
  unreadTickets?: number;
}

export function NavbarNested({ unreadTickets = 0 }: NavbarNestedProps) {
  const { user, signOut } = useAuth();

  const navItems: NavLinkProps[] = [
    { label: "Dashboard", icon: IconLayoutDashboard, href: "/" },
    {
      label: "Support Tickets",
      icon: IconTicket,
      badge: unreadTickets,
      links: [
        { label: "All Tickets", href: "/tickets" },
        { label: "Open", href: "/tickets/open" },
        { label: "Closed", href: "/tickets/closed" },
      ],
    },
    { label: "Chat Sessions", icon: IconMessages, href: "/sessions" },
    // Team page visible to super_admin only
    ...(user?.role === "super_admin"
      ? [{ label: "Team", icon: IconUsers, href: "/team" }]
      : []),
  ];

  return (
    <nav className={classes.navbar}>
      <div className={classes.header}>
        <div className={classes.logoScript}>
          Jackson<span>'s</span>
        </div>
        <div className={classes.logoSub}>Admin Console</div>
      </div>

      <ScrollArea className={classes.links}>
        <div style={{ padding: "4px 0" }}>
          <div className={classes.section}>Navigation</div>
          {navItems.map((item) => (
            <NavLink {...item} key={item.label} />
          ))}
        </div>
      </ScrollArea>

      <div className={classes.footer}>
        <div className={classes.footerUser}>
          <div
            className={classes.avatar}
            style={{
              background: "linear-gradient(135deg,#d88626,#e8a050)",
              color: "white",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {user ? avatarInitials(user.display_name) : "?"}
          </div>
          <div className={classes.userInfo}>
            <div className={classes.userName}>{user?.display_name ?? "…"}</div>
            <div className={classes.userRole}>
              {user?.role === "super_admin" ? "Super Admin" : "Agent"}
            </div>
          </div>
          <Tooltip label="Sign out" position="right">
            <button
              onClick={signOut}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <IconLogout
                style={{ width: rem(15), height: rem(15), color: "#c0b4a0" }}
              />
            </button>
          </Tooltip>
        </div>
      </div>
    </nav>
  );
}
