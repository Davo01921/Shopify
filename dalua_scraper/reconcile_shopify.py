#!/usr/bin/env python3
from __future__ import annotations
import csv, html, json, re, unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlparse
import xml.etree.ElementTree as ET
import requests
DALUA=Path('dalua_scraper/output/dalua_catalog.csv'); OUT=Path('dalua_scraper/output/dalua_shopify_reconciliation.csv'); SUMMARY=Path('dalua_scraper/output/reconciliation_summary.json')
SHOP='https://nanotanksaustralia.com.au'; UA='Mozilla/5.0 (compatible; NTA-DALUA-Reconciliation/1.1)'
def norm(s):
 s=html.unescape(s or ''); s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower().replace('&',' and '); s=re.sub(r'[^a-z0-9]+',' ',s); return re.sub(r'\s+',' ',s).strip()
def aliases(s):
 n=norm(s); out={n};
 if n.startswith('dalua '): out.add(n[6:])
 if n.startswith('dalua fresh '): out.add(n[6:]); out.add(n[12:])
 return {x for x in out if x}
def tokens(s): return {x for x in norm(s).split() if len(x)>1}
def similarity(a,b):
 best=0.0
 for na in aliases(a):
  for nb in aliases(b):
   seq=SequenceMatcher(None,na,nb).ratio(); ta,tb=set(na.split()),set(nb.split()); jac=len(ta&tb)/max(1,len(ta|tb)); contain=min(len(ta&tb)/max(1,len(ta)),len(ta&tb)/max(1,len(tb))); best=max(best,seq,.55*seq+.30*jac+.15*contain)
 return best
def get_xml(s,u): r=s.get(u,timeout=45); r.raise_for_status(); return ET.fromstring(r.content)
def discover(s):
 root=get_xml(s,f'{SHOP}/sitemap.xml'); locs=[e.text.strip() for e in root.iter() if e.tag.endswith('loc') and e.text]; maps=[u for u in locs if 'sitemap_products' in u]; products=[]; seen=set()
 for sm in maps:
  doc=get_xml(s,sm)
  for ue in [e for e in doc.iter() if e.tag.endswith('url')]:
   loc=next((x.text.strip() for x in ue if x.tag.endswith('loc') and x.text),'')
   if not loc or '/products/' not in loc or loc in seen: continue
   seen.add(loc); title=next((x.text.strip() for x in ue.iter() if x.tag.endswith('title') and x.text),'') or urlparse(loc).path.rstrip('/').split('/')[-1].replace('-',' '); products.append({'title':html.unescape(title),'url':loc})
 return products
def exclusion(t,d):
 n=norm(t); dn=norm(d)
 if n.startswith('free ') or ' price match' in n or (('free ' in n) and ('buy ' in dn or 'for every ' in dn)): return 'supplier promotion/free item'
 return ''
def main():
 s=requests.Session(); s.headers['User-Agent']=UA
 with DALUA.open(encoding='utf-8-sig',newline='') as f: dalua=list(csv.DictReader(f))
 shop=discover(s); print(f'DALUA={len(dalua)} Shopify published={len(shop)}')
 idx={}
 for p in shop:
  for a in aliases(p['title']): idx.setdefault(a,[]).append(p)
 results=[]; counts={'exact':0,'probable':0,'missing':0,'exclude':0}
 for i,d in enumerate(dalua,1):
  title=d['title']; reason=exclusion(title,d.get('description',''))
  if reason: cls,best,score='exclude',None,0.0
  else:
   exact=[]
   for a in aliases(title): exact.extend(idx.get(a,[]))
   if exact: cls,best,score='exact',exact[0],1.0
   else:
    score,best=max(((similarity(title,p['title']),p) for p in shop),key=lambda x:x[0],default=(0,None)); cls='probable' if score>=.82 else 'missing'
    if cls=='missing' and score<.60: best=None
  counts[cls]+=1; results.append({'classification':cls,'match_score':f'{score:.3f}','dalua_title':title,'dalua_cost_ex_gst':d.get('regular_cost_ex_gst',''),'dalua_cost_plus_gst':d.get('regular_cost_plus_gst',''),'dalua_markdown_ex_gst':d.get('markdown_cost_ex_gst',''),'dalua_markdown_plus_gst':d.get('markdown_cost_plus_gst',''),'dalua_product_url':d.get('product_page_url',''),'dalua_image_url':d.get('primary_image_url',''),'shopify_title':best['title'] if best else '','shopify_product_url':best['url'] if best else '','shopify_retail_price':'','exclude_reason':reason,'review_note':'manual review required' if cls=='probable' else ''})
  if i%50==0: print(f'Compared {i}/{len(dalua)}')
 OUT.parent.mkdir(parents=True,exist_ok=True)
 with OUT.open('w',encoding='utf-8-sig',newline='') as f: w=csv.DictWriter(f,fieldnames=list(results[0])); w.writeheader(); w.writerows(results)
 summary={'dalua_products':len(dalua),'shopify_published_products':len(shop),'shopify_admin_vendor_dalua_count':53,**counts,'probable_threshold':.82,'alias_rule':'leading Dalua / Dalua Fresh ignored for matching','generated_source':SHOP,'retail_price_enrichment':'deferred to matched products phase'}; SUMMARY.write_text(json.dumps(summary,indent=2),encoding='utf-8'); print(json.dumps(summary,indent=2)); return 0
if __name__=='__main__': raise SystemExit(main())
