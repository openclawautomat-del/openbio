import { NextResponse } from "next/server";
import { fromHeaders } from "@/lib/request";
import { submitReport } from "@/lib/services/reports";

export const dynamic = "force-dynamic";

/** Public, unauthenticated, rate limited. Body: {"target":"slug or URL","reason":"phishing","details":"..."} (JSON or form). */
export async function POST(req: Request) {
  let body: unknown = null;
  const type = req.headers.get("content-type") || "";
  try {
    body = type.includes("application/json") ? await req.json() : Object.fromEntries(await req.formData());
  } catch {
    return NextResponse.json({ error: "Send JSON or form fields: target, reason, details." }, { status: 400 });
  }
  const r = await submitReport(body, fromHeaders(req.headers).ip);
  if (!r.ok) return NextResponse.json({ error: "Report not accepted.", fields: r.errors }, { status: r.status, headers: r.status === 429 ? { "Retry-After": "3600" } : undefined });
  return NextResponse.json({ ok: true }, { status: 202 });
}
