import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { MAX_UPLOAD, sniffImage, storeImage } from "@/lib/uploads";
import { sameOrigin } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req, process.env.APP_URL || "http://localhost:3000")) return NextResponse.json({ error: "Bad origin." }, { status: 403 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await rateLimit(`upload:${user.id}`, 30, 3600))) return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_UPLOAD + 4096) return NextResponse.json({ error: "Image is larger than 2 MB." }, { status: 413 });
  let file: File | null = null;
  try {
    const fd = await req.formData();
    const f = fd.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "Could not read the upload." }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
  if (file.size > MAX_UPLOAD) return NextResponse.json({ error: "Image is larger than 2 MB." }, { status: 413 });
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniffImage(buf);
  if (!kind) return NextResponse.json({ error: "Use a PNG, JPEG, GIF or WebP image." }, { status: 415 });
  const url = await storeImage(buf, kind.ext, kind.mime);
  return NextResponse.json({ url });
}
