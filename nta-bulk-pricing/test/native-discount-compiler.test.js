import test from "node:test";
import assert from "node:assert/strict";
import {
  assessNativeCompatibility,
  compileNativeAutomaticDiscounts,
} from "../src/native-discount-compiler.js";

const oneProductPercentRule = {
  id: "pea",
  title: "Pea Puffers",
  target: { type: "PRODUCT", ids: ["gid://shopify/Product/1"] },
  tiers: [
    { id: "base", min: 1, max: 2, discount: { type: "NONE" } },
    { id: "three", min: 3, max: 5, discount: { type: "PERCENTAGE", value: 5 } },
    { id: "six", min: 6, max: null, discount: { type: "PERCENTAGE", value: 10 } },
  ],
};

test("single-product monotonic percentage tiers are native-compatible", () => {
  assert.deepEqual(assessNativeCompatibility(oneProductPercentRule), {
    exact: true,
    requiredAutomaticDiscounts: 2,
    reasons: [],
  });
});

test("percentage values compile to Shopify's decimal representation", () => {
  const out = compileNativeAutomaticDiscounts(oneProductPercentRule, {
    startsAt: "2026-09-25T00:00:00Z",
  });

  assert.equal(out.length, 2);
  assert.equal(out[0].minimumRequirement.quantity.greaterThanOrEqualToQuantity, "3");
  assert.equal(out[0].customerGets.value.percentage, 0.05);
  assert.equal(out[1].customerGets.value.percentage, 0.1);
});

test("multiple selected products are rejected by default because quantity can pool", () => {
  const rule = {
    ...oneProductPercentRule,
    target: {
      type: "PRODUCTS",
      ids: ["gid://shopify/Product/1", "gid://shopify/Product/2"],
    },
  };

  assert.equal(assessNativeCompatibility(rule).exact, false);
  assert.throws(
    () => compileNativeAutomaticDiscounts(rule, { startsAt: "2026-09-25T00:00:00Z" }),
    /pool qualifying items/,
  );
});

test("mixed percentage and fixed tiers are rejected by default", () => {
  const rule = {
    ...oneProductPercentRule,
    tiers: [
      { id: "base", min: 1, max: 9, discount: { type: "NONE" } },
      { id: "ten", min: 10, max: 19, discount: { type: "PERCENTAGE", value: 8 } },
      { id: "twenty", min: 20, max: null, discount: { type: "FIXED_PER_ITEM", value: 1 } },
    ],
  };

  const assessment = assessNativeCompatibility(rule);
  assert.equal(assessment.exact, false);
  assert.match(assessment.reasons.join(" "), /mixed percentage\/fixed tiers/);
});

test("fixed amount native input applies on each item", () => {
  const rule = {
    id: "frozen",
    title: "Frozen",
    target: { type: "PRODUCT", ids: ["gid://shopify/Product/3"] },
    tiers: [
      { id: "twenty", min: 20, max: null, discount: { type: "FIXED_PER_ITEM", value: 1 } },
    ],
  };

  const out = compileNativeAutomaticDiscounts(rule, {
    startsAt: "2026-09-25T00:00:00Z",
  });

  assert.deepEqual(out[0].customerGets.value, {
    discountAmount: { amount: "1", appliesOnEachItem: true },
  });
});
