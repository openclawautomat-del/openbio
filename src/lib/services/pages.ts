import { z } from "zod";
import { exec, query, queryOne } from "../db";
import { checkTargetUrl, isBlocked, safeImageUrl, fieldErrors } from "../validation";
import { SOCIALS, THEMES, type PageCustom, type Socials } from "../themes";
import type { Result } from "./links";

export interface PageRow {
  id: number;
  user_id: number;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  theme: string;
  custom: PageCustom | null;
  socials: Socials | null;
  published: number;
  moderated: number;
}

export interface BlockRow {
  id: number;
  page_id: number;
  type: string;
  title: string | null;
  url: string | null;
  data: Record<string, string> | null;
  group_id: number | null;
  sort_order: number;
  enabled: number;
  starts_at: Date | null;
  ends_at: Date | null;
}

export const BLOCK_TYPES_P1 = ["link", "header"] as const;
export const BLOCK_TYPES_P2 = ["contact_form", "product", "embed", "vcard"] as const;

export async function ensurePage(userId: number, displayName?: string): Promise<PageRow> {
  await exec("INSERT IGNORE INTO pages (user_id, display_name) VALUES (?, ?)", [userId, displayName ?? null]);
  return (await queryOne<PageRow>("SELECT * FROM pages WHERE user_id = ?", [userId]))!;
}

export const getPageByUser = (userId: number) => queryOne<PageRow>("SELECT * FROM pages WHERE user_id = ?", [userId]);

export async function getBlocks(pageId: number): Promise<BlockRow[]> {
  return query<BlockRow>("SELECT * FROM blocks WHERE page_id = ? ORDER BY sort_order ASC, id ASC", [pageId]);
}

const profileSchema = z.object({
  display_name: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(500).optional(),
  avatar_url: z.string().trim().max(512).optional(),
  theme: z.string().refine((t) => THEMES.some((x) => x.id === t), "Unknown theme."),
  published: z.boolean().optional(),
});

export async function updateProfile(userId: number, raw: unknown): Promise<Result<true>> {
  const p = profileSchema.partial().safeParse(raw);
  if (!p.success) return { ok: false, errors: fieldErrors(p.error) };
  const v = p.data;
  if (v.avatar_url && !safeImageUrl(v.avatar_url)) return { ok: false, errors: { avatar_url: "Use an uploaded image or an https image URL." } };
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const k of ["display_name", "bio", "avatar_url", "theme"] as const) {
    if (v[k] !== undefined) { sets.push(`${k} = ?`); vals.push(v[k] === "" ? null : v[k]); }
  }
  if (v.published !== undefined) { sets.push("published = ?"); vals.push(v.published ? 1 : 0); }
  if (sets.length) await exec(`UPDATE pages SET ${sets.join(", ")} WHERE user_id = ?`, [...vals, userId]);
  return { ok: true, data: true };
}

const customSchema = z.object({
  bg: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fg: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  btnBg: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  btnFg: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  shape: z.enum(["square", "round", "pill"]).optional(),
  style: z.enum(["solid", "outline", "offset"]).optional(),
  font: z.enum(["sans", "serif", "mono"]).optional(),
});

export async function updateCustom(userId: number, raw: unknown): Promise<Result<true>> {
  const p = customSchema.safeParse(raw);
  if (!p.success) return { ok: false, errors: fieldErrors(p.error) };
  const clean = Object.fromEntries(Object.entries(p.data).filter(([, v]) => v));
  await exec("UPDATE pages SET custom = ? WHERE user_id = ?", [Object.keys(clean).length ? JSON.stringify(clean) : null, userId]);
  return { ok: true, data: true };
}

export async function updateSocials(userId: number, raw: Record<string, string>): Promise<Result<true>> {
  const out: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const k of SOCIALS) {
    const v = (raw[k] ?? "").trim();
    if (!v) continue;
    if (k === "email") {
      if (!z.string().email().safeParse(v).success) errors[k] = "Enter a valid email address.";
      else out[k] = v;
      continue;
    }
    const c = checkTargetUrl(v.startsWith("http") ? v : `https://${v}`);
    if (!c.ok) errors[k] = c.error;
    else out[k] = c.url;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  await exec("UPDATE pages SET socials = ? WHERE user_id = ?", [Object.keys(out).length ? JSON.stringify(out) : null, userId]);
  return { ok: true, data: true };
}

const blockSchema = z.object({
  type: z.string().default("link"),
  title: z.string().trim().max(160).optional(),
  url: z.string().trim().max(2048).optional(),
  data: z.record(z.string(), z.string().max(2000)).optional(),
  group_id: z.coerce.number().int().positive().nullish(),
  enabled: z.boolean().optional(),
  starts_at: z.string().nullish(),
  ends_at: z.string().nullish(),
});

