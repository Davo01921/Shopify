import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, redirect, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteRule, duplicateRule, listRules, setRuleEnabled } from "../rules.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  return { rules: await listRules(session.shop) };
}
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const form = await request.formData(); const id = String(form.get("id") ?? ""); const intent = String(form.get("intent") ?? "");
  if (intent === "delete") await deleteRule(session.shop, id);
  if (intent === "duplicate") {
    const copy = await duplicateRule(session.shop, id);
    if (copy) return redirect(`/app/rules/${copy.id}`);
  }
  if (intent === "toggle") await setRuleEnabled(session.shop, id, form.get("enabled") === "true");
  return redirect("/app/rules");
}
export default function Rules() {
  const { rules } = useLoaderData<typeof loader>();
  return <s-page heading="Discount rules">
    <Link to="/app/rules/new">Add rule</Link>
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
