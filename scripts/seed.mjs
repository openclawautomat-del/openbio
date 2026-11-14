// Demo data for local development: `npm run seed`.
// Creates one demo user ("demo"), a bio page with a few blocks, and two short links.
// It never touches the installer lock or the Super Admin. Refuses to run in production unless --force.
import fs from "node:fs";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}
if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("Refusing to seed demo data with NODE_ENV=production. Pass --force if you really mean it.");
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  charset: "utf8mb4",
});

const [existing] = await conn.execute("SELECT id FROM users WHERE username = ?", ["demo"]);
if (existing.length) {
  console.log("Demo user already exists. Nothing to do.");
  await conn.end();
  process.exit(0);
}

const password = crypto.randomBytes(9).toString("base64url");
const hash = await bcrypt.hash(password, 12);
const [u] = await conn.execute(
  "INSERT INTO users (email, username, password_hash, email_verified_at) VALUES (?, ?, ?, UTC_TIMESTAMP())",
  ["demo@example.com", "demo", hash],
);
const userId = u.insertId;
const [p] = await conn.execute(
  "INSERT INTO pages (user_id, display_name, bio, theme, socials) VALUES (?, ?, ?, ?, ?)",
  [userId, "Demo Studio", "Small studio making honest things for the web.", "paper", JSON.stringify({ github: "https://github.com" })],
);
const blocks = [
  ["link", "Latest project", "https://example.com/work"],
  ["link", "Book a call", "https://example.com/call"],
  ["link", "Newsletter", "https://example.com/news"],
];
for (const [i, [type, title, url]] of blocks.entries()) {
  await conn.execute("INSERT INTO blocks (page_id, type, title, url, sort_order) VALUES (?, ?, ?, ?, ?)", [p.insertId, type, title, url, i]);
}
await conn.execute("INSERT INTO links (user_id, slug, title, target_url) VALUES (?, ?, ?, ?)", [userId, "hello", "Hello page", "https://example.com/hello"]);
await conn.execute("INSERT INTO links (user_id, slug, title, target_url) VALUES (?, ?, ?, ?)", [userId, "docs-demo", "Docs", "https://example.com/docs"]);
await conn.end();

console.log("Seeded demo data.");
console.log("  Login:    demo@example.com");
console.log(`  Password: ${password}`);
console.log("  Page:     /demo");
