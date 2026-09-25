# Architecture

## Store constraint

NTA is on Shopify Basic.

Shopify Functions are available on all plans when delivered by a public app distributed through the Shopify App Store. Custom-distribution apps that contain Shopify Functions require Shopify Plus.

Therefore the exact production architecture and the private-app architecture are not the same thing.

## Exact production path on Shopify Basic

1. **Public Shopify app with limited listing visibility**
   - submitted through Shopify App Store review
   - can remain intentionally hard to discover while still being a public app
   - gives a Basic-plan store access to the Discount Function

2. **Admin configuration UI**
   - create/edit/delete/enable rules
   - choose products or collections using Shopify resource pickers
   - edit tiers, labels and badges
   - validate overlaps before save

3. **One automatic NTA bulk-pricing discount**
   - Shopify unified Discount Function API
   - function target: `cart.lines.discounts.generate.run`
   - configuration stored in one app-owned JSON metafield
   - product discount candidates only
   - no external network dependency during checkout

4. **Theme app extension**
   - product-page app block
   - renders the applicable quantity tiers
   - calculated savings text is the default
   - custom marketing badge is optional

## Why native automatic discounts are only a fallback

Shopify Basic supports native automatic amount-off discounts, and the Admin API can create them without a Function. They can represent some simple volume tiers by creating one automatic discount per threshold.

However they are not generally equivalent to the captured Koala behaviour:

- A minimum quantity for a discount that targets multiple products or a collection counts qualifying items across that target. It does not guarantee "three of this exact cart line".
- Shopify Basic applies only one product discount to the same line and chooses the best eligible discount when multiple non-combinable product discounts overlap.
- Percentage and fixed-dollar tiers can cross over. Example: an 8% tier can be worth more than a later A$1-off tier on higher-priced products, causing the earlier tier to win.
- Shopify limits stores to 25 active automatic discounts. Expanding two tiers across many individual products can exceed that quickly.

The native compiler therefore defaults to refusing conversions that cannot be proven equivalent.

## Function input for the exact path

The production Function should request only:

- cart line id
- cart line quantity
- variant id
- product id
- membership for configured collection IDs where needed
- the app-owned JSON configuration metafield on the discount

The Function should keep the input query below Shopify's Function query complexity limit and use one JSON metafield for configuration.

## Rule document

```json
{
  "version": 1,
  "rules": [
    {
      "id": "example",
      "title": "GROUP FISH DISCOUNTS",
      "enabled": true,
      "priority": 0,
      "target": {
        "type": "PRODUCTS",
        "ids": ["gid://shopify/Product/123"]
      },
      "tiers": [
        {
          "id": "one",
          "min": 1,
          "max": 2,
          "discount": { "type": "NONE" }
        },
        {
          "id": "three",
          "min": 3,
          "max": null,
          "discount": { "type": "PERCENTAGE", "value": 5 }
        }
      ],
      "display": {
        "blockTitle": "GROUP FISH DISCOUNTS",
        "badge": "",
        "showOriginalPrice": true,
        "showSavings": true
      }
    }
  ]
}
```

## Deliberate exclusions from V1

No subscription logic, post-purchase upsells, free gifts, buy-X-get-Y bundles, cross-product mix-and-match quantity pooling, third-party analytics, or complex translation system.

These can be added later only if NTA actually needs them.
