import { z } from "zod";
import { handle, json, requireUser } from "@/server/api";
import { createReservation, listReservationsForUser } from "@/server/dinein/service";

const body = z.object({
  venueSlug: z.string().min(1).max(80),
  partySize: z.number().int().min(1).max(50),
  slotAt: z.iso.datetime().transform((s) => new Date(s)),
  notes: z.string().max(300).optional(),
});

export const GET = handle(async (req) => json({ reservations: await listReservationsForUser((await requireUser(req)).id) }));

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  const input = body.parse(await req.json().catch(() => ({})));
  return json({ reservation: await createReservation(user.id, input) }, { status: 201 });
});
