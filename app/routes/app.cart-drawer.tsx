import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  TextField,
  Checkbox,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { DEFAULT_DESIGN_CONFIG, ensureShopForSession } from "../lib/shop.server";
import prisma from "../db.server";

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
    drawerEnabled: cs?.drawerEnabled ?? true,
    announcementText: cs?.announcementText ?? "",
    stickyAtcEnabled: cs?.stickyAtcEnabled ?? false,
    expressCheckoutEnabled: cs?.expressCheckoutEnabled ?? false,
    design,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);
  const form = await request.formData();

  const drawerEnabled = form.has("drawerEnabled");
  const announcementText = String(form.get("announcementText") ?? "");

  const design = {
    primaryColor: String(form.get("primaryColor") ?? DEFAULT_DESIGN_CONFIG.primaryColor),
    buttonTextColor: String(
      form.get("buttonTextColor") ?? DEFAULT_DESIGN_CONFIG.buttonTextColor,
    ),
    backgroundColor: String(
      form.get("backgroundColor") ?? DEFAULT_DESIGN_CONFIG.backgroundColor,
    ),
    accentColor: String(form.get("accentColor") ?? DEFAULT_DESIGN_CONFIG.accentColor),
    buttonRadius: String(form.get("buttonRadius") ?? DEFAULT_DESIGN_CONFIG.buttonRadius),
    drawerWidth: String(form.get("drawerWidth") ?? DEFAULT_DESIGN_CONFIG.drawerWidth),
    fontFamily: String(form.get("fontFamily") ?? DEFAULT_DESIGN_CONFIG.fontFamily),
    checkoutButtonText: String(
      form.get("checkoutButtonText") ?? DEFAULT_DESIGN_CONFIG.checkoutButtonText,
    ),
  };

  const stickyAtcEnabled = form.has("stickyAtcEnabled");
  const expressCheckoutEnabled = form.has("expressCheckoutEnabled");

  await prisma.cartSettings.update({
    where: { shopId: shop.id },
    data: {
      drawerEnabled,
      announcementText: announcementText || null,
      stickyAtcEnabled,
      expressCheckoutEnabled,
      designConfig: design,
    },
  });

  return redirect("/app/cart-drawer");
};

export default function CartDrawerSettings() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  const d = data.design;

  return (
    <Page>
      <TitleBar title="Cart drawer" />
      <Form method="post">
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    General
                  </Text>
                  <Checkbox
                    label="Enable slide cart drawer"
                    name="drawerEnabled"
                    defaultChecked={data.drawerEnabled}
                  />
                  <Text as="h3" variant="headingSm">
                    Instant checkout layer
                  </Text>
                  <Checkbox
                    label="Sticky add-to-cart on product pages"
                    name="stickyAtcEnabled"
                    defaultChecked={data.stickyAtcEnabled}
                  />
                  <Checkbox
                    label="Show express checkout row in drawer (Shop Pay / wallets when theme supports checkout)"
                    name="expressCheckoutEnabled"
                    defaultChecked={data.expressCheckoutEnabled}
                  />
                  <TextField
                    label="Announcement bar"
                    name="announcementText"
                    multiline={3}
                    autoComplete="off"
                    defaultValue={data.announcementText}
                  />
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Design
                  </Text>
                  <TextField
                    label="Primary color"
                    name="primaryColor"
                    autoComplete="off"
                    defaultValue={d.primaryColor}
                  />
                  <TextField
                    label="Button text color"
                    name="buttonTextColor"
                    autoComplete="off"
                    defaultValue={d.buttonTextColor}
                  />
                  <TextField
                    label="Background color"
                    name="backgroundColor"
                    autoComplete="off"
                    defaultValue={d.backgroundColor}
                  />
                  <TextField
                    label="Accent color"
                    name="accentColor"
                    autoComplete="off"
                    defaultValue={d.accentColor}
                  />
                  <TextField
                    label="Button radius (e.g. 8px)"
                    name="buttonRadius"
                    autoComplete="off"
                    defaultValue={d.buttonRadius}
                  />
                  <TextField
                    label="Drawer width (e.g. 420px)"
                    name="drawerWidth"
                    autoComplete="off"
                    defaultValue={d.drawerWidth}
                  />
                  <TextField
                    label="Font family"
                    name="fontFamily"
                    autoComplete="off"
                    defaultValue={d.fontFamily}
                  />
                  <TextField
                    label="Checkout button text"
                    name="checkoutButtonText"
                    autoComplete="off"
                    defaultValue={d.checkoutButtonText}
                  />
                </BlockStack>
              </Card>
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
                  {busy ? "Saving…" : "Save"}
                </button>
              </Box>
            </BlockStack>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <Text as="h2" variant="headingMd">
                Preview
              </Text>
              <Box paddingBlockStart="400">
                <div
                  style={{
                    border: "1px solid #ccc",
                    borderRadius: d.buttonRadius,
                    maxWidth: d.drawerWidth,
                    background: d.backgroundColor,
                    color: d.primaryColor,
                    padding: 16,
                    fontFamily: d.fontFamily,
                  }}
                >
                  <div style={{ fontSize: 12, marginBottom: 8 }}>
                    {data.announcementText || "Announcement preview"}
                  </div>
                  <div
                    style={{
                      background: d.accentColor,
                      color: d.buttonTextColor,
                      padding: "12px",
                      borderRadius: d.buttonRadius,
                      textAlign: "center",
                    }}
                  >
                    {d.checkoutButtonText}
                  </div>
                </div>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
      </Form>
    </Page>
  );
}
