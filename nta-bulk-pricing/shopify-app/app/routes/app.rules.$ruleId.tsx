import { useState } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  loadBulkPricingConfig,
  saveBulkPricingConfig,
} from "../models/bulk-pricing.server";
import {
  createRule,
  removeRule,
  upsertRule,
} from "../../../src/rule-editor-model.js";
import { applyConfigEdit } from "../../../src/admin-config.js";
import {
  pickerLabelForTarget,
  pickerOptionsForTarget,
  pickerSelectionToTarget,
} from "../../../src/admin-resource-picker.js";

function parseRule(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("Missing rule payload.");
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Rule payload is not valid JSON.");
  }
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const config = await loadBulkPricingConfig(session.shop);
  const ruleId = params.ruleId || "new";

  if (ruleId === "new") {
    return {
      isNew: true,
      rule: createRule(),
      configState: config.state,
    };
  }

  const rule = config.rules.find((item: any) => item.id === ruleId);
  if (!rule) throw new Response("Rule not found", { status: 404 });

  return {
    isNew: false,
    rule,
    configState: config.state,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { session, redirect } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "save");

  try {
    const config = await loadBulkPricingConfig(session.shop);

    if (intent === "delete") {
      const ruleId = params.ruleId || "";
      if (!ruleId || ruleId === "new") {
        throw new Error("Cannot delete an unsaved rule.");
      }

      const next = applyConfigEdit(config, (draft: any) =>
        removeRule(draft, ruleId),
      );
      await saveBulkPricingConfig(session.shop, next);
      return redirect("/app");
    }

    const rule = parseRule(formData.get("ruleJson"));
    const next = applyConfigEdit(config, (draft: any) =>
      upsertRule(draft, rule),
    );

    await saveBulkPricingConfig(session.shop, next);
    return redirect("/app");
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function nextTierId() {
  return crypto.randomUUID();
}

export default function RuleEditor() {
  const { rule: initialRule, isNew, configState } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const shopify = useAppBridge();
  const [rule, setRule] = useState<any>(initialRule);

  function patchRule(patch: Record<string, unknown>) {
    setRule((current: any) => ({ ...current, ...patch }));
  }

  function patchTier(index: number, patch: Record<string, unknown>) {
    setRule((current: any) => ({
      ...current,
      tiers: current.tiers.map((tier: any, tierIndex: number) =>
        tierIndex === index ? { ...tier, ...patch } : tier,
      ),
    }));
  }

  function patchDiscount(index: number, patch: Record<string, unknown>) {
    setRule((current: any) => ({
      ...current,
      tiers: current.tiers.map((tier: any, tierIndex: number) =>
        tierIndex === index
          ? { ...tier, discount: { ...tier.discount, ...patch } }
          : tier,
      ),
    }));
  }

  async function pickTargets() {
    const selected = await shopify.resourcePicker(
      pickerOptionsForTarget(rule.target.type, rule.target.ids) as any,
    );

    if (!selected) return;

    try {
      const target = pickerSelectionToTarget(rule.target.type, selected as any[]);
      patchRule({ target });
    } catch (error) {
      shopify.toast.show(
        error instanceof Error ? error.message : String(error),
        { isError: true },
      );
    }
  }

  function changeTargetType(targetType: string) {
    patchRule({ target: { type: targetType, ids: [] } });
  }

  function appendTier() {
    setRule((current: any) => {
      const sorted = [...current.tiers].sort((a: any, b: any) => a.min - b.min);
      const last = sorted[sorted.length - 1];
      const newMin = last.max == null
        ? Math.max(Number(last.min) + 1, 3)
        : Number(last.max) + 1;

      const tiers = sorted.map((tier: any) =>
        tier.id === last.id && tier.max == null
          ? { ...tier, max: newMin - 1 }
          : tier,
      );

      tiers.push({
        id: nextTierId(),
        min: newMin,
        max: null,
        title: "",
        discount: { type: "PERCENTAGE", value: 5 },
      });

      return { ...current, tiers };
    });
  }

  function deleteTier(index: number) {
    setRule((current: any) => ({
      ...current,
      tiers: current.tiers.filter((_: any, tierIndex: number) => tierIndex !== index),
    }));
  }

  return (
    <s-page heading={isNew ? "Add bulk-pricing rule" : "Edit bulk-pricing rule"}>
      <s-section>
        <s-paragraph>
          Current configuration state: <strong>{configState}</strong>. Saving any
          change returns the configuration to DRAFT.
        </s-paragraph>

        {actionData?.message ? (
          <s-banner tone="critical">{actionData.message}</s-banner>
        ) : null}
      </s-section>

      <Form method="post">
        <input type="hidden" name="intent" value="save" />
        <input type="hidden" name="ruleJson" value={JSON.stringify(rule)} />

        <s-section heading="Rule">
          <s-stack direction="block" gap="base">
            <label>
              Internal title
              <input
                value={rule.title}
                onChange={(event) => patchRule({ title: event.currentTarget.value })}
                required
              />
            </label>

            <label>
              <input
                type="checkbox"
                checked={rule.enabled !== false}
                onChange={(event) => patchRule({ enabled: event.currentTarget.checked })}
              />{" "}
              Enabled
            </label>

            <label>
              Tie-break priority
              <input
                type="number"
                value={rule.priority || 0}
                onChange={(event) =>
                  patchRule({ priority: Number(event.currentTarget.value) || 0 })
                }
              />
            </label>
          </s-stack>
        </s-section>

        <s-section heading="Target">
          <s-stack direction="block" gap="base">
            <label>
              Target type
              <select
                value={rule.target.type}
                onChange={(event) => changeTargetType(event.currentTarget.value)}
              >
                <option value="PRODUCT">One product</option>
                <option value="PRODUCTS">Selected products</option>
                <option value="VARIANTS">Selected variants</option>
                <option value="COLLECTIONS">Collections</option>
              </select>
            </label>

            <s-paragraph>
              {pickerLabelForTarget(rule.target.type, rule.target.ids.length)}
            </s-paragraph>

            <s-button type="button" onClick={pickTargets}>
              Choose in Shopify
            </s-button>
          </s-stack>
        </s-section>

        <s-section heading="Quantity tiers">
          <s-stack direction="block" gap="base">
            {rule.tiers.map((tier: any, index: number) => (
              <s-box
                key={tier.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="block" gap="small">
                  <label>
                    Minimum quantity
                    <input
                      type="number"
                      min="1"
                      value={tier.min}
                      onChange={(event) =>
                        patchTier(index, { min: Number(event.currentTarget.value) })
                      }
                    />
                  </label>

                  <label>
                    Maximum quantity
                    <input
                      type="number"
                      min={tier.min}
                      value={tier.max ?? ""}
                      placeholder="No maximum"
                      onChange={(event) =>
                        patchTier(index, {
                          max:
                            event.currentTarget.value === ""
                              ? null
                              : Number(event.currentTarget.value),
                        })
                      }
                    />
                  </label>

                  <label>
                    Discount type
                    <select
                      value={tier.discount.type}
                      onChange={(event) => {
                        const type = event.currentTarget.value;
                        patchDiscount(
                          index,
                          type === "NONE"
                            ? { type, value: undefined }
                            : { type, value: Number(tier.discount.value) || 0 },
                        );
                      }}
                    >
                      <option value="NONE">Standard price</option>
                      <option value="PERCENTAGE">Percentage off</option>
                      <option value="FIXED_PER_ITEM">Fixed amount off each item</option>
                    </select>
                  </label>

                  {tier.discount.type !== "NONE" ? (
                    <label>
                      Discount value
                      <input
                        type="number"
                        min="0"
                        step={tier.discount.type === "PERCENTAGE" ? "1" : "0.01"}
                        value={tier.discount.value ?? 0}
                        onChange={(event) =>
                          patchDiscount(index, {
                            value: Number(event.currentTarget.value),
                          })
                        }
                      />
                    </label>
                  ) : null}

                  {rule.tiers.length > 1 ? (
                    <s-button type="button" onClick={() => deleteTier(index)}>
                      Remove tier
                    </s-button>
                  ) : null}
                </s-stack>
              </s-box>
            ))}

            <s-button type="button" onClick={appendTier}>
              Add tier
            </s-button>
          </s-stack>
        </s-section>

        <s-section heading="Customer display">
          <s-stack direction="block" gap="base">
            <label>
              Block title
              <input
                value={rule.display?.blockTitle || ""}
                onChange={(event) =>
                  patchRule({
                    display: {
                      ...rule.display,
                      blockTitle: event.currentTarget.value,
                    },
                  })
                }
              />
            </label>

            <label>
              Badge
              <input
                value={rule.display?.badge || ""}
                onChange={(event) =>
                  patchRule({
                    display: {
                      ...rule.display,
                      badge: event.currentTarget.value,
                    },
                  })
                }
              />
            </label>
          </s-stack>
        </s-section>

        <s-section>
          <s-stack direction="inline" gap="base">
            <s-button type="submit" variant="primary">
              Save rule
            </s-button>
            <Link to="/app">Cancel</Link>
          </s-stack>
        </s-section>
      </Form>

      {!isNew ? (
        <s-section heading="Danger zone">
          <Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <s-button type="submit" tone="critical">
              Delete rule
            </s-button>
          </Form>
        </s-section>
      ) : null}
    </s-page>
  );
}
