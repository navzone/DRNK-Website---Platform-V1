import { handle, json } from "@/server/api";
import { searchTalent } from "@/server/talent/service";

export const GET = handle(async (req) => json(await searchTalent(Object.fromEntries(new URL(req.url).searchParams))));
