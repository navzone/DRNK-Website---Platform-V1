import { clearSessionCookie, handle, json, readCookie, SESSION_COOKIE } from "@/server/api";
import { revokeSession } from "@/server/auth/session";

export const POST = handle(async (req) => {
  await revokeSession(readCookie(req, SESSION_COOKIE));
  return json({ ok: true }, { cookie: clearSessionCookie() });
});
