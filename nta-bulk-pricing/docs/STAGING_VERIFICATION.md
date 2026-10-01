# NTA development-store verification

This setup is for `tierweave-function-test.myshopify.com` and the existing
`NTA Bulk Pricing` app only. The Worker and D1 database are both
`tierweave-staging`. Do not use the public app or production Wrangler config.

## Test catalog and rules

The captured Koala baseline remains in `koala-campaigns-2026-09-26.json`.
The development store has different Shopify product IDs, so
`dev-koala-product-map.json` records six representative live-to-dev mappings.
It does not reproduce every live product assignment. The source snapshot and
parity tests retain the complete captured assignments and tier boundaries.

To regenerate the deterministic, shop-guarded SQL:

```bash
node scripts/prepare-dev-koala-import.mjs docs/dev-koala-product-map.json /tmp/tierweave-dev-koala-import.sql
```

Inspect the SQL, then apply it only with `wrangler.jsonc` to
`tierweave-staging`. Reapplying it updates the same six rule IDs; it does not
create duplicate rules. After a changed import, publish from **NTA Bulk
Pricing → Discount rules → Publish changes**. The storefront uses the last
published snapshot.

The six test products are tagged `tierweave-dev-test` and published only to
the development Online Store channel. The **Quantity pricing** block from
**NTA Bulk Pricing** is saved on the default product template of the
unpublished **Horizon** draft theme (theme ID `167201177819`). The separate
TierWeave app also offers a block with the same visible name; use the one
labelled **NTA Bulk Pricing**.

## Verified on 2026-10-01

- Core tests, Function tests, parity tests, typecheck, lint, and Cloudflare
  build passed.
- Shopify development app version `nta-bulk-pricing-3` was active.
- Staging Worker health returned `{"status":"ok","d1":"ok"}`.
- Staging D1 held six imported rules, six targets, and 18 tiers. A second
  import left those counts unchanged.
- The development discount `gid://shopify/DiscountAutomaticNode/1710328545499`
  had seven published rules: six NTA campaigns plus the preexisting
  `Plus Function Test` rule. `lastError` was null.
- The draft-theme preview displayed Group Fish tiers 1–2 standard, 3–5
  save 5%, and 6+ save 10%. Three units entered the cart at A$9.50 each,
  with a single `Save 5%` discount and A$28.50 total.
- Root GitHub Actions run `36861492966` passed for commit `e4db7f1`.
- The draft-theme preview also displayed the expected tiers for Frozen Foods,
  Red Cherry Shrimp, Pea Puffers, Otocinclus, and Inverts. Changing the Red
  Cherry Shrimp variant from A$5 to A$6 kept the correct four-tier table.
  An ineligible Gift Card showed no bulk-pricing table.
- Six Inverts units entered the development cart with one `Save 10%` label,
  A$9.00 each instead of A$10.00, and A$54.00 for that line.

## Direct storefront and checkout verification on 2026-10-02

After entering the existing development-store password, the unpublished
Horizon theme was previewed directly. Password protection stayed enabled.
The product-page table, cart line, and checkout were checked at every quantity
below. Checkout showed exactly one TierWeave discount label for each eligible
discounted line; no discount appeared below the first tier.

| Campaign (test unit price) | Quantity → checkout total / discount label |
| --- | --- |
| Inverts (A$10) | 2 → A$20 / none; 3 → A$28.50 / Save 5%; 5 → A$47.50 / Save 5%; 6 → A$54 / Save 10% |
| Group Fish (A$10) | 2 → A$20 / none; 3 → A$28.50 / Save 5%; 5 → A$47.50 / Save 5%; 6 → A$54 / Save 10% |
| Frozen Foods (A$5) | 9 → A$45 / none; 10 → A$45 / Save A$0.50 each; 19 → A$85.50 / Save A$0.50 each; 20 → A$80 / Save A$1.00 each |
| Red Cherry Shrimp (A$5) | 3 → A$15 / none; 4 → A$18 / Save A$0.50 each; 9 → A$40.50 / Save A$0.50 each; 10 → A$40 / Save A$1.00 each; 19 → A$76 / Save A$1.00 each; 20 → A$70 / Save A$1.50 each |
| Pea Puffer (A$20) | 2 → A$40 / none; 3 → A$48 / Save A$4.00 each |
| Otocinclus (A$20) | 3 → A$60 / none; 4 → A$72 / Save A$2.00 each; 5 → A$90 / Save A$2.00 each; 6 → A$102 / Save A$3.00 each |

The alternative Red Cherry Shrimp variant (A$6) kept the four-tier table;
four units were A$5.50 each in the cart and A$22 at checkout, with one
`Save A$0.50 each` discount. A noneligible Collection Snowboard: Hydrogen
had no pricing table and no TierWeave discount in its A$600 checkout.

The app block fetched and rendered published pricing through its Shopify app
proxy. Direct navigation to the proxy URL was blocked by the browser client,
so the raw JSON response was not inspected separately. Collection precedence
is covered by local tests; the six mapped staging campaigns target products,
so a live collection-targeted rule was not added for this test.

The theme-editor preview's **Check out** button did not navigate, so checkout
verification used the direct draft-theme preview. Do not publish the Horizon
draft theme for this test.
