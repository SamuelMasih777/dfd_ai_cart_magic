import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { ensureShopForSession } from "../lib/shop.server";
import { getAnalyticsSummary } from "../lib/analytics-summary.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);

  const url = new URL(request.url);
  const days = Math.min(
    90,
    Math.max(1, Number(url.searchParams.get("days") ?? "30")),
  );

  const summary = await getAnalyticsSummary(shop.id, days);
  return json(summary);
};
