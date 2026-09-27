# NTA Bulk Pricing — Phased Rollout

This is the production rollout plan for replacing Koala quantity/bulk pricing at Nano Tanks Australia.

The project deliberately follows the operating lessons from ShipWeave:
- deterministic engine first;
- configuration instead of hard-coded store logic;
- explicit precedence and fail-safe behaviour;
- privacy-safe diagnostics;
- automated regression tests plus real Shopify cart/checkout verification;
- incumbent app remains authoritative until parity is proven;
- documented rollback and production SOP;
- future public/beta distribution considered from the start.

## Current state

- Repository: `Davo01921/Shopify`
- Working branch: `feat/nta-bulk-pricing-phase-1`
- PR: #2
- Koala: remains active and authoritative
- Production cutover: NOT APPROVED
- Shopify plan constraint: NTA is on Shopify Basic
- Exact Function-based path: public App Store distribution; custom apps containing Shopify Functions require Shopify Plus

Captured Koala offer families:
1. Inverts
2. Group / Schooling Fish
3. Frozen Foods
4. Pea Puffers / specific-product rules

## Operating modes

The replacement will use explicit modes:
- `OFF` — no NTA bulk-pricing discount is applied.
- `SHADOW` — configuration and comparison tools can evaluate carts, but the replacement does not become authoritative at checkout.
- `LIVE` — Shopify Discount Function applies the configured NTA bulk-pricing rules.

A mode change to `LIVE` is a production action and only occurs after Phase 6 acceptance.

## Configuration states

Configuration should have an explicit lifecycle:
- `DRAFT`
- `VALIDATED`
- `APPROVED_FOR_PRODUCTION`

Checkout must fail safe. Missing, malformed, unsupported or unapproved configuration must result in no NTA bulk-pricing discount rather than a guessed discount.

---

## Phase 0 — Recovery and constraints

### Goal
Resume from the real implementation and lock the platform constraints before adding more code.

### Work
- Verify repository, branch and PR.
- Re-read Koala capture and architecture.
- Re-check current Shopify Functions availability for Shopify Basic.
- Confirm Koala remains untouched.
- Use ShipWeave as the production-readiness reference.

### Exit gate
- Existing implementation is understood.
- No duplicate/replacement project is created.
- Production constraints are documented.

### Status
**COMPLETE**

---

## Phase 1 — Core engine hardening

### Goal
Make the rule engine deterministic, safe and suitable to become the canonical pricing semantics.

### Work
- Preserve specificity precedence:
  1. explicit variant
  2. single product
  3. selected product set
  4. collection
  5. numeric priority only breaks ties at the same specificity
- Validate IDs, tier ranges, discount types and values.
- Keep line-level quantity semantics; do not silently pool quantities across different products.
- Support:
  - no-discount display tiers
  - percentage discount
  - fixed amount off each item
- Encode Shopify Function money values in the schema-compatible representation.
- Add reason codes / evaluation trace suitable for admin diagnostics.
- Add configuration versioning.
- Add regression tests for precedence, tier boundaries, overlaps, malformed configuration and mixed discount types.

### ShipWeave lesson
Never let flexible configuration override a safety invariant. Explicit product assignments must not be accidentally overridden by broader rules.

### Exit gate
- Engine tests pass.
- Precedence cannot be reversed by extreme priority values.
- Invalid configuration fails closed.
- Rule evaluation returns enough structured detail to explain the result.

### Status
**IN PROGRESS**

---

## Phase 2 — Admin configuration layer

### Goal
Allow bulk-pricing rules to be managed without changing source code.

### Work
Create an embedded Shopify admin interface to:
- list rules;
- create/edit/delete rules;
- enable/disable rules;
- choose products, variants and collections with Shopify resource pickers;
- edit quantity tiers;
- choose percentage or fixed-per-item discount;
- edit customer-facing titles/badges;
- set priority;
- preview rule matching;
- detect target overlap before saving;
- show configuration health.

Persist one versioned app-owned JSON rule document, with schema validation before publication.

### Diagnostics
Admin should answer:
- Which rule matched?
- Which target matched?
- Which tier matched?
- Why did another rule lose?
- What discount would be generated?
- Is this configuration production-approved?

### Exit gate
- All four NTA offer families can be represented through UI only.
- No production rule requires a code edit.
- Invalid or ambiguous changes cannot be promoted to approved configuration.

### Status
**NOT STARTED**

---

## Phase 3 — Shopify Discount Function integration

### Goal
Make Shopify checkout execute the same pricing semantics.

### Work
- Add the Discount Function target:
  `cart.lines.discounts.generate.run`
- Keep the Function input minimal:
  - cart line ID
  - quantity
  - variant ID
  - product ID
  - required collection membership
  - app-owned configuration metafield
- No external network dependency during discount calculation.
- Generate product discount operations from the approved configuration.
- Keep fixed-per-item and percentage behaviour identical to the reference engine.
- Return no discount on invalid/unapproved configuration.
- Add Function fixtures generated from the same reference test vectors used by the core engine.

### Distribution gate
NTA is currently on Shopify Basic. The exact Function path therefore requires public App Store distribution/review rather than a custom Function app.

