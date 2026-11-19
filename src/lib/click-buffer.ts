/**
 * Batches analytics writes so a redirect never waits for the database.
 * Flushes every `intervalMs`, when `maxEvents` are queued, and on `stop()` (process shutdown).
 */
export interface BufferOpts { maxEvents?: number; intervalMs?: number; maxQueue?: number }

export class ClickBuffer<T> {
  private q: T[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing: Promise<void> | null = null;
  private opts: Required<BufferOpts>;
  private write: (batch: T[]) => Promise<void>;
  constructor(write: (batch: T[]) => Promise<void>, o: BufferOpts = {}) {
    this.write = write;
    this.opts = { maxEvents: o.maxEvents ?? 50, intervalMs: o.intervalMs ?? 5000, maxQueue: o.maxQueue ?? 5000 };
  }

  push(item: T): void {
    if (this.q.length >= this.opts.maxQueue) this.q.shift(); // shed the oldest rather than grow without bound
    this.q.push(item);
    if (this.q.length >= this.opts.maxEvents) void this.flush();
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), this.opts.intervalMs);
    (this.timer as { unref?: () => void }).unref?.();
  }

  async flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (!this.q.length) return;
    const batch = this.q.splice(0, this.q.length);
    this.flushing = this.write(batch)
      .catch(() => { // keep the batch for one more try, bounded by maxQueue
        this.q.unshift(...batch.slice(-this.opts.maxQueue));
      })
      .finally(() => { this.flushing = null; });
    return this.flushing;
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.flush();
  }
  get pending(): number { return this.q.length; }
}
