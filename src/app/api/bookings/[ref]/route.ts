import { handle, json, requireUser } from "@/server/api";
import { getBookingForUser } from "@/server/events/booking";

// Status always comes from the database (set by verified webhooks) — never from a browser redirect.
export const GET = handle(async (req, ctx) => {
  const user = await requireUser(req);
  const { ref } = await ctx.params;
  return json(await getBookingForUser(user.id, ref!));
});
