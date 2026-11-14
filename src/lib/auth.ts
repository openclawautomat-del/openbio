import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { query, queryOne, exec } from "./db";
import { randomToken, sha256, ipHash } from "./crypto";
import { reqInfo } from "./request";

export interface User {
  id: number;
  email: string;
  username: string;
  role: "super_admin" | "user";
  status: "active" | "suspended";
  email_verified_at: Date | null;
  language: string;
}

const COOKIE = "sid";
const SESSION_DAYS = 30;

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function createSession(userId: number): Promise<void> {
  const token = randomToken(32);
  const info = await reqInfo();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await exec("INSERT INTO sessions (id, user_id, ip_hash, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)", [
    sha256(token), userId, ipHash(info.ip), info.ua.slice(0, 255), expires,
  ]);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: (process.env.APP_URL || "").startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires,
  });
  await exec("UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?", [userId]);
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) await exec("DELETE FROM sessions WHERE id = ?", [sha256(t)]);
  jar.delete(COOKIE);
}

export async function destroyAllSessions(userId: number): Promise<void> {
  await exec("DELETE FROM sessions WHERE user_id = ?", [userId]);
}

export const currentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (!t) return null;
  const u = await queryOne<User>(
    `SELECT u.id, u.email, u.username, u.role, u.status, u.email_verified_at, u.language
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP()`,
    [sha256(t)],
  );
  if (!u || u.status !== "active") return null;
  return u;
});

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

/** Role is always checked server-side against the database row, never a client-supplied value. */
export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "super_admin") redirect("/dashboard");
  return u;
}

export async function audit(actorId: number | null, action: string, target?: string, meta?: unknown): Promise<void> {
  await exec("INSERT INTO audit_log (actor_id, action, target, meta) VALUES (?, ?, ?, ?)", [
    actorId, action, target ?? null, meta ? JSON.stringify(meta) : null,
  ]);
}

export async function purgeExpired(): Promise<void> {
  await exec("DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP()");
  await exec("DELETE FROM auth_tokens WHERE expires_at < UTC_TIMESTAMP()");
}

export async function userCount(): Promise<number> {
  const r = await query<{ n: number }>("SELECT COUNT(*) AS n FROM users");
  return Number(r[0]?.n ?? 0);
}
