# Phase 2 — Shopify Admin Configuration Layer

## Objective

Build the merchant-facing configuration layer for NTA bulk pricing without changing live checkout behaviour.

Koala remains authoritative throughout Phase 2.

## Current Shopify UI choice

Use an embedded **App Home iframe app** built from Shopify's current React Router template, using:

- `@shopify/shopify-app-react-router`
- App Bridge
- Polaris web components
- App Bridge Resource Picker for products, variants and collections
- stable Polaris App Home channel for the first production build

Do not use legacy Polaris React components for new UI.

The repository currently contains the pricing core but does not yet contain a Shopify CLI-generated React Router app. The actual scaffold must be generated/linked through Shopify CLI so authentication, app identity, session storage and development tunnelling are created correctly rather than being hand-faked in source control.

## Why App Home rather than only a discount-details UI extension

The NTA V1 configuration is more complex than a single percentage field. It needs:

- multiple independently named rules;
- product, variant and collection targets;
- tier editors;
- overlap diagnostics;
- DRAFT / VALIDATED / APPROVED lifecycle;
- configuration health;
- future diagnostics and test-cart tooling.

A Function Settings extension can still be added later for a compact entry point, but App Home is the canonical management surface.

## Admin pages

### 1. Rules dashboard

Shows:

- configuration state;
- configuration version;
- total rule count;
- enabled rule count;
- warning/error count;
- one row per rule;
- target type/count;
- tier summary;
- enabled state;
- priority.

Primary actions:

- Add rule
- Validate configuration
- Approve for production
- Return to draft

Production approval is not allowed directly from DRAFT.

### 2. Rule editor

Fields:

- internal rule title;
- enabled toggle;
- target type;
- Shopify resource selector;
- quantity tiers;
- discount type;
- discount value;
- optional customer-facing message;
- display title/badge;
- numeric tie-break priority.

Changing an approved or validated configuration automatically demotes it to DRAFT.

### 3. Configuration health

Show blocking errors and non-blocking warnings separately.

Initial warning types:

- same exact target appears in multiple enabled rules;
- a specific-product rule overlaps a product-set rule for the same product;
- no enabled rules.

The engine's deterministic precedence remains authoritative even when an overlap is intentionally accepted.

### 4. Diagnostics preview

For a chosen test line, show:

- matched rule;
- matched tier;
- discount;
- reason code;
- competing rules;
- why each competing rule lost.

This uses the same `diagnoseLine()` output that the eventual Function adapter will consume.

## State lifecycle

```text
DRAFT
  |
  | validate
  v
VALIDATED
  |
  | explicit approve
  v
APPROVED_FOR_PRODUCTION
```

Allowed reverse transitions:

- VALIDATED -> DRAFT
- APPROVED_FOR_PRODUCTION -> DRAFT

Any configuration edit forces DRAFT.

If warnings exist, production approval requires an explicit acknowledgement action.

## Persistence contract

V1 persists one JSON configuration document.

Shape:

```json
{
  "version": 1,
  "state": "DRAFT",
  "rules": []
}
```

The Phase 2 code serializes/parses this through `serializeConfigDocument()` and `parseConfigDocument()`.

For Phase 3, the approved document will be stored in an app-scoped Shopify metafield associated with the app-managed automatic discount so the Discount Function can read the same configuration document at checkout.

## Resource picker contract

| Engine target | Shopify picker | Multiple |
| --- | --- | --- |
| PRODUCT | product | No |
| PRODUCTS | product | Yes |
| VARIANTS | variant | Yes |
| COLLECTIONS | collection | Yes |

The picker adapter verifies returned Shopify GID types before saving the target.

## Fail-safe requirements

The admin must never:

- bypass `validateConfigDocument()`;
- save malformed target IDs;
- allow direct DRAFT -> APPROVED transition;
- retain production approval after a rule edit;
- silently ignore overlap warnings;
- create a second pricing calculation implementation in UI code.

The UI edits configuration. The core engine remains the source of pricing semantics.

## Shopify scaffold integration

When the Shopify CLI-generated React Router shell is added:

1. authenticate all `/app/*` routes with `authenticate.admin(request)`;
2. use `<AppProvider embedded apiKey={apiKey}>`;
3. render navigation through `<s-app-nav>`;
4. use Polaris web components for page/form layout;
5. use `useAppBridge()` to access `shopify.resourcePicker`, toast and save-bar APIs;
6. persist configuration server-side using authenticated Admin API access;
7. do not expose app secrets or access tokens to browser code.

## Phase 2 acceptance gate

Phase 2 is complete only when:

- the real embedded admin opens in a development store;
- all four NTA offer families can be configured without source edits;
- resource selection works for product/product-set/variant/collection targets;
- edits demote configuration to DRAFT;
- validation and approval workflow is visible and enforced;
- warnings are visible and require acknowledgement for production approval;
- configuration persists and reloads without changing semantic content;
- automated tests pass;
- no live NTA discount has been changed.
