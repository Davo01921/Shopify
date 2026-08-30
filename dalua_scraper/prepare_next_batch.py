#!/usr/bin/env python3
import csv,json,re
from collections import defaultdict
from pathlib import Path
OUT=Path('dalua_scraper/output'); PRICING=OUT/'dalua_market_pricing.csv'; VARIANTS=OUT/'dalua_variant_groups.csv'
HOLD_TERMS=('e marco','rail mounting','rail only','rms','coral','reef','marine','skimmer','frag','aiptasia')
def read(p):
 with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def clean(s):return re.sub(r'\s+',' ',(s or '').strip())
def opt(title):
 bits=[]
 for pat in [r'(?i)\b\d+(?:\.\d+)?\s*(?:kg|g|l|ml|cm|mm)\b',r'(?i)\(([^)]+)\)',r'(?i)\b(fine|small|medium|large|x large|xl|black|grey|gray|pale|yellow|red|purple|blue|white)\b']:
  for m in re.finditer(pat,title):
   v=(m.group(1) if m.lastindex else m.group(0)).strip()
   if v.lower() not in {x.lower() for x in bits}:bits.append(v)
 return ' / '.join(bits) if bits else title
def main():
 pricing=read(PRICING); unpriced=[r for r in pricing if r.get('pricing_status')=='insufficient_market_data']
 with (OUT/'dalua_next_125_unpriced.csv').open('w',encoding='utf-8-sig',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(pricing[0]));w.writeheader();w.writerows(unpriced)
 rows=read(VARIANTS); groups=defaultdict(list)
 for r in rows:groups[clean(r['proposed_variant_family'])].append(r)
 safe=[];hold=[]
 for family,rs in sorted(groups.items()):
  if len(rs)<2:continue
  item={'family':family,'source_rows':len(rs),'proposed_product_title':family.title(),'options_json':json.dumps([{'source_title':r['dalua_title'],'proposed_option':opt(r['dalua_title']),'cost_plus_gst':r['dalua_cost_plus_gst'],'markdown_plus_gst':r['dalua_markdown_plus_gst'],'source_url':r['dalua_product_url'],'image_url':r['dalua_image_url']} for r in rs],separators=(',',':'))}
  hay=(family+' '+' '.join(r['dalua_title'] for r in rs)).lower()
  if any(t in hay for t in HOLD_TERMS):item['status']='hold_non_freshwater_or_ambiguous';hold.append(item)
  else:item['status']='safe_for_shopify_duplicate_audit';safe.append(item)
 fields=['family','source_rows','proposed_product_title','options_json','status']
 for name,data in [('dalua_variant_family_manifest',safe+hold),('dalua_variant_family_safe',safe),('dalua_variant_family_hold',hold)]:
  with (OUT/f'{name}.csv').open('w',encoding='utf-8-sig',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(data)
 summary={'unpriced_safe_candidates':len(unpriced),'variant_source_rows':len(rows),'variant_families':len(safe)+len(hold),'safe_variant_families':len(safe),'hold_variant_families':len(hold),'variant_rows_accounted_for':sum(x['source_rows'] for x in safe+hold),'shopify_writes':0,'next_gate':'live Shopify duplicate audit of safe variant families'}
 (OUT/'next_batch_summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
