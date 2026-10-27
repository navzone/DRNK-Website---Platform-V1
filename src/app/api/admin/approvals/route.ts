import { z } from "zod";
import { handle, json, requireRole } from "@/server/api";
import { setApproval } from "@/server/admin/service";

const body = z.object({ entity: z.enum(["venue", "event", "talent", "merchant_application"]), id: z.uuid(), status: z.enum(["approved", "rejected", "suspended"]) });

export const POST = handle(async (req) => {
  const admin = await requireRole(req, "admin");
  const { entity, id, status } = body.parse(await req.json().catch(() => ({})));
  return json(await setApproval(admin, entity, id, status));
});
