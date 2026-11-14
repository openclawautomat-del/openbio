import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { getBrand, shortUrl } from "@/lib/brand";
import { qrPng, qrSvg } from "@/lib/qr";
import { rateLimit } from "@/lib/ratelimit";
import { fromHeaders } from "@/lib/request";
import { ipHash } from "@/lib/crypto";
import { safeImageUrl } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Public QR images for short links and bio pages. Only this site's own URLs can be encoded,
 * so the endpoint cannot be used as a generic QR service.
 * GET /api/qr?slug=name&format=svg|png&fg=%23000000&bg=%23ffffff&size=512&logo=https://...
 */
export async function GET(req: Request) {
  const info = fromHeaders(req.headers);
  if (!(await rateLimit(`qr:${ipHash(info.ip)}`, 120, 60))) return new NextResponse("Too many requests", { status: 429 });
  const u = new URL(req.url);
  const slug = (u.searchParams.get("slug") ?? "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(slug)) return new NextResponse("Bad slug", { status: 400 });
  const exists = (await queryOne("SELECT 1 FROM links WHERE slug = ?", [slug])) || (await queryOne("SELECT 1 FROM users WHERE username = ?", [slug]));
  if (!exists) return new NextResponse("Not found", { status: 404 });
  const brand = await getBrand();
  const target = shortUrl(brand, slug) + (u.searchParams.get("src") === "qr" ? "?utm_source=qr" : "");
  const logoRaw = u.searchParams.get("logo") ?? "";
  const opts = {
    fg: u.searchParams.get("fg") ?? undefined,
    bg: u.searchParams.get("bg") ?? undefined,
    size: Number(u.searchParams.get("size") ?? 512) || 512,
    logo: logoRaw && safeImageUrl(logoRaw) ? logoRaw : undefined,
  };
  const download: Record<string, string> = u.searchParams.get("download") ? { "Content-Disposition": `attachment; filename="${slug}-qr.${u.searchParams.get("format") === "png" ? "png" : "svg"}"` } : {};
  const headers: Record<string, string> = { "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff", ...download };
  if (u.searchParams.get("format") === "png") {
    const png = await qrPng(target, opts);
    return new NextResponse(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png" } });
  }
  return new NextResponse(qrSvg(target, opts), { headers: { ...headers, "Content-Type": "image/svg+xml; charset=utf-8", "Content-Security-Policy": "default-src 'none'; img-src https: data: 'self'; style-src 'unsafe-inline'" } });
}
