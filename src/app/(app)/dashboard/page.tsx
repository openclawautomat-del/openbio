import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { getStats } from "@/lib/analytics";
import { getBrand, shortUrl } from "@/lib/brand";
import { TimeSeries, StatRow } from "@/components/charts";
import { CopyButton } from "@/components/client";

export const metadata = { title: "Overview" };

export default async function Overview() {
  const user = await requireUser();
  const b = await getBrand();
  const [clicks, views] = await Promise.all([
    getStats({ userId: user.id, kind: "clicks", days: 30 }),
    getStats({ userId: user.id, kind: "views", days: 30 }),
  ]);
  const counts = await queryOne<{ links: number; blocks: number }>(
    "SELECT (SELECT COUNT(*) FROM links WHERE user_id = ?) AS links, (SELECT COUNT(*) FROM blocks b JOIN pages p ON p.id = b.page_id WHERE p.user_id = ?) AS blocks",
    [user.id, user.id],
  );
  const top = await query<{ id: number; slug: string; title: string | null; n: number }>(
    `SELECT l.id, l.slug, l.title, COUNT(c.id) AS n FROM links l JOIN clicks c ON c.entity_type = 'link' AND c.entity_id = l.id AND c.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
      WHERE l.user_id = ? GROUP BY l.id, l.slug, l.title ORDER BY n DESC LIMIT 5`,
    [user.id],
  );
  const page = shortUrl(b, user.username);
  const fresh = !Number(counts?.links) && !Number(counts?.blocks);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p>Last 30 days.</p>
        </div>
        <div className="row">
          <span className="slug">{b.host}<b>/</b>{user.username}</span>
          <CopyButton value={page} label="Copy page address" />
          <Link className="btn" href={`/${user.username}`} target="_blank">View page</Link>
        </div>
      </div>

      {fresh && (
        <div className="notice" style={{ marginBottom: 24 }}>
          <strong>Start here.</strong> Add a link to your page in <Link href="/dashboard/page">Bio page</Link>, or shorten a URL in <Link href="/dashboard/links">Links</Link>. Numbers appear as soon as someone visits.
        </div>
      )}

      <StatRow items={[
        { label: "Link clicks", value: clicks.total },
        { label: "Unique visitors", value: clicks.unique },
        { label: "Page views", value: views.total },
        { label: "Short links", value: Number(counts?.links ?? 0) },
      ]} />

      <div className="section-title"><h2>Clicks per day</h2></div>
      <TimeSeries series={clicks.series} label="Clicks per day over the last 30 days" />

      <div className="section-title" style={{ marginTop: 40 }}><h2>Top short links</h2><Link href="/dashboard/links" className="small">All links</Link></div>
      {top.length === 0 ? (
        <p className="muted">No clicks on short links yet.</p>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Link</th><th className="r">Clicks</th></tr></thead>
            <tbody>
              {top.map((t) => (
                <tr key={t.id}>
                  <td><Link href={`/dashboard/links/${t.id}`} className="title">{t.title || t.slug}</Link> <span className="muted mono small">/{t.slug}</span></td>
                  <td className="r num">{Number(t.n).toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
