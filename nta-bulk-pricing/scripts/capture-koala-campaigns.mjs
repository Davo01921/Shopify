import { writeFile } from "node:fs/promises";

const baseUrl = "https://nanotanksaustralia.com.au";
const collectionHandles = [
  "tetras",
  "barbs",
  "corydoras",
  "rasboras",
  "danios",
  "endlers",
  "guppies-and-endlers",
  "snails-mussels-1",
  "shrimps",
  "freshwater-snails",
  "mystery-snails",
  "frozen",
];
const specificHandles = ["otocinclus-arnoldi", "pea-puffer-juveniles"];
const expectedCampaignIds = new Set([
  "cm96s8wfd5itiy81mypwfektu",
  "cm9ddz5md5eytiscvezptruhm",
  "cmgsmq0361rwsj8ceelh3bcf5",
  "cmgzulas806befdch0jkazwtt",
  "cmsxs2o970l988f45vz0794zp",
  "cmtq9oitc85iv9y44d8eiw5xh",
]);

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const decode = (value) => value?.replaceAll("&amp;", "&").replaceAll("&quot;", '"') ?? "";

async function storefrontFetch(path) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        headers: { "user-agent": "NTA Koala migration capture/1.0" },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      if (attempt === 4) throw new Error(`${path}: network failure after 4 attempts (${error.name})`);
      await delay(4_000 * attempt);
      continue;
    }
    if (response.status !== 429) {
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      return response;
    }
    if (attempt === 4) throw new Error(`${path}: repeated HTTP 429`);
    await delay(6_000 * attempt);
  }
  throw new Error(`${path}: fetch failed`);
}

function parseCampaign(html) {
  const dealId = html.match(/deal: \{ id: "([^"]+)"/)?.[1];
  if (!dealId) return null;
  const title = decode(html.match(/class="koala-deal__title"[^>]*data-template="([^"]+)"/)?.[1]);
  const tiers = [];
  const pattern = /\{ id: "([^"]+)", name: "([^"]+)", discount: (\{[^}]+\}),[\s\S]*?maxQuantity: (null|\d+), minQuantity: (\d+)/g;
  let match;
  while ((match = pattern.exec(html))) {
    const discount = JSON.parse(match[3]);
    tiers.push({
      id: match[1],
      name: decode(match[2]),
      minimum: Number(match[5]),
      maximum: match[4] === "null" ? null : Number(match[4]),
      discount: {
        type: discount.type,
        value: Number(discount.value),
      },
    });
  }
  return { id: dealId, title, tiers };
}

const products = new Map();
for (const collection of collectionHandles) {
  const response = await storefrontFetch(`/collections/${collection}/products.json?limit=250`);
  const { products: collectionProducts } = await response.json();
  for (const product of collectionProducts) {
    const current = products.get(product.handle);
    products.set(product.handle, {
      id: String(product.id),
      handle: product.handle,
      title: product.title,
      collections: [...new Set([...(current?.collections ?? []), collection])],
    });
  }
}
for (const handle of specificHandles) {
  if (products.has(handle)) continue;
  const response = await storefrontFetch(`/products/${handle}.js`);
  const product = await response.json();
  products.set(handle, {
    id: String(product.id),
    handle: product.handle,
    title: product.title,
    collections: [],
  });
}

const campaigns = new Map();
const productList = [...products.values()];
let next = 0;

async function worker() {
  while (true) {
    const index = next;
    next += 1;
    if (index >= productList.length) return;
    const product = productList[index];
    const html = await (await storefrontFetch(`/products/${product.handle}`)).text();
    const campaign = parseCampaign(html);
    if (campaign && expectedCampaignIds.has(campaign.id)) {
      const current = campaigns.get(campaign.id) ?? { ...campaign, products: [] };
      current.products.push(product);
      campaigns.set(campaign.id, current);
    }
    await delay(1_200);
  }
}
await Promise.all([worker(), worker()]);

const snapshot = {
  version: 1,
  capturedAt: new Date().toISOString(),
  source: baseUrl,
  campaigns: [...campaigns.values()]
    .map((campaign) => ({
      ...campaign,
      tiers: [...campaign.tiers].sort((a, b) => a.minimum - b.minimum),
      products: [...campaign.products].sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id)),
};

const missing = [...expectedCampaignIds].filter((id) => !campaigns.has(id));
if (missing.length) throw new Error(`Missing expected campaigns: ${missing.join(", ")}`);

const output = JSON.stringify(snapshot, null, 2) + "\n";
const outputArgument = process.argv.find((argument) => argument.startsWith("--output="));
if (outputArgument) {
  const outputPath = outputArgument.slice("--output=".length);
  await writeFile(outputPath, output, "utf8");
  console.error(`Wrote ${snapshot.campaigns.length} campaigns to ${outputPath}`);
} else {
  process.stdout.write(output);
}
