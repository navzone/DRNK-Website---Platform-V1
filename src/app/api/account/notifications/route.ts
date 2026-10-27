import { handle, json, requireUser } from "@/server/api";
import { listNotifications } from "@/server/account/service";

export const GET = handle(async (req) => json({ notifications: await listNotifications((await requireUser(req)).id) }));
