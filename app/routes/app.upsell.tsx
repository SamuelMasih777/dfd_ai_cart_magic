import { useCallback, useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useLoaderData, useNavigation } from "@remix-run/react";
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
  InlineStack,
  Box,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { ensureShopForSession } from "../lib/shop.server";
import { resolveManualProducts } from "../lib/upsell-products.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);
  const u = shop.upsellRule;
  const meta = u?.manualProductsMeta as
    | { products?: Array<{ id: string; handle: string; numericId?: string }> }
    | null
    | undefined;
  return {
    ruleType: u?.ruleType ?? "ai",
    maxProducts: u?.maxProducts ?? 3,
    displayStyle: u?.displayStyle ?? "carousel",
    showIfInCart: u?.showIfInCart ?? false,
    enabled: u?.enabled ?? false,
    productIds: u?.productIds ?? [],
    manualProducts: meta?.products ?? [],
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);
  const form = await request.formData();

  const ruleType = String(form.get("ruleType") ?? "ai") as "ai" | "manual";
  const maxProducts = Math.min(
    3,
    Math.max(1, Number(form.get("maxProducts") ?? 3)),
  );
  const displayStyle = String(form.get("displayStyle") ?? "carousel");
  const showIfInCart = form.has("showIfInCart");
  const enabled = form.has("enabled");
  const productIdsRaw = String(form.get("productIds") ?? "");
  const productIds = productIdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let manualProductsMeta: any = null;

  if (ruleType === "manual" && productIds.length > 0) {
    const products = await resolveManualProducts(
      admin.graphql.bind(admin),
      productIds,
    );
    manualProductsMeta = { products };
  }

  await prisma.upsellRule.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      ruleType,
      productIds,
      maxProducts,
      displayStyle,
      showIfInCart,
      enabled,
      ...(manualProductsMeta ? { manualProductsMeta } : {}),
    },
    update: {
      ruleType,
      productIds,
      maxProducts,
      displayStyle,
      showIfInCart,
      enabled,
      manualProductsMeta: manualProductsMeta ?? null,
    },
  });

  await prisma.cartSettings.update({
    where: { shopId: shop.id },
    data: { aiUpsellEnabled: enabled },
  });

  return redirect("/app/upsell");
};

export default function UpsellPage() {
  const data = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  const [productIds, setProductIds] = useState<string[]>(data.productIds);
  const [manualProducts, setManualProducts] = useState(data.manualProducts);
  const [enabled, setEnabled] = useState(data.enabled);
  const [ruleType, setRuleType] = useState(data.ruleType);
  const [maxProducts, setMaxProducts] = useState(String(data.maxProducts));
  const [displayStyle, setDisplayStyle] = useState(data.displayStyle);
  const [showIfInCart, setShowIfInCart] = useState(data.showIfInCart);

  const pickProducts = useCallback(async () => {
    const raw = await shopify.resourcePicker({
      type: "product",
      multiple: 3,
    });
    if (!raw) return;
    const selection =
      raw &&
      typeof raw === "object" &&
      "selection" in raw &&
      Array.isArray((raw as { selection: unknown }).selection)
        ? (raw as { selection: Array<{ id: string; handle: string }> })
            .selection
        : Array.isArray(raw)
          ? (raw as Array<{ id: string; handle: string }>)
          : [];
    const ids = selection.map((s) => s.id);
    setProductIds(ids);
    setManualProducts(
      selection.map((s) => ({ id: s.id, handle: s.handle })),
    );
  }, [shopify]);

  const productIdsStr = useMemo(() => productIds.join(","), [productIds]);

  return (
    <Page>
      <TitleBar title="Smart upsell" />
      <form method="post">
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Smart Upsell Engine
                  </Text>
                  <Checkbox
                    label="Enable upsell in cart drawer"
                    name="enabled"
                    checked={enabled}
                    onChange={(checked) => setEnabled(checked)}
                  />
                  <Select
                    label="Mode"
                    name="ruleType"
                    options={[
                      { label: "AI (Shopify recommendations)", value: "ai" },
                      { label: "Manual (pick products)", value: "manual" },
                    ]}
                    value={ruleType}
                    onChange={(value) => setRuleType(value as "ai" | "manual")}
                  />
                  <Select
                    label="Max products"
                    name="maxProducts"
                    options={[
                      { label: "1", value: "1" },
                      { label: "2", value: "2" },
                      { label: "3", value: "3" },
                    ]}
                    value={maxProducts}
                    onChange={(value) => setMaxProducts(value)}
                  />
                  <Select
                    label="Layout"
                    name="displayStyle"
                    options={[
                      { label: "Carousel", value: "carousel" },
                      { label: "Block", value: "block" },
                    ]}
                    value={displayStyle}
                    onChange={(value) => setDisplayStyle(value)}
                  />
                  <Checkbox
                    label="Show upsell even if product is already in cart"
                    name="showIfInCart"
                    checked={showIfInCart}
                    onChange={(checked) => setShowIfInCart(checked)}
                  />
                  <input type="hidden" name="productIds" value={productIdsStr} />
                  <InlineStack gap="200" blockAlign="center">
                    <Button
                      onClick={pickProducts}
                      disabled={busy}
                    >
                      Pick products (manual mode)
                    </Button>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {productIds.length} selected
                    </Text>
                  </InlineStack>
                  {manualProducts.length > 0 && (
                    <Box
                      padding="300"
                      background="bg-surface-secondary"
                      borderRadius="200"
                    >
                      <BlockStack gap="100">
                        {manualProducts.map(
                          (p: { id: string; handle?: string }) => (
                            <Text key={p.id} as="span" variant="bodySm">
                              {p.handle ?? p.id}
                            </Text>
                          ),
                        )}
                      </BlockStack>
                    </Box>
                  )}
                </BlockStack>
              </Card>
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
                {busy ? "Saving…" : "Save"}
              </button>
            </BlockStack>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <Text as="h2" variant="headingMd">
                Preview
              </Text>
              <Box paddingBlockStart="300">
                <div
                  style={{
                    border: "1px dashed #ccc",
                    padding: 12,
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  {data.displayStyle === "carousel"
                    ? "Carousel layout"
                    : "Block layout"}{" "}
                  · up to {data.maxProducts} products
                </div>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
      </form>
    </Page>
  );
}
