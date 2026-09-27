import test from "node:test";
import assert from "node:assert/strict";
import {
  CONFIG_STATES,
  CONFIG_VERSION,
  REASON_CODES,
  buildProductDiscountOperation,
  diagnoseLine,
  evaluateCheckout,
  evaluateLine,
  inspectConfigDocument,
  selectRuleForLine,
  selectTier,
  validateConfigDocument,
  validateRules,
} from "../src/rule-engine.js";

const rules = [
  {
    id: "schooling-fish",
    title: "GROUP FISH DISCOUNTS",
    enabled: true,
    target: { type: "COLLECTIONS", ids: ["gid://shopify/Collection/fish"] },
    tiers: [
      { id: "s1", min: 1, max: 2, discount: { type: "NONE" } },
      { id: "s2", min: 3, max: 5, discount: { type: "PERCENTAGE", value: 5 } },
      { id: "s3", min: 6, max: null, discount: { type: "PERCENTAGE", value: 10 } },
    ],
  },
  {
    id: "pea-puffer",
    title: "Pea Puffers",
    enabled: true,
    target: { type: "PRODUCT", ids: ["gid://shopify/Product/pea"] },
    tiers: [
      { id: "p1", min: 1, max: 2, discount: { type: "NONE" } },
      { id: "p2", min: 3, max: null, discount: { type: "PERCENTAGE", value: 6 } },
    ],
  },
  {
    id: "frozen-food",
    title: "FROZEN FOODS",
    enabled: true,
    target: { type: "PRODUCTS", ids: ["gid://shopify/Product/frozen"] },
    tiers: [
      { id: "f1", min: 1, max: 9, discount: { type: "NONE" } },
      { id: "f2", min: 10, max: 19, discount: { type: "PERCENTAGE", value: 8 } },
      { id: "f3", min: 20, max: null, discount: { type: "FIXED_PER_ITEM", value: 1 } },
    ],
  },
];

const approvedConfig = {
  version: CONFIG_VERSION,
  state: CONFIG_STATES.APPROVED_FOR_PRODUCTION,
  rules,
};

test("rules validate", () => assert.equal(validateRules(rules), true));

test("approved versioned configuration validates", () => {
  assert.equal(validateConfigDocument(approvedConfig), true);
  assert.deepEqual(inspectConfigDocument(approvedConfig), {
    valid: true,
    version: 1,
    state: "APPROVED_FOR_PRODUCTION",
    ruleCount: 3,
    error: null,
  });
});

test("unsupported configuration version fails closed at checkout", () => {
  const config = { ...approvedConfig, version: 2 };
  const out = evaluateCheckout([], config);
  assert.equal(out.operation, null);
  assert.equal(out.reasonCode, REASON_CODES.INVALID_CONFIG);
  assert.match(out.configuration.error, /unsupported configuration version/);
});

test("unapproved configuration fails closed at checkout", () => {
  const config = { ...approvedConfig, state: CONFIG_STATES.DRAFT };
  const out = evaluateCheckout([], config);
  assert.equal(out.operation, null);
  assert.equal(out.reasonCode, REASON_CODES.CONFIG_NOT_APPROVED);
});

test("draft configuration can be evaluated explicitly without becoming authoritative", () => {
  const config = { ...approvedConfig, state: CONFIG_STATES.DRAFT };
  const out = evaluateCheckout([
    {
      lineId: "line-draft",
      productId: "gid://shopify/Product/pea",
      variantId: "gid://shopify/ProductVariant/pea",
      quantity: 3,
      collectionMemberships: [],
    },
  ], config, { requireApproved: false });

  assert.equal(out.reasonCode, REASON_CODES.DISCOUNT_APPLIED);
  assert.equal(out.lines[0].discount.value, 6);
});

test("selects the tier by inclusive quantity range", () => {
  assert.equal(selectTier(rules[0], 2).id, "s1");
  assert.equal(selectTier(rules[0], 3).id, "s2");
  assert.equal(selectTier(rules[0], 6).id, "s3");
});

test("specific product overrides a broader collection rule", () => {
  const line = {
    lineId: "line-1",
    productId: "gid://shopify/Product/pea",
    variantId: "gid://shopify/ProductVariant/pea",
    quantity: 3,
    collectionMemberships: [
      { collectionId: "gid://shopify/Collection/fish", isMember: true },
    ],
  };

  assert.equal(selectRuleForLine(line, rules).id, "pea-puffer");
  assert.equal(evaluateLine(line, rules).discount.value, 6);
});

