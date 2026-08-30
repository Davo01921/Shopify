#!/usr/bin/env python3
from __future__ import annotations
import csv,json,re,statistics,time
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urljoin
import requests
SRC=Path('dalua_scraper/output/dalua_freshwater_candidates.csv'); OUT=Path('dalua_scraper/output')
RETAILERS={
 'DALUA AU':'https://dalua.com.au',
 'Nature Aquariums':'https://www.natureaquariums.com.au',
 'Nature Pets':'https://naturepets.com.au',
 'IW Aquariums':'https://iwaquariums.com.au',
}
UA='Mozilla/5.0 (compatible; NTA-Market-Pricing/1.1)'
SIZE_RE=re.compile(r'(?i)\b\d+(?:\.\d+)?\s*(?:ml|l|g|kg|cm|mm|w|inch|inches)\b')
def norm(s): return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9]+',' ',(s or '').lower())).strip()
def sizes(s): return {norm(x) for x in SIZE_RE.findall(s or '')}
def score(a,b):
 na,nb=norm(a),norm(b)
 if not na or not nb:return 0.0
 sa,sb=sizes(a),sizes(b)
 if sa and sb and not (sa&sb): return 0.0
 seq=SequenceMatcher(None,na,nb).ratio(); ta,tb=set(na.split()),set(nb.split()); jac=len(ta&tb)/max(1,len(ta|tb))
 return .7*seq+.3*jac
def fetch_catalog(base):
 s=requests.Session(); s.headers['User-Agent']=UA; allp=[]
 for page in range(1,11):
  u=f'{base}/products.json?limit=250&page={page}'
  try: r=s.get(u,timeout=12)
  except Exception: break
  if r.status_code!=200: break
  try: data=r.json().get('products',[])
  except Exception: break
  if not data: break
  for p in data:
   title=p.get('title',''); variants=p.get('variants') or []
   for v in variants:
    vt=v.get('title',''); label=title if vt in ('','Default Title') else f'{title} {vt}'
    try: price=float(v.get('price'))
    except: continue
    if price<=0: continue
    allp.append({'title':label,'price':price,'url':urljoin(base,f"/products/{p.get('handle','')}")})
  if len(data)<250: break
  time.sleep(.1)
 return allp
def main():
 catalogs={}
 with ThreadPoolExecutor(max_workers=len(RETAILERS)) as ex:
  futs={ex.submit(fetch_catalog,base):name for name,base in RETAILERS.items()}
  for fut in as_completed(futs):
   name=futs[fut]
   try: catalogs[name]=fut.result()
   except Exception as e: print('WARN',name,e); catalogs[name]=[]
   print(name,len(catalogs[name]))
 rows=list(csv.DictReader(SRC.open(encoding='utf-8-sig'))); out=[]
 for r in rows:
  obs=[]
  for retailer,items in catalogs.items():
   best=(0,None)
   for it in items:
    s=score(r['dalua_title'],it['title'])
    if s>best[0]: best=(s,it)
   if best[1] and best[0]>=.72:
    obs.append({'retailer':retailer,'price':best[1]['price'],'score':round(best[0],3),'title':best[1]['title'],'url':best[1]['url']})
  prices=[o['price'] for o in obs]; cost=float(r['dalua_cost_plus_gst']) if r.get('dalua_cost_plus_gst') else 0
  median=round(statistics.median(prices),2) if len(prices)>=2 else None
  status='priced' if median is not None and median>=cost else ('below_cost_review' if median is not None else 'insufficient_market_data')
  rec=median if status=='priced' else ''
  x=dict(r); x.update({'market_observations':len(obs),'market_median_aud':f'{median:.2f}' if median is not None else '', 'recommended_retail_aud':f'{rec:.2f}' if rec!='' else '', 'pricing_status':status,'market_sources_json':json.dumps(obs,separators=(',',':'))}); out.append(x)
 fields=list(out[0])
 with (OUT/'dalua_market_pricing.csv').open('w',encoding='utf-8-sig',newline='') as f:
  w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(out)
 summary={'input_candidates':len(rows),'priced':sum(r['pricing_status']=='priced' for r in out),'insufficient_market_data':sum(r['pricing_status']=='insufficient_market_data' for r in out),'below_cost_review':sum(r['pricing_status']=='below_cost_review' for r in out),'retailers':{k:len(v) for k,v in catalogs.items()}}
 (OUT/'market_pricing_summary.json').write_text(json.dumps(summary,indent=2)); print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
