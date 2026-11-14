// Starts a lightweight in-process worker for the email queue (no cron needed on shared hosting).
// The positive runtime check keeps Node-only code out of the edge bundle.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWorkers } = await import("./instrumentation-node");
    startWorkers();
  }
}
