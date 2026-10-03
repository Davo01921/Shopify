import test from "node:test";
import assert from "node:assert/strict";
import { storefrontLine, storefrontPricing } from "../src/storefront-pricing.js";

const configuration = {
  version: 1,
  rules: [
    { id: "collection", title: "Schooling fish", enabled: true, priority: 0,
      target: { type: "COLLECTIONS", ids: ["gid://shopify/Collection/30"] },
      tiers: [{ id: "c3", min: 3, max: null, discount: { type: "PERCENTAGE", value: 5 } }] },
    { id: "product", title: "Pea puffers", enabled: true, priority: 0,
      target: { type: "PRODUCT", ids: ["gid://shopify/Product/10"] },
      tiers: [{ id: "p1", min: 1, max: 2, discount: { type: "NONE" } },
        { id: "p3", min: 3, max: null, message: "Buy 3+", discount: { type: "FIXED_PER_ITEM", value: 4 } }] },
  ],
};

test("normalizes storefront numeric IDs into Shopify GIDs", () => {
  assert.deepEqual(storefrontLine({ productId: "10", variantId: "20", collectionIds: ["30"] }), {
    productId: "gid://shopify/Product/10",
    variantId: "gid://shopify/ProductVariant/20",
    collectionMemberships: [{ collectionId: "gid://shopify/Collection/30", isMember: true }],
  });
});

test("uses the same specificity rules as checkout", () => {
  const pricing = storefrontPricing(configuration, { productId: "10", variantId: "20", collectionIds: ["30"] });
  assert.equal(pricing.rule.id, "product");
  assert.equal(pricing.tiers.length, 2);
  assert.equal(pricing.tiers[1].message, "Buy 3+");
});

test("returns no display for an ineligible product", () => {
  assert.equal(storefrontPricing(configuration, { productId: "99", variantId: "98" }), null);
});
