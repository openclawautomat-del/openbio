// Standalone migration runner: `npm run migrate`. Reads .env if present.
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}
const phase2 = !["0", "false"].includes((process.env.FEATURE_PHASE2 || "").toLowerCase());
const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
  charset: "utf8mb4",
});
await conn.query(
  "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(191) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB",
);
const [rows] = await conn.query("SELECT name FROM schema_migrations");
const done = new Set(rows.map((r) => r.name));
const files = fs.readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort();
let n = 0;
for (const f of files) {
  if (done.has(f) || (!phase2 && f.includes("phase2"))) continue;
  await conn.query(fs.readFileSync(path.join("migrations", f), "utf8"));
  await conn.query("INSERT INTO schema_migrations (name) VALUES (?)", [f]);
  console.log("applied", f);
  n++;
}
console.log(n ? `${n} migration(s) applied.` : "Database is up to date.");
await conn.end();
