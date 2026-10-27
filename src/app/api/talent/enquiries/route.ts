import { handle, json, requireRole } from "@/server/api";
import { listEnquiriesForTalent } from "@/server/talent/service";

export const GET = handle(async (req) => json({ enquiries: (await listEnquiriesForTalent(await requireRole(req, "talent", "admin"))).map((r) => ({ ...r.e, stageName: r.stageName })) }));
