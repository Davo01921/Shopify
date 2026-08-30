#!/usr/bin/env python3
"""Scrape DALUA Wholesale product data into CSV/JSON.

Discovery is sitemap based so it does not depend on the site's product-table
pagination. DALUA displayed wholesale prices are confirmed ex-GST; GST-inclusive
values are therefore calculated at 10%.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import threading
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE = "https://daluawholesale.com.au"
UA = "Mozilla/5.0 (compatible; NTA-DALUA-Catalog/1.0; +catalog-audit)"
MONEY = re.compile(r"([0-9]+(?:\.[0-9]{1,2})?)")
_thread_local = threading.local()

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
    checked_at_utc: str = ""
    scrape_status: str = "ok"


def new_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Accept-Language": "en-AU,en;q=0.9"})
    return s


def worker_session() -> requests.Session:
    s = getattr(_thread_local, "session", None)
    if s is None:
        s = new_session()
        _thread_local.session = s
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


def get(session: requests.Session, url: str, retries: int = 4) -> requests.Response:
    last = None
    for attempt in range(retries):
        try:
            r = session.get(url, timeout=30, allow_redirects=True)
            r.raise_for_status()
            return r
        except requests.RequestException as e:
            last = e
            time.sleep(2 ** attempt)
    raise RuntimeError(f"GET failed {url}: {last}")


def xml_locs(text: str) -> list[str]:
    root = ET.fromstring(text)
    return [e.text.strip() for e in root.iter() if e.tag.endswith("loc") and e.text]


def discover(session: requests.Session) -> list[str]:
    candidates = [f"{BASE}/wp-sitemap.xml", f"{BASE}/sitemap_index.xml"]
    product_maps: set[str] = set()
    for index in candidates:
        try:
            locs = xml_locs(get(session, index).text)
        except Exception:
            continue
        for loc in locs:
            low = loc.lower()
            if "product" in low and ("sitemap" in low or low.endswith(".xml")):
                product_maps.add(loc)
    urls: set[str] = set()
    for sm in sorted(product_maps):
        try:
            for loc in xml_locs(get(session, sm).text):
                p = urlparse(loc)
                if p.netloc.endswith("daluawholesale.com.au") and "/product/" in p.path:
                    urls.add(loc)
        except Exception as e:
            print(f"WARN sitemap {sm}: {e}")
    if not urls:
        raise RuntimeError("No DALUA product URLs discovered from sitemaps")
    return sorted(urls)


def meta(soup: BeautifulSoup, prop: str) -> str:
    node = soup.find("meta", attrs={"property": prop}) or soup.find("meta", attrs={"name": prop})
    return (node.get("content") or "").strip() if node else ""


def scrape_product(session: requests.Session, url: str) -> Product:
    from datetime import datetime, timezone
    p = Product(product_page_url=url, checked_at_utc=datetime.now(timezone.utc).isoformat())
    try:
        soup = BeautifulSoup(get(session, url).text, "lxml")
        title = soup.select_one("h1.product_title") or soup.select_one("h1")
        p.title = title.get_text(" ", strip=True) if title else meta(soup, "og:title")
        desc = soup.select_one(".woocommerce-Tabs-panel--description") or soup.select_one("#tab-description") or soup.select_one(".woocommerce-product-details__short-description")
        p.description = desc.get_text(" ", strip=True) if desc else meta(soup, "og:description")

        price_box = soup.select_one(".summary .price") or soup.select_one("p.price")
        regular = sale = None
        if price_box:
            del_node = price_box.select_one("del")
            ins_node = price_box.select_one("ins")
            if del_node and ins_node:
                regular = money(del_node.get_text(" ", strip=True))
                sale = money(ins_node.get_text(" ", strip=True))
            else:
                regular = money(price_box.get_text(" ", strip=True))
        if regular is None:
            regular = money(meta(soup, "product:price:amount"))
        if sale is not None and regular is not None and sale >= regular:
            sale = None

        p.regular_cost_ex_gst, p.regular_cost_plus_gst = fmt(regular), fmt(gst(regular))
        p.markdown_cost_ex_gst, p.markdown_cost_plus_gst = fmt(sale), fmt(gst(sale))
        if regular and sale and regular > 0:
            p.markdown_percent = fmt((regular-sale) / regular * Decimal("100"))

        stock = soup.select_one(".stock")
        p.stock_availability = stock.get_text(" ", strip=True) if stock else ""

        imgs: list[str] = []
        og = meta(soup, "og:image")
        if og:
            imgs.append(urljoin(url, og))
        for a in soup.select(".woocommerce-product-gallery__image a[href]"):
            u = urljoin(url, a.get("href", ""))
            if u and u not in imgs:
                imgs.append(u)
        for img in soup.select(".woocommerce-product-gallery img"):
            u = img.get("data-large_image") or img.get("src")
            if u:
                u = urljoin(url, u)
                if u not in imgs:
                    imgs.append(u)
        if imgs:
            p.primary_image_url = imgs[0]
            p.additional_image_urls = " | ".join(imgs[1:])
    except Exception as e:
        p.scrape_status = f"error: {e}"
    return p


def scrape_url(url: str) -> Product:
    return scrape_product(worker_session(), url)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output-dir", default="dalua_scraper/output")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=6, help="Bounded concurrent requests; keep modest to avoid stressing supplier site")
    args = ap.parse_args()
    if args.workers < 1 or args.workers > 10:
        ap.error("--workers must be between 1 and 10")

    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    urls = discover(new_session())
    if args.limit:
        urls = urls[:args.limit]
    print(f"Discovered {len(urls)} products; scraping with {args.workers} workers")

    by_url: dict[str, Product] = {}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(scrape_url, url): url for url in urls}
        completed = 0
        for future in as_completed(futures):
            url = futures[future]
            try:
                p = future.result()
            except Exception as e:
                p = Product(product_page_url=url, scrape_status=f"error: {e}")
            by_url[url] = p
            completed += 1
            print(f"[{completed}/{len(urls)}] {p.scrape_status}: {p.title or url}")

    products = [by_url[url] for url in urls]
    rows = [asdict(p) for p in products]
    fields = list(Product.__dataclass_fields__)
    with (out / "dalua_catalog.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    (out / "dalua_catalog.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    summary = {
        "discovered": len(urls),
        "scraped_ok": sum(p.scrape_status == "ok" for p in products),
        "errors": sum(p.scrape_status != "ok" for p in products),
        "with_images": sum(bool(p.primary_image_url) for p in products),
        "with_markdown": sum(bool(p.markdown_cost_plus_gst) for p in products),
        "prices_ex_gst_confirmed": True,
        "gst_rate": "10%",
        "workers": args.workers,
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 1 if summary["errors"] else 0

if __name__ == "__main__":
    raise SystemExit(main())
