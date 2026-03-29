import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * GDPR: customers/data_request
 * Shopify asks which customer data the app stores.
 * Cart Magic does not store PII beyond analytics_events (no customer email/name).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[GDPR] Received ${topic} for ${shop}`);
  console.log(
    `[GDPR] Customer data request — customer id:`,
    (payload as { customer?: { id?: number } })?.customer?.id,
  );

  // No PII stored — acknowledge the request.
  return new Response(null, { status: 200 });
};
