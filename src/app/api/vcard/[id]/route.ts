import { NextResponse, type NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { fromHeaders } from "@/lib/request";
import { recordClick } from "@/lib/analytics";
import { phase2Enabled } from "@/lib/features";

export const dynamic = "force-dynamic";

/** Escape per RFC 6350 and strip anything that could inject extra vCard lines. */
const esc = (v: string) => v.replace(/[\r\n]+/g, " ").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").slice(0, 200);

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!phase2Enabled()) return new NextResponse("Not found", { status: 404 });
  const { id } = await ctx.params;
  const blockId = Number(id);
  if (!Number.isInteger(blockId) || blockId < 1) return new NextResponse("Not found", { status: 404 });
  const row = await queryOne<{ id: number; title: string | null; url: string | null; data: Record<string, string> | null; user_id: number; display_name: string | null; username: string; avatar_url: string | null }>(
    `SELECT bl.id, bl.title, bl.url, bl.data, p.user_id, p.display_name, p.avatar_url, u.username
       FROM blocks bl JOIN pages p ON p.id = bl.page_id JOIN users u ON u.id = p.user_id
      WHERE bl.id = ? AND bl.type = 'vcard' AND bl.enabled = 1 AND p.published = 1 AND p.moderated = 0 AND u.status = 'active'`,
    [blockId],
  );
  if (!row) return new NextResponse("Not found", { status: 404 });
  const b = await getBrand();
  const d = row.data ?? {};
  const name = row.display_name || row.username;
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${esc(name)}`, `N:${esc(name)};;;;`];
  if (d.org) lines.push(`ORG:${esc(d.org)}`);
  if (d.phone) lines.push(`TEL;TYPE=CELL:${esc(d.phone)}`);
  if (d.email) lines.push(`EMAIL:${esc(d.email)}`);
  lines.push(`URL:${b.url}/${row.username}`);
  if (row.url && /^https?:\/\//i.test(row.url)) lines.push(`URL:${esc(row.url)}`);
  if (d.note) lines.push(`NOTE:${esc(d.note)}`);
  lines.push("END:VCARD");

  await recordClick({ type: "block", id: row.id, userId: row.user_id, info: fromHeaders(req.headers), ownHost: b.host });
  const file = row.username.replace(/[^a-z0-9_-]/gi, "") || "contact";
  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}.vcf"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
