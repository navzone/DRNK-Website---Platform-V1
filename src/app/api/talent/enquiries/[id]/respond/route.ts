import { z } from "zod";
import { handle, json, requireRole } from "@/server/api";
import { respondToEnquiry } from "@/server/talent/service";

const body = z.object({ status: z.enum(["accepted", "declined"]), response: z.string().trim().max(1000).optional() });

export const POST = handle(async (req, ctx) => {
  const actor = await requireRole(req, "talent", "admin");
  const input = body.parse(await req.json().catch(() => ({})));
  return json({ enquiry: await respondToEnquiry(actor, (await ctx.params).id!, input) });
});
