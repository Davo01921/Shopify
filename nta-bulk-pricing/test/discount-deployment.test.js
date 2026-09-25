import test from "node:test";
import assert from "node:assert/strict";
import {
  automaticDiscountInput,
  configurationHash,
  mutationDiscount,
} from "../src/discount-deployment.js";

const configuration = { version: 1, collectionIds: [], rules: [{ id: "one" }] };

test("builds a non-stacking product discount with app-owned configuration", () => {
  const input = automaticDiscountInput(configuration, "2026-09-25T00:00:00.000Z");
  assert.equal(input.functionHandle, "nta-bulk-pricing-discount");
  assert.deepEqual(input.discountClasses, ["PRODUCT"]);
  assert.deepEqual(input.combinesWith, { orderDiscounts: false, productDiscounts: false, shippingDiscounts: false });
  assert.deepEqual(JSON.parse(input.metafields[0].value), configuration);
  assert.equal(input.metafields[0].namespace, "$app:nta-bulk-pricing");
});

test("configuration hashes are deterministic and change with rules", () => {
  assert.equal(configurationHash(configuration), configurationHash(configuration));
  assert.notEqual(configurationHash(configuration), configurationHash({ ...configuration, rules: [] }));
});

test("extracts a successful automatic discount mutation", () => {
  const discount = mutationDiscount({ data: { discountAutomaticAppCreate: {
    automaticAppDiscount: { discountId: "gid://shopify/DiscountAutomaticNode/1", status: "ACTIVE" }, userErrors: [],
  } } }, "discountAutomaticAppCreate");
  assert.equal(discount.status, "ACTIVE");
});

test("surfaces Shopify user errors without accepting a partial write", () => {
  assert.throws(() => mutationDiscount({ data: { discountAutomaticAppCreate: {
    automaticAppDiscount: null, userErrors: [{ field: ["automaticAppDiscount", "functionHandle"], message: "Invalid function" }],
  } } }, "discountAutomaticAppCreate"), /functionHandle: Invalid function/);
});
