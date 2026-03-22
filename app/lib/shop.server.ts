import { Prisma } from "@prisma/client";
import prisma from "../db.server";

/** Minimal session fields used after OAuth */
type SessionLike = { shop: string; accessToken?: string | null };

export const DEFAULT_DESIGN_CONFIG = {
  primaryColor: "#000000",
  buttonTextColor: "#ffffff",
  backgroundColor: "#ffffff",
  accentColor: "#d44c2b",
  buttonRadius: "8px",
  drawerWidth: "420px",
  fontFamily: "inherit",
  checkoutButtonText: "Checkout",
} as const;

export function isValidShopDomain(shop: string | null | undefined): boolean {
  if (!shop || typeof shop !== "string") return false;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop.trim());
}

const includeShop = {
  cartSettings: true,
  upsellRule: true,
  rewardTiers: { orderBy: { position: "asc" as const } },
  giftRules: { orderBy: { minCartValue: "desc" as const } },
  cartRules: { orderBy: { position: "asc" as const } },
} as const;

/**
 * Upsert Shop row + CartSettings + default UpsellRule after OAuth.
 * Uses upserts so concurrent requests (afterAuth + loaders) never duplicate `shop_domain`.
 */
export async function ensureShopForSession(session: SessionLike) {
  const shopDomain = session.shop.toLowerCase();
  const accessToken = session.accessToken;
  if (!accessToken) {
    throw new Response("Missing session access token", { status: 401 });
  }

  await prisma.shop.upsert({
    where: { shopDomain },
    create: {
      shopDomain,
      accessToken,
      plan: "free",
      planActive: true,
      uninstalledAt: null,
    },
    update: {
      accessToken,
      planActive: true,
      uninstalledAt: null,
    },
  });

  let shop = await prisma.shop.findUniqueOrThrow({
    where: { shopDomain },
    include: includeShop,
  });

  if (!shop.cartSettings) {
    try {
      await prisma.cartSettings.create({
        data: {
          shopId: shop.id,
          drawerEnabled: true,
          designConfig: { ...DEFAULT_DESIGN_CONFIG },
        },
      });
    } catch (e) {
      if (
        !(e instanceof Prisma.PrismaClientKnownRequestError) ||
        e.code !== "P2002"
      ) {
        throw e;
      }
    }
  }

  if (!shop.upsellRule) {
    try {
      await prisma.upsellRule.create({
        data: {
          shopId: shop.id,
          ruleType: "ai",
          maxProducts: 3,
          displayStyle: "carousel",
          enabled: false,
          showIfInCart: false,
        },
      });
    } catch (e) {
      if (
        !(e instanceof Prisma.PrismaClientKnownRequestError) ||
        e.code !== "P2002"
      ) {
        throw e;
      }
    }
  }

  return prisma.shop.findUniqueOrThrow({
    where: { shopDomain },
    include: includeShop,
  });
}

export async function getShopByDomain(shopDomain: string) {
  if (!isValidShopDomain(shopDomain)) return null;
  const normalized = shopDomain.toLowerCase();
  return prisma.shop.findUnique({
    where: { shopDomain: normalized },
    include: {
      cartSettings: true,
      upsellRule: true,
      rewardTiers: { orderBy: { position: "asc" } },
      giftRules: { orderBy: { minCartValue: "desc" } },
      cartRules: { orderBy: { position: "asc" } },
    },
  });
}

