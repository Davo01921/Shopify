# Architecture

## Shopify pieces

1. **Embedded admin app**
   - create/edit/delete/enable rules
   - choose products or collections using Shopify resource pickers
   - edit tiers, labels and badges
   - validate overlaps before save

2. **One automatic NTA bulk-pricing discount**
   - implemented with Shopify's unified Discount Function API
   - function target: `cart.lines.discounts.generate.run`
   - rule configuration stored on the discount in an app-owned JSON metafield
   - the function emits product discount candidates only; no network dependency during checkout

3. **Theme app extension**
   - product-page app block
   - reads the applicable rule and renders quantity tiers
   - calculated saving text is the default
   - custom marketing badge remains optional

## Function input

The production Function should request only:
- cart line id
- cart line quantity
- variant id
- product id
- membership for the configured collection IDs
- the app-owned JSON configuration metafield on the discount

For Shopify API 2026-07, collection membership should be queried on the variant where possible so the app remains compatible with variant-scoped collections.

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
