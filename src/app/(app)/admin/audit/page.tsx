import Link from "next/link";
import { query, queryOne } from "@/lib/db";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";
const PER = 50;

interface A { id: number; actor: string | null; action: string; target: string | null; meta: unknown; created_at: Date }

export default async function Audit({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const total = Number((await queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM audit_log"))?.n ?? 0);
  const rows = await query<A>(
    `SELECT a.id, u.username AS actor, a.action, a.target, a.meta, a.created_at FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT ${PER} OFFSET ${(page - 1) * PER}`,
  );
  const pages = Math.max(1, Math.ceil(total / PER));
  return (
    <>
      <div className="page-head"><div><h1>Audit log</h1><p>Every administrative change, newest first.</p></div></div>
      {rows.length === 0 ? (
        <div className="empty"><h3>Nothing recorded yet</h3><p>Setting changes, moderation actions and API key events will appear here.</p></div>
      ) : (
        <table className="table">
          <thead><tr><th>When (UTC)</th><th>Who</th><th>Action</th><th>Target</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="small num">{new Date(r.created_at).toISOString().slice(0, 19).replace("T", " ")}</td>
                <td>{r.actor ?? <span className="muted">system</span>}</td>
                <td className="num">{r.action}</td>
                <td className="small muted" style={{ maxWidth: 360, overflowWrap: "anywhere" }}>{r.target}{r.meta ? ` ${JSON.stringify(r.meta)}`.slice(0, 160) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pages > 1 && (
        <div className="row small" style={{ marginTop: 16 }}>
          {page > 1 && <Link className="btn btn-sm" href={`?page=${page - 1}`}>Newer</Link>}
          <span className="muted">Page {page} of {pages}</span>
          {page < pages && <Link className="btn btn-sm" href={`?page=${page + 1}`}>Older</Link>}
        </div>
      )}
    </>
  );
}
