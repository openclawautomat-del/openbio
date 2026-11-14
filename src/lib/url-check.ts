import net from "node:net";

export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  const kind = net.isIP(h);
  if (kind === 4) {
    const [a, b] = h.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (kind === 6) {
    return h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:");
  }
  // Decimal / hex IP tricks such as http://2130706433
  if (/^\d+$/.test(h) || /^0x[0-9a-f]+$/i.test(h)) return true;
  return false;
}

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

/** Accepts only public http(s) URLs. Blocks credentials, private/loopback hosts (SSRF), and own-host loops. */
export function checkTargetUrl(raw: string, ownHost?: string): UrlCheck {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, error: "Enter a full URL starting with https://" };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, error: "Only http and https links are allowed." };
  if (u.username || u.password) return { ok: false, error: "URLs with embedded credentials are not allowed." };
  if (isPrivateHost(u.hostname)) return { ok: false, error: "Links to private or local addresses are not allowed." };
  if (ownHost && u.host.toLowerCase() === ownHost.toLowerCase()) return { ok: false, error: "A short link cannot point back to this site." };
  if (u.href.length > 2048) return { ok: false, error: "That URL is too long." };
  return { ok: true, url: u.href };
}

export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

