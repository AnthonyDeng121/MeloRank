"""Audit every Grammy image path and preserve per-nominee provenance.
Run from the repository root: python scripts/audit-grammy-artwork.py
"""
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def audit():
 data=json.loads((ROOT/'public/grammy/2027.json').read_text('utf8'))
 manifests={}
 for path in (ROOT/'docs').glob('grammy-2027-*-sources.json'):
  for ident,entry in json.loads(path.read_text('utf8')).items():manifests.setdefault(ident,[]).append({'manifest':path.name,**entry})
 by_image={}
 for entries in manifests.values():
  for entry in entries:
   if entry.get('image','').startswith('/grammy-2027/'):
    by_image.setdefault(entry['image'],[]).append(entry)
 rows=[];broken=[]
 for category in data:
  for n in category['nominees']:
   ident,title,artist=n[:3];image=n[3] if len(n)>3 else None
   row={'id':ident,'category':category['title'],'title':title,'artist':artist,'image':image,'status':'missing','sources':manifests.get(ident,[]) or by_image.get(image,[])}
   if image:
    target=(ROOT/'public'/image.lstrip('/')).resolve()
    try:
     if not target.is_relative_to((ROOT/'public').resolve()):raise ValueError('Image outside public')
     with Image.open(target) as im:
      im.verify()
     with Image.open(target) as im:row['dimensions']=list(im.size)
     row['status']='local-file-valid'
    except (OSError,ValueError) as error:row['status']='broken';row['error']=str(error);broken.append(ident)
   rows.append(row)
 report={'total':len(rows),'local':sum(r['status']=='local-file-valid' for r in rows),'missing':sum(r['status']=='missing' for r in rows),'broken':broken,'verificationScope':'All local files decoded; source metadata and contact sheets reviewed. File validity alone does not prove artwork identity. Missing entries have no confirmed image and are not counted as complete.','corrections':[{'id':'25983','reason':'Replaced incorrect red CONFESSIONS II artwork with the purple Madonna portrait bearing the album title.'},{'id':'26379','reason':'Removed Dominic Fike image incorrectly matched to DOMi & JD BECK by substring.'},{'id':'26326','reason':'Removed For Good image incorrectly matched to No Place Like Home by colon splitting.'},{'ids':['25914','25925'],'reason':'Replaced inconsistent QQ Berghain image with existing LUX artwork used by the same work in music video category.'}],'nominees':rows}
 (ROOT/'docs/grammy-2027-artwork-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
 print({k:report[k] for k in ['total','local','missing','broken']})
 if broken or report['missing']:raise SystemExit(1)
if __name__=='__main__':audit()
