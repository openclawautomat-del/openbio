import { NextResponse, type NextRequest } from "next/server";

/**
 * The edge runtime cannot reach MySQL, so the host check itself lives in src/lib/host-guard.ts (Node).
 * All this does is hand the request path to server components under a header the client cannot forge.
 */
export function middleware(req: NextRequest) {
  const h = new Headers(req.headers);
  h.set("x-ob-path", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: h } });
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
