/**
 * Admin-managed domains. Pure business rules over a `DomainStore`, so the MySQL store and the in-memory test store
 * behave identically. The app never issues certificates: SSL is installed outside (Hostinger hPanel) and
 * "Check & activate" only verifies that https://<domain>/api/health answers with a valid certificate.
 */
export type DomainStatus = "pending" | "active" | "disabled";

export interface DomainRow {
  id: number;
  hostname: string;
  label: string | null;
  status: DomainStatus;
  is_default: boolean;
  note: string | null;
  last_check_at: Date | null;
  last_check_ok: boolean | null;
  last_check_error: string | null;
  override_by: number | null;
  activated_at: Date | null;
}
export interface AuditEntry { actor: number | null; action: string; target?: string; meta?: unknown }
export interface DomainStore {
  list(): Promise<DomainRow[]>;
  get(id: number): Promise<DomainRow | null>;
  getByHost(host: string): Promise<DomainRow | null>;
  insert(v: { hostname: string; label: string | null; status: DomainStatus; is_default?: boolean; note?: string | null }): Promise<DomainRow>;
  update(id: number, patch: Partial<Omit<DomainRow, "id" | "is_default">>): Promise<void>;
  remove(id: number): Promise<void>;
  /** One transaction: clear the current default, set the new one, write the audit entry. */
  swapDefault(id: number, audit: AuditEntry): Promise<void>;
  audit(e: AuditEntry): Promise<void>;
}
export interface CheckResult { ok: boolean; error?: string }
export type Res<T = DomainRow> = { ok: true; data: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Accepts "Links.Example.com", "https://links.example.com/x" and returns the bare lowercase host, or an error. */
export function normalizeHostname(raw: string): Res<string> {
  let v = String(raw ?? "").trim().toLowerCase();
  if (!v) return fail("Enter a domain such as go.example.com.");
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.$/, "");
  if (v.includes("@")) return fail("Enter only the domain, without a username.");
  if (v.length > 190) return fail("That domain is too long.");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v) || v.includes(":")) return fail("Use a domain name, not an IP address.");
  if (v === "localhost" || v.endsWith(".localhost") || v.endsWith(".local") || v.endsWith(".internal")) return fail("Local addresses cannot be used as a domain.");
  if (!/^(?=.{4,190}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(v) && !/^(xn--[a-z0-9-]+\.)+[a-z0-9-]{2,63}$/.test(v)) return fail("Enter a valid domain such as go.example.com.");
  return { ok: true, data: v };
}

export interface ServiceDeps {
  store: DomainStore;
  /** Runs the HTTPS check. Injected so tests never touch the network. */
  check: (hostname: string) => Promise<CheckResult>;
  now?: () => Date;
}

