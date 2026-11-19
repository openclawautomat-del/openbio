/** Tiny LRU cache with a per-entry TTL. Map keeps insertion order, so the first key is the least recently used. */
export class LRU<V> {
  private m = new Map<string, { v: V; exp: number }>();
  private max: number;
  private ttlMs: number;
  private now: () => number;
  constructor(max = 500, ttlMs = 15_000, now: () => number = Date.now) {
    this.max = max; this.ttlMs = ttlMs; this.now = now;
  }

  get(k: string): V | undefined {
    const e = this.m.get(k);
    if (!e) return undefined;
    if (e.exp <= this.now()) { this.m.delete(k); return undefined; }
    this.m.delete(k); this.m.set(k, e); // refresh recency
    return e.v;
  }
  has(k: string): boolean { return this.get(k) !== undefined; }
  set(k: string, v: V, ttlMs = this.ttlMs): void {
    this.m.delete(k);
    this.m.set(k, { v, exp: this.now() + ttlMs });
    while (this.m.size > this.max) this.m.delete(this.m.keys().next().value as string);
  }
  delete(k: string): void { this.m.delete(k); }
  clear(): void { this.m.clear(); }
  get size(): number { return this.m.size; }
}
