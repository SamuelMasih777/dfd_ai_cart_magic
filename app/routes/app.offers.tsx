import { useCallback, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  TextField,
  Checkbox,
  Button,
  InlineStack,
  Box,
  Banner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { ensureShopForSession } from "../lib/shop.server";
import { resolveGiftFromProductGid } from "../lib/gift-product.server";
import prisma from "../db.server";

const MAX_GIFTS = 3;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);
  return {
    giftRules: shop.giftRules.map((g) => ({
      id: g.id,
      giftProductId: g.giftProductId,
      minCartValue: g.minCartValue.toString(),
      autoAdd: g.autoAdd,
      enabled: g.enabled,
      meta: g.giftProductMeta as { title?: string; handle?: string } | null,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "delete") {
    const id = String(form.get("id") ?? "");
    if (id) {
      await prisma.giftRule.deleteMany({
        where: { id, shopId: shop.id },
      });
    }
    return redirect("/app/offers");
  }

  if (intent === "create") {
    const count = await prisma.giftRule.count({ where: { shopId: shop.id } });
    if (count >= MAX_GIFTS) {
      return json({ error: `Maximum ${MAX_GIFTS} gift offers.` }, { status: 400 });
    }
    const productGid = String(form.get("productGid") ?? "");
    const minCartValue = Number(form.get("minCartValue") ?? "0");
    const autoAdd = form.has("autoAdd");
    const enabled = form.has("enabled");

    if (!productGid.startsWith("gid://")) {
      return json({ error: "Pick a product." }, { status: 400 });
    }

    const resolved = await resolveGiftFromProductGid(
      admin.graphql.bind(admin),
      productGid,
    );
    if (!resolved) {
      return json({ error: "Could not resolve product." }, { status: 400 });
    }

    await prisma.giftRule.create({
      data: {
        shopId: shop.id,
        giftProductId: resolved.giftProductId,
        giftVariantId: resolved.giftVariantId,
        minCartValue,
        autoAdd,
        enabled,
        giftProductMeta: resolved.meta,
      },
    });

    return redirect("/app/offers");
  }

  if (intent === "toggle") {
    const id = String(form.get("id") ?? "");
    const enabled = form.has("enabled");
    if (id) {
      await prisma.giftRule.updateMany({
        where: { id, shopId: shop.id },
        data: { enabled },
      });
    }
    return redirect("/app/offers");
  }

  return redirect("/app/offers");
};

export default function OffersPage() {
  const data = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  const [productGid, setProductGid] = useState("");
  const [productLabel, setProductLabel] = useState("");
  const [minCartValue, setMinCartValue] = useState("50");
  const [autoAdd, setAutoAdd] = useState(true);
  const [enabled, setEnabled] = useState(true);

  const pickProduct = useCallback(async () => {
    const raw = await shopify.resourcePicker({
      type: "product",
      multiple: false,
    });
    if (!raw) return;
    const selection =
      raw &&
      typeof raw === "object" &&
      "selection" in raw &&
      Array.isArray((raw as { selection: unknown }).selection)
        ? (raw as { selection: Array<{ id: string; title?: string }> }).selection
        : Array.isArray(raw)
          ? (raw as Array<{ id: string; title?: string }>)
          : [];
    const first = selection[0];
    if (first?.id) {
      setProductGid(first.id);
      setProductLabel(first.title ?? first.id);
    }
  }, [shopify]);

  return (
    <Page>
      <TitleBar title="Offer system (free gift)" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Banner tone="info">
              <p>
                v1: free gift at cart threshold. BOGO and advanced offers ship in
                v1.1.
              </p>
            </Banner>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Add free gift rule
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Up to {MAX_GIFTS} rules. The storefront applies the highest
                  threshold the cart qualifies for.
                </Text>
                <form method="post">
                  <input type="hidden" name="intent" value="create" />
                  <input type="hidden" name="productGid" value={productGid} />
                  <InlineStack gap="200" blockAlign="center">
                    <Button
                      onClick={pickProduct}
                      disabled={busy || data.giftRules.length >= MAX_GIFTS}
                    >
                      Pick gift product
                    </Button>
                    <Text as="span" variant="bodySm">
                      {productLabel || "(no product selected)"}
                    </Text>
                  </InlineStack>
                  <Box paddingBlockStart="300">
                    <TextField
                      label="Minimum cart value"
                      name="minCartValue"
                      type="number"
                      autoComplete="off"
                      value={minCartValue}
                      onChange={(val) => setMinCartValue(val)}
                      min={0}
                      step={0.01}
                    />
                  </Box>
                  <Box paddingBlockStart="300">
                    <Checkbox
                      label="Auto-add gift when threshold is met"
                      name="autoAdd"
                      checked={autoAdd}
                      onChange={(val) => setAutoAdd(val)}
                    />
                  </Box>
                  <Box paddingBlockStart="300">
                    <Checkbox
                      label="Enabled"
                      name="enabled"
                      checked={enabled}
                      onChange={(val) => setEnabled(val)}
                    />
                  </Box>
                  <Box paddingBlockStart="400">
                    <button
                      type="submit"
                      disabled={
                        busy ||
                        !productGid ||
                        data.giftRules.length >= MAX_GIFTS
                      }
                      style={{
                        padding: "8px 16px",
                        background: "#111",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        cursor: busy ? "wait" : "pointer",
                      }}
                    >
                      {busy ? "Saving…" : "Add rule"}
                    </button>
                  </Box>
                </form>
              </BlockStack>
            </Card>

            {data.giftRules.length > 0 && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Active rules
                  </Text>
                  {data.giftRules.map((r) => (
                    <Box
                      key={r.id}
                      padding="300"
                      background="bg-surface-secondary"
                      borderRadius="200"
                    >
                      <BlockStack gap="200">
                        <Text as="p" variant="bodyMd">
                          <strong>
                            {r.meta?.title || r.meta?.handle || "Gift"}
                          </strong>{" "}
                          — min{" "}
                          <strong>{r.minCartValue}</strong> · auto-add{" "}
                          {r.autoAdd ? "on" : "off"}
                        </Text>
                        <InlineStack gap="300">
                          <form method="post">
                            <input type="hidden" name="intent" value="toggle" />
                            <input type="hidden" name="id" value={r.id} />
                            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input
                                type="checkbox"
                                name="enabled"
                                defaultChecked={r.enabled}
                              />
                              <span>Enabled</span>
                            </label>
                            <button
                              type="submit"
                              disabled={busy}
                              style={{
                                marginTop: 8,
                                padding: "6px 12px",
                                borderRadius: 8,
                                cursor: busy ? "wait" : "pointer",
                              }}
                            >
                              Update
                            </button>
                          </form>
                          <form method="post">
                            <input type="hidden" name="intent" value="delete" />
                            <input type="hidden" name="id" value={r.id} />
                            <button
                              type="submit"
                              disabled={busy}
                              style={{
                                padding: "6px 12px",
                                color: "#bf0711",
                                background: "transparent",
                                border: "1px solid #bf0711",
                                borderRadius: 8,
                                cursor: busy ? "wait" : "pointer",
                              }}
                            >
                              Delete
                            </button>
                          </form>
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  ))}
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
