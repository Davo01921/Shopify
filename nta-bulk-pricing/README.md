# NTA Bulk Pricing

Shopify bulk-pricing replacement for Nano Tanks Australia.

## Important production constraint

Nano Tanks Australia is currently on Shopify Basic. Shopify's current platform rules allow Shopify Functions from public App Store apps on all plans, but custom-distribution apps that contain Shopify Functions require Shopify Plus.

That changes the production architecture:

- the deterministic rule engine in this repository remains valid;
- an exact Koala replacement on the current Basic plan cannot be shipped as a private/custom Shopify Function app;
- the exact path is a public App Store app (it can use limited listing visibility) that passes Shopify review;
- a Basic-compatible native-discount fallback is possible for some simple rules, but it is not generally equivalent to Koala.

See `docs/PLAN_GATING.md` before deployment.

## Scope

The current foundation implements the deterministic rule engine, rule management, Shopify discount synchronization, and a product-page quantity-pricing app block.

The first release intentionally supports only what NTA needs:

- target a specific product, a selected product set, variants, or collections
- quantity tiers with inclusive minimum/maximum bounds
- percentage discounts
- fixed amount off each item
- standard-price (0 discount) tiers for display
- active/inactive rules
- deterministic rule priority so one line cannot receive two NTA bulk-pricing rules

## Rule priority

When more than one active rule matches the same cart line:

1. explicit variant
2. single specific product
3. selected product set
4. collection
5. explicit numeric priority breaks ties

Only one NTA bulk-pricing rule is selected for a cart line.

## Quantity basis

The exact engine uses the quantity on the cart line. It does not pool quantities across different products. This matches the Koala-style product-page volume pricing behaviour captured so far and avoids silently creating mix-and-match discounts.

## Basic-plan fallback

`src/native-discount-compiler.js` can compile safe subsets of rules into Shopify's native automatic amount-off discounts.

It intentionally refuses unsafe conversions by default:

- selected-product or collection rules would pool qualifying quantities across products;
- mixed percentage/fixed tiers can cause Shopify's "best discount" selection to choose a lower tier instead of the intended higher tier;
- native automatic discounts are limited to 25 active discounts.

The compiler is a fallback/proof path, not the default migration path.

## Storefront display

The `Quantity pricing` theme app block requests the last successfully published Function configuration through the authenticated app proxy. It does not read draft rule edits, so the product-page tiers remain aligned with checkout until the next explicit publish.

The block is available only on product templates and hides itself when no published rule matches the current product/variant/collection context.

## Development

Requires Node.js 22+.

```bash
cd nta-bulk-pricing
npm test
```

See:
- `docs/KOALA_CAPTURE.md` for the migration inventory
- `docs/PLAN_GATING.md` for the Shopify Basic limitation and deployment choices
- `docs/ARCHITECTURE.md` for the production architecture
