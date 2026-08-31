#!/usr/bin/env python3
"""Scrape DALUA's public Woo Product Table through a real browser."""
from __future__ import annotations

import csv
import json
import re
from dataclasses import asdict
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright

import scrape_dalua as core


def numeric_page_count(page) -> int:
    texts = page.locator('.wpt_table_pagination a, .wpt_table_pagination span').all_inner_texts()
    nums = []
    for text in texts:
        m = re.search(r'\b(\d+)\b', text.strip())
        if m:
            nums.append(int(m.group(1)))
    return max(nums) if nums else 1


def current_signature(page) -> str:
    rows = page.locator('table#wpt_table tbody tr')
    if rows.count() == 0:
        return ''
    return rows.first.inner_text()[:300]


def pagination_debug(page) -> dict:
    return page.evaluate("""() => ({
      tableDataJson: document.querySelector('table#wpt_table')?.getAttribute('data-data_json'),
      tableDataJsonBackup: document.querySelector('table#wpt_table')?.getAttribute('data-data_json_backup'),
      wrapperPage: document.querySelector('.wpt_product_table_wrapper')?.getAttribute('data-page_number'),
      pagination: Array.from(document.querySelectorAll('.wpt_table_pagination a, .wpt_table_pagination span')).map(el => ({
        tag: el.tagName, text: el.innerText.trim(), href: el.getAttribute('href'), cls: el.className,
        page: el.getAttribute('data-page_number'), outer: el.outerHTML.slice(0,600)
      }))
    })""")


def click_page(page, target: int, old_signature: str) -> None:
    links = page.locator('.wpt_table_pagination a')
    chosen = None
    for i in range(links.count()):
        link = links.nth(i)
        text = link.inner_text().strip()
        data_page = link.get_attribute('data-page_number') or link.get_attribute('data-page') or ''
        href = link.get_attribute('href') or ''
        if text == str(target) or data_page == str(target) or f'/page/{target}/' in href:
            chosen = link
            break
    if chosen is None:
        next_link = page.locator('.wpt_table_pagination a.next')
        if next_link.count() == 0:
            raise RuntimeError(f'No pagination control found for target page {target}; debug={json.dumps(pagination_debug(page))}')
        chosen = next_link.first

    print(f'CLICK target={target} html={chosen.evaluate("el => el.outerHTML")}')
    chosen.evaluate('el => el.click()')
    try:
        page.wait_for_function(
            "old => { const r=document.querySelector('table#wpt_table tbody tr'); return r && r.innerText.slice(0,300)!==old; }",
            arg=old_signature,
            timeout=7000,
        )
    except PlaywrightTimeoutError as exc:
        raise RuntimeError(f'Pagination did not change for page {target}; debug={json.dumps(pagination_debug(page))}') from exc
    page.wait_for_timeout(250)


def main() -> int:
    out = Path('dalua_scraper/output')
    out.mkdir(parents=True, exist_ok=True)

    products = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        context = browser.new_context(locale='en-AU', user_agent=core.UA)
        page = context.new_page()
        page.goto(core.TABLE_URL, wait_until='domcontentloaded', timeout=60000)
        page.wait_for_selector('table#wpt_table tbody tr', timeout=30000)
        page.wait_for_timeout(1500)

        total_pages = numeric_page_count(page)
        if total_pages < 40:
            raise RuntimeError(f'DALUA rendered paginator unexpectedly reports only {total_pages} pages; debug={json.dumps(pagination_debug(page))}')
        print(f'DALUA rendered table reports {total_pages} pages')
        print('INITIAL_PAGINATION_DEBUG=' + json.dumps(pagination_debug(page)))

        seen_signatures: set[str] = set()
        for n in range(1, total_pages + 1):
            sig = current_signature(page)
            if not sig:
                raise RuntimeError(f'No rendered product rows on page {n}')
            if sig in seen_signatures:
                raise RuntimeError(f'Rendered pagination duplicated catalogue content on page {n}')
            seen_signatures.add(sig)

            table_html = page.locator('table#wpt_table').evaluate('(el) => el.outerHTML')
            parsed = core.parse_page(table_html, f'{core.TABLE_URL}?rendered_page={n}')
            if not parsed:
                raise RuntimeError(f'Parser found zero products on rendered page {n}')
            products.extend(parsed)
            print(f'Page {n}/{total_pages}: {len(parsed)} products')

            if n < total_pages:
                click_page(page, n + 1, sig)

        browser.close()

    unique = {}
    for product in products:
        key = (product.product_page_url,) if product.product_page_url else (
            product.title, product.regular_cost_ex_gst, product.primary_image_url
        )
        unique[key] = product
    products = list(unique.values())

    rows = [asdict(p) for p in products]
    fields = list(core.Product.__dataclass_fields__)
    with (out / 'dalua_catalog.csv').open('w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    (out / 'dalua_catalog.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')

    summary = {
        'table_pages_reported': total_pages,
        'pages_with_rows': total_pages,
        'products': len(products),
        'with_descriptions': sum(bool(p.description) for p in products),
        'with_images': sum(bool(p.primary_image_url) for p in products),
        'with_product_urls': sum(bool(p.product_page_url) for p in products),
        'with_markdown': sum(bool(p.markdown_cost_plus_gst) for p in products),
        'with_stock_status': sum(bool(p.stock_availability) for p in products),
        'prices_ex_gst_confirmed': True,
        'gst_rate': '10%',
        'source': core.TABLE_URL,
        'pagination': 'rendered Chrome / DALUA public Woo Product Table',
    }
    (out / 'summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
