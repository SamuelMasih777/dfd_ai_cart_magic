import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * GDPR: shop/redact
 * Shopify asks the app to delete ALL data for a shop (48h after uninstall).
 * We cascade-delete the Shop row which removes cart_settings, reward_tiers,
 * upsell_rules, gift_rules, cart_rules, and analytics_events via ON DELETE CASCADE.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`[GDPR] Received ${topic} for ${shop}`);

  // Delete shop and all related data (Prisma cascade).
  const deleted = await db.shop.deleteMany({
    where: { shopDomain: shop },
  });

  console.log(`[GDPR] Deleted ${deleted.count} shop row(s) for ${shop}`);

  // Also clear any orphaned sessions.
  await db.session.deleteMany({ where: { shop } });

  return new Response(null, { status: 200 });
};
