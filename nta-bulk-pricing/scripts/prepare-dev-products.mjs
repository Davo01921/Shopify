import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve(process.argv[2] ?? "/tmp/tierweave-dev-products");
const snapshot = JSON.parse(readFileSync(new URL("../docs/koala-campaigns-2026-09-26.json", import.meta.url)));
const slugs = ["inverts", "group-fish", "frozen-foods", "pea-puffers", "otocinclus", "red-cherry-shrimp"];
const prices = ["10.00", "10.00", "5.00", "20.00", "20.00", "5.00"];
if (snapshot.campaigns.length !== slugs.length) throw new Error("Expected six Koala campaigns.");
mkdirSync(outDir, { recursive: true });

const manifest = snapshot.campaigns.map((campaign, index) => {
  const source = campaign.products[0];
  const handle = `tierweave-test-${slugs[index]}`;
  const optionName = "Test pack";
  const values = index === 5 ? ["Standard", "Alternative"] : ["Standard"];
  const input = {
    handle,
    title: `TierWeave test — ${source.title}`,
    vendor: "TierWeave staging",
    productType: "Staging test item",
    tags: ["tierweave-dev-test"],
    status: "ACTIVE",
    productOptions: [{ name: optionName, values: values.map((name) => ({ name })) }],
    variants: values.map((name, variantIndex) => ({
      optionValues: [{ optionName, name }],
      price: variantIndex ? "6.00" : prices[index],
      inventoryPolicy: "CONTINUE",
      inventoryItem: { tracked: false, requiresShipping: false },
    })),
  };
  const file = `${outDir}/${slugs[index]}.json`;
  writeFileSync(file, `${JSON.stringify({ input, identifier: { handle } }, null, 2)}\n`);
  return { campaignId: campaign.id, sourceProductId: source.id, handle, file };
});
writeFileSync(`${outDir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared ${manifest.length} development product inputs in ${outDir}.`);
