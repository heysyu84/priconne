// Operational views: keep complete records visible and editing in the same page.
function ensureReferenceRoster(){
  if(!data.importedSource||data.importedSource.key==='live-shared-clan-api')return;
  const known=new Set(data.members.map(m=>m.id));
  for(const m of ROSTER_REFERENCE)if(!known.has(m.id))data.members.push(structuredClone(m));
  data.siteCopy??={};data.futureOverrides??={};data.referenceVersion='roster-r1361-reader-v2';
}
const scopedGameRules=applyGameScope;
applyGameScope=()=>{scopedGameRules();ensureReferenceRoster();normalizeCarryNotes();};
points=value=>Number.isFinite(value)?nf(Math.round(value)):'—';
pagedList=(rows,key,size=50,unit='명')=>({rows,start:0,footer:''});

function battleBossHealth(){
  return `<div class="battle-health" aria-label="보스 남은 HP">${data.bosses.map(b=>`<button type="button" data-action="r-hud-boss" data-id="${b.id}" class="battle-health-boss ${b.locked?'blocked':''}" style="${bossStyle(b.id)}"><span class="battle-health-face">${bossFace(b,'tiny')}<span class="raid-number">${b.id}</span></span><span class="battle-health-name"><strong>${X(b.name)}</strong><small>${b.stage}단계 · ${b.lap}회차${b.locked?' · 대기':''}</small></span><span class="battle-health-value numeric"><strong>${nf(b.hp)}</strong><small>/ ${nf(b.max)}</small></span><span class="battle-health-track"><i style="width:${Math.max(0,Math.min(100,b.hp/b.max*100))}%"></i></span></button>`).join('')}</div>`;
}
quickLogForm=()=>{
  const available=data.bosses.filter(b=>!b.locked),b=available.find(b=>b.id===(ui.boss||ext.entryBoss))||available[0]||data.bosses[0];
  const memberId=data.members.some(m=>m.id===ext.entryMember&&memberSeasonActive(m))?ext.entryMember:allSeasonStats().find(s=>s.active&&s.remaining)?.member.id;
  const automatic=[2,3].includes(b.stage);
  return `<section id="attack-entry" class="attack-entry"><div class="entry-title"><h2>기록 등록</h2><span class="entry-feedback" role="status">${X(ext.entryFeedback||'')}</span></div><form class="quick-log simple-entry" data-form="v2-quick-log"><input type="hidden" name="day" value="${ui.day}"><input type="hidden" name="unit" value="1"><div class="quick-field"><label for="quick-member">클랜원</label>${entrySearch('member','quick-member','memberId',memberId)}</div><div class="quick-field"><label for="quick-boss">보스</label>${entrySearch('boss','quick-boss','boss',b.id)}</div><div class="quick-field quick-damage"><label for="quick-damage">피해량</label><input id="quick-damage" name="damage" type="text" pattern="[0-9, ]+" required inputmode="numeric" placeholder="예: 350,000,000" value="${automatic?data.bossSettings.find(v=>v.id===b.id).hp[b.stage]:''}" data-was-auto="${automatic?'1':'0'}" ${automatic?'readonly':''}></div><div class="quick-field quick-bonus"><label for="quick-bonus">가산점</label><input id="quick-bonus" name="bonus" type="text" inputmode="decimal" placeholder="0" value="0" title="기여도에 더하거나 뺄 점수"></div><label class="early-auto" ${automatic?'':'hidden'}><input type="checkbox" name="autoDamage" data-input="v3-quick-auto" checked>2·3단계 HP 자동입력</label><label class="quick-carry"><input name="usesCarry" type="checkbox" ${shouldAutoUseCarry(memberId,ui.day)?'checked':''}>이월 사용</label><button class="button primary" type="submit">등록</button><details class="entry-extra"><summary>시간·메모</summary><div class="field"><label for="quick-remaining">격파 시 남은 시간</label><input id="quick-remaining" name="remaining" placeholder="0:30" inputmode="numeric"></div><div class="field"><label for="quick-note">메모</label><input id="quick-note" name="note"></div></details></form></section>`;
};
function logPagination(count,size=50){
  const pages=Math.max(1,Math.ceil(count/size));ui.page=Math.min(Math.max(1,ui.page),pages);
  return count<=size?`<div class="table-count">${count}건</div>`:`<div class="pagination"><span>${(ui.page-1)*size+1}–${Math.min(ui.page*size,count)} / ${count}건</span><div><button data-action="log-page" data-value="${ui.page-1}" ${ui.page===1?'disabled':''}>이전</button><span>${ui.page} / ${pages}</span><button data-action="log-page" data-value="${ui.page+1}" ${ui.page===pages?'disabled':''}>다음</button></div></div>`;
}
function battleLogContent(){
  const logs=getFilteredCompleteLogs(),pagination=logPagination(logs.length),closed=data.dayClosures.some(d=>d.day===ui.day);
  return (data.settings.editable&&!closed?quickLogForm():'')+`<div class="toolbar"><div class="toolbar-left">${bossFilter()}<label class="inline-check"><input type="checkbox" data-input="v2-all-days" ${ext.allDays?'checked':''}>전체 일차</label></div><div class="toolbar-right"><input class="search-input" id="complete-log-search" data-input="v2-log-query" value="${X(ui.query)}" placeholder="이름 · 초성 · 순번" aria-label="공격 기록 검색"><select class="select-field" data-input="log-type" aria-label="공격 유형"><option value="all">전체 유형</option>${['normal','kill','carry'].map(v=>`<option value="${v}" ${ui.logType===v?'selected':''}>${logTypeLabel(v)}</option>`).join('')}</select></div></div><div class="table-tools"><span>${ext.allDays?'전체':ui.day+'일차'} · ${logs.length}건${closed?' · 마감':''}</span><div><label class="inline-check"><input type="checkbox" data-input="v2-sequence" ${ext.sequence?'checked':''}>순번</label><label class="inline-check"><input type="checkbox" data-input="v2-details" ${ext.details?'checked':''}>상세</label>${simpleButton('등록순 '+(ext.logOrder==='asc'?'↑':'↓'),'v2-log-order')}${simpleButton('실행 취소','v2-undo')}${simpleButton('CSV','export-csv')}${data.settings.editable?simpleButton(closed?'마감 취소':'일차 마감',closed?'v2-reopen-day':'v2-close-day'):''}</div></div>${completeLogTable(logs.slice((ui.page-1)*50,ui.page*50))}${pagination}`;
};
fullBattle=()=>{ui.section='overview';ui.tabs.overview='bosses';return fullOverview();};
archiveLogPanel=()=>{
  const rows=getFilteredCompleteLogs(),pagination=logPagination(rows.length);
  return `<div class="toolbar">${bossFilter()}<label class="inline-check"><input type="checkbox" data-input="v2-all-days" ${ext.allDays?'checked':''}>전체 일차</label>${dayButtons()}${simpleButton('CSV','export-csv')}</div>`+completeLogTable(rows.slice((ui.page-1)*50,ui.page*50))+pagination;
};
const saveRegisteredLog=saveCompleteLog;
saveCompleteLog=form=>{
  const fd=new FormData(form),fresh=!fd.get('logId');
  if(fresh){ext.entryMember=String(fd.get('memberId'));ext.entryBoss=Number(fd.get('boss'));}
  const result=saveRegisteredLog(form);
  if(result&&fresh){const e=data.logs.at(-1);ext.entryCarry=e.kill&&!e.carry;ext.entryFeedback=currentMember(e.memberId).name+' · '+e.boss+'넴 '+nf(e.damage)+' 등록';if(ui.section==='battle'||ui.section==='overview'&&ui.tabs.overview==='bosses'){render();const input=document.getElementById('quick-damage');if(input&&!input.readOnly)input.focus();}}
  return result;
};

