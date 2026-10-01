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

The development storefront is password protected. Complete direct checkout
testing with its existing storefront password; do not remove the protection
to run these checks. The theme-editor preview supports cart checks, but its
**Check out** control did not open checkout. Do not publish the Horizon draft
theme for this test.
