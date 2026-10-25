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
  return `<div class="battle-health" aria-label="보스 남은 HP">${data.bosses.map(b=>`<button data-action="boss-log" data-id="${b.id}" class="battle-health-boss ${b.locked?'blocked':''}" style="${bossStyle(b.id)}"><span class="battle-health-face">${bossFace(b,'tiny')}<span class="raid-number">${b.id}</span></span><span class="battle-health-name"><strong>${X(b.name)}</strong><small>${b.stage}단계 · ${b.lap}회차${b.locked?' · 대기':''}</small></span><span class="battle-health-value numeric"><strong>${nf(b.hp)}</strong><small>/ ${nf(b.max)}</small></span><span class="battle-health-track"><i style="width:${Math.max(0,Math.min(100,b.hp/b.max*100))}%"></i></span></button>`).join('')}</div>`;
}
quickLogForm=()=>{
  const available=data.bosses.filter(b=>!b.locked),b=available.find(b=>b.id===(ui.boss||ext.entryBoss))||available[0]||data.bosses[0];
  const memberId=data.members.some(m=>m.id===ext.entryMember&&memberSeasonActive(m))?ext.entryMember:allSeasonStats().find(s=>s.active&&s.remaining)?.member.id;
  const automatic=[2,3].includes(b.stage);
  return `<section id="attack-entry" class="attack-entry"><div class="entry-title"><h2>기록 등록</h2><span class="entry-feedback" role="status">${X(ext.entryFeedback||'')}</span></div><form class="quick-log simple-entry" data-form="v2-quick-log"><input type="hidden" name="day" value="${ui.day}"><input type="hidden" name="unit" value="1"><div class="quick-field"><label for="quick-member">클랜원</label>${entrySearch('member','quick-member','memberId',memberId)}</div><div class="quick-field"><label for="quick-boss">보스</label>${entrySearch('boss','quick-boss','boss',b.id)}</div><div class="quick-field quick-damage"><label for="quick-damage">피해량</label><input id="quick-damage" name="damage" type="text" pattern="[0-9, ]+" required inputmode="numeric" placeholder="예: 350,000,000" value="${automatic?data.bossSettings.find(v=>v.id===b.id).hp[b.stage]:''}" data-was-auto="${automatic?'1':'0'}" ${automatic?'readonly':''}></div><div class="quick-field quick-bonus"><label for="quick-bonus">가산점</label><input id="quick-bonus" name="bonus" type="text" inputmode="decimal" placeholder="0" value="0" title="기여도에 더하거나 뺄 점수"></div><label class="early-auto" ${automatic?'':'hidden'}><input type="checkbox" name="autoDamage" data-input="v3-quick-auto" checked>2·3단계 HP 자동입력</label><label class="quick-carry"><input name="usesCarry" type="checkbox" ${ext.entryCarry?'checked':''}>이월 사용</label><button class="button primary" type="submit">등록</button><details class="entry-extra"><summary>시간·메모</summary><div class="field"><label for="quick-remaining">격파 시 남은 시간</label><input id="quick-remaining" name="remaining" placeholder="0:30" inputmode="numeric"></div><div class="field"><label for="quick-note">메모</label><input id="quick-note" name="note"></div></details></form></section>`;
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
 return `<div class="toolbar"><span>${ui.day}일차까지 · ${rows.length}명</span>${simpleButton('CSV','v2-ranking-csv')}</div>${desktop}<div class="table-wrap mobile-ranking"><table class="data-table ranking-unified"><thead><tr><th class="center">순위</th><th>클랜원</th>${metrics.map(([key,label])=>`<th class="right" aria-sort="${metric===key?(direction<0?'descending':'ascending'):'none'}"><button data-action="ops-rank-sort" data-value="${key}">${label} <span aria-hidden="true">${metric===key?(direction<0?'↓':'↑'):'↕'}</span></button></th>`).join('')}</tr></thead><tbody>${rows.map(s=>`<tr><td class="center rank-cell">${ranks.get(s.member.id)}</td><td>${memberLink(s.member)}</td>${metrics.map(([key])=>`<td class="right numeric">${nf(Math.round(s[key]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
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
  const views={logs:archiveLogPanel,ranking:completeRanking,profile:completeProfile,tactics:recommendationRows};if(views[ext.archiveView])return chooser+views[ext.archiveView]();
  const summary=seasonSummary(ui.month);
  return chooser+`<dl class="archive-totals"><div><dt>클랜 순위</dt><dd>${summary.rank?summary.rank+'위':'미입력'}</dd></div><div><dt>총 피해량</dt><dd>${nf(summary.total)}</dd></div><div><dt>참가</dt><dd>${summary.count}명</dd></div><div><dt>공격</dt><dd>${summary.attacks}건</dd></div></dl>`+boardSection('월별 기록',rowTable(['월','참가','피해량','클랜 순위','결과','열기'],Object.keys(data.seasons).sort().reverse().map(key=>{const s=seasonSummary(key);return `<tr><td>${key.replace('-','.')}</td><td class="center">${s.count}명</td><td class="right numeric">${nf(s.total)}</td><td class="center">${s.rank?s.rank+'위':'미입력'}</td><td>${s.sealed?'확정':'진행 중'}</td><td>${simpleButton('상세','archive-detail',key,'quiet')}</td></tr>`;}),'archive-month-table exact-table'))+boardSection('단계별 보스 통계',[2,3,4].map(stage=>`<details class="fold" ${stage===4?'open':''}><summary>${stage}단계</summary>${bossStatistics(data.logs.filter(e=>e.stage===stage))}</details>`).join(''));
};

function wholeProfileEvents(){return data.logs.filter(e=>ui.profile==='__clan__'||e.memberId===ui.profile);}
function dailyProfileBars(events){
  const rows=Array.from({length:data.rules.days},(_,i)=>{const records=events.filter(e=>e.day===i+1);return {day:i+1,damage:records.reduce((s,e)=>s+e.actual,0),contribution:records.reduce((s,e)=>s+(e.contribution||0),0)};});
  const maxDamage=Math.max(1,...rows.map(r=>r.damage)),maxContribution=Math.max(1,...rows.map(r=>r.contribution));
  return `<section class="daily-paired-bars"><div class="paired-heading"><h3>피해량</h3><h3>기여도</h3></div>${rows.map(r=>`<div class="paired-day"><div class="paired-value damage"><strong class="numeric">${nf(r.damage)}</strong><span><i style="width:${r.damage/maxDamage*100}%"></i></span></div><b>${r.day}일차</b><div class="paired-value contribution"><strong class="numeric">${nf(Math.round(r.contribution))}</strong><span><i style="width:${r.contribution/maxContribution*100}%"></i></span></div></div>`).join('')}</section>`;
}
function profilePhaseShares(events){
  return `<section class="profile-phase-shares"><h2>단계별 보스 공격 비중</h2><p class="chart-note">실제 피해량 기준 · 월 전체</p><div class="phase-share-grid">${[[0,'종합'],[2,'2단계'],[3,'3단계'],[4,'4단계']].map(([stage,label])=>{const selected=stage?events.filter(e=>e.stage===stage):events,total=selected.reduce((s,e)=>s+e.actual,0);let sum=0;const parts=data.bossSettings.map(b=>{const value=selected.filter(e=>e.boss===b.id).reduce((s,e)=>s+e.actual,0),start=sum;sum+=total?value/total*100:0;return {id:b.id,start,end:sum,share:total?value/total*100:0};});return `<figure class="phase-share"><figcaption>${label}</figcaption><div class="phase-donut" role="img" aria-label="${label} ${parts.map(p=>p.id+'넴 '+p.share.toFixed(1)+'%').join(', ')}" style="background:${total?'conic-gradient('+parts.map(p=>`var(--b${p.id}) ${p.start}% ${p.end}%`).join(',')+')':'var(--line)'}"><span><strong>${selected.length}</strong>타</span></div><div class="phase-legend">${parts.map(p=>`<span><i style="background:var(--b${p.id})"></i>${p.id}넴 <b>${p.share.toFixed(1)}%</b></span>`).join('')}</div></figure>`;}).join('')}</div></section>`;
}
dailyRecordTable=(all,m)=>rowTable(['일차','피해량','기여도'],Array.from({length:data.rules.days},(_,i)=>{const rows=data.logs.filter(e=>e.day===i+1&&(all||e.memberId===m.id)&&(!ext.profileStage||e.stage===ext.profileStage));return `<tr><td>${i+1}일차</td><td class="right numeric">${nf(rows.reduce((s,e)=>s+e.actual,0))}</td><td class="right numeric">${points(rows.reduce((s,e)=>s+(e.contribution||0),0))}</td></tr>`;}),'daily-records exact-table');
completeProfile=()=>{
  const all=ui.profile==='__clan__',member=all?null:currentMember(ui.profile),events=profileEvents(),whole=wholeProfileEvents(),stages=[2,3,4].filter(s=>data.logs.some(e=>e.stage===s));
  return `<div class="toolbar profile-toolbar"><select id="full-profile-member" class="select-field" aria-label="기록 대상" data-input="v2-profile-member"><option value="__clan__" ${all?'selected':''}>클랜 전체</option>${data.members.filter(p=>allSeasonStats().some(s=>s.member.id===p.id)||p.id===ui.profile).map(p=>`<option value="${p.id}" ${p.id===ui.profile?'selected':''}>${X(p.name)}</option>`).join('')}</select><select class="select-field" aria-label="이력 단계" data-input="v2-profile-stage"><option value="0" ${!ext.profileStage?'selected':''}>전체 단계</option>${stages.map(s=>`<option value="${s}" ${s===ext.profileStage?'selected':''}>${s}단계</option>`).join('')}</select>${simpleButton('PDF 보기','ops-profile-pdf','','primary')}${simpleButton('PDF 저장','ops-profile-download','','quiet')}${simpleButton('인쇄','print','','quiet')}</div><dl class="profile-totals"><div><dt>피해량</dt><dd>${nf(events.reduce((s,e)=>s+e.actual,0))}</dd></div><div><dt>기여도</dt><dd>${points(events.reduce((s,e)=>s+(e.contribution||0),0))}</dd></div><div><dt>인게임</dt><dd>${nf(events.reduce((s,e)=>s+e.game,0))}</dd></div></dl>${dailyProfileBars(whole.filter(e=>!ext.profileStage||e.stage===ext.profileStage))}${profileDayDonut(events)}${profilePhaseShares(whole)}<details class="fold"><summary>일차별 수치</summary>${dailyRecordTable(all,member)}</details><details class="fold"><summary>보스별 통계</summary>${bossStatistics(events)}</details><details class="fold"><summary>단계별 통계</summary>${stages.map(stage=>`<h3 class="detail-stage-heading">${stage}단계</h3>${bossStatistics(events.filter(e=>e.stage===stage))}`).join('')}</details><details class="fold"><summary>공격 상세 · ${events.length}건</summary>${rowTable(['일차','보스','단계·회차','실제 피해량','기여도','이월'],events.map(e=>`<tr><td>${e.day}일차</td><td>${e.boss}넴</td><td class="attack-phase">${e.stage}단계 ${e.lap}회차</td><td class="right numeric">${nf(e.actual)}</td><td class="right numeric">${points(e.contribution)}</td><td class="center">${e.carry?'사용':'—'}</td></tr>`),'profile-attacks exact-table')}</details>`;
};
async function downloadCurrentProfile(target,preview=false){
  const events=wholeProfileEvents(),all=ui.profile==='__clan__',m=all?null:currentMember(ui.profile);
  const module=await import('./report-pdf.mjs?v=operations-3');
  return module[preview?'previewProfilePdf':'downloadProfilePdf']({target,downloadLabel:copyFor('PDF 저장'),copy:copyFor,month:ui.month,day:data.rules.days,days:data.rules.days,all,p:m?{...m,tenureMonths:memberTenure(m)}:null,bosses:data.bossSettings,events,contribution:e=>e.contribution||0,summary:{name:all?'클랜 전체':m.name,damage:events.reduce((s,e)=>s+e.actual,0),contribution:events.reduce((s,e)=>s+(e.contribution||0),0),game:events.reduce((s,e)=>s+e.game,0)}});
}

function expectedDamageValue(value){return Number.isFinite(Number(value))?Number(value).toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1}):'—';}
tacticDamageLabel=t=>t.recommendationOnly&&t.sourceExpectedDamage===''?'—':expectedDamageValue(t.damage||0);
function thirdStageVisible(){return data.rules.stage3Mode==='show'||data.rules.stage3Mode!=='hide'&&!data.bosses.some(b=>b.stage===4&&!b.locked);}
stageButtons=()=>`<div class="filter-group" role="group" aria-label="조합 단계">${(thirdStageVisible()?[3,4]:[4]).map(stage=>`<button data-action="v2-combo-stage" data-value="${stage}" class="${ext.stage===stage?'active':''}">${stage}단계</button>`).join('')}</div>${data.settings.editable?simpleButton('단계 설정','ops-stage-settings','','quiet'):''}`;
recommendationRows=()=>{
  if(!thirdStageVisible()&&ext.stage===3)ext.stage=4;
  if(ext.onlyPicks&&!selectedParties().length)ext.onlyPicks=false;
  const early=ext.stage===3,rows=visibleTactics().filter(t=>!ext.onlyPicks||early||ui.picks.includes(t.id));
  return `<div class="toolbar"><div class="toolbar-left">${stageButtons()}${bossFilter()}</div><div class="toolbar-right">${early?'':simpleButton('추천 분배','v3-distribution','',ext.distributionOpen?'selected':'')}<span>${rows.length}개</span>${data.notices[ext.stage]?simpleButton('안내','v2-toggle-notice'):''}</div></div>${ext.noticeOpen&&data.notices[ext.stage]?`<div class="plain-notice">${X(data.notices[ext.stage]).replace(/\n/g,'<br>')}${simpleButton('안내 수정','v2-notice')}</div>`:''}${recommendationDistribution()}<div class="recommendation-list">${rows.map(t=>`<article class="combo-card ${ui.picks.includes(t.id)?'picked':''}" data-combo="${t.id}" style="${bossStyle(t.boss)}"><div class="combo-heading" style="${bossStyle(t.boss)}">${early?'':`<input type="checkbox" aria-label="${t.boss}넴 ${X(t.title)} 3타 선택" data-input="v2-pick-tactic" data-id="${t.id}" ${ui.picks.includes(t.id)?'checked':''}>`}<strong class="boss-tag">${t.boss}넴</strong><small class="combo-category category-${t.category}">${early?'3단계':t.category==='tabi'?'타비':'택틱'}</small>${videoButton(t,true)}</div><div class="combo-party">${party(t)}</div><dl class="combo-metadata"><div class="combo-stars"><dt>성급</dt><dd class="star-sequence">${tacticStarString(t)}</dd></div>${early?`<div><dt>필요 시간</dt><dd>${t.requiredSeconds==null?'—':t.requiredSeconds+'초'}</dd></div><div><dt>예상 이월</dt><dd>${t.remainingSeconds==null?'—':t.remainingSeconds+'초'}</dd></div>`:`<div><dt>손컨</dt><dd class="${t.hands?'danger':''}">${tacticHands(t)}</dd></div><div><dt>TP</dt><dd class="${t.tp.includes('+')?'danger':''}">${X(t.tp||'—')}</dd></div><div><dt>기대딜</dt><dd>${tacticDamageLabel(t)}</dd></div>`}</dl><div class="combo-open"><button class="button combo-toggle" data-action="ops-combo-toggle" data-id="${t.id}" aria-expanded="${ext.openComboId===t.id}" aria-controls="combo-details-${t.id}">${ext.openComboId===t.id?'닫기':'열기'}</button></div><div id="combo-details-${t.id}" class="combo-expansion ${ext.openComboId===t.id?'is-open':''}" ${ext.openComboId===t.id?'':'hidden'}><div class="combo-expansion-clip"><div class="combo-expansion-content">${ext.openComboId===t.id?comboDetailBody(t):''}</div></div></div></article>`).join('')||'<p class="no-rows">등록된 조합이 없습니다.</p>'}</div>${completePlanStrip()}`;
};
completePlanStrip=()=>{
  const chosen=selectedParties();if(!chosen.length)return '';const conflicts=partyConflicts(chosen);
  return `<div class="selection-strip"><strong>선택 ${chosen.length}/3</strong><span class="numeric">${expectedDamageValue(chosen.reduce((sum,t)=>sum+t.damage,0))}</span>${conflicts.length?`<span class="danger">중복 ${X(conflicts.join(', '))}</span>`:''}<span class="push"></span>${simpleButton(ext.onlyPicks?'전체 보기':'선택만 보기','v3-selected-only')}${simpleButton('복사','v2-copy-plan')}${simpleButton('비우기','clear-plan')}</div>`;
};
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
function comboDetailBody(t){
 return `<div class="combo-detail-controls"><label>이월 받은 시간 <input aria-label="이월 받은 시간" data-input="ops-combo-carry" data-id="${t.id}" value="${fmtTime(ui.carry)}" inputmode="numeric"></label>${simpleButton('본문 복사','copy-tactic',t.id)}${t.recommendationOnly?'':simpleButton('작업실에서 열기','v2-open-workspace',t.id)}</div>${t.note?`<p class="tactic-note">${X(displayTacticNote(t)).replace(/\n/g,'<br>')}</p>`:''}${t.video?`<p class="source-links"><a href="${X(t.video)}" target="_blank" rel="noopener noreferrer">원본 영상</a></p>`:''}${renderTacticGrid(t,false)}`;
}
function toggleComboCard(id){
 const t=tacticById(id),panel=document.getElementById('combo-details-'+id);if(!t||!panel)return;
 const close=previous=>{const node=document.getElementById('combo-details-'+previous);if(!node)return;node.classList.remove('is-open');const button=node.closest('[data-combo]')?.querySelector('[data-action="ops-combo-toggle"]');if(button){button.textContent=copyFor('열기');button.setAttribute('aria-expanded','false');}setTimeout(()=>{if(!node.classList.contains('is-open')){node.hidden=true;node.querySelector('.combo-expansion-content').replaceChildren();}},230);};
 if(ext.openComboId===id){ext.openComboId=null;close(id);return;}if(ext.openComboId)close(ext.openComboId);
 ext.openComboId=id;ui.selectedTactic=id;ui.carry=t.duration||90;panel.querySelector('.combo-expansion-content').innerHTML=comboDetailBody(t);panel.hidden=false;applySiteCopy(panel);panel.getBoundingClientRect();panel.classList.add('is-open');
 const button=panel.closest('[data-combo]').querySelector('[data-action="ops-combo-toggle"]');button.textContent=copyFor('닫기');button.setAttribute('aria-expanded','true');
}
const standardWorkspace=completeWorkspace;
completeWorkspace=()=>{
  if(ext.workGroup==='carry'){
    const list=workspaceList(),t=list.find(t=>t.id===ui.selectedTactic)||list[0];
    if(t&&ext.lastCarryTactic!==t.id){ui.carry=ext.receivedCarry??minimumCarry(t)??90;ext.lastCarryTactic=t.id;}
  }
  return standardWorkspace();
};
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
  if(ui.section==='records'&&(ui.tabs.records==='profile'||ui.tabs.records==='archive'&&ext.archiveView==='profile')){
    const oldDay=ext.profileDay,oldStage=ext.profileStage;ext.profileDay=0;ext.profileStage=0;
    let report=document.getElementById('profile-print');if(!report){report=document.createElement('section');report.id='profile-print';document.body.append(report);}
    report.innerHTML=`<h1>${X(ui.profile==='__clan__'?'클랜 전체':currentMember(ui.profile).name)} · ${ui.month} 개인 이력</h1>`+completeProfile();
    for(const detail of report.querySelectorAll('details'))detail.open=true;
    ext.profileDay=oldDay;ext.profileStage=oldStage;document.body.classList.add('printing-profile');window.print();document.body.classList.remove('printing-profile');
  }else regularPrint();
};
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const action=button.dataset.action;
  if(action==='v2-use-plan'){ext.onlyPicks=true;return;}
  if(action==='add-log'||action==='boss-log'){
    event.preventDefault();event.stopImmediatePropagation();if(!ensureEdit())return;if(action==='boss-log')ext.entryBoss=Number(button.dataset.id);if(ui.section!=='overview'||ui.tabs.overview!=='logs')nav('overview','logs');else render();document.getElementById('attack-entry')?.scrollIntoView({behavior:'smooth',block:'nearest'});document.getElementById('quick-damage')?.focus();return;
  }
  if(!action.startsWith('ops-'))return;event.preventDefault();event.stopImmediatePropagation();
  if(action==='ops-rank-sort'){const metric=button.dataset.value;if(!['game','contribution','damage'].includes(metric))return;ext.rankDirection=(ext.rankMetric||'game')===metric?-(ext.rankDirection??-1):-1;ext.rankMetric=metric;render();}
  if(action==='ops-combo-toggle')toggleComboCard(button.dataset.id);
  if(action==='ops-profile-pdf'||action==='ops-profile-download'){const label=button.textContent;button.disabled=true;button.textContent='PDF 생성 중';try{await downloadCurrentProfile(button,action==='ops-profile-pdf');}catch(error){console.error('Profile PDF export failed',error);toast('PDF를 만들지 못했습니다. '+error.message);}finally{button.disabled=false;button.textContent=label;}}
  if(action==='ops-stage-settings'){ext.settingsPage='rules';nav('clan','settings');}
},true);
document.addEventListener('input',event=>{
  const field=event.target;if(field.dataset.input==='ops-combo-carry'){const seconds=timeToSec(field.value);if(!(seconds>0&&seconds<=90)){field.setAttribute('aria-invalid','true');return;}field.removeAttribute('aria-invalid');ui.carry=seconds;const t=tacticById(field.dataset.id),panel=field.closest('.combo-expansion-content'),grid=panel?.querySelector('.tactic-grid-wrap');if(t&&grid){const template=document.createElement('template');template.innerHTML=renderTacticGrid(t,false);grid.replaceWith(template.content.querySelector('.tactic-grid-wrap'));applySiteCopy(panel);}return;}if(field.dataset.input==='ops-carry-received'){
    const seconds=Number(field.value);if(!Number.isInteger(seconds)||seconds<1||seconds>90){field.setAttribute('aria-invalid','true');return;}
    field.removeAttribute('aria-invalid');ext.receivedCarry=seconds;ui.carry=seconds;
    const timeline=document.querySelector('.set-grid');if(timeline){const t=activeTactic();timeline.querySelectorAll('.instruction-cell>div').forEach((cell,i)=>cell.innerHTML=legacyTools.richLine(tacticRows(t)[i],t.party,data.characters,seconds,t.duration||90));}
    const label=field.closest('.carry-summary')?.querySelector('.carry-warning')||field.nextElementSibling,needed=minimumCarry(activeTactic());if(label){label.textContent=needed&&seconds<needed?'필요 이월보다 짧습니다.':'';label.hidden=!(needed&&seconds<needed);}
  }
});
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
 const cell=event.target.closest('.tactic-grid-wrap .instruction-cell');if(!cell)return;const table=cell.closest('.set-grid'),rows=[...table.querySelectorAll('tbody tr')];selectTacticRow(table,rows.indexOf(cell.closest('tr')));if(!event.target.closest('input,textarea,[contenteditable="true"]'))table.focus({preventScroll:true});
});
document.addEventListener('keydown',event=>{
 if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key)||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.target.closest('input,textarea,[contenteditable="true"]'))return;
 const table=event.target.closest('.tactic-grid-wrap .set-grid')||(event.target===document.body?document.querySelector?.('.tactic-active-row')?.closest('.set-grid'):null);if(!table)return;const rows=[...table.querySelectorAll('tbody tr')],current=rows.findIndex(row=>row.classList.contains('tactic-active-row'));event.preventDefault();let next=event.key==='Home'?0:event.key==='End'?rows.length-1:current<0?0:current+(event.key==='ArrowDown'?1:-1);selectTacticRow(table,next)?.scrollIntoView({block:'nearest',inline:'nearest'});
});
