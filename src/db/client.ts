import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { env } from "@/lib/env";

const globalForDb = globalThis as unknown as { __drnkPool?: Pool };

function create() {
  const p = (globalForDb.__drnkPool ??= new Pool({ connectionString: env().DATABASE_URL, max: 10 }));
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
