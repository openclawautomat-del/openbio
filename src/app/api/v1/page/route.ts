import { NextResponse } from "next/server";
import { apiError, authApi, jsonBody } from "@/lib/api";
import { ensurePage, getBlocks, updateProfile } from "@/lib/services/pages";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await authApi(req);
  if ("res" in a) return a.res;
  const page = await ensurePage(a.user.id);
  const blocks = await getBlocks(page.id);
  return NextResponse.json({ data: { username: a.user.username, page, blocks } });
}

export async function PATCH(req: Request) {
  const a = await authApi(req);
  if ("res" in a) return a.res;
  const body = await jsonBody(req);
  if (!body) return apiError(400, "Send a JSON object.");
  const r = await updateProfile(a.user.id, body);
  if (!r.ok) return apiError(422, "Validation failed.", { fields: r.errors });
  return NextResponse.json({ data: await ensurePage(a.user.id) });
}
