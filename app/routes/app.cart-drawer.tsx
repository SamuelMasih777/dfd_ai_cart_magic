import { useState, useCallback } from "react";
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
  Checkbox,
  Box,
  Button,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { ensureShopForSession } from "../lib/shop.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);
  const cs = shop.cartSettings;
  return {
    drawerEnabled: cs?.drawerEnabled ?? true,
    announcementText: cs?.announcementText ?? "",
    stickyAtcEnabled: cs?.stickyAtcEnabled ?? false,
    expressCheckoutEnabled: cs?.expressCheckoutEnabled ?? false,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);
  const form = await request.formData();

  const drawerEnabled = form.has("drawerEnabled");
  const announcementText = String(form.get("announcementText") ?? "");
  const stickyAtcEnabled = form.has("stickyAtcEnabled");
  const expressCheckoutEnabled = form.has("expressCheckoutEnabled");

  await prisma.cartSettings.update({
    where: { shopId: shop.id },
    data: {
      drawerEnabled,
      announcementText: announcementText || null,
      stickyAtcEnabled,
      expressCheckoutEnabled,
    },
  });

  return redirect("/app/cart-drawer");
};

export default function CartDrawerSettings() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  const [drawerEnabled, setDrawerEnabled] = useState(data.drawerEnabled);
  const [announcementText, setAnnouncementText] = useState(data.announcementText);
  const [stickyAtcEnabled, setStickyAtcEnabled] = useState(data.stickyAtcEnabled);
  const [expressCheckoutEnabled, setExpressCheckoutEnabled] = useState(data.expressCheckoutEnabled);

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
                    checked={drawerEnabled}
                    onChange={(checked) => setDrawerEnabled(checked)}
                  />
                  <TextField
                    label="Announcement bar"
                    name="announcementText"
                    multiline={3}
                    autoComplete="off"
                    value={announcementText}
                    onChange={(value) => setAnnouncementText(value)}
                    helpText="Displayed at the top of the cart drawer (e.g. promotions, free shipping info)"
                  />
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Instant checkout layer
                  </Text>
                  <Checkbox
                    label="Sticky add-to-cart on product pages"
                    name="stickyAtcEnabled"
                    checked={stickyAtcEnabled}
                    onChange={(checked) => setStickyAtcEnabled(checked)}
                  />
                  <Checkbox
                    label="Show express checkout row in drawer (Shop Pay / wallets when theme supports checkout)"
                    name="expressCheckoutEnabled"
                    checked={expressCheckoutEnabled}
                    onChange={(checked) => setExpressCheckoutEnabled(checked)}
                  />
                </BlockStack>
              </Card>
              <Box paddingBlockEnd="400">
                <InlineStack gap="300">
                  <Button submit variant="primary" loading={busy}>
                    Save
                  </Button>
                  <Button url="/app/design">
                    Design & branding →
                  </Button>
                </InlineStack>
              </Box>
            </BlockStack>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Customize appearance
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Colors, fonts, drawer width, and checkout button text have moved
                  to the dedicated Design & Branding page.
                </Text>
                <Box paddingBlockStart="200">
                  <Button url="/app/design" variant="primary">
                    Open Design & Branding
                  </Button>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Form>
    </Page>
  );
}
