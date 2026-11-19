"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { exec, queryOne } from "@/lib/db";
import { createSession, destroySession, destroyAllSessions, currentUser, hashPassword, verifyPassword, requireUser } from "@/lib/auth";
import { emailSchema, passwordSchema, slugSchema, fieldErrors, safeNext } from "@/lib/validation";
import { rateLimit } from "@/lib/ratelimit";
import { ipHash } from "@/lib/crypto";
import { reqInfo } from "@/lib/request";
import { flag } from "@/lib/settings";
import { getBrand } from "@/lib/brand";
import { validateNewSlug, slugRateOk, SLUG_RATE_MESSAGE } from "@/lib/slug-service";
import { consumeToken, createUser, issueToken, sendVerification, sendWelcome } from "@/lib/services/users";
import { emailAvailable, sendEmail } from "@/lib/email/mailer";
import { getT } from "@/lib/i18n";

export interface FormState {
  errors?: Record<string, string>;
  message?: string;
  ok?: boolean;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT();
  const info = await reqInfo();
  const email = str(fd, "email").trim().toLowerCase();
  if (!(await rateLimit(`login:ip:${ipHash(info.ip)}`, 20, 900)) || !(await rateLimit(`login:em:${email}`, 8, 900))) {
    return { errors: { form: t("error.ratelimit") } };
  }
  const user = await queryOne<{ id: number; password_hash: string | null; status: string }>(
    "SELECT id, password_hash, status FROM users WHERE email = ?", [email],
  );
  // Always run a hash comparison so response time does not reveal whether the account exists.
  const ok = await verifyPassword(str(fd, "password"), user?.password_hash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali");
  if (!user || !user.password_hash || !ok) return { errors: { form: t("auth.login.invalid") } };
  if (user.status !== "active") return { errors: { form: t("auth.login.suspended") } };
  await createSession(user.id);
  redirect(safeNext(str(fd, "next")));
}

const registerSchema = z.object({ email: emailSchema, username: slugSchema, password: passwordSchema });

export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT();
  if (!(await flag("registration_enabled", true))) return { errors: { form: t("auth.register.closed") } };
  const info = await reqInfo();
  if (!(await rateLimit(`register:ip:${ipHash(info.ip)}`, 5, 3600))) return { errors: { form: t("error.ratelimit") } };
  const p = registerSchema.safeParse({ email: str(fd, "email"), username: str(fd, "username"), password: str(fd, "password") });
  if (!p.success) return { errors: fieldErrors(p.error) };
  const { email, username, password } = p.data;
  if (!(await slugRateOk(null, info.ip))) return { errors: { username: SLUG_RATE_MESSAGE } };
  const named = await validateNewSlug(username, { appName: (await getBrand()).name });
  if (!named.ok) return { errors: { username: named.error } };
  if (await queryOne("SELECT id FROM users WHERE email = ?", [email])) return { errors: { email: "An account with this email already exists." } };
  const id = await createUser({ email, username, password, reviewReason: named.review });
  void sendVerification({ id, email }).catch(() => {});
  void sendWelcome({ email, username }).catch(() => {});
  await createSession(id);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function forgotAction(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT();
  if (!(await emailAvailable("password_reset"))) return { errors: { form: t("auth.forgot.disabled") } };
  const info = await reqInfo();
  const e = emailSchema.safeParse(str(fd, "email"));
  if (!e.success) return { errors: { email: e.error.issues[0].message } };
  // Max 3 reset emails per hour per address and per IP; the reply is identical either way.
  const allowed = (await rateLimit(`reset:em:${e.data}`, 3, 3600)) && (await rateLimit(`reset:ip:${ipHash(info.ip)}`, 6, 3600));
  if (!allowed) return { message: t("auth.forgot.sent"), ok: true };
  const user = await queryOne<{ id: number; email: string }>("SELECT id, email FROM users WHERE email = ? AND status = 'active'", [e.data]);
  if (user) {
    const brand = await getBrand();
    const token = await issueToken(user.id, "password_reset", 60);
    await sendEmail("password_reset", user.email, {
      subject: `Reset your ${brand.name} password`,
      heading: "Choose a new password",
      paragraphs: ["Someone asked to reset the password for this account. The link below works for one hour.", "If that was not you, nothing will change and you can ignore this email."],
      button: { label: "Reset password", url: `${brand.url}/reset-password?token=${token}` },
    });
  }
  return { message: t("auth.forgot.sent"), ok: true };
}

export async function resetAction(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT();
  const pw = passwordSchema.safeParse(str(fd, "password"));
  if (!pw.success) return { errors: { password: pw.error.issues[0].message } };
  const uid = await consumeToken(str(fd, "token"), "password_reset");
  if (!uid) return { errors: { form: t("auth.reset.invalid") } };
  await exec("UPDATE users SET password_hash = ? WHERE id = ?", [await hashPassword(pw.data), uid]);
  await destroyAllSessions(uid);
  const u = await queryOne<{ email: string }>("SELECT email FROM users WHERE id = ?", [uid]);
  const brand = await getBrand();
  if (u) {
    void sendEmail("security_alert", u.email, {
      subject: `Your ${brand.name} password was changed`,
      heading: "Your password was changed",
      paragraphs: ["The password for your account was just reset and all sessions were signed out.", `If this was not you, contact ${brand.supportEmail || "the site owner"} right away.`],
    });
  }
  redirect("/login?reset=1");
}

export async function resendVerificationAction(): Promise<FormState> {
  const u = await requireUser();
  const info = await reqInfo();
  if (!(await rateLimit(`verify:u:${u.id}`, 3, 3600)) || !(await rateLimit(`verify:ip:${ipHash(info.ip)}`, 6, 3600))) {
    return { errors: { form: "Too many requests. Try again in an hour." } };
  }
  const sent = await sendVerification(u);
  return sent ? { ok: true, message: "Confirmation email sent." } : { errors: { form: "Email is not set up on this server." } };
}

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  const row = await queryOne<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE id = ?", [u.id]);
  if (!row?.password_hash || !(await verifyPassword(str(fd, "current"), row.password_hash))) return { errors: { current: "Current password is incorrect." } };
  const pw = passwordSchema.safeParse(str(fd, "password"));
  if (!pw.success) return { errors: { password: pw.error.issues[0].message } };
  await exec("UPDATE users SET password_hash = ? WHERE id = ?", [await hashPassword(pw.data), u.id]);
  await destroyAllSessions(u.id);
  await createSession(u.id);
  const brand = await getBrand();
  void sendEmail("security_alert", u.email, {
    subject: `Your ${brand.name} password was changed`,
    heading: "Your password was changed",
    paragraphs: ["Your password was changed from the account settings. Other sessions were signed out."],
  });
  return { ok: true, message: "Password updated. Other devices were signed out." };
}

export async function deleteAccountAction(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  if (u.role === "super_admin") return { errors: { form: "Super admin accounts cannot be deleted here." } };
  const row = await queryOne<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE id = ?", [u.id]);
  if (!row?.password_hash || !(await verifyPassword(str(fd, "password"), row.password_hash))) return { errors: { password: "Password is incorrect." } };
  await exec("DELETE FROM clicks WHERE user_id = ?", [u.id]);
  await exec("DELETE FROM users WHERE id = ?", [u.id]);
  await destroySession();
  redirect("/");
}

export async function setLanguageAction(lang: string): Promise<void> {
  const u = await currentUser();
  if (u) await exec("UPDATE users SET language = ? WHERE id = ?", [lang.slice(0, 8), u.id]);
  const { cookies } = await import("next/headers");
  (await cookies()).set("lang", lang.slice(0, 8), { path: "/", maxAge: 31536000, sameSite: "lax" });
}
