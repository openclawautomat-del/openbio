import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeSlug, checkSlug, skeleton, isReservedRoute, ROUTE_SEGMENTS, STATIC_RESERVED, DEFAULT_RESERVED_WORDS, DEFAULT_BRANDS, DEFAULT_SENSITIVE, UNAVAILABLE } from "../src/lib/slug-rules.ts";

const lists = { reserved: DEFAULT_RESERVED_WORDS, brands: DEFAULT_BRANDS, sensitive: DEFAULT_SENSITIVE, appName: "Open Bio" };
const verdict = (s: string) => checkSlug(s, lists);

test("normalize: NFKC, lowercase, ASCII only", () => {
  assert.deepEqual(normalizeSlug("  My_Name-1 "), { ok: true, slug: "my_name-1" });
  assert.equal(normalizeSlug("ＡＢＣ").ok && (normalizeSlug("ＡＢＣ") as { slug: string }).slug, "abc"); // fullwidth folds to ASCII
  for (const bad of ["ab", "a".repeat(33), "-abc", "abc-", "a--b", "café", "аdmin", "ab cd", "a/b", "a.b", "", "日本語です"]) {
    assert.equal(normalizeSlug(bad).ok, false, JSON.stringify(bad));
  }
  assert.equal(normalizeSlug("a".repeat(32)).ok, true);
  assert.equal(normalizeSlug("abc").ok, true);
  assert.equal(normalizeSlug("_ab").ok, true);
});

test("reserved: every static path, route segment and seeded word is refused with a generic message", () => {
  for (const w of [...STATIC_RESERVED, ...ROUTE_SEGMENTS, ...DEFAULT_RESERVED_WORDS]) {
    const n = normalizeSlug(w);
    if (!n.ok) continue; // e.g. ".well-known" or 2-char names fail format first, which also refuses them
    const v = verdict(w);
    assert.equal(v.ok, false, w);
    if (!v.ok) assert.ok(v.error === UNAVAILABLE || v.code === "format", w);
  }
  const v = verdict("admin"); assert.equal(v.ok === false && v.error, UNAVAILABLE);
});

test("reserved: separators and fullwidth tricks do not slip through", () => {
  for (const s of ["log-in", "sign_in", "ＡＤＭＩＮ", "Admin", "forgot_password", "pass-word", "open-bio", "openbio", "OPEN_BIO"]) {
    assert.equal(verdict(s).ok, false, s);
  }
});

test("reserved-route test: every top-level route under src/app is reserved", () => {
  const root = path.join(import.meta.dirname, "..", "src", "app");
  const found = new Set<string>();
  const walk = (dir: string, top: boolean) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name.startsWith("(")) walk(path.join(dir, e.name), top); // route group: children are top-level
        else if (e.name.startsWith("[") || e.name.startsWith("_") || e.name.startsWith("@")) continue;
        else if (top) found.add(e.name);
      } else if (top) {
        if (e.name === "robots.ts") found.add("robots.txt");
        if (e.name === "sitemap.ts") found.add("sitemap.xml");
        if (/^(manifest)\.(ts|json)$/.test(e.name)) found.add("manifest.json");
      }
    }
  };
  walk(root, true);
  assert.ok(found.size > 10, "route discovery found nothing");
  const missing = [...found].filter((s) => !isReservedRoute(s));
  assert.deepEqual(missing, [], `Add these top-level routes to ROUTE_SEGMENTS in src/lib/slug-rules.ts: ${missing.join(", ")}`);
});

test("phishing: exact brand and brand + sensitive word are blocked", () => {
  for (const s of ["paypal", "google", "facebook", "stripe", "bank", "paypal-login", "google_verify", "apple-support", "amazon-account", "binance-wallet", "bank-security", "netflixbilling", "login-paypal"]) {
    const v = verdict(s); assert.equal(v.ok, false, s);
    if (!v.ok) assert.equal(v.error, UNAVAILABLE);
  }
});

test("phishing: look-alikes and repeated characters are caught", () => {
  for (const s of ["paypa1", "paypai", "paypa1-login", "rnicrosoft", "microsofft", "gooogle", "g00gle", "faceb00k", "arnazon", "vvhatsapp", "paypall", "pay-pal", "payyypal-verify", "1nstagram", "lnstagram", "binannce"]) {
    assert.equal(verdict(s).ok, false, s);
  }
  assert.equal(skeleton("rnicrosoft"), skeleton("microsoft"));
  assert.equal(skeleton("g00gle"), skeleton("google"));
});

test("phishing: the owner's brand is protected through APP_NAME", () => {
  assert.equal(checkSlug("openbio", { ...lists, appName: "OpenBio" }).ok, false);
  assert.equal(checkSlug("openbio-login", { ...lists, appName: "OpenBio" }).ok, false);
  assert.equal(checkSlug("acme-login", { ...lists, appName: "Acme" }).ok, false);
});

test("suspicious (brand inside a longer name) goes to review, not rejection", () => {
  for (const s of ["paypal-fan", "mygoogle", "pineapple-pie", "bankruptcy"]) {
    const v = verdict(s); assert.equal(v.ok, true, s);
    if (v.ok) assert.equal(v.review, true, s);
  }
});

test("ordinary names pass cleanly", () => {
  for (const s of ["jane-doe", "spring_menu", "launch2026", "my-portfolio", "cafe-aroma", "login-help-guide".replace("login", "tips")]) {
    const v = verdict(s); assert.equal(v.ok && !v.review, true, s);
  }
  // sensitive word on its own is not a brand claim
  assert.equal(verdict("billing-tips").ok && !(verdict("billing-tips") as { review: boolean }).review, true);
});
