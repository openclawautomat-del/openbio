import { test } from "node:test";
import assert from "node:assert/strict";
import { LRU } from "../src/lib/lru.ts";
import { ClickBuffer } from "../src/lib/click-buffer.ts";
import { decideHost, effectiveHost, effectiveProto, isPublicContentPath, normalizeHost } from "../src/lib/host-policy.ts";
import { checkTargetUrl } from "../src/lib/url-check.ts";

test("LRU evicts least recently used and honours TTL", () => {
  let t = 0;
  const c = new LRU<number>(2, 100, () => t);
  c.set("a", 1); c.set("b", 2); c.get("a"); c.set("c", 3);
  assert.equal(c.get("b"), undefined);
  assert.equal(c.get("a"), 1);
  t = 101;
  assert.equal(c.get("a"), undefined);
  c.set("x", 9); c.delete("x");
  assert.equal(c.get("x"), undefined);
});

test("ClickBuffer batches, flushes at size, on stop, and retries a failed batch", async () => {
  const batches: number[][] = [];
  let fail = true;
  const b = new ClickBuffer<number>(async (x) => { if (fail) { fail = false; throw new Error("db down"); } batches.push(x); }, { maxEvents: 3, intervalMs: 10_000 });
  b.push(1); b.push(2);
  assert.equal(batches.length, 0);
  b.push(3);
  await b.flush();
  assert.equal(b.pending, 3); // first write failed, batch kept
  await b.stop();
  assert.deepEqual(batches, [[1, 2, 3]]);
  const small = new ClickBuffer<number>(async () => {}, { maxQueue: 2, maxEvents: 99 });
  small.push(1); small.push(2); small.push(3);
  assert.equal(small.pending, 2);
});

const base = { defaultHost: "go.example.com", activeHosts: ["go.example.com", "old.example.com"], appHost: "app.example.com" };

test("host policy: public content only on the default host", () => {
  const d = (host: string, pathname: string) => decideHost({ ...base, host, pathname });
  assert.equal(d("go.example.com", "/promo"), "allow");
  assert.equal(d("go.example.com", "/dashboard"), "allow");
  assert.equal(d("old.example.com", "/promo"), "notfound");        // previous default / other active domain
  assert.equal(d("app.example.com", "/promo"), "notfound");
  assert.equal(d("old.example.com", "/out/5"), "notfound");
  assert.equal(d("old.example.com", "/api/vcard/5"), "notfound");
  for (const p of ["/dashboard", "/admin/domains", "/api/v1/links", "/install", "/login", "/"]) {
    assert.equal(d("old.example.com", p), "allow", p);
    assert.equal(d("app.example.com", p), "allow", p);
  }
});

test("host policy: unknown hosts get 404 everywhere except /api/health", () => {
  const d = (host: string, pathname: string) => decideHost({ ...base, host, pathname });
  for (const p of ["/", "/dashboard", "/promo", "/api/v1/links", "/install"]) assert.equal(d("evil.example.net", p), "notfound", p);
  assert.equal(d("evil.example.net", "/api/health"), "allow");
  assert.equal(d("", "/"), "notfound");
  assert.equal(d("GO.example.com:443", "/promo"), "allow");
});

test("host policy: lockout prevention, the APP_URL host always reaches the console", () => {
  const r = decideHost({ host: "app.example.com", pathname: "/admin/domains", defaultHost: "gone.example.com", activeHosts: [], appHost: "app.example.com" });
  assert.equal(r, "allow");
});

test("isPublicContentPath", () => {
  for (const p of ["/promo", "/jane-doe", "/out/3", "/api/vcard/9"]) assert.equal(isPublicContentPath(p), true, p);
  for (const p of ["/", "/dashboard/links", "/admin", "/api/qr", "/login", "/terms", "/report", "/uploads/a.png", "/_next/x.js", "/robots.txt"]) assert.equal(isPublicContentPath(p), false, p);
});

test("forwarded headers are trusted only when TRUST_PROXY=true", () => {
  const h: Record<string, string> = { host: "internal:3000", "x-forwarded-host": "go.example.com", "x-forwarded-proto": "https" };
  const get = (n: string) => h[n];
  assert.equal(effectiveHost(get, false), "internal");
  assert.equal(effectiveHost(get, true), "go.example.com");
  assert.equal(effectiveProto(get, false, "http"), "http");
  assert.equal(effectiveProto(get, true, "http"), "https");
  assert.equal(normalizeHost("Example.COM.:8080"), "example.com");
});

test("destination safety: schemes, credentials, IPs, loops, shorteners", () => {
  const own = ["go.example.com", "app.example.com"];
  for (const u of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "https://u:p@example.com", "http://8.8.8.8/", "http://[2001:db8::1]/", "http://localhost/", "http://10.1.1.1/", "http://0177.0.0.1/", "http://intranet/",
    "https://go.example.com/x", "https://app.example.com", "https://bit.ly/abc", "https://sub.tinyurl.com/x", "https://t.co/x"]) {
    assert.equal(checkTargetUrl(u, own).ok, false, u);
  }
  assert.equal(checkTargetUrl("https://example.org/a?b=1", own).ok, true);
});
