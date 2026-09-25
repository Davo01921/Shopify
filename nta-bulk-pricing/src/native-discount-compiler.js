function enabledDiscountTiers(rule) {
  return [...rule.tiers]
    .filter((tier) => tier.discount?.type && tier.discount.type !== "NONE")
    .sort((a, b) => a.min - b.min);
}

function targetItems(target) {
  const ids = target?.ids ?? [];

  switch (target?.type) {
    case "PRODUCT":
    case "PRODUCTS":
      return { products: { productsToAdd: ids } };
    case "VARIANTS":
      return { productVariants: { productVariantsToAdd: ids } };
    case "COLLECTIONS":
      return { collections: { collectionsToAdd: ids } };
    default:
      throw new Error(`unsupported native target: ${target?.type}`);
  }
}

function isSingleEntitlement(rule) {
  if (rule.target?.type === "PRODUCT") return (rule.target.ids ?? []).length === 1;
  if (rule.target?.type === "VARIANTS") return (rule.target.ids ?? []).length === 1;
  if (rule.target?.type === "PRODUCTS") return (rule.target.ids ?? []).length === 1;
  return false;
}

function assertMonotonicSameType(tiers) {
  if (tiers.length <= 1) return;

  const types = new Set(tiers.map((tier) => tier.discount.type));
  if (types.size !== 1) {
    throw new Error(
      "native automatic discounts cannot safely emulate mixed percentage/fixed tiers because Shopify may select a lower-tier discount as the better value",
    );
  }

  let previous = -Infinity;
  for (const tier of tiers) {
    const value = Number(tier.discount.value);
    if (value < previous) {
      throw new Error("native tier discounts must be non-decreasing");
    }
    previous = value;
  }
}

function customerGetsValue(discount) {
  if (discount.type === "PERCENTAGE") {
    return { percentage: Number(discount.value) / 100 };
  }

  if (discount.type === "FIXED_PER_ITEM") {
    return {
      discountAmount: {
        amount: String(discount.value),
        appliesOnEachItem: true,
      },
    };
  }

  throw new Error(`unsupported native discount: ${discount.type}`);
}

export function assessNativeCompatibility(rule) {
  const reasons = [];
  const tiers = enabledDiscountTiers(rule);

  if (!isSingleEntitlement(rule)) {
    reasons.push(
      "target contains multiple products/variants or a collection, so Shopify's native minimum quantity can pool qualifying items instead of enforcing per-line quantity",
    );
  }

  try {
    assertMonotonicSameType(tiers);
  } catch (error) {
    reasons.push(error.message);
  }

  return {
    exact: reasons.length === 0,
    requiredAutomaticDiscounts: tiers.length,
    reasons,
  };
}

export function compileNativeAutomaticDiscounts(
  rule,
  {
    startsAt,
    context = { all: true },
    allowQuantityPooling = false,
    allowMixedTierTypes = false,
  } = {},
) {
  if (!startsAt) throw new Error("startsAt is required");

  const tiers = enabledDiscountTiers(rule);
  const compatibility = assessNativeCompatibility(rule);

  if (!allowQuantityPooling && !isSingleEntitlement(rule)) {
    throw new Error(compatibility.reasons[0]);
  }

  if (!allowMixedTierTypes) {
    assertMonotonicSameType(tiers);
  }

  const items = targetItems(rule.target);

  return tiers.map((tier) => ({
    title: `NTA • ${rule.title} • ${tier.min}+`,
    startsAt,
    context,
    minimumRequirement: {
      quantity: {
        greaterThanOrEqualToQuantity: String(tier.min),
      },
    },
    customerGets: {
      value: customerGetsValue(tier.discount),
      items,
    },
    combinesWith: {
      productDiscounts: false,
      orderDiscounts: false,
      shippingDiscounts: true,
    },
  }));
}
