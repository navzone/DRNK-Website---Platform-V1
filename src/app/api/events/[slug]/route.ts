import { handle, json } from "@/server/api";
import { getEvent } from "@/server/explore/venues";

export const GET = handle(async (_req, ctx) => json(await getEvent((await ctx.params).slug!)));
