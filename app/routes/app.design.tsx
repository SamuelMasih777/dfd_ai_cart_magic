import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  TextField,
  RangeSlider,
  Select,
  Button,
  Box,
  InlineStack,
  Banner,
  Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { DEFAULT_DESIGN_CONFIG, ensureShopForSession } from "../lib/shop.server";
import prisma from "../db.server";
import { useState, useCallback } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);
  const cs = shop.cartSettings;
  const design = {
    ...DEFAULT_DESIGN_CONFIG,
    ...(typeof cs?.designConfig === "object" && cs?.designConfig !== null
      ? (cs.designConfig as Record<string, string>)
      : {}),
  };
  return {
    design,
    announcementText: cs?.announcementText ?? "",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);
  const form = await request.formData();

  const intent = String(form.get("intent") ?? "save");

  let design: Record<string, string>;

  if (intent === "reset") {
    design = { ...DEFAULT_DESIGN_CONFIG };
  } else {
    design = {
      primaryColor: String(form.get("primaryColor") ?? DEFAULT_DESIGN_CONFIG.primaryColor),
      buttonTextColor: String(form.get("buttonTextColor") ?? DEFAULT_DESIGN_CONFIG.buttonTextColor),
      backgroundColor: String(form.get("backgroundColor") ?? DEFAULT_DESIGN_CONFIG.backgroundColor),
      accentColor: String(form.get("accentColor") ?? DEFAULT_DESIGN_CONFIG.accentColor),
      buttonRadius: String(form.get("buttonRadius") ?? DEFAULT_DESIGN_CONFIG.buttonRadius),
      drawerWidth: String(form.get("drawerWidth") ?? DEFAULT_DESIGN_CONFIG.drawerWidth),
      fontFamily: String(form.get("fontFamily") ?? DEFAULT_DESIGN_CONFIG.fontFamily),
      checkoutButtonText: String(
        form.get("checkoutButtonText") ?? DEFAULT_DESIGN_CONFIG.checkoutButtonText,
      ),
    };
  }

  await prisma.cartSettings.update({
    where: { shopId: shop.id },
    data: { designConfig: design },
  });

  return redirect("/app/design");
};

const FONT_OPTIONS = [
  { label: "Inherit (theme default)", value: "inherit" },
  { label: "Inter", value: "'Inter', sans-serif" },
  { label: "Roboto", value: "'Roboto', sans-serif" },
  { label: "Outfit", value: "'Outfit', sans-serif" },
  { label: "System UI", value: "system-ui, sans-serif" },
  { label: "Georgia (serif)", value: "Georgia, serif" },
];