function rankedStats(metric=ext.rankMetric||'game',direction=ext.rankDirection??-1){return allSeasonStats().sort((a,b)=>(a[metric]-b[metric])*direction||a.member.name.localeCompare(b.member.name,'ko'));}
completeRanking=()=>{
 const metrics=[['game','인게임'],['contribution','기여도'],['damage','피해량']],metric=ext.rankMetric||'game',direction=ext.rankDirection??-1,rows=rankedStats(metric,direction),ranks=new Map(rankedStats(metric,-1).map((s,i)=>[s.member.id,i+1]));
 const desktop=`<div class="ranking-columns desktop-ranking">${metrics.map(([key,label])=>`<section class="ranking-column"><h2>${label}</h2>${rowTable(['순위','클랜원',label],rankedStats(key,-1).map((s,i)=>`<tr><td class="center rank-cell desktop">${i+1}</td><td>${memberLink(s.member)}</td><td class="right numeric"><strong>${nf(Math.round(s[key]))}</strong></td></tr>`),'ranking-detail dense-table')}</section>`).join('')}</div>`;
 return `<div class="records-day-filter">${dayButtons()}</div><div class="toolbar"><span>${ui.day}일차까지 · ${rows.length}명</span>${simpleButton('CSV','v2-ranking-csv')}</div>${desktop}<div class="table-wrap mobile-ranking"><table class="data-table ranking-unified"><thead><tr><th class="center">순위</th><th>클랜원</th>${metrics.map(([key,label])=>`<th class="right" aria-sort="${metric===key?(direction<0?'descending':'ascending'):'none'}"><button data-action="ops-rank-sort" data-value="${key}">${label} <span aria-hidden="true">${metric===key?(direction<0?'↓':'↑'):'↕'}</span></button></th>`).join('')}</tr></thead><tbody>${rows.map(s=>`<tr><td class="center rank-cell">${ranks.get(s.member.id)}</td><td>${memberLink(s.member)}</td>${metrics.map(([key])=>`<td class="right numeric">${nf(Math.round(s[key]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
};

function memberTenure(m,asOf=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}).slice(0,7)){
  const index=s=>Number(s.slice(0,4))*12+Number(s.slice(5,7))-1;
  const spans=(m.periods?.length?m.periods:[{from:m.joined,to:m.left}]).filter(p=>/^\d{4}-\d{2}/.test(p.from||'')).map(p=>[index(p.from),index(p.to||asOf)]).filter(([a,b])=>b>=a).sort((a,b)=>a[0]-b[0]);
  if(!spans.length)return null;let total=0,start=spans[0][0],end=spans[0][1];
  for(const[a,b]of spans.slice(1)){if(a<=end+1)end=Math.max(end,b);else{total+=end-start+1;start=a;end=b;}}return total+end-start+1;
}
completeRoster=(alumni=false)=>{
  const rows=data.members.filter(m=>(alumni||m.status==='active')&&matchName(m,ext.rosterQuery)).sort((a,b)=>Number(b.status==='active')-Number(a.status==='active')||a.name.localeCompare(b.name,'ko'));
  return `<div class="toolbar"><div class="toolbar-left"><input class="search-input" id="roster-search" data-input="v2-roster-query" aria-label="클랜원 검색" placeholder="이름 · 초성 · UID" value="${X(ext.rosterQuery)}"><span>${rows.length}명</span></div>${simpleButton('추가','add-member')}</div>`+rowTable(['클랜원','UID','가입',...(alumni?['탈퇴']:[]),'소속 기간',''],rows.map(m=>`<tr class="${m.status==='active'?'roster-active':'graduated'}"><td>${memberLink(m)}</td><td class="numeric uid-cell">${X(m.uid||'미기재')}</td><td class="nowrap">${X(m.joined?.slice(0,7)||'미기재')}</td>${alumni?`<td class="nowrap">${m.status==='active'?'재적':X(m.left?.slice(0,7)||'미기재')}</td>`:''}<td class="tenure-cell"><strong>${memberTenure(m)===null?'미기재':memberTenure(m)+'개월'}</strong><small>${X(membershipPeriod(m))}</small></td><td>${simpleButton('정보','v3-member-info',m.id,'quiet')}</td></tr>`),'roster-complete dense-table');
};
completeRates=()=>{
  const levels=seasonLevels(data.rules).filter(l=>l.count),tops=data.bossSettings.map(b=>topStats(b.id));
  const factors=levels.map(l=>`<tr><th>${l.stage}단계 <span>${l.start}–${l.count>=9999?'':l.end+'회차'}</span></th>${data.bossSettings.map(b=>`<td class="right numeric">${Number.isFinite(b.contribution[l.stage])?Number(b.contribution[l.stage]).toLocaleString('ko-KR',{maximumFractionDigits:2}):'—'}</td>`).join('')}</tr>`);
  const topRows=Array.from({length:data.rules.samples},(_,i)=>`<tr><th>${i+1}위</th>${tops.map(t=>`<td class="right numeric">${t.samples[i]?nf(t.samples[i].damage):'—'}</td>`).join('')}</tr>`);
  for(const key of ['mean','corrected'])topRows.push(`<tr class="average-row"><th>${key==='mean'?'평균':'보정 평균'}</th>${tops.map(t=>`<td class="right numeric">${t[key]?nf(Math.round(t[key])):'—'}</td>`).join('')}</tr>`);
  return boardSection('단계별 보스 기여도 배율',rowTable(['단계·회차',...data.bossSettings.map(b=>b.id+'넴')],factors,'coefficient-table exact-table'),simpleButton('보정률 '+Math.round(data.rules.factor*100)+'%','v2-factor'))+boardSection('4단계 상위 기록',`<div class="table-tools single-line"><span>상위 ${data.rules.samples}건</span><span>기준 기여도 ${nf(data.rules.baseline)}</span></div>`+rowTable(['순위',...data.bossSettings.map(b=>b.id+'넴')],topRows,'top-damage-table exact-table'));
};
completeArchive=()=>{
  const chooser=`<div class="archive-selector"><label for="archive-month">조회 월</label><select id="archive-month" data-input="v2-archive-month" class="select-field">${Object.keys(data.seasons).sort().reverse().map(key=>`<option value="${key}" ${key===ui.month?'selected':''}>${key.replace('-','년 ')}월</option>`).join('')}</select><div class="subview-tabs">${[['summary','요약'],['logs','배틀로그'],['ranking','순위'],['profile','개인 이력'],['tactics','택틱']].map(([key,name])=>`<button data-action="v2-archive-view" data-value="${key}" class="${ext.archiveView===key?'active':''}">${name}</button>`).join('')}</div></div>`;
  const views={logs:archiveLogPanel,ranking:completeRanking,profile:completeProfile,tactics:()=>completeWorkspace(true)};if(views[ext.archiveView])return chooser+views[ext.archiveView]();
  const summary=seasonSummary(ui.month);
  return chooser+`<dl class="archive-totals"><div><dt>클랜 순위</dt><dd>${summary.rank?summary.rank+'위':'미입력'}</dd></div><div><dt>총 인게임 점수</dt><dd>${nf(summary.gameTotal)}</dd></div><div><dt>참가</dt><dd>${summary.count}명</dd></div><div><dt>공격</dt><dd>${summary.attacks}건</dd></div></dl>`+boardSection('월별 기록',rowTable(['월','참가','인게임 점수','클랜 순위','결과','열기'],Object.keys(data.seasons).sort().reverse().map(key=>{const s=seasonSummary(key);return `<tr><td>${key.replace('-','.')}</td><td class="center">${s.count}명</td><td class="right numeric">${nf(s.gameTotal)}</td><td class="center">${s.rank?s.rank+'위':'미입력'}</td><td>${s.sealed?'확정':'진행 중'}</td><td>${simpleButton('상세','archive-detail',key,'quiet')}</td></tr>`;}),'archive-month-table exact-table'))+boardSection('단계별 보스 통계',[2,3,4].map(stage=>`<details class="fold" ${stage===4?'open':''}><summary>${stage}단계</summary>${bossStatistics(data.logs.filter(e=>e.stage===stage))}</details>`).join(''));
};

function wholeProfileEvents(){return data.logs.filter(e=>ui.profile==='__clan__'||e.memberId===ui.profile);}
function dailyProfileBars(events,days=data.rules.days){
  const rows=Array.from({length:days},(_,i)=>{const records=events.filter(e=>e.day===i+1);return {day:i+1,damage:records.reduce((s,e)=>s+e.actual,0),contribution:records.reduce((s,e)=>s+(e.contribution||0),0)};});
  const maxDamage=Math.max(1,...rows.map(r=>r.damage)),maxContribution=Math.max(1,...rows.map(r=>r.contribution));
  return `<section class="daily-paired-bars"><div class="paired-heading"><h3>피해량</h3><h3>기여도</h3></div>${rows.map(r=>`<div class="paired-day"><div class="paired-value damage"><strong class="numeric">${nf(r.damage)}</strong><span><i style="width:${r.damage/maxDamage*100}%"></i></span></div><b>${r.day}일차</b><div class="paired-value contribution"><strong class="numeric">${nf(Math.round(r.contribution))}</strong><span><i style="width:${r.contribution/maxContribution*100}%"></i></span></div></div>`).join('')}</section>`;
}
function profilePhaseShares(events){
  return `<section class="profile-phase-shares"><h2>단계별 보스 공격 비중</h2><p class="chart-note">실제 피해량 기준 · 월 전체</p><div class="phase-share-grid">${[[0,'종합'],...[...new Set(events.map(e=>Number(e.stage)).filter(Boolean))].sort((a,b)=>a-b).map(stage=>[stage,stage+'단계'])].map(([stage,label])=>{const selected=stage?events.filter(e=>e.stage===stage):events,total=selected.reduce((s,e)=>s+e.actual,0);let sum=0;const parts=data.bossSettings.map(b=>{const value=selected.filter(e=>e.boss===b.id).reduce((s,e)=>s+e.actual,0),start=sum;sum+=total?value/total*100:0;return {id:b.id,start,end:sum,share:total?value/total*100:0};});return `<figure class="phase-share"><figcaption>${label}</figcaption><div class="phase-donut" role="img" aria-label="${label} ${parts.map(p=>p.id+'넴 '+p.share.toFixed(1)+'%').join(', ')}" style="background:${total?'conic-gradient('+parts.map(p=>`var(--b${p.id}) ${p.start}% ${p.end}%`).join(',')+')':'var(--line)'}"><span><strong>${selected.length}</strong>타</span></div><div class="phase-legend">${parts.map(p=>`<span><i style="background:var(--b${p.id})"></i>${p.id}넴 <b>${p.share.toFixed(1)}%</b></span>`).join('')}</div></figure>`;}).join('')}</div></section>`;
}
dailyRecordTable=(all,m)=>rowTable(['일차','피해량','기여도'],Array.from({length:data.rules.days},(_,i)=>{const rows=data.logs.filter(e=>e.day===i+1&&(all||e.memberId===m.id)&&(!ext.profileStage||e.stage===ext.profileStage));return `<tr><td>${i+1}일차</td><td class="right numeric">${nf(rows.reduce((s,e)=>s+e.actual,0))}</td><td class="right numeric">${points(rows.reduce((s,e)=>s+(e.contribution||0),0))}</td></tr>`;}),'daily-records exact-table');
completeProfile=()=>{
  const all=ui.profile==='__clan__',member=all?null:currentMember(ui.profile),events=profileEvents(),whole=wholeProfileEvents(),stages=[2,3,4].filter(s=>data.logs.some(e=>e.stage===s));
  return `<div class="toolbar profile-toolbar"><select id="full-profile-member" class="select-field" aria-label="기록 대상" data-input="v2-profile-member"><option value="__clan__" ${all?'selected':''}>클랜 전체</option>${data.members.filter(p=>allSeasonStats().some(s=>s.member.id===p.id)||p.id===ui.profile).map(p=>`<option value="${p.id}" ${p.id===ui.profile?'selected':''}>${X(p.name)}</option>`).join('')}</select><select class="select-field" aria-label="이력 단계" data-input="v2-profile-stage"><option value="0" ${!ext.profileStage?'selected':''}>전체 단계</option>${stages.map(s=>`<option value="${s}" ${s===ext.profileStage?'selected':''}>${s}단계</option>`).join('')}</select>${profilePdfButton('ops-profile-pdf')}${simpleButton('인쇄','print','','quiet')}</div><dl class="profile-totals"><div><dt>피해량</dt><dd>${nf(events.reduce((s,e)=>s+e.actual,0))}</dd></div><div><dt>기여도</dt><dd>${points(events.reduce((s,e)=>s+(e.contribution||0),0))}</dd></div><div><dt>인게임</dt><dd>${nf(events.reduce((s,e)=>s+e.game,0))}</dd></div></dl>${dailyProfileBars(whole.filter(e=>!ext.profileStage||e.stage===ext.profileStage))}${profileDayDonut(events)}${profilePhaseShares(whole)}<details class="fold"><summary>일차별 수치</summary>${dailyRecordTable(all,member)}</details><details class="fold"><summary>보스별 통계</summary>${bossStatistics(events)}</details><details class="fold"><summary>단계별 통계</summary>${stages.map(stage=>`<h3 class="detail-stage-heading">${stage}단계</h3>${bossStatistics(events.filter(e=>e.stage===stage))}`).join('')}</details><details class="fold"><summary>공격 상세 · ${events.length}건</summary>${rowTable(['일차','보스','단계·회차','실제 피해량','기여도','이월'],events.map(e=>`<tr><td>${e.day}일차</td><td>${e.boss}넴</td><td class="attack-phase">${e.stage}단계 ${e.lap}회차</td><td class="right numeric">${nf(e.actual)}</td><td class="right numeric">${points(e.contribution)}</td><td class="center">${e.carry?'사용':'—'}</td></tr>`),'profile-attacks exact-table')}</details>`;
};
function profilePdfButton(action){
  return `<button type="button" class="button quiet profile-pdf-button" data-action="${action}" aria-label="개인 이력 PDF 보기 및 저장" title="PDF 보기 · 저장">${icon('file')}</button>`;
}
async function openProfilePdf(button,create){
  if(button.disabled)return;
  button.disabled=true;button.setAttribute('aria-busy','true');
  try{await create();}catch(error){console.error('Profile PDF export failed',error);toast('PDF를 만들지 못했습니다. '+error.message);}
  finally{button.disabled=false;button.removeAttribute('aria-busy');}
}
async function downloadCurrentProfile(target,preview=false){
  const events=wholeProfileEvents(),all=ui.profile==='__clan__',m=all?null:currentMember(ui.profile);
  const module=await import('./report-pdf.mjs?v=20261028-history01');
  return module[preview?'previewProfilePdf':'downloadProfilePdf']({target,downloadLabel:copyFor('PDF 저장'),copy:copyFor,month:ui.month,day:data.rules.days,days:data.rules.days,all,p:m?{...m,tenureMonths:memberTenure(m)}:null,bosses:data.bossSettings,events,contribution:e=>e.contribution||0,summary:{name:all?'클랜 전체':m.name,damage:events.reduce((s,e)=>s+e.actual,0),contribution:events.reduce((s,e)=>s+(e.contribution||0),0),game:events.reduce((s,e)=>s+e.game,0)}});
}

function expectedDamageValue(value){return Number.isFinite(Number(value))?(Math.floor(Number(value)*10+1e-9)/10).toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1}):'—';}
tacticDamageLabel=t=>t.recommendationOnly&&t.sourceExpectedDamage===''?'—':expectedDamageValue(t.damage||0);
function thirdStageVisible(){return data.rules.stage3Mode==='show'||data.rules.stage3Mode!=='hide'&&!data.bosses.some(b=>b.stage===4&&!b.locked);}
function tacticTab(tab){
  if(tab==='planner')ext.stage=4;
  if(tab==='tools')return 'external';
  return !tab||tab==='combos'||tab==='planner'?'workspace':tab;
}
function stageButtons(){
  const stages=thirdStageVisible()?[3,4]:[4];
  return `<div class="filter-group" role="group" aria-label="택틱 단계">${stages.map(stage=>`<button type="button" data-action="v2-combo-stage" data-value="${stage}" class="${ext.stage===stage?'active':''}" aria-pressed="${ext.stage===stage}">${stage}단계</button>`).join('')}</div>`;
}
const DEFAULT_TACTIC_GUIDE=`【덱 편성 및 서포트】
• 다른 보스를 관통하는 경우 상황에 맞게 덱을 변경하셔도 됩니다.
• 캐릭터 중복을 최소화했으며, 불가피하게 겹치는 경우 추천 서포트를 파란색으로 표시했습니다.
• 보유 캐릭터와 육성 상태에 따라 더 효율적인 조합이 있을 수 있습니다.
• 타수를 남기고 4단계에 진입할 때를 대비해, 4단계에서 자주 쓰는 캐릭터는 서포트로 빌리는 것을 권장합니다.

【택틱 및 기대 대미지】
• 이월 시간은 레벨·전용장비·EX장비 등 최상위 육성 상태를 기준으로 산정했습니다.
• 기대 대미지는 원본 영상 기준이며, 대부분 풀초기화 스펙으로 작성되었습니다.
• 요구 스펙이 다르므로 기대 대미지만으로 조합 성능을 비교하기 어렵습니다. 동일한 조건에서는 표기된 기대 대미지가 낮은 조합이 더 높은 대미지를 기록할 수도 있습니다.

【택틱 수행 시 주의사항】
• 택틱이 정상적으로 진행되지 않으면 전용장비 유무·레벨, 인연 레벨, EX장비 착용 여부, 노드 개방 상태 등을 확인해 주세요.
• 심역 스펙에 따라 택틱 수행이 불가능할 수 있으며, 영상의 TP는 필수 조건이 아닌 참고 수치입니다. 실전 전에 반드시 모의전을 진행해 주세요.
• 파티에 부스터 캐릭터가 없다면 TP 레벨의 영향을 받지 않습니다. (빨간색 이름 = 부스터 캐릭터)`;
function tacticGuideText(){
 const notices=data.notices||{};
 return typeof notices[3]==='string'&&notices[3]===notices[4]&&notices[3].trim()?notices[3]:DEFAULT_TACTIC_GUIDE;
}
function tacticGuidePanel(){
 if(!ext.noticeOpen)return '';
 const body=tacticGuideText().split('\n').map(line=>line.trim()).filter(Boolean).map(line=>/^【.*】$/.test(line)?`<h3>${X(line.slice(1,-1))}</h3>`:`<p>${X(line)}</p>`).join('');
 return `<section class="plain-notice tactic-common-guide" id="tactic-common-guide" aria-label="택틱 공통 안내">${body}${adminMode()?simpleButton('안내 수정','v2-notice','','quiet'):''}</section>`;
}
function workspaceTools(archive){
 const actions=ext.stage===3&&!archive?stage3RecommendationActions():'';
 const settings=!archive&&adminMode()?simpleButton('단계 설정','ops-stage-settings','','quiet'):'';
 return settings||actions?`<div class="toolbar tactic-stage-toolbar"><div class="toolbar-left">${settings}</div><div class="toolbar-right">${actions}</div></div>`:'';
}
function minimumCarry(t){
  if(Number(t.requiredCarrySeconds)>0)return Number(t.requiredCarrySeconds);
  const match=String(t.note||'').match(/(?:필요\s*)?이월\s*시간\s*[:：]?\s*(\d+)\s*초/);return match?Number(match[1]):null;
}
function displayTacticNote(t){
 if(t.category!=='carry')return t.note||'';
 return String(t.note||'').replace(/(?:필요\s*)?이월\s*(?:시간)?\s*[:：]?\s*(?:\d+\s*분\s*)?\d+\s*초\s*(?:기준|필요)?/g,'').replace(/^[\s·|,;]+|[\s·|,;]+$/g,'').replace(/\s*·\s*·\s*/g,' · ').trim();
}
function normalizeCarryNotes(){
 for(const season of [data,...Object.values(data.seasons||{})])for(const t of season.tactics||[]){
  if(t.category!=='carry')continue;
  const needed=minimumCarry(t);if(needed!==null)t.requiredCarrySeconds=needed;
  t.note=displayTacticNote(t);
 }
}
function textScale(){
 if(![95,100,105,110,115].includes(ext.textScale)){
  try{const saved=Number(localStorage.getItem('nyang-text-scale'));ext.textScale=[95,100,105,110,115].includes(saved)?saved:100;}catch{ext.textScale=100;}
 }return ext.textScale;
}
function setTextScale(value){
 const scale=Number(value);if(![95,100,105,110,115].includes(scale))return;
 ext.textScale=scale;try{localStorage.setItem('nyang-text-scale',String(scale));}catch{}applyAppearance();
}
const previousAppearance=applyAppearance;
applyAppearance=()=>{
 previousAppearance();document.documentElement.dataset.readability='normal';document.documentElement.style.setProperty('--base','15px');
 document.documentElement.dataset.textScale=String(textScale());document.documentElement.style.setProperty('--text-scale',String(textScale()/100));
};
const standardDisplaySettings=settingsDisplay;
settingsDisplay=()=>standardDisplaySettings().replace(/<label class="setting-row"><h3>본문 확대<\/h3>[\s\S]*?<\/label>/,`<div class="setting-row"><h3>글자 크기</h3><select class="select-field" data-input="ops-text-scale" aria-label="화면 글자 크기">${[95,100,105,110,115].map(value=>`<option value="${value}" ${value===textScale()?'selected':''}>${value}%${value===100?' · 기본':''}</option>`).join('')}</select></div>`);
document.addEventListener('change',event=>{if(event.target.dataset.input==='ops-text-scale')setTextScale(event.target.value);});
const originalConverter=completeConverter;
completeConverter=()=>`<p class="lineup-direction">화면 기준 <strong>맨 왼쪽이 1번</strong> · 오른쪽으로 2 → 3 → 4 → 5번</p>`+originalConverter().replace(/>1번 캐릭터</,'>1번 · 맨 왼쪽<').replace(/>5번 캐릭터</,'>5번 · 맨 오른쪽<');

function detachInlineDrawer(){
  if(!drawer.parentNode||drawer.parentNode===document.body)return;
  const host=drawer.closest('.drawer-host');drawer.close();document.body.append(drawer);host?.remove();
}
function dockInlineDrawer(){
  if(!document.createElement)return;
  const trigger=ui.drawerTrigger;let anchor=trigger?.isConnected?trigger.closest('tr,[data-combo],.page-heading,.work-editor-head,.setting-row')||trigger.closest('.toolbar'):null;
  if(anchor&&drawer.contains(anchor))anchor=null;
  if(drawer.open)drawer.close();
  if(drawer.parentNode!==document.body){const host=drawer.closest('.drawer-host');document.body.append(drawer);host?.remove();}
  drawer.classList.add('inline-drawer');
  if(anchor?.tagName==='TR'){
    const host=document.createElement('tr'),cell=document.createElement('td');host.className='drawer-host';cell.colSpan=anchor.cells.length;host.append(cell);anchor.after(host);cell.append(drawer);
  }else (anchor||document.querySelector('#main .page-heading')||document.querySelector('#main'))?.after(drawer);
  drawer.show();applySiteCopy?.(drawer);drawer.scrollIntoView({behavior:'smooth',block:'nearest'});
}
const standardNewRender=newRender;
newRender=()=>{if(ui.section==='battle'){ui.section='overview';ui.tabs.overview='logs';}detachInlineDrawer();standardNewRender();afterOperationalRender();};
function afterOperationalRender(){
  if(typeof applySiteCopy==='function')applySiteCopy(app);if(typeof copyFor==='function'){const name=subpageNames[ui.section]?.[ui.tabs[ui.section]]||'배틀로그';document.title=copyFor(name)+' · '+copyFor('냥냥클랜')+' Re²:Dive';}
}
const regularPrint=printPage;
printPage=()=>{
  if(!adminMode())return;
  if(ui.section==='records'&&(ui.tabs.records==='profile'||ui.tabs.records==='archive'&&ext.archiveView==='profile')){
    const oldDay=ext.profileDay,oldStage=ext.profileStage;ext.profileDay=0;ext.profileStage=0;
    let report=document.getElementById('profile-print');if(!report){report=document.createElement('section');report.id='profile-print';document.body.append(report);}
    report.innerHTML=`<h1>${X(ui.profile==='__clan__'?'클랜 전체':currentMember(ui.profile).name)} · ${ui.month} 개인 이력</h1>`+completeProfile();
    for(const detail of report.querySelectorAll('details')){if(detail.querySelector('summary')?.textContent.startsWith('공격 상세'))detail.remove();else detail.open=true;}
    ext.profileDay=oldDay;ext.profileStage=oldStage;document.body.classList.add('printing-profile');window.print();document.body.classList.remove('printing-profile');
  }else regularPrint();
};
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const action=button.dataset.action;
  if(action==='add-log'||action==='boss-log'){
    event.preventDefault();event.stopImmediatePropagation();if(!ensureEdit())return;if(action==='boss-log')ext.entryBoss=Number(button.dataset.id);if(ui.section!=='overview'||ui.tabs.overview!=='logs')nav('overview','logs');else render();document.getElementById('attack-entry')?.scrollIntoView({behavior:'smooth',block:'nearest'});document.getElementById('quick-damage')?.focus();return;
  }
  if(!action.startsWith('ops-'))return;event.preventDefault();event.stopImmediatePropagation();
  if(action==='ops-rank-sort'){const metric=button.dataset.value;if(!['game','contribution','damage'].includes(metric))return;ext.rankDirection=(ext.rankMetric||'game')===metric?-(ext.rankDirection??-1):-1;ext.rankMetric=metric;render();}
  if(action==='ops-profile-pdf'){await openProfilePdf(button,()=>downloadCurrentProfile(button,true));return;}
  if(action==='ops-stage-settings'){ext.settingsPage='rules';nav('clan','settings');}
},true);
document.addEventListener('change',event=>{if(event.target.name==='category'){
  const group=event.target.form?.querySelector('.carry-tactic-fields');if(group)group.hidden=event.target.value!=='carry';
}});
subpageNames.clan.future='미래 보스';

function tacticProgress(){
 const month=ui.month;if(ext.tacticCursorMonth!==month){ext.tacticCursorMonth=month;ext.tacticCursor={};try{const saved=JSON.parse(localStorage.getItem('nyang-tactic-progress:'+month)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))ext.tacticCursor=Object.fromEntries(Object.entries(saved).filter(([key,value])=>key.length<200&&typeof value==='string'&&value.length<200).slice(0,2000));}catch{}}return ext.tacticCursor;
}
function selectTacticRow(table,index){
 const rows=[...table.querySelectorAll('tbody tr')];if(!rows.length)return;index=Math.max(0,Math.min(rows.length-1,index));const selected=rows[index];const progress=tacticProgress();progress[table.dataset.tacticId]=selected.dataset.row;try{localStorage.setItem('nyang-tactic-progress:'+ui.month,JSON.stringify(progress));}catch{}
 rows.forEach(row=>{const active=row===selected;row.classList.toggle('tactic-active-row',active);row.setAttribute('aria-selected',String(active));});return selected;
}
document.addEventListener('click',event=>{
 const cell=event.target.closest('.tactic-grid-wrap .set-grid tbody td');if(!cell)return;const table=cell.closest('.set-grid'),rows=[...table.querySelectorAll('tbody tr')];selectTacticRow(table,rows.indexOf(cell.closest('tr')));if(!event.target.closest('input,textarea,[contenteditable="true"]'))table.focus({preventScroll:true});
});
document.addEventListener('keydown',event=>{
 if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key)||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.target.closest('input,textarea,[contenteditable="true"]'))return;
 const table=event.target.closest('.tactic-grid-wrap .set-grid')||(event.target===document.body?document.querySelector?.('.tactic-active-row')?.closest('.set-grid'):null);if(!table)return;const rows=[...table.querySelectorAll('tbody tr')],current=rows.findIndex(row=>row.classList.contains('tactic-active-row'));event.preventDefault();let next=event.key==='Home'?0:event.key==='End'?rows.length-1:current<0?0:current+(event.key==='ArrowDown'?1:-1);selectTacticRow(table,next)?.scrollIntoView({block:'nearest',inline:'nearest'});
});


