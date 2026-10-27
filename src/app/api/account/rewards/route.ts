import { handle, json, requireUser } from "@/server/api";
import { rewardsSummary } from "@/server/account/service";

export const GET = handle(async (req) => json(await rewardsSummary((await requireUser(req)).id)));
