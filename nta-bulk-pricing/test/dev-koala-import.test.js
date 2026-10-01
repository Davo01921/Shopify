import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDevKoalaRules, devKoalaImportSql } from "../src/dev-koala-import.js";

const snapshot = JSON.parse(readFileSync(new URL("../docs/koala-campaigns-2026-09-26.json", import.meta.url)));
const mapping = {
  shop: "tierweave-function-test.myshopify.com",
  products: Object.fromEntries(snapshot.campaigns.map((campaign, index) => [
    campaign.products[0].id,
    { id: String(9000 + index), title: `Dev campaign ${index + 1}` },
  ])),
};

test("staging importer maps all six campaigns without changing the source snapshot", () => {
  const rules = buildDevKoalaRules(snapshot, mapping);
  assert.equal(rules.length, 6);
  assert.deepEqual(rules.map((rule) => rule.targets.length), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(rules.map((rule) => rule.targetType), ["PRODUCTS", "PRODUCTS", "PRODUCTS", "PRODUCT", "PRODUCT", "PRODUCT"]);
  assert.equal(rules[0].targets[0].shopifyId, "gid://shopify/Product/9000");
  assert.equal(snapshot.campaigns[0].products[0].id, "6840213995729");
  assert.deepEqual(rules[2].tiers.map((tier) => tier.discountValue), [null, 0.5, 1]);
});

test("staging importer refuses a wrong shop or incomplete mapping", () => {
  assert.throws(() => buildDevKoalaRules(snapshot, { ...mapping, shop: "nano-tanks-australia-aquarium-shop.myshopify.com" }), /Mapping must target/);
  assert.throws(() => buildDevKoalaRules(snapshot, { ...mapping, products: {} }), /No development product mapped/);
});

test("staging import SQL has stable IDs and conflict updates", () => {
  const rules = buildDevKoalaRules(snapshot, mapping);
  const sql = devKoalaImportSql(rules);
  assert.equal((sql.match(/INSERT INTO DiscountRule /g) ?? []).length, 6);
  assert.match(sql, /ON CONFLICT\(id\) DO UPDATE/);
  assert.doesNotMatch(sql, /tierweave-production|nano-tanks-australia-aquarium-shop/);
  assert.equal(sql, devKoalaImportSql(buildDevKoalaRules(snapshot, mapping)));
});
