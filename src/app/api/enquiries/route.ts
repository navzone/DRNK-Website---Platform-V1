import { handle, json, requireUser } from "@/server/api";
import { listOwnEnquiries } from "@/server/talent/service";

export const GET = handle(async (req) => json({ enquiries: (await listOwnEnquiries((await requireUser(req)).id)).map((r) => ({ ...r.e, stageName: r.stageName })) }));
