function activeAt(rule, now) {
  const timestamp = now.getTime();
  return rule.enabled !== false &&
    (!rule.startsAt || new Date(rule.startsAt).getTime() <= timestamp) &&
    (!rule.endsAt || new Date(rule.endsAt).getTime() > timestamp);
}

export function compileFunctionConfiguration(records, now = new Date()) {
  const rules = records
    .filter((rule) => activeAt(rule, now))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id))
    .map((rule) => ({
      id: rule.id,
      title: rule.title,
      enabled: true,
      priority: rule.priority ?? 0,
      target: {
        type: rule.targetType,
        ids: rule.targets.map((target) => target.shopifyId).sort(),
      },
      tiers: [...rule.tiers]
        .sort((a, b) => a.minimum - b.minimum)
        .map((tier) => ({
          id: tier.id,
          min: tier.minimum,
          max: tier.maximum,
          ...(tier.message ? { message: tier.message } : {}),
          discount: {
            type: tier.discountType,
            ...(tier.discountType === "NONE" ? {} : { value: Number(tier.discountValue) }),
          },
        })),
    }));

  return {
    version: 1,
    collectionIds: [...new Set(rules
      .filter((rule) => rule.target.type === "COLLECTIONS")
      .flatMap((rule) => rule.target.ids))].sort(),
    rules,
  };
}
