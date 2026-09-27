import prisma from "../db.server";
import { createConfigDocument } from "../../../src/rule-editor-model.js";
import {
  parseConfigDocument,
  serializeConfigDocument,
} from "../../../src/admin-config.js";

export async function loadBulkPricingConfig(shop: string) {
  const record = await prisma.bulkPricingConfig.findUnique({
    where: { shop },
  });

  if (!record) {
    const document = createConfigDocument();
    await saveBulkPricingConfig(shop, document);
    return document;
  }

  return parseConfigDocument(record.document);
}

export async function saveBulkPricingConfig(shop: string, config: unknown) {
  const document = serializeConfigDocument(config);

  await prisma.bulkPricingConfig.upsert({
    where: { shop },
    update: { document },
    create: { shop, document },
  });

  return parseConfigDocument(document);
}
