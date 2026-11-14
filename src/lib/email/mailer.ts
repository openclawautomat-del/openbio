import nodemailer from "nodemailer";
import { query, queryOne, exec } from "../db";
import { decrypt } from "../crypto";
import { getBrand } from "../brand";
import { renderEmail, type EmailContent } from "./templates";
import { audit } from "../auth";

export const EMAIL_TYPES = [
  "verification", "password_reset", "welcome", "security_alert", "notification", "contact_form", "report_export", "marketing",
] as const;
export type EmailType = (typeof EMAIL_TYPES)[number];

/** Lower number is sent first. Critical account emails jump the queue. */
const PRIORITY: Record<EmailType, number> = {
  verification: 1, password_reset: 1, security_alert: 2, welcome: 4, notification: 5, contact_form: 5, report_export: 6, marketing: 9,
};

const MAX_ATTEMPTS = 6;

interface MailboxRow {
  type: string;
  host: string;
  port: number;
  secure: number;
  username: string;
  password_enc: string;
  from_name: string | null;
  from_email: string | null;
  daily_limit: number;
  enabled: number;
}

/** type-specific mailbox, then "default", else null (email gracefully disabled). */
export async function resolveMailbox(type: string): Promise<MailboxRow | null> {
  const rows = await query<MailboxRow>("SELECT * FROM mailboxes WHERE type IN (?, 'default') AND enabled = 1", [type]);
  return rows.find((r) => r.type === type) ?? rows.find((r) => r.type === "default") ?? null;
}

export async function emailAvailable(type: EmailType): Promise<boolean> {
  return (await resolveMailbox(type)) !== null;
}

const today = () => new Date().toISOString().slice(0, 10);

export async function usageToday(): Promise<Record<string, number>> {
  const rows = await query<{ mailbox_type: string; sent: number }>("SELECT mailbox_type, sent FROM email_usage WHERE day = ?", [today()]);
  return Object.fromEntries(rows.map((r) => [r.mailbox_type, Number(r.sent)]));
}

export async function sendEmail(type: EmailType, to: string, content: EmailContent): Promise<{ queued: boolean; reason?: string }> {
  const brand = await getBrand();
  const { html, text } = renderEmail(brand, content);
  const mb = await resolveMailbox(type);
  if (!mb) {
    await exec(
      "INSERT INTO email_queue (type, priority, to_email, subject, html, text_body, status, last_error) VALUES (?, ?, ?, ?, '', '', 'failed', ?)",
      [type, PRIORITY[type], to, content.subject.slice(0, 255), "No mailbox configured. Email is disabled."],
    );
    return { queued: false, reason: "no_mailbox" };
  }
  await exec("INSERT INTO email_queue (type, priority, to_email, subject, html, text_body) VALUES (?, ?, ?, ?, ?, ?)", [
    type, PRIORITY[type], to, content.subject.slice(0, 255), html, text,
  ]);
  // Kick the worker without blocking the request.
  setTimeout(() => void processQueue().catch(() => {}), 50);
  return { queued: true };
}

