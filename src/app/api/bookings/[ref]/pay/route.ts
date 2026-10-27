import { handle, json, requireUser } from "@/server/api";
import { startPayment } from "@/server/payments/service";

export const POST = handle(async (req, ctx) => {
  const user = await requireUser(req);
  const { ref } = await ctx.params;
  return json(await startPayment(user.id, ref!), { status: 201 });
});
