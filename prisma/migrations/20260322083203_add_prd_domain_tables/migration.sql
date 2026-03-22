-- CreateTable
CREATE TABLE "shops" (
    "id" UUID NOT NULL,
    "shop_domain" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "plan_active" BOOLEAN NOT NULL DEFAULT true,
    "installed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalled_at" TIMESTAMPTZ(6),

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_settings" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "drawer_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sticky_atc_enabled" BOOLEAN NOT NULL DEFAULT false,
    "express_checkout_enabled" BOOLEAN NOT NULL DEFAULT false,
    "discount_box_enabled" BOOLEAN NOT NULL DEFAULT false,
    "order_note_enabled" BOOLEAN NOT NULL DEFAULT false,
    "terms_checkbox_enabled" BOOLEAN NOT NULL DEFAULT false,
    "timer_enabled" BOOLEAN NOT NULL DEFAULT false,
    "timer_minutes" INTEGER,
    "trust_badges_enabled" BOOLEAN NOT NULL DEFAULT false,
    "ai_upsell_enabled" BOOLEAN NOT NULL DEFAULT false,
    "rules_engine_enabled" BOOLEAN NOT NULL DEFAULT false,
    "design_config" JSONB,
    "rules_json" JSONB,
    "announcement_text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cart_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_tiers" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "threshold_amount" DECIMAL(12,2) NOT NULL,
    "reward_type" TEXT NOT NULL,
    "reward_label" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "reward_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upsell_rules" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "rule_type" TEXT NOT NULL,
    "product_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "collection_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "max_products" INTEGER NOT NULL DEFAULT 3,
    "display_style" TEXT NOT NULL DEFAULT 'carousel',
    "show_if_in_cart" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "upsell_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_rules" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "gift_product_id" TEXT NOT NULL,
    "gift_variant_id" TEXT,
    "min_cart_value" DECIMAL(12,2) NOT NULL,
    "auto_add" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "gift_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_rules" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "condition_type" TEXT NOT NULL,
    "condition_value" TEXT,
    "action_type" TEXT NOT NULL,
    "action_value" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cart_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "shop_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "cart_token" TEXT,
    "cart_total" DECIMAL(12,2),
    "upsell_revenue" DECIMAL(12,2),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shops_shop_domain_key" ON "shops"("shop_domain");

-- CreateIndex
CREATE UNIQUE INDEX "cart_settings_shop_id_key" ON "cart_settings"("shop_id");

-- CreateIndex
CREATE INDEX "reward_tiers_shop_id_idx" ON "reward_tiers"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_tiers_shop_id_position_key" ON "reward_tiers"("shop_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "upsell_rules_shop_id_key" ON "upsell_rules"("shop_id");

-- CreateIndex
CREATE INDEX "gift_rules_shop_id_idx" ON "gift_rules"("shop_id");

-- CreateIndex
CREATE INDEX "cart_rules_shop_id_idx" ON "cart_rules"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_rules_shop_id_position_key" ON "cart_rules"("shop_id", "position");

-- CreateIndex
CREATE INDEX "analytics_events_shop_id_created_at_idx" ON "analytics_events"("shop_id", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_shop_id_event_type_idx" ON "analytics_events"("shop_id", "event_type");

-- AddForeignKey
ALTER TABLE "cart_settings" ADD CONSTRAINT "cart_settings_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_tiers" ADD CONSTRAINT "reward_tiers_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsell_rules" ADD CONSTRAINT "upsell_rules_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_rules" ADD CONSTRAINT "gift_rules_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_rules" ADD CONSTRAINT "cart_rules_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
