import { readFileSync, writeFileSync } from "node:fs";
import { buildDevKoalaRules, devKoalaImportSql } from "../src/dev-koala-import.js";

const [mappingPath, outputPath] = process.argv.slice(2);
if (!mappingPath || !outputPath) {
  throw new Error("Usage: node scripts/prepare-dev-koala-import.mjs <mapping.json> <output.sql>");
}
const snapshot = JSON.parse(readFileSync(new URL("../docs/koala-campaigns-2026-09-26.json", import.meta.url)));
const mapping = JSON.parse(readFileSync(mappingPath));
const rules = buildDevKoalaRules(snapshot, mapping);
writeFileSync(outputPath, devKoalaImportSql(rules));
console.log(`Prepared ${rules.length} staging-only rules in ${outputPath}.`);
