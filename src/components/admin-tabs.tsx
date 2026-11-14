"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/content", label: "Links and pages" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/blocklist", label: "Blocklist" },
  { href: "/admin/email", label: "Email" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminTabs() {
  const path = usePathname();
  return (
    <nav className="subnav" aria-label="Administration">
      {TABS.map((t) => {
        const active = t.exact ? path === t.href : path === t.href || path.startsWith(t.href + "/");
        return <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}>{t.label}</Link>;
      })}
    </nav>
  );
}
