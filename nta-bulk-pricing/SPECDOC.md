# SPECDOC — TierWeave

**Status: CLOSED / PRODUCTION / BAU — 3 October 2026**

## Objective

Provide deterministic quantity-based pricing for Nano Tanks Australia that remains consistent from product-page presentation through cart and Shopify checkout.

## Supported V1 scope

TierWeave supports:

- explicit variant targets;
- single-product targets;
- selected product sets;
- collection targets;
- inclusive quantity tiers;
- standard/no-discount tiers;
- percentage discounts;
- fixed amount off each item;
- active/inactive rules;
- explicit numeric priority;
- deterministic overlap resolution;
- storefront quantity-pricing presentation;
- explicit publish from draft to live configuration.

## Quantity model

The implemented NTA model evaluates quantity per cart line. It does not silently pool different products into one quantity threshold.

## Precedence

When multiple active rules match the same line:

1. variant
2. single product
3. selected product set
4. collection
5. numeric priority

Exactly one TierWeave rule is selected for that line.

## Production acceptance criteria

The NTA implementation is accepted because:

- rule-engine and checkout Function behaviour are deterministic;
- all six captured Koala campaign patterns were verified in the development store;
- product page, cart and checkout parity was demonstrated across representative threshold values;
- noneligible products remain undiscounted;
- automated CI checks passed;
- the owner confirmed on 3 October 2026 that TierWeave is live, has been tested in production and is processing sales.

The project is therefore CLOSED / BAU for NTA.

## Non-goals for the closed NTA V1

The following are not required for NTA closure:

- public marketing launch;
- paid billing plans;
- merchant self-service onboarding;
- generalized multi-merchant support workflows;
- public support operations;
- broad analytics/attribution;
- subscriptions;
- post-purchase upsells;
- free-gift engines;
- buy-X-get-Y bundles;
- cross-product mix-and-match quantity pooling.

These belong to a future commercialization phase if the owner chooses to reopen TierWeave for market distribution.

## Change-control rule

Material pricing changes must preserve deterministic behaviour and be verified against the published rule state at storefront, cart and checkout before being considered complete.
