import crypto from "node:crypto";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be set (16+ characters).");
    return "dev-only-insecure-secret-change-me";
  }
  return s;
}

export function sha256(v: string): string {
  return crypto.createHash("sha256").update(v).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hmac(v: string, purpose: string): string {
  return crypto.createHmac("sha256", secret()).update(`${purpose}:${v}`).digest("hex");
}

/** Privacy-friendly visitor id: salted with a daily-rotating value so it can't track across days. */
export function visitorHash(ip: string, ua: string, day = new Date().toISOString().slice(0, 10)): string {
  return hmac(`${ip}|${ua}|${day}`, "visitor").slice(0, 16);
}

export function ipHash(ip: string): string {
  return hmac(ip, "ip").slice(0, 16);
}

function key(): Buffer {
  return crypto.createHash("sha256").update(`enc:${secret()}`).digest();
}

/** AES-256-GCM for secrets stored in the DB (SMTP passwords, OAuth secrets). */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, enc] = payload.split(".");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64")), d.final()]).toString("utf8");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
