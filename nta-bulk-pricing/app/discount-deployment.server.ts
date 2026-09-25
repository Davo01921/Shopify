import db from "./db.server";
import { listRules } from "./rules.server";
import { compileFunctionConfiguration } from "../src/function-configuration.js";
import {
  automaticDiscountInput,
  configurationHash,
  mutationDiscount,
} from "../src/discount-deployment.js";

type AdminClient = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

const CREATE_DISCOUNT = `#graphql
  mutation CreateNtaBulkPricing($input: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $input) {
      automaticAppDiscount { discountId title status }
      userErrors { field message }
    }
  }
`;

const UPDATE_DISCOUNT = `#graphql
  mutation UpdateNtaBulkPricing($id: ID!, $input: DiscountAutomaticAppInput!) {
    discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $input) {
      automaticAppDiscount { discountId title status }
      userErrors { field message }
    }
  }
`;

async function configurationForShop(shop: string, now = new Date()) {
  const records = await listRules(shop);
  const configuration = compileFunctionConfiguration(records, now);
  return { configuration, hash: configurationHash(configuration) };
}

export async function getDeploymentPreview(shop: string, now = new Date()) {
  const [{ configuration, hash }, deployment] = await Promise.all([
    configurationForShop(shop, now),
    db.discountDeployment.findUnique({ where: { shop } }),
  ]);
  return {
    activeRuleCount: configuration.rules.length,
    collectionCount: configuration.collectionIds.length,
    deployment,
    stale: !deployment?.syncedAt || deployment.configHash !== hash,
  };
}

export async function publishRules(admin: AdminClient, shop: string, now = new Date()) {
  const { configuration, hash } = await configurationForShop(shop, now);
  const existing = await db.discountDeployment.findUnique({ where: { shop } });
  if (!configuration.rules.length && !existing?.discountId) {
    throw new Error("Add and enable at least one valid rule before creating the Shopify discount.");
  }

  const isUpdate = Boolean(existing?.discountId);
  const operation = isUpdate ? "discountAutomaticAppUpdate" : "discountAutomaticAppCreate";
  const input = automaticDiscountInput(configuration, now.toISOString());
  if (isUpdate) delete input.startsAt;

  try {
    const response = await admin.graphql(isUpdate ? UPDATE_DISCOUNT : CREATE_DISCOUNT, {
      variables: isUpdate ? { id: existing!.discountId, input } : { input },
    });
    const payload = await response.json();
    const discount = mutationDiscount(payload, operation);
    const configJson = JSON.stringify(configuration);
    const deployment = await db.discountDeployment.upsert({
      where: { shop },
      create: { shop, discountId: discount.discountId, configHash: hash, configJson, ruleCount: configuration.rules.length, syncedAt: now },
      update: { discountId: discount.discountId, configHash: hash, configJson, ruleCount: configuration.rules.length, syncedAt: now, lastError: null },
    });
    return { deployment, configuration, status: discount.status, operation: isUpdate ? "updated" : "created" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Shopify synchronization error.";
    await db.discountDeployment.upsert({
      where: { shop },
      create: { shop, ruleCount: configuration.rules.length, lastError: message },
      update: { lastError: message },
    });
    throw error;
  }
}
