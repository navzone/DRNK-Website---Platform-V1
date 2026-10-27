import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { env } from "@/lib/env";
import { hmacHex, randomToken } from "@/lib/crypto";

export const SESSION_TTL_MS = { default: 30 * 86400_000, admin: 8 * 3600_000 } as const;

type User = typeof schema.users.$inferSelect;

const hashToken = (token: string) => hmacHex(token, env().SESSION_SECRET);

/** Issues a fresh opaque token per login (rotation). Only a keyed hash is stored; the raw token lives in an HttpOnly cookie. */
export async function createSession(user: Pick<User, "id" | "role">) {
  const token = randomToken();
  const ttl = user.role === "admin" ? SESSION_TTL_MS.admin : SESSION_TTL_MS.default;
  const expiresAt = new Date(Date.now() + ttl);
  await db.insert(schema.sessions).values({ userId: user.id, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt, maxAgeSeconds: Math.floor(ttl / 1000) };
}

export async function getSessionUser(token: string | undefined | null): Promise<User | null> {
  if (!token) return null;
  const rows = await db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.tokenHash, hashToken(token)),
        isNull(schema.sessions.revokedAt),
        gt(schema.sessions.expiresAt, new Date()),
        isNull(schema.users.deletedAt),
      ),
    )
    .limit(1);
  return rows[0]?.user ?? null;
}

export async function revokeSession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.sessions.tokenHash, hashToken(token)), isNull(schema.sessions.revokedAt)));
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
}
