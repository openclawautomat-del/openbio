import { test } from "node:test";
import assert from "node:assert/strict";
import { createDomainService, normalizeHostname, type CheckResult } from "../src/lib/domain-service.ts";
import { checkDomainHttps, explainFetchError } from "../src/lib/domain-check.ts";
import { MemoryDomainStore } from "./helpers/memory-domain-store.ts";

function setup(check: (h: string) => Promise<CheckResult> = async () => ({ ok: true })) {
  const store = new MemoryDomainStore();
  const svc = createDomainService({ store, check });
  return { store, svc };
}
const ok = <T>(r: { ok: boolean; data?: T; error?: string }): T => { assert.equal(r.ok, true, (r as { error?: string }).error); return (r as { data: T }).data; };

test("normalizeHostname accepts hosts and strips scheme, path, port", () => {
  assert.deepEqual(normalizeHostname(" HTTPS://Go.Example.com:443/x?y "), { ok: true, data: "go.example.com" });
  for (const bad of ["", "localhost", "127.0.0.1", "foo", "a b.com", "user@x.com", "http://[::1]", "x.local", "-a.com", "a..com"]) assert.equal(normalizeHostname(bad).ok, false, bad);
});

test("add: new domains start pending; duplicates are refused", async () => {
  const { svc } = setup();
  const d = ok(await svc.add(1, "Go.Example.com", "Main"));
  assert.equal(d.status, "pending"); assert.equal(d.is_default, false); assert.equal(d.hostname, "go.example.com");
  assert.equal((await svc.add(1, "go.example.com")).ok, false);
});

test("seed: APP_URL host becomes an active default; running again changes nothing", async () => {
  const { svc, store } = setup();
  await svc.ensureSeed("app.example.com");
  await svc.ensureSeed("app.example.com");
  const rows = await store.list();
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].status, rows[0].is_default], ["active", true]);
});

test("seed on an existing install keeps its current default", async () => {
  const { svc, store } = setup();
  const a = ok(await svc.add(1, "a.example.com")); await svc.checkAndActivate(1, a.id); await svc.makeDefault(1, a.id);
  await svc.ensureSeed("app.example.com");
  const rows = await store.list();
  assert.equal(rows.find((r) => r.is_default)!.hostname, "a.example.com");
  assert.equal(rows.find((r) => r.hostname === "app.example.com")!.status, "active");
});

test("activate: stays pending on failure with the exact reason; success activates", async () => {
  let result: CheckResult = { ok: false, error: "The SSL certificate has expired." };
  const { svc } = setup(async () => result);
  const d = ok(await svc.add(1, "go.example.com"));
  const r1 = ok(await svc.checkAndActivate(1, d.id));
  assert.equal(r1.row.status, "pending"); assert.equal(r1.row.last_check_error, "The SSL certificate has expired.");
  result = { ok: true };
  const r2 = ok(await svc.checkAndActivate(1, d.id));
  assert.equal(r2.row.status, "active"); assert.equal(r2.row.last_check_error, null);
});

test("activate: explicit override activates despite a failed check and is audited", async () => {
  const { svc, store } = setup(async () => ({ ok: false, error: "DNS lookup failed" }));
  const d = ok(await svc.add(1, "go.example.com"));
  const r = ok(await svc.checkAndActivate(7, d.id, { override: true }));
  assert.equal(r.overridden, true); assert.equal(r.row.status, "active"); assert.equal(r.row.override_by, 7);
  assert.ok(store.audits.some((a) => a.action === "domain.activate_override"));
});

test("default: only an ACTIVE domain can become default; swap is exclusive and audited", async () => {
  const { svc, store } = setup();
  await svc.ensureSeed("app.example.com");
  const g = ok(await svc.add(1, "go.example.com"));
  assert.equal((await svc.makeDefault(1, g.id)).ok, false); // pending
  await svc.checkAndActivate(1, g.id);
  const r = ok(await svc.makeDefault(1, g.id));
  assert.deepEqual(r, { previous: "app.example.com", next: "go.example.com" });
  const rows = await store.list();
  assert.equal(rows.filter((x) => x.is_default).length, 1);
  assert.equal(rows.find((x) => x.is_default)!.hostname, "go.example.com");
  const a = store.audits.find((x) => x.action === "domain.default_change")!;
  assert.deepEqual(a.meta, { from: "app.example.com", to: "go.example.com" });
});

test("default: a disabled domain cannot become default", async () => {
  const { svc } = setup();
  await svc.ensureSeed("app.example.com");
  const g = ok(await svc.add(1, "go.example.com")); await svc.checkAndActivate(1, g.id); await svc.disable(1, g.id);
  assert.equal((await svc.makeDefault(1, g.id)).ok, false);
});

test("lockout prevention: the default cannot be disabled, deleted, or have its address edited", async () => {
  const { svc } = setup();
  await svc.ensureSeed("app.example.com");
  const def = (await svc.list()).find((d) => d.is_default)!;
  assert.equal((await svc.disable(1, def.id)).ok, false);
  assert.equal((await svc.remove(1, def.id)).ok, false);
  assert.equal((await svc.edit(1, def.id, { hostname: "other.example.com" })).ok, false);
  assert.equal((await svc.edit(1, def.id, { label: "Primary" })).ok, true);
});

test("disable and delete a non-default domain; editing the address resets it to pending", async () => {
  const { svc, store } = setup();
  await svc.ensureSeed("app.example.com");
  const g = ok(await svc.add(1, "go.example.com")); await svc.checkAndActivate(1, g.id);
  assert.equal(ok(await svc.disable(1, g.id)).status, "disabled");
  const e = ok(await svc.edit(1, g.id, { hostname: "go2.example.com" }));
  assert.deepEqual([e.hostname, e.status], ["go2.example.com", "pending"]);
  ok(await svc.remove(1, g.id));
  assert.equal((await store.list()).length, 1);
});

test("health check: maps TLS and network failures to actionable reasons, accepts a good response", async () => {
  const err = (code: string) => async () => { throw Object.assign(new Error("fetch failed"), { cause: { code } }); };
  const reason = async (code: string) => (await checkDomainHttps("go.example.com", { fetchImpl: err(code) })).error;
  assert.match((await reason("CERT_HAS_EXPIRED"))!, /expired/);
  assert.match((await reason("DEPTH_ZERO_SELF_SIGNED_CERT"))!, /self-signed/);
  assert.match((await reason("ERR_TLS_CERT_ALTNAME_INVALID"))!, /does not cover go\.example\.com/);
  assert.match((await reason("ENOTFOUND"))!, /DNS lookup failed/);
  assert.match((await reason("ECONNREFUSED"))!, /refused/);
  const res = (status: number, body: unknown, loc?: string) => async () => ({ status, headers: { get: () => loc ?? null }, json: async () => body });
  assert.equal((await checkDomainHttps("x.example.com", { fetchImpl: res(200, { ok: true, app: "openbio" }) })).ok, true);
  assert.match((await checkDomainHttps("x.example.com", { fetchImpl: res(301, {}, "https://y.example.com/") })).error!, /redirects to https:\/\/y/);
  assert.match((await checkDomainHttps("x.example.com", { fetchImpl: res(404, {}) })).error!, /404/);
  assert.match((await checkDomainHttps("x.example.com", { fetchImpl: res(200, { hello: 1 }) })).error!, /not from this app/);
  assert.match(explainFetchError(Object.assign(new Error("x"), { name: "TimeoutError" }), "h", 8000), /Timed out after 8s/);
});
