import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  const order = payload as {
    id?: number;
    total_price?: string;
    cart_token?: string;
  };

  const shopRow = await prisma.shop.findUnique({
    where: { shopDomain: shop },
  });
  if (!shopRow) {
    return new Response();
  }

  const total =
    order.total_price != null
      ? parseFloat(String(order.total_price))
      : null;

  await prisma.analyticsEvent.create({
    data: {
      shopId: shopRow.id,
      eventType: "order_completed",
      cartToken:
        order.cart_token != null ? String(order.cart_token) : null,
      cartTotal:
        total != null && !Number.isNaN(total) ? total : null,
      metadata: { order_id: order.id },
    },
  });

  return new Response();
};
