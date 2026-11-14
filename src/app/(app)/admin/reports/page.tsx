import Link from "next/link";
import { query } from "@/lib/db";
import { ActionButton, ConfirmButton } from "@/components/client";
import { resolveReportAction, takeDownReportedAction } from "@/app/actions/admin";

export const metadata = { title: "Abuse reports" };
export const dynamic = "force-dynamic";

interface R { id: number; target_type: "link" | "page"; target_slug: string; reason: string; details: string | null; status: string; created_at: Date }

export default async function Reports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const status = (await searchParams).status === "all" ? "all" : "open";
  const rows = await query<R>(
    `SELECT id, target_type, target_slug, reason, details, status, created_at FROM reports ${status === "open" ? "WHERE status = 'open'" : ""} ORDER BY id DESC LIMIT 200`,
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
