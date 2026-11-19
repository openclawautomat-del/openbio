"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exec, queryOne } from "@/lib/db";
import { audit, destroyAllSessions, requireAdmin } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { setSettings } from "@/lib/settings";
import { clearSlugCache } from "@/lib/slug-cache";
import { hexColor, emailSchema } from "@/lib/validation";
import { LANGUAGES } from "@/lib/i18n";
import { EMAIL_TYPES, sendTestEmail } from "@/lib/email/mailer";
import type { FormState } from "@/components/client";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const on = (fd: FormData, k: string) => (fd.get(k) ? "1" : "0");
const fail = (errors: Record<string, string>): FormState => ({ errors });
const done = (message: string): FormState => ({ ok: true, message });

/* ---------- Users ---------- */

async function otherAdmins(exceptId: number): Promise<number> {
  const r = await queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'super_admin' AND status = 'active' AND id <> ?", [exceptId]);
  return Number(r?.n ?? 0);
}

export async function setUserRoleAction(id: number, role: "super_admin" | "user"): Promise<void> {
  const me = await requireAdmin();
  if (role !== "super_admin" && role !== "user") return;
  if (id === me.id && role !== "super_admin" && (await otherAdmins(id)) === 0) return;
  await exec("UPDATE users SET role = ? WHERE id = ?", [role, id]);
  await audit(me.id, "user.role", String(id), { role });
  clearSlugCache();
  revalidatePath("/admin/users");
}

export async function setUserStatusAction(id: number, status: "active" | "suspended"): Promise<void> {
  const me = await requireAdmin();
  if (id === me.id) return;
  await exec("UPDATE users SET status = ? WHERE id = ?", [status, id]);
  if (status === "suspended") await destroyAllSessions(id);
  await audit(me.id, `user.${status === "active" ? "reinstate" : "suspend"}`, String(id));
  clearSlugCache();
  revalidatePath("/admin/users");
}

export async function deleteUserAction(id: number): Promise<void> {
  const me = await requireAdmin();
  if (id === me.id) return;
  const u = await queryOne<{ username: string }>("SELECT username FROM users WHERE id = ?", [id]);
  if (!u) return;
  await exec("DELETE FROM users WHERE id = ?", [id]);
  await audit(me.id, "user.delete", u.username);
  clearSlugCache();
  revalidatePath("/admin/users");
}

/* ---------- Content moderation ---------- */

export async function bulkLinksAdminAction(op: "disable" | "enable" | "delete", ids: number[]): Promise<void> {
  const me = await requireAdmin();
  const clean = ids.filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
  if (!clean.length) return;
  const ph = clean.map(() => "?").join(",");
  if (op === "delete") {
    await exec(`DELETE FROM clicks WHERE entity_type = 'link' AND entity_id IN (${ph})`, clean);
    await exec(`DELETE FROM links WHERE id IN (${ph})`, clean);
  } else {
    await exec(`UPDATE links SET moderated = ? WHERE id IN (${ph})`, [op === "disable" ? 1 : 0, ...clean]);
  }
  await audit(me.id, `link.bulk_${op}`, `${clean.length} links`, { ids: clean });
  clearSlugCache();
  revalidatePath("/admin/content");
}

export async function moderatePageAction(id: number, moderated: boolean): Promise<void> {
  const me = await requireAdmin();
  await exec("UPDATE pages SET moderated = ? WHERE id = ?", [moderated ? 1 : 0, id]);
  await audit(me.id, moderated ? "page.disable" : "page.enable", String(id));
  clearSlugCache();
  revalidatePath("/admin/content");
}

/* ---------- Blocklist ---------- */

export async function addBlockAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const kind = s(fd, "kind") === "keyword" ? "keyword" : "domain";
  let value = s(fd, "value").toLowerCase();
  if (kind === "domain") {
    value = value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) return fail({ value: "Enter a domain like spam-example.com." });
  } else if (value.length < 3) {
    return fail({ value: "Keywords need at least 3 characters." });
  }
  if (value.length > 190) return fail({ value: "That is too long." });
  await exec("INSERT IGNORE INTO blocklist (kind, value) VALUES (?, ?)", [kind, value]);
  await audit(me.id, "blocklist.add", `${kind}:${value}`);
  revalidatePath("/admin/blocklist");
  return done(`${value} is now blocked.`);
}

export async function removeBlockAction(id: number): Promise<void> {
  const me = await requireAdmin();
  await exec("DELETE FROM blocklist WHERE id = ?", [id]);
  await audit(me.id, "blocklist.remove", String(id));
  revalidatePath("/admin/blocklist");
}

