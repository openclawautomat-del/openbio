import { LRU } from "./lru.ts";

/**
 * Short-TTL cache for slug lookups, so a redirect is usually answered without touching MySQL.
 * Entries are dropped on every edit (invalidateSlug) and the whole cache is cleared on bulk or moderation changes.
 * `null` is cached too (a miss), but only briefly, so a brand-new slug appears almost immediately.
 */
const g = globalThis as unknown as { __slugCache?: LRU<unknown> };
const cache = (g.__slugCache ??= new LRU<unknown>(2000, 30_000));

export async function cachedBySlug<T>(slug: string, load: () => Promise<T | null>): Promise<T | null> {
  const k = slug.toLowerCase();
  const hit = cache.get(k);
  if (hit !== undefined) return hit as T | null;
  const v = await load();
  cache.set(k, v, v === null ? 5_000 : 30_000);
  return v;
}
export const invalidateSlug = (...slugs: (string | undefined | null)[]) => { for (const s of slugs) if (s) cache.delete(s.toLowerCase()); };
export const clearSlugCache = () => cache.clear();
