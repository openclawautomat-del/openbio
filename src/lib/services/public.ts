import { query, queryOne } from "../db";
import { getBlocks, blockActive, type BlockRow, type PageRow } from "./pages";
import type { LinkRow } from "./links";
import { cachedBySlug } from "../slug-cache";

export interface PublicPage {
  page: PageRow;
  user: { id: number; username: string };
  blocks: BlockRow[];
  groups: Record<number, string>;
}

/** A page is public when it is published, not moderated and its owner is not suspended. */
export async function getPublicPage(username: string): Promise<PublicPage | null> {
  const row = await queryOne<PageRow & { username: string }>(
    `SELECT p.*, u.username FROM users u JOIN pages p ON p.user_id = u.id
      WHERE u.username = ? AND u.status = 'active' AND p.published = 1 AND p.moderated = 0 AND p.review_status NOT IN ('pending','rejected')`,
    [username.toLowerCase()],
  );
  if (!row) return null;
  const all = await getBlocks(row.id);
  const blocks = all.filter((b) => blockActive(b));
  const groups: Record<number, string> = {};
  if (blocks.some((b) => b.group_id)) {
    const rows = await query<{ id: number; name: string }>("SELECT id, name FROM link_groups WHERE user_id = ?", [row.user_id]).catch(() => []);
    for (const g of rows) groups[g.id] = g.name;
  }
  return { page: row, user: { id: row.user_id, username: row.username }, blocks, groups };
}

export async function getLinkBySlug(slug: string): Promise<(LinkRow & { owner_active: number; open_reports?: number }) | null> {
  // Hot path of every redirect: answered from the short-TTL cache when possible.
  return cachedBySlug(slug, () =>
    queryOne<LinkRow & { owner_active: number; open_reports: number }>(
      "SELECT l.*, (u.status = 'active') AS owner_active, (SELECT COUNT(*) FROM reports r WHERE r.target_slug = l.slug AND r.status = 'open') AS open_reports FROM links l JOIN users u ON u.id = l.user_id WHERE l.slug = ?",
      [slug.toLowerCase()],
    ),
  );
}
