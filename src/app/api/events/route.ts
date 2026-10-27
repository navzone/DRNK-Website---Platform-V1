import { handle, json } from "@/server/api";
import { listEvents } from "@/server/explore/venues";

export const GET = handle(async (req) => json(await listEvents(Object.fromEntries(new URL(req.url).searchParams))));
