import { redirect } from "next/navigation";
import { dbConfigured, query } from "./db";

const g = globalThis as unknown as { __installed?: boolean };

/** True once the installer created the super admin. Cached after the first positive answer. */
export async function isInstalled(): Promise<boolean> {
  if (g.__installed) return true;
  if (!dbConfigured()) return false;
  try {
    const r = await query<{ v: string | null }>("SELECT `value` AS v FROM settings WHERE `key` = 'installed'");
    if (r[0]?.v === "1") {
      g.__installed = true;
      return true;
    }
  } catch {
    /* tables missing */
  }
  return false;
}

export async function ensureInstalled(): Promise<void> {
  if (!(await isInstalled())) redirect("/install");
}
