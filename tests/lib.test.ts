import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTargetUrl, safeNext, isPrivateHost } from "../src/lib/url-check.ts";
import { parseCsv, csvCell, toCsv } from "../src/lib/csv.ts";

test("checkTargetUrl accepts public http(s) URLs", () => {
  const r = checkTargetUrl("https://example.com/a?b=1");
  assert.equal(r.ok, true);
});

test("checkTargetUrl rejects non-http schemes", () => {
  for (const u of ["javascript:alert(1)", "data:text/html,hi", "file:///etc/passwd", "ftp://example.com"]) {
    assert.equal(checkTargetUrl(u).ok, false, u);
  }
});

test("checkTargetUrl blocks SSRF targets", () => {
  for (const u of [
    "http://localhost/", "http://127.0.0.1/", "http://10.0.0.5/", "http://192.168.1.1/", "http://172.16.0.1/",
    "http://169.254.169.254/latest/meta-data", "http://[::1]/", "http://2130706433/", "http://0x7f000001/", "http://db.internal/",
  ]) {
    assert.equal(checkTargetUrl(u).ok, false, u);
  }
});

test("checkTargetUrl rejects embedded credentials and own-host loops", () => {
  assert.equal(checkTargetUrl("https://user:pw@example.com").ok, false);
  assert.equal(checkTargetUrl("https://short.example/abc", "short.example").ok, false);
});

test("isPrivateHost leaves public addresses alone", () => {
  assert.equal(isPrivateHost("example.com"), false);
  assert.equal(isPrivateHost("8.8.8.8"), false);
  assert.equal(isPrivateHost("172.32.0.1"), false);
});

test("safeNext only allows same-site paths", () => {
  assert.equal(safeNext("/dashboard/links"), "/dashboard/links");
  assert.equal(safeNext("//evil.com"), "/dashboard");
  assert.equal(safeNext("https://evil.com"), "/dashboard");
  assert.equal(safeNext("/\\evil.com"), "/dashboard");
  assert.equal(safeNext(null, "/x"), "/x");
});

test("csvCell neutralizes spreadsheet formulas and quotes specials", () => {
  assert.equal(csvCell("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell(5), "5");
});

test("parseCsv handles quotes, commas and CRLF", () => {
  const rows = parseCsv('target_url,title\r\nhttps://a.com,"Hello, world"\r\nhttps://b.com,"He said ""hi"""\r\n');
  assert.deepEqual(rows, [
    ["target_url", "title"],
    ["https://a.com", "Hello, world"],
    ["https://b.com", 'He said "hi"'],
  ]);
});

test("toCsv round-trips through parseCsv", () => {
  const rows = [["a", "b,c"], ["1", "line\nbreak"]];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});
