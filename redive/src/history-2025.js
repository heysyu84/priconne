// Imported 2025 monthly resumes; static/read-only, never written to the live API.
const oldResumeMonths=Array.from({length:12},(_,i)=>'2025-'+String(12-i).padStart(2,'0'));
let oldResumeIndex=null,oldResumeMonth='',oldResumeData=null,oldResumeError='',oldResumePerson='',oldResumeSort='damage',oldResumeDay=0,oldResumePage=1,oldResumeRequest=0;
const oldResumeMeta=month=>oldResumeIndex?.months?.find(m=>m.month===month);
const oldResumeOptions=()=>'<optgroup label="2025년 이력서">'+oldResumeMonths.map(month=>'<option value="'+month+'" '+(month===oldResumeMonth?'selected':'')+'>'+month.replace('-','년 ')+'월</option>').join('')+'</optgroup>';
const oldResumeLink=d=>'<p class="field-help">Google 시트의 2025년 원본 기록 · 읽기 전용 <a target="_blank" rel="noopener noreferrer" href="'+X(d.source)+'">원본 이력서 보기</a></p>';
function oldResumeOpen(month){
 if(!oldResumeMonths.includes(month))return;
 oldResumeMonth=month;oldResumeData=null;oldResumeError='';oldResumePerson='';oldResumeSort='damage';oldResumeDay=0;oldResumePage=1;ext.archiveView='summary';
 nav('records','archive');
 const request=++oldResumeRequest;
 fetch(new URL('./history-2025/'+month+'.json',import.meta.url),{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('이력서 기록을 불러오지 못했습니다.');return r.json();}).then(d=>{if(request!==oldResumeRequest)return;if(d.month!==month||!Array.isArray(d.members)||!Array.isArray(d.logs))throw Error('이력서 자료 형식 오류');oldResumeData=d;render();}).catch(e=>{if(request===oldResumeRequest){oldResumeError=e.message;render();}});
}
function oldResumeTable(d){
 const order=[...d.members].sort((a,b)=>(a[oldResumeSort+'Rank']||999)-(b[oldResumeSort+'Rank']||999));
 const sort='<div class="toolbar"><div class="toolbar-left">'+[['damage','피해량'],['contribution','기여도'],['game','인게임']].map(([key,title])=>'<button type="button" class="button '+(oldResumeSort===key?'selected':'')+'" data-action="old-resume-sort" data-value="'+key+'">'+title+' 순위</button>').join('')+'</div></div>';
 const rows=order.map(p=>'<tr><td class="center">'+(p[oldResumeSort+'Rank']||'—')+'</td><td><button type="button" class="text-button member-link" data-action="old-resume-person" data-name="'+X(p.name)+'">'+X(p.name)+'</button></td><td class="right numeric">'+nf(p.damage||0)+'</td><td class="right numeric">'+nf(p.contribution||0)+'</td><td class="right numeric">'+nf(p.game||0)+'</td></tr>');
 return sort+rowTable(['순위','클랜원','피해량','기여도','인게임'],rows,'exact-table')+oldResumeLink(d);
}
function oldResumeProfile(d){
 const p=d.members.find(x=>x.name===oldResumePerson)||d.members[0];if(!p)return '<p class="no-rows">이력서 없음</p>';
 const select='<div class="toolbar"><label for="old-resume-person">클랜원</label><select id="old-resume-person" class="select-field" data-input="old-resume-person">'+d.members.map(m=>'<option value="'+X(m.name)+'" '+(m.name===p.name?'selected':'')+'>'+X(m.name)+'</option>').join('')+'</select></div>';
 const scores=boardSection(X(p.name)+' · '+d.month+' 이력서',rowTable(['항목','기록','순위'],[['피해량','damage'],['기여도','contribution'],['인게임 점수','game']].map(([label,key])=>'<tr><td>'+label+'</td><td class="right numeric">'+nf(p[key]||0)+'</td><td class="center">'+(p[key+'Rank']||'—')+'위</td></tr>'))+'<p class="field-help">회원번호 '+X(p.uid||'미확인')+'</p>');
 const logs=d.logs.filter(l=>l.name===p.name);
 const sum=ls=>[ls.length,nf(ls.reduce((v,l)=>v+l.actual,0)),nf(ls.reduce((v,l)=>v+l.contribution,0))];
 const daily=Array.from({length:5},(_,i)=>{const x=sum(logs.filter(l=>l.day===i+1));return '<tr><td>'+(i+1)+'일차</td><td class="right">'+x[0]+'</td><td class="right numeric">'+x[1]+'</td><td class="right numeric">'+x[2]+'</td></tr>';});
 const boss=Array.from({length:5},(_,i)=>{const x=sum(logs.filter(l=>l.boss===i+1));return '<tr><td>'+(i+1)+'넴 '+X(d.bossNames[i]||'')+'</td><td class="right">'+x[0]+'</td><td class="right numeric">'+x[1]+'</td><td class="right numeric">'+x[2]+'</td></tr>';});
 return select+scores+boardSection('일차별 공격 기록',rowTable(['일차','타수','피해량','기여도'],daily,'exact-table'))+boardSection('보스별 공격 기록',rowTable(['보스','타수','피해량','기여도'],boss,'exact-table'))+oldResumeLink(d);
}
function oldResumeLogs(d){
 const filter='<div class="toolbar"><div class="toolbar-left">'+[0,1,2,3,4,5].map(n=>'<button type="button" class="button '+(oldResumeDay===n?'selected':'')+'" data-action="old-resume-day" data-value="'+n+'">'+(n?n+'일차':'전체 일차')+'</button>').join('')+'</div></div>';
 const logs=d.logs.filter(l=>!oldResumeDay||l.day===oldResumeDay).slice().reverse(),pages=Math.max(1,Math.ceil(logs.length/50));
 oldResumePage=Math.min(Math.max(1,oldResumePage),pages);
 const rows=logs.slice((oldResumePage-1)*50,oldResumePage*50).map(l=>'<tr><td class="center">'+l.seq+'</td><td class="center">'+l.day+'일차</td><td class="center">'+l.lap+'회차</td><td class="center">'+l.boss+'넴</td><td>'+X(l.name)+'</td><td class="right numeric">'+nf(l.actual)+'</td><td class="right numeric">'+nf(l.contribution)+'</td><td class="center">'+(l.carry?'이월':l.kill?'격파':'일반')+'</td></tr>');
 const paged='<div class="table-tools"><span>'+logs.length+'건 · '+oldResumePage+'/'+pages+'페이지</span><div><button type="button" class="button" data-action="old-resume-page" data-value="'+(oldResumePage-1)+'" '+(oldResumePage===1?'disabled':'')+'>이전</button><button type="button" class="button" data-action="old-resume-page" data-value="'+(oldResumePage+1)+'" '+(oldResumePage===pages?'disabled':'')+'>다음</button></div></div>';
 return filter+rowTable(['순번','일차','회차','보스','클랜원','실제 피해량','기여도','유형'],rows,'exact-table')+paged+oldResumeLink(d);
}
function oldResumeArchive(){
 const selector='<div class="archive-selector"><label for="archive-month">조회 월</label><select id="archive-month" class="select-field" data-input="v2-archive-month">'+Object.keys(data.seasons).sort().reverse().map(m=>'<option value="'+m+'">'+m.replace('-','년 ')+'월</option>').join('')+oldResumeOptions()+'</select><div class="subview-tabs">'+[['summary','요약'],['ranking','순위'],['profile','개인 이력'],['logs','배틀로그']].map(([k,title])=>'<button type="button" data-action="v2-archive-view" data-value="'+k+'" class="'+(ext.archiveView===k?'active':'')+'">'+title+'</button>').join('')+'</div></div>';
 if(!oldResumeData)return selector+'<section class="sheet"><p class="no-rows">'+X(oldResumeError||'이력서 기록을 불러오는 중입니다.')+'</p></section>';
 const d=oldResumeData;
 if(ext.archiveView==='ranking')return selector+oldResumeTable(d);
 if(ext.archiveView==='profile')return selector+oldResumeProfile(d);
 if(ext.archiveView==='logs')return selector+oldResumeLogs(d);
 const m=oldResumeMeta(d.month),names=k=>(m?.winners?.[k]||[]).map(w=>w.rank+'위 '+X(w.name)).join(' · ')||'—';
 const totals=boardSection('2025년 '+d.month.slice(-2)+'월 클랜 성적',rowTable(['항목','합계'],[
  '<tr><td>피해량</td><td class="right numeric">'+nf(d.totals.damage)+'</td></tr>',
  '<tr><td>기여도</td><td class="right numeric">'+nf(d.totals.contribution)+'</td></tr>',
  '<tr><td>인게임 점수</td><td class="right numeric">'+nf(d.totals.game)+'</td></tr>'
 ]));
 const winners=boardSection('월별 수상',rowTable(['항목','1·2위'],[
  '<tr><td>인게임</td><td>'+names('game')+'</td></tr>',
  '<tr><td>기여도</td><td>'+names('contribution')+'</td></tr>',
  '<tr><td>피해량</td><td>'+names('damage')+'</td></tr>'
 ]));
 return selector+'<dl class="archive-totals"><div><dt>클랜 순위</dt><dd>'+d.clanRank+'위</dd></div><div><dt>참가</dt><dd>'+d.memberCount+'명</dd></div><div><dt>공격 기록</dt><dd>'+d.logs.length+'건</dd></div></dl>'+totals+winners+oldResumeLink(d);
}
const oldResumeBaseArchive=completeArchive;
completeArchive=()=>oldResumeMonth?oldResumeArchive():oldResumeBaseArchive().replace('</select>',oldResumeOptions()+'</select>');
const oldResumeBaseHistory=completeHistory;
completeHistory=()=>{
 const html=oldResumeBaseHistory(),entries=oldResumeIndex?.months;
 if(!entries)return html+'<p class="field-help">2025년 이력서 목록을 불러오는 중입니다.</p>';
 const rows=entries.filter(m=>!historyMonths().includes(m.month)).map(m=>'<tr><td>'+m.month.replace('-','.')+'</td><td class="center">'+m.rank+'위</td><td class="center">'+m.count+'명</td>'+['game','contribution','damage'].map(key=>'<td>'+m.winners[key].map(p=>X(p.name)).join(' · ')+'</td>').join('')+'<td><button class="text-button" data-action="old-resume-open" data-id="'+m.month+'">상세</button></td></tr>');
 const monthButtons='<div class="toolbar"><div class="toolbar-left">'+entries.map(m=>'<button type="button" class="button" data-action="old-resume-open" data-id="'+m.month+'">'+m.month.slice(-2)+'월</button>').join('')+'</div></div>';
 return html+boardSection('2025년 원본 이력서',monthButtons+(rows.length?rowTable(['월','클랜 순위','참가','인게임 1·2위','기여도 1·2위','피해량 1·2위','열기'],rows,'exact-table'):''));
};
const oldResumeBaseHall=completeHall;
completeHall=()=>{
 const html=oldResumeBaseHall(),entries=oldResumeIndex?.months;
 if(!entries)return html;
 const map=new Map();
 for(const entry of entries)for(const k of ['game','contribution','damage'])for(const p of entry.winners[k]||[]){
  const row=map.get(p.name)||{name:p.name,game:[0,0],contribution:[0,0],damage:[0,0],total:0};
  row[k][p.rank-1]++;row.total++;map.set(p.name,row);
 }
 const rows=[...map.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'ko')).map(p=>'<tr><td>'+X(p.name)+'</td>'+['game','contribution','damage'].map(k=>'<td class="center">1위 '+p[k][0]+' / 2위 '+p[k][1]+'</td>').join('')+'<td class="center">'+p.total+'</td></tr>');
 return html+boardSection('2025년 원본 이력서 수상 내역 (별도)',rowTable(['클랜원','인게임','기여도','피해량','수상 합계'],rows,'exact-table'))+'<p class="field-help">2025년 원본의 별도 집계로, 기존 공용 수상 횟수에 중복 합산하지 않습니다.</p>';
};
document.addEventListener('change',event=>{
 const input=event.target;
 if(input?.dataset?.input==='v2-archive-month'){
  if(oldResumeMonths.includes(input.value)){event.preventDefault();event.stopImmediatePropagation();oldResumeOpen(input.value);}
  else if(oldResumeMonth){oldResumeRequest++;oldResumeMonth='';oldResumeData=null;}
 }
 if(input?.dataset?.input==='old-resume-person'){event.preventDefault();event.stopImmediatePropagation();oldResumePerson=input.value;render();}
},true);
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');if(!button)return;
 const action=button.dataset.action;
 if(!['old-resume-open','old-resume-person','old-resume-sort','old-resume-day','old-resume-page'].includes(action))return;
 event.preventDefault();event.stopImmediatePropagation();
 if(action==='old-resume-open')oldResumeOpen(button.dataset.id);
 else if(action==='old-resume-person'){oldResumePerson=button.dataset.name;ext.archiveView='profile';render();}
 else if(action==='old-resume-sort'){oldResumeSort=button.dataset.value;render();}
 else if(action==='old-resume-day'){oldResumeDay=Number(button.dataset.value);oldResumePage=1;render();}
 else if(action==='old-resume-page'){oldResumePage=Number(button.dataset.value);render();}
},true);
async function oldResumeLoadIndex(){
 try{
  const res=await fetch(new URL('./history-2025/manifest.json',import.meta.url),{cache:'force-cache'});
  if(!res.ok)throw Error('이력서 목록 다운로드 실패');
  oldResumeIndex=await res.json();
  if(ui.section==='records'&&['history','hall','archive'].includes(ui.tabs.records))render();
 }catch(e){oldResumeError=e.message;}
}
void oldResumeLoadIndex();