export default function DesignPage() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  // Local state for live preview
  const [design, setDesign] = useState({ ...data.design });

  const update = useCallback((field: string, value: string) => {
    setDesign((prev) => ({ ...prev, [field]: value }));
  }, []);

  const drawerWidthNum = parseInt(design.drawerWidth, 10) || 420;

  return (
    <Page>
      <TitleBar title="Design & branding" />
      <Form method="post">
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Colors
                  </Text>
                  <InlineStack gap="400" wrap>
                    <div style={{ flex: "1 1 200px" }}>
                      <TextField
                        label="Primary color"
                        name="primaryColor"
                        autoComplete="off"
                        value={design.primaryColor}
                        onChange={(v) => update("primaryColor", v)}
                        prefix={
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 4,
                              backgroundColor: design.primaryColor,
                              border: "1px solid #ccc",
                            }}
                          />
                        }
                        connectedRight={
                          <input
                            type="color"
                            value={design.primaryColor}
                            onChange={(e) => update("primaryColor", e.target.value)}
                            style={{
                              width: 36,
                              height: 36,
                              padding: 0,
                              border: "none",
                              cursor: "pointer",
                              background: "transparent",
                            }}
                          />
                        }
                      />
                    </div>
                    <div style={{ flex: "1 1 200px" }}>
                      <TextField
                        label="Button text color"
                        name="buttonTextColor"
                        autoComplete="off"
                        value={design.buttonTextColor}
                        onChange={(v) => update("buttonTextColor", v)}
                        prefix={
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 4,
                              backgroundColor: design.buttonTextColor,
                              border: "1px solid #ccc",
                            }}
                          />
                        }
                        connectedRight={
                          <input
                            type="color"
                            value={design.buttonTextColor}
                            onChange={(e) => update("buttonTextColor", e.target.value)}
                            style={{
                              width: 36,
                              height: 36,
                              padding: 0,
                              border: "none",
                              cursor: "pointer",
                              background: "transparent",
                            }}
                          />
                        }
                      />
                    </div>
                  </InlineStack>
                  <InlineStack gap="400" wrap>
                    <div style={{ flex: "1 1 200px" }}>
                      <TextField
                        label="Background color"
                        name="backgroundColor"
                        autoComplete="off"
                        value={design.backgroundColor}
                        onChange={(v) => update("backgroundColor", v)}
                        prefix={
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 4,
                              backgroundColor: design.backgroundColor,
                              border: "1px solid #ccc",
                            }}
                          />
                        }
                        connectedRight={
                          <input
                            type="color"
                            value={design.backgroundColor}
                            onChange={(e) => update("backgroundColor", e.target.value)}
                            style={{
                              width: 36,
                              height: 36,
                              padding: 0,
                              border: "none",
                              cursor: "pointer",
                              background: "transparent",
                            }}
                          />
                        }
                      />
                    </div>
                    <div style={{ flex: "1 1 200px" }}>
                      <TextField
                        label="Accent color"
                        name="accentColor"
                        autoComplete="off"
                        value={design.accentColor}
                        onChange={(v) => update("accentColor", v)}
                        prefix={
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 4,
                              backgroundColor: design.accentColor,
                              border: "1px solid #ccc",
                            }}
                          />
                        }
                        connectedRight={
                          <input
                            type="color"
                            value={design.accentColor}
                            onChange={(e) => update("accentColor", e.target.value)}
                            style={{
                              width: 36,
                              height: 36,
                              padding: 0,
                              border: "none",
                              cursor: "pointer",
                              background: "transparent",
                            }}
                          />
                        }
                      />
                    </div>
                  </InlineStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Layout & typography
                  </Text>
                  <TextField
                    label="Button radius"
                    name="buttonRadius"
                    autoComplete="off"
                    value={design.buttonRadius}
                    onChange={(v) => update("buttonRadius", v)}
                    helpText="e.g. 8px, 12px, 999px (fully round)"
                  />
                  <input type="hidden" name="drawerWidth" value={`${drawerWidthNum}px`} />
                  <RangeSlider
                    label={`Drawer width: ${drawerWidthNum}px`}
                    min={380}
                    max={500}
                    step={10}
                    value={drawerWidthNum}
                    onChange={(v) => update("drawerWidth", `${v}px`)}
                    output
                  />
                  <Select
                    label="Font family"
                    name="fontFamily"
                    options={FONT_OPTIONS}
                    value={design.fontFamily}
                    onChange={(v) => update("fontFamily", v)}
                  />
                  <TextField
                    label="Checkout button text"
                    name="checkoutButtonText"
                    autoComplete="off"
                    value={design.checkoutButtonText}
                    onChange={(v) => update("checkoutButtonText", v)}
                  />
                </BlockStack>
              </Card>

              <InlineStack gap="300">
                <Button submit variant="primary" loading={busy}>
                  Save design
                </Button>
                <Button
                  submit
                  tone="critical"
                  loading={busy}
                  onClick={() => {
                    // set intent to reset via hidden input
                    const input = document.querySelector(
                      'input[name="intent"]',
                    ) as HTMLInputElement;
                    if (input) input.value = "reset";
                  }}
                >
                  Reset to defaults
                </Button>
                <input type="hidden" name="intent" value="save" />
              </InlineStack>
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Live preview
                </Text>
                <Box paddingBlockStart="200">
                  <div
                    style={{
                      border: "1px solid #e0e0e0",
                      borderRadius: 12,
                      overflow: "hidden",
                      maxWidth: 280,
                      boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
                    }}
                  >
                    {/* Drawer header */}
                    <div
                      style={{
                        background: design.backgroundColor,
                        fontFamily: design.fontFamily,
                        color: design.primaryColor,
                      }}
                    >
                      {/* Announcement bar */}
                      {data.announcementText && (
                        <div
                          style={{
                            background: design.accentColor,
                            color: design.buttonTextColor,
                            padding: "6px 12px",
                            fontSize: 11,
                            textAlign: "center",
                            fontWeight: 500,
                          }}
                        >
                          {data.announcementText}
                        </div>
                      )}

                      {/* Header */}
                      <div
                        style={{
                          padding: "14px 16px 10px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: 15 }}>
                          Your Cart (2)
                        </span>
                        <span style={{ fontSize: 18, cursor: "pointer" }}>✕</span>
                      </div>

                      {/* Rewards bar mock */}
                      <div style={{ padding: "10px 16px 6px" }}>
                        <div
                          style={{
                            height: 6,
                            borderRadius: 3,
                            background: "#eee",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: "65%",
                              height: "100%",
                              background: design.accentColor,
                              borderRadius: 3,
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#888",
                            marginTop: 3,
                          }}
                        >
                          $15 away from Free Shipping!
                        </div>
                      </div>

                      {/* Cart items mock */}
                      <div style={{ padding: "8px 16px" }}>
                        {[1, 2].map((i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              gap: 10,
                              padding: "8px 0",
                              borderBottom: "1px solid #f0f0f0",
                              alignItems: "center",
                            }}
                          >
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: parseInt(design.buttonRadius) / 2 || 4,
                                background: "#f5f5f5",
                                flexShrink: 0,
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 500 }}>
                                Product {i}
                              </div>
                              <div style={{ fontSize: 11, color: "#888" }}>
                                $29.99
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Subtotal + checkout */}
                      <div style={{ padding: "10px 16px 14px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 10,
                            fontWeight: 600,
                            fontSize: 14,
                          }}
                        >
                          <span>Subtotal</span>
                          <span>$59.98</span>
                        </div>
                        <div
                          style={{
                            background: design.accentColor,
                            color: design.buttonTextColor,
                            padding: "10px",
                            borderRadius: design.buttonRadius,
                            textAlign: "center",
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          {design.checkoutButtonText}
                        </div>
                      </div>
                    </div>
                  </div>
                </Box>

                <Banner tone="info">
                  <p>
                    This is a preview of your cart drawer styling. Changes update
                    in real-time. Click <strong>Save design</strong> to apply.
                  </p>
                </Banner>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Form>
    </Page>
  );
}
