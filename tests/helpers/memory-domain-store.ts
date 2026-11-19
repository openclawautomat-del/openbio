import type { AuditEntry, DomainRow, DomainStore } from "../../src/lib/domain-service.ts";

/** In-memory DomainStore with the same invariants as the MySQL one: unique hostnames, at most one default. */
export class MemoryDomainStore implements DomainStore {
  rows: DomainRow[] = [];
  audits: AuditEntry[] = [];
  private seq = 0;
  async list() { return this.rows.map((r) => ({ ...r })).sort((a, b) => a.id - b.id); }
  async get(id: number) { const r = this.rows.find((x) => x.id === id); return r ? { ...r } : null; }
  async getByHost(h: string) { const r = this.rows.find((x) => x.hostname === h); return r ? { ...r } : null; }
  async insert(v: { hostname: string; label: string | null; status: DomainRow["status"]; is_default?: boolean; note?: string | null }) {
    if (this.rows.some((r) => r.hostname === v.hostname)) throw new Error("duplicate hostname");
    const row: DomainRow = { id: ++this.seq, hostname: v.hostname, label: v.label, status: v.status, is_default: !!v.is_default, note: v.note ?? null, last_check_at: null, last_check_ok: null, last_check_error: null, override_by: null, activated_at: null };
    this.rows.push(row);
    return { ...row };
  }
  async update(id: number, patch: Partial<DomainRow>) { Object.assign(this.rows.find((r) => r.id === id)!, patch); }
  async remove(id: number) { this.rows = this.rows.filter((r) => r.id !== id); }
  async swapDefault(id: number, a: AuditEntry) {
    const next = this.rows.find((r) => r.id === id);
    if (!next) throw new Error("missing");
    for (const r of this.rows) r.is_default = false;
    next.is_default = true;
    this.audits.push(a);
  }
  async audit(e: AuditEntry) { this.audits.push(e); }
}
