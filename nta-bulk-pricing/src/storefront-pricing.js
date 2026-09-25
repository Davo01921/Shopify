import { selectRuleForLine } from "./rule-engine.js";

function gid(resource, value) {
  const id = String(value ?? "").trim();
  if (!id) return null;
  if (id.startsWith("gid://shopify/")) return id;
  if (!/^\d+$/.test(id)) return null;
  return `gid://shopify/${resource}/${id}`;
}

export function storefrontLine({ productId, variantId, collectionIds = [] }) {
  return {
    productId: gid("Product", productId),
    variantId: gid("ProductVariant", variantId),
    collectionMemberships: collectionIds
      .map((id) => gid("Collection", id))
      .filter(Boolean)
      .map((collectionId) => ({ collectionId, isMember: true })),
  };
}

export function storefrontPricing(configuration, input) {
  if (!configuration || !Array.isArray(configuration.rules)) return null;
  const line = storefrontLine(input);
  if (!line.productId) return null;
  const rule = selectRuleForLine(line, configuration.rules);
  if (!rule) return null;

  return {
    rule: { id: rule.id, title: rule.title },
    tiers: [...rule.tiers]
      .sort((a, b) => a.min - b.min)
      .map((tier) => ({
        id: tier.id,
        min: tier.min,
        max: tier.max ?? null,
        message: tier.message ?? "",
        discount: tier.discount,
      })),
  };
}
