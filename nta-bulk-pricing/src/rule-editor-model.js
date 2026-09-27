import { CONFIG_STATES, CONFIG_VERSION } from "./rule-engine.js";

export function createConfigDocument(overrides = {}) {
  return {
    version: CONFIG_VERSION,
    state: overrides.state ?? CONFIG_STATES.DRAFT,
    rules: overrides.rules ? structuredClone(overrides.rules) : [],
  };
}

export function setConfigState(config, state) {
  return { ...config, state };
}

export function replaceRules(config, rules) {
  return { ...config, rules: structuredClone(rules) };
}

export function upsertRule(config, rule) {
  const exists = config.rules.some((item) => item.id === rule.id);
  return {
    ...config,
    rules: exists
      ? config.rules.map((item) => item.id === rule.id ? structuredClone(rule) : item)
      : [...config.rules, structuredClone(rule)],
  };
}

export function removeRule(config, ruleId) {
  return {
    ...config,
    rules: config.rules.filter((rule) => rule.id !== ruleId),
  };
}

export function createRule(overrides = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    title: overrides.title ?? "New bulk pricing rule",
    enabled: overrides.enabled ?? true,
    priority: overrides.priority ?? 0,
    target: overrides.target ?? { type: "PRODUCTS", ids: [] },
    display: overrides.display ?? {
      blockTitle: "",
      badge: "",
      showOriginalPrice: true,
      showSavings: true,
    },
    tiers: overrides.tiers ?? [
      {
        id: crypto.randomUUID(),
        min: 1,
        max: null,
        title: "Standard price",
        discount: { type: "NONE" },
      },
    ],
  };
}

export function addTier(rule, tier) {
  return {
    ...rule,
    tiers: [...rule.tiers, tier].sort((a, b) => a.min - b.min),
  };
}

export function removeTier(rule, tierId) {
  return {
    ...rule,
    tiers: rule.tiers.filter((tier) => tier.id !== tierId),
  };
}

export function updateTier(rule, tierId, patch) {
  return {
    ...rule,
    tiers: rule.tiers
      .map((tier) => tier.id === tierId ? { ...tier, ...patch } : tier)
      .sort((a, b) => a.min - b.min),
  };
}

export function updateTarget(rule, target) {
  return { ...rule, target: structuredClone(target) };
}

export function updateDisplay(rule, patch) {
  return { ...rule, display: { ...rule.display, ...patch } };
}
