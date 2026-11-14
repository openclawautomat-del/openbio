import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { phase2Enabled } from "@/lib/features";
import { getStats } from "@/lib/analytics";
import { toCsv } from "@/lib/csv";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!phase2Enabled()) return new NextResponse("Not found", { status: 404 });
  const u = await currentUser();
  if (!u) return new NextResponse("Sign in first", { status: 401 });
  if (!(await rateLimit(`export:${u.id}`, 20, 600))) return new NextResponse("Too many exports. Try again in a few minutes.", { status: 429 });

  const q = req.nextUrl.searchParams;
  const days = [7, 30, 90, 365].includes(Number(q.get("days"))) ? Number(q.get("days")) : 30;
  const kind = q.get("view") === "views" ? "views" : "clicks";
  const s = await getStats({ userId: u.id, kind, days });

  const rows: unknown[][] = [
    ["report", kind, `last ${days} days`],
    ["total", s.total], ["unique", s.unique], [],
    ["date", "total", "unique"],
    ...s.series.map((p) => [p.day, p.total, p.unique]),
  ];
  const section = (title: string, list: { label: string; n: number }[]) => {
    rows.push([], [title, "total"], ...list.map((x) => [x.label, x.n]));
  };
  section("country", s.countries); section("device", s.devices); section("browser", s.browsers);
  section("referrer", s.referrers); section("campaign", s.campaigns);

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="analytics-${kind}-${days}d.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
