import { z } from "zod";
import { handle, json, requireRole } from "@/server/api";
import { createVenue, listOwnVenues } from "@/server/merchant/service";

const body = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.enum(["restaurant", "pub", "microbrewery", "lounge", "cafe"]),
  cuisines: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  neighbourhood: z.string().trim().min(2).max(60),
  address: z.string().trim().min(5).max(300),
  description: z.string().trim().max(2000).optional(),
  amenities: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  dineInEnabled: z.boolean().optional(),
});

export const GET = handle(async (req) => json({ venues: await listOwnVenues(await requireRole(req, "merchant", "admin")) }));
export const POST = handle(async (req) => {
  const u = await requireRole(req, "merchant", "admin");
  return json({ venue: await createVenue(u, body.parse(await req.json().catch(() => ({})))) }, { status: 201 });
});
