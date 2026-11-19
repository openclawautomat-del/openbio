import { processQueue } from "./lib/email/mailer";
import { purgeExpired } from "./lib/auth";
import { flushClicks } from "./lib/analytics";
import { recheckLinks } from "./lib/services/safety";

/** Node-only background timers: email queue every minute, expired sessions/tokens every 6 hours, link safety re-check every 6 hours. */
export function startWorkers() {
  if (!process.env.DB_NAME) return;
  setInterval(() => void processQueue().catch(() => {}), 60_000).unref();
  setInterval(() => void purgeExpired().catch(() => {}), 6 * 3600_000).unref();
  setTimeout(() => void recheckLinks().catch(() => {}), 2 * 60_000).unref();
  setInterval(() => void recheckLinks().catch(() => {}), 6 * 3600_000).unref();
  // Queued analytics are written out before the process exits (deploys and restarts send SIGTERM).
  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.once(sig, () => {
      const t = setTimeout(() => process.exit(0), 3000);
      void flushClicks().catch(() => {}).finally(() => { clearTimeout(t); process.exit(0); });
    });
  }
}
