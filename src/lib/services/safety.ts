import { exec, query } from "../db";
import { checkTargetUrl } from "../url-check";
import { isBlocked } from "../validation";
import { ownHostList } from "../domains";

export type Safe = { ok: true; url: string } | { ok: false; error: string };

/** Google Safe Browsing lookup. Entirely optional: without GOOGLE_SAFE_BROWSING_KEY, or when Google is unreachable, it passes. */
export async function safeBrowsingFlags(urls: string[]): Promise<Set<string>> {
  const key = process.env.GOOGLE_SAFE_BROWSING_KEY;
  const flagged = new Set<string>();
  if (!key || !urls.length) return flagged;
  try {
    const res = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "openbio", clientVersion: "1.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"], threatEntryTypes: ["URL"], threatEntries: urls.slice(0, 500).map((url) => ({ url })),
        },
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return flagged;
    const j = (await res.json()) as { matches?: { threat?: { url?: string } }[] };
    for (const m of j.matches ?? []) if (m.threat?.url) flagged.add(m.threat.url);
  } catch {
    /* fail open: the other checks still apply */
  }
  return flagged;
}

/** Destination safety for every create, edit, import and API call. */
export async function assessDestination(raw: string, ownHost?: string): Promise<Safe> {
  const u = checkTargetUrl(raw, await ownHostList(ownHost));
  if (!u.ok) return u;
  const blocked = await isBlocked(u.url);
  if (blocked) return { ok: false, error: blocked };
  if ((await safeBrowsingFlags([u.url])).has(u.url)) return { ok: false, error: "This destination was reported as unsafe." };
  return u;
}

/**
 * Periodic re-check: links not checked for `olderDays` are tested again against the blocklist, the shortener
 * list, our own hosts and Safe Browsing. Flagged links are switched off (moderated) and show up in the admin queue.
 */
export async function recheckLinks(batch = 100, olderDays = 7): Promise<{ checked: number; flagged: number }> {
  const rows = await query<{ id: number; target_url: string }>(
    "SELECT id, target_url FROM links WHERE (checked_at IS NULL OR checked_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)) AND moderated = 0 ORDER BY checked_at IS NULL DESC, checked_at ASC LIMIT ?",
    [olderDays, batch],
  );
  if (!rows.length) return { checked: 0, flagged: 0 };
  const sb = await safeBrowsingFlags(rows.map((r) => r.target_url));
  const own = await ownHostList();
  let flagged = 0;
  for (const r of rows) {
    let note: string | null = null;
    const c = checkTargetUrl(r.target_url, own);
    if (!c.ok) note = c.error;
    else note = await isBlocked(c.url);
    if (!note && sb.has(r.target_url)) note = "Reported as unsafe by Google Safe Browsing.";
    if (note) {
      flagged++;
      await exec("UPDATE links SET safety_status = 'flagged', safety_note = ?, moderated = 1, checked_at = UTC_TIMESTAMP() WHERE id = ?", [note.slice(0, 190), r.id]);
    } else {
      await exec("UPDATE links SET checked_at = UTC_TIMESTAMP() WHERE id = ?", [r.id]);
    }
  }
  return { checked: rows.length, flagged };
}
