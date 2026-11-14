import { query, exec, dbConfigured } from "./db";

type SettingsMap = Record<string, string>;
const g = globalThis as unknown as { __settings?: { at: number; data: SettingsMap } };
const TTL_MS = 10_000;

export async function getSettings(): Promise<SettingsMap> {
  if (!dbConfigured()) return {};
  const c = g.__settings;
  if (c && Date.now() - c.at < TTL_MS) return c.data;
  try {
    const rows = await query<{ key: string; value: string | null }>("SELECT `key`, `value` FROM settings");
    const data: SettingsMap = {};
    for (const r of rows) data[r.key] = r.value ?? "";
    g.__settings = { at: Date.now(), data };
    return data;
  } catch {
    // Table may not exist yet (before install).
    return {};
  }
}

export async function getSetting(key: string): Promise<string | undefined> {
  const s = await getSettings();
  const v = s[key];
  return v === "" ? undefined : v;
}

export async function setSettings(values: Record<string, string>): Promise<void> {
  for (const [k, v] of Object.entries(values)) {
    await exec(
      "INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
      [k, v],
    );
  }
  g.__settings = undefined;
}

export async function flag(key: string, fallback: boolean): Promise<boolean> {
  const v = await getSetting(key);
  if (v === undefined) return fallback;
  return v === "1" || v === "true";
}
