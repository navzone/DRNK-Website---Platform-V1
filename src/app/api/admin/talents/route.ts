import { z } from "zod";
import { handle, json, requireRole } from "@/server/api";
import { createTalentProfile } from "@/server/admin/service";

const body = z.object({
  stageName: z.string().trim().min(2).max(80), kind: z.enum(["dj", "kj", "band", "other"]), genres: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  bio: z.string().trim().max(2000).optional(), userId: z.uuid().optional(), status: z.enum(["pending", "approved"]).default("pending"),
});

export const POST = handle(async (req) => {
  const admin = await requireRole(req, "admin");
  return json({ talent: await createTalentProfile(admin, body.parse(await req.json().catch(() => ({})))) }, { status: 201 });
});
