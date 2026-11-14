import { exec, query, queryOne } from "./db";
import { visitorHash } from "./crypto";
import type { ReqInfo } from "./request";

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|uptime|curl|wget|python-requests|httpclient|headless|lighthouse|pingdom|go-http|node-fetch|axios|okhttp|scrapy|bingpreview|embedly|whatsapp|telegrambot|discordbot|slackbot/i;

export const isBot = (ua: string) => !ua || BOT_RE.test(ua);

export function parseUA(ua: string): { device: string; browser: string; os: string } {
  const device = /ipad|tablet|(android(?!.*mobile))/i.test(ua) ? "tablet" : /mobi|iphone|android/i.test(ua) ? "mobile" : "desktop";
  const browser =
    /edg\//i.test(ua) ? "Edge" : /opr\/|opera/i.test(ua) ? "Opera" : /samsungbrowser/i.test(ua) ? "Samsung" :
    /firefox|fxios/i.test(ua) ? "Firefox" : /chrome|crios/i.test(ua) ? "Chrome" : /safari/i.test(ua) ? "Safari" : "Other";
  const os =
    /windows/i.test(ua) ? "Windows" : /iphone|ipad|ios/i.test(ua) ? "iOS" : /android/i.test(ua) ? "Android" :
    /mac os/i.test(ua) ? "macOS" : /cros/i.test(ua) ? "ChromeOS" : /linux/i.test(ua) ? "Linux" : "Other";
  return { device, browser, os };
}

export function refHost(referer: string, ownHost: string): string | null {
  if (!referer) return null;
  try {
    const h = new URL(referer).hostname.replace(/^www\./, "");
    return h === ownHost.replace(/^www\./, "").split(":")[0] ? null : h.slice(0, 190);
  } catch {
    return null;
  }
}

export interface ClickInput {
  type: "link" | "block" | "page";
  id: number;
  userId: number;
  info: ReqInfo;
  ownHost: string;
  utm?: { source?: string; medium?: string; campaign?: string };
}

/** Records one hit. Bots are dropped; IPs are never stored, only a daily-rotating salted hash. */
export async function recordClick(c: ClickInput): Promise<void> {
  if (isBot(c.info.ua)) return;
  try {
    const vh = visitorHash(c.info.ip, c.info.ua);
    const seen = await queryOne("SELECT 1 FROM clicks WHERE entity_type = ? AND entity_id = ? AND visitor_hash = ? LIMIT 1", [c.type, c.id, vh]);
    const { device, browser, os } = parseUA(c.info.ua);
    const cut = (v?: string) => (v ? v.slice(0, 100) : null);
    await exec(
      `INSERT INTO clicks (entity_type, entity_id, user_id, visitor_hash, is_unique, country, device, browser, os, referrer, utm_source, utm_medium, utm_campaign)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.type, c.id, c.userId, vh, seen ? 0 : 1, c.info.country, device, browser, os, refHost(c.info.referer, c.ownHost),
        cut(c.utm?.source), cut(c.utm?.medium), cut(c.utm?.campaign)],
    );
  } catch {
    // Analytics must never break a redirect.
  }
}

export interface Scope {
  userId?: number; // omit for site-wide (admin)
  entityType?: "link" | "block" | "page";
  entityId?: number;
  kind?: "clicks" | "views"; // clicks = link+block, views = page
  days: number;
}

function where(s: Scope): { sql: string; params: unknown[] } {
  const parts = ["created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)"];
  const params: unknown[] = [Math.max(1, Math.min(365, s.days | 0))];
  if (s.userId) { parts.push("user_id = ?"); params.push(s.userId); }
  if (s.entityType) { parts.push("entity_type = ?"); params.push(s.entityType); }
  else if (s.kind === "views") parts.push("entity_type = 'page'");
  else if (s.kind === "clicks") parts.push("entity_type IN ('link','block')");
  if (s.entityId) { parts.push("entity_id = ?"); params.push(s.entityId); }
  return { sql: parts.join(" AND "), params };
}

export interface Stats {
  total: number;
  unique: number;
  series: { day: string; total: number; unique: number }[];
  countries: { label: string; n: number }[];
  devices: { label: string; n: number }[];
  browsers: { label: string; n: number }[];
  referrers: { label: string; n: number }[];
  campaigns: { label: string; n: number }[];
}

async function breakdown(col: string, w: { sql: string; params: unknown[] }, unknownLabel: string) {
  const rows = await query<{ label: string | null; n: number }>(
    `SELECT ${col} AS label, COUNT(*) AS n FROM clicks WHERE ${w.sql} GROUP BY ${col} ORDER BY n DESC LIMIT 8`,
    w.params,
  );
  return rows.map((r) => ({ label: r.label || unknownLabel, n: Number(r.n) }));
}

export async function getStats(s: Scope): Promise<Stats> {
  const w = where(s);
  const t = await queryOne<{ total: number; uniq: number }>(
    `SELECT COUNT(*) AS total, COALESCE(SUM(is_unique),0) AS uniq FROM clicks WHERE ${w.sql}`, w.params,
  );
  const rows = await query<{ d: string; total: number; uniq: number }>(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS total, COALESCE(SUM(is_unique),0) AS uniq
       FROM clicks WHERE ${w.sql} GROUP BY d ORDER BY d`, w.params,
  );
  const map = new Map(rows.map((r) => [r.d, r]));
  const series: Stats["series"] = [];
  const days = Math.max(1, Math.min(365, s.days | 0));
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    const r = map.get(d);
    series.push({ day: d, total: Number(r?.total ?? 0), unique: Number(r?.uniq ?? 0) });
  }
  const [countries, devices, browsers, referrers, campaigns] = await Promise.all([
    breakdown("country", w, "Unknown"),
    breakdown("device", w, "Unknown"),
    breakdown("browser", w, "Unknown"),
    breakdown("referrer", w, "Direct"),
    breakdown("utm_campaign", w, "No campaign"),
  ]);
  return { total: Number(t?.total ?? 0), unique: Number(t?.uniq ?? 0), series, countries, devices, browsers, referrers, campaigns };
}

/** Per-entity click totals for list views, in one query. */
export async function totalsFor(type: "link" | "block", ids: number[]): Promise<Record<number, { total: number; unique: number }>> {
  if (!ids.length) return {};
  const ph = ids.map(() => "?").join(",");
  const rows = await query<{ entity_id: number; total: number; uniq: number }>(
    `SELECT entity_id, COUNT(*) AS total, SUM(is_unique) AS uniq FROM clicks WHERE entity_type = ? AND entity_id IN (${ph}) GROUP BY entity_id`,
    [type, ...ids],
  );
  return Object.fromEntries(rows.map((r) => [r.entity_id, { total: Number(r.total), unique: Number(r.uniq) }]));
}

const COUNTRY_NAMES = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
export function countryName(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try { return COUNTRY_NAMES?.of(code) ?? code; } catch { return code; }
}