export function buildWidgetConfig(shop: {
  id: string;
  shopDomain: string;
  plan: string;
  planActive: boolean;
  uninstalledAt: Date | null;
  cartSettings: {
    drawerEnabled: boolean;
    stickyAtcEnabled: boolean;
    expressCheckoutEnabled: boolean;
    discountBoxEnabled: boolean;
    orderNoteEnabled: boolean;
    termsCheckboxEnabled: boolean;
    timerEnabled: boolean;
    timerMinutes: number | null;
    trustBadgesEnabled: boolean;
    aiUpsellEnabled: boolean;
    rulesEngineEnabled: boolean;
    designConfig: unknown;
    announcementText: string | null;
  } | null;
  upsellRule: {
    ruleType: string;
    productIds: string[];
    maxProducts: number;
    displayStyle: string;
    showIfInCart: boolean;
    enabled: boolean;
    manualProductsMeta?: unknown | null;
  } | null;
  rewardTiers: Array<{
    position: number;
    thresholdAmount: { toString(): string };
    rewardType: string;
    rewardLabel: string | null;
    enabled: boolean;
  }>;
  giftRules: Array<{
    id: string;
    giftProductId: string;
    giftVariantId: string | null;
    minCartValue: { toString(): string };
    autoAdd: boolean;
    enabled: boolean;
    giftProductMeta: unknown | null;
  }>;
  cartRules: Array<{
    position: number;
    conditionType: string;
    conditionValue: string | null;
    actionType: string;
    actionValue: string | null;
    enabled: boolean;
  }>;
}) {
  const installed =
    shop.planActive && !shop.uninstalledAt && shop.cartSettings !== null;

  const design = {
    ...DEFAULT_DESIGN_CONFIG,
    ...(typeof shop.cartSettings?.designConfig === "object" &&
    shop.cartSettings.designConfig !== null
      ? (shop.cartSettings.designConfig as Record<string, string>)
      : {}),
  };

  const upsell = shop.upsellRule;
  const cs = shop.cartSettings;
  const manualMeta = upsell?.manualProductsMeta as
    | { products?: Array<{ id: string; handle: string; numericId?: string }> }
    | null
    | undefined;

  const giftRulesOut = (shop.giftRules ?? [])
    .filter((g) => g.enabled)
    .map((g) => {
      const meta = g.giftProductMeta as
        | { handle?: string; variantNumericId?: string; title?: string }
        | null
        | undefined;
      return {
        id: g.id,
        giftProductId: g.giftProductId,
        giftVariantId: g.giftVariantId,
        minCartValue: Number(g.minCartValue.toString()),
        autoAdd: g.autoAdd,
        meta: meta
          ? {
              handle: meta.handle ?? "",
              variantNumericId: meta.variantNumericId ?? "",
              title: meta.title ?? "",
            }
          : null,
      };
    });

  const firstGift = giftRulesOut[0] ?? null;

  const cartRulesOut = (shop.cartRules ?? [])
    .filter((r) => r.enabled)
    .map((r) => ({
      position: r.position,
      if: r.conditionType,
      val: r.conditionValue ?? "",
      then: r.actionType,
      action: r.actionValue ?? "",
    }));

  return {
    enabled: installed && (shop.cartSettings?.drawerEnabled ?? true),
    shopDomain: shop.shopDomain,
    plan: shop.plan,
    design: {
      primaryColor: design.primaryColor,
      buttonTextColor: design.buttonTextColor,
      backgroundColor: design.backgroundColor,
      accentColor: design.accentColor,
      buttonRadius: design.buttonRadius,
      drawerWidth: design.drawerWidth,
      fontFamily: design.fontFamily,
      checkoutButtonText: design.checkoutButtonText,
    },
    features: {
      drawer: shop.cartSettings?.drawerEnabled ?? true,
      rewardsBar: true,
      upsell: upsell?.enabled ?? false,
      giftRule: giftRulesOut.length > 0,
      discountBox: cs?.discountBoxEnabled ?? false,
      timer: cs?.timerEnabled ?? false,
      trustBadges: cs?.trustBadgesEnabled ?? false,
      orderNote: cs?.orderNoteEnabled ?? false,
      termsCheckbox: cs?.termsCheckboxEnabled ?? false,
      stickyAtc: cs?.stickyAtcEnabled ?? false,
      expressCheckout: cs?.expressCheckoutEnabled ?? false,
      rulesEngine: cs?.rulesEngineEnabled ?? false,
    },
    announcement: shop.cartSettings?.announcementText ?? "",
    rewardTiers: shop.rewardTiers
      .filter((t) => t.enabled)
      .map((t) => ({
        position: t.position,
        threshold: Number(t.thresholdAmount.toString()),
        rewardType: t.rewardType,
        label: t.rewardLabel ?? "",
      })),
    upsellRule: upsell
      ? {
          type: upsell.ruleType,
          maxProducts: upsell.maxProducts,
          style: upsell.displayStyle,
          showIfInCart: upsell.showIfInCart,
          productIds: upsell.productIds,
          manualProducts: manualMeta?.products ?? [],
        }
      : null,
    giftRules: giftRulesOut,
    giftRule: firstGift
      ? {
          productId: firstGift.giftProductId,
          variantId: firstGift.giftVariantId,
          minCartValue: firstGift.minCartValue,
          autoAdd: firstGift.autoAdd,
          meta: firstGift.meta,
        }
      : null,
    cartRules: cartRulesOut,
    timerMinutes: cs?.timerMinutes ?? 15,
  };
}
