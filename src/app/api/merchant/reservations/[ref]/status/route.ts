import { z } from "zod";
import { handle, json, requireRole } from "@/server/api";
import { venueSetReservationStatus } from "@/server/dinein/service";

const body = z.object({ status: z.enum(["confirmed", "completed", "no_show", "cancelled"]) });

export const POST = handle(async (req, ctx) => {
  const actor = await requireRole(req, "merchant", "admin");
  const { status } = body.parse(await req.json().catch(() => ({})));
  return json({ reservation: await venueSetReservationStatus(actor, (await ctx.params).ref!, status) });
});
