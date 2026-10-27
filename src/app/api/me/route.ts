import { handle, json, requireUser } from "@/server/api";

export const GET = handle(async (req) => {
  const user = await requireUser(req);
  // Return only what the client needs; the role is informational — every API re-checks it server-side.
  return json({ user: { id: user.id, role: user.role, displayName: user.displayName, email: user.email } });
});
