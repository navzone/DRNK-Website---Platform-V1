import { handle, json, requireUser } from "@/server/api";
import { cancelOwnReservation } from "@/server/dinein/service";

export const POST = handle(async (req, ctx) => {
  const user = await requireUser(req);
  const r = await cancelOwnReservation(user.id, (await ctx.params).ref!);
  return json({ reservation: { ref: r.ref, status: r.status } });
});
