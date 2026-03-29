import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * GDPR: customers/redact
 * Shopify asks the app to delete all stored data for a specific customer.
 * Cart Magic does not store customer PII — analytics_events contain no
 * email, name, or identifiable data.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[GDPR] Received ${topic} for ${shop}`);
  console.log(
    `[GDPR] Customer redact — customer id:`,
    (payload as { customer?: { id?: number } })?.customer?.id,
  );

  // No customer PII to delete — acknowledge.
  return new Response(null, { status: 200 });
};
