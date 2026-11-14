import { NextResponse } from "next/server";
import { getBrand } from "@/lib/brand";
import { getSetting } from "@/lib/settings";
import { randomToken } from "@/lib/crypto";
import { safeNext } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Starts Google sign-in. Only works when the owner has saved a client ID in the admin settings. */
export async function GET(req: Request) {
  const clientId = await getSetting("google_client_id");
  const brand = await getBrand();
  if (!clientId) return NextResponse.redirect(`${brand.url}/login`);
  const state = randomToken(24);
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${brand.url}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  const res = NextResponse.redirect(url);
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: brand.url.startsWith("https://"), path: "/api/auth/google", maxAge: 600 };
  res.cookies.set("g_state", state, opts);
  res.cookies.set("g_next", next, opts);
  return res;
}
