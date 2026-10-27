import { z } from "zod";
import { handle, json, requireRole } from "@/server/api";
import { setUserRole } from "@/server/admin/service";

export const POST = handle(async (req, ctx) => {
  const admin = await requireRole(req, "admin");
  const { role } = z.object({ role: z.enum(["customer", "merchant", "host", "talent", "admin"]) }).parse(await req.json().catch(() => ({})));
  return json(await setUserRole(admin, z.uuid().parse((await ctx.params).id), role));
});
