import { z } from "zod";
import { handle, json, requireUser } from "@/server/api";
import { applyAsMerchant } from "@/server/merchant/service";

const body = z.object({ businessName: z.string().trim().min(2).max(120), neighbourhood: z.string().trim().max(60).optional(), details: z.string().trim().max(1000).optional() });

export const POST = handle(async (req) => {
  const u = await requireUser(req);
  const a = await applyAsMerchant(u.id, body.parse(await req.json().catch(() => ({}))));
  return json({ application: { id: a.id, status: a.status } }, { status: 201 });
});
