# TECHDOC — TierWeave

**Status: CLOSED / PRODUCTION / BAU — 3 October 2026**

## Production architecture

TierWeave consists of:

- Shopify embedded admin application for rule management.
- Deterministic JavaScript rule engine.
- Shopify Discount Function for checkout pricing.
- Theme app extension for product-page quantity-pricing display.
- Authenticated Shopify app proxy for published storefront pricing data.
- Cloudflare Worker runtime.
- Cloudflare D1 persistence.
- Explicit draft-to-published configuration flow.
- Separate staging, production and NTA-specific infrastructure/configuration.

## Core source areas

- `src/rule-engine.js` — deterministic match and tier selection.
- `src/function-configuration.js` — published Function configuration shape.
- `src/storefront-pricing.js` — storefront-facing pricing model.
- `app/rules.server.ts` — persisted rule operations.
- `app/discount-deployment.server.ts` — publish/deployment flow.
- `extensions/nta-bulk-pricing-discount/` — Shopify Discount Function.
- `extensions/quantity-pricing/` — storefront theme app block.
- `workers/app.ts` — Cloudflare Worker entry point.
- `d1-migrations/` — D1 schema history.

## Data flow

1. Merchant edits rules in the embedded admin.
2. Draft rules are persisted.
3. Merchant explicitly publishes.
4. Published rule configuration becomes checkout authority.
5. Shopify Discount Function evaluates cart-line quantity and exact Shopify identity.
6. The storefront app block requests published pricing through the app proxy.
7. Product-page messaging and checkout therefore derive from the published rule set rather than unpublished draft edits.

## Deterministic invariants

- A line receives at most one TierWeave rule.
- Quantity is evaluated per cart line for the implemented NTA behaviour.
- Variant targeting outranks product targeting.
- Product targeting outranks selected-product-set targeting.
- Selected-product-set targeting outranks collection targeting.
- Explicit priority breaks equivalent-scope ties.
- Tier boundaries are inclusive according to their configured minimum/maximum.
- Discount type and value are explicit; no marketing label is pricing authority.
- Nonmatching lines return no TierWeave discount.

## Persistence and environment boundaries

The repository contains distinct configuration for:

- staging;
- general production;
- NTA-specific merchant backend.

These environments must retain separate D1 databases and Worker identities.

The current live NTA installation is production accepted. Exact account-side installation/distribution state is an operational Shopify setting and should be verified from the active Shopify app configuration when troubleshooting rather than guessed from repository filenames.

## Security

- Shopify client secrets belong in runtime secrets, not tracked files.
- App authentication and Shopify session validation remain mandatory.
- App proxy traffic must be authenticated according to Shopify's proxy model.
- Do not commit merchant secrets, session material or customer data.
- Environment-specific API keys that are safe public identifiers may be tracked only where appropriate; secrets must not be.

## Testing evidence

The development-store verification documented in `docs/STAGING_VERIFICATION.md` covers the six captured NTA campaign shapes across product page, cart and checkout, including threshold and noneligible cases.

CI on the TierWeave branch passed:

- core tests;
- Function tests;
- typecheck;
- lint;
- Cloudflare build.

Production acceptance is additionally based on the owner's confirmation that the live deployment has been tested and is processing real sales.

## Recovery

For a pricing regression:

1. stop additional rule edits;
2. identify the active published configuration;
3. compare against the last known-good rule state;
4. restore/republish the known-good configuration;
5. verify product page, cart and checkout;
6. retain evidence of the incident and correction.

Do not alter unrelated Shopify pricing or inventory as a workaround for a TierWeave rule defect.
