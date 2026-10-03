# TierWeave — NTA Bulk Pricing

**Status: CLOSED / PRODUCTION / BAU — 3 October 2026**

TierWeave is the live quantity-pricing system for Nano Tanks Australia. The owner has confirmed the production deployment is live, tested, and processing sales.

The NTA implementation is closed as an engineering project. Routine rule changes are BAU. Public commercialization is deferred until the owner chooses to reopen TierWeave for market distribution.

See `STATUS.md`, `SOP.md`, and `docs/CLOSEOUT.md`.

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

## Native-discount compiler

`src/native-discount-compiler.js` remains a guarded fallback/proof path for safe subsets of rules. It intentionally refuses conversions that cannot be proven equivalent to TierWeave's per-line deterministic behaviour.

It is not the production authority for the accepted NTA TierWeave deployment.

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


## Production documentation

- `STATUS.md` — current production state
- `SOP.md` — BAU operating procedure
- `TECHDOC.md` — technical production architecture
- `SPECDOC.md` — accepted product scope
- `docs/CLOSEOUT.md` — NTA production closeout
- `FUTURE_BACKLOG.md` — deferred commercialization and optional enhancements
