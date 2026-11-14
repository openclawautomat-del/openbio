import { headers } from "next/headers";

export interface ReqInfo {
  ip: string;
  ua: string;
  country: string | null;
  referer: string;
  host: string;
}

export async function reqInfo(): Promise<ReqInfo> {
  const h = await headers();
  return fromHeaders(h);
}

export function fromHeaders(h: Headers): ReqInfo {
  const trust = process.env.TRUST_PROXY !== "false";
  const fwd = h.get("cf-connecting-ip") || h.get("x-real-ip") || (h.get("x-forwarded-for") || "").split(",")[0].trim();
  const ip = trust && fwd ? fwd : "0.0.0.0";
  const cc = (h.get("cf-ipcountry") || h.get("x-vercel-ip-country") || h.get("x-country-code") || "").toUpperCase();
  return {
    ip,
    ua: h.get("user-agent") || "",
    country: /^[A-Z]{2}$/.test(cc) && cc !== "XX" ? cc : null,
    referer: h.get("referer") || "",
    host: (h.get("x-forwarded-host") || h.get("host") || "").toLowerCase(),
  };
}

/** Same-origin check for state-changing route handlers (CSRF defence in depth on top of SameSite=Lax). */
export function sameOrigin(req: Request, appUrl: string): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients (API keys) send no Origin
  try {
    const o = new URL(origin).host;
    const hostHeader = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
    return o === hostHeader || o === new URL(appUrl).host;
  } catch {
    return false;
  }
}
