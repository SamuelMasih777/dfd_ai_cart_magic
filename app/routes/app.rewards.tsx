import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useFetcher, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  TextField,
  Checkbox,
  Select,
  Button,
  Banner,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { ensureShopForSession } from "../lib/shop.server";
import { calculateAverageOrderValue } from "../lib/aov.server";
import prisma from "../db.server";

const REWARD_TYPES = [
  { label: "Free shipping", value: "free_shipping" },
  { label: "Discount %", value: "discount_percent" },
  { label: "Free gift", value: "free_gift" },
  { label: "Custom text", value: "custom" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);
  const tiers = [...shop.rewardTiers].sort((a, b) => a.position - b.position);
  const padded = [1, 2, 3].map((pos) => {
    const t = tiers.find((x) => x.position === pos);
    return {
      position: pos,
      enabled: t?.enabled ?? false,
      threshold: t ? String(t.thresholdAmount) : "",
      rewardType: t?.rewardType ?? "free_shipping",
      rewardLabel: t?.rewardLabel ?? "",
    };
  });
  return { tiers: padded };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "aov") {
    const { aov, orderCount } = await calculateAverageOrderValue(
      admin.graphql.bind(admin),
      30,
    );
    if (aov == null) {
      return json({
        ok: false as const,
        message:
          "No paid orders found in the last 30 days. Set tiers manually or wait for sales data.",
        orderCount,
      });
    }
    return json({
      ok: true as const,
      aov,
      orderCount,
      suggestions: [0.7 * aov, 1.0 * aov, 1.4 * aov],
    });
  }

  await prisma.rewardTier.deleteMany({ where: { shopId: shop.id } });

  for (let pos = 1; pos <= 3; pos++) {
    const enabled = form.has(`tier_${pos}_enabled`);
    const thresholdRaw = String(form.get(`tier_${pos}_threshold`) ?? "").trim();
    const rewardType = String(
      form.get(`tier_${pos}_rewardType`) ?? "free_shipping",
    );
    const rewardLabel = String(form.get(`tier_${pos}_rewardLabel`) ?? "").trim();

    if (!enabled || !thresholdRaw) continue;

    const threshold = Number(thresholdRaw);
    if (Number.isNaN(threshold) || threshold <= 0) continue;

    await prisma.rewardTier.create({
      data: {
        shopId: shop.id,
        position: pos,
        thresholdAmount: threshold,
        rewardType,
        rewardLabel: rewardLabel || null,
        enabled: true,
      },
    });
  }

  return redirect("/app/rewards");
};

export default function RewardsPage() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const fetcher = useFetcher<typeof action>();
  const busy = navigation.state !== "idle";
  const [suggested, setSuggested] = useState<[string, string, string] | null>(
    null,
  );

  useEffect(() => {
    if (
      fetcher.data &&
      "ok" in fetcher.data &&
      fetcher.data.ok &&
      fetcher.data.suggestions
    ) {
      const [a, b, c] = fetcher.data.suggestions;
      setSuggested([a.toFixed(2), b.toFixed(2), c.toFixed(2)]);
    }
  }, [fetcher.data]);

  return (
    <Page>
      <TitleBar title="Rewards progress bar" />
      <BlockStack gap="400">
        {fetcher.data && "ok" in fetcher.data && !fetcher.data.ok && (
          <Banner tone="warning">{fetcher.data.message}</Banner>
        )}
        {fetcher.data && "ok" in fetcher.data && fetcher.data.ok && (
          <Banner tone="success">
            Suggested thresholds from 30-day AOV ({fetcher.data.orderCount}{" "}
            orders). AOV ≈ {fetcher.data.aov.toFixed(2)}.
          </Banner>
        )}
        <Form method="post">
          <input type="hidden" name="intent" value="save" />
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Smart AOV suggest
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Uses paid orders from the last 30 days. Merchants on some
                    plans only see recent orders via the Admin API.
                  </Text>
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="aov" />
                    <Button
                      submit
                      loading={fetcher.state !== "idle"}
                    >
                      Smart AOV Suggest
                    </Button>
                  </fetcher.Form>
                </BlockStack>
              </Card>
              {data.tiers.map((tier) => (
                <Card key={tier.position}>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingMd">
                      Tier {tier.position}
                    </Text>
                    <Checkbox
                      label="Enabled"
                      name={`tier_${tier.position}_enabled`}
                      defaultChecked={tier.enabled}
                    />
                    <TextField
                      key={`th-${tier.position}-${suggested?.join("-") ?? tier.threshold}`}
                      label="Threshold (store currency)"
                      name={`tier_${tier.position}_threshold`}
                      autoComplete="off"
                      defaultValue={
                        suggested?.[tier.position - 1] ?? tier.threshold
                      }
                    />
                    <Select
                      label="Reward type"
                      name={`tier_${tier.position}_rewardType`}
                      options={REWARD_TYPES}
                      defaultValue={tier.rewardType}
                    />
                    <TextField
                      label="Label (shown in progress bar)"
                      name={`tier_${tier.position}_rewardLabel`}
                      autoComplete="off"
                      defaultValue={tier.rewardLabel}
                    />
                  </BlockStack>
                </Card>
              ))}
              <Box paddingBlockEnd="400">
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    padding: "8px 16px",
                    background: "#111",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: busy ? "wait" : "pointer",
                  }}
                >
                  {busy ? "Saving…" : "Save tiers"}
                </button>
              </Box>
            </Layout.Section>
          </Layout>
        </Form>
      </BlockStack>
    </Page>
  );
}