### Exit gate
- Function fixtures match core-engine outputs.
- Function builds against the selected Shopify API version.
- A development store can execute representative carts correctly.

### Status
**NOT STARTED**

---

## Phase 4 — Storefront pricing display

### Goal
Show customers the same tiers that checkout will enforce.

### Work
Create a theme app extension/product-page block that:
- resolves the applicable rule for the current product/variant;
- renders quantity tiers;
- shows actual calculated savings;
- does not trust manually written percentage badges when they conflict with configuration;
- updates when variant changes;
- hides cleanly if no rule applies.

### Rule
The storefront is explanatory only. Checkout remains authoritative.

### Exit gate
- Product-page tiers match the approved rule document.
- Displayed savings agree with cart/checkout calculations on test cases.

### Status
**NOT STARTED**

---

## Phase 5 — Koala parity capture and comparison

### Goal
Determine what Koala actually charges, not merely what its labels/screenshots claim.

### Work
Build a comparison matrix for real NTA products across:
- Inverts
- Schooling Fish
- Frozen Foods
- Pea Puffers
- any additional specific-product rule discovered during audit

For each offer test:
- below threshold;
- exact first threshold;
- middle tier;
- exact upper tier boundary;
- first quantity in next tier;
- high quantity;
- multiple variants;
- eligible + non-eligible mixed cart;
- overlapping specific-product and collection targets.

Record:
- Koala displayed message;
- cart unit price;
- cart discount;
- checkout discount;
- replacement expected result;
- match/difference;
- reason.

Do not migrate contradictory Koala labels blindly. The checkout result is the behavioural reference unless David explicitly chooses new pricing.

### Exit gate
- Every existing Koala offer has a verified live behaviour.
- Any intended differences are documented and approved.

### Status
**NOT STARTED**

---

## Phase 6 — Production-equivalent validation

### Goal
Prove the replacement works under real Shopify behaviour before cutover.

### Automated tests
Cover at minimum:
- all tier boundaries;
- percentage tiers;
- fixed-per-item tiers;
- no-discount tiers;
- overlap precedence;
- disabled rules;
- deleted/unavailable targets;
- malformed config;
- empty config;
- collection/product overlap;
- variant/product overlap;
- mixed carts;
- discount combination policy;
- rounding;
- high quantity;
- configuration version migration.

### Real Shopify tests
Run actual cart and checkout tests for every NTA offer family.

### ShipWeave lesson
An internally correct engine is not enough. Shopify's real execution behaviour is part of the system and must be tested directly.

### Exit gate
- Automated suite green.
- All production test-matrix rows pass.
- No unexplained Koala/replacement differences.
- Rollback procedure verified.

### Status
**NOT STARTED**

---

## Phase 7 — Controlled cutover

### Goal
Replace Koala without exposing customers to an untested pricing change.

### Sequence
1. Freeze approved rule configuration.
2. Record current Koala settings/screenshots.
3. Confirm replacement configuration is `APPROVED_FOR_PRODUCTION`.
4. Confirm rollback steps.
5. Enable replacement in `LIVE`.
6. Disable the overlapping Koala offers.
7. Immediately run targeted live-cart tests.
8. Review Shopify Function errors/monitoring.
9. Keep Koala available for rollback until stability is established.

### Rollback trigger examples
- checkout discount missing;
- incorrect tier;
- unexpected stacking;
- broad rule overriding specific product;
- pricing mismatch not explained by the approved configuration;
- Shopify Function execution errors.

### Rollback action
- switch replacement to `OFF`;
- restore/re-enable Koala offers;
- investigate before another cutover.

### Exit gate
- Live orders produce expected discounts.
- No Function errors or unexplained pricing differences during the validation window.

### Status
**NOT STARTED**

---

## Phase 8 — Stabilisation and operations

### Goal
Make the app maintainable after launch.

### Work
- Production SOP.
- Technical design.
- Functional specification.
- Troubleshooting guide.
- Configuration backup/export.
- Change audit history.
- Health/configuration screen.
- Shopify Function monitoring procedure.
- Versioned release notes.
- Regression suite run before every deploy.

### Exit gate
A future rule change can be made, validated, deployed and rolled back without relying on developer memory.

### Status
**NOT STARTED**

---

## Phase 9 — Limited beta / reusable app

### Goal
Only after NTA proves the system, decide whether to make it reusable for other Shopify merchants.

### Work
- Remove NTA-specific names/defaults from reusable layers.
- Tenant-isolate configuration.
- Complete App Store review requirements.
- Add onboarding.
- Add billing only if commercially useful.
- Prepare controlled beta with clear support boundaries.
- Keep the NTA production configuration separately protected.

### Exit gate
NTA remains stable while another test store can configure and execute independent rules.

### Status
**FUTURE**

---

## Immediate next actions

1. Finish Phase 1 hardening and regression tests.
2. Capture exact current Koala checkout values for the four offer families.
3. Define the versioned rule JSON contract and diagnostics result contract.
4. Scaffold the embedded admin and Discount Function only after the engine contract is frozen.
