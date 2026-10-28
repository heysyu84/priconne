"""Normalize connector-read, bounded Google Sheets snapshots without modifying Sheets.
Usage: python scripts/import-historical-resumes.py INPUT_DIR OUTPUT_DIR
INPUT_DIR contains YYYY-MM.json books (metadata + named range values) and clan-reference.json.
"""
from pathlib import Path
from collections import defaultdict
import json,math,re,sys,datetime

def number(v):return isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)
def cell(row,col,default=None):return row[col] if col is not None and col<len(row) else default
def name(v):return v.strip() if isinstance(v,str) else ''
def close(a,b):return abs(a-b)<max(.001,abs(b)*1e-12)
def col(header,*keys):return next((header.index(key) for key in keys if key in header),None)
def save(p,data):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
def numeric_rank(v):return v if number(v) else None

def parse_book(book,reference):
 month=book['month'];ref=next((h for h in reference['monthlyHistory'] if h['month']==month),{})
 out={'month':month,'source':book['source'],'clanRank':numeric_rank(ref.get('clanRank')),'rankLabel':str(ref.get('clanRank') or '미보관'),'memberCount':None,'coverage':'clan','days':None,'dayDetailAvailable':True,'bossNames':[],'totals':{},'members':[],'logs':[]}
 audit={'month':month,'sourceId':book['id'],'sourceTitle':book['title'],'checks':[],'issues':[]}
 ranges={key:value['values'] for key,value in book['ranges'].items()}
 if month.startswith('2019'):
  resume=ranges['resume'];rows=ranges['logs'];person=name(cell(resume[3],2));days=cell(resume[6],8)
  out.update(coverage='personal',days=days,scopeName=person,bossNames=[str(x) for x in resume[9][2:7]])
  out['members']=[{'name':person,'uid':str(cell(resume[3],6,'')),'damage':cell(resume[4],2),'contribution':cell(resume[4],6),'game':cell(resume[4],10),'damageRank':None,'contributionRank':None,'gameRank':None}]
  out['totals']={k:out['members'][0][k] for k in ['damage','contribution','game']}
  last_day=None
  for ri,row in enumerate(rows[2:22],2):
   if number(cell(row,0)):last_day=int(row[0])
   if not last_day:continue
   for start in [4,8,12]:
    lap,boss,damage,contribution=[cell(row,start+i) for i in range(4)]
    if not all(number(x) for x in [lap,boss,damage,contribution]) or damage<=0:continue
    out['logs'].append({'seq':len(out['logs'])+1,'day':last_day,'stage':1 if lap<2 else 2 if lap<6 else 3,'lap':lap,'boss':boss,'name':person,'damage':damage,'actual':damage,'contribution':contribution,'carry':ri%2==1,'kill':None,'typeKnown':False})
  for key,eventkey in [('damage','actual'),('contribution','contribution')]:assert close(sum(l[eventkey] for l in out['logs']),out['totals'][key]),(month,key)
  audit['checks'].append('Personal damage and contribution match the saved resume exactly')
  audit['issues'].append('Only a personal resume survives; this is not the whole clan ranking')
  return out,audit
 settings=ranges['settings'];raw=ranges['logs'];rankrows=ranges['ranking'];hi=next(i for i,row in enumerate(raw[:15]) if '번호' in row and '닉네임' in row);h=raw[hi]
 stage_col=col(h,'단계');actual_col=col(h,'실제 피해량','적용 피해량');actual_col=9 if actual_col is None else actual_col
 keycols={k:col(h,*v) for k,v in {'seq':['번호'],'day':['일차'],'name':['닉네임'],'lap':['회차'],'boss':['보스'],'damage':['피해량'],'contribution':['기여도'],'carry':['이월'],'kill':['격파','오버킬'],'kind':['구분'],'before':['계산전 HP'],'after':['계산후 HP'],'bonus':['가산점(만)','가산점']}.items()}
 bossdb=ranges.get('bossDb');game={};levels=[]
 if bossdb:
  out['bossNames']=bossdb[1][2:7];out['days']=int(bossdb[1][1])
  gh=next(i for i,row in enumerate(bossdb) if '인게임배율' in row)
  for row in bossdb[gh+1:gh+6]:
   boss=int(cell(row,8));game[boss]={stage:cell(row,8+stage) for stage in range(1,7)}
  lh=next(i for i,row in enumerate(bossdb) if '회차시작' in row)
  levels=[{'stage':int(row[8]),'start':row[9],'end':row[10]} for row in bossdb[lh+1:] if number(cell(row,8)) and number(cell(row,9))]
 else:
  bh=next((i for i,row in enumerate(settings) if '인게임배율' in row),None)
  if bh is not None:
   out['bossNames']=[row[1] for row in settings[bh+1:bh+6]]
   for boss,row in enumerate(settings[bh+1:bh+6],1):game[boss]={stage:cell(row,4+(stage-1)*4) for stage in [1,2,3]}
  else:
   bh=next(i for i,row in enumerate(settings) if '1단계' in row);out['bossNames']=[row[1] for row in settings[bh+1:bh+6]]
  if not stage_col:
   lh=next(i for i,row in enumerate(settings) if '회차 기준' in row);thresholds=settings[lh+1];starts=[1,thresholds[2],thresholds[6]]
   levels=[{'stage':i+1,'start':start,'end':starts[i+1]-1 if i+1<len(starts) else 99999} for i,start in enumerate(starts)]
  dh=next((i for i,row in enumerate(settings) if any('클랜전 기간' in str(x) for x in row)),None)
  if dh is not None:
   vals=settings[dh+1]
   if number(cell(vals,2)) and number(cell(vals,6)):out['days']=int(vals[6]-vals[2]+1)
  if out['days'] is None:
   title=' '.join(str(x) for row in rankrows[:3] for x in row);m=re.search(r'(\d+)일차',title);out['days']=int(m[1]) if m else 5
 def stage_for(lap):return next(level['stage'] for level in levels if level['start']<=lap<=level['end'])
 for ri,row in enumerate(raw[hi+1:],hi+2):
  vals={k:cell(row,c) for k,c in keycols.items()};person=name(vals['name'])
  if not number(vals['seq']) or not person or not number(vals['boss']) or not 1<=vals['boss']<=5 or not number(vals['damage']):continue
  assert number(vals['lap']) and number(vals['day']) and number(cell(row,actual_col)) and number(vals['contribution']),(month,ri,vals)
  stage=cell(row,stage_col) if stage_col is not None else stage_for(vals['lap']);kind=str(vals['kind'] or '')
  # Older sheets' late column named 이월 contains generated seconds, not a carry-use flag.
  carry=vals['carry'] is True if stage_col is not None else '◆' in kind
  log={'seq':int(vals['seq']),'day':int(vals['day']),'stage':int(stage),'lap':int(vals['lap']),'boss':int(vals['boss']),'name':person,'damage':vals['damage'],'actual':cell(row,actual_col),'contribution':vals['contribution'],'carry':carry,'kill':vals['kill'] is True,'sourceRow':ri}
  for k in ['before','after','bonus']:
   if number(vals[k]):log[k]=vals[k]*(10000 if k=='bonus' and '가산점(만)' in h else 1)
  if game:log['game']=log['actual']*game[log['boss']][log['stage']]
  out['logs'].append(log)
 # Parse the first, monthly ranking table only; subsequent tables rank individual bosses.
 members={};metrics=['damage','contribution','game','dayDamage','dayContribution']
 for row in rankrows[4:34]:
  if not number(cell(row,1)):continue
  for i,key in enumerate(metrics):
   person=name(cell(row,2+i*3));value=cell(row,3+i*3)
   if not person or not number(value):continue
   p=members.setdefault(person,{'name':person,'uid':''});p[key]=value;p[key+'Rank']=int(row[1])
 title=' '.join(str(x) for row in rankrows[:3] for x in row);m=re.search(r'(\d+)일차',title);view=int(m[1]) if m else out['days']
 for key,eventkey in [('damage','actual'),('contribution','contribution')]+([('game','game')] if game else []):
  calculated=sum(l[eventkey] for l in out['logs'] if l['day']<=view);saved=sum(p.get(key,0) for p in members.values())
  if not close(calculated,saved):audit['issues'].append({'metric':key,'savedViewDay':view,'logs':calculated,'ranking':saved,'delta':calculated-saved})
  else:audit['checks'].append(key+' matches the saved ranking at day '+str(view))
 max_day=max(l['day'] for l in out['logs']);out['days']=max(out['days'] or 0,max_day)
 if view<max_day:
  assert game,(month,'cannot recover final in-game score without verified multipliers')
  assert all(isinstance(issue,str) or issue['metric']!='game' for issue in audit['issues']),(month,'game coefficients do not reproduce the saved score')
  for p in members.values():
   ls=[l for l in out['logs'] if l['name']==p['name']]
   for key,eventkey in [('damage','actual'),('contribution','contribution'),('game','game')]:p[key]=sum(l[eventkey] for l in ls)
  for p in members.values():
   last=[l for l in out['logs'] if l['name']==p['name'] and l['day']==max_day]
   p['dayDamage']=sum(l['actual'] for l in last);p['dayContribution']=sum(l['contribution'] for l in last)
  audit['checks'].append('Recovered the complete period from all attacks instead of a saved partial-day view')
 for row in ranges.get('roster',[]):
  person=name(cell(row,2));uid=cell(row,4)
  if person in members and uid is not None:members[person]['uid']=re.sub(r'\s+','',str(uid))
 unknown=set(l['name'] for l in out['logs'])-set(members)
 assert not unknown,(month,'unranked names',unknown)
 if month=='2020-04':
  out['dayDetailAvailable']=False
  for l in out['logs']:l['day']=None
  audit['issues'].append('Saved conversion puts all attacks on day 1; original daily cells are empty. Show monthly totals without invented day assignment.')
 for key in metrics:
  sorted_members=sorted(members.values(),key=lambda p:(-p.get(key,0),p['name']))
  if view<max_day:
   for i,p in enumerate(sorted_members,1):p[key+'Rank']=i
 if month in ['2020-06','2020-10']:
  out['awardSnapshotDiffers']=True
  audit['issues'].append('Saved Hall of Fame winners come from a partial-day snapshot; retain existing awards separately from the recovered full-period ranking.')
 out['members']=sorted(members.values(),key=lambda p:p.get('gameRank',999));out['memberCount']=len(out['members']);out['totals']={k:sum(p.get(k,0) for p in out['members']) for k in metrics}
 assert len(set(l['seq'] for l in out['logs']))==len(out['logs']),(month,'duplicate sequence')
 return out,audit

