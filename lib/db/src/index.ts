import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let _pool: pg.Pool | null = null;
let _db: NodePgDatabase<typeof schema> | null = null;

function getPool(): pg.Pool {
  if (!_pool) {
    const databaseUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "NEON_DATABASE_URL or DATABASE_URL must be set. Did you forget to provision a database?",
      );
    }
    _pool = new Pool({
      connectionString: databaseUrl,
      // Required for connections from hosted environments (Vercel, etc.)
      // that reach external PostgreSQL over TLS.
      ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
    });
  }
  return _pool;
}

function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

// Lazy proxies — safe to import at module load time even without DATABASE_URL.
// The error is thrown on first actual DB or pool usage.
export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_, key) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getPool() as any)[key];
  },
});

export const db: NodePgDatabase<typeof schema> = new Proxy(
  {} as NodePgDatabase<typeof schema>,
  {
    get(_, key) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (getDb() as any)[key];
    },
  },
);

export * from "./schema";