function transport(mb: MailboxRow) {
  return nodemailer.createTransport({
    host: mb.host,
    port: mb.port,
    secure: Boolean(mb.secure),
    auth: { user: mb.username, pass: decrypt(mb.password_enc) },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
}

function fromHeader(mb: MailboxRow, brandName: string) {
  return `"${(mb.from_name || brandName).replace(/"/g, "")}" <${mb.from_email || mb.username}>`;
}

/** Reserve one send against the mailbox's daily budget. Never exceeds the limit, even with concurrent workers. */
async function reserve(mb: MailboxRow): Promise<boolean> {
  await exec("INSERT IGNORE INTO email_usage (mailbox_type, day, sent) VALUES (?, ?, 0)", [mb.type, today()]);
  const r = await exec("UPDATE email_usage SET sent = sent + 1 WHERE mailbox_type = ? AND day = ? AND sent < ?", [
    mb.type, today(), mb.daily_limit,
  ]);
  return r.affectedRows === 1;
}

async function release(mb: MailboxRow) {
  await exec("UPDATE email_usage SET sent = GREATEST(sent - 1, 0) WHERE mailbox_type = ? AND day = ?", [mb.type, today()]);
}

let running = false;

/** Sends due emails. Safe to call often; a single in-process lock plus row claiming prevents double sends. */
export async function processQueue(limit = 10): Promise<number> {
  if (running) return 0;
  running = true;
  let sent = 0;
  try {
    const brand = await getBrand();
    const due = await query<{ id: number; type: string; to_email: string; subject: string; html: string; text_body: string; attempts: number }>(
      `SELECT id, type, to_email, subject, html, text_body, attempts FROM email_queue
        WHERE status = 'queued' AND next_attempt_at <= UTC_TIMESTAMP()
        ORDER BY priority ASC, id ASC LIMIT ${Math.max(1, Math.min(50, limit | 0))}`,
    );
    for (const job of due) {
      const claim = await exec("UPDATE email_queue SET status = 'sending' WHERE id = ? AND status = 'queued'", [job.id]);
      if (claim.affectedRows !== 1) continue;
      const mb = await resolveMailbox(job.type);
      if (!mb) {
        await exec("UPDATE email_queue SET status = 'failed', last_error = 'No mailbox configured' WHERE id = ?", [job.id]);
        continue;
      }
      if (!(await reserve(mb))) {
        // Over the daily limit: wait until just after UTC midnight.
        await exec(
          "UPDATE email_queue SET status = 'queued', next_attempt_at = TIMESTAMP(DATE_ADD(UTC_DATE(), INTERVAL 1 DAY), '00:05:00'), last_error = 'Daily limit reached; waiting for tomorrow' WHERE id = ?",
          [job.id],
        );
        continue;
      }
      try {
        await transport(mb).sendMail({
          from: fromHeader(mb, brand.name),
          to: job.to_email,
          subject: job.subject,
          html: job.html,
          text: job.text_body,
        });
        await exec("UPDATE email_queue SET status = 'sent', sent_at = UTC_TIMESTAMP(), mailbox_used = ?, last_error = NULL WHERE id = ?", [mb.type, job.id]);
        sent++;
        const used = await queryOne<{ sent: number }>("SELECT sent FROM email_usage WHERE mailbox_type = ? AND day = ?", [mb.type, today()]);
        if (used && Number(used.sent) === Math.ceil(mb.daily_limit * 0.8)) {
          await audit(null, "email.near_limit", mb.type, { sent: used.sent, limit: mb.daily_limit });
        }
      } catch (e) {
        await release(mb);
        const attempts = job.attempts + 1;
        const msg = (e instanceof Error ? e.message : String(e)).slice(0, 480);
        if (attempts >= MAX_ATTEMPTS) {
          await exec("UPDATE email_queue SET status = 'failed', attempts = ?, last_error = ? WHERE id = ?", [attempts, msg, job.id]);
        } else {
          const delayMin = Math.min(2 ** attempts, 360); // 2, 4, 8, 16, 32 minutes
          await exec(
            "UPDATE email_queue SET status = 'queued', attempts = ?, last_error = ?, next_attempt_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE) WHERE id = ?",
            [attempts, msg, delayMin, job.id],
          );
        }
      }
    }
  } finally {
    running = false;
  }
  return sent;
}

export async function sendTestEmail(type: string, to: string): Promise<{ ok: boolean; error?: string }> {
  const mb = await resolveMailbox(type);
  if (!mb) return { ok: false, error: "No mailbox is configured for this type, and there is no default mailbox." };
  const brand = await getBrand();
  const { html, text } = renderEmail(brand, {
    subject: `Test email from ${brand.name}`,
    heading: "Your mailbox works",
    paragraphs: [`This message was sent through the "${mb.type}" mailbox (${mb.host}:${mb.port}) from ${brand.name}.`],
  });
  try {
    await transport(mb).sendMail({ from: fromHeader(mb, brand.name), to, subject: `Test email from ${brand.name}`, html, text });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
