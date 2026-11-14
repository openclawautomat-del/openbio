"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Copy, Lock, Trash2, Power } from "lucide-react";
import { bulkLinksAction, deleteLinkAction, toggleLinkAction } from "@/app/actions/app";

export interface LinkItem {
  id: number; slug: string; title: string | null; target: string; short: string; state: string; locked: boolean;
  clicks: number; unique: number; created: string; expires: string | null;
}

const BADGE: Record<string, string> = { active: "good", disabled: "", expired: "warn", scheduled: "warn", moderated: "bad" };

export function LinksTable({ rows }: { rows: LinkItem[] }) {
  const [sel, setSel] = useState<number[]>([]);
  const [pending, start] = useTransition();
  const all = rows.length > 0 && sel.length === rows.length;
  const run = (op: "enable" | "disable" | "delete") => {
    if (op === "delete" && !window.confirm(`Delete ${sel.length} link${sel.length > 1 ? "s" : ""} and their click history?`)) return;
    start(async () => { await bulkLinksAction(op, sel); setSel([]); });
  };
  return (
    <>
      {sel.length > 0 && (
        <div className="toolbar" role="region" aria-label="Bulk actions">
          <span className="small">{sel.length} selected</span>
          <button className="btn btn-sm" disabled={pending} onClick={() => run("enable")}>Enable</button>
          <button className="btn btn-sm" disabled={pending} onClick={() => run("disable")}>Disable</button>
          <button className="btn btn-sm btn-danger" disabled={pending} onClick={() => run("delete")}>Delete</button>
        </div>
      )}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 32 }}><input type="checkbox" aria-label="Select all" checked={all} onChange={() => setSel(all ? [] : rows.map((r) => r.id))} /></th>
              <th>Link</th><th>Destination</th><th>Status</th><th className="r">Clicks</th><th className="r">Unique</th><th style={{ width: 120 }}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><input type="checkbox" aria-label={`Select ${r.slug}`} checked={sel.includes(r.id)} onChange={() => setSel(sel.includes(r.id) ? sel.filter((x) => x !== r.id) : [...sel, r.id])} /></td>
                <td>
                  <Link href={`/dashboard/links/${r.id}`} className="title">{r.title || r.slug}</Link>
                  <div className="mono small muted">/{r.slug}{r.locked && <Lock className="icon" style={{ width: 12, height: 12, marginLeft: 6 }} aria-label="Password protected" />}</div>
                </td>
                <td className="dest" title={r.target}>{r.target}</td>
                <td><span className={`badge ${BADGE[r.state] ?? ""}`}>{r.state}</span></td>
                <td className="r num">{r.clicks.toLocaleString("en-US")}</td>
                <td className="r num">{r.unique.toLocaleString("en-US")}</td>
                <td className="r">
                  <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Copy ${r.short}`} title="Copy short URL" onClick={() => navigator.clipboard.writeText(r.short)}><Copy className="icon" /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" aria-label={r.state === "disabled" ? "Enable" : "Disable"} title={r.state === "disabled" ? "Enable" : "Disable"} disabled={pending} onClick={() => start(async () => { await toggleLinkAction(r.id); })}><Power className="icon" /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Delete ${r.slug}`} title="Delete" disabled={pending} onClick={() => { if (window.confirm(`Delete /${r.slug}? Its click history goes with it.`)) start(async () => { await deleteLinkAction(r.id); }); }}><Trash2 className="icon" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
