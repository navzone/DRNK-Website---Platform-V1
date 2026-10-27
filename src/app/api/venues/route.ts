import { handle, json } from "@/server/api";
import { searchVenues } from "@/server/explore/venues";

export const GET = handle(async (req) => json(await searchVenues(Object.fromEntries(new URL(req.url).searchParams))));
