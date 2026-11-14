import { NextResponse } from "next/server";
import { authApi, num } from "@/lib/api";
import { getStats } from "@/lib/analytics";

export const dynamic = "force-dynamic";

/** Account-wide stats. Query: kind=clicks (default) or views, days=1..365. */
export async function GET(req: Request) {
  const a = await authApi(req);
  if ("res" in a) return a.res;
  const u = new URL(req.url);
  const days = Math.min(365, num(u.searchParams.get("days"), 30));
  const kind = u.searchParams.get("kind") === "views" ? "views" : "clicks";
  return NextResponse.json({ data: await getStats({ userId: a.user.id, kind, days }) });
}
