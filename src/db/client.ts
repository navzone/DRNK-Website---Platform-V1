import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import * as schema from "./schema";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

const globalForDb = globalThis as unknown as { __drnkPool?: Pool };

/** Connections idle for longer than this are checked with a cheap query before being handed out. */
const STALE_AFTER_MS = 2_000;
type Tracked = PoolClient & { __usedAt?: number };

function makePool(): Pool {
  const p = new Pool({
    connectionString: env().DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX) || 10,
    // Hosted databases (Neon, pgbouncer) close idle connections, and serverless functions are frozen between
    // requests. Keep idle connections short-lived and keep sockets alive.
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
  });

  // An idle pooled connection that the server closes emits "error". With no listener Node treats it as an
  // uncaught exception and the whole process (and every request it is serving) dies. pg already discards the
  // broken client; we only need to say so and carry on.
  p.on("error", (err) => log.warn("db_idle_connection_error", { err: err.message }));

  // A connection can also die silently while the function is frozen. Before reusing one that has been idle for a
  // while, check it; if the check fails, discard it and take another. This runs before any real statement is sent,
  // so nothing is ever executed twice.
  const connect = p.connect.bind(p) as (cb?: unknown) => unknown;
  const checked = async (): Promise<PoolClient> => {
    for (let attempt = 0; ; attempt++) {
      const client = (await (connect() as Promise<PoolClient>)) as Tracked;
      const idleFor = Date.now() - (client.__usedAt ?? 0);
      if (client.__usedAt && idleFor <= STALE_AFTER_MS) { client.__usedAt = Date.now(); return client; }
      if (!client.__usedAt) { client.__usedAt = Date.now(); return client; } // brand new connection
      try {
        await client.query("select 1");
        client.__usedAt = Date.now();
        return client;
      } catch (err) {
        client.release(err instanceof Error ? err : new Error(String(err))); // destroys it
        log.warn("db_stale_connection_discarded", { err: err instanceof Error ? err.message : String(err) });
        if (attempt >= 2) throw err;
      }
    }
  };
  // pg's own pool.query() calls this.connect(callback), so support both the callback and promise forms.
  (p as unknown as { connect: (cb?: (err: Error | undefined, client?: PoolClient, done?: (e?: Error) => void) => void) => Promise<PoolClient> | void }).connect = (cb) => {
    if (!cb) return checked();
    checked().then((c) => cb(undefined, c, (e?: Error) => c.release(e)), (e) => cb(e instanceof Error ? e : new Error(String(e))));
  };
  return p;
}

function create() {
  const p = (globalForDb.__drnkPool ??= makePool());
  return { pool: p, db: drizzle(p, { schema }) };
}
type Instance = ReturnType<typeof create>;

let instance: Instance | undefined;
const get = (): Instance => (instance ??= create());

/** Forward every property access to the real object, created on first use so that importing this module
 *  (for example during `next build`) never requires DATABASE_URL to be set. */
function lazy<T extends object>(pick: (i: Instance) => T): T {
  return new Proxy({} as T, {
    get(_t, prop) {
      const target = pick(get());
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export const pool: Pool = lazy((i) => i.pool);
export const db: Instance["db"] = lazy((i) => i.db);
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Either the pool-backed db or an open transaction. */
export type Executor = Db | Tx;
export { schema };
