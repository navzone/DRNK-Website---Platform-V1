import { handle, json } from "@/server/api";
import { getPaymentProvider } from "@/server/payments/provider";
import { processWebhook } from "@/server/payments/service";

export const dynamic = "force-dynamic";

// Authenticated by signature over the raw body — never by cookies or browser redirects.
export const POST = handle(async (req) => {
  const raw = await req.text();
  const provider = getPaymentProvider();
  const event = provider.parseWebhook(raw, req.headers);
  const result = await processWebhook(event, provider.name);
  return json({ result });
}, { skipOriginCheck: true });
