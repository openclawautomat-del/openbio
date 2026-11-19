import { NextResponse, type NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { guardRequest } from "@/lib/host-guard";
import { fromHeaders } from "@/lib/request";
import { recordClick } from "@/lib/analytics";
import { checkTargetUrl, isBlocked } from "@/lib/validation";
import { blockActive } from "@/lib/services/pages";

export const dynamic = "force-dynamic";

/** Click tracker for bio-page blocks. The target always comes from the database, never from the query string. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked404 = await guardRequest(req);
  if (blocked404) return blocked404;
  const { id } = await ctx.params;
  const blockId = Number(id);
  const b = await getBrand();
  const home = NextResponse.redirect(new URL("/", b.url), 302);
  if (!Number.isInteger(blockId) || blockId < 1) return home;

  const row = await queryOne<{ id: number; url: string | null; enabled: number; starts_at: Date | null; ends_at: Date | null; user_id: number }>(
    `SELECT bl.id, bl.url, bl.enabled, bl.starts_at, bl.ends_at, p.user_id
       FROM blocks bl JOIN pages p ON p.id = bl.page_id JOIN users u ON u.id = p.user_id
      WHERE bl.id = ? AND p.published = 1 AND p.moderated = 0 AND u.status = 'active'`,
    [blockId],
  );
  if (!row || !row.url || !blockActive(row)) return home;
  const ok = checkTargetUrl(row.url);
  if (!ok.ok || (await isBlocked(ok.url))) return home;

  await recordClick({ type: "block", id: row.id, userId: row.user_id, info: fromHeaders(req.headers), ownHost: b.host });
  const res = NextResponse.redirect(ok.url, 302);
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Cache-Control", "no-store");
  return res;
}
