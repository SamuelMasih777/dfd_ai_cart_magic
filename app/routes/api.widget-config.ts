import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { buildWidgetConfig, getShopByDomain } from "../lib/shop.server";
import { mergeCors } from "../lib/cors.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");
  if (!shopParam) {
    return json(
      { error: "Missing shop" },
      { status: 400, headers: mergeCors() },
    );
  }

  const row = await getShopByDomain(shopParam);
  if (!row || row.uninstalledAt || !row.planActive) {
    return json(
      { enabled: false, reason: "not_installed" },
      {
        headers: mergeCors({ "Cache-Control": "public, max-age=60" }),
      },
    );
  }

  return json(buildWidgetConfig(row), {
    headers: mergeCors({ "Cache-Control": "public, max-age=60" }),
  });
};
