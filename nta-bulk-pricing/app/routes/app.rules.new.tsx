import type { ActionFunctionArgs } from "react-router";
import { redirect, useActionData } from "react-router";
import { authenticate } from "../shopify.server";
import { createRule, parseRuleForm, validateRule } from "../rules.server";
import { RuleEditor } from "../components/RuleEditor";

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request); const input = parseRuleForm(await request.formData()); const errors = validateRule(input);
  if (errors.length) return { errors, input };
  const rule = await createRule(session.shop, input); return redirect(`/app/rules/${rule.id}`);
}
export default function NewRule() { const data = useActionData<typeof action>(); return <s-page heading="Add discount rule">
  {data?.errors?.length ? <s-banner tone="critical" heading="Rule was not saved"><ul>{data.errors.map((error) => <li key={error}>{error}</li>)}</ul></s-banner> : null}
  <s-section><RuleEditor initial={data?.input} submitLabel="Create rule" /></s-section>
</s-page>; }
