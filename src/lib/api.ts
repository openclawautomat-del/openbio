import { NextResponse } from "next/server";
import { exec, queryOne } from "./db";
import { ipHash, sha256 } from "./crypto";
import { rateLimit } from "./ratelimit";
import { getSetting } from "./settings";
import { fromHeaders } from "./request";
import type { LinkRow } from "./services/links";

export interface ApiUser { id: number; username: string; role: "super_admin" | "user"; keyId: number }

export function apiError(status: number, message: string, extra?: Record<string, unknown>, headers?: Record<string, string>) {
  return NextResponse.json({ error: { message, ...extra } }, { status, headers });
}

export const num = (v: string | undefined | null, d: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

/**
 * Authenticates a Bearer key and applies the per-key rate limit (admin setting api_rate_limit, per minute).
 * Returns either the user or a ready-made error response.
 */
export async function authApi(req: Request): Promise<{ user: ApiUser } | { res: NextResponse }> {
  const info = fromHeaders(req.headers);
  // Throttle key guessing per IP before touching the key table.
  if (!(await rateLimit(`api:ip:${ipHash(info.ip)}`, 600, 60))) {
    return { res: apiError(429, "Too many requests.", undefined, { "Retry-After": "60" }) };
  }
  const m = /^Bearer\s+(ob_[A-Za-z0-9_-]{20,})$/.exec(req.headers.get("authorization") ?? "");
  if (!m) return { res: apiError(401, "Send your key as an Authorization: Bearer ob_... header.", undefined, { "WWW-Authenticate": "Bearer" }) };
  const row = await queryOne<{ id: number; user_id: number; username: string; role: "super_admin" | "user"; status: string }>(
    `SELECT k.id, k.user_id, u.username, u.role, u.status FROM api_keys k JOIN users u ON u.id = k.user_id
      WHERE k.key_hash = ? AND k.revoked_at IS NULL`,
    [sha256(m[1])],
  );
  if (!row || row.status !== "active") return { res: apiError(401, "That key is invalid or has been revoked.") };
  const limit = num(await getSetting("api_rate_limit"), 60);
  if (!(await rateLimit(`api:key:${row.id}`, limit, 60))) {
    return { res: apiError(429, `Rate limit of ${limit} requests per minute reached.`, undefined, { "Retry-After": "60" }) };
  }
  exec("UPDATE api_keys SET last_used_at = UTC_TIMESTAMP() WHERE id = ?", [row.id]).catch(() => {});
  return { user: { id: row.user_id, username: row.username, role: row.role, keyId: row.id } };
}

export function linkJson(l: LinkRow, base: string) {
  return {
    id: l.id,
    slug: l.slug,
    short_url: `${base}/${l.slug}`,
    target_url: l.target_url,
    title: l.title,
    password_protected: !!l.password_hash,
    enabled: !!l.enabled && !l.moderated,
    starts_at: l.starts_at ? new Date(l.starts_at).toISOString() : null,
    expires_at: l.expires_at ? new Date(l.expires_at).toISOString() : null,
    created_at: new Date(l.created_at).toISOString(),
  };
}

export async function jsonBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
