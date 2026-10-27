import { z } from "zod";
import { handle, json, requireUser } from "@/server/api";
import { createEnquiry } from "@/server/talent/service";

const body = z.object({
  message: z.string().trim().min(5).max(1000),
  eventDate: z.iso.datetime().transform((s) => new Date(s)).optional(),
});

export const POST = handle(async (req, ctx) => {
  const user = await requireUser(req);
  const input = body.parse(await req.json().catch(() => ({})));
  const e = await createEnquiry(user.id, (await ctx.params).slug!, input);
  return json({ enquiry: { id: e.id, status: e.status } }, { status: 201 });
});
