import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteRule, duplicateRule, listRules, setRuleEnabled } from "../rules.server";
import { getDeploymentPreview, publishRules } from "../discount-deployment.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const [rules, deployment] = await Promise.all([listRules(session.shop), getDeploymentPreview(session.shop)]);
  return { rules, deployment, published: url.searchParams.get("published") === "1" };
}
export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData(); const id = String(form.get("id") ?? ""); const intent = String(form.get("intent") ?? "");
  if (intent === "publish") {
    try {
      await publishRules(admin, session.shop);
      return redirect("/app/rules?published=1");
    } catch (error) {
      return { syncError: error instanceof Error ? error.message : "The Shopify discount could not be synchronized." };
    }
  }
  if (intent === "delete") await deleteRule(session.shop, id);
  if (intent === "duplicate") {
    const copy = await duplicateRule(session.shop, id);
    if (copy) return redirect(`/app/rules/${copy.id}`);
  }
  if (intent === "toggle") await setRuleEnabled(session.shop, id, form.get("enabled") === "true");
  return redirect("/app/rules");
}
export default function Rules() {
  const { rules, deployment, published } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const publishing = navigation.formData?.get("intent") === "publish";
  return <s-page heading="Discount rules">
    <Link to="/app/rules/new">Add rule</Link>
    {published ? <s-banner tone="success" heading="Shopify discount synchronized">The active rule configuration is now published to the development store.</s-banner> : null}
    {actionData && "syncError" in actionData ? <s-banner tone="critical" heading="Shopify discount was not changed">{actionData.syncError}</s-banner> : null}
    <s-section heading="Shopify synchronization">
      <p>{deployment.deployment?.discountId ? "Automatic discount created" : "Automatic discount not created"} · {deployment.activeRuleCount} active rule{deployment.activeRuleCount === 1 ? "" : "s"} · {deployment.stale ? "Unpublished changes" : "Up to date"}</p>
      {deployment.deployment?.syncedAt ? <p>Last synchronized: {new Date(deployment.deployment.syncedAt).toLocaleString()}</p> : null}
      {deployment.deployment?.lastError ? <p>Last error: {deployment.deployment.lastError}</p> : null}
      <Form method="post"><input type="hidden" name="intent" value="publish"/><button disabled={publishing}>{publishing ? "Publishing…" : deployment.deployment?.discountId ? "Publish changes" : "Create Shopify discount"}</button></Form>
      <p>Publishing affects only this installed store. Discount stacking is disabled.</p>
    </s-section>
    <s-section>
      {!rules.length ? <p>No discount rules yet.</p> : <div style={{ display: "grid", gap: "12px" }}>{rules.map((rule) =>
        <div key={rule.id} style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "14px", display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr auto", gap: "12px", alignItems: "center" }}>
          <strong>{rule.title}</strong><span>{rule.targetType}: {rule.targets.length} selected</span>
          <span>{rule.tiers.length} tier{rule.tiers.length === 1 ? "" : "s"}</span><span>Priority {rule.priority}</span>
          <div style={{ display: "flex", gap: "8px" }}><Link to={`/app/rules/${rule.id}`}>Edit</Link>
            <Form method="post"><input type="hidden" name="id" value={rule.id}/><input type="hidden" name="intent" value="duplicate"/><button>Duplicate</button></Form>
            <Form method="post"><input type="hidden" name="id" value={rule.id}/><input type="hidden" name="intent" value="toggle"/><input type="hidden" name="enabled" value={String(!rule.enabled)}/><button>{rule.enabled ? "Disable" : "Enable"}</button></Form>
            <Form method="post" onSubmit={(e) => { if (!confirm("Delete this rule?")) e.preventDefault(); }}><input type="hidden" name="id" value={rule.id}/><input type="hidden" name="intent" value="delete"/><button>Delete</button></Form>
          </div>
        </div>)}</div>}
    </s-section>
  </s-page>;
}
