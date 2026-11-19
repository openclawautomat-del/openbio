import { exec, queryOne } from "../db";
import { randomToken, sha256 } from "../crypto";
import { hashPassword } from "../auth";
import { getBrand } from "../brand";
import { sendEmail, emailAvailable } from "../email/mailer";
import { flag } from "../settings";
import { ensurePage } from "./pages";

export async function issueToken(userId: number, purpose: "verify_email" | "password_reset", ttlMin: number): Promise<string> {
  const token = randomToken(32);
  await exec("DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?", [userId, purpose]);
  await exec("INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))", [
    sha256(token), userId, purpose, ttlMin,
  ]);
  return token;
}

/** Atomically consumes a valid, unused token and returns its user id. */
export async function consumeToken(token: string, purpose: "verify_email" | "password_reset"): Promise<number | null> {
  const h = sha256(token);
  const row = await queryOne<{ user_id: number }>(
    "SELECT user_id FROM auth_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()",
    [h, purpose],
  );
  if (!row) return null;
  const r = await exec("UPDATE auth_tokens SET used_at = UTC_TIMESTAMP() WHERE token_hash = ? AND used_at IS NULL", [h]);
  return r.affectedRows === 1 ? row.user_id : null;
}

export async function sendVerification(user: { id: number; email: string }): Promise<boolean> {
  if (!(await emailAvailable("verification"))) return false;
  const brand = await getBrand();
  const token = await issueToken(user.id, "verify_email", 60 * 24);
  const url = `${brand.url}/verify?token=${token}`;
  const r = await sendEmail("verification", user.email, {
    subject: `Confirm your email for ${brand.name}`,
    heading: "Confirm your email address",
    paragraphs: [`Use the button below to confirm this address for your ${brand.name} account. The link works for 24 hours.`],
    button: { label: "Confirm email", url },
    footnote: "If you did not create an account, you can ignore this message.",
  });
  return r.queued;
}

export async function sendWelcome(user: { email: string; username: string }): Promise<void> {
  const brand = await getBrand();
  await sendEmail("welcome", user.email, {
    subject: `Welcome to ${brand.name}`,
    heading: `Your page is live at /${user.username}`,
    paragraphs: [
      `Your account is ready. Your public page address is ${brand.url}/${user.username}.`,
      "Add your first links from the dashboard, then share the page or its QR code.",
    ],
    button: { label: "Open dashboard", url: `${brand.url}/dashboard` },
  });
}

export async function createUser(input: { email: string; username: string; password: string; role?: "super_admin" | "user"; verified?: boolean; reviewReason?: string | null }): Promise<number> {
  const hash = await hashPassword(input.password);
  const res = await exec(
    "INSERT INTO users (email, username, password_hash, role, email_verified_at) VALUES (?, ?, ?, ?, ?)",
    [input.email, input.username, hash, input.role ?? "user", input.verified ? new Date() : null],
  );
  await ensurePage(res.insertId, input.username);
  // A suspicious username keeps the account but its public page waits for admin approval.
  if (input.reviewReason) await exec("UPDATE pages SET review_status = 'pending', review_reason = ? WHERE user_id = ?", [input.reviewReason.slice(0, 190), res.insertId]);
  return res.insertId;
}

export async function verificationRequired(): Promise<boolean> {
  return flag("require_email_verification", false);
}
