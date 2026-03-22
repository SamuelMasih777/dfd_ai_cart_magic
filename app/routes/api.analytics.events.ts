import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { getShopByDomain, isValidShopDomain } from "../lib/shop.server";
import { mergeCors } from "../lib/cors.server";

const ALLOWED_EVENTS = new Set([
  "drawer_open",
  "upsell_added",
  "gift_redeemed",
  "progress_influenced",
  "checkout_click",
  "order_completed",
]);

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json(
      { error: "Method not allowed" },
      { status: 405, headers: mergeCors() },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400, headers: mergeCors() });
  }

  const shopDomain = String(body.shop ?? "");
  if (!isValidShopDomain(shopDomain)) {
    return json({ error: "Invalid shop" }, { status: 400, headers: mergeCors() });
  }

  const shop = await getShopByDomain(shopDomain);
  if (!shop || shop.uninstalledAt || !shop.planActive) {
    return json({ ok: false }, { status: 404, headers: mergeCors() });
  }

  const eventType = String(body.event_type ?? "");
  if (!ALLOWED_EVENTS.has(eventType)) {
    return json({ error: "Invalid event_type" }, { status: 400, headers: mergeCors() });
  }

  const cartTotal =
    body.cart_total != null ? Number(body.cart_total) : null;
  const upsellRevenue =
    body.upsell_revenue != null ? Number(body.upsell_revenue) : null;

  await prisma.analyticsEvent.create({
    data: {
      shopId: shop.id,
      eventType,
      cartToken: body.cart_token != null ? String(body.cart_token) : null,
      cartTotal:
        cartTotal != null && !Number.isNaN(cartTotal) ? cartTotal : null,
      upsellRevenue:
        upsellRevenue != null && !Number.isNaN(upsellRevenue)
          ? upsellRevenue
          : null,
      metadata:
        body.metadata != null && typeof body.metadata === "object"
          ? (body.metadata as object)
          : undefined,
    },
  });

  return json({ ok: true }, { headers: mergeCors() });
};
