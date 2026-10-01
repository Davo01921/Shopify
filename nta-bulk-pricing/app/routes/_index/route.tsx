import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

export default function App() {
  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <p className={styles.text}><strong>TierWeave</strong></p>
        <h1 className={styles.heading}>Quantity pricing without hidden rules</h1>
        <p className={styles.text}>
          Build product, variant, and collection quantity tiers that stay
          consistent from the product page through checkout.
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Flexible targeting.</strong> Apply rules to products,
            variants, or collections.
          </li>
          <li>
            <strong>Deterministic pricing.</strong> Preview tiers before
            publishing them to Shopify.
          </li>
          <li>
            <strong>Storefront clarity.</strong> Show matching quantity pricing
            on product pages and at checkout.
          </li>
        </ul>
      </div>
    </div>
  );
}
