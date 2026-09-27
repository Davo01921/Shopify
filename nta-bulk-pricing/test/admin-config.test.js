import test from "node:test";
import assert from "node:assert/strict";
import {
  applyConfigEdit,
  parseConfigDocument,
  reviewConfig,
  ruleListRows,
  serializeConfigDocument,
  transitionConfigState,
} from "../src/admin-config.js";
import {
  CONFIG_STATES,
  CONFIG_VERSION,
} from "../src/rule-engine.js";

function baseRule(overrides = {}) {
  return {
    id: overrides.id ?? "rule",
    title: overrides.title ?? "Rule",
    enabled: overrides.enabled ?? true,
    priority: overrides.priority ?? 0,
    target: overrides.target ?? {
      type: "PRODUCT",
      ids: ["gid://shopify/Product/1"],
    },
    tiers: overrides.tiers ?? [
      { id: "base", min: 1, max: 2, discount: { type: "NONE" } },
      { id: "three", min: 3, max: null, discount: { type: "PERCENTAGE", value: 5 } },
    ],
  };
}

function config(state = CONFIG_STATES.DRAFT, rules = [baseRule()]) {
  return {
    version: CONFIG_VERSION,
    state,
    rules,
  };
}

test("valid draft is ready for validation", () => {
  const review = reviewConfig(config());
  assert.equal(review.valid, true);
  assert.equal(review.readyForValidation, true);
  assert.equal(review.readyForApproval, false);
  assert.equal(review.summary.ruleCount, 1);
  assert.equal(review.summary.enabledRuleCount, 1);
});

test("invalid configuration returns a blocking admin error", () => {
  const review = reviewConfig({ version: 999, state: CONFIG_STATES.DRAFT, rules: [] });
  assert.equal(review.valid, false);
  assert.equal(review.errors[0].code, "INVALID_CONFIGURATION");
  assert.equal(review.summary.errorCount, 1);
});

test("same exact target in multiple enabled rules is warned", () => {
  const review = reviewConfig(config(CONFIG_STATES.DRAFT, [
    baseRule({ id: "one" }),
    baseRule({ id: "two", priority: 10 }),
  ]));

  assert.equal(review.warnings.length, 1);
  assert.equal(review.warnings[0].code, "SAME_TARGET_MULTIPLE_RULES");
  assert.deepEqual(review.warnings[0].details.ruleIds, ["one", "two"]);
});

test("specific product overlap with product set is explained", () => {
  const review = reviewConfig(config(CONFIG_STATES.DRAFT, [
    baseRule({ id: "specific" }),
    baseRule({
      id: "broad",
      target: {
        type: "PRODUCTS",
        ids: ["gid://shopify/Product/1", "gid://shopify/Product/2"],
      },
    }),
  ]));

  assert.equal(review.warnings.some((item) => item.code === "PRODUCT_SPECIFICITY_OVERLAP"), true);
});

test("disabled duplicate rule does not create overlap warning", () => {
  const review = reviewConfig(config(CONFIG_STATES.DRAFT, [
    baseRule({ id: "live" }),
    baseRule({ id: "disabled", enabled: false }),
  ]));

  assert.equal(review.warnings.length, 0);
});

test("empty enabled rule set is warned", () => {
  const review = reviewConfig(config(CONFIG_STATES.DRAFT, [
    baseRule({ enabled: false }),
  ]));

  assert.equal(review.warnings[0].code, "NO_ENABLED_RULES");
});

test("draft must pass through validated before production approval", () => {
  assert.throws(
    () => transitionConfigState(config(), CONFIG_STATES.APPROVED_FOR_PRODUCTION),
    /invalid configuration transition/,
  );

  const validated = transitionConfigState(config(), CONFIG_STATES.VALIDATED);
  assert.equal(validated.state, CONFIG_STATES.VALIDATED);

  const approved = transitionConfigState(
    validated,
    CONFIG_STATES.APPROVED_FOR_PRODUCTION,
  );
  assert.equal(approved.state, CONFIG_STATES.APPROVED_FOR_PRODUCTION);
});

test("warnings require explicit acknowledgement before production approval", () => {
  const warned = config(CONFIG_STATES.VALIDATED, [
    baseRule({ id: "one" }),
    baseRule({ id: "two" }),
  ]);

  assert.throws(
    () => transitionConfigState(warned, CONFIG_STATES.APPROVED_FOR_PRODUCTION),
    /warnings must be acknowledged/,
  );

  const approved = transitionConfigState(
    warned,
    CONFIG_STATES.APPROVED_FOR_PRODUCTION,
    { acknowledgeWarnings: true },
  );
  assert.equal(approved.state, CONFIG_STATES.APPROVED_FOR_PRODUCTION);
});

test("editing approved configuration automatically demotes it to draft", () => {
  const approved = config(CONFIG_STATES.APPROVED_FOR_PRODUCTION);
  const edited = applyConfigEdit(approved, (copy) => {
    copy.rules[0].title = "Changed";
    return copy;
  });

  assert.equal(edited.state, CONFIG_STATES.DRAFT);
  assert.equal(edited.rules[0].title, "Changed");
  assert.equal(approved.rules[0].title, "Rule");
});

test("invalid edit is rejected before it can be returned", () => {
  assert.throws(
    () => applyConfigEdit(config(), (copy) => {
      copy.rules[0].tiers[1].min = 2;
      return copy;
    }),
    /overlapping tiers/,
  );
});

test("rule list rows contain admin-ready summaries", () => {
  const rows = ruleListRows(config());
  assert.deepEqual(rows[0], {
    id: "rule",
    title: "Rule",
    enabled: true,
    targetType: "PRODUCT",
    targetLabel: "Product",
    targetCount: 1,
    tierCount: 2,
    tierSummary: "1-2: standard • 3+: 5% off",
    priority: 0,
  });
});

test("configuration round-trips through metafield-safe JSON", () => {
  const original = config(CONFIG_STATES.VALIDATED);
  const raw = serializeConfigDocument(original);
  assert.deepEqual(parseConfigDocument(raw), original);
});

test("invalid JSON payload is rejected", () => {
  assert.throws(
    () => parseConfigDocument("{broken"),
    /not valid JSON/,
  );
});
