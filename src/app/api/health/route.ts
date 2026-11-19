import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness probe. It answers on EVERY host on purpose: "Check & activate" calls https://<new-domain>/api/health
 * to prove the new subdomain reaches this app over valid HTTPS before it can serve anything.
 * No database access, nothing secret.
 */
export async function GET() {
  return NextResponse.json({ ok: true, app: "openbio" }, { headers: { "Cache-Control": "no-store" } });
}
