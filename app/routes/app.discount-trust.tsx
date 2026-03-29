import { useState } from "react";
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
    discountBoxEnabled: cs?.discountBoxEnabled ?? false,
    orderNoteEnabled: cs?.orderNoteEnabled ?? false,
    termsCheckboxEnabled: cs?.termsCheckboxEnabled ?? false,
    timerEnabled: cs?.timerEnabled ?? false,
    timerMinutes: cs?.timerMinutes ?? 15,
    trustBadgesEnabled: cs?.trustBadgesEnabled ?? false,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopForSession(session);
  const form = await request.formData();

  const timerMinutes = Math.min(
    240,
    Math.max(1, Number(form.get("timerMinutes") ?? 15)),
  );

  await prisma.cartSettings.update({
    where: { shopId: shop.id },
    data: {
      discountBoxEnabled: form.has("discountBoxEnabled"),
      orderNoteEnabled: form.has("orderNoteEnabled"),
      termsCheckboxEnabled: form.has("termsCheckboxEnabled"),
      timerEnabled: form.has("timerEnabled"),
      timerMinutes,
      trustBadgesEnabled: form.has("trustBadgesEnabled"),
    },
  });

  return redirect("/app/discount-trust");
};

export default function DiscountTrustPage() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  const [discountBoxEnabled, setDiscountBoxEnabled] = useState(data.discountBoxEnabled);
  const [trustBadgesEnabled, setTrustBadgesEnabled] = useState(data.trustBadgesEnabled);
  const [timerEnabled, setTimerEnabled] = useState(data.timerEnabled);
  const [timerMinutes, setTimerMinutes] = useState(String(data.timerMinutes));
  const [orderNoteEnabled, setOrderNoteEnabled] = useState(data.orderNoteEnabled);
  const [termsCheckboxEnabled, setTermsCheckboxEnabled] = useState(data.termsCheckboxEnabled);

  return (
    <Page>
      <TitleBar title="Discount + trust & urgency" />
      <Form method="post">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Storefront toggles
                </Text>
                <Checkbox
                  label="Discount code box (Ajax cart)"
                  name="discountBoxEnabled"
                  checked={discountBoxEnabled}
                  onChange={(val) => setDiscountBoxEnabled(val)}
                />
                <Checkbox
                  label="Trust badges row"
                  name="trustBadgesEnabled"
                  checked={trustBadgesEnabled}
                  onChange={(val) => setTrustBadgesEnabled(val)}
                />
                <Checkbox
                  label="Countdown timer"
                  name="timerEnabled"
                  checked={timerEnabled}
                  onChange={(val) => setTimerEnabled(val)}
                />
                <TextField
                  label="Timer duration (minutes)"
                  name="timerMinutes"
                  type="number"
                  min={1}
                  max={240}
                  autoComplete="off"
                  value={timerMinutes}
                  onChange={(val) => setTimerMinutes(val)}
                />
                <Checkbox
                  label="Order note"
                  name="orderNoteEnabled"
                  checked={orderNoteEnabled}
                  onChange={(val) => setOrderNoteEnabled(val)}
                />
                <Checkbox
                  label="Require terms checkbox before checkout"
                  name="termsCheckboxEnabled"
                  checked={termsCheckboxEnabled}
                  onChange={(val) => setTermsCheckboxEnabled(val)}
                />
                <Box paddingBlockStart="200">
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
            </Card>
          </Layout.Section>
        </Layout>
      </Form>
    </Page>
  );
}
