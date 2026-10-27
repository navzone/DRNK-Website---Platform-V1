import { z } from "zod";
import { clientIp, handle, json } from "@/server/api";
import { requestOtp } from "@/server/auth/otp";

const body = z.object({ phone: z.string().min(8).max(20) });

export const POST = handle(async (req) => {
  const { phone } = body.parse(await req.json().catch(() => ({})));
  const result = await requestOtp({ phone, ip: clientIp(req) });
  return json(result);
});
