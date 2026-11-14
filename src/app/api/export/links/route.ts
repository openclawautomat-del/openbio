import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { phase2Enabled } from "@/lib/features";
import { toCsv } from "@/lib/csv";
import { getBrand } from "@/lib/brand";

export const dynamic = "force-dynamic";

interface Row {
  slug: string; title: string | null; target_url: string; enabled: number;
  starts_at: Date | null; expires_at: Date | null; created_at: Date; clicks: number; uniques: number;
}

const fmt = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 19).replace("T", " ") : "");

export async function GET() {
  if (!phase2Enabled()) return new NextResponse("Not found", { status: 404 });
  const u = await currentUser();
  if (!u) return new NextResponse("Sign in first", { status: 401 });
  const rows = await query<Row>(
    `SELECT l.slug, l.title, l.target_url, l.enabled, l.starts_at, l.expires_at, l.created_at,
            (SELECT COUNT(*) FROM clicks c WHERE c.entity_type = 'link' AND c.entity_id = l.id) AS clicks,
            (SELECT COALESCE(SUM(c.is_unique), 0) FROM clicks c WHERE c.entity_type = 'link' AND c.entity_id = l.id) AS uniques
       FROM links l WHERE l.user_id = ? ORDER BY l.id LIMIT 50000`, [u.id],
  );
  const brand = await getBrand();
  const csv = toCsv([
    ["target_url", "slug", "title", "starts_at", "expires_at", "enabled", "created_at", "clicks", "unique_clicks"],
    ...rows.map((r) => [r.target_url, r.slug, r.title ?? "", fmt(r.starts_at), fmt(r.expires_at), r.enabled ? "yes" : "no", fmt(r.created_at), Number(r.clicks), Number(r.uniques)]),
  ]);
  const name = brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "links";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-links.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
