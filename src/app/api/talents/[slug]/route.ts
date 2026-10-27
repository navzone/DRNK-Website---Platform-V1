import { handle, json } from "@/server/api";
import { getTalent } from "@/server/talent/service";

export const GET = handle(async (_req, ctx) => json({ talent: await getTalent((await ctx.params).slug!) }));
