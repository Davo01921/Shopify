(() => {
  const quantityLabel = (tier) => tier.max == null ? `${tier.min}+` : tier.min === tier.max ? `${tier.min}` : `${tier.min}–${tier.max}`;
  const discountLabel = (tier, currency) => {
    if (tier.message) return tier.message;
    if (tier.discount.type === "NONE") return "Standard price";
    if (tier.discount.type === "PERCENTAGE") return `Save ${Number(tier.discount.value)}%`;
    const value = new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(tier.discount.value));
    return `Save ${value} each`;
  };

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  function render(block, pricing) {
    const content = block.querySelector(".nta-bulk-pricing__content");
    content.replaceChildren();
    if (!pricing?.tiers?.length) {
      block.hidden = true;
      return;
    }

    content.append(element("h3", "nta-bulk-pricing__heading", block.dataset.heading || "Bulk pricing"));
    if (block.dataset.showRuleName === "true") content.append(element("p", "nta-bulk-pricing__rule-name", pricing.rule.title));
    const table = element("table", "nta-bulk-pricing__table");
    const thead = document.createElement("thead");
    const headingRow = document.createElement("tr");
    headingRow.append(element("th", "", "Quantity"), element("th", "", "Price benefit"));
    thead.append(headingRow);
    table.append(thead);
    const tbody = document.createElement("tbody");
    pricing.tiers.forEach((tier) => {
      const row = document.createElement("tr");
      row.append(element("td", "", quantityLabel(tier)), element("td", "", discountLabel(tier, block.dataset.currency || "AUD")));
      tbody.append(row);
    });
    table.append(tbody);
    content.append(table);
    block.hidden = false;
  }

  function init(block) {
    let controller;
    const load = async (variantId = block.dataset.variantId) => {
      controller?.abort();
      controller = new AbortController();
      const url = new URL(block.dataset.endpoint, window.location.origin);
      url.searchParams.set("product_id", block.dataset.productId || "");
      url.searchParams.set("variant_id", variantId || "");
      url.searchParams.set("collection_ids", block.dataset.collectionIds || "");
      try {
        const response = await fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" }, signal: controller.signal });
        if (!response.ok) throw new Error(`Pricing request failed: ${response.status}`);
        render(block, (await response.json()).pricing);
      } catch (error) {
        if (error.name !== "AbortError") block.hidden = true;
      }
    };

    document.addEventListener("change", (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        if (event.target.name === "id") load(event.target.value);
      }
    });
    document.addEventListener("variant:change", (event) => load(event.detail?.variant?.id));
    load();
  }

  document.querySelectorAll("[data-nta-bulk-pricing]").forEach(init);
})();
