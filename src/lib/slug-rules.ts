/**
 * Slug and bio-username rules. Pure (no DB, no framework) so it can be unit-tested with plain node.
 * Slugs and usernames share ONE namespace, so both go through `checkSlug`.
 */

/** Static paths that must never be claimed as a slug. */
export const STATIC_RESERVED = ["_next", "static", "assets", "uploads", "favicon.ico", "robots.txt", "sitemap.xml", "manifest.json", "manifest.webmanifest", ".well-known"];

/**
 * Every top-level route segment of the Next.js app (src/app, route groups flattened) plus a few legacy names.
 * tests/slug-rules.test.ts walks src/app and fails when a new top-level route is missing here.
 */
export const ROUTE_SEGMENTS = [
  "actions", "admin", "api", "dashboard", "docs", "forgot-password", "icon.svg", "install", "login", "out",
  "privacy", "register", "report", "reset-password", "terms", "verify", "health",
  // legacy / future-proofing
  "settings", "logout", "signup", "u", "p", "go", "qr", "legal", "contact", "domain", "domains",
];

/** Defaults for the DB-seeded lists (the super admin can edit them). Mirrored in migrations/004. */
export const DEFAULT_RESERVED_WORDS = [
  "www", "mail", "smtp", "ftp", "ns1", "ns2", "cdn", "app", "support", "help", "status", "security", "abuse",
  "postmaster", "webmaster", "root", "administrator", "official", "verify", "confirm", "account", "accounts",
  "wallet", "payment", "payments", "checkout", "invoice", "signin", "signup", "logout", "reset", "password",
];
export const DEFAULT_BRANDS = ["paypal", "google", "facebook", "instagram", "whatsapp", "apple", "microsoft", "amazon", "netflix", "binance", "stripe", "bank"];
export const DEFAULT_SENSITIVE = ["login", "signin", "verify", "secure", "security", "support", "account", "update", "wallet", "payment", "billing", "recovery", "reset", "password"];

export interface SlugLists {
  reserved: Iterable<string>;
  brands: Iterable<string>;
  sensitive: Iterable<string>;
  /** The owner's brand/app name. It is reserved and also protected as a brand. */
  appName?: string;
}

export const UNAVAILABLE = "This name is not available.";

const ROUTE_SET = new Set([...ROUTE_SEGMENTS, ...STATIC_RESERVED].map((s) => s.toLowerCase()));
export const isReservedRoute = (s: string) => ROUTE_SET.has(s.toLowerCase());

export type Normalized = { ok: true; slug: string } | { ok: false; error: string };

/** NFKC, lowercase, then ASCII-only: a-z 0-9 hyphen underscore, 3 to 32 chars, no edge or doubled hyphens. */
export function normalizeSlug(input: string): Normalized {
  const s = String(input ?? "").normalize("NFKC").trim().toLowerCase();
  if (!s) return { ok: false, error: "Enter a name." };
  if (/[^\x00-\x7f]/.test(s)) return { ok: false, error: "Use only the letters a-z, numbers, hyphens and underscores." };
  if (!/^[a-z0-9_-]+$/.test(s)) return { ok: false, error: "Use only the letters a-z, numbers, hyphens and underscores." };
  if (s.length < 3) return { ok: false, error: "Use at least 3 characters." };
  if (s.length > 32) return { ok: false, error: "Use at most 32 characters." };
  if (s.startsWith("-") || s.endsWith("-")) return { ok: false, error: "A name cannot start or end with a hyphen." };
  if (s.includes("--")) return { ok: false, error: "A name cannot contain two hyphens in a row." };
  return { ok: true, slug: s };
}

/**
 * Look-alike folding: separators removed, rn->m, vv->w, 0->o, 1/i->l, then repeated characters collapsed.
 * paypa1, paypai, rnicrosoft, gooogle and pay-pal all reduce to the same skeleton as the real brand.
 */
export function skeleton(s: string, collapse = true): string {
  let t = s.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
  t = t.replace(/rn/g, "m").replace(/vv/g, "w");
  t = t.replace(/[01i]/g, (c) => (c === "0" ? "o" : "l"));
  return collapse ? t.replace(/(.)\1+/g, "$1") : t;
}

const stripSeparators = (s: string) => s.replace(/[-_]/g, "");

export type SlugVerdict =
  | { ok: true; slug: string; review: false }
  | { ok: true; slug: string; review: true; reason: string }
  | { ok: false; code: "format"; error: string }
  | { ok: false; code: "reserved" | "blocked"; error: string; reason: string };

export function checkSlug(input: string, lists: SlugLists): SlugVerdict {
  const n = normalizeSlug(input);
  if (!n.ok) return { ok: false, code: "format", error: n.error };
  const slug = n.slug;
  const flat = stripSeparators(slug);

  const reserved = new Set<string>([...lists.reserved].map((w) => stripSeparators(String(w).toLowerCase())));
  if (lists.appName) {
    const a = normalizeSlug(lists.appName);
    if (a.ok) reserved.add(stripSeparators(a.slug));
    reserved.add(stripSeparators(lists.appName.toLowerCase().replace(/[^a-z0-9]/g, "")));
  }
  if (isReservedRoute(slug) || reserved.has(flat)) return { ok: false, code: "reserved", error: UNAVAILABLE, reason: "reserved name" };
  for (const r of ROUTE_SET) if (stripSeparators(r) === flat) return { ok: false, code: "reserved", error: UNAVAILABLE, reason: "reserved route" };

  const brands = [...lists.brands];
  if (lists.appName) brands.push(lists.appName);
  const sens = [...lists.sensitive].map((w) => ({ c: skeleton(String(w)), f: skeleton(String(w), false) })).filter((w) => w.c);
  const fk = skeleton(slug, false); // uncollapsed, so "paypal" + "login" is still seen across the shared "l"
  const sk = skeleton(slug);
  let review: string | null = null;
  for (const b of brands) {
    const bs = skeleton(String(b));
    if (bs.length < 3 || !sk.includes(bs)) continue;
    if (sk === bs) return { ok: false, code: "blocked", error: UNAVAILABLE, reason: `brand: ${b}` };
    const hit = sens.find((w) => fk.includes(w.f) || sk.includes(w.c));
    if (hit) return { ok: false, code: "blocked", error: UNAVAILABLE, reason: `brand + sensitive word: ${b}` };
    review = review ?? `contains brand: ${b}`;
  }
  if (review) return { ok: true, slug, review: true, reason: review };
  return { ok: true, slug, review: false };
}
