import type { LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";
import { login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect("/app?" + url.searchParams.toString());
  }

  return { showForm: Boolean(login) };
};

export default function Index() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", padding: "1rem" }}>
      <h1>NTA Bulk Pricing</h1>
      <p>Shopify bulk-pricing configuration app for Nano Tanks Australia.</p>
      {showForm ? (
        <Form method="post" action="/auth/login">
          <label>
            Shop domain
            <input name="shop" placeholder="example.myshopify.com" />
          </label>
          <button type="submit">Log in</button>
        </Form>
      ) : null}
    </main>
  );
}
