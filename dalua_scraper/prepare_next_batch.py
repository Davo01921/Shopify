#!/usr/bin/env python3
"""Prepare the next DALUA catalogue rollout without writing to Shopify.

Outputs:
- 125 currently unpriced safe freshwater rows for expanded AU market research
- variant-family manifest consolidating DALUA supplier rows into Shopify product families
- audit summary used as a hard gate before draft creation
"""
import csv, json, re
from collections import defaultdict
from pathlib import Path

OUT=Path('dalua_scraper/output')
PRICING=OUT/'dalua_market_pricing.csv'
VARIANTS=OUT/'dalua_variant_groups.csv'

def read(path):
    with path.open(encoding='utf-8-sig', newline='') as f: return list(csv.DictReader(f))

def clean_family(s):
    s=re.sub(r'\s+',' ',(s or '').strip())
    return s

def option_from_title(title, family):
    t=title
    # Preserve meaningful colour/grade/size distinctions instead of inventing option values.
    bits=[]
    for pat in [r'(?i)\b\d+(?:\.\d+)?\s*(?:kg|g|l|ml|cm|mm)\b', r'(?i)\(([^)]+)\)', r'(?i)\b(fine|small|medium|large|x large|xl|black|grey|gray|pale|yellow|red|purple|blue|white)\b']:
        for m in re.finditer(pat,t):
            v=m.group(1) if m.lastindex else m.group(0)
            if v.lower() not in {x.lower() for x in bits}: bits.append(v.strip())
    return ' / '.join(bits) if bits else title

def main():
    pricing=read(PRICING)
    unpriced=[r for r in pricing if r.get('pricing_status')=='insufficient_market_data']
    # The agreed next tranche is the unresolved safe-candidate set; retain exact source rows.
    with (OUT/'dalua_next_125_unpriced.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(pricing[0])); w.writeheader(); w.writerows(unpriced)

    rows=read(VARIANTS); groups=defaultdict(list)
    for r in rows: groups[clean_family(r['proposed_variant_family'])].append(r)
    manifest=[]
    for family,rs in sorted(groups.items()):
        # Require >=2 source rows; preserve each row's own cost and image/source URL.
        if len(rs)<2: continue
        manifest.append({
            'family':family,
            'source_rows':len(rs),
            'proposed_product_title':family.title(),
            'options_json':json.dumps([{
                'source_title':r['dalua_title'],
                'proposed_option':option_from_title(r['dalua_title'],family),
                'cost_plus_gst':r['dalua_cost_plus_gst'],
                'markdown_plus_gst':r['dalua_markdown_plus_gst'],
                'source_url':r['dalua_product_url'],
                'image_url':r['dalua_image_url'],
            } for r in rs],separators=(',',':')),
            'status':'review_before_shopify_write'
        })
    fields=['family','source_rows','proposed_product_title','options_json','status']
    with (OUT/'dalua_variant_family_manifest.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(manifest)
    summary={
        'unpriced_safe_candidates':len(unpriced),
        'variant_source_rows':len(rows),
        'variant_families':len(manifest),
        'variant_rows_accounted_for':sum(x['source_rows'] for x in manifest),
        'shopify_writes':0,
        'next_gate':'expanded Australian market pricing + family duplicate audit'
    }
    (OUT/'next_batch_summary.json').write_text(json.dumps(summary,indent=2))
    print(json.dumps(summary,indent=2))

if __name__=='__main__': main()
