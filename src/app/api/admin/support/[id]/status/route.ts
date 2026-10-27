import { z } from "zod";
import { handle, json, requireRole } from "@/server/api";
import { setSupportStatus } from "@/server/admin/service";

export const POST = handle(async (req, ctx) => {
  const admin = await requireRole(req, "admin");
  const { status } = z.object({ status: z.enum(["open", "in_progress", "resolved", "rejected"]) }).parse(await req.json().catch(() => ({})));
  return json(await setSupportStatus(admin, z.uuid().parse((await ctx.params).id), status));
});
