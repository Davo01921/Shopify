import { mapCampaignToRule } from "./koala-import.js";

const DEV_SHOP = "tierweave-function-test.myshopify.com";

export function buildDevKoalaRules(snapshot, mapping) {
  if (!Array.isArray(snapshot?.campaigns) || snapshot.campaigns.length !== 6) {
    throw new Error("Expected the six captured Koala campaigns.");
  }
  if (mapping?.shop !== DEV_SHOP || !mapping.products || typeof mapping.products !== "object") {
    throw new Error(`Mapping must target ${DEV_SHOP}.`);
  }

  const usedDevIds = new Set();
  return snapshot.campaigns.map((campaign) => {
    const products = campaign.products.flatMap((product) => {
      const mapped = mapping.products[product.id];
      if (!mapped) return [];
      if (!/^\d+$/.test(String(mapped.id)) || !String(mapped.title ?? "").trim()) {
        throw new Error(`Invalid development product mapping for ${product.id}.`);
      }
      if (usedDevIds.has(String(mapped.id))) {
        throw new Error(`Development product ${mapped.id} is mapped more than once.`);
      }
      usedDevIds.add(String(mapped.id));
      return [{ id: String(mapped.id), title: String(mapped.title) }];
    });
    if (!products.length) throw new Error(`No development product mapped for ${campaign.id}.`);

    const rule = mapCampaignToRule({ ...campaign, products }, { enabled: true });
    rule.id = `koala-dev-${campaign.id}`;
    rule.targetType = campaign.products.length === 1 ? "PRODUCT" : "PRODUCTS";
    rule.priority = campaign.products.length === 1 ? 100 : 0;
    rule.internalNotes = `Staging-only test mapping from Koala campaign ${campaign.id}; source product IDs remain in docs/koala-campaigns-2026-09-26.json.`;
    return rule;
  });
}

const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;
const nullable = (value) => value == null ? "NULL" : sqlString(value);

export function devKoalaImportSql(rules) {
  const lines = [
    "-- Staging only: tierweave-staging / tierweave-function-test.myshopify.com.",
    "-- IDs are deterministic; rerunning the same mapping updates these six rules without duplicates.",
  ];
  for (const rule of rules) {
    lines.push(
      `INSERT INTO DiscountRule (id, shop, title, enabled, priority, targetType, internalNotes, createdAt, updatedAt) VALUES (${sqlString(rule.id)}, ${sqlString(DEV_SHOP)}, ${sqlString(rule.title)}, 1, ${rule.priority}, ${sqlString(rule.targetType)}, ${sqlString(rule.internalNotes)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET title=excluded.title, enabled=excluded.enabled, priority=excluded.priority, targetType=excluded.targetType, internalNotes=excluded.internalNotes, updatedAt=CURRENT_TIMESTAMP WHERE DiscountRule.shop=${sqlString(DEV_SHOP)};`,
    );
    for (const target of rule.targets) {
      const id = `${rule.id}-target-${target.shopifyId.split("/").at(-1)}`;
      lines.push(`INSERT INTO DiscountTarget (id, shopifyId, label, ruleId) VALUES (${sqlString(id)}, ${sqlString(target.shopifyId)}, ${sqlString(target.label)}, ${sqlString(rule.id)}) ON CONFLICT(id) DO UPDATE SET shopifyId=excluded.shopifyId, label=excluded.label;`);
    }
    for (const tier of rule.tiers) {
      const id = `${rule.id}-tier-${tier.minimum}`;
      lines.push(`INSERT INTO DiscountTier (id, minimum, maximum, title, discountType, discountValue, message, ruleId) VALUES (${sqlString(id)}, ${tier.minimum}, ${tier.maximum ?? "NULL"}, ${sqlString(tier.title)}, ${sqlString(tier.discountType)}, ${nullable(tier.discountValue)}, ${sqlString(tier.message)}, ${sqlString(rule.id)}) ON CONFLICT(id) DO UPDATE SET maximum=excluded.maximum, title=excluded.title, discountType=excluded.discountType, discountValue=excluded.discountValue, message=excluded.message;`);
    }
  }
  return `${lines.join("\n")}\n`;
}
