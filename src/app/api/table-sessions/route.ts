import { z } from "zod";
import { handle, json, requireUser } from "@/server/api";
import { openTableSession } from "@/server/dinein/service";

const body = z.object({ venueSlug: z.string().min(1).max(80), tableLabel: z.string().trim().min(1).max(20) });

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  const { venueSlug, tableLabel } = body.parse(await req.json().catch(() => ({})));
  const s = await openTableSession(user.id, venueSlug, tableLabel);
  return json({ tableSession: { id: s.id, tableLabel: s.tableLabel, status: s.status } }, { status: 201 });
});
