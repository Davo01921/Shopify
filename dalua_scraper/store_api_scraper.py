#!/usr/bin/env python3
"""Scrape DALUA catalogue through WooCommerce's public Store API.

The DALUA product-table paginator currently links pages 2+ back to page 1. The
Store API is a first-party WooCommerce public catalogue endpoint and, when
available, avoids that broken presentation layer. Prices are cross-checked
against the first public table page before the full export is accepted.
"""
from __future__ import annotations

import csv
import json
import re
from dataclasses import asdict
from decimal import Decimal
from pathlib import Path

from bs4 import BeautifulSoup
import requests

import scrape_dalua as core

API = f"{core.BASE}/wp-json/wc/store/v1/products"


def plain(html: str | None) -> str:
    return BeautifulSoup(html or "", "lxml").get_text(" ", strip=True)


def decimal_price(raw: str | int | None, minor_unit: int) -> Decimal | None:
    if raw in (None, ""):
        return None
    try:
        return Decimal(str(raw)) / (Decimal(10) ** minor_unit)
    except Exception:
        return None


def api_product(item: dict) -> core.Product:
    from datetime import datetime, timezone
    prices = item.get("prices") or {}
    minor = int(prices.get("currency_minor_unit", 2) or 2)
    regular = decimal_price(prices.get("regular_price"), minor)
    sale = decimal_price(prices.get("sale_price"), minor)
    current = decimal_price(prices.get("price"), minor)

    # If Woo reports no distinct regular price, use current. Only populate
    # markdown when sale is genuinely below regular.
    if regular is None:
        regular = current
    if sale is None or regular is None or sale >= regular:
        sale = None

    images = [str(x.get("src", "")).strip() for x in (item.get("images") or []) if x.get("src")]
    stock_status = str(item.get("stock_status") or "").replace("instock", "In stock").replace("outofstock", "Out of stock").replace("onbackorder", "On backorder")

    p = core.Product(
        title=str(item.get("name") or "").strip(),
        description=plain(item.get("short_description") or item.get("description")),
        regular_cost_ex_gst=core.fmt(regular),
        regular_cost_plus_gst=core.fmt(core.gst(regular)),
        markdown_cost_ex_gst=core.fmt(sale),
        markdown_cost_plus_gst=core.fmt(core.gst(sale)),
        stock_availability=stock_status,
        product_page_url=str(item.get("permalink") or "").strip(),
        primary_image_url=images[0] if images else "",
        additional_image_urls=" | ".join(images[1:]),
        source_table_page=API,
        checked_at_utc=datetime.now(timezone.utc).isoformat(),
    )
    if regular and sale and regular > 0:
        p.markdown_percent = core.fmt((regular - sale) / regular * Decimal("100"))
    return p


def fetch_all(session: requests.Session) -> list[core.Product]:
    products: list[core.Product] = []
    page = 1
    while True:
        r = session.get(API, params={"per_page": 100, "page": page}, timeout=45)
        if r.status_code >= 400:
            raise RuntimeError(f"Store API HTTP {r.status_code}: {r.text[:500]!r}")
        items = r.json()
        if not isinstance(items, list):
            raise RuntimeError(f"Store API returned unexpected payload: {str(items)[:500]}")
        if not items:
            break
        products.extend(api_product(x) for x in items)
        print(f"Store API page {page}: {len(items)} products; cumulative={len(products)}")
        total_pages = int(r.headers.get("X-WP-TotalPages", "0") or 0)
        if total_pages and page >= total_pages:
            break
        if len(items) < 100 and not total_pages:
            break
        page += 1
        if page > 100:
            raise RuntimeError("Store API pagination safety limit exceeded")
    return products


def first_table_prices(session: requests.Session) -> dict[str, str]:
    html = session.get(core.TABLE_URL, timeout=45).text
    rows = core.parse_page(html, core.TABLE_URL)
    return {re.sub(r"\s+", " ", p.title).strip().casefold(): p.regular_cost_ex_gst for p in rows if p.title and p.regular_cost_ex_gst}


def validate_price_source(products: list[core.Product], table_prices: dict[str, str]) -> dict:
    api_by_title = {re.sub(r"\s+", " ", p.title).strip().casefold(): p for p in products}
    compared = 0
    matches = 0
    mismatches = []
    for title, table_price in table_prices.items():
        p = api_by_title.get(title)
        if not p or not p.regular_cost_ex_gst:
            continue
        compared += 1
        if p.regular_cost_ex_gst == table_price:
            matches += 1
        else:
            mismatches.append({"title": p.title, "table": table_price, "api": p.regular_cost_ex_gst})
    if compared < 5:
        raise RuntimeError(f"Could only cross-check {compared} DALUA prices between Store API and public table")
    if matches != compared:
        raise RuntimeError(f"Store API price source does not match DALUA wholesale table: {mismatches[:10]}")
    return {"price_crosscheck_compared": compared, "price_crosscheck_matches": matches}


def main() -> int:
    out = Path("dalua_scraper/output")
    out.mkdir(parents=True, exist_ok=True)
    session = core.session()
    products = fetch_all(session)
    if len(products) < 100:
        raise RuntimeError(f"Store API catalogue unexpectedly small: {len(products)}")

    crosscheck = validate_price_source(products, first_table_prices(session))
    rows = [asdict(p) for p in products]
    fields = list(core.Product.__dataclass_fields__)
    with (out / "dalua_catalog.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader(); w.writerows(rows)
    (out / "dalua_catalog.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = {
        "products": len(products),
        "with_descriptions": sum(bool(p.description) for p in products),
        "with_images": sum(bool(p.primary_image_url) for p in products),
        "with_product_urls": sum(bool(p.product_page_url) for p in products),
        "with_markdown": sum(bool(p.markdown_cost_plus_gst) for p in products),
        "with_stock_status": sum(bool(p.stock_availability) for p in products),
        "prices_ex_gst_confirmed": True,
        "gst_rate": "10%",
        "source": API,
        **crosscheck,
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
