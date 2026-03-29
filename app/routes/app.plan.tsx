import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  InlineGrid,
  InlineStack,
  Badge,
  Button,
  Box,
  Divider,
  Banner,
  Icon,
  List,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { ensureShopForSession } from "../lib/shop.server";
import {
  PLANS,
  getPlanDef,
  createSubscription,
  updateShopPlan,
  getActiveSubscription,
  cancelSubscription,
} from "../lib/billing.server";
import { getAnalyticsSummary } from "../lib/analytics-summary.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);

  // Check query params for billing confirmation callback
  const url = new URL(request.url);
  const chargeId = url.searchParams.get("charge_id");
  const planParam = url.searchParams.get("plan");

  // If returning from Shopify billing confirmation, update plan
  if (chargeId && planParam && ["pro", "scale"].includes(planParam)) {
    await updateShopPlan(shop.id, planParam as "pro" | "scale");
    return redirect("/app/plan");
  }

  const activeSub = await getActiveSubscription({ graphql: admin.graphql.bind(admin) });
  const summary = await getAnalyticsSummary(shop.id, 30);

  return {
    currentPlan: shop.plan,
    planActive: shop.planActive,
    shopDomain: shop.shopDomain,
    activeSubscription: activeSub,
    plans: PLANS,
    stats: {
      drawerOpens: summary.counts["drawer_open"] ?? 0,
      upsellAdds: summary.counts["upsell_added"] ?? 0,
      checkoutClicks: summary.counts["checkout_click"] ?? 0,
      ordersCompleted: summary.ordersCompleted,
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "upgrade") {
    const targetPlan = String(form.get("plan") ?? "");
    const planDef = PLANS.find((p) => p.key === targetPlan);
    if (!planDef || planDef.key === "free") {
      return { error: "Invalid plan selection." };
    }

    const appUrl = process.env.SHOPIFY_APP_URL || "";
    const returnUrl = `${appUrl}/app/plan?plan=${planDef.key}`;

    const { confirmationUrl, error } = await createSubscription(
      { graphql: admin.graphql.bind(admin) },
      planDef,
      returnUrl,
    );

    if (error || !confirmationUrl) {
      return { error: error ?? "Failed to create subscription." };
    }

    return redirect(confirmationUrl);
  }

  if (intent === "downgrade") {
    const activeSub = await getActiveSubscription({ graphql: admin.graphql.bind(admin) });
    if (activeSub) {
      await cancelSubscription({ graphql: admin.graphql.bind(admin) }, activeSub.id);
    }
    await updateShopPlan(shop.id, "free");
    return redirect("/app/plan");
  }

  return { error: "Unknown action." };
};

function PlanCard({
  plan,
  isCurrent,
  isLower,
  busy,
}: {
  plan: (typeof PLANS)[number];
  isCurrent: boolean;
  isLower: boolean;
  busy: boolean;
}) {
  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingLg">
            {plan.name}
          </Text>
          {plan.badge && (
            <Badge tone={plan.key === "pro" ? "success" : plan.key === "scale" ? "info" : undefined}>
              {plan.badge}
            </Badge>
          )}
        </InlineStack>

        <InlineStack gap="100" blockAlign="end">
          <Text as="p" variant="heading2xl">
            {plan.price === 0 ? "Free" : `$${plan.price}`}
          </Text>
          {plan.price > 0 && (
            <Text as="p" variant="bodySm" tone="subdued">
              /month
            </Text>
          )}
        </InlineStack>

        {plan.price > 0 && plan.trialDays > 0 && (
          <Text as="p" variant="bodySm" tone="success">
            {plan.trialDays}-day free trial
          </Text>
        )}

        <Divider />

        <BlockStack gap="200">
          {plan.features.map((f, i) => (
            <InlineStack key={i} gap="200" blockAlign="center">
              <Text as="span" variant="bodySm" tone="success">
                ✓
              </Text>
              <Text as="span" variant="bodySm">
                {f}
              </Text>
            </InlineStack>
          ))}
        </BlockStack>

        <Box paddingBlockStart="200">
          {isCurrent ? (
            <Button disabled fullWidth>
              Current Plan
            </Button>
          ) : isLower ? (
            <Form method="post">
              <input type="hidden" name="intent" value="downgrade" />
              <Button submit fullWidth tone="critical" loading={busy}>
                Downgrade to {plan.name}
              </Button>
            </Form>
          ) : (
            <Form method="post">
              <input type="hidden" name="intent" value="upgrade" />
              <input type="hidden" name="plan" value={plan.key} />
              <Button submit fullWidth variant="primary" loading={busy}>
                Upgrade to {plan.name}
              </Button>
            </Form>
          )}
        </Box>
      </BlockStack>
    </Card>
  );
}

export default function PlanPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  const currentPlanDef = getPlanDef(data.currentPlan);
  const planOrder = ["free", "pro", "scale"];
  const currentIndex = planOrder.indexOf(data.currentPlan);

  return (
    <Page>
      <TitleBar title="Plan & billing" />
      <BlockStack gap="500">
        {actionData?.error && (
          <Banner tone="critical">
            <p>{actionData.error}</p>
          </Banner>
        )}

        <Card>
          <BlockStack gap="300">
            <InlineStack gap="200" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Current plan
              </Text>
              <Badge tone="success">{currentPlanDef.name}</Badge>
            </InlineStack>
            <Text as="p" variant="bodyMd" tone="subdued">
              Store: {data.shopDomain} · Unlimited orders on all plans — no per-order fees
            </Text>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Last 30 days
            </Text>
            <InlineGrid columns={{ xs: 2, md: 4 }} gap="300">
              <BlockStack gap="100">
                <Text as="p" variant="headingLg">{String(data.stats.drawerOpens)}</Text>
                <Text as="p" variant="bodySm" tone="subdued">Drawer opens</Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="p" variant="headingLg">{String(data.stats.upsellAdds)}</Text>
                <Text as="p" variant="bodySm" tone="subdued">Upsell adds</Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="p" variant="headingLg">{String(data.stats.checkoutClicks)}</Text>
                <Text as="p" variant="bodySm" tone="subdued">Checkout clicks</Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="p" variant="headingLg">{String(data.stats.ordersCompleted)}</Text>
                <Text as="p" variant="bodySm" tone="subdued">Orders completed</Text>
              </BlockStack>
            </InlineGrid>
          </BlockStack>
        </Card>

        <Text as="h2" variant="headingLg">
          Compare plans
        </Text>

        <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
          {data.plans.map((plan) => {
            const idx = planOrder.indexOf(plan.key);
            return (
              <PlanCard
                key={plan.key}
                plan={plan}
                isCurrent={plan.key === data.currentPlan}
                isLower={idx < currentIndex}
                busy={busy}
              />
            );
          })}
        </InlineGrid>

        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              💡 Why Cart Magic?
            </Text>
            <Text as="p" variant="bodyMd">
              Flat pricing — unlimited orders. No per-order fees, no growth penalties. 
              Most competitors charge $15–$35/mo for the same features. Cart Magic delivers 
              the full package starting at just $6.99/mo.
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
