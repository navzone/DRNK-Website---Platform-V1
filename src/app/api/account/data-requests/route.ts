import { z } from "zod";
import { handle, json, requireUser } from "@/server/api";
import { createDataRequest, listDataRequests } from "@/server/account/service";

const body = z.object({ kind: z.enum(["export", "delete"]) });

export const GET = handle(async (req) => json({ requests: await listDataRequests((await requireUser(req)).id) }));
export const POST = handle(async (req) => {
  const u = await requireUser(req);
  const { kind } = body.parse(await req.json().catch(() => ({})));
  return json({ request: await createDataRequest(u.id, kind) }, { status: 201 });
});
