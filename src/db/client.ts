import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { env } from "@/lib/env";

const globalForDb = globalThis as unknown as { __drnkPool?: Pool };

export const pool = (globalForDb.__drnkPool ??= new Pool({ connectionString: env().DATABASE_URL, max: 10 }));
export const db = drizzle(pool, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Either the pool-backed db or an open transaction. */
export type Executor = Db | Tx;
export { schema };
