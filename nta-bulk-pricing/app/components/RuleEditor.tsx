import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

type Tier = { minimum: number; maximum: number | null; title: string; discountType: string; discountValue: number | null; message: string };
type Initial = { title?: string; enabled?: boolean; priority?: number; targetType?: string; targetIds?: string[]; internalNotes?: string; startsAt?: string | null; endsAt?: string | null; tiers?: Tier[] };

const emptyTier = (): Tier => ({ minimum: 1, maximum: null, title: "", discountType: "PERCENTAGE", discountValue: 0, message: "" });
const inputStyle = { width: "100%", padding: "8px", border: "1px solid #bbb", borderRadius: "6px", boxSizing: "border-box" as const };
const grid = { display: "grid", gap: "12px" };

export function RuleEditor({ initial = {}, submitLabel = "Save rule" }: { initial?: Initial; submitLabel?: string }) {
  const shopify = useAppBridge();
  const navigation = useNavigation();
  const [targetType, setTargetType] = useState(initial.targetType ?? "PRODUCTS");
  const [targets, setTargets] = useState(initial.targetIds ?? []);
  const [tiers, setTiers] = useState<Tier[]>(initial.tiers?.length ? initial.tiers : [emptyTier()]);

  async function chooseTargets() {
    const type = targetType === "COLLECTIONS" ? "collection" : "product";
    const selection = await shopify.resourcePicker({ type, multiple: targetType !== "PRODUCT" });
    if (!selection) return;
    const selected = selection as unknown as Array<{ id: string; variants?: Array<{ id: string }> }>;
    const ids = selected.flatMap((item) => targetType === "VARIANTS"
      ? (item.variants ?? []).map((variant) => variant.id)
      : [item.id]);
    setTargets(targetType === "PRODUCT" ? ids.slice(0, 1) : ids);
  }
  const patchTier = (index: number, patch: Partial<Tier>) => setTiers((items) => items.map((tier, i) => i === index ? { ...tier, ...patch } : tier));

  return <Form method="post" style={{ ...grid, maxWidth: "920px" }}>
    <label>Rule name<input style={inputStyle} name="title" required defaultValue={initial.title ?? ""} /></label>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
      <label>Priority<input style={inputStyle} name="priority" type="number" step="1" defaultValue={initial.priority ?? 0} /></label>
      <label>Scope<select style={inputStyle} name="targetType" value={targetType} onChange={(event) => { setTargetType(event.target.value); setTargets([]); }}>
        <option value="PRODUCT">One product</option><option value="PRODUCTS">Selected products</option>
        <option value="VARIANTS">Selected variants</option><option value="COLLECTIONS">Selected collections</option>
      </select></label>
    </div>
    <div><button type="button" onClick={chooseTargets}>Choose {targetType === "COLLECTIONS" ? "collections" : "products"}</button>
      <span style={{ marginLeft: "12px" }}>{targets.length ? `${targets.length} selected` : "Nothing selected"}</span></div>
    <input type="hidden" name="targetIds" value={targets.join("\n")} />
    <label><input name="enabled" type="checkbox" defaultChecked={initial.enabled ?? true} /> Enabled</label>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
      <label>Starts (optional)<input style={inputStyle} name="startsAt" type="datetime-local" defaultValue={initial.startsAt ?? ""} /></label>
      <label>Ends (optional)<input style={inputStyle} name="endsAt" type="datetime-local" defaultValue={initial.endsAt ?? ""} /></label>
    </div>
    <h2>Quantity tiers</h2>
    {tiers.map((tier, index) => <fieldset key={index} style={{ ...grid, border: "1px solid #ddd", borderRadius: "8px", padding: "12px" }}>
      <legend>Tier {index + 1}</legend>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
        <label>Minimum<input style={inputStyle} type="number" min="1" value={tier.minimum} onChange={(e) => patchTier(index, { minimum: Number(e.target.value) })} /></label>
        <label>Maximum<input style={inputStyle} type="number" min="1" value={tier.maximum ?? ""} onChange={(e) => patchTier(index, { maximum: e.target.value ? Number(e.target.value) : null })} /></label>
        <label>Discount<select style={inputStyle} value={tier.discountType} onChange={(e) => patchTier(index, { discountType: e.target.value, discountValue: e.target.value === "NONE" ? null : 0 })}>
          <option value="NONE">Standard price</option><option value="PERCENTAGE">Percentage</option><option value="FIXED_PER_ITEM">Fixed per item</option>
        </select></label>
        <label>Value<input style={inputStyle} type="number" min="0" step="0.01" disabled={tier.discountType === "NONE"} value={tier.discountValue ?? ""} onChange={(e) => patchTier(index, { discountValue: Number(e.target.value) })} /></label>
      </div>
      <label>Customer message<input style={inputStyle} value={tier.message} onChange={(e) => patchTier(index, { message: e.target.value })} /></label>
      <button type="button" disabled={tiers.length === 1} onClick={() => setTiers((items) => items.filter((_, i) => i !== index))}>Remove tier</button>
    </fieldset>)}
    <input type="hidden" name="tiers" value={JSON.stringify(tiers)} />
    <button type="button" onClick={() => setTiers((items) => [...items, { ...emptyTier(), minimum: Math.max(...items.map((tier) => tier.maximum ?? tier.minimum)) + 1 }])}>Add tier</button>
    <label>Internal notes<textarea style={inputStyle} name="internalNotes" rows={4} defaultValue={initial.internalNotes ?? ""} /></label>
    <button type="submit" disabled={navigation.state !== "idle"}>{navigation.state === "idle" ? submitLabel : "Saving…"}</button>
  </Form>;
}
