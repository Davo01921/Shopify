// Imports a captured Koala campaign snapshot into the local rule database as
// DISABLED replacement rules. Nothing is published to Shopify by this script;
// rules only reach a store through the app's explicit publish action.
//
// Usage:
//   node scripts/import-koala-campaigns.mjs \
//     --snapshot=docs/koala-campaigns-2026-09-26.json \
//     --shop=nano-tanks-australia-aquarium-shop.myshopify.com [--enable]
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { validateRules } from "../src/rule-engine.js";
import { compileFunctionConfiguration } from "../src/function-configuration.js";
import { buildRulesFromSnapshot } from "../src/koala-import.js";

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [key, value] = a.slice(2).split("=");
      return [key, value ?? true];
    }),
);

const snapshotPath = args.snapshot;
const shop = args.shop;
const enable = args.enable === true || args.enable === "true";
if (!snapshotPath || !shop) {
  console.error("Required: --snapshot=<file> --shop=<myshopify domain> [--enable]");
  process.exit(2);
}

const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
const records = buildRulesFromSnapshot(snapshot, { enabled: enable });

// Validate as Function-configuration rules (enabled) before touching the database.
validateRules(compileFunctionConfiguration(records.map((r) => ({ ...r, enabled: true })), new Date()).rules);

const prisma = new PrismaClient();
try {
  for (const record of records) {
    const { id, targets, tiers, ...rule } = record;
    await prisma.$transaction(async (tx) => {
      await tx.discountTarget.deleteMany({ where: { ruleId: id } });
      await tx.discountTier.deleteMany({ where: { ruleId: id } });
      await tx.discountRule.upsert({
        where: { id },
        create: {
          id, shop, ...rule,
          targets: { create: targets },
          tiers: { create: tiers },
        },
        update: {
          shop, ...rule,
          targets: { create: targets },
          tiers: { create: tiers },
        },
      });
    });
    console.log(`IMPORTED ${id} title="${record.title}" type=${record.targetType} products=${targets.length} tiers=${tiers.length} enabled=${record.enabled}`);
  }
  const count = await prisma.discountRule.count({ where: { shop } });
  console.log(`DONE shop=${shop} rulesForShop=${count}`);
} finally {
  await prisma.$disconnect();
}
