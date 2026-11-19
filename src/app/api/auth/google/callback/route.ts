import { NextResponse } from "next/server";
import { exec, queryOne } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { getSetting } from "@/lib/settings";
import { decrypt, safeEqual } from "@/lib/crypto";
import { createSession } from "@/lib/auth";
import { safeNext } from "@/lib/validation";
import { ensurePage } from "@/lib/services/pages";
import { validateNewSlug } from "@/lib/slug-service";
import { rateLimit } from "@/lib/ratelimit";
import { fromHeaders } from "@/lib/request";

export const dynamic = "force-dynamic";

interface GoogleUser { sub?: string; email?: string; email_verified?: boolean; name?: string }

async function freeUsername(email: string): Promise<string> {
  const base = (email.split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 28) || "user").replace(/^[-_]+/, "") || "user";
  for (let i = 0; i < 20; i++) {
    const cand = i === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    const v = await validateNewSlug(cand, { appName: (await getBrand()).name });
    if (v.ok && !v.review) return v.slug;
  }
  return `user${Date.now().toString(36)}`;
}

export async function GET(req: Request) {
  const brand = await getBrand();
  const bad = (code: string) => NextResponse.redirect(`${brand.url}/login?error=${code}`);
  const url = new URL(req.url);
  const cookies = Object.fromEntries((req.headers.get("cookie") ?? "").split(/;\s*/).map((c) => c.split("=") as [string, string]));
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  if (!code || !cookies.g_state || !safeEqual(state, cookies.g_state)) return bad("google");

  const ip = fromHeaders(req.headers).ip;
  if (!(await rateLimit(`google:${ip}`, 20, 600))) return bad("google");

  const clientId = await getSetting("google_client_id");
  const enc = await getSetting("google_client_secret");
  if (!clientId || !enc) return bad("google");

  let profile: GoogleUser;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: decrypt(enc), redirect_uri: `${brand.url}/api/auth/google/callback`, grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenRes.ok) return bad("google");
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    if (!access_token) return bad("google");
    const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!info.ok) return bad("google");
    profile = (await info.json()) as GoogleUser;
  } catch {
    return bad("google");
  }
  const email = (profile.email ?? "").toLowerCase();
  if (!profile.sub || !email || !profile.email_verified) return bad("google");

  let user = await queryOne<{ id: number; status: string }>("SELECT id, status FROM users WHERE google_id = ?", [profile.sub]);
  if (!user) {
    const byEmail = await queryOne<{ id: number; status: string }>("SELECT id, status FROM users WHERE email = ?", [email]);
    if (byEmail) {
      // Google has verified this address, so it is safe to link to the existing account.
      await exec("UPDATE users SET google_id = ?, email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()) WHERE id = ?", [profile.sub, byEmail.id]);
      user = byEmail;
    } else {
      const reg = await getSetting("registration_enabled");
      if (reg === "0") return bad("closed");
      const username = await freeUsername(email);
      const res = await exec(
        "INSERT INTO users (email, username, google_id, role, email_verified_at) VALUES (?, ?, ?, 'user', UTC_TIMESTAMP())",
        [email, username, profile.sub],
      );
      await ensurePage(res.insertId, profile.name || username);
      user = { id: res.insertId, status: "active" };
    }
  }
  if (user.status !== "active") return bad("suspended");
  await exec("UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?", [user.id]);
  await createSession(user.id);
  const res = NextResponse.redirect(`${brand.url}${safeNext(cookies.g_next ? decodeURIComponent(cookies.g_next) : null)}`);
  res.cookies.delete({ name: "g_state", path: "/api/auth/google" });
  res.cookies.delete({ name: "g_next", path: "/api/auth/google" });
  return res;
}
