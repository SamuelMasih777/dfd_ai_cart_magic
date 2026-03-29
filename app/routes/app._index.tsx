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
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { ensureShopForSession } from "../lib/shop.server";
import { getAnalyticsSummary, getAnalyticsTimeSeries } from "../lib/analytics-summary.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);
  const summary = await getAnalyticsSummary(shop.id, 30);
  const timeSeries = await getAnalyticsTimeSeries(shop.id, 30);
  return {
    shopDomain: shop.shopDomain,
    plan: shop.plan,
    summary,
    timeSeries,
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

function AnalyticsChart({ data }: { data: any[] }) {
  if (!data?.length) return null;

  const maxOpens = Math.max(...data.map((d) => d.drawerOpens), 10);
  const width = 1000;
  const height = 200;
  const padding = 40;

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
      const y = height - (d.drawerOpens / maxOpens) * (height - padding * 2) - padding;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", minWidth: 600 }}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const y = height - p * (height - padding * 2) - padding;
          return (
            <line
              key={p}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#f0f0f0"
              strokeWidth="1"
            />
          );
        })}

        {/* Line */}
        <polyline
          fill="none"
          stroke="#008060"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />

        {/* Data points */}
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
          const y = height - (d.drawerOpens / maxOpens) * (height - padding * 2) - padding;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="4"
              fill="#008060"
            >
              <title>{`${d.date}: ${d.drawerOpens}`}</title>
            </circle>
          );
        })}

        {/* X Axis Labels (every 5 days) */}
        {data.map((d, i) => {
          if (i % 5 !== 0 && i !== data.length - 1) return null;
          const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
          const date = new Date(d.date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
          return (
            <text
              key={i}
              x={x}
              y={height - 10}
              fontSize="12"
              fill="#888"
              textAnchor="middle"
            >
              {date}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const { shopDomain, plan, summary, timeSeries } = useLoaderData<typeof loader>();
  const c = summary.counts;

  return (
    <Page>
      <TitleBar title="Cart Magic Dashboard" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Performance summary
                  </Text>
                  <Badge tone="info">{`Last ${summary.days} days`}</Badge>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Store: <strong>{shopDomain}</strong> · Plan: <strong>{plan.toUpperCase()}</strong>
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

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
                    ? `${summary.upsellAddRate}% conversion`
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
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Drawer Opens (Last 30 Days)
                </Text>
                <AnalyticsChart data={timeSeries} />
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
              <MetricCard
                title="Orders completed"
                value={String(summary.ordersCompleted)}
                hint="Captured via webhooks"
              />
              <MetricCard
                title="Attributed revenue"
                value={`$${Number(summary.orderRevenueTotal).toFixed(2)}`}
              />
            </InlineGrid>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Quick actions
                </Text>
                <InlineStack gap="300">
                  <Button url="/app/cart-drawer">Settings</Button>
                  <Button url="/app/design">Design</Button>
                  <Button url="/app/upsell">Upsells</Button>
                  <Button url="/app/plan" variant="primary">Manage Plan</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

