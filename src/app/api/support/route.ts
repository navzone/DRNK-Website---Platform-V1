import { z } from "zod";
import { handle, json, requireUser } from "@/server/api";
import { createSupportTicket, listSupportTickets } from "@/server/account/service";

const body = z.object({ subject: z.string().trim().min(3).max(120), body: z.string().trim().min(10).max(2000) });

export const GET = handle(async (req) => json({ tickets: await listSupportTickets((await requireUser(req)).id) }));
export const POST = handle(async (req) => {
  const u = await requireUser(req);
  return json({ ticket: await createSupportTicket(u.id, body.parse(await req.json().catch(() => ({})))) }, { status: 201 });
});
