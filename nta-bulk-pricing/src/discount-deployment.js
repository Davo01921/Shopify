import { createHash } from "node:crypto";

export const DISCOUNT_TITLE = "NTA Bulk Pricing";
export const FUNCTION_HANDLE = "nta-bulk-pricing-discount";
export const CONFIGURATION_NAMESPACE = "$app:nta-bulk-pricing";
export const CONFIGURATION_KEY = "function-configuration";

export function serializeConfiguration(configuration) {
  return JSON.stringify(configuration);
}

export function configurationHash(configuration) {
  return createHash("sha256").update(serializeConfiguration(configuration)).digest("hex");
}

export function automaticDiscountInput(configuration, startsAt) {
  return {
    title: DISCOUNT_TITLE,
    functionHandle: FUNCTION_HANDLE,
    discountClasses: ["PRODUCT"],
    startsAt,
    combinesWith: {
      orderDiscounts: false,
      productDiscounts: false,
      shippingDiscounts: false,
    },
    metafields: [{
      namespace: CONFIGURATION_NAMESPACE,
      key: CONFIGURATION_KEY,
      type: "json",
      value: serializeConfiguration(configuration),
    }],
  };
}

export function mutationDiscount(payload, operation) {
  const result = payload?.data?.[operation];
  const errors = [
    ...(payload?.errors ?? []).map((error) => error.message),
    ...(result?.userErrors ?? []).map((error) => {
      const field = error.field?.length ? `${error.field.join(".")}: ` : "";
      return `${field}${error.message}`;
    }),
  ];
  if (errors.length) throw new Error(errors.join("; "));
  const discount = result?.automaticAppDiscount;
  if (!discount?.discountId) throw new Error("Shopify did not return the automatic discount ID.");
  return discount;
}
