import { handle, json, requireUser } from "@/server/api";
import { cancelOwnOrder } from "@/server/dinein/service";

export const POST = handle(async (req, ctx) => json({ order: await cancelOwnOrder((await requireUser(req)).id, (await ctx.params).ref!) }));
