import { z } from "zod";
import { handle, json, requireRole } from "@/server/api";
import { setMenuItemAvailability } from "@/server/merchant/service";

export const POST = handle(async (req, ctx) => {
  const u = await requireRole(req, "merchant", "admin");
  const { available } = z.object({ available: z.boolean() }).parse(await req.json().catch(() => ({})));
  return json(await setMenuItemAvailability(u, (await ctx.params).id!, available));
});
