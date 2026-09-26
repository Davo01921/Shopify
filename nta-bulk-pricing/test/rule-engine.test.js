import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProductDiscountOperation,
  evaluateLine,
  selectRuleForLine,
  selectTier,
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
      { id: "p2", min: 3, max: null, discount: { type: "FIXED_PER_ITEM", value: 4 } },
    ],
  },
  {
    id: "frozen-food",
    title: "FROZEN FOODS",
    enabled: true,
    target: { type: "PRODUCTS", ids: ["gid://shopify/Product/frozen"] },
    tiers: [
      { id: "f1", min: 1, max: 9, discount: { type: "NONE" } },
      { id: "f2", min: 10, max: 19, discount: { type: "FIXED_PER_ITEM", value: 0.5 } },
      { id: "f3", min: 20, max: null, discount: { type: "FIXED_PER_ITEM", value: 1 } },
    ],
  },
];

test("rules validate", () => assert.equal(validateRules(rules), true));

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
  assert.deepEqual(evaluateLine(line, rules).discount, { type: "FIXED_PER_ITEM", value: 4 });
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
    { fixedAmount: { amount: 1, appliesToEachItem: true } },
  );
});

test("frozen-food 10–19 tier applies A$0.50 to each item", () => {
  const line = {
    lineId: "line-frozen-ten",
    productId: "gid://shopify/Product/frozen",
    variantId: "gid://shopify/ProductVariant/frozen",
    quantity: 10,
    collectionMemberships: [],
  };

  const operation = buildProductDiscountOperation([line], rules);
  assert.deepEqual(
    operation.productDiscountsAdd.candidates[0].value,
    { fixedAmount: { amount: 0.5, appliesToEachItem: true } },
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
});

test("overlapping tiers are rejected", () => {
  const invalid = [{
    id: "bad",
    enabled: true,
    target: { type: "PRODUCTS", ids: ["x"] },
    tiers: [
      { id: "a", min: 1, max: 5, discount: { type: "NONE" } },
      { id: "b", min: 5, max: null, discount: { type: "PERCENTAGE", value: 5 } },
    ],
  }];

  assert.throws(() => validateRules(invalid), /overlapping tiers/);
});
