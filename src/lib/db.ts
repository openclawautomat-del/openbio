import mysql, { type Pool, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";

const g = globalThis as unknown as { __pool?: Pool };

export function dbConfigured(): boolean {
  return Boolean(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER);
}

export function pool(): Pool {
  if (!g.__pool) {
    g.__pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      waitForConnections: true,
      // Shared hosting caps concurrent connections; keep the pool small.
      connectionLimit: Number(process.env.DB_POOL || 5),
      queueLimit: 100,
      charset: "utf8mb4",
      dateStrings: false,
      timezone: "Z",
    });
    // Keep CURRENT_TIMESTAMP in UTC regardless of the host's MySQL time zone.
    g.__pool.pool.on("connection", (c) => c.query("SET time_zone = '+00:00'"));
  }
  return g.__pool;
}

export type Row = RowDataPacket;

/** Prepared-statement query returning rows. Values are always bound, never interpolated. */
export async function query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool().execute<RowDataPacket[]>(sql, params as never[]);
  return rows as unknown as T[];
}

export async function queryOne<T = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function exec(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [res] = await pool().execute<ResultSetHeader>(sql, params as never[]);
  return res;
}

/** Runs `fn` inside one transaction on a dedicated connection. Rolls back on any error. */
export async function withTx<T>(fn: (q: { query: <R = Row>(sql: string, params?: unknown[]) => Promise<R[]>; exec: (sql: string, params?: unknown[]) => Promise<ResultSetHeader> }) => Promise<T>): Promise<T> {
  const conn = await pool().getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn({
      query: async <R = Row>(sql: string, params: unknown[] = []) => ((await conn.execute<RowDataPacket[]>(sql, params as never[]))[0] as unknown as R[]),
      exec: async (sql: string, params: unknown[] = []) => (await conn.execute<ResultSetHeader>(sql, params as never[]))[0],
    });
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}