/* ---------- Reports ---------- */

export async function resolveReportAction(id: number, status: "resolved" | "dismissed" | "open"): Promise<void> {
  const me = await requireAdmin();
  await exec("UPDATE reports SET status = ? WHERE id = ?", [status, id]);
  await audit(me.id, `report.${status}`, String(id));
  clearSlugCache();
  revalidatePath("/admin/reports");
}

/** Takes the reported item down and marks the report resolved in one step. */
export async function takeDownReportedAction(id: number): Promise<void> {
  const me = await requireAdmin();
  const r = await queryOne<{ target_type: string; target_slug: string }>("SELECT target_type, target_slug FROM reports WHERE id = ?", [id]);
  if (!r) return;
  if (r.target_type === "link") await exec("UPDATE links SET moderated = 1 WHERE slug = ?", [r.target_slug]);
  else await exec("UPDATE pages p JOIN users u ON u.id = p.user_id SET p.moderated = 1 WHERE u.username = ?", [r.target_slug]);
  await exec("UPDATE reports SET status = 'resolved' WHERE id = ?", [id]);
  await audit(me.id, "report.takedown", `${r.target_type}:${r.target_slug}`);
  clearSlugCache();
  revalidatePath("/admin/reports");
}

/* ---------- Settings ---------- */

export async function saveBrandingAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const p = z.object({
    brand_name: z.string().trim().max(60),
    brand_tagline: z.string().trim().max(140),
    brand_support_email: z.union([emailSchema, z.literal("")]),
    brand_primary: z.union([hexColor, z.literal("")]),
    brand_logo_url: z.string().trim().max(500),
    brand_favicon_url: z.string().trim().max(500),
    brand_footer_text: z.string().trim().max(300),
    brand_font: z.enum(["grotesk", "serif"]),
  }).safeParse({
    brand_name: s(fd, "brand_name"), brand_tagline: s(fd, "brand_tagline"), brand_support_email: s(fd, "brand_support_email").toLowerCase(),
    brand_primary: s(fd, "brand_primary"), brand_logo_url: s(fd, "brand_logo_url"), brand_favicon_url: s(fd, "brand_favicon_url"),
    brand_footer_text: s(fd, "brand_footer_text"), brand_font: s(fd, "brand_font") || "grotesk",
  });
  if (!p.success) {
    const errors: Record<string, string> = {};
    for (const i of p.error.issues) errors[String(i.path[0])] ??= i.message;
    return fail(errors);
  }
  for (const k of ["brand_logo_url", "brand_favicon_url"] as const) {
    const v = p.data[k];
    if (v && !/^(https:\/\/|\/uploads\/)/.test(v)) return fail({ [k]: "Use an https:// URL or an uploaded /uploads/ path." });
  }
  await setSettings({ ...p.data, brand_powered_by: on(fd, "brand_powered_by") });
  await audit(me.id, "settings.branding");
  revalidatePath("/", "layout");
  return done("Branding saved.");
}

export async function saveGeneralAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const lang = s(fd, "default_language");
  if (!LANGUAGES[lang]) return fail({ default_language: "Pick one of the listed languages." });
  await setSettings({
    registration_enabled: on(fd, "registration_enabled"),
    require_email_verification: on(fd, "require_email_verification"),
    default_language: lang,
  });
  await audit(me.id, "settings.general");
  revalidatePath("/", "layout");
  return done("General settings saved.");
}

export async function saveApiSettingsAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const n = Number(s(fd, "api_rate_limit"));
  if (!Number.isInteger(n) || n < 1 || n > 10_000) return fail({ api_rate_limit: "Enter a whole number between 1 and 10000." });
  await setSettings({ api_rate_limit: String(n) });
  await audit(me.id, "settings.api", undefined, { api_rate_limit: n });
  return done("API limit saved.");
}

export async function saveIntegrationsAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const vals: Record<string, string> = {
    google_client_id: s(fd, "google_client_id"),
    s3_bucket: s(fd, "s3_bucket"),
    s3_region: s(fd, "s3_region"),
    s3_endpoint: s(fd, "s3_endpoint"),
    s3_key: s(fd, "s3_key"),
    s3_public_url: s(fd, "s3_public_url"),
  };
  for (const k of ["s3_endpoint", "s3_public_url"]) {
    if (vals[k] && !/^https:\/\//.test(vals[k])) return fail({ [k]: "Use an https:// URL." });
  }
  // Secrets are only replaced when a new value is typed; they are encrypted at rest and never shown back.
  if (s(fd, "google_client_secret")) vals.google_client_secret = encrypt(s(fd, "google_client_secret"));
  if (s(fd, "s3_secret")) vals.s3_secret = encrypt(s(fd, "s3_secret"));
  if (fd.get("clear_s3")) { vals.s3_bucket = ""; vals.s3_key = ""; vals.s3_secret = ""; }
  if (fd.get("clear_google")) { vals.google_client_id = ""; vals.google_client_secret = ""; }
  await setSettings(vals);
  await audit(me.id, "settings.integrations");
  revalidatePath("/admin/settings");
  return done("Integrations saved.");
}

