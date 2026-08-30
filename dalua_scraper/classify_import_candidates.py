#!/usr/bin/env python3
from __future__ import annotations
import csv, json, re
from pathlib import Path
OUT=Path('dalua_scraper/output')
SRC=OUT/'dalua_shopify_reconciliation.csv'
DEST=OUT/'dalua_shopify_import_candidates.csv'
SUMMARY=OUT/'import_candidate_summary.json'
MARINE=('coral','reef','reefer','skimmer','wave maker','wavemaker','marine','frag','aiptasia','protein skimmer','reefing','sps','lps')
FRESH=('freshwater','shrimp','aquascap','plant','planted','co2','lily pipe','fertiliser','fertilizer','substrate','siphon','tweezer','moss','filter','canister','nano aquarium','river kit','stone','rock','wood','soil','water change','algae scraper')

def text(r): return re.sub(r'\s+',' ',(r.get('dalua_title','')+' '+r.get('description','')).lower())
def main():
 with SRC.open(encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f))
 out=[]; counts={'existing':0,'candidate_draft':0,'marine_review':0,'manual_review':0,'exclude':0}
 for r in rows:
  base=r['classification']; t=text(r)
  if base in ('exact','probable'): decision='existing'
  elif base=='exclude': decision='exclude'
  elif any(k in t for k in MARINE): decision='marine_review'
  elif any(k in t for k in FRESH): decision='candidate_draft'
  else: decision='manual_review'
  counts[decision]+=1
  r=dict(r); r['import_decision']=decision
  r['decision_reason']=(
   'already matched to Shopify' if decision=='existing' else
   'supplier promotion/free item' if decision=='exclude' else
   'marine/reef terminology: review before adding to NTA' if decision=='marine_review' else
   'clear freshwater/aquascaping/general aquarium relevance' if decision=='candidate_draft' else
   'not enough evidence for automatic import')
  out.append(r)
 fields=list(out[0])
 with DEST.open('w',encoding='utf-8-sig',newline='') as f: w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(out)
 for decision in counts:
  with (OUT/f'dalua_shopify_{decision}.csv').open('w',encoding='utf-8-sig',newline='') as f:
   w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows([r for r in out if r['import_decision']==decision])
 summary={'total':len(out),**counts,'policy':'read-only classification; no Shopify writes'}
 SUMMARY.write_text(json.dumps(summary,indent=2),encoding='utf-8'); print(json.dumps(summary,indent=2))
if __name__=='__main__': main()
