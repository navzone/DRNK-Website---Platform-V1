import { z } from "zod";
import { handle, json, requireUser } from "@/server/api";
import { createOrder, listOrdersForUser } from "@/server/dinein/service";

// Only ids and quantities are accepted — names, prices and totals are computed on the server.
const body = z.object({
  venueSlug: z.string().min(1).max(80),
  items: z.array(z.object({ menuItemId: z.uuid(), quantity: z.number().int().min(1).max(50) })).min(1).max(40),
  tableSessionId: z.uuid().optional(),
});

export const GET = handle(async (req) => json({ orders: await listOrdersForUser((await requireUser(req)).id) }));

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  const input = body.parse(await req.json().catch(() => ({})));
  return json({ order: await createOrder(user.id, input) }, { status: 201 });
});
