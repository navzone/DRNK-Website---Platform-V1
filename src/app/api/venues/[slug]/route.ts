import { handle, json } from "@/server/api";
import { getVenue } from "@/server/explore/venues";

export const GET = handle(async (_req, ctx) => json(await getVenue((await ctx.params).slug!)));
