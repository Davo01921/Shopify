import type { LoaderFunctionArgs } from "react-router";
import db from "../db.server";
import { authenticate } from "../shopify.server";
import { storefrontPricing } from "../../src/storefront-pricing.js";

const empty = () => Response.json({ pricing: null }, {
  headers: { "Cache-Control": "private, max-age=60" },
});

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) return empty();

  const url = new URL(request.url);
  const deployment = await db.discountDeployment.findUnique({
    where: { shop: session.shop },
    select: { configJson: true },
  });
  if (!deployment?.configJson) return empty();

  try {
    const configuration = JSON.parse(deployment.configJson);
    const pricing = storefrontPricing(configuration, {
      productId: url.searchParams.get("product_id"),
      variantId: url.searchParams.get("variant_id"),
      collectionIds: url.searchParams.get("collection_ids")?.split(",").filter(Boolean) ?? [],
    });
    return Response.json({ pricing }, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch {
    return empty();
  }
}
