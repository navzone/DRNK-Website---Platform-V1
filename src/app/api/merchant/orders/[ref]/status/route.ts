import { z } from "zod";
import { handle, json, requireRole } from "@/server/api";
import { venueSetOrderStatus } from "@/server/dinein/service";

const body = z.object({ status: z.enum(["accepted", "served", "cancelled"]) });

export const POST = handle(async (req, ctx) => {
  const actor = await requireRole(req, "merchant", "admin");
  const { status } = body.parse(await req.json().catch(() => ({})));
  return json({ order: await venueSetOrderStatus(actor, (await ctx.params).ref!, status) });
});
