const TARGET_PICKER = Object.freeze({
  PRODUCT: { resourceType: "product", multiple: false, gidPrefix: "gid://shopify/Product/" },
  PRODUCTS: { resourceType: "product", multiple: true, gidPrefix: "gid://shopify/Product/" },
  VARIANTS: { resourceType: "variant", multiple: true, gidPrefix: "gid://shopify/ProductVariant/" },
  COLLECTIONS: { resourceType: "collection", multiple: true, gidPrefix: "gid://shopify/Collection/" },
});

export function pickerOptionsForTarget(targetType, currentIds = []) {
  const definition = TARGET_PICKER[targetType];
  if (!definition) throw new Error(`unsupported target type: ${String(targetType)}`);

  const selectionIds = currentIds.map((id) => ({ id }));

  return {
    type: definition.resourceType,
    action: currentIds.length ? "select" : "add",
    multiple: definition.multiple,
    selectionIds,
  };
}

function selectionId(item) {
  if (typeof item?.id === "string") return item.id;
  return null;
}

export function pickerSelectionToTarget(targetType, selection) {
  const definition = TARGET_PICKER[targetType];
  if (!definition) throw new Error(`unsupported target type: ${String(targetType)}`);
  if (!Array.isArray(selection)) throw new Error("resource picker selection must be an array");

  const ids = selection
    .map(selectionId)
    .filter(Boolean);

  if (targetType === "PRODUCT" && ids.length !== 1) {
    throw new Error("single-product target requires exactly one selected product");
  }
  if (targetType !== "PRODUCT" && ids.length < 1) {
    throw new Error(`${targetType} target requires at least one selected resource`);
  }

  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) {
    throw new Error("resource picker returned duplicate resource ids");
  }

  for (const id of unique) {
    if (!id.startsWith(definition.gidPrefix)) {
      throw new Error(`resource id does not match ${targetType}: ${id}`);
    }
  }

  return {
    type: targetType,
    ids: unique,
  };
}

export function pickerLabelForTarget(targetType, count) {
  const singular = {
    PRODUCT: "product",
    PRODUCTS: "product",
    VARIANTS: "variant",
    COLLECTIONS: "collection",
  }[targetType];

  if (!singular) throw new Error(`unsupported target type: ${String(targetType)}`);
  return `${count} ${singular}${count === 1 ? "" : "s"} selected`;
}
