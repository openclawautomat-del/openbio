import { exec, query, queryOne, withTx } from "./db";
import type { AuditEntry, DomainRow, DomainStore } from "./domain-service.ts";

interface Raw extends Omit<DomainRow, "is_default" | "last_check_ok"> { is_default: number; last_check_ok: number | null }
const COLS = "id, hostname, label, status, is_default, note, last_check_at, last_check_ok, last_check_error, override_by, activated_at";
const map = (r: Raw): DomainRow => ({ ...r, is_default: !!r.is_default, last_check_ok: r.last_check_ok === null ? null : !!r.last_check_ok });

const writeAudit = (run: typeof exec, a: AuditEntry) =>
  run("INSERT INTO audit_log (actor_id, action, target, meta) VALUES (?, ?, ?, ?)", [a.actor, a.action, a.target ?? null, a.meta ? JSON.stringify(a.meta) : null]);

export const mysqlDomainStore: DomainStore = {
  async list() { return (await query<Raw>(`SELECT ${COLS} FROM site_domains ORDER BY is_default DESC, hostname`)).map(map); },
  async get(id) { const r = await queryOne<Raw>(`SELECT ${COLS} FROM site_domains WHERE id = ?`, [id]); return r ? map(r) : null; },
  async getByHost(h) { const r = await queryOne<Raw>(`SELECT ${COLS} FROM site_domains WHERE hostname = ?`, [h]); return r ? map(r) : null; },
  async insert(v) {
    const res = await exec("INSERT INTO site_domains (hostname, label, status, is_default, note) VALUES (?, ?, ?, ?, ?)", [v.hostname, v.label, v.status, v.is_default ? 1 : 0, v.note ?? null]);
    return (await this.get(res.insertId))!;
  },
  async update(id, patch) {
    const sets: string[] = []; const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (!/^[a-z_]+$/.test(k)) continue;
      sets.push(`${k} = ?`);
      vals.push(typeof v === "boolean" ? (v ? 1 : 0) : v === undefined ? null : v);
    }
    if (sets.length) await exec(`UPDATE site_domains SET ${sets.join(", ")} WHERE id = ?`, [...vals, id]);
  },
  async remove(id) { await exec("DELETE FROM site_domains WHERE id = ? AND is_default = 0", [id]); },
  /** One transaction: lock rows, require the target to be active, clear the old default, set the new one, audit. */
  async swapDefault(id, a) {
    await withTx(async (tx) => {
      const [t] = await tx.query<{ status: string }>("SELECT status FROM site_domains WHERE id = ? FOR UPDATE", [id]);
      if (!t) throw new Error("Domain not found.");
      if (t.status !== "active") throw new Error("Only an active domain can become the default.");
      await tx.exec("UPDATE site_domains SET is_default = 0 WHERE is_default = 1");
      await tx.exec("UPDATE site_domains SET is_default = 1 WHERE id = ?", [id]);
      await writeAudit(tx.exec, a);
    });
  },
  async audit(e) { await writeAudit(exec, e); },
};
