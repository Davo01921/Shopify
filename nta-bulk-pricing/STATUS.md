# TierWeave status

**Status: CLOSED / PRODUCTION / BAU**  
**Production acceptance: 3 October 2026**

TierWeave is the live NTA quantity-pricing system. The owner has confirmed that the production deployment is live, has been tested in the real store, and is processing sales.

## Closure basis

- Deterministic rule engine implemented.
- Product, variant, selected-product and collection targeting implemented.
- Percentage and fixed-amount-per-item tiers implemented.
- Deterministic rule precedence implemented.
- Explicit publish workflow implemented.
- Storefront quantity-pricing block implemented.
- Checkout discount Function implemented.
- Cloudflare Workers + D1 architecture implemented.
- Staging, production and NTA-specific infrastructure separated.
- Six captured Koala campaign behaviours verified in development product page, cart and checkout flows.
- CI previously passed tests, Function tests, typecheck, lint and Cloudflare build.
- Production operation and live sales are owner-confirmed.

No additional feature work is required for NTA project closure.

## BAU

Future rule edits are normal business-as-usual changes. Use the explicit publish workflow and verify representative product-page, cart and checkout behaviour after material pricing changes.

Do not reopen the engineering project for ordinary rule maintenance.

## Deferred commercialization

Taking TierWeave to market as a general Shopify product is deliberately deferred. App Store positioning, billing, onboarding, merchant support, multi-store hardening and broader public launch work belong in `FUTURE_BACKLOG.md`.

Reopen a separate commercialization phase when the owner decides to market TierWeave externally.
