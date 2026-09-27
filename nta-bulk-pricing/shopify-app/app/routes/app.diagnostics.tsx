import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { loadBulkPricingConfig } from "../models/bulk-pricing.server";
import { diagnoseLine } from "../../../src/rule-engine.js";

const EXAMPLE_LINE = {
  lineId: "diagnostic-line",
  productId: "gid://shopify/Product/123",
  variantId: "gid://shopify/ProductVariant/456",
  quantity: 3,
  collectionMemberships: [],
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const config = await loadBulkPricingConfig(session.shop);

  return {
    state: config.state,
    example: JSON.stringify(EXAMPLE_LINE, null, 2),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const config = await loadBulkPricingConfig(session.shop);
  const formData = await request.formData();
  const raw = String(formData.get("lineJson") || "");

  try {
    const line = JSON.parse(raw);
    return {
      ok: true,
      result: diagnoseLine(line, config.rules),
      lineJson: raw,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      lineJson: raw,
    };
  }
}

export default function Diagnostics() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <s-page heading="Bulk-pricing diagnostics">
      <s-section>
        <s-paragraph>
          Configuration state: <strong>{loaderData.state}</strong>
        </s-paragraph>
        <s-paragraph>
          This preview uses the same diagnoseLine() logic as the pricing engine.
          It does not apply a live discount.
        </s-paragraph>
      </s-section>

      <s-section heading="Test line">
        <Form method="post">
          <s-stack direction="block" gap="base">
            <label>
              Cart-line JSON
              <textarea
                name="lineJson"
                rows={14}
                defaultValue={actionData?.lineJson || loaderData.example}
                style={{ width: "100%", fontFamily: "monospace" }}
              />
            </label>
            <s-button type="submit" variant="primary">Evaluate</s-button>
          </s-stack>
        </Form>
      </s-section>

      {actionData?.ok ? (
        <s-section heading="Result">
          <pre>{JSON.stringify(actionData.result, null, 2)}</pre>
        </s-section>
      ) : actionData?.message ? (
        <s-section>
          <s-banner tone="critical">{actionData.message}</s-banner>
        </s-section>
      ) : null}
    </s-page>
  );
}
