import { processQueue } from "./lib/email/mailer";
import { purgeExpired } from "./lib/auth";

/** Node-only background timers: email queue every minute, expired sessions/tokens every 6 hours. */
export function startWorkers() {
  if (!process.env.DB_NAME) return;
  setInterval(() => void processQueue().catch(() => {}), 60_000).unref();
  setInterval(() => void purgeExpired().catch(() => {}), 6 * 3600_000).unref();
}
