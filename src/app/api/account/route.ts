import { z } from "zod";
import { handle, json, requireUser } from "@/server/api";
import { updateProfile } from "@/server/account/service";

// Role and phone are never writable here.
const body = z.object({ displayName: z.string().trim().min(1).max(60).optional(), email: z.email().max(120).optional() }).strict();

export const GET = handle(async (req) => {
  const u = await requireUser(req);
  return json({ profile: { id: u.id, phone: u.phoneE164, role: u.role, displayName: u.displayName, email: u.email, createdAt: u.createdAt } });
});

export const PATCH = handle(async (req) => {
  const u = await requireUser(req);
  const updated = await updateProfile(u.id, body.parse(await req.json().catch(() => ({}))));
  return json({ profile: { id: updated.id, displayName: updated.displayName, email: updated.email } });
});
