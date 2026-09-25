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
    <s-page heading="NTA Bulk Pricing">
      <s-section heading="Koala replacement — development mode">
        <s-paragraph>
          The replacement discount engine is being built and tested here. Koala
          remains the live source of bulk pricing until all four offer groups
          pass cart and checkout comparison tests.
        </s-paragraph>
      </s-section>

      <s-section heading="Safety gates">
        <s-unordered-list>
          <s-list-item>No live discounts are created or changed automatically.</s-list-item>
          <s-list-item>The app remains uninstalled on the production store.</s-list-item>
          <s-list-item>Public distribution is selected only after review readiness.</s-list-item>
          <s-list-item>Koala is disabled only after verified parity and rollback testing.</s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="Current phase">
        <s-paragraph>
          Discount Function scaffolding and deterministic rule-engine validation.
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
