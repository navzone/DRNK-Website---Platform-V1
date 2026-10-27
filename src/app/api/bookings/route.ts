import { z } from "zod";
import { handle, json, requireUser } from "@/server/api";
import { createBooking, listBookingsForUser } from "@/server/events/booking";

const body = z.object({
  eventId: z.uuid(),
  // Only ids and quantities are accepted. Prices are never read from the client.
  lines: z.array(z.object({ ticketTypeId: z.uuid(), quantity: z.number().int().min(1).max(10) })).min(1).max(5),
});

export const GET = handle(async (req) => {
  const user = await requireUser(req);
  return json({ bookings: await listBookingsForUser(user.id) });
});

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  const input = body.parse(await req.json().catch(() => ({})));
  const booking = await createBooking(user.id, input);
  return json({ booking }, { status: 201 });
});