test("fixed amount is applied to each item", () => {
  const line = {
    lineId: "line-2",
    productId: "gid://shopify/Product/frozen",
    variantId: "gid://shopify/ProductVariant/frozen",
    quantity: 20,
    collectionMemberships: [],
  };

  const operation = buildProductDiscountOperation([line], rules);
  assert.deepEqual(
    operation.productDiscountsAdd.candidates[0].value,
    { fixedAmount: { amount: "1", appliesToEachItem: true } },
  );
});

test("standard-price tier emits no discount candidate", () => {
  const line = {
    lineId: "line-3",
    productId: "gid://shopify/Product/frozen",
    variantId: "gid://shopify/ProductVariant/frozen",
    quantity: 5,
    collectionMemberships: [],
  };

  assert.equal(buildProductDiscountOperation([line], rules), null);
  assert.equal(diagnoseLine(line, rules).reasonCode, REASON_CODES.STANDARD_PRICE_TIER);
});

test("gap in tiers produces an explainable no-discount result", () => {
  const gapRule = {
    id: "gap",
    title: "Gap example",
    enabled: true,
    target: { type: "PRODUCT", ids: ["gid://shopify/Product/gap"] },
    tiers: [
      { id: "one", min: 1, max: 2, discount: { type: "NONE" } },
      { id: "five", min: 5, max: null, discount: { type: "PERCENTAGE", value: 5 } },
    ],
  };
  validateRules([gapRule]);

  const diagnostic = diagnoseLine({
    lineId: "gap-line",
    productId: "gid://shopify/Product/gap",
    variantId: "gid://shopify/ProductVariant/gap",
    quantity: 3,
    collectionMemberships: [],
  }, [gapRule]);

  assert.equal(diagnostic.reasonCode, REASON_CODES.NO_MATCHING_TIER);
  assert.equal(diagnostic.discount, null);
});

test("overlapping tiers are rejected", () => {
  const invalid = [{
    id: "bad",
    title: "Bad overlap",
    enabled: true,
    target: { type: "PRODUCTS", ids: ["gid://shopify/Product/x"] },
    tiers: [
      { id: "a", min: 1, max: 5, discount: { type: "NONE" } },
      { id: "b", min: 5, max: null, discount: { type: "PERCENTAGE", value: 5 } },
    ],
  }];

  assert.throws(() => validateRules(invalid), /overlapping tiers/);
});

test("duplicate target ids are rejected", () => {
  const invalid = [{
    id: "duplicate-target",
    title: "Duplicate target",
    target: {
      type: "PRODUCTS",
      ids: ["gid://shopify/Product/1", "gid://shopify/Product/1"],
    },
    tiers: [
      { id: "one", min: 1, max: null, discount: { type: "NONE" } },
    ],
  }];

  assert.throws(() => validateRules(invalid), /duplicate target id/);
});

test("target type and Shopify GID type must agree", () => {
  const invalid = [{
    id: "bad-gid",
    title: "Bad GID",
    target: {
      type: "VARIANTS",
      ids: ["gid://shopify/Product/1"],
    },
    tiers: [
      { id: "one", min: 1, max: null, discount: { type: "NONE" } },
    ],
  }];

  assert.throws(() => validateRules(invalid), /target id does not match VARIANTS/);
});

test("duplicate tier ids are rejected", () => {
  const invalid = [{
    id: "duplicate-tier",
    title: "Duplicate tier",
    target: { type: "PRODUCT", ids: ["gid://shopify/Product/1"] },
    tiers: [
      { id: "same", min: 1, max: 2, discount: { type: "NONE" } },
      { id: "same", min: 3, max: null, discount: { type: "PERCENTAGE", value: 5 } },
    ],
  }];

  assert.throws(() => validateRules(invalid), /duplicate tier id/);
});

test("NONE tiers cannot hide a non-zero discount value", () => {
  const invalid = [{
    id: "hidden-discount",
    title: "Hidden discount",
    target: { type: "PRODUCT", ids: ["gid://shopify/Product/1"] },
    tiers: [
      { id: "one", min: 1, max: null, discount: { type: "NONE", value: 5 } },
    ],
  }];

  assert.throws(() => validateRules(invalid), /NONE discount cannot carry a non-zero value/);
});

