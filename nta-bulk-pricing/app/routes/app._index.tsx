import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <s-page heading="TierWeave">
      <s-section heading="Quantity pricing made clear">
        <s-paragraph>
          Create quantity tiers for products, variants, or collections and keep
          the same pricing message on product pages and at checkout.
        </s-paragraph>
      </s-section>

      <s-section heading="How it works">
        <s-unordered-list>
          <s-list-item>Create and review your quantity-pricing rules.</s-list-item>
          <s-list-item>Publish the active rule set to Shopify.</s-list-item>
          <s-list-item>Add the quantity-pricing block to your product template.</s-list-item>
          <s-list-item>Test a qualifying cart before promoting an offer.</s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="Current phase">
        <s-paragraph>
          Rules remain drafts until you explicitly publish them.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
