import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  Select,
  TextField,
  Checkbox,
  Button,
  InlineStack,
  Box,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { ensureShopForSession } from "../lib/shop.server";
import prisma from "../db.server";

const MAX_RULES = 10;

type RuleRow = {
  conditionType: string;
  conditionValue: string;
  actionType: string;
  actionValue: string;
  enabled: boolean;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);
  const rows = shop.cartRules
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      conditionType: r.conditionType,
      conditionValue: r.conditionValue ?? "",
      actionType: r.actionType,
      actionValue: r.actionValue ?? "",
      enabled: r.enabled,
    }));
  return {
    rules: rows,
    rulesEngineEnabled: shop.cartSettings?.rulesEngineEnabled ?? false,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);
  const form = await request.formData();
  const rulesJson = String(form.get("rulesJson") ?? "[]");
  const rulesEngineEnabled = form.has("rulesEngineEnabled");

  let parsed: RuleRow[];
  try {
    parsed = JSON.parse(rulesJson) as RuleRow[];
  } catch {
    return redirect("/app/rules");
  }

  if (!Array.isArray(parsed) || parsed.length > MAX_RULES) {
    return redirect("/app/rules");
  }

  await prisma.$transaction([
    prisma.cartRule.deleteMany({ where: { shopId: shop.id } }),
    ...(parsed.length
      ? [
          prisma.cartRule.createMany({
            data: parsed.map((r, i) => ({
              shopId: shop.id,
              position: i + 1,
              conditionType: r.conditionType || "cart_value_gt",
              conditionValue: r.conditionValue || null,
              actionType: r.actionType || "show_upsell_product",
              actionValue: r.actionValue || null,
              enabled: r.enabled !== false,
            })),
          }),
        ]
      : []),
  ]);

  await prisma.cartSettings.update({
    where: { shopId: shop.id },
    data: { rulesEngineEnabled },
  });

  return redirect("/app/rules");
};

export default function RulesPage() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  const [rules, setRules] = useState<RuleRow[]>(data.rules as RuleRow[]);

  const rulesSignature = useMemo(
    () => JSON.stringify(data.rules),
    [data.rules],
  );
  useEffect(() => {
    setRules(data.rules as RuleRow[]);
  }, [rulesSignature]);

  const rulesJson = useMemo(() => JSON.stringify(rules), [rules]);

  const addRow = () => {
    if (rules.length >= MAX_RULES) return;
    setRules((r) => [
      ...r,
      {
        conditionType: "cart_value_gt",
        conditionValue: "",
        actionType: "show_upsell_product",
        actionValue: "",
        enabled: true,
      },
    ]);
  };

  const removeRow = (index: number) => {
    setRules((r) => r.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, patch: Partial<RuleRow>) => {
    setRules((r) =>
      r.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  return (
    <Page>
      <TitleBar title="Cart rules engine" />
      <Layout>
        <Layout.Section>
          <form method="post">
            <input type="hidden" name="rulesJson" value={rulesJson} />
            <BlockStack gap="400">
              <Banner tone="info">
                <p>
                  IF → THEN rules (max {MAX_RULES}). Evaluated on the storefront
                  in order. No AND/OR nesting in v1.
                </p>
              </Banner>
              <Card>
                <BlockStack gap="400">
                  <Checkbox
                    label="Enable rules engine on storefront"
                    name="rulesEngineEnabled"
                    defaultChecked={data.rulesEngineEnabled}
                  />
                  {rules.map((row, index) => (
                    <Box
                      key={index}
                      padding="300"
                      background="bg-surface-secondary"
                      borderRadius="200"
                    >
                      <BlockStack gap="300">
                        <Text as="p" variant="headingSm">
                          Rule {index + 1}
                        </Text>
                        <Select
                          label="If"
                          options={[
                            {
                              label: "Cart value greater than ($)",
                              value: "cart_value_gt",
                            },
                            {
                              label: "Product in cart (product id)",
                              value: "product_in_cart",
                            },
                            {
                              label: "Returning visitor",
                              value: "returning_customer",
                            },
                          ]}
                          value={row.conditionType}
                          onChange={(v) =>
                            updateRow(index, { conditionType: v })
                          }
                        />
                        {row.conditionType !== "returning_customer" && (
                          <TextField
                            label="Condition value"
                            value={row.conditionValue}
                            onChange={(v) =>
                              updateRow(index, { conditionValue: v })
                            }
                            autoComplete="off"
                          />
                        )}
                        <Select
                          label="Then"
                          options={[
                            {
                              label: "Show upsell (product GID or id)",
                              value: "show_upsell_product",
                            },
                            { label: "Show offer banner", value: "show_offer" },
                            {
                              label: "Highlight discount area",
                              value: "apply_discount",
                            },
                          ]}
                          value={row.actionType}
                          onChange={(v) => updateRow(index, { actionType: v })}
                        />
                        <TextField
                          label="Action value (message or product id)"
                          value={row.actionValue}
                          onChange={(v) => updateRow(index, { actionValue: v })}
                          autoComplete="off"
                        />
                        <Checkbox
                          label="Enabled"
                          checked={row.enabled}
                          onChange={(checked) =>
                            updateRow(index, { enabled: checked })
                          }
                        />
                        <Button
                          type="button"
                          tone="critical"
                          onClick={() => removeRow(index)}
                          disabled={busy}
                        >
                          Remove rule
                        </Button>
                      </BlockStack>
                    </Box>
                  ))}
                  <InlineStack gap="200">
                    <Button
                      type="button"
                      onClick={addRow}
                      disabled={busy || rules.length >= MAX_RULES}
                    >
                      Add rule
                    </Button>
                  </InlineStack>
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
                {busy ? "Saving…" : "Save rules"}
              </button>
            </BlockStack>
          </form>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
