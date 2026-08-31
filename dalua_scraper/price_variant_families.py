#!/usr/bin/env python3
from __future__ import annotations
import csv,json,statistics
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
from market_price import RETAILERS,fetch_catalog,score
OUT=Path('dalua_scraper/output'); SRC=OUT/'dalua_variant_family_safe.csv'

def main():
    catalogs={}
    with ThreadPoolExecutor(max_workers=len(RETAILERS)) as ex:
        futs={ex.submit(fetch_catalog,base):name for name,base in RETAILERS.items()}
        for fut in as_completed(futs):
            name=futs[fut]
            try: catalogs[name]=fut.result()
            except Exception as e:
                print('WARN',name,e); catalogs[name]=[]
            print(name,len(catalogs[name]))
    families=list(csv.DictReader(SRC.open(encoding='utf-8-sig')))
    out=[]
    for fam in families:
        priced_options=[]
        for opt in json.loads(fam['options_json']):
            obs=[]
            for retailer,items in catalogs.items():
                best=(0,None)
                for it in items:
                    s=score(opt['source_title'],it['title'])
                    if s>best[0]: best=(s,it)
                if best[1] and best[0]>=.72:
                    obs.append({'retailer':retailer,'price':best[1]['price'],'score':round(best[0],3),'title':best[1]['title'],'url':best[1]['url']})
            prices=[x['price'] for x in obs]
            median=round(statistics.median(prices),2) if len(prices)>=2 else None
            cost=float(opt['cost_plus_gst'])
            status='priced' if median is not None and median>=cost else ('below_cost_review' if median is not None else 'insufficient_market_data')
            x=dict(opt)
            x.update({'market_observations':len(obs),'market_median_aud':f'{median:.2f}' if median is not None else '', 'recommended_retail_aud':f'{median:.2f}' if status=='priced' else '', 'pricing_status':status,'market_sources':obs})
            priced_options.append(x)
        statuses=[x['pricing_status'] for x in priced_options]
        family_status='fully_priced' if all(s=='priced' for s in statuses) else ('review' if any(s=='below_cost_review' for s in statuses) else 'partial_or_unpriced')
        out.append({'family':fam['family'],'source_rows':fam['source_rows'],'proposed_product_title':fam['proposed_product_title'],'priced_options_json':json.dumps(priced_options,separators=(',',':')),'family_pricing_status':family_status})
    fields=['family','source_rows','proposed_product_title','priced_options_json','family_pricing_status']
    with (OUT/'dalua_variant_family_pricing.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(out)
    total_variants=sum(int(r['source_rows']) for r in out)
    priced_variants=sum(sum(1 for x in json.loads(r['priced_options_json']) if x['pricing_status']=='priced') for r in out)
    summary={'families':len(out),'fully_priced_families':sum(r['family_pricing_status']=='fully_priced' for r in out),'partial_or_unpriced_families':sum(r['family_pricing_status']=='partial_or_unpriced' for r in out),'review_families':sum(r['family_pricing_status']=='review' for r in out),'variants':total_variants,'priced_variants':priced_variants,'retailers':{k:len(v) for k,v in catalogs.items()},'shopify_writes':0}
    (OUT/'variant_pricing_summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary,indent=2))
if __name__=='__main__': main()
