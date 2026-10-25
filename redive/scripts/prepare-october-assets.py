from pathlib import Path
import urllib.request,urllib.parse,json,concurrent.futures
ROOT=Path(__file__).resolve().parent.parent
source=json.loads((ROOT/'data/2026-10-source.json').read_text())
month=source['data']['months']['2026-10']
with urllib.request.urlopen('https://heysyu84.github.io/priconne/characters.json',timeout=25) as response: catalog=json.load(response)['characters']
normalize=lambda x:''.join(str(x).split()).lower()
lookup={normalize(alias):c for c in catalog for alias in [c['name'],*c.get('aliases',[])]}
names=sorted(set(c for t in month['tactics'] for c in t['characters'])|set(c for r in month.get('recommendations',[]) for c in r['characters']))
manifest=json.loads((ROOT/'public/assets/manifest.json').read_text())
asset_dir=ROOT/'public/assets'; jobs=[];mapped={};missing=[]
for i,name in enumerate(names):
 c=lookup.get(normalize(name))
 if not c:missing.append(name);continue
 record={'name':name,'aliases':sorted(set([c['name'],*c.get('aliases',[])])-{name}),'sourceName':c['name']}
 mapped[name]=record; portrait={}
 for star,path in [('default',c.get('sourcePortrait') or c.get('portrait')),*list((c.get('sourceByStar') or c.get('byStar',{})).items())]:
  if not path:continue
  if star not in ['default','5','6']:continue
  file=f'oct-unit-{i}-{star}.png';portrait[star]='./assets/'+file
  url=urllib.parse.urljoin('https://heysyu84.github.io/priconne/',path.lstrip('/'))
  jobs.append((file,url))
 manifest['characters'][name]=portrait
for i,(name,code) in enumerate([('프로스트 하운드','1.4'),('랜드 슬로스','2.5'),('번사우르스','3.9'),('다크 가고일','4.2'),('글러튼','5.10')],1):
 file=f'oct-boss-{i}.png';manifest['bosses']['oct-'+str(i)]={'name':name,'image':'./assets/'+file,'reference':code}
 jobs.append((file,'https://purikonekrsemi.github.io/PurikoneKrSheet/images/Boss/'+code+'.png'))
def download(job):
 file,url=job;dest=asset_dir/file
 if dest.exists() and dest.stat().st_size>1000:return None
 try:
  with urllib.request.urlopen(url,timeout=25) as response: raw=response.read()
  if not raw.startswith(b'\x89PNG'):raise ValueError('Not PNG')
  dest.write_bytes(raw);return None
 except Exception as exc:return (file,str(exc),url)
print('Current-month portrait names:',len(names),'mapped:',len(mapped),'missing:',missing,flush=True)
errors=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 for result in pool.map(download,jobs):
  if result:errors.append(result)
print('Image jobs:',len(jobs),'errors:',errors,flush=True)
if missing or errors:raise SystemExit(1)
(asset_dir/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
(ROOT/'src/art-catalog.js').write_text('const GAME_ASSETS='+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+';\n')
(ROOT/'data/2026-10-characters.json').write_text(json.dumps(mapped,ensure_ascii=False,indent=2))
