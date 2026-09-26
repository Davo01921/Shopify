import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, Form, useActionData, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const errors = actionData?.errors;

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <p className={styles.text}><strong>TierWeave</strong></p>
        <h1 className={styles.heading}>Quantity pricing without hidden rules</h1>
        <p className={styles.text}>
          Build product, variant, and collection quantity tiers that stay
          consistent from the product page through checkout.
        </p>
        {showForm && (
          <Form className={styles.form} method="post">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>{errors?.shop ?? "e.g: my-shop-domain.myshopify.com"}</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
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
