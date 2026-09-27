export const CONFIG_VERSION = 1;

export const CONFIG_STATES = Object.freeze({
  DRAFT: "DRAFT",
  VALIDATED: "VALIDATED",
  APPROVED_FOR_PRODUCTION: "APPROVED_FOR_PRODUCTION",
});

export const REASON_CODES = Object.freeze({
  INVALID_CONFIG: "INVALID_CONFIG",
  CONFIG_NOT_APPROVED: "CONFIG_NOT_APPROVED",
  INVALID_LINE: "INVALID_LINE",
  NO_MATCHING_RULE: "NO_MATCHING_RULE",
  NO_MATCHING_TIER: "NO_MATCHING_TIER",
  STANDARD_PRICE_TIER: "STANDARD_PRICE_TIER",
  DISCOUNT_APPLIED: "DISCOUNT_APPLIED",
});

const TARGET_WEIGHT = Object.freeze({
  VARIANTS: 400,
  PRODUCT: 300,
  PRODUCTS: 200,
  COLLECTIONS: 100,
});

const TARGET_GID_PREFIX = Object.freeze({
  VARIANTS: "gid://shopify/ProductVariant/",
  PRODUCT: "gid://shopify/Product/",
  PRODUCTS: "gid://shopify/Product/",
  COLLECTIONS: "gid://shopify/Collection/",
});

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function assertTargetIds(rule) {
  const ids = rule.target?.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error(`rule ${rule.id} needs at least one target id`);
  }

  if (rule.target.type === "PRODUCT" && ids.length !== 1) {
    throw new Error(`rule ${rule.id} PRODUCT target must contain exactly one product id`);
  }

  const unique = new Set();
  const expectedPrefix = TARGET_GID_PREFIX[rule.target.type];

  for (const id of ids) {
    if (!nonEmptyString(id)) {
      throw new Error(`rule ${rule.id} has an invalid target id`);
    }
    if (unique.has(id)) {
      throw new Error(`rule ${rule.id} has duplicate target id: ${id}`);
    }
    unique.add(id);

    if (!id.startsWith(expectedPrefix)) {
      throw new Error(`rule ${rule.id} target id does not match ${rule.target.type}`);
    }
  }
}

export function validateRules(rules) {
  if (!Array.isArray(rules)) throw new Error("rules must be an array");

  const ids = new Set();

  for (const rule of rules) {
    if (!nonEmptyString(rule?.id)) throw new Error("each rule needs a non-empty string id");
    if (ids.has(rule.id)) throw new Error(`duplicate rule id: ${rule.id}`);
    ids.add(rule.id);

    if (!nonEmptyString(rule.title)) {
      throw new Error(`rule ${rule.id} needs a title`);
    }
    if (rule.enabled != null && typeof rule.enabled !== "boolean") {
      throw new Error(`rule ${rule.id} enabled must be boolean`);
    }
    if (rule.priority != null && !Number.isSafeInteger(rule.priority)) {
      throw new Error(`rule ${rule.id} priority must be a safe integer`);
    }

    if (!TARGET_WEIGHT[rule.target?.type]) {
      throw new Error(`unsupported target type on ${rule.id}`);
    }
    assertTargetIds(rule);

    if (!Array.isArray(rule.tiers) || rule.tiers.length === 0) {
      throw new Error(`rule ${rule.id} needs at least one tier`);
    }

    const tierIds = new Set();
    const sorted = [...rule.tiers].sort((a, b) => a.min - b.min);
    let previousMax = 0;

    for (const tier of sorted) {
      if (!nonEmptyString(tier?.id)) {
        throw new Error(`rule ${rule.id} has a tier without a valid id`);
      }
      if (tierIds.has(tier.id)) {
        throw new Error(`duplicate tier id on ${rule.id}: ${tier.id}`);
      }
      tierIds.add(tier.id);

      if (!Number.isInteger(tier.min) || tier.min < 1) {
        throw new Error(`invalid tier minimum on ${rule.id}`);
      }
      if (tier.max != null && (!Number.isInteger(tier.max) || tier.max < tier.min)) {
        throw new Error(`invalid tier maximum on ${rule.id}`);
      }
      if (tier.min <= previousMax) {
        throw new Error(`overlapping tiers on ${rule.id}`);
      }
      previousMax = tier.max ?? Number.MAX_SAFE_INTEGER;

      const discount = tier.discount;
      if (!discount || !["PERCENTAGE", "FIXED_PER_ITEM", "NONE"].includes(discount.type)) {
        throw new Error(`invalid discount type on ${rule.id}`);
      }
      if (discount.type === "PERCENTAGE" &&
          (!Number.isFinite(discount.value) || discount.value < 0 || discount.value > 100)) {
        throw new Error(`invalid percentage on ${rule.id}`);
      }
      if (discount.type === "FIXED_PER_ITEM" &&
          (!Number.isFinite(discount.value) || discount.value < 0)) {
        throw new Error(`invalid fixed amount on ${rule.id}`);
      }
      if (discount.type === "NONE" && discount.value != null && Number(discount.value) !== 0) {
        throw new Error(`NONE discount cannot carry a non-zero value on ${rule.id}`);
      }
    }
  }

  return true;
}