export function createDomainService({ store, check, now = () => new Date() }: ServiceDeps) {
  return {
    list: () => store.list(),

    async add(actor: number, rawHost: string, label?: string): Promise<Res> {
      const h = normalizeHostname(rawHost);
      if (!h.ok) return h;
      if (await store.getByHost(h.data)) return fail("That domain is already in the list.");
      const row = await store.insert({ hostname: h.data, label: (label ?? "").trim().slice(0, 80) || null, status: "pending" });
      await store.audit({ actor, action: "domain.add", target: row.hostname });
      return { ok: true, data: row };
    },

    /** Label and note can always change. A new hostname resets the domain to pending and is refused for the default. */
    async edit(actor: number, id: number, v: { hostname?: string; label?: string }): Promise<Res> {
      const cur = await store.get(id);
      if (!cur) return fail("Domain not found.");
      const patch: Partial<DomainRow> = {};
      if (v.label !== undefined) patch.label = v.label.trim().slice(0, 80) || null;
      if (v.hostname !== undefined) {
        const h = normalizeHostname(v.hostname);
        if (!h.ok) return h;
        if (h.data !== cur.hostname) {
          if (cur.is_default) return fail("The default domain's address cannot be changed. Make another domain the default first.");
          const clash = await store.getByHost(h.data);
          if (clash && clash.id !== id) return fail("That domain is already in the list.");
          Object.assign(patch, { hostname: h.data, status: "pending" as DomainStatus, last_check_at: null, last_check_ok: null, last_check_error: null, override_by: null, activated_at: null });
        }
      }
      if (Object.keys(patch).length) await store.update(id, patch);
      await store.audit({ actor, action: "domain.edit", target: cur.hostname, meta: patch.hostname ? { to: patch.hostname } : undefined });
      return { ok: true, data: (await store.get(id))! };
    },

    /**
     * Runs the HTTPS check and activates on success. On failure the exact reason is stored and returned;
     * `override` activates anyway (explicit admin decision, recorded in the audit log).
     */
    async checkAndActivate(actor: number, id: number, opts: { override?: boolean } = {}): Promise<Res<{ row: DomainRow; check: CheckResult; overridden: boolean }>> {
      const cur = await store.get(id);
      if (!cur) return fail("Domain not found.");
      const r = await check(cur.hostname);
      const at = now();
      if (r.ok) {
        await store.update(id, { status: "active", last_check_at: at, last_check_ok: true, last_check_error: null, activated_at: cur.activated_at ?? at, override_by: null });
        await store.audit({ actor, action: "domain.activate", target: cur.hostname });
        return { ok: true, data: { row: (await store.get(id))!, check: r, overridden: false } };
      }
      const error = r.error || "The HTTPS check failed.";
      if (opts.override) {
        await store.update(id, { status: "active", last_check_at: at, last_check_ok: false, last_check_error: error, activated_at: cur.activated_at ?? at, override_by: actor });
        await store.audit({ actor, action: "domain.activate_override", target: cur.hostname, meta: { error } });
        return { ok: true, data: { row: (await store.get(id))!, check: r, overridden: true } };
      }
      await store.update(id, { last_check_at: at, last_check_ok: false, last_check_error: error });
      await store.audit({ actor, action: "domain.check_failed", target: cur.hostname, meta: { error } });
      return { ok: true, data: { row: (await store.get(id))!, check: r, overridden: false } };
    },

    async disable(actor: number, id: number): Promise<Res> {
      const cur = await store.get(id);
      if (!cur) return fail("Domain not found.");
      if (cur.is_default) return fail("The default domain cannot be disabled. Make another active domain the default first.");
      await store.update(id, { status: "disabled" });
      await store.audit({ actor, action: "domain.disable", target: cur.hostname });
      return { ok: true, data: (await store.get(id))! };
    },

    /** Deleting a domain never touches links or pages: they only store slugs. */
    async remove(actor: number, id: number): Promise<Res<string>> {
      const cur = await store.get(id);
      if (!cur) return fail("Domain not found.");
      if (cur.is_default) return fail("The default domain cannot be deleted. Make another active domain the default first.");
      await store.remove(id);
      await store.audit({ actor, action: "domain.delete", target: cur.hostname });
      return { ok: true, data: cur.hostname };
    },

    /** Only an ACTIVE domain can become the default. One transaction, with the audit entry. No data is migrated. */
    async makeDefault(actor: number, id: number): Promise<Res<{ previous: string | null; next: string }>> {
      const cur = await store.get(id);
      if (!cur) return fail("Domain not found.");
      if (cur.status !== "active") return fail("Only an active domain can become the default. Run Check & activate first.");
      const all = await store.list();
      const prev = all.find((d) => d.is_default) ?? null;
      if (prev?.id === id) return { ok: true, data: { previous: cur.hostname, next: cur.hostname } };
      await store.swapDefault(id, { actor, action: "domain.default_change", target: cur.hostname, meta: { from: prev?.hostname ?? null, to: cur.hostname } });
      return { ok: true, data: { previous: prev?.hostname ?? null, next: cur.hostname } };
    },

    /**
     * Guarantees nobody is locked out: the APP_URL host exists, is active, and is the default when no default exists
     * (fresh installs and installs upgraded from before admin-managed domains).
     */
    async ensureSeed(appHost: string): Promise<void> {
      const h = normalizeHostname(appHost);
      const host = h.ok ? h.data : appHost.toLowerCase();
      const all = await store.list();
      let row = all.find((d) => d.hostname === host) ?? null;
      const at = now();
      if (!row) {
        row = await store.insert({ hostname: host, label: "Main address", status: "active", note: "Seeded from APP_URL" });
        await store.update(row.id, { activated_at: at });
      } else if (row.status !== "active" && !all.some((d) => d.is_default)) {
        await store.update(row.id, { status: "active", activated_at: row.activated_at ?? at });
      }
      if (!all.some((d) => d.is_default) && !(await store.list()).some((d) => d.is_default)) {
        await store.swapDefault(row.id, { actor: null, action: "domain.seed_default", target: host });
      }
    },
  };
}
export type DomainService = ReturnType<typeof createDomainService>;
