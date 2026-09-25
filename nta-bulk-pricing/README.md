# NTA Bulk Pricing

Private Shopify app for Nano Tanks Australia to replace the small subset of Upsell Koala Bundles currently in use.

## Scope

Phase 1 implements the deterministic rule engine and rule-editor data model. Shopify integration will use the unified Discount Function API, with configuration stored as JSON in an app-owned discount metafield. The storefront display will be a theme app extension.

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

Phase 1 deliberately uses the quantity on the cart line. It does not pool quantities across different products. This matches the current Koala-style volume pricing behaviour we have captured so far and avoids silently creating mix-and-match discounts.

## Development

Requires Node.js 22+.

```bash
cd nta-bulk-pricing
npm test
```

See `docs/KOALA_CAPTURE.md` for the migration inventory and `docs/ARCHITECTURE.md` for the Shopify integration plan.
