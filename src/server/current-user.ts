import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth/session";
import { SESSION_COOKIE } from "@/server/api";

/** For server components. Always re-validates the session in the database; role checks never trust the client. */
export async function getCurrentUser() {
  const jar = await cookies();
  return getSessionUser(jar.get(SESSION_COOKIE)?.value);
}
