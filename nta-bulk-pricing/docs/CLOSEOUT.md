# TierWeave closeout — 3 October 2026

**Final status: CLOSED / PRODUCTION / BAU**

## Closure decision

The owner confirmed on 3 October 2026 that TierWeave is already live on Nano Tanks Australia, has been tested in the production store and is processing real sales.

That production confirmation resolves the remaining NTA cutover/acceptance question. TierWeave should no longer be tracked as an active build, staging project or pending Koala replacement.

The previously separate **Koala Upsell Replacement** project is cancelled/superseded because TierWeave now provides the accepted production quantity-pricing capability. Historical Phase 1/2 Koala-replacement PRs #2 and #3 are closed as superseded; merged production closeout PR #4 is the canonical outcome.

The project may be reopened later as a separate commercialization effort when the owner is ready to take TierWeave to market.

## Completed NTA scope

- deterministic quantity-pricing engine;
- product/variant/product-set/collection targeting;
- percentage and fixed-amount-per-item tiers;
- standard-price tiers;
- deterministic precedence/overlap resolution;
- rule create/edit/enable/disable;
- explicit publish workflow;
- Shopify Discount Function;
- product-page quantity-pricing app block;
- app proxy;
- Cloudflare Workers runtime;
- D1 persistence;
- separated staging/production/NTA infrastructure;
- captured Koala campaign definitions;
- development-store parity verification;
- NTA POS consumption of TierWeave pricing;
- production deployment and real sales acceptance.

## Verification evidence

`docs/STAGING_VERIFICATION.md` records product-page, cart and checkout verification for the captured campaign shapes including:

- Inverts;
- Group Fish;
- Frozen Foods;
- Red Cherry Shrimp;
- Pea Puffers;
- Otocinclus;
- alternate variant pricing;
- noneligible product behaviour.

The TierWeave CI run documented there passed tests, Function tests, typecheck, lint and Cloudflare build.

Production acceptance is owner-confirmed rather than inferred from staging: the live system has been tested and is processing sales.

## Canonical operation

The published configuration is production pricing authority. Draft rule edits are not live until explicitly published.

Material rule changes should be checked at:

1. product-page display;
2. cart;
3. checkout;
4. one below-threshold/noneligible case.

See `SOP.md`.

## Documentation set

- `README.md`
- `STATUS.md`
- `SOP.md`
- `TECHDOC.md`
- `SPECDOC.md`
- `docs/ARCHITECTURE.md`
- `docs/STAGING_VERIFICATION.md`
- `docs/KOALA_CAPTURE.md`
- `FUTURE_BACKLOG.md`

## Deferred scope

Public commercialization is explicitly not part of this NTA closeout.

App Store marketing, billing, generalized onboarding, multi-merchant operations and public support are deferred to `FUTURE_BACKLOG.md`.

## Reopen condition

Reopen TierWeave engineering when either:

- a genuine production defect requires code changes; or
- the owner starts the market/commercialization phase.

Ordinary NTA rule maintenance remains BAU.
