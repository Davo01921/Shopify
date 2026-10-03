# SOP — TierWeave

**Status: CLOSED / PRODUCTION / BAU — 3 October 2026**

TierWeave is live for Nano Tanks Australia and production operation is owner-accepted.

## Normal rule-change workflow

1. Open the live TierWeave admin for the NTA store.
2. Identify the exact rule being changed.
3. Confirm its target scope: variant, product, selected product set or collection.
4. Confirm every tier boundary and discount value before saving.
5. Save the draft change.
6. Review overlap/precedence implications.
7. Publish explicitly.
8. Verify a representative eligible product on the storefront.
9. Verify the applicable quantity boundary in cart.
10. Verify the same result at checkout.
11. Verify one non-eligible or below-threshold case remains undiscounted.
12. Record any material production change in the normal operating log.

Draft edits are not production authority. The published configuration is production authority.

## Rule precedence

When more than one active rule can match the same cart line, the deterministic engine resolves in this order:

1. explicit variant
2. single specific product
3. selected product set
4. collection
5. numeric priority as the tie-breaker

Only one TierWeave pricing rule should control a cart line.

## Safety rules

- Do not infer product membership from names when exact Shopify identifiers are available.
- Do not create overlapping pricing rules without checking precedence.
- Do not silently change a fixed-dollar tier into a percentage tier or vice versa.
- Do not treat promotional badge text as pricing authority; configured tier values are authoritative.
- Do not bypass the explicit publish step.
- Do not make a production rule change without cart and checkout verification when the commercial effect is material.
- Preserve the last known-good configuration before a broad rule migration.

## Incident handling

If storefront display and checkout disagree:

1. stop further pricing edits;
2. identify the published configuration currently in effect;
3. reproduce with one exact product/variant and quantity;
4. compare storefront target resolution with checkout Function target resolution;
5. inspect app-proxy and Worker health;
6. inspect the relevant published rule and precedence;
7. restore or republish the last known-good configuration if needed;
8. verify cart and checkout before resuming changes.

If TierWeave itself is unavailable, do not improvise a new pricing mechanism during an incident. Use the store's established operational fallback until the known-good TierWeave path is restored.

## Environment discipline

The repository retains separate staging, production and NTA-specific configurations. Do not point the live NTA store at staging for troubleshooting.

Treat the active Shopify installation/account configuration as production authority; do not infer the live distribution relationship solely from a filename or branch name.

## BAU boundary

Ordinary pricing-rule maintenance, product membership changes and tier edits are BAU.

Public commercialization, billing, broad merchant onboarding and App Store go-to-market work are not BAU for the NTA project and remain deferred.
