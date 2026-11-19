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

/** Well-known public shorteners. A short link must not chain through one of these. */
export const SHORTENER_HOSTS = [
  "bit.ly", "t.co", "tinyurl.com", "goo.gl", "ow.ly", "is.gd", "v.gd", "buff.ly", "rebrand.ly", "cutt.ly",
  "shorturl.at", "tiny.cc", "bit.do", "t.ly", "rb.gy", "lnkd.in", "s.id", "shorte.st", "adf.ly", "bl.ink", "soo.gd", "clck.ru",
];

const hostMatches = (host: string, list: Iterable<string>) => {
  for (const d of list) {
    const x = String(d).toLowerCase().replace(/^\.+/, "");
    if (x && (host === x || host.endsWith("." + x))) return true;
  }
  return false;
};

/**
 * Accepts only public http(s) URLs. Rejects credentials, raw IP addresses, localhost and private ranges (SSRF),
 * redirect loops to our own hosts and chaining through public shorteners.
 * `own` is one host or all hosts this install answers on (default domain, active domains, APP_URL host).
 */
export function checkTargetUrl(raw: string, own?: string | string[]): UrlCheck {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, error: "Enter a full URL starting with https://" };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, error: "Only http and https links are allowed." };
  if (u.username || u.password) return { ok: false, error: "URLs with embedded credentials are not allowed." };
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (isPrivateHost(host)) return { ok: false, error: "Links to private or local addresses are not allowed." };
  if (net.isIP(host.replace(/^\[|\]$/g, "")) || /^\[.*\]$/.test(host)) return { ok: false, error: "Links to raw IP addresses are not allowed. Use a domain name." };
  if (!host.includes(".")) return { ok: false, error: "Enter a full domain name such as example.com." };
  const owns = (Array.isArray(own) ? own : own ? [own] : []).map((h) => h.toLowerCase().replace(/:\d+$/, ""));
  if (owns.length && owns.includes(host)) return { ok: false, error: "A short link cannot point back to this site." };
  if (hostMatches(host, SHORTENER_HOSTS)) return { ok: false, error: "Links to other URL shorteners are not allowed. Use the final address." };
  if (u.href.length > 2048) return { ok: false, error: "That URL is too long." };
  return { ok: true, url: u.href };
}

export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

