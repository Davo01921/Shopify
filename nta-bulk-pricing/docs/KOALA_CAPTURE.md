# Current Koala offer capture

Captured from the NTA Shopify admin on 25 September 2026.

## 1. Inverts

Koala campaign ID: `cm96s8wfd5itiy81mypwfektu`.

Scope: selected invertebrate products.

Visible product examples include Freshwater Mussels; Black/Brown Black Foot Mystery Snail; Blue, Brown, Gold, Ivory, Jade, Magenta and Purple Mystery Snails; Blue Dream, Carbon Rilli, Emerald Green, Green, Konaku Red, Sunkist and Super Black Cherry Shrimp.

Configured tiers:
- 1–2: standard price
- 3–5: 5% off
- 6+: 10% off

An isolated live cart using Black/Brown Black Foot Mystery Snail confirmed no discount at 2, 5% at 3, and 10% at 6. The Koala block's 6+ savings label incorrectly says 20%.

## 2. Group Fish Discounts

Koala campaign ID: `cm9ddz5md5eytiscvezptruhm`.

Block title: `GROUP FISH DISCOUNTS`.

Configured tiers:
- Buy 1–2: standard price
- Buy 3–5: 5% off
- Buy 6+: 10% off

An isolated live cart using Cardinal Tetra confirmed no discount at 2, 5% at 3, and 10% at 6. The Koala block's savings labels incorrectly say 10% and 20%.

## 3. Frozen Foods

Koala campaign ID: `cmgsmq0361rwsj8ceelh3bcf5`.

Block title: `FROZEN FOODS`.

Configured tiers:
- Buy 1–9 items: no discount
- Buy 10–19 items: A$0.50 off each item
- Buy 20+ items: A$1 off each item

An isolated live cart using ORCA Frozen Brine Shrimp confirmed no discount at 9 and A$0.50 per item at 10. The product's current stock of 10 prevents a live 20-unit cart test; the published Koala configuration explicitly contains the A$1 amount. The 20+ badge says "20% Off", which is not the configured rule.

## 4. Pea Puffers

Koala campaign ID: `cmgzulas806befdch0jkazwtt`.

Scope: Dwarf Pea Puffer product `6918785958097`.

Block title: `Pea Puffers`.

Configured tiers:
- Buy 1–2: standard price
- Buy 3+: A$4 off each fish

An isolated live cart confirmed no discount at 2 and A$4 per fish at 3. The second-tier badge says "6%+ Off", which does not describe the configured fixed-amount rule.

## 5. Red Cherry Shrimp

Koala campaign ID: `cmtq9oitc85iv9y44d8eiw5xh`.

Scope: RCS Red Cherry Shrimp product `6840207540433`.

Configured tiers:
- Buy 1–3: standard price
- Buy 4–9: A$0.50 off each shrimp
- Buy 10–19: A$1 off each shrimp
- Buy 20+: A$1.50 off each shrimp

An isolated live cart confirmed no discount at 3 and A$0.50 per shrimp at 4.

## 6. Otocinclus

Koala campaign ID: `cmsxs2o970l988f45vz0794zp`.

Scope: Otocinclus Arnoldi product `6840207573201`.

Block title: `OTOCINCLUS DEAL`.

Configured tiers:
- Buy 1–3: standard price
- Buy 4–5: A$2 off each fish
- Buy 6+: A$3 off each fish

## Migration status

The exact tier types and values for all six active campaigns were recovered from Koala's live storefront state on 26 September 2026. A targeted audit of 349 products across the live-fish, invertebrate, and frozen-food taxonomy found 127 current campaign members:

- Group Fish: 107 products
- Inverts: 15 products
- Frozen Foods: 2 products
- Red Cherry Shrimp, Otocinclus, and Pea Puffer: 1 product each

The reproducible product-level capture is stored in `docs/koala-campaigns-2026-09-26.json`. No production replacement rules have been enabled.

Still required before cutover:

- replacement parity tests after the exact product sets are loaded;
- the 20+ Frozen Foods live-cart result when stock permits, or equivalent checkout evidence;
- final side-by-side cart and checkout testing on the approved public app.

Koala remains active until the replacement matches all six live checkout behaviours. The configured values above take precedence over Koala's inaccurate promotional labels.
