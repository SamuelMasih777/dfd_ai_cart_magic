import prisma from "../db.server";

/* ------------------------------------------------------------------ */
/*  Plan definitions — PRD §7                                         */
/* ------------------------------------------------------------------ */

export interface PlanDef {
  name: string;
  key: "free" | "pro" | "scale";
  price: number; // monthly USD
  trialDays: number;
  features: string[];
  badge?: string;
}

export const PLANS: PlanDef[] = [
  {
    name: "Free",
    key: "free",
    price: 0,
    trialDays: 0,
    badge: "Forever Free",
    features: [
      "Slide cart drawer",
      "Rewards bar (1 tier)",
      "Basic upsell (AI, 2 products max)",
      "Sticky Add-to-Cart",
      "Order note",
      "Cart Magic branding",
      "Community support",
    ],
  },
  {
    name: "Pro",
    key: "pro",
    price: 6.99,
    trialDays: 7,
    badge: "Most Popular",
    features: [
      "Everything in Free",
      "Full rewards bar (3 tiers)",
      "Smart AOV Suggest",
      "AI + Manual upsell (3 products)",
      "Free gift with purchase",
      "Discount code box",
      "Trust badges + countdown timer",
      "Rules engine (max 10 rules)",
      "ROI analytics dashboard",
      "No branding",
      "Email support",
    ],
  },
  {
    name: "Scale",
    key: "scale",
    price: 14.99,
    trialDays: 7,
    badge: "Best Value",
    features: [
      "Everything in Pro",
      "Express checkout in drawer",
      "Custom CSS override",
      "Multi-language strings",
      "Advanced analytics export",
      "Priority support (24h SLA)",
      "Early access to new features",
      "BOGO (when v1.1 ready)",
    ],
  },
];

export function getPlanDef(key: string): PlanDef {
  return PLANS.find((p) => p.key === key) ?? PLANS[0];
}

/* ------------------------------------------------------------------ */
/*  Feature gating                                                     */
/* ------------------------------------------------------------------ */

/** Features that each plan unlocks — used for client & server gating. */
export const PLAN_LIMITS: Record<
  string,
  {
    maxRewardTiers: number;
    maxUpsellProducts: number;
    manualUpsell: boolean;
    giftRules: boolean;
    discountBox: boolean;
    trustBadges: boolean;
    timer: boolean;
    rulesEngine: boolean;
    analytics: boolean;
    expressCheckout: boolean;
    customCss: boolean;
    multiLang: boolean;
    branding: boolean; // true = branding shown (free)
  }
> = {
  free: {
    maxRewardTiers: 1,
    maxUpsellProducts: 2,
    manualUpsell: false,
    giftRules: false,
    discountBox: false,
    trustBadges: false,
    timer: false,
    rulesEngine: false,
    analytics: false,
    expressCheckout: false,
    customCss: false,
    multiLang: false,
    branding: true,
  },
  pro: {
    maxRewardTiers: 3,
    maxUpsellProducts: 3,
    manualUpsell: true,
    giftRules: true,
    discountBox: true,
    trustBadges: true,
    timer: true,
    rulesEngine: true,
    analytics: true,
    expressCheckout: false,
    customCss: false,
    multiLang: false,
    branding: false,
  },
  scale: {
    maxRewardTiers: 3,
    maxUpsellProducts: 3,
    manualUpsell: true,
    giftRules: true,
    discountBox: true,
    trustBadges: true,
    timer: true,
    rulesEngine: true,
    analytics: true,
    expressCheckout: true,
    customCss: true,
    multiLang: true,
    branding: false,
  },
};

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function isFeatureAllowed(
  plan: string,
  feature: keyof (typeof PLAN_LIMITS)["free"],
): boolean {
  const limits = getPlanLimits(plan);
  const val = limits[feature];
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val > 0;
  return false;
}

/* ------------------------------------------------------------------ */
/*  Shopify Billing API helpers                                        */
/* ------------------------------------------------------------------ */

type AdminGql = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

