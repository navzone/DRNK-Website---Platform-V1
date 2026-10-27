import { handle, json, requireUser } from "@/server/api";
import { cancelPendingBooking } from "@/server/events/booking";

export const POST = handle(async (req, ctx) => {
  const user = await requireUser(req);
  const { ref } = await ctx.params;
  const b = await cancelPendingBooking(user.id, ref!);
  return json({ booking: { ref: b.ref, status: b.status } });
});