export async function saveLegalAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const terms = String(fd.get("legal_terms") ?? "").slice(0, 50_000);
  const privacy = String(fd.get("legal_privacy") ?? "").slice(0, 50_000);
  await setSettings({ legal_terms: terms, legal_privacy: privacy });
  await audit(me.id, "settings.legal");
  revalidatePath("/terms");
  revalidatePath("/privacy");
  return done("Legal pages saved. Leave a box empty to use the built-in text.");
}

/* ---------- Mailboxes ---------- */

export async function saveMailboxAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const type = s(fd, "type");
  if (type !== "default" && !(EMAIL_TYPES as readonly string[]).includes(type)) return fail({ form: "Unknown mailbox type." });
  const host = s(fd, "host");
  const port = Number(s(fd, "port") || 465);
  const username = s(fd, "username");
  const limit = Number(s(fd, "daily_limit") || 100);
  const fromEmail = s(fd, "from_email").toLowerCase();
  if (!/^[a-z0-9.-]+$/i.test(host)) return fail({ host: "Enter the SMTP host, for example smtp.hostinger.com." });
  if (!Number.isInteger(port) || port < 1 || port > 65535) return fail({ port: "Enter a port between 1 and 65535." });
  if (!username) return fail({ username: "Enter the mailbox login." });
  if (!Number.isInteger(limit) || limit < 1 || limit > 100_000) return fail({ daily_limit: "Enter a whole number of at least 1." });
  if (fromEmail && !emailSchema.safeParse(fromEmail).success) return fail({ from_email: "Enter a valid address." });
  const existing = await queryOne<{ password_enc: string }>("SELECT password_enc FROM mailboxes WHERE type = ?", [type]);
  const pw = s(fd, "password");
  if (!pw && !existing) return fail({ password: "Enter the mailbox password." });
  const enc = pw ? encrypt(pw) : existing!.password_enc;
  await exec(
    `INSERT INTO mailboxes (type, host, port, secure, username, password_enc, from_name, from_email, daily_limit, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE host = VALUES(host), port = VALUES(port), secure = VALUES(secure), username = VALUES(username),
       password_enc = VALUES(password_enc), from_name = VALUES(from_name), from_email = VALUES(from_email),
       daily_limit = VALUES(daily_limit), enabled = VALUES(enabled)`,
    [type, host, port, on(fd, "secure") === "1" ? 1 : 0, username, enc, s(fd, "from_name").slice(0, 100) || null, fromEmail || null, limit, on(fd, "enabled") === "1" ? 1 : 0],
  );
  await audit(me.id, "mailbox.save", type);
  revalidatePath("/admin/email");
  return done("Mailbox saved. Use Send test to check it.");
}

export async function deleteMailboxAction(type: string): Promise<void> {
  const me = await requireAdmin();
  await exec("DELETE FROM mailboxes WHERE type = ?", [type]);
  await audit(me.id, "mailbox.delete", type);
  revalidatePath("/admin/email");
}

export async function testMailboxAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const to = emailSchema.safeParse(s(fd, "to"));
  if (!to.success) return fail({ to: "Enter the address that should receive the test." });
  const type = s(fd, "type");
  const r = await sendTestEmail(type, to.data);
  await audit(me.id, "mailbox.test", type, { ok: r.ok });
  return r.ok ? done(`Test sent to ${to.data}.`) : fail({ form: r.error ?? "The test failed." });
}

export async function clearFailedEmailAction(): Promise<void> {
  const me = await requireAdmin();
  await exec("DELETE FROM email_queue WHERE status = 'failed'");
  await audit(me.id, "email.clear_failed");
  revalidatePath("/admin/email");
}

export async function retryEmailAction(id: number): Promise<void> {
  await requireAdmin();
  await exec("UPDATE email_queue SET status = 'queued', attempts = 0, next_attempt_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'failed' AND html <> ''", [id]);
  revalidatePath("/admin/email");
}

