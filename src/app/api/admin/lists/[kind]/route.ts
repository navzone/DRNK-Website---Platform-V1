import { z } from "zod";
import { handle, json, notFoundJson, requireRole } from "@/server/api";
import { adminLists } from "@/server/admin/service";
import { maskPhone } from "@/lib/phone";

const status = z.enum(["pending", "approved", "rejected", "suspended"]).optional();

export const GET = handle(async (req, ctx) => {
  await requireRole(req, "admin");
  const { kind } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  switch (kind) {
    case "venues": return json({ items: await adminLists.venues(status.parse(sp.get("status") ?? undefined)) });
    case "events": return json({ items: await adminLists.events(status.parse(sp.get("status") ?? undefined)) });
    case "talents": return json({ items: await adminLists.talents(status.parse(sp.get("status") ?? undefined)) });
    case "applications": return json({ items: await adminLists.applications(status.parse(sp.get("status") ?? undefined)) });
    case "users": return json({ items: (await adminLists.users()).map((u) => ({ ...u, phoneE164: maskPhone(u.phoneE164) })) });
    case "bookings": return json({ items: await adminLists.bookings() });
    case "support": return json({ items: await adminLists.support() });
    case "data-requests": return json({ items: await adminLists.dataRequests() });
    case "audit": return json({ items: await adminLists.audit(sp.get("limit")) });
    default: return notFoundJson();
  }
});
