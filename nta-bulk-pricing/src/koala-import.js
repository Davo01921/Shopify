// Deterministic mapping from a captured Koala campaign snapshot (see
// scripts/capture-koala-campaigns.mjs) to this app's rule records.
// Koala display labels are known to be inaccurate; the configured discount
// values captured in the snapshot are the source of truth.

export function mapKoalaDiscount(discount) {
  const value = Number(discount?.value ?? 0);
  const type = discount?.type;
  if (value === 0) return { discountType: "NONE", discountValue: null };
  if (type === "percentage") return { discountType: "PERCENTAGE", discountValue: value };
  if (type === "amount") return { discountType: "FIXED_PER_ITEM", discountValue: value };
  throw new Error(`unknown Koala discount type: ${type}`);
}

export function mapCampaignToRule(campaign, { enabled = false } = {}) {
  const single = campaign.products.length === 1;
  const tiers = [...campaign.tiers]
    .sort((a, b) => a.minimum - b.minimum)
    .map((tier) => ({
      minimum: tier.minimum,
      maximum: tier.maximum ?? null,
      title: tier.name,
      message: tier.name,
      ...mapKoalaDiscount(tier.discount),
    }));
  return {
    id: `koala-${campaign.id}`,
    title: campaign.title || "Koala campaign",
    enabled,
    // Single-product campaigns must outrank multi-product scopes on overlap,
    // mirroring Koala's one-block-per-product behaviour. The engine's target
    // weight already ranks PRODUCT above PRODUCTS; priority breaks remaining ties.
    priority: single ? 100 : 0,
    targetType: single ? "PRODUCT" : "PRODUCTS",
    internalNotes: `Imported from Koala campaign ${campaign.id}. Koala display labels are known to be inaccurate; values are the configured/checkout-verified ones.`,
    targets: campaign.products.map((product) => ({
      shopifyId: `gid://shopify/Product/${product.id}`,
      label: product.title,
    })),
    tiers,
  };
}

export function buildRulesFromSnapshot(snapshot, options = {}) {
  if (!snapshot || !Array.isArray(snapshot.campaigns) || !snapshot.campaigns.length) {
    throw new Error("snapshot contains no campaigns");
  }
  return snapshot.campaigns.map((campaign) => mapCampaignToRule(campaign, options));
}
