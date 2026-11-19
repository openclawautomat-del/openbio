import Link from "next/link";
import { query } from "@/lib/db";
import { ActionButton, ConfirmButton } from "@/components/client";
import { resolveReportAction, takeDownReportedAction } from "@/app/actions/admin";
import { blocklistDestinationAction, suspendOwnerAction } from "@/app/actions/slugs";

export const metadata = { title: "Abuse reports" };
export const dynamic = "force-dynamic";

interface R { id: number; target_type: "link" | "page"; target_slug: string; reason: string; details: string | null; status: string; created_at: Date; link_id: number | null; owner_id: number | null; owner: string | null; target_url: string | null }

export default async function Reports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const status = (await searchParams).status === "all" ? "all" : "open";
  const rows = await query<R>(
    `SELECT r.id, r.target_type, r.target_slug, r.reason, r.details, r.status, r.created_at,
            l.id AS link_id, COALESCE(l.user_id, u.id) AS owner_id, COALESCE(lu.username, u.username) AS owner, l.target_url
       FROM reports r
       LEFT JOIN links l ON r.target_type = 'link' AND l.slug = r.target_slug
       LEFT JOIN users lu ON lu.id = l.user_id
       LEFT JOIN users u ON r.target_type = 'page' AND u.username = r.target_slug
      ${status === "open" ? "WHERE r.status = 'open'" : ""} ORDER BY r.id DESC LIMIT 200`,
  );
  return (
    <>
      <div className="page-head">
        <div><h1>Abuse reports</h1><p>Submitted from the report form on public pages and short links.</p></div>
        <div className="row small">
          <Link href="?status=open" aria-current={status === "open"}>Open</Link>
          <Link href="?status=all" aria-current={status === "all"}>All</Link>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty"><h3>{status === "open" ? "No open reports" : "No reports yet"}</h3><p>Reports show up here as soon as someone files one.</p></div>
      ) : (
        <table className="table">
          <thead><tr><th>Reported</th><th>Reason</th><th>Filed (UTC)</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/${r.target_slug}`} className="slug"><b>/</b>{r.target_slug}</Link>
                  <div className="small muted">{r.target_type === "link" ? "Short link" : "Bio page"}</div>
                </td>
                <td style={{ maxWidth: 360 }}>{r.reason}{r.details && <div className="small muted" style={{ overflowWrap: "anywhere" }}>{r.details}</div>}</td>
                <td className="small num">{new Date(r.created_at).toISOString().slice(0, 16).replace("T", " ")}</td>
                <td><span className={`badge ${r.status === "open" ? "warn" : ""}`}>{r.status}</span></td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {r.status === "open" ? (
                    <span className="row" style={{ justifyContent: "flex-end" }}>
                      <ConfirmButton action={takeDownReportedAction.bind(null, r.id)} label="Take down" confirm="Disable the reported item and close this report?" />
                      {r.link_id && <ActionButton action={blocklistDestinationAction.bind(null, r.link_id)}>Block destination</ActionButton>}
                      {r.owner_id && <ConfirmButton action={suspendOwnerAction.bind(null, r.owner_id)} label={`Suspend ${r.owner}`} confirm={`Suspend ${r.owner}? They are signed out and their links and page stop working.`}>Suspend user</ConfirmButton>}
                      <ActionButton action={resolveReportAction.bind(null, r.id, "resolved")}>Resolve</ActionButton>
                      <ActionButton action={resolveReportAction.bind(null, r.id, "dismissed")}>Dismiss</ActionButton>
                    </span>
                  ) : (
                    <ActionButton action={resolveReportAction.bind(null, r.id, "open")}>Reopen</ActionButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
