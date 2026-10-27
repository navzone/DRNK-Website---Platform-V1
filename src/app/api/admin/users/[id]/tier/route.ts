import { z } from "zod";
import { handle, json, requireRole } from "@/server/api";
import { assignTier } from "@/server/admin/service";

export const POST = handle(async (req, ctx) => {
  const admin = await requireRole(req, "admin");
  const { tier } = z.object({ tier: z.enum(["silver", "gold", "black"]) }).parse(await req.json().catch(() => ({})));
  return json(await assignTier(admin, z.uuid().parse((await ctx.params).id), tier));
});
