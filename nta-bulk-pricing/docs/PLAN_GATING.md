# Shopify plan gating and migration decision

Checked against the connected Nano Tanks Australia Shopify store on 25 September 2026.

## Current store plan

Shopify Basic.

## Platform rule

Shopify's current documentation states:

- stores on any plan can use Shopify Functions from public apps distributed through the Shopify App Store;
- custom apps that contain Shopify Function APIs require Shopify Plus.

This means a private/custom-distribution app cannot be activated as the exact discount engine on NTA's current plan.

## Deployment choices

### A. Public app with limited listing visibility — exact behaviour

Use the existing rule engine behind a public Shopify app, submit it for App Store review, and set the listing to limited visibility.

Pros:
- exact per-cart-line quantity logic
- one Function can handle all NTA rules
- no 25-discount explosion
- percentage and fixed tiers are deterministic
- collection and selected-product targeting can remain flexible

Cons:
- Shopify App Store review and public-app compliance work
- more initial engineering than a private one-store utility

### B. Native automatic discounts — no Function, Basic-compatible

Use Shopify's native automatic amount-off discounts managed by our app.

Safe only where the rule can be proven equivalent.

Typical safe case:
- one product target
- percentage-only tiers that increase with quantity

Example:
- 3+ = 5%
- 6+ = 10%

At 6+, both thresholds are eligible but Shopify selects the better 10% product discount for that line.

Unsafe or behaviour-changing cases:
- one rule targets many products/collections and quantity must be per product rather than pooled
- percentage and fixed-dollar tiers overlap
- large product lists would require more than 25 active automatic discounts if expanded per product

### C. Keep Koala for checkout, replace only the display/admin later

Lowest migration risk, but it does not remove Koala.

## Recommendation for the project

Do not deploy an unusable custom Function app to NTA Basic.

Continue the core engine and storefront/admin work, but treat the production checkout integration as a decision gate:

1. verify the four Koala offers in live cart/checkout;
2. establish whether each group's quantity is truly per product or can intentionally pool across products;
3. compare the resulting rule count with Shopify's 25-active-automatic-discount limit;
4. if exact per-product behaviour is required across the current catalogue, use the public-app/limited-visibility Function path.
