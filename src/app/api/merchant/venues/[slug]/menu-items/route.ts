import { z } from "zod";
import { handle, json, requireRole } from "@/server/api";
import { createMenuItem } from "@/server/merchant/service";

const body = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(500).optional(), pricePaise: z.number().int().min(0).max(10_000_00), containsAlcohol: z.boolean().optional() });

export const POST = handle(async (req, ctx) => {
  const u = await requireRole(req, "merchant", "admin");
  return json({ item: await createMenuItem(u, (await ctx.params).slug!, body.parse(await req.json().catch(() => ({})))) }, { status: 201 });
});
