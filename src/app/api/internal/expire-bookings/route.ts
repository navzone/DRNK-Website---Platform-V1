import { handle, json } from "@/server/api";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { expireStaleBookings } from "@/server/events/booking";

// Called by the platform scheduler with `Authorization: Bearer $CRON_SECRET`. Disabled when no secret is configured.
export const POST = handle(async (req) => {
  const secret = env().CRON_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || !safeEqual(given, secret)) throw new AppError(404, "not_found", "Not found");
  return json({ expired: await expireStaleBookings() });
}, { skipOriginCheck: true });
