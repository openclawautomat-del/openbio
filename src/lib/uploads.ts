import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getSettings } from "./settings";
import { decrypt } from "./crypto";

export const MAX_UPLOAD = 2 * 1024 * 1024;

export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));
}

const SIGNATURES: { ext: string; mime: string; test: (b: Buffer) => boolean }[] = [
  { ext: "png", mime: "image/png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "gif", mime: "image/gif", test: (b) => b.subarray(0, 4).toString("latin1") === "GIF8" },
  { ext: "webp", mime: "image/webp", test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
];

/** Detects the real image type from magic bytes. SVG is refused on purpose: it can carry scripts. */
export function sniffImage(buf: Buffer) {
  return SIGNATURES.find((s) => s.test(buf)) ?? null;
}

export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(SIGNATURES.map((s) => [s.ext, s.mime]));

function hmacSha256(key: Buffer | string, data: string) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

/** Minimal AWS Signature V4 PUT so S3-compatible storage works without the AWS SDK. */
async function putS3(key: string, body: Buffer, contentType: string, s: Record<string, string>): Promise<string> {
  const endpoint = (s.s3_endpoint || `https://s3.${s.s3_region || "us-east-1"}.amazonaws.com`).replace(/\/+$/, "");
  const url = new URL(`${endpoint}/${s.s3_bucket}/${key}`);
  const region = s.s3_region || "us-east-1";
  const now = new Date();
  const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amz.slice(0, 8);
  const payloadHash = crypto.createHash("sha256").update(body).digest("hex");
  const headers: Record<string, string> = { host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amz, "content-type": contentType };
  const signed = Object.keys(headers).sort();
  const canonical = ["PUT", url.pathname, "", ...signed.map((h) => `${h}:${headers[h]}`), "", signed.join(";"), payloadHash].join("\n");
  const scope = `${date}/${region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amz, scope, crypto.createHash("sha256").update(canonical).digest("hex")].join("\n");
  const secret = s.s3_secret ? decrypt(s.s3_secret) : "";
  const kSigning = hmacSha256(hmacSha256(hmacSha256(hmacSha256("AWS4" + secret, date), region), "s3"), "aws4_request");
  const sig = crypto.createHmac("sha256", kSigning).update(toSign).digest("hex");
  const res = await fetch(url, {
    method: "PUT",
    body: new Uint8Array(body),
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${s.s3_key}/${scope}, SignedHeaders=${signed.join(";")}, Signature=${sig}`,
    },
  });
  if (!res.ok) throw new Error(`S3 upload failed (${res.status})`);
  const pub = (s.s3_public_url || `${endpoint}/${s.s3_bucket}`).replace(/\/+$/, "");
  return `${pub}/${key}`;
}

/** Stores a validated image and returns its public URL. Uses S3 only when the owner configured it in admin settings. */
export async function storeImage(buf: Buffer, ext: string, mime: string): Promise<string> {
  const name = `${crypto.randomBytes(12).toString("hex")}.${ext}`;
  const s = await getSettings();
  if (s.s3_bucket && s.s3_key && s.s3_secret) return putS3(`uploads/${name}`, buf, mime, s);
  const dir = uploadDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buf, { mode: 0o644 });
  return `/uploads/${name}`;
}