def main():
 input_dir,output_dir=map(Path,sys.argv[1:3]);reference=json.loads((input_dir/'clan-reference.json').read_text());all_months={};audits=[]
 for file in sorted(input_dir.glob('20??-??.json')):
  book=json.loads(file.read_text());d,a=parse_book(book,reference);all_months[d['month']]=d;audits.append(a)
 # Preserve known ranks and dormancy for months whose detailed records were lost.
 for ref in reference['monthlyHistory']:
  month=ref['month']
  if not '2019-07'<=month<='2023-12' or month in all_months:continue
  all_months[month]={'month':month,'source':'','clanRank':numeric_rank(ref.get('clanRank')),'rankLabel':str(ref.get('clanRank') or '미보관'),'memberCount':None,'coverage':'summary','days':None,'dayDetailAvailable':False,'bossNames':[],'totals':{k:None for k in ['damage','contribution','game']},'members':[],'logs':[],'notes':ref.get('notes','')}
 for year in range(2019,2024):
  entries=[]
  for month,d in sorted(all_months.items()):
   if not month.startswith(str(year)):continue
   ref=next((r for r in reference['monthlyHistory'] if r['month']==month),{})
   # Existing lifetime award totals already include these months; do not double-add.
   winners={k:[{'name':person,'rank':i+1} for i,person in enumerate(ref.get('winners',{}).get(k,[])) if person and '기록' not in person and '기 록' not in person] for k in ['damage','contribution','game']}
   entry={'month':month,'rank':d['clanRank'],'rankLabel':d['rankLabel'],'count':d['memberCount'],'attacks':len(d['logs']),'coverage':d['coverage'],'days':d['days'],'dayDetailAvailable':d['dayDetailAvailable'],'totals':d['totals'],'winners':winners,'source':d['source']}
   entries.append(entry);save(output_dir/f'history-{year}'/(month+'.json'),d)
  save(output_dir/f'history-{year}'/'manifest.json',{'year':year,'months':entries})
 save(output_dir/'historical-import-audit.json',{'sources':audits,'months':len(all_months),'attacks':sum(len(d['logs']) for d in all_months.values())})
 print(json.dumps({'months':len(all_months),'attacks':sum(len(d['logs']) for d in all_months.values()),'issues':[{k:a[k] for k in ['month','issues']} for a in audits if a['issues']]},ensure_ascii=False))
if __name__=='__main__':main()
