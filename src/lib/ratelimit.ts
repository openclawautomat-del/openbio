import { exec, queryOne } from "./db";

/**
 * Fixed-window counter stored in MySQL so limits hold across restarts and processes.
 * Returns true when the action is allowed (and counts it).
 */
export async function rateLimit(bucket: string, max: number, windowSec: number): Promise<boolean> {
  const win = Math.floor(Date.now() / 1000 / windowSec) * windowSec;
  const b = bucket.slice(0, 190);
  await exec(
    "INSERT INTO rate_limits (bucket, window_start, hits) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE hits = hits + 1",
    [b, win],
  );
  const row = await queryOne<{ hits: number }>("SELECT hits FROM rate_limits WHERE bucket = ? AND window_start = ?", [b, win]);
  // Opportunistic cleanup (~1% of calls) keeps the table tiny on shared hosting.
  if (Math.random() < 0.01) {
    exec("DELETE FROM rate_limits WHERE window_start < ?", [Math.floor(Date.now() / 1000) - 86_400]).catch(() => {});
  }
  return (row?.hits ?? 1) <= max;
}
