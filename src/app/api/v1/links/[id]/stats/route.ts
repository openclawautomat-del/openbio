import { NextResponse } from "next/server";
import { apiError, authApi, num } from "@/lib/api";
import { getStats } from "@/lib/analytics";
import { getLinkForUser } from "@/lib/services/links";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await authApi(req);
  if ("res" in a) return a.res;
  const id = Number((await ctx.params).id);
  const l = Number.isInteger(id) && id > 0 ? await getLinkForUser(a.user.id, id) : null;
  if (!l) return apiError(404, "Link not found.");
  const days = Math.min(365, num(new URL(req.url).searchParams.get("days"), 30));
  return NextResponse.json({ data: await getStats({ userId: l.user_id, entityType: "link", entityId: l.id, kind: "clicks", days }) });
}
