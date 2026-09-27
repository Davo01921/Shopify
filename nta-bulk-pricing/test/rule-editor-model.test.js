import test from "node:test";
import assert from "node:assert/strict";
import {
  createConfigDocument,
  createRule,
  removeRule,
  replaceRules,
  setConfigState,
  upsertRule,
} from "../src/rule-editor-model.js";
import {
  CONFIG_STATES,
  CONFIG_VERSION,
  validateConfigDocument,
} from "../src/rule-engine.js";

function validRule(id = "rule-1") {
  return createRule({
    id,
    title: "Test rule",
    target: { type: "PRODUCT", ids: ["gid://shopify/Product/1"] },
    tiers: [
      { id: "base", min: 1, max: 2, discount: { type: "NONE" } },
      { id: "discount", min: 3, max: null, discount: { type: "PERCENTAGE", value: 5 } },
    ],
  });
}

test("new configuration documents start as versioned drafts", () => {
  const config = createConfigDocument();
  assert.deepEqual(config, {
    version: CONFIG_VERSION,
    state: CONFIG_STATES.DRAFT,
    rules: [],
  });
  assert.equal(validateConfigDocument(config), true);
});

test("configuration state changes are immutable", () => {
  const original = createConfigDocument();
  const next = setConfigState(original, CONFIG_STATES.VALIDATED);

  assert.equal(original.state, CONFIG_STATES.DRAFT);
  assert.equal(next.state, CONFIG_STATES.VALIDATED);
});

test("rule upsert adds and then replaces by stable id", () => {
  const config = createConfigDocument();
  const first = validRule();
  const added = upsertRule(config, first);
  const replacement = { ...first, title: "Updated test rule" };
  const updated = upsertRule(added, replacement);

  assert.equal(added.rules.length, 1);
  assert.equal(updated.rules.length, 1);
  assert.equal(updated.rules[0].title, "Updated test rule");
  assert.equal(first.title, "Test rule");
});

test("replaceRules clones caller data", () => {
  const input = [validRule()];
  const config = replaceRules(createConfigDocument(), input);
  input[0].title = "Mutated outside";

  assert.equal(config.rules[0].title, "Test rule");
});

test("removeRule removes only the selected stable id", () => {
  const config = createConfigDocument({
    rules: [validRule("one"), validRule("two")],
  });

  const out = removeRule(config, "one");
  assert.deepEqual(out.rules.map((rule) => rule.id), ["two"]);
});
