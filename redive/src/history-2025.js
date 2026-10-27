// Imported 2024-2025 monthly resumes; static/read-only, never written to the live API.
const oldResumeMonths=[2025,2024].flatMap(year=>Array.from({length:12},(_,i)=>year+'-'+String(12-i).padStart(2,'0')));
let oldResumeIndex=null,oldResumeMonth='',oldResumeData=null,oldResumeError='',oldResumePerson='',oldResumeSort='damage',oldResumeDay=0,oldResumePage=1,oldResumeRequest=0;
const oldResumeMeta=month=>oldResumeIndex?.months?.find(m=>m.month===month);
const oldResumeOptions=()=>[2025,2024].map(year=>'<optgroup label="'+year+'년 이력서">'+oldResumeMonths.filter(month=>month.startsWith(year+'-')).map(month=>'<option value="'+month+'" '+(month===oldResumeMonth?'selected':'')+'>'+month.replace('-','년 ')+'월</option>').join('')+'</optgroup>').join('');
const oldResumeLink=d=>'<p class="field-help">Google 시트의 '+X(d.month.slice(0,4))+'년 원본 기록 · 읽기 전용 <a target="_blank" rel="noopener noreferrer" href="'+X(d.source)+'">원본 이력서 보기</a></p>';
function oldResumeOpen(month){
 if(!oldResumeMonths.includes(month))return;
 oldResumeMonth=month;oldResumeData=null;oldResumeError='';oldResumePerson='__clan__';oldResumeSort='game';oldResumeDay=0;oldResumePage=1;oldResumeBoss=0;oldResumeLogType='all';oldResumeQuery='';oldResumeDetails=false;oldResumeSequence=false;oldResumeLogOrder='desc';oldResumeStage=0;oldResumeProfileDay=0;oldResumeMetric='damage';ext.archiveView='summary';
 nav('records','archive');
 const request=++oldResumeRequest;
 fetch(new URL('./history-'+month.slice(0,4)+'/'+month+'.json',import.meta.url),{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('이력서 기록을 불러오지 못했습니다.');return r.json();}).then(d=>{if(request!==oldResumeRequest)return;if(d.month!==month||!Array.isArray(d.members)||!Array.isArray(d.logs))throw Error('이력서 자료 형식 오류');oldResumeData=d;render();}).catch(e=>{if(request===oldResumeRequest){oldResumeError=e.message;render();}});
}
function oldResumePersonButton(p){
 return '<button type="button" class="text-button member-link" data-action="old-resume-person" data-name="'+X(p.name)+'">'+X(p.name)+'</button>';
}
function oldResumeTable(d){
 const metrics=[['game','인게임'],['contribution','기여도'],['damage','피해량']];
 const sorted=key=>[...d.members].sort((a,b)=>(a[key+'Rank']||999)-(b[key+'Rank']||999)||a.name.localeCompare(b.name,'ko'));
 const desktop='<div class="ranking-columns desktop-ranking">'+metrics.map(([key,label])=>'<section class="ranking-column"><h2>'+label+'</h2>'+rowTable(['순위','클랜원',label],sorted(key).map((p,i)=>'<tr><td class="center rank-cell desktop">'+(p[key+'Rank']||i+1)+'</td><td>'+oldResumePersonButton(p)+'</td><td class="right numeric"><strong>'+nf(p[key]||0)+'</strong></td></tr>'),'ranking-detail dense-table')+'</section>').join('')+'</div>';
 const selected=metrics.find(([key])=>key===oldResumeSort)?.[0]||'game';
 const mobile='<div class="table-wrap mobile-ranking"><table class="data-table ranking-unified"><thead><tr><th class="center">순위</th><th>클랜원</th>'+metrics.map(([key,label])=>'<th class="right" aria-sort="'+(selected===key?'descending':'none')+'"><button type="button" data-action="old-resume-sort" data-value="'+key+'">'+label+' '+(selected===key?'↓':'↕')+'</button></th>').join('')+'</tr></thead><tbody>'+sorted(selected).map(p=>'<tr><td class="center rank-cell">'+p[selected+'Rank']+'</td><td>'+oldResumePersonButton(p)+'</td>'+metrics.map(([key])=>'<td class="right numeric">'+nf(p[key]||0)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 return '<div class="toolbar"><span>5일차까지 · '+d.memberCount+'명</span>'+simpleButton('CSV','old-resume-csv')+'</div>'+desktop+mobile+oldResumeLink(d);
}
let oldResumeStage=0,oldResumeProfileDay=0,oldResumeMetric='damage';
function oldResumeShare(d,events,metric='damage'){
 const counts=[1,2,3,4,5].map(boss=>({boss,name:d.bossNames[boss-1]||'',value:events.filter(l=>l.boss===boss).reduce((s,l)=>s+(metric==='contribution'?l.contribution:l.actual),0)}));
 const total=counts.reduce((s,x)=>s+x.value,0),circ=2*Math.PI*66;
 let offset=0;
 const arcs=counts.map(x=>{const fraction=total?x.value/total:0,start=offset;offset+=fraction;return fraction?'<circle class="share-arc" cx="92" cy="92" r="66" fill="none" stroke="var(--b'+x.boss+')" stroke-width="16" stroke-dasharray="'+Math.max(0,circ*fraction-3)+' '+circ+'" stroke-dashoffset="'+(-circ*start)+'" transform="rotate(-90 92 92)"><title>'+x.boss+'넴 '+X(x.name)+' · '+(fraction*100).toFixed(1)+'%</title></circle>':'';}).join('');
 return '<div class="rich-share"><div class="share-visual"><svg viewBox="0 0 184 184" class="ring-chart" role="img" aria-label="보스별 '+(metric==='contribution'?'기여도':'피해량')+' 비중"><circle cx="92" cy="92" r="66" class="ring-base" fill="none" stroke-width="16"></circle>'+arcs+'</svg><div class="ring-center"><span>합계</span><strong class="numeric">'+chartValue(total,metric)+'</strong><small>'+(metric==='contribution'?'기여도':'피해량')+'</small></div></div><div class="boss-share-legend">'+counts.map(x=>'<div class="share-boss-name" style="'+bossStyle(x.boss)+'"><b>'+x.boss+'넴</b><small>'+X(x.name)+'</small><span class="share-bar"><i style="width:'+(total?x.value/total*100:0)+'%"></i></span><strong class="numeric">'+(total?x.value/total*100:0).toFixed(1)+'%</strong></div>').join('')+'</div></div>';
}
function oldResumeProfileBars(events){
 const days=Array.from({length:5},(_,i)=>{const rows=events.filter(l=>l.day===i+1);return {day:i+1,damage:rows.reduce((s,l)=>s+l.actual,0),contribution:rows.reduce((s,l)=>s+l.contribution,0)};});
 const maxDamage=Math.max(1,...days.map(x=>x.damage)),maxContribution=Math.max(1,...days.map(x=>x.contribution));
 return '<section class="daily-paired-bars"><div class="paired-heading"><h3>피해량</h3><h3>기여도</h3></div>'+days.map(x=>'<div class="paired-day"><div class="paired-value damage"><strong class="numeric">'+nf(x.damage)+'</strong><span><i style="width:'+(x.damage/maxDamage*100)+'%"></i></span></div><b>'+x.day+'일차</b><div class="paired-value contribution"><strong class="numeric">'+nf(x.contribution)+'</strong><span><i style="width:'+(x.contribution/maxContribution*100)+'%"></i></span></div></div>').join('')+'</section>';
}
function oldResumePhaseShares(d,events){
 return '<section class="profile-phase-shares"><h2>단계별 보스 공격 비중</h2><p class="chart-note">실제 피해량 기준 · 월 전체</p><div class="phase-share-grid">'+[[0,'종합'],[2,'2단계'],[3,'3단계'],[4,'4단계']].map(([stage,label])=>{
  const rows=stage?events.filter(l=>l.stage===stage):events,total=rows.reduce((s,l)=>s+l.actual,0),amounts=[1,2,3,4,5].map(boss=>rows.filter(l=>l.boss===boss).reduce((s,l)=>s+l.actual,0));let offset=0;
  const parts=amounts.map((val,i)=>{const start=offset;offset+=total?val/total*100:0;return 'var(--b'+(i+1)+') '+start+'% '+offset+'%';});
  const legend=amounts.map((value,i)=>'<span><i style="background:var(--b'+(i+1)+')"></i>'+(i+1)+'넴 <b>'+(total?value/total*100:0).toFixed(1)+'%</b></span>').join('');
  return '<figure class="phase-share"><figcaption>'+label+'</figcaption><div class="phase-donut" role="img" aria-label="'+label+'" style="background:'+(total?'conic-gradient('+parts.join(',')+')':'var(--line)')+'"><span><strong>'+rows.length+'</strong>타</span></div><div class="phase-legend">'+legend+'</div></figure>';
 }).join('')+'</div></section>';
}
function oldResumeProfile(d){
 const all=oldResumePerson==='__clan__',p=all?null:d.members.find(x=>x.name===oldResumePerson)||d.members[0],name=all?'클랜 전체':p?.name;
 if(!name)return '<p class="no-rows">개인 기록 없음</p>';
 const stages=[2,3,4].filter(stage=>d.logs.some(l=>l.stage===stage));
 const whole=d.logs.filter(l=>all||l.name===name),events=whole.filter(l=>(!oldResumeStage||l.stage===oldResumeStage)&&(!oldResumeProfileDay||l.day===oldResumeProfileDay));
 const score=key=>!oldResumeStage&&!oldResumeProfileDay?(all?d.totals[key]:p[key]):key==='game'?null:events.reduce((v,l)=>v+(key==='damage'?l.actual:l.contribution),0);
 const toolbar='<div class="toolbar profile-toolbar"><select id="full-profile-member" class="select-field" aria-label="기록 대상" data-input="old-resume-person"><option value="__clan__" '+(all?'selected':'')+'>클랜 전체</option>'+d.members.map(m=>'<option value="'+X(m.name)+'" '+(!all&&m.name===name?'selected':'')+'>'+X(m.name)+'</option>').join('')+'</select><select class="select-field" aria-label="이력 단계" data-input="old-resume-stage"><option value="0" '+(!oldResumeStage?'selected':'')+'>전체 단계</option>'+stages.map(stage=>'<option value="'+stage+'" '+(stage===oldResumeStage?'selected':'')+'>'+stage+'단계</option>').join('')+'</select>'+simpleButton('PDF 보기','old-resume-pdf-preview','','primary')+simpleButton('PDF 저장','old-resume-pdf-download','','quiet')+simpleButton('인쇄','old-resume-print','','quiet')+'</div>';
 const totals='<dl class="profile-totals">'+[['damage','피해량'],['contribution','기여도'],['game','인게임']].map(([key,label])=>'<div><dt>'+label+'</dt><dd>'+ (score(key)===null?'—':key==='contribution'?nf(Math.round(score(key))):nf(score(key)))+'</dd></div>').join('')+'</dl>';
 const pills='<div class="day-pills" role="group" aria-label="개인 이력 일차">'+[[0,'전체'],[1,'1일차'],[2,'2일차'],[3,'3일차'],[4,'4일차'],[5,'5일차']].map(([day,label])=>'<button type="button" data-action="old-resume-profile-day" data-value="'+day+'" class="'+(oldResumeProfileDay===day?'active':'')+'" aria-pressed="'+(oldResumeProfileDay===day)+'">'+label+'</button>').join('')+'</div>';
 const metric='<div class="filter-group" role="group" aria-label="개인 이력 지표">'+[['damage','피해량'],['contribution','기여도']].map(([key,label])=>'<button type="button" data-action="old-resume-metric" data-value="'+key+'" class="'+(oldResumeMetric===key?'active':'')+'">'+label+'</button>').join('')+'</div>';
 const donut='<section class="profile-donut"><div class="profile-chart-controls">'+pills+metric+'</div>'+oldResumeShare(d,events,oldResumeMetric)+'<div class="profile-chart-foot">'+(oldResumeProfileDay?oldResumeProfileDay+'일차':'전체 일차')+' · 공격 '+events.length+'건</div></section>';
 const daily=Array.from({length:5},(_,i)=>{const r=whole.filter(l=>l.day===i+1&&(!oldResumeStage||l.stage===oldResumeStage));return '<tr><td>'+(i+1)+'일차</td><td class="right numeric">'+nf(r.reduce((v,l)=>v+l.actual,0))+'</td><td class="right numeric">'+nf(r.reduce((v,l)=>v+l.contribution,0))+'</td></tr>';});
 const attacks=events.map(l=>'<tr><td>'+l.day+'일차</td><td>'+l.boss+'넴</td><td class="attack-phase">'+l.stage+'단계 '+l.lap+'회차</td><td class="right numeric">'+nf(l.actual)+'</td><td class="right numeric">'+nf(l.contribution)+'</td><td class="center">'+(l.carry?'사용':'—')+'</td></tr>');
 return toolbar+totals+oldResumeProfileBars(whole.filter(l=>!oldResumeStage||l.stage===oldResumeStage))+donut+oldResumePhaseShares(d,whole)+
 '<details class="fold"><summary>일차별 수치</summary>'+rowTable(['일차','피해량','기여도'],daily,'daily-records exact-table')+'</details>'+
 '<details class="fold"><summary>보스별 통계</summary>'+oldResumeStats(d,events)+'</details>'+
 '<details class="fold"><summary>단계별 통계</summary>'+stages.map(stage=>'<h3 class="detail-stage-heading">'+stage+'단계</h3>'+oldResumeStats(d,whole.filter(l=>l.stage===stage))).join('')+'</details>'+
 '<details class="fold"><summary>공격 상세 · '+events.length+'건</summary>'+rowTable(['일차','보스','단계·회차','실제 피해량','기여도','이월'],attacks,'profile-attacks exact-table')+'</details>'+oldResumeLink(d);
}
let oldResumeBoss=0,oldResumeLogType='all',oldResumeQuery='',oldResumeDetails=false,oldResumeSequence=false,oldResumeLogOrder='desc';
function oldResumeLogs(d){
 const bossSelector='<select class="select-field" data-input="old-resume-boss" aria-label="보스"><option value="0">전체 보스</option>'+d.bossNames.map((name,i)=>'<option value="'+(i+1)+'" '+(oldResumeBoss===i+1?'selected':'')+'>'+(i+1)+'넴 '+X(name)+'</option>').join('')+'</select>';
 const daySelector='<div class="day-switch" role="group" aria-label="조회 일차">'+[1,2,3,4,5].map(day=>'<button type="button" data-action="old-resume-day" data-value="'+day+'" class="'+(oldResumeDay===day?'active':'')+'" aria-pressed="'+(oldResumeDay===day)+'">'+day+'일차</button>').join('')+'</div>';
 const typeSelector='<select class="select-field" data-input="old-resume-type" aria-label="공격 유형">'+[['all','전체 유형'],['normal','일반'],['kill','격파'],['carry','이월타']].map(([val,label])=>'<option value="'+val+'" '+(oldResumeLogType===val?'selected':'')+'>'+label+'</option>').join('')+'</select>';
 const toolbar='<div class="toolbar"><div class="toolbar-left">'+bossSelector+'<label class="inline-check"><input type="checkbox" data-input="old-resume-all-days" '+(oldResumeDay===0?'checked':'')+'>전체 일차</label>'+daySelector+'</div><div class="toolbar-right"><input class="search-input" id="complete-log-search" data-input="old-resume-query" value="'+X(oldResumeQuery)+'" placeholder="이름 · 초성 · 순번" aria-label="공격 기록 검색">'+typeSelector+'</div></div>';
 const query=oldResumeQuery.trim().toLocaleLowerCase('ko');
 let rows=d.logs.filter(l=>(!oldResumeDay||l.day===oldResumeDay)&&(!oldResumeBoss||l.boss===oldResumeBoss)&&(oldResumeLogType==='all'||oldResumeLogType==='carry'&&l.carry||oldResumeLogType==='kill'&&l.kill||oldResumeLogType==='normal'&&!l.carry&&!l.kill)&&(!query||l.name.toLocaleLowerCase('ko').includes(query)||String(l.seq).includes(query)));
 rows=rows.slice().sort((a,b)=>oldResumeLogOrder==='asc'?a.seq-b.seq:b.seq-a.seq);
 const pages=Math.max(1,Math.ceil(rows.length/50));
 oldResumePage=Math.min(Math.max(1,oldResumePage),pages);
 const controls='<div class="table-tools"><span>'+(oldResumeDay===0?'전체':oldResumeDay+'일차')+' · '+rows.length+'건 · 확정</span><div><label class="inline-check"><input type="checkbox" data-input="old-resume-sequence" '+(oldResumeSequence?'checked':'')+'>순번</label><label class="inline-check"><input type="checkbox" data-input="old-resume-details" '+(oldResumeDetails?'checked':'')+'>상세</label>'+simpleButton('등록순 '+(oldResumeLogOrder==='asc'?'↑':'↓'),'old-resume-order')+simpleButton('CSV','old-resume-csv')+'</div></div>';
 const headers=[...(oldResumeSequence?['순번']:[]),'일차 · 회차','보스','클랜원','기록 피해량',...(oldResumeDetails?['이전 HP','실제 피해량','남은 HP','가산점','기여도','인게임']:[]),'유형'];
 const display=rows.slice((oldResumePage-1)*50,oldResumePage*50).map(l=>{
  const type=l.kill?(l.carry?'관통':'격파'):l.carry?'이월타':'일반';
  return '<tr>'+(oldResumeSequence?'<td class="hide-on-narrow">'+l.seq+'</td>':'')+'<td class="progress-cell"><span>'+l.day+'일차</span><small>'+l.stage+'단계 '+l.lap+'회차</small></td><td><span class="boss-tag" style="'+bossStyle(l.boss)+'">'+l.boss+'넴</span></td><td>'+oldResumePersonButton({name:l.name})+'</td><td class="right numeric">'+nf(l.damage)+'</td>'+
  (oldResumeDetails?'<td class="right numeric extra-cell" data-label="이전 HP">—</td><td class="right numeric extra-cell" data-label="실제 피해량">'+nf(l.actual)+'</td><td class="right numeric extra-cell" data-label="남은 HP">—</td><td class="right numeric extra-cell" data-label="가산점">—</td><td class="right numeric extra-cell" data-label="기여도">'+nf(l.contribution)+'</td><td class="right numeric extra-cell" data-label="인게임">—</td>':'')+
  '<td><span class="type-tag '+(l.kill?'kill':l.carry?'carry':'')+'">'+type+'</span></td></tr>';
 });
 const pagination='<div class="pagination"><span>'+ (rows.length?(oldResumePage-1)*50+1+'–'+Math.min(oldResumePage*50,rows.length):'0')+' / '+rows.length+'건</span><div><button type="button" data-action="old-resume-page" data-value="'+(oldResumePage-1)+'" '+(oldResumePage===1?'disabled':'')+'>이전</button><span>'+oldResumePage+'/'+pages+'</span><button type="button" data-action="old-resume-page" data-value="'+(oldResumePage+1)+'" '+(oldResumePage>=pages?'disabled':'')+'>다음</button></div></div>';
 return toolbar+controls+rowTable(headers,display,'battle-table '+(oldResumeDetails?'expanded':''))+pagination+oldResumeLink(d);
}
function oldResumeStats(d,logs){
 return rowTable(['보스','공격 수','피해량 합계','평균 피해량','최고 피해량'],[1,2,3,4,5].map(boss=>{
  const rows=logs.filter(e=>e.boss===boss),total=rows.reduce((n,e)=>n+e.actual,0);
  return '<tr><td><span class="boss-stat-name"><span class="boss-tag" style="'+bossStyle(boss)+'">'+boss+'넴</span></span></td><td class="right">'+rows.length+'</td><td class="right numeric">'+nf(total)+'</td><td class="right numeric">'+nf(rows.length?Math.round(total/rows.length):0)+'</td><td class="right numeric">'+nf(Math.max(0,...rows.map(e=>e.actual)))+'</td></tr>';
 }),'boss-statistics');
}
function oldResumeArchive(){
 const years=Object.keys(data.seasons).sort().reverse();
 const selector='<div class="archive-selector"><label for="archive-month">조회 월</label><select id="archive-month" class="select-field" data-input="v2-archive-month">'+years.map(month=>'<option value="'+month+'">'+month.replace('-','년 ')+'월</option>').join('')+oldResumeOptions()+'</select><div class="subview-tabs">'+[['summary','요약'],['logs','배틀로그'],['ranking','순위'],['profile','개인 이력'],['tactics','택틱']].map(([key,label])=>'<button type="button" data-action="v2-archive-view" data-value="'+key+'" class="'+(ext.archiveView===key?'active':'')+'">'+label+'</button>').join('')+'</div></div>';
 if(!oldResumeData)return selector+'<section class="sheet"><p class="no-rows">'+X(oldResumeError||'이력서 기록을 불러오는 중입니다.')+'</p></section>';
 const d=oldResumeData;
 if(ext.archiveView==='logs')return selector+oldResumeLogs(d);
 if(ext.archiveView==='ranking')return selector+oldResumeTable(d);
 if(ext.archiveView==='profile')return selector+oldResumeProfile(d);
 if(ext.archiveView==='tactics')return selector+boardSection('택틱', '<p class="no-rows">이력서에 포함된 택틱은 아직 사이트의 택틱 데이터 형식으로 이관되지 않았습니다.</p>')+oldResumeLink(d);
 const details=(oldResumeIndex?.months||[]).map(m=>'<tr><td>'+m.month.replace('-','.')+'</td><td class="center">'+m.count+'명</td><td class="right numeric">'+nf(m.totals.game)+'</td><td class="center">'+m.rank+'위</td><td>확정</td><td>'+simpleButton('상세','old-resume-open',m.month,'quiet')+'</td></tr>');
 const current=years.filter(m=>!(oldResumeIndex?.months||[]).some(o=>o.month===m)).map(month=>{const sum=seasonSummary(month);return '<tr><td>'+month.replace('-','.')+'</td><td class="center">'+sum.count+'명</td><td class="right numeric">'+nf(sum.gameTotal)+'</td><td class="center">'+(sum.rank?sum.rank+'위':'미입력')+'</td><td>'+(sum.sealed?'확정':'진행 중')+'</td><td>'+simpleButton('상세','archive-detail',month,'quiet')+'</td></tr>';});
 const allRows=[...current,...details].sort((a,b)=>{const get=t=>t.match(/<td>(\d{4}\.\d{2})/)?.[1]||'';return get(b).localeCompare(get(a));});
 return selector+'<dl class="archive-totals"><div><dt>클랜 순위</dt><dd>'+d.clanRank+'위</dd></div><div><dt>총 인게임 점수</dt><dd>'+nf(d.totals.game)+'</dd></div><div><dt>참가</dt><dd>'+d.memberCount+'명</dd></div><div><dt>공격</dt><dd>'+d.logs.length+'건</dd></div></dl>'+
 boardSection('월별 기록',rowTable(['월','참가','인게임 점수','클랜 순위','결과','열기'],allRows,'archive-month-table exact-table'))+
 boardSection('단계별 보스 통계',[2,3,4].map(stage=>'<details class="fold" '+(stage===4?'open':'')+'><summary>'+stage+'단계</summary>'+oldResumeStats(d,d.logs.filter(e=>e.stage===stage))+'</details>').join(''))+oldResumeLink(d);
}
const oldResumeBaseArchive=completeArchive;
completeArchive=()=>oldResumeMonth?oldResumeArchive():oldResumeBaseArchive().replace('</select>',oldResumeOptions()+'</select>');
const oldResumeBaseHistory=completeHistory;
completeHistory=()=>{
 const html=oldResumeBaseHistory(),entries=oldResumeIndex?.months;
 if(!entries)return html+'<p class="field-help">2024~2025년 이력서 목록을 불러오는 중입니다.</p>';
 return html+[2025,2024].map(year=>{
  const months=entries.filter(m=>m.month.startsWith(year+'-'));
  const rows=months.filter(m=>!historyMonths().includes(m.month)).map(m=>'<tr><td>'+m.month.replace('-','.')+'</td><td class="center">'+m.rank+'위</td><td class="center">'+m.count+'명</td>'+['game','contribution','damage'].map(key=>'<td>'+m.winners[key].map(p=>X(p.name)).join(' · ')+'</td>').join('')+'<td><button class="text-button" data-action="old-resume-open" data-id="'+m.month+'">상세</button></td></tr>');
  const monthButtons='<div class="toolbar"><div class="toolbar-left">'+months.map(m=>'<button type="button" class="button" data-action="old-resume-open" data-id="'+m.month+'">'+m.month.slice(-2)+'월</button>').join('')+'</div></div>';
  return boardSection(year+'년 원본 이력서',monthButtons+(rows.length?rowTable(['월','클랜 순위','참가','인게임 1·2위','기여도 1·2위','피해량 1·2위','열기'],rows,'exact-table'):''));
 }).join('');
};
const oldResumeBaseHall=completeHall;
completeHall=()=>{
 const html=oldResumeBaseHall(),entries=oldResumeIndex?.months;
 if(!entries)return html;
 return html+[2025,2024].map(year=>{
  const map=new Map();
  for(const entry of entries.filter(m=>m.month.startsWith(year+'-')))for(const k of ['game','contribution','damage'])for(const p of entry.winners[k]||[]){
   const row=map.get(p.name)||{name:p.name,game:[0,0],contribution:[0,0],damage:[0,0],total:0};
   row[k][p.rank-1]++;row.total++;map.set(p.name,row);
  }
  const rows=[...map.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'ko')).map(p=>'<tr><td>'+X(p.name)+'</td>'+['game','contribution','damage'].map(k=>'<td class="center">1위 '+p[k][0]+' / 2위 '+p[k][1]+'</td>').join('')+'<td class="center">'+p.total+'</td></tr>');
  return boardSection(year+'년 원본 이력서 수상 내역 (별도)',rowTable(['클랜원','인게임','기여도','피해량','수상 합계'],rows,'exact-table'));
 }).join('')+'<p class="field-help">연도별 원본 기준 별도 집계로, 기존 공용 수상 횟수에 중복 합산하지 않습니다.</p>';
};
async function oldResumePDF(preview){
 const d=oldResumeData;if(!d)return;
 const all=oldResumePerson==='__clan__',person=all?null:d.members.find(p=>p.name===oldResumePerson)||d.members[0],events=d.logs.filter(l=>all||l.name===person?.name);
 const summary=all?d.totals:person;
 const module=await import('./report-pdf.mjs?v=20261027-summary04');
 await module[preview?'previewProfilePdf':'downloadProfilePdf']({
  target:document.body,downloadLabel:'PDF 저장',copy:v=>v,month:d.month,day:5,days:5,all,
  p:person?{name:person.name,uid:person.uid,tenureMonths:null}:null,
  bosses:d.bossNames.map((name,i)=>({id:i+1,name})),events,contribution:l=>l.contribution,
  summary:{name:all?'클랜 전체':person.name,damage:summary.damage,contribution:summary.contribution,game:summary.game}
 });
}
function oldResumeCSV(){
 const d=oldResumeData;if(!d)return;
 if(ext.archiveView==='ranking'){
  downloadCsv([['순위','클랜원','피해량','기여도','인게임'],...d.members.map(p=>[p[oldResumeSort+'Rank'],p.name,p.damage,p.contribution,p.game])],'월간순위_'+d.month+'.csv');
 }else{
  const rows=d.logs.filter(l=>(!oldResumeDay||l.day===oldResumeDay)&&(!oldResumeBoss||l.boss===oldResumeBoss));
  downloadCsv([['순번','일차','단계','회차','보스','클랜원','기록 피해량','실제 피해량','기여도','이월','격파'],...rows.map(l=>[l.seq,l.day,l.stage,l.lap,l.boss,l.name,l.damage,l.actual,l.contribution,l.carry?'사용':'',l.kill?'격파':''])],'배틀로그_'+d.month+'.csv');
 }
}
document.addEventListener('change',event=>{
 const input=event.target,key=input?.dataset?.input;
 if(key==='v2-archive-month'){
  if(oldResumeMonths.includes(input.value)){event.preventDefault();event.stopImmediatePropagation();oldResumeOpen(input.value);}
  else if(oldResumeMonth){oldResumeRequest++;oldResumeMonth='';oldResumeData=null;}
  return;
 }
 const changes={
  'old-resume-person':()=>{oldResumePerson=input.value;oldResumeProfileDay=0;},
  'old-resume-stage':()=>{oldResumeStage=Number(input.value);oldResumeProfileDay=0;},
  'old-resume-boss':()=>{oldResumeBoss=Number(input.value);oldResumePage=1;},
  'old-resume-type':()=>{oldResumeLogType=input.value;oldResumePage=1;},
  'old-resume-all-days':()=>{oldResumeDay=input.checked?0:5;oldResumePage=1;},
  'old-resume-sequence':()=>{oldResumeSequence=input.checked;},
  'old-resume-details':()=>{oldResumeDetails=input.checked;}
 };
 if(changes[key]){event.preventDefault();event.stopImmediatePropagation();changes[key]();render();}
},true);
document.addEventListener('input',event=>{
 const el=event.target;
 if(el?.dataset?.input!=='old-resume-query')return;
 event.stopImmediatePropagation();
 oldResumeQuery=el.value;oldResumePage=1;const cursor=el.selectionStart;
 render();
 const field=document.querySelector('[data-input="old-resume-query"]');if(field){field.focus();field.setSelectionRange(cursor,cursor);}
},true);
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');if(!button)return;
 const action=button.dataset.action;
 const supported=['old-resume-open','old-resume-person','old-resume-sort','old-resume-day','old-resume-page','old-resume-profile-day','old-resume-metric','old-resume-order','old-resume-csv','old-resume-pdf-preview','old-resume-pdf-download','old-resume-print'];
 if(!supported.includes(action))return;
 event.preventDefault();event.stopImmediatePropagation();
 if(action==='old-resume-open'){oldResumeOpen(button.dataset.id);return;}
 if(action==='old-resume-person'){oldResumePerson=button.dataset.name;oldResumeProfileDay=0;ext.archiveView='profile';render();return;}
 if(action==='old-resume-sort'){oldResumeSort=button.dataset.value;render();return;}
 if(action==='old-resume-day'){oldResumeDay=Number(button.dataset.value);oldResumePage=1;render();return;}
 if(action==='old-resume-page'){oldResumePage=Number(button.dataset.value);render();return;}
 if(action==='old-resume-profile-day'){oldResumeProfileDay=Number(button.dataset.value);render();return;}
 if(action==='old-resume-metric'){oldResumeMetric=button.dataset.value;render();return;}
 if(action==='old-resume-order'){oldResumeLogOrder=oldResumeLogOrder==='asc'?'desc':'asc';oldResumePage=1;render();return;}
 if(action==='old-resume-csv'){oldResumeCSV();return;}
 if(action==='old-resume-print'){window.print();return;}
 if(action==='old-resume-pdf-preview'||action==='old-resume-pdf-download')void oldResumePDF(action==='old-resume-pdf-preview').catch(error=>{console.error(error);toast('PDF 생성 실패: '+error.message);});
},true);
async function oldResumeLoadIndex(){
 try{
  const indexList=await Promise.all([2025,2024].map(async year=>{
   const res=await fetch(new URL('./history-'+year+'/manifest.json',import.meta.url),{cache:'force-cache'});
   if(!res.ok)throw Error(year+'년 이력서 목록 다운로드 실패');
   const index=await res.json();
   if(index.year!==year||index.months?.length!==12)throw Error(year+'년 이력서 목록이 올바르지 않습니다.');
   return index;
  }));
  oldResumeIndex={months:indexList.flatMap(index=>index.months).sort((a,b)=>b.month.localeCompare(a.month))};
  if(ui.section==='records'&&['history','hall','archive'].includes(ui.tabs.records))render();
 }catch(e){oldResumeError=e.message;}
}
void oldResumeLoadIndex();
