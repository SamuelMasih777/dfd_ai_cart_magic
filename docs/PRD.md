# dfd.ai: Cart Magic — Product Requirements Document

**Source of truth for Cart Magic development.**  
Stack: Remix · Supabase · Polaris · dfd.ai · Theme App Extension (storefront widget).

**Subtitle:** Cart Magic by dfd.ai — 8-feature slide cart drawer app. Cheapest full-featured app in the category. Unlimited orders. No hidden fees.

- **Target:** Shopify App Store  
- **Version:** 2.0 PRD — Final Feature Lock  

**Related files:** [cartmagic-prd.html](./cartmagic-prd.html) (styled HTML copy of this PRD)

---

## Table of contents

1. [Competitive landscape & pricing](#1-competitive-landscape--pricing)
2. [Core feature set (8 features — final lock)](#2-core-feature-set-8-features--final-lock)
3. [Full system architecture](#3-full-system-architecture)
4. [Database schema (Supabase)](#4-database-schema-supabase)
5. [App pages & UI structure](#5-app-pages--ui-structure)
6. [Storefront integration (widget)](#6-storefront-integration-widget)
7. [Pricing strategy](#7-pricing-strategy)
8. [Tech stack & implementation notes](#8-tech-stack--implementation-notes)
9. [Launch roadmap](#9-launch-roadmap)

---

## 1. Competitive landscape & pricing

The slide cart drawer space on Shopify is well-established but most apps are either overpriced, bloated with poor UX, or lock key features behind expensive tiers.

### Competitor pricing (reference)

| App | Free plan | Paid starts at | Top plan | Pricing model | Rating |
|-----|-----------|----------------|----------|---------------|--------|
| **UpCart** | Dev stores only | $14.99/mo | $34.99/mo (201–500 orders) | Per order volume | 4.6★ |
| **Qikify Slide Cart** | Yes (limited) | $14.99/mo | $19.99/mo (discounted) | Flat | 4.9★ |
| **Cartly** | No | $9.99/mo | ~$29.99/mo | Tiered by Shopify plan | 4.7★ |
| **AMP Slide Cart** | Yes (very limited) | $29.99/mo | $99+/mo for large stores | Per order volume | 4.8★ |
| **Kaktus Slide Cart** | Dev stores only | $9.99/mo | $24.99/mo | Flat tiers | 4.5★ |
| **Cartix** | Yes (with branding) | $19.99/mo | $59.99/mo | Per Shopify plan | 4.6★ |
| **Cart Magic by dfd.ai** | Yes — generous | **$6.99/mo** | **$14.99/mo** | Flat, simple | Target: 4.8★ |

**Opportunity:** Most apps charge $15–$35/mo for the same feature set. Launching at $6.99 and $14.99 with a genuinely useful free plan captures price-sensitive merchants who make up the majority of Shopify's 1M+ store base.

### Common complaints from competitor reviews

- App conflicts with themes — installation breaks things  
- Upsell products don't update in real time  
- Limited customization without knowing CSS  
- Multi-language / multi-market support is broken or missing  
- Support is slow or AI-bot only  
- Per-order pricing penalizes fast-growing stores  
- No clear ROI dashboard — merchants can't see the value → they uninstall  
- No conditional logic (IF product A → show upsell B) — power users leave  

**Positioning + implementation should address all of the above.**

---

## 2. Core feature set (8 features — final lock)

Every feature is independently togglable from the admin dashboard. **Features 1 and 8 are always-on** (drawer is the product; analytics is the retention mechanism). All others are merchant-controlled toggles.

| # | Feature | Summary | Badge |
|---|---------|---------|-------|
| **01** | **Slide Cart Drawer** | Smooth animated side drawer replacing default Shopify cart. Slides from the right on ATC. Floating cart icon. Themeable (colors, fonts, radius, width). **Always on.** | Always On |
| **02** | **Smart Upsell Engine** | **Auto:** Shopify `/recommendations/products.json`. **Manual:** ResourcePicker. Carousel or block, 1–3 products, one-click add. | Differentiator |
| **03** | **Dynamic Rewards Progress Bar** | Up to 3 tiers (e.g. Free Shipping → Free Gift → Discount). Animated fill. **Smart AOV Suggest** — Shopify Analytics API → suggested tier thresholds. | Revenue |
| **04** | **Offer System (Free Gift)** | Auto-add gift at threshold; remove if cart drops. Sync with progress bar. **v1: free gift only.** BOGO → v1.1 (Discount API + QA). | Revenue |
| **05** | **Instant Checkout Layer** | Sticky ATC on product pages; express buttons in drawer (Shop Pay, Apple Pay, Google Pay). **v1:** Sticky ATC Week 3; express in drawer Week 8+ (cross-theme QA). | CVR |
| **06** | **Discount + Trust & Urgency** | Toggles: discount code box (real-time validation, URL param auto-apply), trust badges, countdown timer, order note, terms checkbox. | Trust |
| **07** | **Cart Rules Engine** | IF→THEN, no code, max 10 rules v1. Conditions: cart value, product in cart, returning customer. Actions: upsell, discount, offer. Stored as `rules_json` JSONB in `cart_settings` (PRD also references `cart_rules` table). **No AND/OR nesting v1.** | Power Users |
| **08** | **Revenue Analytics Dashboard** | Upsell revenue, AOV before/after, conversion lift %, upsell add rate, gift redemptions, progress bar influence. **Events infra Week 1–2 — not bolted on later.** **Always on.** | Always On |

**What NOT to build in v1:** BOGO (v1.1), subscription upgrade toggle, volume discounts, full page builder, complex ML, AND/OR nested rules. Ship fast, validate, then layer.

---

## 3. Full system architecture

### High-level overview

Two runtimes:

- **Admin app:** Remix + Polaris, inside Shopify Admin iframe.  
- **Storefront widget:** Vanilla JS + CSS via **Shopify App Embed** (Theme App Extension).

### Merchant browser (Shopify Admin)

- Remix app (React Router v7)  
- Polaris UI  
- OAuth via `@shopify/shopify-app-remix`  
- Session storage in **Supabase (PostgreSQL)**

### Backend / API (Remix loaders + actions)

| Route | Purpose |
|-------|---------|
| `/api/cart-settings` | Merchant config CRUD |
| `/api/upsell-rules` | Upsell rules (AI/manual) |
| `/api/gift-rules` | Free gift triggers |
| `/api/cart-rules` | IF–THEN rules CRUD (max 10) |
| `/api/analytics/events` | Event ingestion (POST, **no auth** per PRD) |
| `/api/analytics/summary` | ROI dashboard (authenticated) |
| `/api/smart-aov` | Store AOV via Shopify Analytics API |
| `/api/widget-config` | **Public** — flattened JSON for storefront widget |

### Database (Supabase / PostgreSQL)

- `shops` — one row per installed store  
- `cart_settings` — design + feature toggles + `rules_json` per shop  
- `upsell_rules` — AI/manual upsell definitions  
- `reward_tiers` — progress bar milestones  
- `gift_rules` — free gift conditions  
- `cart_rules` — IF–THEN rules (max 10 per shop)  
- `analytics_events` — ROI event log (`upsell_added`, `gift_redeemed`, `drawer_open`, `checkout_click`, etc.)  
- `sessions` (or Prisma `Session`) — Shopify session tokens  

### Shopify APIs used

- Admin GraphQL — products, discount validation, AOV data  
- Ajax Cart API — storefront cart read/update  
- Product Recommendations API — `/recommendations/products.json`  
- Shopify Analytics API — Smart AOV Suggest  
- Payment Request API — Apple Pay / Google Pay in drawer (Week 8+)  
- App Embed Block — inject widget without theme code edits  
- Billing API — subscriptions  
- Webhooks — `orders/paid` (ROI attribution), `app/uninstalled`, GDPR set  

### Storefront widget (customer browser)

- Single JS bundle (~40–60KB gzipped) via App Embed  
- Fetches `/api/widget-config` on init  
- Listens for `cart:add` + cart icon clicks  
- Ajax Cart API for mutations  
- POSTs analytics to `/api/analytics/events`  
- **No frameworks** — vanilla JS + CSS custom properties  

### Data flow: customer adds to cart

1. Customer clicks ATC  
2. Native Shopify ATC fires → widget listens  
3. `GET /cart.js` → read cart  
4. Render drawer with line items  
5. Evaluate `cart_rules` → upsell/offer  
6. Reward tiers → progress bar  
7. Gift rules → auto-add via `/cart/add.js` if threshold met  
8. Upsell: AI (`/recommendations/products.json`) or manual list  
9. `POST /api/analytics/events` e.g. `{ type: "drawer_open", cart_total, items }`  

**Revenue attribution:** `orders/paid` webhook → match `cart_token` → upsell revenue.

### Auth & session

Use `@shopify/shopify-app-remix`. Sessions in Supabase (custom session storage adapter). On install: OAuth creates `shops` row + default `cart_settings`.

---

## 4. Database schema (Supabase)

### `shops`

| Field | Type |
|-------|------|
| id | uuid PK |
| shop_domain | text UNIQUE |
| access_token | text |
| plan | text |
| plan_active | bool |
| installed_at | timestamptz |
| uninstalled_at | timestamptz |

### `cart_settings`

| Field | Type |
|-------|------|
| id | uuid PK |
| shop_id | uuid FK |
| drawer_enabled | bool |
| sticky_atc_enabled | bool |
| express_checkout_enabled | bool |
| discount_box_enabled | bool |
| order_note_enabled | bool |
| terms_checkbox_enabled | bool |
| timer_enabled | bool |
| timer_minutes | int |
| trust_badges_enabled | bool |
| ai_upsell_enabled | bool |
| rules_engine_enabled | bool |
| design_config | jsonb |
| announcement_text | text |
| updated_at | timestamptz |

### `reward_tiers`

| Field | Type |
|-------|------|
| id | uuid PK |
| shop_id | uuid FK |
| position | int (1–3) |
| threshold_amount | decimal |
| reward_type | text |
| reward_label | text |
| enabled | bool |

### `upsell_rules`

| Field | Type |
|-------|------|
| id | uuid PK |
| shop_id | uuid FK |
| rule_type | text (`ai` / `manual`) |
| product_ids | text[] |
| collection_ids | text[] |
| max_products | int |
| display_style | text |
| show_if_in_cart | bool |
| enabled | bool |

### `gift_rules`

| Field | Type |
|-------|------|
| id | uuid PK |
| shop_id | uuid FK |
| gift_product_id | text |
| gift_variant_id | text |
| min_cart_value | decimal |
| auto_add | bool |
| enabled | bool |

### `analytics_events`

| Field | Type |
|-------|------|
| id | bigserial PK |
| shop_id | uuid FK |
| event_type | text — see types below |
| cart_token | text |
| cart_total | decimal |
| upsell_revenue | decimal |
| metadata | jsonb |
| created_at | timestamptz |

**event_type values:** `drawer_open`, `upsell_added`, `gift_redeemed`, `progress_influenced`, `checkout_click`, `order_completed`

### `cart_rules`

| Field | Type |
|-------|------|
| id | uuid PK |
| shop_id | uuid FK |
| position | int (1–10) |
| condition_type | text — `cart_value_gt`, `product_in_cart`, `returning_customer` |
| condition_value | text |
| action_type | text — `show_upsell_product`, `show_offer`, `apply_discount` |
| action_value | text |
| enabled | bool |

### Design config & notes

- **`design_config` example:** `{"primaryColor":"#000","buttonRadius":"8px","drawerWidth":"420px","fontFamily":"inherit","checkoutButtonText":"Checkout"}`
- **`cart_rules`:** evaluated client-side in widget; flattened `cartRules` in widget-config response.
- **`analytics_events`:** ROI dashboard source of truth; match `cart_token` on `orders/paid` for attribution.

---

## 5. App pages & UI structure

Polaris + embedded app iframe. Sidebar uses Polaris `Navigation`.

### Navigation items

- Dashboard — ROI Analytics (always on)  
- Cart Drawer Settings  
- Smart Upsell (AI / Manual)  
- Rewards Progress Bar  
- Offer System (Free Gifts)  
- Rules Engine  
- Discount + Trust & Urgency  
- Design & Branding  
- Pricing / Plan  

### Routes

| Route | Page |
|-------|------|
| `/app` | **Dashboard — ROI Analytics.** Revenue, AOV before/after, conversion lift %, upsell add rate, gift redemptions. 4 metric cards + 30-day chart. Events infra Week 1–2. |
| `/app/cart-drawer` | **Cart Drawer Settings.** Master toggle, announcement, sub-widgets (discount, order note, timer, trust badges, terms, sticky ATC + trigger scroll/immediate). Express checkout toggle Week 8+ (“coming soon” in v1). Live preview. |
| `/app/upsell` | **Smart Upsell.** AI vs Manual, carousel/block, 1–3 products, “show if in cart” checkbox, preview. |
| `/app/rewards` | **Rewards bar.** Up to 3 tiers, drag reorder. **Smart AOV Suggest** → `/api/smart-aov` → 30-day AOV → prefill tiers at 0.7×, 1.0×, 1.4× AOV. |
| `/app/offers` | **Offers.** v1 free gift only. ResourcePicker, min cart, variant, auto-add, preview. BOGO UI disabled “Coming v1.1”. |
| `/app/rules` | **Rules engine.** Max 10 rules, IF/THEN dropdowns, drag priority, no AND/OR v1. |
| `/app/design` | **Design & Branding.** Colors, radius, drawer width 380–500px, checkout button text, font, live preview, reset. |
| `/app/plan` | **Plan.** Current plan, usage stats, Free/Pro/Scale comparison, Billing API, “unlimited orders” messaging. |

### UI design principles

- `Page` + title + save in top bar  
- `Layout` 2/3 settings + 1/3 preview/help  
- `Card` + `FormLayout`  
- **Optimistic saves** — instant UI, background save, rollback on error  

---

## 6. Storefront integration (widget)

Performance-critical. **Theme App Extension** — App Embed toggle in theme editor (no ScriptTag).

### Assets (output: `extensions/cart-magic-widget/assets/`)

- `cart-magic.js` — main bundle (~50KB gzipped)  
- `cart-magic.css` — base (~8KB gzipped)  

### Entry logic

1. `DOMContentLoaded` → `fetch /api/widget-config?shop={shop_domain}`  
2. Parse JSON → `window.__SC_CONFIG`  
3. Inject CSS variables from `design_config`  
4. Initialize `CartDrawer`  
5. Listeners: `[data-cart-open]`, `cart:add`, MutationObserver on cart badge  

### Widget-config response shape (public, **cache 60s**)

```json
{
  "enabled": true,
  "plan": "pro",
  "design": { "primaryColor": "...", "buttonRadius": "...", "drawerWidth": "...", "font": "..." },
  "features": {
    "rewardsBar": true, "upsell": true, "giftRule": true, "discountBox": true,
    "timer": true, "trustBadges": true, "orderNote": true, "termsCheckbox": true,
    "stickyAtc": true, "expressCheckout": false, "rulesEngine": true
  },
  "rewardTiers": [{ "threshold": 50, "label": "Free Shipping" }],
  "upsellRule": { "type": "ai", "maxProducts": 2, "style": "carousel" },
  "giftRule": { "productId": "...", "variantId": "...", "minCartValue": 100, "autoAdd": true },
  "cartRules": [{ "if": "cart_value_gt", "val": "2000", "then": "show_upsell_product", "action": "prod_abc123" }],
  "announcements": ["🔥 50% OFF this weekend only!"]
}
```

### CSS

- **`sc-` prefix** on classes to avoid theme conflicts.  
- Inject `:root { --sc-primary, --sc-btn-radius, --sc-drawer-width, --sc-font }`.

**Performance target:** ≤50ms added to TTI; `defer` load; lazy-fetch config; no layout shift; Lighthouse before launch.

---

## 7. Pricing strategy

Flat pricing — no per-order fees, no growth penalties.

### Plans

**Free — $0/mo** (forever free)

- Slide cart drawer  
- Rewards bar (1 tier only)  
- Basic upsell (AI, 2 products max)  
- Sticky Add-to-Cart  
- Order note  
- Cart Magic branding  
- Community support  

**Pro — $6.99/mo** (most popular)

- Everything in Free  
- Full rewards bar (3 tiers)  
- Smart AOV Suggest  
- AI + Manual upsell  
- Free gift with purchase  
- Discount code box  
- Trust badges + timer  
- Rules engine (max 10)  
- ROI analytics  
- No branding  
- Email support  

**Scale — $14.99/mo**

- Everything in Pro  
- Express checkout in drawer  
- Custom CSS override  
- Multi-language strings  
- Advanced analytics export  
- Priority support (24h SLA)  
- Early access  
- BOGO when v1.1 ready  

**Positioning:** Emphasize **“flat pricing — unlimited orders”** on the App Store listing.

**Billing:** Shopify Billing API (`appSubscriptionCreate`). Store status on `shops`. Check plan in Remix loaders. Gate storefront via widget-config `plan` field.

---

## 8. Tech stack & implementation notes

| Area | Notes |
|------|------|
| Remix (RR v7) | `@shopify/shopify-app-remix` — OAuth, webhooks, sessions. Remix loaders/actions for admin + API. |
| Supabase | Postgres + session storage; custom session adapter; RLS on tables; realtime optional post-v1. |
| Polaris | `AppProvider`, App Bridge, ResourcePicker. |
| Theme App Extension | Widget in `extensions/cart-magic-widget/`; Vite bundle to `assets/`; `shopify app deploy`. |
| Widget config cache | `Cache-Control: public, max-age=60`; edge caching where hosted. |
| Webhooks | `app/uninstalled`, `shop/redact`, `customers/redact`, `customers/data_request` (GDPR). |

### Repo structure (PRD reference)

```
cartmagic/
├── app/
│   ├── routes/
│   │   ├── app._index.tsx          # Dashboard (ROI)
│   │   ├── app.cart-drawer.tsx
│   │   ├── app.upsell.tsx
│   │   ├── app.rewards.tsx
│   │   ├── app.offers.tsx
│   │   ├── app.rules.tsx
│   │   ├── app.design.tsx
│   │   ├── app.plan.tsx
│   │   ├── api.widget-config.ts
│   │   ├── api.smart-aov.ts
│   │   ├── api.analytics.events.ts
│   │   └── api.analytics.summary.ts
│   ├── db/                         # Supabase client + queries
│   ├── shopify.server.ts
│   └── root.tsx
├── extensions/cart-magic-widget/
│   ├── assets/
│   └── blocks/                     # App embed .liquid
├── widget-src/                     # Optional Vite source
│   ├── cart-drawer.js
│   ├── rewards-bar.js
│   ├── upsell.js
│   ├── rules-engine.js
│   ├── analytics.js
│   └── sticky-atc.js
└── supabase/migrations/            # Or prisma/migrations in this repo
```

*(Actual filenames may follow Remix flat route conventions; treat as logical map.)*

---

## 9. Launch roadmap

**Critical:** Analytics (Feature 8) in **W1–2** with foundation — every later feature depends on correct events from day one.

| Window | Deliverable |
|--------|-------------|
| **W1–2** | Foundation + analytics: Remix + Polaris + Supabase, OAuth + sessions, install/uninstall + GDPR webhooks, full DB schema (7 domain tables + sessions), `/api/widget-config`, `/api/analytics/events`, Theme App Extension scaffold. **Analytics from day one.** |
| **W3–4** | Core drawer + sticky ATC: mobile-first drawer, line items, qty, remove, subtotal, checkout, floating icon, sticky ATC, cart-drawer settings page; **events:** `drawer_open`, `checkout_click`. |
| **W5–6** | Upsell + rewards + Smart AOV: AI recommendations, 3-tier bar, `/api/smart-aov`, manual upsell, admin pages; **events:** `upsell_added`, `progress_influenced`. |
| **W7** | Offers + trust + urgency: free gift, discount box, badges, timer, order note, terms; **events:** `gift_redeemed`. |
| **W8** | Rules engine + design: max 10 rules, drag reorder, widget evaluation, design page with preview, `rules_engine.js`. |
| **W9** | ROI dashboard + billing: `/api/analytics/summary`, `orders/paid` webhook, Billing (Free / Pro / Scale), plan gating on config, Lighthouse (&lt;50ms widget target). |
| **W10** | Polish + launch: cross-theme QA (Dawn, Debut, Refresh, Brooklyn), onboarding, App Store assets, review submit, 5–10 beta merchants. |

### Post-launch v1.1

BOGO / bundle — Shopify Discount API, rate limits, stacking QA.

### Post-launch v2

Express checkout in drawer (cross-theme QA), multi-language strings, A/B tests, abandoned cart email, volume discounts, analytics CSV export.

---

*End of PRD.*
