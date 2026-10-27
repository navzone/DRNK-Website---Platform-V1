import { handle, json, requireUser } from "@/server/api";
import { history } from "@/server/account/service";

export const GET = handle(async (req) => json(await history((await requireUser(req)).id)));
