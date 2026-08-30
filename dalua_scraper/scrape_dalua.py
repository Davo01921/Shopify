#!/usr/bin/env python3
"""Scrape DALUA Wholesale's public product table into CSV/JSON.

DALUA individual product pages redirect anonymous visitors to My Account, while
its wholesale product table is public. This scraper therefore treats the table
as the authoritative public scrape source. DALUA displayed prices are confirmed
ex-GST and GST-inclusive values are calculated at 10%.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import time
from dataclasses import asdict, dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag

BASE = "https://daluawholesale.com.au"
TABLE_URL = f"{BASE}/wpt_product_table/shop/"
UA = "Mozilla/5.0 (compatible; NTA-DALUA-Catalog/1.1; +catalog-audit)"
MONEY = re.compile(r"([0-9]+(?:\.[0-9]{1,2})?)")
STOCK = re.compile(r"(?:(\d+)\s+in stock|out of stock)", re.I)
PAGE = re.compile(r"/page/(\d+)/?", re.I)

@dataclass
class Product:
    title: str = ""
    description: str = ""
    regular_cost_ex_gst: str = ""
    regular_cost_plus_gst: str = ""
    markdown_cost_ex_gst: str = ""
    markdown_cost_plus_gst: str = ""
    markdown_percent: str = ""
    stock_availability: str = ""
    product_page_url: str = ""
    primary_image_url: str = ""
    additional_image_urls: str = ""
    source_table_page: str = ""
    checked_at_utc: str = ""
    scrape_status: str = "ok"


def session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Accept-Language": "en-AU,en;q=0.9"})
    return s


def money(text: str | None) -> Decimal | None:
    if not text:
        return None
    m = MONEY.search(text.replace(",", ""))
    if not m:
        return None
    try:
        return Decimal(m.group(1))
    except InvalidOperation:
        return None


def fmt(v: Decimal | None) -> str:
    return "" if v is None else str(v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def gst(v: Decimal | None) -> Decimal | None:
    return None if v is None else v * Decimal("1.10")


def get(s: requests.Session, url: str, retries: int = 4) -> requests.Response:
    last = None
    for attempt in range(retries):
        try:
            r = s.get(url, timeout=30, allow_redirects=True)
            r.raise_for_status()
            return r
        except requests.RequestException as e:
            last = e
            time.sleep(2 ** attempt)
    raise RuntimeError(f"GET failed {url}: {last}")


def classes(node: Tag) -> str:
    return " ".join(node.get("class", []))


def find_cell(row: Tag, keyword: str) -> Tag | None:
    keyword = keyword.lower()
    for cell in row.find_all(["td", "div"], recursive=True):
        c = classes(cell).lower()
        if keyword in c:
            return cell
    return None


def image_url(row: Tag, page_url: str) -> str:
    img = row.find("img")
    if not img:
        return ""
    raw = (
        img.get("data-large_image")
        or img.get("data-src")
        or img.get("data-lazy-src")
        or img.get("src")
        or ""
    )
    return urljoin(page_url, raw.strip()) if raw else ""


def product_link(row: Tag, page_url: str) -> str:
    for a in row.find_all("a", href=True):
        href = urljoin(page_url, a["href"])
        p = urlparse(href)
        if p.netloc.endswith("daluawholesale.com.au") and "/product/" in p.path:
            return href
    return ""


def title_text(row: Tag) -> str:
    cell = find_cell(row, "product_title") or find_cell(row, "title")
    if cell:
        # Prefer a product anchor/title element over all cell text because the
        # same cell may also include the description.
        for sel in ("a", "h2", "h3", "strong"):
            node = cell.find(sel)
            if node:
                text = node.get_text(" ", strip=True)
                if text:
                    return text
    img = row.find("img")
    if img and img.get("alt"):
        return img.get("alt", "").strip()
    return ""


def description_text(row: Tag, title: str) -> str:
    for key in ("description", "short_description", "product_description"):
        cell = find_cell(row, key)
        if cell:
            text = cell.get_text(" ", strip=True)
            if text and text != title:
                return text
    # DALUA's table can place title + short description in the Products cell.
    cell = find_cell(row, "product_title") or find_cell(row, "title")
    if cell:
        parts = [x.strip() for x in cell.stripped_strings if x.strip()]
        cleaned = []
        title_seen = False
        for part in parts:
            if not title_seen and part == title:
                title_seen = True
                continue
            if title_seen and part != title:
                cleaned.append(part)
        if cleaned:
            return " ".join(cleaned)
    return ""


def parse_prices(row: Tag) -> tuple[Decimal | None, Decimal | None]:
    cell = find_cell(row, "price") or row
    del_node = cell.find("del")
    ins_node = cell.find("ins")
    regular = sale = None
    if del_node and ins_node:
        regular = money(del_node.get_text(" ", strip=True))
        sale = money(ins_node.get_text(" ", strip=True))
    else:
        # Some WPT themes render original/current prices without <ins>.
        text = cell.get_text(" ", strip=True)
        values = [Decimal(v) for v in MONEY.findall(text.replace(",", ""))]
        if values:
            regular = values[0]
            if len(values) > 1 and values[-1] < regular:
                sale = values[-1]
    # DALUA often renders identical crossed-out and current prices. That is not
    # a real markdown and must not populate markdown fields.
    if regular is not None and sale is not None and sale >= regular:
        sale = None
    return regular, sale


def stock_text(row: Tag) -> str:
    text = row.get_text(" ", strip=True)
    m = STOCK.search(text)
    if not m:
        return ""
    return f"{m.group(1)} in stock" if m.group(1) else "Out of stock"


def candidate_rows(soup: BeautifulSoup) -> list[Tag]:
    rows = []
    for row in soup.find_all("tr"):
        if row.find("img") and (find_cell(row, "price") or "$" in row.get_text(" ", strip=True)):
            rows.append(row)
    return rows


def parse_page(html: str, page_url: str) -> list[Product]:
    from datetime import datetime, timezone
    soup = BeautifulSoup(html, "lxml")
    products: list[Product] = []
    for row in candidate_rows(soup):
        title = title_text(row)
        regular, sale = parse_prices(row)
        if not title or regular is None:
            continue
        p = Product(
            title=title,
            description=description_text(row, title),
            regular_cost_ex_gst=fmt(regular),
            regular_cost_plus_gst=fmt(gst(regular)),
            markdown_cost_ex_gst=fmt(sale),
            markdown_cost_plus_gst=fmt(gst(sale)),
            stock_availability=stock_text(row),
            product_page_url=product_link(row, page_url),
            primary_image_url=image_url(row, page_url),
            source_table_page=page_url,
            checked_at_utc=datetime.now(timezone.utc).isoformat(),
        )
        if regular and sale and regular > 0:
            p.markdown_percent = fmt((regular - sale) / regular * Decimal("100"))
        products.append(p)
    return products


def page_count(html: str) -> int:
    soup = BeautifulSoup(html, "lxml")
    pages = [1]
    for a in soup.find_all("a", href=True):
        m = PAGE.search(a["href"])
        if m:
            pages.append(int(m.group(1)))
        txt = a.get_text(" ", strip=True)
        if txt.isdigit():
            pages.append(int(txt))
    return max(pages)


def signature(products: list[Product]) -> tuple[str, ...]:
    return tuple(p.title for p in products[:5])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output-dir", default="dalua_scraper/output")
    ap.add_argument("--max-pages", type=int, default=0, help="Diagnostic cap; 0 means all discovered pages")
    args = ap.parse_args()

    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    s = session()

    first = get(s, TABLE_URL)
    total_pages = page_count(first.text)
    if args.max_pages:
        total_pages = min(total_pages, args.max_pages)
    print(f"DALUA table reports {total_pages} pages")

    products: list[Product] = []
    seen_signatures: dict[tuple[str, ...], int] = {}
    pages_with_rows = 0
    for n in range(1, total_pages + 1):
        url = TABLE_URL if n == 1 else urljoin(TABLE_URL, f"page/{n}/")
        r = first if n == 1 else get(s, url)
        page_products = parse_page(r.text, url)
        sig = signature(page_products)
        if page_products:
            pages_with_rows += 1
        if sig and sig in seen_signatures:
            prev = seen_signatures[sig]
            raise RuntimeError(f"Pagination duplicated page {prev} when requesting page {n}; requested={url} final={r.url}")
        if sig:
            seen_signatures[sig] = n
        products.extend(page_products)
        print(f"Page {n}/{total_pages}: {len(page_products)} products; final URL {r.url}")

    # Deduplicate defensively by product URL when available, otherwise title+cost+image.
    unique: dict[tuple[str, ...], Product] = {}
    for p in products:
        key = (p.product_page_url,) if p.product_page_url else (p.title, p.regular_cost_ex_gst, p.primary_image_url)
        unique[key] = p
    products = list(unique.values())

    rows = [asdict(p) for p in products]
    fields = list(Product.__dataclass_fields__)
    with (out / "dalua_catalog.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    (out / "dalua_catalog.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = {
        "table_pages_reported": total_pages,
        "pages_with_rows": pages_with_rows,
        "products": len(products),
        "with_descriptions": sum(bool(p.description) for p in products),
        "with_images": sum(bool(p.primary_image_url) for p in products),
        "with_product_urls": sum(bool(p.product_page_url) for p in products),
        "with_markdown": sum(bool(p.markdown_cost_plus_gst) for p in products),
        "with_stock_status": sum(bool(p.stock_availability) for p in products),
        "prices_ex_gst_confirmed": True,
        "gst_rate": "10%",
        "source": TABLE_URL,
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
