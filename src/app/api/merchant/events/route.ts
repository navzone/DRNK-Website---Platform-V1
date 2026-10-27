import { z } from "zod";
import { handle, json, requireRole } from "@/server/api";
import { createEvent } from "@/server/merchant/service";

const body = z.object({
  venueSlug: z.string().min(1).max(80),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  startsAt: z.iso.datetime().transform((s) => new Date(s)),
  ticketTypes: z.array(z.object({ name: z.string().trim().min(1).max(60), pricePaise: z.number().int().min(0).max(100_000_00), capacity: z.number().int().min(1).max(10_000) })).min(1).max(8),
});

export const POST = handle(async (req) => {
  const u = await requireRole(req, "merchant", "admin");
  return json({ event: await createEvent(u, body.parse(await req.json().catch(() => ({})))) }, { status: 201 });
});
