import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateLine, validateRules } from "../src/rule-engine.js";
import { compileFunctionConfiguration } from "../src/function-configuration.js";
import { buildRulesFromSnapshot } from "../src/koala-import.js";

// The snapshot is the authoritative capture of Koala's six active campaigns
// (tier values cross-checked against isolated live carts on 2026-09-26).
// See docs/KOALA_CAPTURE.md. Koala's promotional labels ("5%+", "6%+ Off")
// are display-only and known inaccurate; configured values win.
const snapshot = JSON.parse(
  readFileSync(new URL("../docs/koala-campaigns-2026-09-26.json", import.meta.url), "utf8"),
);

const records = buildRulesFromSnapshot(snapshot, { enabled: true });
const rules = compileFunctionConfiguration(records, new Date("2026-09-26T00:00:00Z")).rules;

function campaign(id) {
  return snapshot.campaigns.find((c) => c.id === id);
}

function discountFor(productId, quantity) {
  const result = evaluateLine({
    lineId: `line-${productId}-${quantity}`,
    productId: `gid://shopify/Product/${productId}`,
    variantId: `gid://shopify/ProductVariant/${productId}`,
    quantity,
    collectionMemberships: [],
  }, rules);
  if (!result) return undefined; // no campaign rule matched
  return result.discount ?? null; // matched campaign's standard-price tier
}

test("captured snapshot covers the six active Koala campaigns", () => {
  assert.deepEqual(
    [...snapshot.campaigns.map((c) => c.id)].sort(),
    [
      "cm96s8wfd5itiy81mypwfektu", // Inverts: BUNDLE & SAVE
      "cm9ddz5md5eytiscvezptruhm", // Group Fish: GROUP FISH DISCOUNTS
      "cmgsmq0361rwsj8ceelh3bcf5", // Frozen Foods
      "cmgzulas806befdch0jkazwtt", // Pea Puffers
      "cmsxs2o970l988f45vz0794zp", // Otocinclus DEAL
      "cmtq9oitc85iv9y44d8eiw5xh", // Red Cherry Shrimp: BUNDLE & SAVE
    ].sort(),
  );
  assert.deepEqual(
    Object.fromEntries(snapshot.campaigns.map((c) => [c.id, c.products.length])),
    {
      cm96s8wfd5itiy81mypwfektu: 15,
      cm9ddz5md5eytiscvezptruhm: 107,
      cmgsmq0361rwsj8ceelh3bcf5: 2,
      cmgzulas806befdch0jkazwtt: 1,
      cmsxs2o970l988f45vz0794zp: 1,
      cmtq9oitc85iv9y44d8eiw5xh: 1,
    },
  );
});

test("imported campaign rules pass engine validation", () => {
  assert.equal(validateRules(rules), true);
});

test("invertebrate and group-fish boundaries match live Koala carts", () => {
  for (const id of ["cm96s8wfd5itiy81mypwfektu", "cm9ddz5md5eytiscvezptruhm"]) {
    for (const product of campaign(id).products) {
      assert.equal(discountFor(product.id, 2), null, product.handle);
      assert.deepEqual(discountFor(product.id, 3), { type: "PERCENTAGE", value: 5 }, product.handle);
      assert.deepEqual(discountFor(product.id, 5), { type: "PERCENTAGE", value: 5 }, product.handle);
      assert.deepEqual(discountFor(product.id, 6), { type: "PERCENTAGE", value: 10 }, product.handle);
    }
  }
});

test("frozen-food boundaries match the published Koala configuration", () => {
  for (const product of campaign("cmgsmq0361rwsj8ceelh3bcf5").products) {
    assert.equal(discountFor(product.id, 9), null, product.handle);
    assert.deepEqual(discountFor(product.id, 10), { type: "FIXED_PER_ITEM", value: 0.5 }, product.handle);
    assert.deepEqual(discountFor(product.id, 19), { type: "FIXED_PER_ITEM", value: 0.5 }, product.handle);
    assert.deepEqual(discountFor(product.id, 20), { type: "FIXED_PER_ITEM", value: 1 }, product.handle);
  }
});

test("pea-puffer boundary matches the live Koala cart", () => {
  const [product] = campaign("cmgzulas806befdch0jkazwtt").products;
  assert.equal(product.handle, "pea-puffer-juveniles");
  assert.equal(discountFor(product.id, 2), null);
  assert.deepEqual(discountFor(product.id, 3), { type: "FIXED_PER_ITEM", value: 4 });
});

test("red-cherry-shrimp boundaries match the live Koala cart", () => {
  const [product] = campaign("cmtq9oitc85iv9y44d8eiw5xh").products;
  assert.equal(product.handle, "red-cherry-shrimp");
  assert.equal(discountFor(product.id, 3), null);
  assert.deepEqual(discountFor(product.id, 4), { type: "FIXED_PER_ITEM", value: 0.5 });
  assert.deepEqual(discountFor(product.id, 9), { type: "FIXED_PER_ITEM", value: 0.5 });
  assert.deepEqual(discountFor(product.id, 10), { type: "FIXED_PER_ITEM", value: 1 });
  assert.deepEqual(discountFor(product.id, 19), { type: "FIXED_PER_ITEM", value: 1 });
  assert.deepEqual(discountFor(product.id, 20), { type: "FIXED_PER_ITEM", value: 1.5 });
});

test("otocinclus boundaries match the published Koala configuration", () => {
  const [product] = campaign("cmsxs2o970l988f45vz0794zp").products;
  assert.equal(product.handle, "otocinclus-arnoldi");
  assert.equal(discountFor(product.id, 3), null);
  assert.deepEqual(discountFor(product.id, 4), { type: "FIXED_PER_ITEM", value: 2 });
  assert.deepEqual(discountFor(product.id, 5), { type: "FIXED_PER_ITEM", value: 2 });
  assert.deepEqual(discountFor(product.id, 6), { type: "FIXED_PER_ITEM", value: 3 });
});

test("products outside every campaign receive no discount", () => {
  const memberIds = new Set(snapshot.campaigns.flatMap((c) => c.products.map((p) => p.id)));
  for (const outside of ["6993487798481", "7382554804433"]) {
    assert.equal(memberIds.has(outside), false, `fixture ${outside} must not be a campaign member`);
    assert.equal(discountFor(outside, 6), undefined);
  }
});
