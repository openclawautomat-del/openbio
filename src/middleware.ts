import { NextResponse, type NextRequest } from "next/server";

/**
 * Phase 2 custom domains. The edge runtime cannot reach MySQL, so this only decides whether the request
 * arrived on a host other than the app's own. The root path of such a host is rewritten to /domain, a
 * Node route that looks the host up in the verified-domains table. Remove this file (or set
 * FEATURE_PHASE2=0) and everything else keeps working.
 */
export function middleware(req: NextRequest) {
  if (["0", "false"].includes((process.env.FEATURE_PHASE2 || "").toLowerCase())) return NextResponse.next();
  if (req.nextUrl.pathname !== "/") return NextResponse.next();
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase().split(":")[0];
  let appHost = "";
  try {
    const raw = (process.env.APP_URL || "http://localhost:3000").trim();
    appHost = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {}
  if (!host || host === appHost || host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/domain";
  return NextResponse.rewrite(url);
}

export const config = { matcher: ["/"] };
