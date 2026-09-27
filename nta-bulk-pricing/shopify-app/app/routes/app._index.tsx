import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  loadBulkPricingConfig,
  saveBulkPricingConfig,
} from "../models/bulk-pricing.server";
import {
  reviewConfig,
  ruleListRows,
  transitionConfigState,
} from "../../../src/admin-config.js";
import { CONFIG_STATES } from "../../../src/rule-engine.js";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const config = await loadBulkPricingConfig(session.shop);

  return {
    config,
    review: reviewConfig(config),
    rows: ruleListRows(config),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  try {
    const config = await loadBulkPricingConfig(session.shop);

    if (intent === "validate") {
      const next = transitionConfigState(config, CONFIG_STATES.VALIDATED);
      await saveBulkPricingConfig(session.shop, next);
      return { ok: true, message: "Configuration validated." };
    }

    if (intent === "approve") {
      const acknowledgeWarnings =
        String(formData.get("acknowledgeWarnings") || "") === "yes";
      const next = transitionConfigState(
        config,
        CONFIG_STATES.APPROVED_FOR_PRODUCTION,
        { acknowledgeWarnings },
      );
      await saveBulkPricingConfig(session.shop, next);
      return { ok: true, message: "Configuration approved for production." };
    }

    if (intent === "draft") {
      const next = transitionConfigState(config, CONFIG_STATES.DRAFT);
      await saveBulkPricingConfig(session.shop, next);
      return { ok: true, message: "Configuration returned to draft." };
    }

    return { ok: false, message: "Unsupported action." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export default function RulesDashboard() {
  const { config, review, rows } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <s-page heading="NTA Bulk Pricing">
      <s-section heading="Configuration">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            State: <strong>{config.state}</strong> · Version {config.version}
          </s-paragraph>
          <s-paragraph>
            {review.summary.enabledRuleCount} enabled of {review.summary.ruleCount} rules ·{" "}
            {review.summary.warningCount} warning(s) · {review.summary.errorCount} error(s)
          </s-paragraph>

          {actionData?.message ? (
            <s-banner tone={actionData.ok ? "success" : "critical"}>
              {actionData.message}
            </s-banner>
          ) : null}

          {review.errors.map((item) => (
            <s-banner key={item.code} tone="critical">
              {item.message}
            </s-banner>
          ))}

          {review.warnings.map((item) => (
            <s-banner key={item.code} tone="warning">
              {item.message}
            </s-banner>
          ))}

          <s-stack direction="inline" gap="base">
            <Link to="/app/rules/new">Add rule</Link>

            {config.state === CONFIG_STATES.DRAFT ? (
              <Form method="post">
                <input type="hidden" name="intent" value="validate" />
                <s-button type="submit" variant="primary">
                  Validate configuration
                </s-button>
              </Form>
            ) : null}

            {config.state === CONFIG_STATES.VALIDATED ? (
              <>
                <Form method="post">
                  <input type="hidden" name="intent" value="approve" />
                  {review.warnings.length > 0 ? (
                    <label>
                      <input
                        type="checkbox"
                        name="acknowledgeWarnings"
                        value="yes"
                      />{" "}
                      I reviewed the warnings
                    </label>
                  ) : null}
                  <s-button type="submit" variant="primary">
                    Approve for production
                  </s-button>
                </Form>
                <Form method="post">
                  <input type="hidden" name="intent" value="draft" />
                  <s-button type="submit">Return to draft</s-button>
                </Form>
              </>
            ) : null}

            {config.state === CONFIG_STATES.APPROVED_FOR_PRODUCTION ? (
              <Form method="post">
                <input type="hidden" name="intent" value="draft" />
                <s-button type="submit">
                  Return to draft before editing
                </s-button>
              </Form>
            ) : null}
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Rules">
        {rows.length === 0 ? (
          <s-paragraph>No bulk-pricing rules yet.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {rows.map((row) => (
              <s-box
                key={row.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="block" gap="small">
                  <s-heading>{row.title}</s-heading>
                  <s-paragraph>
                    {row.enabled ? "Enabled" : "Disabled"} · {row.targetLabel} ·{" "}
                    {row.targetCount} target(s) · priority {row.priority}
                  </s-paragraph>
                  <s-paragraph>{row.tierSummary}</s-paragraph>
                  <Link to={"/app/rules/" + encodeURIComponent(row.id)}>
                    Edit rule
                  </Link>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}
