import { exec, queryOne } from "../db";
import { rateLimit } from "../ratelimit";
import { ipHash } from "../crypto";
import { invalidateSlug } from "../slug-cache";
import { z } from "zod";

export const reportSchema = z.object({
  target: z.string().trim().min(1, "Enter the short link or page being reported.").max(255),
  reason: z.enum(["spam", "phishing", "malware", "illegal", "other"]),
  details: z.string().trim().max(1000).optional(),
});

/** Accepts a pasted URL or a bare name and reduces it to the slug on this server. */
export function slugFromTarget(raw: string): string {
  let v = raw.trim();
  try { v = new URL(v).pathname; } catch { /* a bare name */ }
  return v.replace(/^\/+/, "").split(/[/?#]/)[0].toLowerCase().slice(0, 64);
}

export type ReportResult = { ok: true } | { ok: false; status: 400 | 404 | 429; errors: Record<string, string> };

/** Shared by the public form and POST /api/report. Rate limited per IP, and once per IP and target per day. */
export async function submitReport(input: unknown, ip: string): Promise<ReportResult> {
  const p = reportSchema.safeParse(input);
  if (!p.success) {
    const errors: Record<string, string> = {};
    for (const i of p.error.issues) errors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, status: 400, errors };
  }
  const h = ipHash(ip);
  if (!(await rateLimit(`report:${h}`, 5, 3600))) return { ok: false, status: 429, errors: { form: "Too many reports from this connection. Try again later." } };
  const slug = slugFromTarget(p.data.target);
  if (!slug) return { ok: false, status: 404, errors: { target: "We could not find that short link or page on this server." } };
  const link = await queryOne("SELECT id FROM links WHERE slug = ?", [slug]);
  const page = link ? null : await queryOne("SELECT id FROM users WHERE username = ?", [slug]);
  if (!link && !page) return { ok: false, status: 404, errors: { target: "We could not find that short link or page on this server." } };
  if (!(await rateLimit(`report:${h}:${slug}`, 1, 86_400))) return { ok: true }; // already reported by this connection today: accept silently
  await exec("INSERT INTO reports (target_type, target_slug, reason, details, reporter_ip_hash) VALUES (?, ?, ?, ?, ?)", [link ? "link" : "page", slug, p.data.reason, p.data.details || null, h]);
  invalidateSlug(slug); // the interstitial reads the open-report count from the cached lookup
  return { ok: true };
}
