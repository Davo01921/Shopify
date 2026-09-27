# Current Koala offer capture

Captured from the NTA Shopify admin on 25 September 2026.

## 1. Inverts

Scope: selected invertebrate products.

Visible product examples include Freshwater Mussels; Black/Brown Black Foot Mystery Snail; Blue, Brown, Gold, Ivory, Jade, Magenta and Purple Mystery Snails; Blue Dream, Carbon Rilli, Emerald Green, Green, Konaku Red, Sunkist and Super Black Cherry Shrimp.

Visible tiers:
- standard-price tier
- 3+ discounted tier
- 6+ larger discounted tier

The screenshots showed savings text that did not agree with the previewed unit prices, so the actual live checkout discount values must be verified before migration.

## 2. Group Fish Discounts

Block title: `GROUP FISH DISCOUNTS`.

Visible tiers:
- Buy 1-2: standard price
- Buy 3-5: discounted
- Buy 6+: larger discount

Again, the previewed unit prices did not agree with the displayed percentage labels. Verify the actual live cart/checkout calculations before migration.

## 3. Frozen Foods

Block title: `FROZEN FOODS`.

Visible tiers:
- Buy 1-9 items: no discount
- Buy 10-19 items: discounted; exact configured value still to verify
- Buy 20+ items: fixed amount A$1 off per product

The 20+ badge says "20% Off", but the rule configuration shown is A$1 fixed amount per product. The replacement should generate savings text from the actual rule by default.

## 4. Pea Puffers

Scope: one specific product.

Block title: `Pea Puffers`.

Visible tiers:
- Buy 1-2: standard price
- Buy 3 or more: discounted

The second-tier badge says "6%+ Off". Verify the actual configured/live discount before migration.

## Migration rule

Koala remains active until all four live checkout behaviours are verified against the replacement. Screenshots are evidence of configuration/display, not proof of the checkout calculation.
