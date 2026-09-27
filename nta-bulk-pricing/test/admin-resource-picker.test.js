import test from "node:test";
import assert from "node:assert/strict";
import {
  pickerLabelForTarget,
  pickerOptionsForTarget,
  pickerSelectionToTarget,
} from "../src/admin-resource-picker.js";

test("single-product picker is restricted to one product", () => {
  assert.deepEqual(pickerOptionsForTarget("PRODUCT"), {
    type: "product",
    action: "add",
    multiple: false,
    selectionIds: [],
  });
});

test("product-set picker allows multiple products and preselection", () => {
  assert.deepEqual(
    pickerOptionsForTarget("PRODUCTS", [
      "gid://shopify/Product/1",
      "gid://shopify/Product/2",
    ]),
    {
      type: "product",
      action: "select",
      multiple: true,
      selectionIds: [
        { id: "gid://shopify/Product/1" },
        { id: "gid://shopify/Product/2" },
      ],
    },
  );
});

test("variant selection converts to a stable target document", () => {
  assert.deepEqual(
    pickerSelectionToTarget("VARIANTS", [
      { id: "gid://shopify/ProductVariant/10", title: "Small" },
      { id: "gid://shopify/ProductVariant/11", title: "Large" },
    ]),
    {
      type: "VARIANTS",
      ids: [
        "gid://shopify/ProductVariant/10",
        "gid://shopify/ProductVariant/11",
      ],
    },
  );
});

test("single-product selection rejects multiple resources", () => {
  assert.throws(
    () => pickerSelectionToTarget("PRODUCT", [
      { id: "gid://shopify/Product/1" },
      { id: "gid://shopify/Product/2" },
    ]),
    /exactly one selected product/,
  );
});

test("resource type mismatch is rejected", () => {
  assert.throws(
    () => pickerSelectionToTarget("COLLECTIONS", [
      { id: "gid://shopify/Product/1" },
    ]),
    /does not match COLLECTIONS/,
  );
});

test("duplicate picker ids are rejected", () => {
  assert.throws(
    () => pickerSelectionToTarget("PRODUCTS", [
      { id: "gid://shopify/Product/1" },
      { id: "gid://shopify/Product/1" },
    ]),
    /duplicate resource ids/,
  );
});

test("target selection labels are human readable", () => {
  assert.equal(pickerLabelForTarget("PRODUCTS", 1), "1 product selected");
  assert.equal(pickerLabelForTarget("PRODUCTS", 3), "3 products selected");
  assert.equal(pickerLabelForTarget("COLLECTIONS", 2), "2 collections selected");
});
