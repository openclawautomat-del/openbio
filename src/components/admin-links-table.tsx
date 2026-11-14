"use client";

import { useState, useTransition } from "react";
import { bulkLinksAdminAction } from "@/app/actions/admin";

export interface AdminLink { id: number; slug: string; target_url: string; owner: string; enabled: number; moderated: number; clicks: number }

export function AdminLinksTable({ rows }: { rows: AdminLink[] }) {
  const [sel, setSel] = useState<number[]>([]);
  const [pending, start] = useTransition();
  const all = rows.length > 0 && sel.length === rows.length;
  const run = (op: "disable" | "enable" | "delete") => {
    if (op === "delete" && !window.confirm(`Delete ${sel.length} link${sel.length === 1 ? "" : "s"} and their click history?`)) return;
    start(async () => {
      await bulkLinksAdminAction(op, sel);
      setSel([]);
    });
  };
  return (
    <>
      <div className="row" style={{ marginBottom: 12, minHeight: 32 }} aria-live="polite">
        {sel.length > 0 ? (
          <>
            <span className="small">{sel.length} selected</span>
            <button className="btn btn-sm" disabled={pending} onClick={() => run("disable")}>Disable</button>
            <button className="btn btn-sm" disabled={pending} onClick={() => run("enable")}>Enable</button>
            <button className="btn btn-sm btn-danger" disabled={pending} onClick={() => run("delete")}>Delete</button>
          </>
        ) : (
          <span className="small muted">Select links to act on several at once.</span>
        )}
      </div>
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 32 }}><input type="checkbox" aria-label="Select all" checked={all} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} /></th>
            <th>Slug</th><th>Destination</th><th>Owner</th><th>Clicks</th><th>State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><input type="checkbox" aria-label={`Select ${r.slug}`} checked={sel.includes(r.id)} onChange={(e) => setSel(e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} /></td>
              <td className="num">{r.slug}</td>
              <td className="small" style={{ maxWidth: 320, overflowWrap: "anywhere" }}>{r.target_url}</td>
              <td>{r.owner}</td>
              <td className="num">{Number(r.clicks)}</td>
              <td>{r.moderated ? <span className="badge bad">Removed</span> : r.enabled ? <span className="badge good">Live</span> : <span className="badge">Off</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
