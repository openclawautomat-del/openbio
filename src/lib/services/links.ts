import { z } from "zod";
import crypto from "node:crypto";
import { exec, query, queryOne } from "../db";
import { hashPassword } from "../auth";
import { checkTargetUrl, isBlocked, slugSchema, fieldErrors } from "../validation";

export type Result<T> = { ok: true; data: T } | { ok: false; errors: Record<string, string> };

export interface LinkRow {
  id: number;
  user_id: number;
  team_id: number | null;
  group_id: number | null;
  slug: string;
  title: string | null;
  target_url: string;
  password_hash: string | null;
  expires_at: Date | null;
  starts_at: Date | null;
  enabled: number;
  moderated: number;
  created_at: Date;
}

const optionalDate = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return d;
  });

export const linkInput = z.object({
  target_url: z.string().trim().min(1, "Enter the destination URL."),
  slug: z.string().trim().optional().transform((s) => (s ? s : undefined)),
  title: z.string().trim().max(160).optional().transform((s) => s || null),
  password: z.string().max(100).optional().transform((s) => s || undefined),
  expires_at: optionalDate,
  starts_at: optionalDate,
  enabled: z.boolean().optional(),
  group_id: z.coerce.number().int().positive().nullish(),
  team_id: z.coerce.number().int().positive().nullish(),
});
export type LinkInput = z.infer<typeof linkInput>;

export async function slugTaken(slug: string, exceptLinkId?: number): Promise<boolean> {
  const l = await queryOne<{ id: number }>("SELECT id FROM links WHERE slug = ?" + (exceptLinkId ? " AND id <> ?" : ""), exceptLinkId ? [slug, exceptLinkId] : [slug]);
  if (l) return true;
  return !!(await queryOne("SELECT id FROM users WHERE username = ?", [slug]));
}

function randomSlug(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const b = crypto.randomBytes(6);
  return Array.from(b, (x) => alphabet[x % alphabet.length]).join("");
}

export async function createLink(userId: number, ownHost: string, raw: unknown): Promise<Result<LinkRow>> {
  const p = linkInput.safeParse(raw);
  if (!p.success) return { ok: false, errors: fieldErrors(p.error) };
  const v = p.data;
  const u = checkTargetUrl(v.target_url, ownHost);
  if (!u.ok) return { ok: false, errors: { target_url: u.error } };
  const blocked = await isBlocked(u.url);
  if (blocked) return { ok: false, errors: { target_url: blocked } };

  let slug = v.slug;
  if (slug) {
    const s = slugSchema.safeParse(slug);
    if (!s.success) return { ok: false, errors: { slug: s.error.issues[0].message } };
    slug = s.data;
    if (await slugTaken(slug)) return { ok: false, errors: { slug: "That short name is already taken." } };
  } else {
    for (let i = 0; i < 8 && !slug; i++) {
      const c = randomSlug();
      if (!(await slugTaken(c))) slug = c;
    }
    if (!slug) return { ok: false, errors: { slug: "Could not generate a free short name. Try again." } };
  }
  if (v.starts_at && v.expires_at && v.expires_at <= v.starts_at) return { ok: false, errors: { expires_at: "Expiry must be after the start date." } };
  const pw = v.password ? await hashPassword(v.password) : null;
  const res = await exec(
    "INSERT INTO links (user_id, team_id, group_id, slug, title, target_url, password_hash, expires_at, starts_at, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [userId, v.team_id ?? null, v.group_id ?? null, slug, v.title, u.url, pw, v.expires_at, v.starts_at, v.enabled === false ? 0 : 1],
  );
  const row = await queryOne<LinkRow>("SELECT * FROM links WHERE id = ?", [res.insertId]);
  return { ok: true, data: row! };
}

