import { exec, query, queryOne } from "./db";
import { LRU } from "./lru.ts";
import { rateLimit } from "./ratelimit";
import { ipHash } from "./crypto";
import { checkSlug, DEFAULT_BRANDS, DEFAULT_RESERVED_WORDS, DEFAULT_SENSITIVE, UNAVAILABLE, type SlugLists } from "./slug-rules.ts";

const cache = new LRU<SlugLists>(1, 30_000);
export const invalidateSlugLists = () => cache.clear();

/** Lists come from the DB (super admin edits them); the compiled defaults are the fallback before migration 004. */
export async function loadSlugLists(appName?: string): Promise<SlugLists> {
  let l = cache.get("l");
  if (!l) {
    try {
      const rows = await query<{ kind: string; value: string }>("SELECT kind, value FROM slug_lists");
      const by = (k: string) => rows.filter((r) => r.kind === k).map((r) => r.value);
      l = { reserved: by("reserved"), brands: by("brand"), sensitive: by("sensitive") };
    } catch {
      l = { reserved: DEFAULT_RESERVED_WORDS, brands: DEFAULT_BRANDS, sensitive: DEFAULT_SENSITIVE };
    }
    cache.set("l", l);
  }
  return { ...l, appName };
}

export type SlugOk = { ok: true; slug: string; review: string | null };
export type SlugFail = { ok: false; error: string };

/**
 * The one server-side gate for a slug or bio username (create, rename, import, register).
 * Reserved, phishing and already-taken names all answer with the same generic sentence.
 */
export async function validateNewSlug(raw: string, o: { appName?: string; exceptLinkId?: number } = {}): Promise<SlugOk | SlugFail> {
  const v = checkSlug(raw, await loadSlugLists(o.appName));
  if (!v.ok) return { ok: false, error: v.error };
  if (await slugInUse(v.slug, o.exceptLinkId)) return { ok: false, error: UNAVAILABLE };
  return { ok: true, slug: v.slug, review: v.review ? v.reason : null };
}

/** Slugs and bio usernames share one namespace. */
export async function slugInUse(slug: string, exceptLinkId?: number): Promise<boolean> {
  const l = await queryOne<{ id: number }>("SELECT id FROM links WHERE slug = ?" + (exceptLinkId ? " AND id <> ?" : ""), exceptLinkId ? [slug, exceptLinkId] : [slug]);
  if (l) return true;
  return !!(await queryOne("SELECT id FROM users WHERE username = ?", [slug]));
}

/** Creating or renaming a name is limited per user and per IP so the namespace cannot be swept for look-alikes. */
export async function slugRateOk(userId: number | null, ip: string): Promise<boolean> {
  const byIp = await rateLimit(`slug:ip:${ipHash(ip)}`, 300, 3600);
  const byUser = userId ? await rateLimit(`slug:user:${userId}`, 200, 3600) : true;
  return byIp && byUser;
}
export const SLUG_RATE_MESSAGE = "You are creating names too quickly. Try again in a while.";

export async function addListValue(kind: "reserved" | "brand" | "sensitive", value: string): Promise<boolean> {
  const v = value.normalize("NFKC").trim().toLowerCase().slice(0, 64);
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(v)) return false;
  await exec("INSERT IGNORE INTO slug_lists (kind, value) VALUES (?, ?)", [kind, v]);
  invalidateSlugLists();
  return true;
}
export async function removeListValue(id: number): Promise<void> {
  await exec("DELETE FROM slug_lists WHERE id = ?", [id]);
  invalidateSlugLists();
}
