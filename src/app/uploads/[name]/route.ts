import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { MIME_BY_EXT, uploadDir } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/** Serves files from UPLOAD_DIR. Files added after build are not part of the standalone public folder, so they go through here. */
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-f0-9]{24}\.(png|jpg|gif|webp)$/.test(name)) return new NextResponse("Not found", { status: 404 });
  try {
    const buf = await fs.readFile(path.join(uploadDir(), name));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME_BY_EXT[name.split(".")[1]],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
