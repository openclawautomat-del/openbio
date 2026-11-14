import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { phase2Enabled } from "@/lib/features";
import { ConfirmButton } from "@/components/client";
import { deleteMessageAction } from "@/app/actions/phase2";

export const metadata = { title: "Messages" };
export const dynamic = "force-dynamic";
const PER = 30;

interface M { id: number; name: string; email: string; message: string; created_at: Date }

export default async function Contacts({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if (!phase2Enabled()) notFound();
  const u = await requireUser();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const total = Number((await queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM contact_messages WHERE user_id = ?", [u.id]))?.n ?? 0);
  const rows = await query<M>(
    `SELECT id, name, email, message, created_at FROM contact_messages WHERE user_id = ? ORDER BY id DESC LIMIT ${PER} OFFSET ${(page - 1) * PER}`,
    [u.id],
  );
  const pages = Math.max(1, Math.ceil(total / PER));
  return (
    <>
      <div className="page-head"><div><h1>Messages</h1><p>Sent through the contact form on your bio page.</p></div></div>
      {rows.length === 0 ? (
        <div className="empty">
          <h3>No messages yet</h3>
          <p>Add a contact form block in the <Link href="/dashboard/page">page editor</Link> and replies will land here.</p>
        </div>
      ) : (
        <table className="table">
          <thead><tr><th>From</th><th>Message</th><th>Received (UTC)</th><th /></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td><strong>{m.name}</strong><div className="small"><a href={`mailto:${m.email}`}>{m.email}</a></div></td>
                <td style={{ maxWidth: 480, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.message}</td>
                <td className="small num">{new Date(m.created_at).toISOString().slice(0, 16).replace("T", " ")}</td>
                <td style={{ textAlign: "right" }}><ConfirmButton action={deleteMessageAction.bind(null, m.id)} label="Delete" confirm="Delete this message?" /></td>
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
