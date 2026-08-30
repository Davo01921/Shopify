#!/usr/bin/env python3
import csv,re,json
from pathlib import Path
SRC=Path('dalua_scraper/output/dalua_shopify_reconciliation.csv'); OUT=Path('dalua_scraper/output')
MARINE=('reef','coral','skimmer','reefer','wavemaker','wave maker','marine','saltwater','protein skimmer','filter sock','e-marco','marco rock','rms','red sea','coral essentials')
PROMO=('free ','price match','banner','free shipping')
REVIEW=('pre-order','preorder','upgrade kit')
SIZE=re.compile(r'(?i)\b(\d+(?:\.\d+)?\s*(?:ml|l|g|kg|cm|mm|inch|inches|w|litre|litres)|small|medium|large|xl|xxl|black|grey|gray|pale|yellow|red|purple|blue|white)\b')
def norm(s): return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9]+',' ',s.lower())).strip()
def family(title):
 s=SIZE.sub('',title); s=re.sub(r'\([^)]*\)',' ',s); return norm(s)
def classify(t):
 n=norm(t)
 if any(x in n for x in PROMO): return 'exclude','supplier promotion/non-retail'
 if any(x in n for x in MARINE): return 'marine_review','marine/reef range — strategic review'
 if any(x in n for x in REVIEW): return 'manual_review','special/preorder/upgrade item'
 return 'freshwater_candidate','fits general freshwater/aquascaping catalogue'
def main():
 rows=list(csv.DictReader(SRC.open(encoding='utf-8-sig'))); missing=[r for r in rows if r['classification']=='missing']
 out=[]
 for r in missing:
  q,reason=classify(r['dalua_title']); x=dict(r); x['qualification']=q; x['qualification_reason']=reason; x['proposed_variant_family']=family(r['dalua_title']); out.append(x)
 groups={}
 for r in out:
  if r['qualification']!='freshwater_candidate': continue
  groups.setdefault(r['proposed_variant_family'],[]).append(r)
 for rs in groups.values():
  if len(rs)>1:
   for r in rs: r['variant_group_size']=str(len(rs)); r['qualification']='variant_group_review'; r['qualification_reason']='multiple DALUA rows may belong as Shopify variants'
  else: rs[0]['variant_group_size']='1'
 fields=list(out[0])
 for k in ('qualification','qualification_reason','proposed_variant_family','variant_group_size'):
  if k not in fields: fields.append(k)
 for name,pred in [('freshwater_candidates',lambda r:r['qualification']=='freshwater_candidate'),('variant_groups',lambda r:r['qualification']=='variant_group_review'),('marine_review',lambda r:r['qualification']=='marine_review'),('manual_review',lambda r:r['qualification']=='manual_review'),('qualified_all',lambda r:True)]:
  data=[r for r in out if pred(r)]
  with (OUT/f'dalua_{name}.csv').open('w',encoding='utf-8-sig',newline='') as f:
   w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(data)
 counts={k:sum(r['qualification']==k for r in out) for k in sorted({r['qualification'] for r in out})}; counts['input_missing']=len(missing); counts['variant_families']=sum(len(v)>1 for v in groups.values())
 (OUT/'qualification_summary.json').write_text(json.dumps(counts,indent=2)); print(json.dumps(counts,indent=2))
if __name__=='__main__': main()
