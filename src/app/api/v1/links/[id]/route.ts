import { NextResponse } from "next/server";
import { apiError, authApi, jsonBody, linkJson } from "@/lib/api";
import { getBrand } from "@/lib/brand";
import { deleteLink, getLinkForUser, updateLink } from "@/lib/services/links";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function parse(ctx: Ctx) {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(req: Request, ctx: Ctx) {
  const a = await authApi(req);
  if ("res" in a) return a.res;
  const id = await parse(ctx);
  const l = id ? await getLinkForUser(a.user.id, id) : null;
  if (!l) return apiError(404, "Link not found.");
  return NextResponse.json({ data: linkJson(l, (await getBrand()).url) });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const a = await authApi(req);
  if ("res" in a) return a.res;
  const id = await parse(ctx);
  const body = await jsonBody(req);
  if (!id) return apiError(404, "Link not found.");
  if (!body) return apiError(400, "Send a JSON object.");
  const b = await getBrand();
  const r = await updateLink(a.user.id, id, b.host, body);
  if (!r.ok) return r.errors.form ? apiError(404, r.errors.form) : apiError(422, "Validation failed.", { fields: r.errors });
  return NextResponse.json({ data: linkJson(r.data, b.url) });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const a = await authApi(req);
  if ("res" in a) return a.res;
  const id = await parse(ctx);
  if (!id || !(await deleteLink(a.user.id, id))) return apiError(404, "Link not found.");
  return new NextResponse(null, { status: 204 });
}
