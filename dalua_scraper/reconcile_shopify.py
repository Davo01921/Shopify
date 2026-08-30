#!/usr/bin/env python3
from __future__ import annotations

import csv
import html
import json
import re
import time
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

import requests

DALUA = Path('dalua_scraper/output/dalua_catalog.csv')
OUT = Path('dalua_scraper/output/dalua_shopify_reconciliation.csv')
SUMMARY = Path('dalua_scraper/output/reconciliation_summary.json')
SHOP = 'https://nanotanksaustralia.com.au'
UA = 'Mozilla/5.0 (compatible; NTA-DALUA-Reconciliation/1.0)'


def norm(s: str) -> str:
    s = html.unescape(s or '')
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = s.lower().replace('&', ' and ')
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def tokens(s: str) -> set[str]:
    return {x for x in norm(s).split() if len(x) > 1}


def similarity(a: str, b: str) -> float:
    na, nb = norm(a), norm(b)
    if not na or not nb:
        return 0.0
    seq = SequenceMatcher(None, na, nb).ratio()
    ta, tb = tokens(a), tokens(b)
    jac = len(ta & tb) / max(1, len(ta | tb))
    contain = min(len(ta & tb) / max(1, len(ta)), len(ta & tb) / max(1, len(tb)))
    return max(seq, 0.55 * seq + 0.30 * jac + 0.15 * contain)


def get_xml(session: requests.Session, url: str) -> ET.Element:
    r = session.get(url, timeout=45)
    r.raise_for_status()
    return ET.fromstring(r.content)


def discover_shopify_products(session: requests.Session) -> list[dict]:
    root = get_xml(session, f'{SHOP}/sitemap.xml')
    locs = [e.text.strip() for e in root.iter() if e.tag.endswith('loc') and e.text]
    product_maps = [u for u in locs if 'sitemap_products' in u]
    if not product_maps:
        raise RuntimeError(f'No Shopify product sitemaps found in {locs[:10]}')

    products = []
    seen = set()
    for sm in product_maps:
        doc = get_xml(session, sm)
        for url_el in [e for e in doc.iter() if e.tag.endswith('url')]:
            loc = next((x.text.strip() for x in url_el if x.tag.endswith('loc') and x.text), '')
            if not loc or '/products/' not in loc or loc in seen:
                continue
            seen.add(loc)
            title = next((x.text.strip() for x in url_el.iter() if x.tag.endswith('title') and x.text), '')
            if not title:
                handle = urlparse(loc).path.rstrip('/').split('/')[-1]
                title = handle.replace('-', ' ')
            products.append({'title': html.unescape(title), 'url': loc})
    return products


def retail_price(session: requests.Session, url: str) -> str:
    try:
        r = session.get(url + '.js' if not url.endswith('.js') else url, timeout=30)
        if r.ok:
            data = r.json()
            variants = data.get('variants') or []
            prices = [v.get('price') for v in variants if v.get('price') is not None]
            if prices:
                p = min(prices)
                return f'{float(p)/100:.2f}' if isinstance(p, int) else f'{float(p):.2f}'
    except Exception:
        return ''
    return ''


def exclusion_reason(title: str, desc: str) -> str:
    t = norm(title)
    d = norm(desc)
    if t.startswith('free ') or ' price match' in t or t in {'free florabeds', 'free reef magazine'}:
        return 'supplier promotion/free item'
    if 'free ' in t and ('buy ' in d or 'for every ' in d):
        return 'supplier promotion/free item'
    return ''


def main() -> int:
    session = requests.Session(); session.headers['User-Agent'] = UA
    with DALUA.open(encoding='utf-8-sig', newline='') as f:
        dalua = list(csv.DictReader(f))
    shopify = discover_shopify_products(session)
    print(f'DALUA={len(dalua)} Shopify published={len(shopify)}')

    exact_index: dict[str, list[dict]] = {}
    for p in shopify:
        exact_index.setdefault(norm(p['title']), []).append(p)

    results = []
    counts = {'exact':0,'probable':0,'missing':0,'exclude':0}
    price_cache = {}
    for i, d in enumerate(dalua, 1):
        title = d['title']
        reason = exclusion_reason(title, d.get('description',''))
        if reason:
            cls, best, score = 'exclude', None, 0.0
        else:
            exact = exact_index.get(norm(title), [])
            if exact:
                cls, best, score = 'exact', exact[0], 1.0
            else:
                scored = sorted(((similarity(title,p['title']), p) for p in shopify), key=lambda x:x[0], reverse=True)
                score, best = scored[0] if scored else (0.0, None)
                cls = 'probable' if score >= 0.82 else 'missing'
                if cls == 'missing' and score < 0.60:
                    best = None
        counts[cls] += 1
        shop_url = best['url'] if best else ''
        shop_title = best['title'] if best else ''
        retail = ''
        if cls in {'exact','probable'} and shop_url:
            if shop_url not in price_cache:
                price_cache[shop_url] = retail_price(session, shop_url)
                time.sleep(0.03)
            retail = price_cache[shop_url]
        results.append({
            'classification': cls,
            'match_score': f'{score:.3f}',
            'dalua_title': title,
            'dalua_cost_ex_gst': d.get('regular_cost_ex_gst',''),
            'dalua_cost_plus_gst': d.get('regular_cost_plus_gst',''),
            'dalua_markdown_ex_gst': d.get('markdown_cost_ex_gst',''),
            'dalua_markdown_plus_gst': d.get('markdown_cost_plus_gst',''),
            'dalua_product_url': d.get('product_page_url',''),
            'dalua_image_url': d.get('primary_image_url',''),
            'shopify_title': shop_title,
            'shopify_product_url': shop_url,
            'shopify_retail_price': retail,
            'exclude_reason': reason,
            'review_note': 'manual review required' if cls == 'probable' else '',
        })
        if i % 50 == 0: print(f'Compared {i}/{len(dalua)}')

    OUT.parent.mkdir(parents=True, exist_ok=True)
    fields = list(results[0])
    with OUT.open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(results)
    summary = {'dalua_products':len(dalua),'shopify_published_products':len(shopify),**counts,
               'probable_threshold':0.82,'generated_source':SHOP}
    SUMMARY.write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print(json.dumps(summary, indent=2))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
