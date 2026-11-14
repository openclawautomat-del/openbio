import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

export function migrationsDir(): string {
  const candidates = [path.join(process.cwd(), "migrations"), path.join(process.cwd(), "..", "migrations")];
  return candidates.find((d) => fs.existsSync(d)) ?? candidates[0];
}

/** Runs pending SQL migrations in filename order. Idempotent. */
export async function runMigrations(opts: { includePhase2?: boolean } = {}): Promise<string[]> {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
    charset: "utf8mb4",
  });
  const applied: string[] = [];
  try {
    await conn.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(191) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB",
    );
    const [rows] = await conn.query("SELECT name FROM schema_migrations");
    const done = new Set((rows as { name: string }[]).map((r) => r.name));
    const dir = migrationsDir();
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      if (f.includes("phase2") && opts.includePhase2 === false) continue;
      await conn.query(fs.readFileSync(path.join(dir, f), "utf8"));
      await conn.query("INSERT INTO schema_migrations (name) VALUES (?)", [f]);
      applied.push(f);
    }
  } finally {
    await conn.end();
  }
  return applied;
}