/**
 * Create a Shopify app subscription (recurring charge).
 * Returns the confirmation URL that the merchant must visit to approve.
 */
export async function createSubscription(
  admin: AdminGql,
  plan: PlanDef,
  returnUrl: string,
): Promise<{ confirmationUrl: string | null; error: string | null }> {
  if (plan.key === "free") {
    return { confirmationUrl: null, error: "Free plan does not require a subscription." };
  }

  const response = await admin.graphql(
    `#graphql
      mutation AppSubscriptionCreate(
        $name: String!
        $returnUrl: URL!
        $trialDays: Int!
        $amount: Decimal!
        $currencyCode: CurrencyCode!
      ) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          trialDays: $trialDays
          test: true
          lineItems: [
            {
              plan: {
                appRecurringPricingDetails: {
                  price: { amount: $amount, currencyCode: $currencyCode }
                }
              }
            }
          ]
        ) {
          appSubscription {
            id
          }
          confirmationUrl
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        name: `Cart Magic ${plan.name}`,
        returnUrl,
        trialDays: plan.trialDays,
        amount: plan.price,
        currencyCode: "USD",
      },
    },
  );

  const json = (await response.json()) as {
    data?: {
      appSubscriptionCreate?: {
        appSubscription?: { id: string };
        confirmationUrl?: string;
        userErrors?: Array<{ field: string[]; message: string }>;
      };
    };
    errors?: unknown;
  };

  if (json.errors) {
    console.error("Billing GraphQL errors", json.errors);
    return { confirmationUrl: null, error: "GraphQL error" };
  }

  const result = json.data?.appSubscriptionCreate;
  if (result?.userErrors?.length) {
    const msg = result.userErrors.map((e) => e.message).join("; ");
    console.error("Billing user errors:", msg);
    return { confirmationUrl: null, error: msg };
  }

  return { confirmationUrl: result?.confirmationUrl ?? null, error: null };
}

/**
 * Update the shop's plan in the local DB after subscription confirmation.
 */
export async function updateShopPlan(
  shopId: string,
  plan: "free" | "pro" | "scale",
) {
  await prisma.shop.update({
    where: { id: shopId },
    data: { plan, planActive: true },
  });
}

/**
 * Cancel (downgrade to free) — cancel active Shopify subscription.
 */
export async function cancelSubscription(
  admin: AdminGql,
  subscriptionId: string,
): Promise<{ success: boolean; error: string | null }> {
  const response = await admin.graphql(
    `#graphql
      mutation AppSubscriptionCancel($id: ID!) {
        appSubscriptionCancel(id: $id) {
          appSubscription {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
    { variables: { id: subscriptionId } },
  );

  const json = (await response.json()) as {
    data?: {
      appSubscriptionCancel?: {
        userErrors?: Array<{ field: string[]; message: string }>;
      };
    };
    errors?: unknown;
  };

  if (json.errors) {
    return { success: false, error: "GraphQL error" };
  }

  const errors = json.data?.appSubscriptionCancel?.userErrors;
  if (errors?.length) {
    return { success: false, error: errors.map((e) => e.message).join("; ") };
  }

  return { success: true, error: null };
}

/**
 * Get the shop's active subscription ID from Shopify.
 */
export async function getActiveSubscription(
  admin: AdminGql,
): Promise<{ id: string; name: string; status: string } | null> {
  const response = await admin.graphql(
    `#graphql
      query ActiveSubscription {
        appInstallation {
          activeSubscriptions {
            id
            name
            status
            lineItems {
              plan {
                pricingDetails {
                  ... on AppRecurringPricing {
                    price {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }`,
  );

  const json = (await response.json()) as {
    data?: {
      appInstallation?: {
        activeSubscriptions?: Array<{
          id: string;
          name: string;
          status: string;
        }>;
      };
    };
  };

  const subs = json.data?.appInstallation?.activeSubscriptions;
  if (!subs?.length) return null;

  return subs.find((s) => s.status === "ACTIVE") ?? subs[0] ?? null;
}