export function validateConfigDocument(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("configuration must be an object");
  }
  if (config.version !== CONFIG_VERSION) {
    throw new Error(`unsupported configuration version: ${String(config.version)}`);
  }
  if (!Object.values(CONFIG_STATES).includes(config.state)) {
    throw new Error(`unsupported configuration state: ${String(config.state)}`);
  }
  validateRules(config.rules);
  return true;
}

export function inspectConfigDocument(config) {
  try {
    validateConfigDocument(config);
    return {
      valid: true,
      version: config.version,
      state: config.state,
      ruleCount: config.rules.length,
      error: null,
    };
  } catch (error) {
    return {
      valid: false,
      version: config?.version ?? null,
      state: config?.state ?? null,
      ruleCount: Array.isArray(config?.rules) ? config.rules.length : null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function membershipIds(line) {
  return new Set(
    (line.collectionMemberships ?? [])
      .filter((membership) => membership.isMember)
      .map((membership) => membership.collectionId),
  );
}

export function ruleMatchesLine(rule, line) {
  const ids = rule.target.ids ?? [];

  switch (rule.target.type) {
    case "VARIANTS":
      return ids.includes(line.variantId);
    case "PRODUCT":
      return ids.length === 1 && ids[0] === line.productId;
    case "PRODUCTS":
      return ids.includes(line.productId);
    case "COLLECTIONS": {
      const memberships = membershipIds(line);
      return ids.some((id) => memberships.has(id));
    }
    default:
      return false;
  }
}

function rankedRuleMatches(line, rules) {
  return rules
    .filter((rule) => rule.enabled !== false)
    .filter((rule) => ruleMatchesLine(rule, line))
    .map((rule, index) => ({
      rule,
      index,
      specificity: TARGET_WEIGHT[rule.target.type],
      priority: Number(rule.priority) || 0,
    }))
    .sort((a, b) =>
      b.specificity - a.specificity
      || b.priority - a.priority
      || a.index - b.index,
    );
}

export function selectRuleForLine(line, rules) {
  return rankedRuleMatches(line, rules)[0]?.rule ?? null;
}

export function selectTier(rule, quantity) {
  if (!rule || !Number.isInteger(quantity) || quantity < 1) return null;

  return [...rule.tiers]
    .sort((a, b) => b.min - a.min)
    .find((tier) => quantity >= tier.min && (tier.max == null || quantity <= tier.max)) ?? null;
}

function loserReason(selected, candidate) {
  if (candidate.specificity < selected.specificity) return "LOWER_SPECIFICITY";
  if (candidate.priority < selected.priority) return "LOWER_PRIORITY";
  return "LATER_RULE_ORDER";
}

function lineIsEvaluable(line) {
  return line && Number.isInteger(line.quantity) && line.quantity >= 1;
}

export function diagnoseLine(line, rules) {
  if (!lineIsEvaluable(line)) {
    return {
      status: "NO_DISCOUNT",
      reasonCode: REASON_CODES.INVALID_LINE,
      lineId: line?.lineId ?? null,
      quantity: line?.quantity ?? null,
      selectedRule: null,
      selectedTier: null,
      competingRules: [],
      discount: null,
      message: null,
    };
  }

  const matches = rankedRuleMatches(line, rules);
  if (matches.length === 0) {
    return {
      status: "NO_DISCOUNT",
      reasonCode: REASON_CODES.NO_MATCHING_RULE,
      lineId: line.lineId ?? null,
      quantity: line.quantity,
      selectedRule: null,
      selectedTier: null,
      competingRules: [],
      discount: null,
      message: null,
    };
  }

  const selected = matches[0];
  const tier = selectTier(selected.rule, line.quantity);
  const selectedRule = {
    id: selected.rule.id,
    title: selected.rule.title,
    targetType: selected.rule.target.type,
    priority: selected.priority,
    specificity: selected.specificity,
  };
  const competingRules = matches.slice(1).map((candidate) => ({
    id: candidate.rule.id,
    targetType: candidate.rule.target.type,
    priority: candidate.priority,
    specificity: candidate.specificity,
    lostBecause: loserReason(selected, candidate),
  }));

  if (!tier) {
    return {
      status: "NO_DISCOUNT",
      reasonCode: REASON_CODES.NO_MATCHING_TIER,
      lineId: line.lineId ?? null,
      quantity: line.quantity,
      selectedRule,
      selectedTier: null,
      competingRules,
      discount: null,
      message: null,
    };
  }

  const selectedTier = {
    id: tier.id,
    min: tier.min,
    max: tier.max ?? null,
    discountType: tier.discount.type,
  };

  if (tier.discount.type === "NONE") {
    return {
      status: "NO_DISCOUNT",
      reasonCode: REASON_CODES.STANDARD_PRICE_TIER,
      lineId: line.lineId ?? null,
      quantity: line.quantity,
      selectedRule,
      selectedTier,
      competingRules,
      discount: null,
      message: tier.message || selected.rule.title || "Bulk pricing",
    };
  }

  return {
    status: "DISCOUNT",
    reasonCode: REASON_CODES.DISCOUNT_APPLIED,
    lineId: line.lineId ?? null,
    quantity: line.quantity,
    selectedRule,
    selectedTier,
    competingRules,
    discount: structuredClone(tier.discount),
    message: tier.message || selected.rule.title || "Bulk pricing",
  };
}

export function evaluateLine(line, rules) {
  const diagnostic = diagnoseLine(line, rules);
  if (!diagnostic.selectedRule) return null;

  return {
    ruleId: diagnostic.selectedRule.id,
    tierId: diagnostic.selectedTier?.id ?? null,
    discount: diagnostic.discount,
    message: diagnostic.message ?? undefined,
    reasonCode: diagnostic.reasonCode,
  };
}

function operationFromDiagnostics(diagnostics) {
  const candidates = [];

  for (const result of diagnostics) {
    if (result.reasonCode !== REASON_CODES.DISCOUNT_APPLIED || !result.discount || !result.lineId) {
      continue;
    }

    const value = result.discount.type === "PERCENTAGE"
      ? { percentage: { value: result.discount.value } }
      : {
          fixedAmount: {
            amount: String(result.discount.value),
            appliesToEachItem: true,
          },
        };

    candidates.push({
      targets: [{ cartLine: { id: result.lineId } }],
      value,
      message: result.message,
    });
  }

  if (!candidates.length) return null;

  return {
    productDiscountsAdd: {
      candidates,
      selectionStrategy: "ALL",
    },
  };
}

export function buildProductDiscountOperation(lines, rules) {
  const diagnostics = (Array.isArray(lines) ? lines : []).map((line) => diagnoseLine(line, rules));
  return operationFromDiagnostics(diagnostics);
}

export function evaluateCheckout(lines, config, { requireApproved = true } = {}) {
  const inspection = inspectConfigDocument(config);

  if (!inspection.valid) {
    return {
      status: "NO_DISCOUNT",
      reasonCode: REASON_CODES.INVALID_CONFIG,
      operation: null,
      configuration: inspection,
      lines: [],
    };
  }

  if (requireApproved && config.state !== CONFIG_STATES.APPROVED_FOR_PRODUCTION) {
    return {
      status: "NO_DISCOUNT",
      reasonCode: REASON_CODES.CONFIG_NOT_APPROVED,
      operation: null,
      configuration: inspection,
      lines: [],
    };
  }

  const diagnostics = (Array.isArray(lines) ? lines : []).map((line) => diagnoseLine(line, config.rules));
  const operation = operationFromDiagnostics(diagnostics);

  return {
    status: operation ? "DISCOUNT" : "NO_DISCOUNT",
    reasonCode: operation ? REASON_CODES.DISCOUNT_APPLIED : "NO_ELIGIBLE_LINES",
    operation,
    configuration: inspection,
    lines: diagnostics,
  };
}