test("specificity always wins before numeric priority", () => {
  const broadHighPriority = {
    id: "broad-high-priority",
    title: "Broad collection",
    enabled: true,
    priority: 9999,
    target: { type: "COLLECTIONS", ids: ["gid://shopify/Collection/fish"] },
    tiers: [
      { id: "b1", min: 1, max: null, discount: { type: "PERCENTAGE", value: 50 } },
    ],
  };

  const specificLowPriority = {
    id: "specific-low-priority",
    title: "Specific product",
    enabled: true,
    priority: -9999,
    target: { type: "PRODUCT", ids: ["gid://shopify/Product/pea"] },
    tiers: [
      { id: "s1", min: 1, max: null, discount: { type: "PERCENTAGE", value: 6 } },
    ],
  };

  const line = {
    lineId: "line-priority",
    productId: "gid://shopify/Product/pea",
    variantId: "gid://shopify/ProductVariant/pea",
    quantity: 3,
    collectionMemberships: [
      { collectionId: "gid://shopify/Collection/fish", isMember: true },
    ],
  };

  const diagnostic = diagnoseLine(line, [broadHighPriority, specificLowPriority]);

  assert.equal(
    selectRuleForLine(line, [broadHighPriority, specificLowPriority]).id,
    "specific-low-priority",
  );
  assert.equal(diagnostic.competingRules[0].id, "broad-high-priority");
  assert.equal(diagnostic.competingRules[0].lostBecause, "LOWER_SPECIFICITY");
});

test("priority breaks ties only inside the same specificity class", () => {
  const low = {
    id: "low",
    title: "Low",
    enabled: true,
    priority: 1,
    target: { type: "PRODUCTS", ids: ["gid://shopify/Product/pea"] },
    tiers: [{ id: "one", min: 1, max: null, discount: { type: "PERCENTAGE", value: 5 } }],
  };
  const high = {
    ...low,
    id: "high",
    title: "High",
    priority: 2,
  };

  const diagnostic = diagnoseLine({
    lineId: "line-tie",
    productId: "gid://shopify/Product/pea",
    variantId: "gid://shopify/ProductVariant/pea",
    quantity: 1,
    collectionMemberships: [],
  }, [low, high]);

  assert.equal(diagnostic.selectedRule.id, "high");
  assert.equal(diagnostic.competingRules[0].lostBecause, "LOWER_PRIORITY");
});

test("disabled rule cannot win", () => {
  const disabled = {
    id: "disabled",
    title: "Disabled",
    enabled: false,
    priority: 999,
    target: { type: "PRODUCT", ids: ["gid://shopify/Product/pea"] },
    tiers: [{ id: "one", min: 1, max: null, discount: { type: "PERCENTAGE", value: 90 } }],
  };

  const line = {
    lineId: "line-disabled",
    productId: "gid://shopify/Product/pea",
    variantId: "gid://shopify/ProductVariant/pea",
    quantity: 3,
    collectionMemberships: [],
  };

  assert.equal(selectRuleForLine(line, [disabled, rules[1]]).id, "pea-puffer");
});

test("invalid line is diagnosed and never emits a candidate", () => {
  const line = {
    lineId: "bad-line",
    productId: "gid://shopify/Product/pea",
    variantId: "gid://shopify/ProductVariant/pea",
    quantity: 0,
    collectionMemberships: [],
  };

  assert.equal(diagnoseLine(line, rules).reasonCode, REASON_CODES.INVALID_LINE);
  assert.equal(buildProductDiscountOperation([line], rules), null);
});

test("checkout evaluation returns per-line explanation for mixed cart", () => {
  const out = evaluateCheckout([
    {
      lineId: "eligible",
      productId: "gid://shopify/Product/pea",
      variantId: "gid://shopify/ProductVariant/pea",
      quantity: 3,
      collectionMemberships: [],
    },
    {
      lineId: "ordinary",
      productId: "gid://shopify/Product/ordinary",
      variantId: "gid://shopify/ProductVariant/ordinary",
      quantity: 2,
      collectionMemberships: [],
    },
  ], approvedConfig);

  assert.equal(out.status, "DISCOUNT");
  assert.equal(out.operation.productDiscountsAdd.candidates.length, 1);
  assert.equal(out.lines[0].reasonCode, REASON_CODES.DISCOUNT_APPLIED);
  assert.equal(out.lines[1].reasonCode, REASON_CODES.NO_MATCHING_RULE);
});
