import { handle, json, requireRole } from "@/server/api";
import { listVenueReservations } from "@/server/dinein/service";

export const GET = handle(async (req) => json({ reservations: (await listVenueReservations(await requireRole(req, "merchant", "admin"))).map((r) => r.r) }));