export async function updateLink(userId: number, id: number, ownHost: string, raw: unknown, isAdmin = false): Promise<Result<LinkRow>> {
  const cur = await getLinkForUser(userId, id, isAdmin);
  if (!cur) return { ok: false, errors: { form: "Link not found." } };
  const p = linkInput.partial().safeParse(raw);
  if (!p.success) return { ok: false, errors: fieldErrors(p.error) };
  const v = p.data;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (v.target_url !== undefined) {
    const u = checkTargetUrl(v.target_url, ownHost);
    if (!u.ok) return { ok: false, errors: { target_url: u.error } };
    const blocked = await isBlocked(u.url);
    if (blocked) return { ok: false, errors: { target_url: blocked } };
    sets.push("target_url = ?"); vals.push(u.url);
  }
  if (v.slug !== undefined) {
    const s = slugSchema.safeParse(v.slug);
    if (!s.success) return { ok: false, errors: { slug: s.error.issues[0].message } };
    if (s.data !== cur.slug && (await slugTaken(s.data, id))) return { ok: false, errors: { slug: "That short name is already taken." } };
    sets.push("slug = ?"); vals.push(s.data);
  }
  if (v.title !== undefined) { sets.push("title = ?"); vals.push(v.title); }
  if (raw && typeof raw === "object" && "password" in raw) {
    const pw = (raw as { password?: string }).password;
    if (pw === "") { sets.push("password_hash = NULL"); }
    else if (pw) { sets.push("password_hash = ?"); vals.push(await hashPassword(pw)); }
  }
  if (raw && typeof raw === "object" && "expires_at" in raw) { sets.push("expires_at = ?"); vals.push(v.expires_at ?? null); }
  if (raw && typeof raw === "object" && "starts_at" in raw) { sets.push("starts_at = ?"); vals.push(v.starts_at ?? null); }
  if (v.enabled !== undefined) { sets.push("enabled = ?"); vals.push(v.enabled ? 1 : 0); }
  if (raw && typeof raw === "object" && "group_id" in raw) { sets.push("group_id = ?"); vals.push(v.group_id ?? null); }
  if (sets.length) await exec(`UPDATE links SET ${sets.join(", ")} WHERE id = ?`, [...vals, id]);
  return { ok: true, data: (await queryOne<LinkRow>("SELECT * FROM links WHERE id = ?", [id]))! };
}

/** Owner, a team member (Phase 2), or an admin may access a link. */
export async function getLinkForUser(userId: number, id: number, isAdmin = false): Promise<LinkRow | null> {
  const l = await queryOne<LinkRow>("SELECT * FROM links WHERE id = ?", [id]);
  if (!l) return null;
  if (isAdmin || l.user_id === userId) return l;
  if (l.team_id) {
    try {
      const m = await queryOne("SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ? AND role <> 'viewer'", [l.team_id, userId]);
      if (m) return l;
    } catch {
      /* Phase 2 tables absent */
    }
  }
  return null;
}

export async function deleteLink(userId: number, id: number, isAdmin = false): Promise<boolean> {
  const l = await getLinkForUser(userId, id, isAdmin);
  if (!l) return false;
  await exec("DELETE FROM links WHERE id = ?", [id]);
  await exec("DELETE FROM clicks WHERE entity_type = 'link' AND entity_id = ?", [id]);
  return true;
}

export interface ListOpts { userId: number; q?: string; status?: string; limit?: number; offset?: number; teamIds?: number[] }

export async function listLinks(o: ListOpts): Promise<{ rows: LinkRow[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  const owners = ["user_id = ?"];
  params.push(o.userId);
  if (o.teamIds?.length) { owners.push(`team_id IN (${o.teamIds.map(() => "?").join(",")})`); params.push(...o.teamIds); }
  where.push(`(${owners.join(" OR ")})`);
  if (o.q) { where.push("(slug LIKE ? OR title LIKE ? OR target_url LIKE ?)"); const like = `%${o.q.replace(/[%_]/g, "")}%`; params.push(like, like, like); }
  if (o.status === "active") where.push("enabled = 1 AND moderated = 0 AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())");
  if (o.status === "disabled") where.push("(enabled = 0 OR moderated = 1)");
  if (o.status === "expired") where.push("expires_at IS NOT NULL AND expires_at <= UTC_TIMESTAMP()");
  if (o.status === "protected") where.push("password_hash IS NOT NULL");
  const w = where.join(" AND ");
  const total = Number((await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM links WHERE ${w}`, params))?.n ?? 0);
  const limit = Math.max(1, Math.min(100, o.limit ?? 25));
  const offset = Math.max(0, o.offset ?? 0);
  const rows = await query<LinkRow>(`SELECT * FROM links WHERE ${w} ORDER BY id DESC LIMIT ${limit | 0} OFFSET ${offset | 0}`, params);
  return { rows, total };
}

export type LinkState = "active" | "disabled" | "expired" | "scheduled" | "moderated";
export function linkState(l: Pick<LinkRow, "enabled" | "moderated" | "expires_at" | "starts_at">): LinkState {
  if (l.moderated) return "moderated";
  if (!l.enabled) return "disabled";
  const now = Date.now();
  if (l.expires_at && new Date(l.expires_at).getTime() <= now) return "expired";
  if (l.starts_at && new Date(l.starts_at).getTime() > now) return "scheduled";
  return "active";
}
