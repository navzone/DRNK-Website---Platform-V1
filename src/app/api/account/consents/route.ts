import { z } from "zod";
import { handle, json, requireUser } from "@/server/api";
import { recordConsent } from "@/server/account/service";

const body = z.object({ version: z.string().min(1).max(40) });

export const POST = handle(async (req) => {
  const u = await requireUser(req);
  return json(await recordConsent(u.id, body.parse(await req.json().catch(() => ({}))).version), { status: 201 });
});
