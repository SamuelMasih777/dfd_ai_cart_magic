import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  InlineGrid,
  InlineStack,
  Button,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { ensureShopForSession } from "../lib/shop.server";
import { getAnalyticsSummary } from "../lib/analytics-summary.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);
  const summary = await getAnalyticsSummary(shop.id, 30);
  return {
    shopDomain: shop.shopDomain,
    plan: shop.plan,
    summary,
  };
};

function MetricCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm" tone="subdued">
          {title}
        </Text>
        <Text as="p" variant="heading2xl">
          {value}
        </Text>
        {hint && (
          <Text as="p" variant="bodySm" tone="subdued">
            {hint}
          </Text>
        )}
      </BlockStack>
    </Card>
  );
}

export default function Dashboard() {
  const { shopDomain, plan, summary } = useLoaderData<typeof loader>();
  const c = summary.counts;

  return (
    <Page>
      <TitleBar title="Revenue analytics" />
      <BlockStack gap="500">
        <Text as="p" variant="bodyMd">
          Store <strong>{shopDomain}</strong> · Plan <strong>{plan}</strong> ·
          Last {summary.days} days
        </Text>
        <InlineStack gap="300">
          <Button url="/app/cart-drawer">Cart drawer</Button>
          <Button url="/app/offers">Offers</Button>
          <Button url="/app/rules">Rules</Button>
          <Button url="/app/discount-trust">Discount & trust</Button>
        </InlineStack>
        <Layout>
          <Layout.Section>
            <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
              <MetricCard
                title="Drawer opens"
                value={String(c["drawer_open"] ?? 0)}
              />
              <MetricCard
                title="Upsell adds"
                value={String(c["upsell_added"] ?? 0)}
                hint={
                  summary.upsellAddRate != null
                    ? `${summary.upsellAddRate}% of drawer opens`
                    : undefined
                }
              />
              <MetricCard
                title="Gift redemptions"
                value={String(c["gift_redeemed"] ?? 0)}
              />
              <MetricCard
                title="Checkout clicks"
                value={String(c["checkout_click"] ?? 0)}
              />
            </InlineGrid>
          </Layout.Section>
          <Layout.Section>
            <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
              <MetricCard
                title="Orders completed (webhook)"
                value={String(summary.ordersCompleted)}
                hint="orders/paid events logged"
              />
              <MetricCard
                title="Attributed revenue (sum)"
                value={`$${Number(summary.orderRevenueTotal).toFixed(2)}`}
              />
            </InlineGrid>
          </Layout.Section>
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  All events
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  progress_influenced:{" "}
                  {c["progress_influenced"] ?? 0} · order_completed:{" "}
                  {c["order_completed"] ?? 0}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
