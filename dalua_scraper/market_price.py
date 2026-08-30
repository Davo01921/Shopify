#!/usr/bin/env python3
from __future__ import annotations
import csv,json,re,statistics,time
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urljoin
import requests
SRC=Path('dalua_scraper/output/dalua_freshwater_candidates.csv'); OUT=Path('dalua_scraper/output')
RETAILERS={'DALUA AU':'https://dalua.com.au','Nature Aquariums':'https://www.natureaquariums.com.au','Nature Pets':'https://naturepets.com.au','IW Aquariums':'https://iwaquariums.com.au'}
UA='Mozilla/5.0 (compatible; NTA-Market-Pricing/1.3)'
SIZE_RE=re.compile(r'(?i)\b(\d+(?:\.\d+)?)\s*(ml|l|g|kg|cm|mm|w|inch|inches)\b')
GENERIC={'wio','dalua','fresh','aquarium','aquariums','stone','stones','rock','rocks','nano','mega','box','set','kit','bag','river','riverbed','wood','boulder','boulders','the','and','of','for','with','per','kg','cm','mm','ml','litre','litres'}
def norm(s): return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9]+',' ',(s or '').lower())).strip()
def sizes(s): return [(float(v),u.lower().replace('inches','inch')) for v,u in SIZE_RE.findall(s or '')]
def sizes_compatible(a,b):
 sa,sb=sizes(a),sizes(b)
 if not sa or not sb:return True
 for va,ua in sa:
  for vb,ub in sb:
   if ua!=ub:continue
   if va==vb:return True
   if ua=='kg' and max(va,vb)>=10 and abs(va-vb)<=1.1:return True
   if max(va,vb)>0 and abs(va-vb)/max(va,vb)<=0.03:return True
 return False
def strip_sizes(s): return SIZE_RE.sub(' ',s or '')
def model_tokens(s): return {t for t in norm(strip_sizes(s)).split() if len(t)>2 and t not in GENERIC and not t.isdigit()}
def fuzzy_token_overlap(ma,mb):
 if not ma:return 1.0
 hit=0
 for x in ma:
  if any(x==y or SequenceMatcher(None,x,y).ratio()>=.78 for y in mb):hit+=1
 return hit/len(ma)
def score(a,b):
 na,nb=norm(a),norm(b)
 if not na or not nb or not sizes_compatible(a,b):return 0.0
 ma,mb=model_tokens(a),model_tokens(b)
 if fuzzy_token_overlap(ma,mb)<0.5:return 0.0
 seq=SequenceMatcher(None,na,nb).ratio(); ta,tb=set(na.split()),set(nb.split()); jac=len(ta&tb)/max(1,len(ta|tb))
 return .7*seq+.3*jac
def fetch_catalog(base):
 s=requests.Session();s.headers['User-Agent']=UA;allp=[]
 for page in range(1,11):
  try:r=s.get(f'{base}/products.json?limit=250&page={page}',timeout=12)
  except Exception:break
  if r.status_code!=200:break
  try:data=r.json().get('products',[])
  except Exception:break
  if not data:break
  for p in data:
   title=p.get('title','')
   for v in p.get('variants') or []:
    vt=v.get('title','');label=title if vt in ('','Default Title') else f'{title} {vt}'
    try:price=float(v.get('price'))
    except:continue
    if price>0:allp.append({'title':label,'price':price,'url':urljoin(base,f"/products/{p.get('handle','')}")})
  if len(data)<250:break
  time.sleep(.1)
 return allp
def main():
 catalogs={}
 with ThreadPoolExecutor(max_workers=len(RETAILERS)) as ex:
  futs={ex.submit(fetch_catalog,b):n for n,b in RETAILERS.items()}
  for fut in as_completed(futs):
   n=futs[fut]
   try:catalogs[n]=fut.result()
   except Exception as e:print('WARN',n,e);catalogs[n]=[]
   print(n,len(catalogs[n]))
 rows=list(csv.DictReader(SRC.open(encoding='utf-8-sig')));out=[]
 for r in rows:
  obs=[]
  for retailer,items in catalogs.items():
   best=(0,None)
   for it in items:
    s=score(r['dalua_title'],it['title'])
    if s>best[0]:best=(s,it)
   if best[1] and best[0]>=.72:obs.append({'retailer':retailer,'price':best[1]['price'],'score':round(best[0],3),'title':best[1]['title'],'url':best[1]['url']})
  prices=[o['price'] for o in obs];cost=float(r['dalua_cost_plus_gst']) if r.get('dalua_cost_plus_gst') else 0
  median=round(statistics.median(prices),2) if len(prices)>=2 else None
  status='priced' if median is not None and median>=cost else ('below_cost_review' if median is not None else 'insufficient_market_data')
  x=dict(r);x.update({'market_observations':len(obs),'market_median_aud':f'{median:.2f}' if median is not None else '', 'recommended_retail_aud':f'{median:.2f}' if status=='priced' else '', 'pricing_status':status,'market_sources_json':json.dumps(obs,separators=(',',':'))});out.append(x)
 fields=list(out[0])
 with (OUT/'dalua_market_pricing.csv').open('w',encoding='utf-8-sig',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(out)
 summary={'input_candidates':len(rows),'priced':sum(r['pricing_status']=='priced' for r in out),'insufficient_market_data':sum(r['pricing_status']=='insufficient_market_data' for r in out),'below_cost_review':sum(r['pricing_status']=='below_cost_review' for r in out),'retailers':{k:len(v) for k,v in catalogs.items()}}
 (OUT/'market_pricing_summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
