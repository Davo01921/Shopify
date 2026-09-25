import db from "./db.server";

const TARGET_TYPES = new Set(["PRODUCT", "PRODUCTS", "VARIANTS", "COLLECTIONS"]);
const DISCOUNT_TYPES = new Set(["NONE", "PERCENTAGE", "FIXED_PER_ITEM"]);
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export function parseRuleForm(form: FormData) {
  const targetIds = text(form, "targetIds").split(/[,\n]/).map((id) => id.trim()).filter(Boolean);
  let tiers: unknown = [];
  try { tiers = JSON.parse(text(form, "tiers")); } catch { tiers = []; }
  return {
    title: text(form, "title"), enabled: form.get("enabled") === "on",
    priority: Number(text(form, "priority") || 0), targetType: text(form, "targetType"),
    targetIds: [...new Set(targetIds)], internalNotes: text(form, "internalNotes"),
    startsAt: text(form, "startsAt") || null, endsAt: text(form, "endsAt") || null,
    tiers: Array.isArray(tiers) ? tiers.map((tier) => {
      const item = tier as Record<string, unknown>;
      return {
        minimum: Number(item.minimum), maximum: item.maximum === "" || item.maximum == null ? null : Number(item.maximum),
        title: String(item.title ?? "").trim(), discountType: String(item.discountType ?? ""),
        discountValue: item.discountType === "NONE" ? null : Number(item.discountValue), message: String(item.message ?? "").trim(),
      };
    }) : [],
  };
}
export type RuleInput = ReturnType<typeof parseRuleForm>;

export function validateRule(input: RuleInput) {
  const errors: string[] = [];
  if (!input.title) errors.push("Rule name is required.");
  if (!Number.isInteger(input.priority)) errors.push("Priority must be a whole number.");
  if (!TARGET_TYPES.has(input.targetType)) errors.push("Choose a valid product scope.");
  if (!input.targetIds.length) errors.push("Select at least one product, variant, or collection.");
  if (!input.tiers.length) errors.push("Add at least one quantity tier.");
  if (input.startsAt && input.endsAt && new Date(input.startsAt) >= new Date(input.endsAt)) errors.push("End date must be after start date.");
  const minimums = new Set<number>();
  const sorted = [...input.tiers].sort((a, b) => a.minimum - b.minimum);
  sorted.forEach((tier, index) => {
    if (!Number.isInteger(tier.minimum) || tier.minimum < 1) errors.push(`Tier ${index + 1}: minimum must be a whole number of at least 1.`);
    if (minimums.has(tier.minimum)) errors.push(`Tier ${index + 1}: minimum quantity is duplicated.`);
    minimums.add(tier.minimum);
    if (tier.maximum != null && (!Number.isInteger(tier.maximum) || tier.maximum < tier.minimum)) errors.push(`Tier ${index + 1}: maximum must be at least its minimum.`);
    if (index && sorted[index - 1].maximum == null) errors.push(`Tier ${index}: an open-ended tier cannot precede another tier.`);
    if (index && sorted[index - 1].maximum != null && sorted[index - 1].maximum! >= tier.minimum) errors.push(`Tier ${index + 1}: range overlaps the previous tier.`);
    if (!DISCOUNT_TYPES.has(tier.discountType)) errors.push(`Tier ${index + 1}: choose a valid discount type.`);
    if (tier.discountType !== "NONE" && (!Number.isFinite(tier.discountValue) || Number(tier.discountValue) < 0)) errors.push(`Tier ${index + 1}: discount must be zero or greater.`);
    if (tier.discountType === "PERCENTAGE" && Number(tier.discountValue) > 100) errors.push(`Tier ${index + 1}: percentage cannot exceed 100.`);
  });
  return errors;
}

const include = { targets: true, tiers: { orderBy: { minimum: "asc" as const } } };
export const listRules = (shop: string) => db.discountRule.findMany({ where: { shop }, include, orderBy: [{ priority: "desc" }, { updatedAt: "desc" }] });
export const getRule = (shop: string, id: string) => db.discountRule.findFirst({ where: { shop, id }, include });
function data(input: RuleInput) { return {
  title: input.title, enabled: input.enabled, priority: input.priority, targetType: input.targetType, internalNotes: input.internalNotes,
  startsAt: input.startsAt ? new Date(input.startsAt) : null, endsAt: input.endsAt ? new Date(input.endsAt) : null,
  targets: { create: input.targetIds.map((shopifyId) => ({ shopifyId })) },
  tiers: { create: input.tiers.map((tier) => ({ ...tier, discountValue: tier.discountValue })) },
}; }
export const createRule = (shop: string, input: RuleInput) => db.discountRule.create({ data: { shop, ...data(input) }, include });
export const updateRule = (shop: string, id: string, input: RuleInput) => db.$transaction(async (tx) => {
  const current = await tx.discountRule.findFirst({ where: { shop, id }, select: { id: true } });
  if (!current) return null;
  await tx.discountTarget.deleteMany({ where: { ruleId: id } });
  await tx.discountTier.deleteMany({ where: { ruleId: id } });
  return tx.discountRule.update({ where: { id }, data: data(input), include });
});
export async function duplicateRule(shop: string, id: string) {
  const source = await getRule(shop, id);
  if (!source) return null;
  return createRule(shop, {
    title: `${source.title} copy`, enabled: false, priority: source.priority, targetType: source.targetType,
    targetIds: source.targets.map((target) => target.shopifyId), internalNotes: source.internalNotes,
    startsAt: source.startsAt?.toISOString() ?? null, endsAt: source.endsAt?.toISOString() ?? null,
    tiers: source.tiers.map((tier) => ({ minimum: tier.minimum, maximum: tier.maximum, title: tier.title,
      discountType: tier.discountType, discountValue: tier.discountValue == null ? null : Number(tier.discountValue), message: tier.message })),
  });
}
export const deleteRule = (shop: string, id: string) => db.discountRule.deleteMany({ where: { shop, id } });
export const setRuleEnabled = (shop: string, id: string, enabled: boolean) => db.discountRule.updateMany({ where: { shop, id }, data: { enabled } });
