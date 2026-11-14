import Link from "next/link";
import { query } from "@/lib/db";
import { ActionButton } from "@/components/client";
import { AdminLinksTable, type AdminLink } from "@/components/admin-links-table";
import { moderatePageAction } from "@/app/actions/admin";

export const metadata = { title: "Links and pages" };
export const dynamic = "force-dynamic";
const PER = 50;

interface P { id: number; username: string; published: number; moderated: number; views: number }

export default async function Content({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const like = `%${(sp.q ?? "").replace(/[%_]/g, "").slice(0, 80)}%`;
  const w = sp.q ? "WHERE l.slug LIKE ? OR l.target_url LIKE ? OR u.username LIKE ?" : "";
  const links = await query<AdminLink>(
    `SELECT l.id, l.slug, l.target_url, u.username AS owner, l.enabled, l.moderated,
            (SELECT COUNT(*) FROM clicks c WHERE c.entity_type = 'link' AND c.entity_id = l.id) AS clicks
       FROM links l JOIN users u ON u.id = l.user_id ${w} ORDER BY l.id DESC LIMIT ${PER} OFFSET ${(page - 1) * PER}`,
    sp.q ? [like, like, like] : [],
  );
  const pages = await query<P>(
    `SELECT p.id, u.username, p.published, p.moderated,
            (SELECT COUNT(*) FROM clicks c WHERE c.entity_type = 'page' AND c.entity_id = p.id) AS views
       FROM pages p JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 100`,
  );
  const q = encodeURIComponent(sp.q ?? "");
  return (
    <>
      <div className="page-head"><div><h1>Links and pages</h1><p>Disable or remove anything that breaks your rules.</p></div></div>
      <h2 className="section-title">Short links</h2>
      <form className="row" style={{ marginBottom: 16 }} role="search">
        <input className="input" name="q" defaultValue={sp.q} placeholder="Slug, destination or owner" aria-label="Search links" style={{ maxWidth: 320 }} />
        <button className="btn">Search</button>
      </form>
      {links.length === 0 ? (
        <div className="empty"><h3>No links found</h3><p>Links appear here once people start creating them.</p></div>
      ) : (
        <AdminLinksTable rows={links} />
      )}
      <div className="row small" style={{ marginTop: 16 }}>
        {page > 1 && <Link className="btn btn-sm" href={`?q=${q}&page=${page - 1}`}>Newer</Link>}
        {links.length === PER && <Link className="btn btn-sm" href={`?q=${q}&page=${page + 1}`}>Older</Link>}
      </div>

      <h2 className="section-title" style={{ marginTop: 48 }}>Bio pages</h2>
      {pages.length === 0 ? (
        <div className="empty"><h3>No bio pages yet</h3></div>
      ) : (
        <table className="table">
          <thead><tr><th>Page</th><th>Views</th><th>State</th><th /></tr></thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/${p.username}`} className="slug"><b>/</b>{p.username}</Link></td>
                <td className="num">{Number(p.views)}</td>
                <td>{p.moderated ? <span className="badge bad">Removed</span> : p.published ? <span className="badge good">Live</span> : <span className="badge">Draft</span>}</td>
                <td style={{ textAlign: "right" }}>
                  <ActionButton action={moderatePageAction.bind(null, p.id, !p.moderated)}>{p.moderated ? "Restore" : "Remove"}</ActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
