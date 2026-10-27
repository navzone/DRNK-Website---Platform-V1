import { handle, json, requireUser } from "@/server/api";
import { getOrderForUser } from "@/server/dinein/service";

export const GET = handle(async (req, ctx) => json(await getOrderForUser((await requireUser(req)).id, (await ctx.params).ref!)));
