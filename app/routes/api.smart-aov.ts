import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { calculateAverageOrderValue } from "../lib/aov.server";

/**
 * GET /api/smart-aov
 * Authenticated endpoint — returns store AOV and suggested reward tier thresholds.
 * PRD §3: dedicated Smart AOV endpoint.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const days = Math.min(
    Math.max(parseInt(url.searchParams.get("days") ?? "30", 10) || 30, 1),
    90,
  );

  const { aov, orderCount } = await calculateAverageOrderValue(
    admin.graphql.bind(admin),
    days,
  );

  // PRD §5: suggest tiers at 0.7×, 1.0×, 1.4× AOV
  const suggestedTiers =
    aov != null
      ? [
          {
            position: 1,
            threshold: Math.round(aov * 0.7 * 100) / 100,
            label: "Free Shipping",
          },
          {
            position: 2,
            threshold: Math.round(aov * 1.0 * 100) / 100,
            label: "Free Gift",
          },
          {
            position: 3,
            threshold: Math.round(aov * 1.4 * 100) / 100,
            label: "10% Discount",
          },
        ]
      : [];

  return Response.json(
    {
      aov: aov != null ? Math.round(aov * 100) / 100 : null,
      orderCount,
      days,
      suggestedTiers,
    },
    { status: 200 },
  );
};
