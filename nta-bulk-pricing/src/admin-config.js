import {
  CONFIG_STATES,
  inspectConfigDocument,
  validateConfigDocument,
} from "./rule-engine.js";

const EDITABLE_STATES = new Set([
  CONFIG_STATES.DRAFT,
  CONFIG_STATES.VALIDATED,
  CONFIG_STATES.APPROVED_FOR_PRODUCTION,
]);

const TARGET_LABELS = Object.freeze({
  VARIANTS: "Variants",
  PRODUCT: "Product",
  PRODUCTS: "Products",
  COLLECTIONS: "Collections",
});

function enabledRules(config) {
  return (config.rules ?? []).filter((rule) => rule.enabled !== false);
}

function issue(code, severity, message, details = {}) {
  return { code, severity, message, details };
}

function duplicateTargetWarnings(config) {
  const warnings = [];
  const directTargets = new Map();

  for (const rule of enabledRules(config)) {
    for (const id of rule.target?.ids ?? []) {
      const key = `${rule.target.type}:${id}`;
      const list = directTargets.get(key) ?? [];
      list.push(rule);
      directTargets.set(key, list);
    }
  }

  for (const [key, rules] of directTargets.entries()) {
    if (rules.length < 2) continue;
    const [targetType, targetId] = key.split(":", 2);
    warnings.push(issue(
      "SAME_TARGET_MULTIPLE_RULES",
      "WARNING",
      `${rules.length} enabled rules target the same ${TARGET_LABELS[targetType] ?? targetType.toLowerCase()}.`,
      {
        targetType,
        targetId,
        ruleIds: rules.map((rule) => rule.id),
      },
    ));
  }

  return warnings;
}

function productSpecificityWarnings(config) {
  const warnings = [];
  const singleProducts = new Map();
  const productSets = new Map();

  for (const rule of enabledRules(config)) {
    if (rule.target?.type === "PRODUCT") {
      const id = rule.target.ids?.[0];
      if (id) {
        const list = singleProducts.get(id) ?? [];
        list.push(rule.id);
        singleProducts.set(id, list);
      }
    }
    if (rule.target?.type === "PRODUCTS") {
      for (const id of rule.target.ids ?? []) {
        const list = productSets.get(id) ?? [];
        list.push(rule.id);
        productSets.set(id, list);
      }
    }
  }

  for (const [productId, specificRuleIds] of singleProducts.entries()) {
    const broadRuleIds = productSets.get(productId);
    if (!broadRuleIds?.length) continue;

    warnings.push(issue(
      "PRODUCT_SPECIFICITY_OVERLAP",
      "WARNING",
      "A specific-product rule and one or more product-set rules target the same product. The specific-product rule will win.",
      {
        productId,
        specificRuleIds,
        broaderRuleIds: broadRuleIds,
      },
    ));
  }

  return warnings;
}

function configurationWarnings(config) {
  const warnings = [
    ...duplicateTargetWarnings(config),
    ...productSpecificityWarnings(config),
  ];

  if (enabledRules(config).length === 0) {
    warnings.push(issue(
      "NO_ENABLED_RULES",
      "WARNING",
      "The configuration has no enabled pricing rules.",
    ));
  }

  return warnings;
}

export function reviewConfig(config) {
  const inspection = inspectConfigDocument(config);

  if (!inspection.valid) {
    return {
      valid: false,
      state: config?.state ?? null,
      readyForValidation: false,
      readyForApproval: false,
      errors: [
        issue(
          "INVALID_CONFIGURATION",
          "ERROR",
          inspection.error ?? "Configuration is invalid.",
        ),
      ],
      warnings: [],
      summary: {
        ruleCount: inspection.ruleCount ?? 0,
        enabledRuleCount: 0,
        warningCount: 0,
        errorCount: 1,
      },
    };
  }

  const warnings = configurationWarnings(config);
  const currentState = config.state;

  return {
    valid: true,
    state: currentState,
    readyForValidation: currentState === CONFIG_STATES.DRAFT,
    readyForApproval: currentState === CONFIG_STATES.VALIDATED,
    errors: [],
    warnings,
    summary: {
      ruleCount: config.rules.length,
      enabledRuleCount: enabledRules(config).length,
      warningCount: warnings.length,
      errorCount: 0,
    },
  };
}

function allowedTransition(from, to) {
  if (from === to) return true;
  if (from === CONFIG_STATES.DRAFT && to === CONFIG_STATES.VALIDATED) return true;
  if (from === CONFIG_STATES.VALIDATED && to === CONFIG_STATES.DRAFT) return true;
  if (from === CONFIG_STATES.VALIDATED && to === CONFIG_STATES.APPROVED_FOR_PRODUCTION) return true;
  if (from === CONFIG_STATES.APPROVED_FOR_PRODUCTION && to === CONFIG_STATES.DRAFT) return true;
  return false;
}

export function transitionConfigState(
  config,
  nextState,
  { acknowledgeWarnings = false } = {},
) {
  validateConfigDocument(config);

  if (!EDITABLE_STATES.has(nextState)) {
    throw new Error(`unsupported configuration state: ${String(nextState)}`);
  }
  if (!allowedTransition(config.state, nextState)) {
    throw new Error(`invalid configuration transition: ${config.state} -> ${nextState}`);
  }

  const review = reviewConfig(config);
  if (review.errors.length) {
    throw new Error("configuration has blocking errors");
  }

  if (
    nextState === CONFIG_STATES.APPROVED_FOR_PRODUCTION
    && review.warnings.length > 0
    && !acknowledgeWarnings
  ) {
    throw new Error("configuration warnings must be acknowledged before production approval");
  }

  return {
    ...structuredClone(config),
    state: nextState,
  };
}

export function applyConfigEdit(config, edit) {
  validateConfigDocument(config);
  if (typeof edit !== "function") throw new Error("edit must be a function");

  const editable = structuredClone(config);
  const edited = edit(editable);
  const next = edited ?? editable;

  validateConfigDocument({
    ...next,
    state: CONFIG_STATES.DRAFT,
  });

  return {
    ...next,
    state: CONFIG_STATES.DRAFT,
  };
}

function tierSummary(rule) {
  return [...rule.tiers]
    .sort((a, b) => a.min - b.min)
    .map((tier) => {
      const range = tier.max == null ? `${tier.min}+` : `${tier.min}-${tier.max}`;
      if (tier.discount.type === "NONE") return `${range}: standard`;
      if (tier.discount.type === "PERCENTAGE") {
        return `${range}: ${tier.discount.value}% off`;
      }
      return `${range}: $${Number(tier.discount.value).toFixed(2)} off/item`;
    })
    .join(" • ");
}

export function ruleListRows(config) {
  validateConfigDocument(config);

  return config.rules.map((rule) => ({
    id: rule.id,
    title: rule.title,
    enabled: rule.enabled !== false,
    targetType: rule.target.type,
    targetLabel: TARGET_LABELS[rule.target.type],
    targetCount: rule.target.ids.length,
    tierCount: rule.tiers.length,
    tierSummary: tierSummary(rule),
    priority: Number(rule.priority) || 0,
  }));
}

export function serializeConfigDocument(config) {
  validateConfigDocument(config);
  return JSON.stringify(config);
}

export function parseConfigDocument(raw) {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("configuration payload must be a non-empty JSON string");
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("configuration payload is not valid JSON");
  }

  validateConfigDocument(parsed);
  return parsed;
}
