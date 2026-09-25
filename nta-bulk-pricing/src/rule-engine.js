const TARGET_WEIGHT = Object.freeze({
  VARIANTS: 400,
  PRODUCT: 300,
  PRODUCTS: 200,
  COLLECTIONS: 100,
});

export function validateRules(rules) {
  if (!Array.isArray(rules)) throw new Error("rules must be an array");

  const ids = new Set();

  for (const rule of rules) {
    if (!rule?.id || typeof rule.id !== "string") throw new Error("each rule needs a string id");
    if (ids.has(rule.id)) throw new Error(`duplicate rule id: ${rule.id}`);
    ids.add(rule.id);

    if (!TARGET_WEIGHT[rule.target?.type]) {
      throw new Error(`unsupported target type on ${rule.id}`);
    }

    if (!Array.isArray(rule.tiers) || rule.tiers.length === 0) {
      throw new Error(`rule ${rule.id} needs at least one tier`);
    }

    const sorted = [...rule.tiers].sort((a, b) => a.min - b.min);
    let previousMax = 0;

    for (const tier of sorted) {
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
    }
  }

  return true;
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

export function selectRuleForLine(line, rules) {
  const matches = rules
    .filter((rule) => rule.enabled !== false)
    .filter((rule) => ruleMatchesLine(rule, line))
    .map((rule, index) => ({
      rule,
      index,
      score: TARGET_WEIGHT[rule.target.type] + (Number(rule.priority) || 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return matches[0]?.rule ?? null;
}

export function selectTier(rule, quantity) {
  if (!rule || !Number.isInteger(quantity) || quantity < 1) return null;

  return [...rule.tiers]
    .sort((a, b) => b.min - a.min)
    .find((tier) => quantity >= tier.min && (tier.max == null || quantity <= tier.max)) ?? null;
}

export function evaluateLine(line, rules) {
  const rule = selectRuleForLine(line, rules);
  if (!rule) return null;

  const tier = selectTier(rule, line.quantity);
  if (!tier || tier.discount.type === "NONE") return {
    ruleId: rule.id,
    tierId: tier?.id ?? null,
    discount: null,
  };

  return {
    ruleId: rule.id,
    tierId: tier.id,
    discount: tier.discount,
    message: tier.message || rule.title || "Bulk pricing",
  };
}

export function buildProductDiscountOperation(lines, rules) {
  const candidates = [];

  for (const line of lines) {
    const result = evaluateLine(line, rules);
    if (!result?.discount) continue;

    const value = result.discount.type === "PERCENTAGE"
      ? { percentage: { value: result.discount.value } }
      : {
          fixedAmount: {
            amount: result.discount.value,
            appliesToEachItem: true,
          },
        };

    candidates.push({
      targets: [{ cartLine: { id: line.lineId } }],
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
