import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getRule, parseRuleForm, updateRule, validateRule } from "../rules.server";
import { RuleEditor } from "../components/RuleEditor";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request); const rule = await getRule(session.shop, String(params.ruleId));
  if (!rule) throw new Response("Not found", { status: 404 }); return { rule };
}
export async function action({ request, params }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request); const input = parseRuleForm(await request.formData()); const errors = validateRule(input);
  if (errors.length) return { errors, input };
  await updateRule(session.shop, String(params.ruleId), input); return redirect("/app/rules");
}
const localDate = (value: string | Date | null) => value ? new Date(value).toISOString().slice(0, 16) : "";
export default function EditRule() {
  const { rule } = useLoaderData<typeof loader>(); const data = useActionData<typeof action>();
  const initial = data?.input ?? { title: rule.title, enabled: rule.enabled, priority: rule.priority, targetType: rule.targetType,
    targetIds: rule.targets.map((target) => target.shopifyId), internalNotes: rule.internalNotes, startsAt: localDate(rule.startsAt), endsAt: localDate(rule.endsAt),
    tiers: rule.tiers.map((tier) => ({ minimum: tier.minimum, maximum: tier.maximum, title: tier.title, discountType: tier.discountType, discountValue: tier.discountValue == null ? null : Number(tier.discountValue), message: tier.message })) };
  return <s-page heading={rule.title}>{data?.errors?.length ? <s-banner tone="critical" heading="Rule was not saved"><ul>{data.errors.map((error) => <li key={error}>{error}</li>)}</ul></s-banner> : null}
    <s-section><RuleEditor initial={initial} /></s-section></s-page>;
}
