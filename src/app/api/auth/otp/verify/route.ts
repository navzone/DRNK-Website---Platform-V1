import { z } from "zod";
import { clientIp, handle, json, sessionCookie } from "@/server/api";
import { verifyOtp } from "@/server/auth/otp";

const body = z.object({ phone: z.string().min(8).max(20), code: z.string().length(6) });

export const POST = handle(async (req) => {
  const { phone, code } = body.parse(await req.json().catch(() => ({})));
  const { user, session } = await verifyOtp({ phone, code, ip: clientIp(req) });
  // The session token is delivered only via an HttpOnly cookie, never in the response body.
  return json(
    { user: { id: user.id, role: user.role, displayName: user.displayName } },
    { cookie: sessionCookie(session.token, session.maxAgeSeconds) },
  );
});
