"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileText, KeyRound, Link2, LayoutGrid, QrCode, Settings, BookOpen, Shield, Users, Ban, Flag, ScrollText, Mail, Sliders, Globe, Contact, Users2, Target } from "lucide-react";

const ICONS = { overview: LayoutGrid, links: Link2, page: FileText, analytics: BarChart3, qr: QrCode, api: KeyRound, settings: Settings, docs: BookOpen, admin: Shield, users: Users, blocklist: Ban, reports: Flag, audit: ScrollText, email: Mail, config: Sliders, domains: Globe, contacts: Contact, teams: Users2, goals: Target } as const;
export type NavIcon = keyof typeof ICONS;
export interface NavItem { href: string; label: string; icon: NavIcon; exact?: boolean }

export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <>
      {items.map((i) => {
        const Icon = ICONS[i.icon];
        const active = i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/");
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}>
            <Icon className="icon" />
            {i.label}
          </Link>
        );
      })}
    </>
  );
}
