import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { ActionButton, ConfirmButton } from "@/components/client";
import { deleteUserAction, setUserRoleAction, setUserStatusAction } from "@/app/actions/admin";

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";
const PER = 30;

interface U { id: number; email: string; username: string; role: string; status: string; email_verified_at: Date | null; created_at: Date; last_login_at: Date | null; links: number }
const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "Never");

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const like = `%${(sp.q ?? "").replace(/[%_]/g, "").slice(0, 80)}%`;
  const w = sp.q ? "WHERE u.email LIKE ? OR u.username LIKE ?" : "";
  const p = sp.q ? [like, like] : [];
  const total = Number((await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM users u ${w}`, p))?.n ?? 0);
  const rows = await query<U>(
    `SELECT u.id, u.email, u.username, u.role, u.status, u.email_verified_at, u.created_at, u.last_login_at,
            (SELECT COUNT(*) FROM links l WHERE l.user_id = u.id) AS links
       FROM users u ${w} ORDER BY u.id DESC LIMIT ${PER} OFFSET ${(page - 1) * PER}`,
    p,
  );
  const pages = Math.max(1, Math.ceil(total / PER));
  const q = encodeURIComponent(sp.q ?? "");
  return (
    <>
      <div className="page-head"><div><h1>Users</h1><p>{total} account{total === 1 ? "" : "s"}.</p></div></div>
      <form className="row" style={{ marginBottom: 16 }} role="search">
        <input className="input" name="q" defaultValue={sp.q} placeholder="Search email or username" aria-label="Search users" style={{ maxWidth: 320 }} />
        <button className="btn">Search</button>
      </form>
      {rows.length === 0 ? (
        <div className="empty"><h3>No users match</h3><p>Try a shorter search.</p></div>
      ) : (
        <table className="table">
          <thead><tr><th>User</th><th>Role</th><th>Links</th><th>Joined</th><th>Last login</th><th /></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link href={`/${u.username}`}>{u.username}</Link>
                  {u.status === "suspended" && <> <span className="badge bad">Suspended</span></>}
                  {!u.email_verified_at && <> <span className="badge">Unverified</span></>}
                  <div className="small muted">{u.email}</div>
                </td>
                <td>{u.role === "super_admin" ? <span className="badge good">Super Admin</span> : "User"}</td>
                <td className="num">{Number(u.links)}</td>
                <td className="small num">{day(u.created_at)}</td>
                <td className="small num">{day(u.last_login_at)}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {u.id !== me.id && (
                    <span className="row" style={{ justifyContent: "flex-end" }}>
                      <ActionButton action={setUserRoleAction.bind(null, u.id, u.role === "super_admin" ? "user" : "super_admin")}>{u.role === "super_admin" ? "Make user" : "Make admin"}</ActionButton>
                      <ActionButton action={setUserStatusAction.bind(null, u.id, u.status === "active" ? "suspended" : "active")}>{u.status === "active" ? "Suspend" : "Reinstate"}</ActionButton>
                      <ConfirmButton action={deleteUserAction.bind(null, u.id)} label="Delete" confirm={`Delete ${u.username} and everything they own? This cannot be undone.`} />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pages > 1 && (
        <div className="row small" style={{ marginTop: 16 }}>
          {page > 1 && <Link className="btn btn-sm" href={`?q=${q}&page=${page - 1}`}>Previous</Link>}
          <span className="muted">Page {page} of {pages}</span>
          {page < pages && <Link className="btn btn-sm" href={`?q=${q}&page=${page + 1}`}>Next</Link>}
        </div>
      )}
    </>
  );
}
