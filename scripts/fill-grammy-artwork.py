"""Fetch missing Grammy artwork from QQ first, then Apple/Deezer.
Requires requests and Pillow. Existing images are never overwritten.
Only exact normalized title and complete artist names may match; all downloads
remain review candidates until their source and contact sheet are checked.
"""
import concurrent.futures, io, json, re, unicodedata
from pathlib import Path
import requests
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value).casefold() if c.isalnum() and not unicodedata.combining(c))
def artists(value):
    return {norm(a) for a in re.split(r',|;|\s+&\s+|\s+(?:featuring|feat\.?|with)\s+', value, flags=re.I) if norm(a)}
def matches(title, credit, candidate_title, candidate_artist):
    # Preserve remix/live/deluxe and soundtrack subtitles: these identify versions.
    return norm(title) == norm(candidate_title) and bool(artists(credit) & artists(candidate_artist))
def get(url, **kwargs):
    response = requests.get(url, timeout=15, **kwargs)
    response.raise_for_status()
    return response

def candidates(title, artist):
    query = title + ' ' + re.split(r',|;|\s+&\s+', artist)[0]
    for provider in ('qq', 'apple', 'deezer'):
        try:
            if provider == 'qq':
                hits = get('http://127.0.0.1:3200/getSearchByKey', params={'key':query,'limit':30}).json().get('response',{}).get('data',{}).get('song',{}).get('list',[])
                for h in hits:
                    if not h.get('album',{}).get('mid'): continue
                    yield provider, h['mid'], h.get('name',''), ', '.join(s['name'] for s in h.get('singer',[])), 'https://y.gtimg.cn/music/photo_new/T002R500x500M000'+h['album']['mid']+'.jpg', h.get('album',{}).get('name','')
            elif provider == 'apple':
                for entity in ('song','album'):
                    for h in get('https://itunes.apple.com/search',params={'term':query,'entity':entity,'limit':30}).json().get('results',[]):
                        yield provider, str(h.get('trackId') or h.get('collectionId')), h.get('trackName') or h.get('collectionName',''), h.get('artistName',''), h.get('artworkUrl100','').replace('100x100bb','600x600bb'), h.get('collectionName','')
            else:
                for h in get('https://api.deezer.com/search',params={'q':query,'limit':30}).json().get('data',[]):
                    yield provider,str(h['id']),h.get('title',''),h.get('artist',{}).get('name',''),h.get('album',{}).get('cover_big',''),h.get('album',{}).get('title','')
        except (requests.RequestException,ValueError,KeyError): continue

def resolve(row):
    ident,title,artist=row[:3]
    if len(row)>3 or not artist:return None
    for provider,key,t,a,url,album in candidates(title,artist):
        if not matches(title,artist,t,a):continue
        try:
            content=get(url).content
            if len(content)>10000000:continue
            picture=Image.open(io.BytesIO(content)).convert('RGB')
            if min(picture.size)<100:continue
            picture.thumbnail((600,600))
            local='/grammy-2027/works/'+provider+'-verified-'+key+'.webp'
            picture.save(ROOT/'public'/local.lstrip('/'),quality=88)
            return ident,dict(image=local,source=url,title=t,artist=a,album=album,status='needs-visual-review')
        except (requests.RequestException,OSError,ValueError):continue
    return None
if __name__=='__main__':
    data=json.loads((ROOT/'public/grammy/2027.json').read_text('utf8'))
    rows=[n for category in data for n in category['nominees'] if len(n)<4]
    # Review candidates separately; do not silently modify the production manifest.
    found={}
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        for result in pool.map(resolve,rows):
            if result:found[result[0]]=result[1]
    (ROOT/'docs/grammy-2027-artwork-candidates.json').write_text(json.dumps(found,ensure_ascii=False,indent=2)+'\n','utf8')
    print('Review candidates:',len(found))
