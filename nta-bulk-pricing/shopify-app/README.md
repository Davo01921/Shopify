# NTA Bulk Pricing Shopify App

Embedded Shopify admin for the NTA Koala replacement.

## Status

Phase 2 development scaffold. It does not apply checkout discounts.

Koala remains authoritative.

## Link to the existing Partner app

From this directory:

```bash
npm install
npm run config:link
```

Choose the existing NTA bulk-pricing app in the Shopify Partner/Dev dashboard. Do not create a second production app unless intentionally testing a separate development identity.

After linking:

```bash
npm run setup
npm run dev
```

## Required scopes

- `read_products`
- `read_discounts`
- `write_discounts`

Phase 2 uses `read_products` for resource selection. Discount scopes are included now because Phase 3 will create/manage the app-backed automatic discount and its configuration metafield.

## Pages

- `/app` — rule dashboard and configuration lifecycle
- `/app/rules/new` — add a rule
- `/app/rules/:ruleId` — edit/delete a rule
- `/app/diagnostics` — evaluate a test cart line without applying a live discount

## Storage

Phase 2 stores the versioned JSON configuration per shop in Prisma/SQLite.

Every edit returns the configuration to `DRAFT`.

Phase 3 will attach the production-approved configuration to the app-managed automatic discount using an app-scoped metafield so the Discount Function reads the same rule document during checkout.

## API version

The server defaults to Shopify Admin API `2026-07`. Override with `SHOPIFY_API_VERSION` if a later tested stable version is adopted.

## Production note

SQLite is acceptable for local/development testing. Before multi-instance public deployment, move session/config storage to a production database such as Postgres.
