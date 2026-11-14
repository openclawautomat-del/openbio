"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { exec, queryOne } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { getBrand } from "@/lib/brand";
import { rateLimit } from "@/lib/ratelimit";
import { ipHash } from "@/lib/crypto";
import { reqInfo } from "@/lib/request";
import { recordClick } from "@/lib/analytics";
import { emailSchema, fieldErrors, isBlocked } from "@/lib/validation";
import { getLinkBySlug } from "@/lib/services/public";
import { linkState } from "@/lib/services/links";
import { sendEmail } from "@/lib/email/mailer";
import { phase2Enabled } from "@/lib/features";
import type { FormState } from "@/components/client";

/** Password-protected short link: verify, count the click, then redirect. */
export async function unlockLinkAction(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  const info = await reqInfo();
  if (!(await rateLimit(`unlock:${info.ip}:${slug}`, 8, 600))) return { errors: { password: "Too many attempts. Try again in a few minutes." } };
  const link = await getLinkBySlug(slug);
  if (!link || !link.password_hash || linkState(link) !== "active" || !link.owner_active) return { errors: { password: "This link is no longer available." } };
  const ok = await verifyPassword(String(fd.get("password") ?? ""), link.password_hash);
  if (!ok) return { errors: { password: "That password is not right." } };
  const blocked = await isBlocked(link.target_url);
  if (blocked) return { errors: { password: "This link has been blocked." } };
  const b = await getBrand();
  await recordClick({ type: "link", id: link.id, userId: link.user_id, info, ownHost: b.host });
  redirect(link.target_url);
}

const contactSchema = z.object({
  name: z.string().trim().min(1, "Tell them who you are.").max(100),
  email: emailSchema,
  message: z.string().trim().min(5, "Write a few words.").max(2000),
  website: z.string().max(0).optional(), // honeypot
});

/** Contact form block (Phase 2). Stored in the DB first, then emailed to the page owner if mail is configured. */
export async function contactAction(blockId: number, _: FormState, fd: FormData): Promise<FormState> {
  if (!phase2Enabled()) return { errors: { form: "Contact forms are turned off on this server." } };
  const info = await reqInfo();
  if (!(await rateLimit(`contact:${info.ip}`, 5, 3600))) return { errors: { form: "You have sent several messages already. Try again later." } };
  const p = contactSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { errors: fieldErrors(p.error) };
  if (p.data.website) return { ok: true, message: "Message sent." }; // bots get a fake success
  const block = await queryOne<{ id: number; user_id: number; email: string; username: string }>(
    `SELECT b.id, p.user_id, u.email, u.username FROM blocks b JOIN pages p ON p.id = b.page_id JOIN users u ON u.id = p.user_id
      WHERE b.id = ? AND b.type = 'contact_form' AND b.enabled = 1 AND p.published = 1 AND p.moderated = 0 AND u.status = 'active'`,
    [blockId],
  );
  if (!block) return { errors: { form: "This form is not available." } };
  if (!(await rateLimit(`contact:block:${blockId}`, 30, 3600))) return { errors: { form: "This inbox is receiving too many messages right now." } };
  await exec("INSERT INTO contact_messages (block_id, user_id, name, email, message) VALUES (?, ?, ?, ?, ?)", [blockId, block.user_id, p.data.name, p.data.email, p.data.message]);
  const b = await getBrand();
  await sendEmail("contact_form", block.email, {
    subject: `New message from ${p.data.name}`,
    heading: "Someone wrote to you",
    paragraphs: [`${p.data.name} (${p.data.email}) sent a message through your ${b.name} page:`, p.data.message],
    footnote: "Reply directly to the sender at the address above. You can also read it in your dashboard under Messages.",
  }).catch(() => undefined);
  return { ok: true, message: "Message sent." };
}

const reportSchema = z.object({
  target: z.string().trim().min(1, "Enter the short link or page being reported.").max(255),
  reason: z.enum(["spam", "phishing", "malware", "illegal", "other"]),
  details: z.string().trim().max(1000).optional(),
});

/** Accepts a pasted URL or a bare name and reduces it to the slug on this server. */
function slugFromTarget(raw: string): string {
  let v = raw.trim();
  try { v = new URL(v).pathname; } catch {}
  return v.replace(/^\/+/, "").split(/[/?#]/)[0].toLowerCase().slice(0, 64);
}

export async function reportAction(_: FormState, fd: FormData): Promise<FormState> {
  const info = await reqInfo();
  if (!(await rateLimit(`report:${info.ip}`, 5, 3600))) return { errors: { form: "Too many reports from this connection. Try again later." } };
  const p = reportSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { errors: fieldErrors(p.error) };
  const slug = slugFromTarget(p.data.target);
  const link = await queryOne("SELECT id FROM links WHERE slug = ?", [slug]);
  const page = link ? null : await queryOne("SELECT id FROM users WHERE username = ?", [slug]);
  if (!link && !page) return { errors: { target: "We could not find that short link or page on this server." } };
  await exec("INSERT INTO reports (target_type, target_slug, reason, details, reporter_ip_hash) VALUES (?, ?, ?, ?, ?)", [link ? "link" : "page", slug, p.data.reason, p.data.details || null, ipHash(info.ip)]);
  return { ok: true, message: "Thanks. An administrator will review it." };
}
