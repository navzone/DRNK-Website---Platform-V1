import { handle, json, requireRole } from "@/server/api";
import { listVenueOrders } from "@/server/dinein/service";

export const GET = handle(async (req) => json({ orders: await listVenueOrders(await requireRole(req, "merchant", "admin")) }));
