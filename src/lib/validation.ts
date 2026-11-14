import { z } from "zod";
import { checkTargetUrl, safeNext, isPrivateHost } from "./url-check";
import { query } from "./db";

export const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "dashboard", "login", "logout", "register", "signup", "install", "docs", "forgot-password",
  "reset-password", "verify", "settings", "static", "uploads", "u", "out", "qr", "report", "terms", "privacy", "legal",
  "robots.txt", "sitemap.xml", "favicon.ico", "manifest.webmanifest", "_next", "health", "p", "go", "contact", "domain",
]);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Use at least 2 characters.")
  .max(40, "Use at most 40 characters.")
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "Use letters, numbers, hyphens and underscores only.")
  .refine((s) => !RESERVED_SLUGS.has(s), "That name is reserved.");

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(255);

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "Use at most 200 characters.")
  .refine((p) => /[a-zA-Z]/.test(p) && /[0-9]/.test(p), "Include at least one letter and one number.");

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #0E7C66.");

/** Checks the admin blocklist (domains incl. subdomains, and keywords anywhere in the URL). */
export async function isBlocked(url: string): Promise<string | null> {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "Invalid URL.";
  }
  const rows = await query<{ kind: string; value: string }>("SELECT kind, value FROM blocklist");
  const lower = url.toLowerCase();
  for (const r of rows) {
    if (r.kind === "domain" && (host === r.value || host.endsWith("." + r.value))) return "This domain is blocked on this server.";
    if (r.kind === "keyword" && lower.includes(r.value.toLowerCase())) return "This URL contains a blocked term.";
  }
  return null;
}

export { checkTargetUrl, safeNext, isPrivateHost };
export type { UrlCheck } from "./url-check";

export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = String(i.path[0] ?? "form");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/** Only allow safe image sources for avatars/logos: our uploads or https URLs. */
export function safeImageUrl(v: string): boolean {
  if (v.startsWith("/uploads/")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !isPrivateHost(u.hostname);
  } catch {
    return false;
  }
}