function dateOrNull(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function saveBlock(
  userId: number,
  blockId: number | null,
  raw: unknown,
  allowedTypes: readonly string[],
): Promise<Result<number>> {
  const page = await getPageByUser(userId);
  if (!page) return { ok: false, errors: { form: "Page not found." } };
  const p = blockSchema.safeParse(raw);
  if (!p.success) return { ok: false, errors: fieldErrors(p.error) };
  const v = p.data;
  if (!allowedTypes.includes(v.type)) return { ok: false, errors: { type: "This block type is not available." } };
  let url: string | null = null;
  if (v.type === "link" || v.type === "embed" || v.type === "product") {
    if (v.url || v.type !== "product") {
      const c = checkTargetUrl(v.url ?? "");
      if (!c.ok) return { ok: false, errors: { url: c.error } };
      const b = await isBlocked(c.url);
      if (b) return { ok: false, errors: { url: b } };
      url = c.url;
    }
  }
  if ((v.type === "link" || v.type === "header" || v.type === "product") && !v.title) return { ok: false, errors: { title: "Add a title." } };
  if (v.type === "embed" && url && !embedInfo(url)) return { ok: false, errors: { url: "Use a YouTube, Spotify, Vimeo or Google Maps link." } };
  const data = v.data && Object.keys(v.data).length ? JSON.stringify(v.data) : null;
  const starts = dateOrNull(v.starts_at);
  const ends = dateOrNull(v.ends_at);
  if (blockId) {
    const own = await queryOne("SELECT id FROM blocks WHERE id = ? AND page_id = ?", [blockId, page.id]);
    if (!own) return { ok: false, errors: { form: "Block not found." } };
    await exec(
      "UPDATE blocks SET title = ?, url = ?, data = ?, group_id = ?, enabled = ?, starts_at = ?, ends_at = ? WHERE id = ?",
      [v.title ?? null, url, data, v.group_id ?? null, v.enabled === false ? 0 : 1, starts, ends, blockId],
    );
    return { ok: true, data: blockId };
  }
  const max = await queryOne<{ m: number | null }>("SELECT MAX(sort_order) AS m FROM blocks WHERE page_id = ?", [page.id]);
  const res = await exec(
    "INSERT INTO blocks (page_id, type, title, url, data, group_id, sort_order, enabled, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [page.id, v.type, v.title ?? null, url, data, v.group_id ?? null, (max?.m ?? 0) + 1, v.enabled === false ? 0 : 1, starts, ends],
  );
  return { ok: true, data: res.insertId };
}

export async function deleteBlock(userId: number, blockId: number): Promise<void> {
  await exec("DELETE b FROM blocks b JOIN pages p ON p.id = b.page_id WHERE b.id = ? AND p.user_id = ?", [blockId, userId]);
}

export async function toggleBlock(userId: number, blockId: number): Promise<void> {
  await exec("UPDATE blocks b JOIN pages p ON p.id = b.page_id SET b.enabled = 1 - b.enabled WHERE b.id = ? AND p.user_id = ?", [blockId, userId]);
}

export async function reorderBlocks(userId: number, orderedIds: number[]): Promise<void> {
  const page = await getPageByUser(userId);
  if (!page) return;
  let i = 1;
  for (const id of orderedIds) await exec("UPDATE blocks SET sort_order = ? WHERE id = ? AND page_id = ?", [i++, id, page.id]);
}

/** Maps a pasted URL to a safe embed iframe source. Only allow-listed providers. */
export function embedInfo(raw: string): { src: string; kind: "video" | "audio" | "map"; height: number } | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  const h = u.hostname.replace(/^www\./, "");
  if (h === "youtube.com" || h === "m.youtube.com") {
    const id = u.searchParams.get("v") ?? (u.pathname.startsWith("/embed/") ? u.pathname.split("/")[2] : u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : null);
    if (id && /^[\w-]{6,20}$/.test(id)) return { src: `https://www.youtube-nocookie.com/embed/${id}`, kind: "video", height: 0 };
  }
  if (h === "youtu.be") {
    const id = u.pathname.slice(1);
    if (/^[\w-]{6,20}$/.test(id)) return { src: `https://www.youtube-nocookie.com/embed/${id}`, kind: "video", height: 0 };
  }
  if (h === "vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) return { src: `https://player.vimeo.com/video/${id}`, kind: "video", height: 0 };
  }
  if (h === "open.spotify.com") {
    const m = u.pathname.match(/^\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/);
    if (m) return { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, kind: "audio", height: m[1] === "track" || m[1] === "episode" ? 152 : 352 };
  }
  if (h === "google.com" && u.pathname.startsWith("/maps")) {
    const q = u.searchParams.get("q") ?? u.searchParams.get("query");
    if (q) return { src: `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`, kind: "map", height: 280 };
  }
  return null;
}

export function blockActive(b: Pick<BlockRow, "enabled" | "starts_at" | "ends_at">, now = Date.now()): boolean {
  if (!b.enabled) return false;
  if (b.starts_at && new Date(b.starts_at).getTime() > now) return false;
  if (b.ends_at && new Date(b.ends_at).getTime() <= now) return false;
  return true;
}
