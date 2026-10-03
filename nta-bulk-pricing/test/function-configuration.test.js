import test from "node:test";
import assert from "node:assert/strict";
import { compileFunctionConfiguration } from "../src/function-configuration.js";

const base = {
  id: "rule-1", title: "Shrimp", enabled: true, priority: 3, targetType: "COLLECTIONS",
  startsAt: null, endsAt: null,
  targets: [{ shopifyId: "gid://shopify/Collection/2" }, { shopifyId: "gid://shopify/Collection/1" }],
  tiers: [{ id: "tier-10", minimum: 10, maximum: null, message: "Buy 10+", discountType: "PERCENTAGE", discountValue: "12.5" }],
};

test("compiles records into the Function metafield contract", () => {
  assert.deepEqual(compileFunctionConfiguration([base], new Date("2026-09-25T00:00:00Z")), {
    version: 1,
    collectionIds: ["gid://shopify/Collection/1", "gid://shopify/Collection/2"],
    rules: [{
      id: "rule-1", title: "Shrimp", enabled: true, priority: 3,
      target: { type: "COLLECTIONS", ids: ["gid://shopify/Collection/1", "gid://shopify/Collection/2"] },
      tiers: [{ id: "tier-10", min: 10, max: null, message: "Buy 10+", discount: { type: "PERCENTAGE", value: 12.5 } }],
    }],
  });
});

test("excludes disabled, future, and expired rules", () => {
  const now = new Date("2026-09-25T00:00:00Z");
  const records = [
    { ...base, id: "disabled", enabled: false },
    { ...base, id: "future", startsAt: new Date("2026-09-26T00:00:00Z") },
    { ...base, id: "expired", endsAt: new Date("2026-09-25T00:00:00Z") },
    { ...base, id: "active", startsAt: new Date("2026-09-24T00:00:00Z"), endsAt: new Date("2026-09-26T00:00:00Z") },
  ];
  assert.deepEqual(compileFunctionConfiguration(records, now).rules.map((rule) => rule.id), ["active"]);
});

test("configuration output is deterministic", () => {
  const second = { ...base, id: "a-rule", priority: 8, targetType: "PRODUCT", targets: [{ shopifyId: "gid://shopify/Product/1" }] };
  assert.equal(JSON.stringify(compileFunctionConfiguration([base, second])), JSON.stringify(compileFunctionConfiguration([second, base])));
});
