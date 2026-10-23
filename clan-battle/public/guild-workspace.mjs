import { summarizeArchive, sortArchiveRankings } from './archive-summary.mjs?v=20261022-import01';
import {AUTOMATIC_HISTORY_FROM,monthlyBattleSummary,confirmMonthlyResult,resultNeedsReconfirm,historicalHall} from './clan-history.mjs?v=20261022-hall01';
import { CLAN_PROFILE, isBoosterCharacter, formatExpectedDamage, comboNoticeHidden, setComboNoticeHidden, sourceLinkBox } from './view-settings.mjs?v=20261023-image-cleanup01';
import { characterPortrait, portraitAttributes, portraitStarOverlay } from './character-portraits.mjs?v=20261023-image-cleanup01';
import { BOSS_COLORS, BOSS_ACCENTS, BOSS_INK, tenureMonths, monthOnly, thisMonth, dashboardDay, bossTopStats } from './guild-model.mjs?v=20261024-boss-lap-lock01';
import { makeId, matchMembers, upsertMember, syncRoster } from './roster.mjs?v=20261022-ui14';
import { downloadProfilePdf } from './report-pdf.mjs?v=20261023-contribution-round-width980-01';
import { createComboWorkspace } from './combo-workspace.mjs?v=20261024-boss-lap-lock01';
import {suppressTacticRecommendation} from './tactic-combo-sync.mjs?v=20261024-carry-tactics01';
const SCORES=[['damage','피해량'],['contribution','기여도'],['game','인게임 스코어'],['dayDamage','일일 피해량'],['dayContribution','일일 기여도']];

export function createGuildWorkspace(api){
  const {getApp,getMonth,render,persist,section,nf,formatContribution,escapeHtml:X,notify,openForm}=api;
  const app=()=>getApp(),month=()=>getMonth(),canEdit=()=>api.canEdit(),person=id=>app().roster.find(p=>p.id===id);
  const state={db:'rates',search:'',profile:CLAN_PROFILE,day:null,dashboardDay:null,sort:'contribution',boss:1,comboStage:'4',comboBoss:'all'};
  const comboWorkspace=createComboWorkspace({state,app,month,render,section,canEdit,characters:api.characters,escapeHtml:X,notice:comboNotice,detailedRows:comboCards});
  const days=()=>Number(month().options.days||5),latestDay=()=>Math.max(1,...month().events.map(e=>Number(e.day)||1),...(month().dayBreaks||[]).map(b=>b.nextDay));
  const selectedDay=()=>state.day===null?Math.min(days(),latestDay()):Number(state.day);
  const total=p=>tenureMonths(p),period=p=>total(p)===null?'미상':nf(total(p))+'개월';
  const chip=(id,text)=>`<span class="boss-chip" data-boss-color="${id}">${X(text||id+'넴')}</span>`;
  const dayTabs=(key='day',day=selectedDay())=>`<div class="tabset">${Array.from({length:days()},(_,i)=>`<button data-guild="${key}" data-value="${i+1}" class="${day===i+1?'active':''}">${i+1}일차</button>`).join('')}</div>`;
  const rate=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?'-':Number(v).toLocaleString('ko-KR',{maximumFractionDigits:2});
  const validURL=v=>{try{const u=new URL(v);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}};
  function table(headers,rows,klass=''){return `<div class="table-scroll"><table class="datatable ${klass}"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${headers.length}" class="empty">기록이 없습니다.</td></tr>`}</tbody></table></div>`;}
  function dashboard(){
    const d=month(),day=state.dashboardDay??Math.min(days(),latestDay()),ids=[...new Set([...(d.memberIds||[]),...d.events.map(e=>e.memberId)])].filter(Boolean),count=Number(d.options.dailyAttacks||3);
    const headers=['클랜원',...Array.from({length:count},(_,i)=>`${i+1}타`),'사용','남은 타수','이월'];
    const rows=ids.map(id=>{
      const p=person(id),result=dashboardDay(d,id,day),membership=d.membership?.[id],unavailable=membership&&(day<membership.fromDay||day>(membership.toDay??days()));
      const name=`<th><button class="textbutton" data-guild="profile" data-id="${X(id)}">${X(p?.name||d.events.find(e=>e.memberId===id)?.member||'미등록')}</button></th>`;
      if(unavailable)return `<tr>${name}<td class="day-unavailable" colspan="${count+3}">—</td></tr>`;
      const slots=Array.from({length:count},(_,i)=>{
        const slot=result.slots[i],solo=!!slot&&!slot.carry&&!slot.pending;
        return `<td><div class="attack-slot ${slot?'filled':''}${solo?' is-solo':''}">${slot?chip(slot.basic.boss):'<span class="empty-slot">—</span>'}${slot?.carry?chip(slot.carry.boss):slot?.pending?'<strong class="pending-carry" title="미사용 이월">★</strong>':slot?'':'<span class="empty-slot">—</span>'}</div></td>`;
      }).join('');
      return `<tr>${name}${slots}<td class="dashboard-count">${result.used}/${count}</td><td class="dashboard-count">${result.remaining}</td><td class="dashboard-count ${result.pending?'pending-carry':''}">${result.pending}${result.orphan.length?'<span class="text-danger" title="이월 연결 확인"> !</span>':''}</td></tr>`;
    });
    return section('대시보드')+`<section class="panel dashboard-panel"><div class="panel-head dashboard-controls">${dayTabs('dashboard-day',day)}<span class="pill">${Math.min(days(),latestDay())}일차 진행 중</span></div>${table(headers,rows,'dashboard-table')}</section>`;
  }
  function ranking(){
    const day=selectedDay(),rows=api.aggregates(month(),day),sorted=[...rows].sort((a,b)=>(Number.isFinite(b[state.sort])?b[state.sort]:-Infinity)-(Number.isFinite(a[state.sort])?a[state.sort]:-Infinity));
    return section('월간 순위')+`<section class="panel"><div class="panel-head">${dayTabs()}<span class="small muted">${day}일차까지</span></div>${table(['순위','클랜원',...SCORES.map(([key,label])=>`<button class="sort-head ${state.sort===key?'active':''}" data-guild="sort" data-value="${key}">${label} ${state.sort===key?'↓':''}</button>`)],sorted.map((p,i)=>`<tr><td class="h-num">${i+1}</td><th>${X(p.name)}</th>${SCORES.map(([key])=>`<td class="number ${key===state.sort?'sorted':''}">${key==='contribution'||key==='dayContribution'?formatContribution(p[key]):nf(p[key])}</td>`).join('')}</tr>`),'rank-all-scores')}</section>`;
  }
  function profileData(){
    const d=month(),id=state.profile||CLAN_PROFILE,p=person(id),all=id===CLAN_PROFILE||!p;
    const events=d.events.filter(e=>(all||e.memberId===id)&&e.day<=selectedDay());
    let summary;
    if(all){
      summary={name:'클랜 전체',damage:0,contribution:0,game:0,shots:0,carry:0,byDay:{}};
      for(const e of events){const contribution=api.contribution(e,d),game=e.actual*Number(d.bosses.find(b=>b.id===e.boss)?.game?.[e.stage]||0);summary.damage+=e.actual;summary.contribution+=contribution;summary.game+=game;summary.shots+=!e.carry;summary.carry+=!!e.carry;const day=summary.byDay[e.day]||={damage:0,contribution:0};day.damage+=e.actual;day.contribution+=contribution;}
    }else summary=api.aggregates(d,selectedDay()).find(x=>x.memberId===id)||{name:p.name,memberId:id,damage:0,contribution:0,game:0,byDay:{}};
    return {id:all?CLAN_PROFILE:id,p:all?null:p,all,summary,events,month:app().active,bosses:d.bosses,day:selectedDay(),days:days(),contribution:e=>api.contribution(e,d)};
  }
  function donut(events,title){
    const values=month().bosses.map(b=>events.filter(e=>e.boss===b.id).reduce((s,e)=>s+e.actual,0)),sum=values.reduce((s,v)=>s+v,0);let angle=0;
    const stops=values.map((v,i)=>{const start=angle;angle+=sum?v/sum*100:0;return `${BOSS_ACCENTS[i]} ${start}% ${angle}%`;});
    return `<figure class="profile-donut"><figcaption>${title}</figcaption><div class="donut" role="img" aria-label="${X(title)} 보스별 실제 피해량 비중" style="background:${sum?`conic-gradient(${stops.join(',')})`:'#eeeaf3'}"><div><strong>${sum?nf(events.length)+'타':'기록 없음'}</strong><small>실제 피해량</small></div></div><ul>${values.map((v,i)=>`<li><i style="background:${BOSS_ACCENTS[i]}"></i><span>${i+1}넴</span><strong>${sum?(v/sum*100).toFixed(1):'0.0'}%</strong></li>`).join('')}</ul></figure>`;
  }
  function profile(){
    const {id,p,all,summary,events}=profileData(),d=month(),max=Math.max(1,...Object.values(summary.byDay||{}).map(v=>v.damage||0));
    return section('개인 이력', '',`<button class="btn primary" data-guild="pdf">↧ 이력서 PDF</button>`)+`<section class="panel profile-controls"><label for="guild-profile">기록 대상</label><select id="guild-profile"><option value="${CLAN_PROFILE}" ${all?'selected':''}>클랜 전체</option>${app().roster.map(p=>`<option value="${X(p.id)}" ${p.id===id?'selected':''}>${X(p.name)}</option>`).join('')}</select>${dayTabs()}<strong>${X(p?.name||summary.name)}</strong>${all?'':`<span class="pill">소속 ${period(p||{})}</span>`}</section><div class="metrics profile-metrics">${[['누적 피해량',summary.damage],['기여도',summary.contribution],['인게임 스코어',summary.game]].map(([label,v])=>`<div class="metric"><div class="k">${label}</div><div class="v">${label==='기여도'?formatContribution(v):nf(v)}</div></div>`).join('')}</div><section class="panel"><div class="panel-head"><h2>보스별 공격 비중</h2></div><div class="profile-donuts">${donut(events,'종합')}${[2,3,4].map(stage=>donut(events.filter(e=>e.stage===stage),stage+'단계')).join('')}</div></section><div class="profile-activity-grid"><section class="panel"><h2>일차별 기록</h2><div class="daily-profile-bars">${Array.from({length:days()},(_,i)=>{const day=summary.byDay?.[i+1]||{};return `<div><strong>${i+1}일차</strong><div class="track"><div class="bar" style="width:${(day.damage||0)/max*100}%"></div></div><span class="daily-stat daily-damage"><small>피해량</small><b>${nf(day.damage||0)}</b></span><span class="daily-stat daily-contribution"><small>기여도</small><b>${formatContribution(day.contribution||0)}</b></span></div>`;}).join('')}</div></section><section class="panel"><h2>보스별 통계</h2>${table(['보스','공격 수','실제 피해량 합계','평균 피해량','최고 피해량'],d.bosses.map(b=>{const rows=events.filter(e=>e.boss===b.id),sum=rows.reduce((s,e)=>s+e.actual,0);return `<tr><th>${chip(b.id,b.id+'넴')}</th><td>${rows.length}</td><td class="number">${nf(sum)}</td><td class="number">${nf(rows.length?sum/rows.length:0)}</td><td class="number">${nf(Math.max(0,...rows.map(e=>e.actual)))}</td></tr>`;}),'profile-boss-stats')}</section></div>${[2,3,4].map(stage=>`<details class="panel section-spacer"><summary>${stage}단계 보스별 통계</summary>${table(['보스','공격 수','합계','평균','최고'],d.bosses.map(b=>{const r=events.filter(e=>e.stage===stage&&e.boss===b.id),sum=r.reduce((s,e)=>s+e.actual,0);return `<tr><th>${chip(b.id,b.id+'넴')}</th><td>${r.length}</td><td>${nf(sum)}</td><td>${nf(r.length?sum/r.length:0)}</td><td>${nf(Math.max(0,...r.map(e=>e.actual)))}</td></tr>`;}))}</details>`).join('')}${all?'':`<section class="panel section-spacer"><h2>공격 상세</h2>${table(['일차','보스','단계 · 회차','실제 피해량','기여도','이월'],events.map(e=>`<tr><td>${e.day}일차</td><td>${chip(e.boss,e.boss+'넴')}</td><td>${e.stage}단계 ${e.lap}회차</td><td class="number">${nf(e.actual)}</td><td class="number">${formatContribution(api.contribution(e,d))}</td><td>${e.carry?'✓':''}</td></tr>`))}</section>`}`;
  }
  function rosterTable(activeOnly=false){
    const members=matchMembers(app().roster.filter(p=>!activeOnly||p.status==='active'),state.search);
    return table(['닉네임','UID','가입월',...(activeOnly?[]:['탈퇴월']),'소속 기간',...(canEdit()?['관리']:[])],members.map(p=>`<tr class="guild-member-${p.status==='active'?'active':'left'}"><th><button class="textbutton" data-guild="profile" data-id="${X(p.id)}">${X(p.name)}</button></th><td class="uid">${X(p.uid||'미기재')}</td><td>${X(p.joinedAt||'미상')}</td>${activeOnly?'':`<td>${p.status==='active'?'—':X(p.leftAt||'미상')}</td>`}<td><strong>${period(p)}</strong>${p.periods?.length>1?`<small>${p.periods.length}개 소속 구간</small>`:''}</td>${canEdit()?`<td><div class="btnbar"><button class="btn sm" data-guild="edit-member" data-id="${X(p.id)}">수정</button><button class="btn sm ${p.status==='left'?'primary':''}" data-guild="toggle-member" data-id="${X(p.id)}">${p.status==='active'?'탈퇴':'복귀'}</button></div></td>`:''}</tr>`),'guild-roster');
  }
  const rosterSearch=()=>`<div class="filterbar"><input id="guild-roster-search" aria-label="클랜원 검색" placeholder="이름 · 초성 · UID" value="${X(state.search)}"></div>`;
  function roster(){return section('클랜원 관리','',canEdit()?'<button class="btn primary" data-guild="add-member">＋ 클랜원</button>':'')+`<section class="panel"><div class="panel-head"><h2>현재 클랜원 ${app().roster.filter(p=>p.status==='active').length} / 30</h2></div>${rosterSearch()}<div id="guild-roster-table">${rosterTable(true)}</div></section>`;}
  function db(){return section('클랜 DB')+`<div class="tabset db-tabs">${[['rates','기여도'],['archive','과거 기록'],['history','과거 이력'],['hall','명예의 전당'],['roster','역대 클랜원']].map(([key,label])=>`<button class="${state.db===key?'active':''}" data-guild="db-tab" data-value="${key}">${label}</button>`).join('')}</div>${state.db==='roster'?`<section class="panel"><div class="panel-head"><h2>역대 클랜원 ${app().roster.length}명</h2>${canEdit()?'<button class="btn primary" data-guild="add-member">＋ 클랜원</button>':''}</div>${rosterSearch()}<div id="guild-roster-table">${rosterTable()}</div></section>`:state.db==='archive'?(api.archiveView?.()||'<section class="panel empty">지난 클랜전 기록이 아직 없습니다.</section>'):state.db==='history'?history():state.db==='hall'?hall():rates()}`;}

  function currentSummary(key){
    const record=app().months[key]||api.getArchiveMonth?.(key);
    if(!record)return null;
    try{return monthlyBattleSummary(record,app().roster);}catch{return null;}
  }
  function history(){
    const records=app().clanHistory||[];
    const known=new Set(records.map(h=>h.month));
    const extra=[...new Set([...Object.keys(app().months||{}),...(app().archivedMonths||[])])]
      .filter(key=>key>=AUTOMATIC_HISTORY_FROM&&!known.has(key))
      .map(key=>({month:key,memberCount:null,winners:{},pendingResult:true,clanRank:null}));
    const displayed=[...records,...extra].sort((a,b)=>b.month.localeCompare(a.month));
    const cells=displayed.map(h=>{
      const auto=h.month>=AUTOMATIC_HISTORY_FROM;
      const summary=auto?currentSummary(h.month):null;
      const sealed=!!h.autoFinalizedAt;
      const changed=sealed&&summary&&resultNeedsReconfirm(h,summary);
      const winners=sealed?h.winners:(summary?.eventCount?summary.winners:h.winners)||{};
      const memberCount=sealed?h.memberCount:(summary?.eventCount?summary.memberCount:h.memberCount);
      const state=auto
        ?(sealed?(changed?'기록 변경 · 재확정 필요':'마감 완료'):(summary?.eventCount?'잠정 기록 · 마감 대기':'집계 대기'))
        :'';
      const status=state?`<div class="history-state ${changed?'history-dirty':sealed?'history-closed':'history-pending'}">${X(state)}</div>`:'';
      const closeButton=auto&&canEdit()&&(!sealed||changed)
        ?`<button type="button" class="btn sm ${changed?'':'primary'}" data-guild="close-month" data-value="${X(h.month)}">${changed?'결과 재확정':'월별 결과 확정'}</button>`:'';
      const edit=canEdit()?`<button type="button" class="textbutton" data-guild="edit-history" data-value="${X(h.month)}">${auto?'클랜 순위 · 비고 수정':'수정'}</button>`:'';
      return `<tr><th>${validURL(h.archiveUrl)?`<a href="${X(validURL(h.archiveUrl))}" target="_blank" rel="noopener noreferrer">${X(h.month)} ↗</a>`:X(h.month)}${status}</th>
        <td>${Number(h.clanRank)>0?nf(h.clanRank)+'위':(typeof h.clanRank==='string'&&h.clanRank.trim()?X(h.clanRank):'—')}</td>
        <td>${Number(memberCount)>0?nf(memberCount)+'명':'미기재'}</td>
        ${['damage','contribution','game'].map(k=>`<td>${(winners?.[k]||[]).map((n,i)=>n?`<div><span class="place">${i+1}위</span> ${X(n)}</div>`:'').join('')||'—'}</td>`).join('')}
        <td class="history-note">${X([...new Set([h.notes,h.mergedNotes,h.recordCondition].filter(Boolean))].join(' · '))}
          <div class="history-actions">${edit}${closeButton}</div></td></tr>`;
    });
    return `<section class="panel"><div class="panel-head"><div><h2>역대 클랜전</h2><p class="small muted">2026년 10월부터 순위와 참가 인원을 자동 집계합니다. 마지막 일차 배틀로그 확인 후 관리자가 확정하면 명예의 전당에 반영됩니다.</p></div>${canEdit()?'<button class="btn" data-guild="add-history">＋ 월별 결과</button>':''}</div>
    ${table(['월','클랜 순위','참가 인원','피해량 1·2위','기여도 1·2위','인게임 1·2위','연혁 · 기록'],cells,'guild-history')}</section>`;
  }
  function hall(){
    const rows=historicalHall(app().clanHistory||[]);
    return `<section class="panel"><div class="panel-head"><div><h2>명예의 전당</h2><p class="small muted">확정된 월별 결과에서 피해량·기여도·인게임 각 1·2위 수상 횟수를 자동 집계합니다. 진행 중인 잠정 기록은 포함하지 않습니다.</p></div></div>
    ${table(['클랜원','피해량 1위 / 2위','기여도 1위 / 2위','인게임 1위 / 2위','총 수상'],rows.map(p=>`<tr><th>${X(p.name)}</th>${['damage','contribution','game'].map(k=>`<td><strong>${nf(p[k]?.[0])}</strong> / ${nf(p[k]?.[1])}</td>`).join('')}<td><span class="medal-count">♛ ${nf(p.total)}</span></td></tr>`),'guild-hall')}</section>`;
  }
  function rates(){
    const d=month(),tops=d.bosses.map(b=>bossTopStats(d,b.id));
    const compact=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'-':(Number(value)/10000).toLocaleString('ko-KR',{maximumFractionDigits:1});
    return `<div class="db-rates-layout"><section class="panel db-rate-factors"><div class="panel-head"><h2>단계별 보스 기여도 배율</h2></div>${table(['단계',...d.bosses.map(b=>chip(b.id,b.id+'넴'))],[1,2,3,4].filter(stage=>d.levels.some(l=>l.stage===stage&&l.count>0)).map(stage=>`<tr><th>${stage}단계</th>${d.bosses.map(b=>`<td class="number">${rate(b.contribution[stage])}</td>`).join('')}</tr>`))}<p class="small muted">2·3단계 관통의 반타·5% 가산은 위 배율에 포함됩니다.</p></section><section class="panel db-rate-records"><div class="panel-head"><h2>4단계 상위 기록 · 전체 보스</h2><span class="small muted">피해량 단위: 만</span></div>${table(['순위',...d.bosses.map(b=>chip(b.id,b.id+'넴'))],[
    ...Array.from({length:10},(_,i)=>`<tr><th>${i+1}위</th>${tops.map(top=>`<td class="number" title="${top.samples[i]?nf(top.samples[i].damage):'-'}">${compact(top.samples[i]?.damage)}</td>`).join('')}</tr>`),
    `<tr class="db-top-average"><th>평균</th>${tops.map(top=>`<td class="number" title="${top.mean===null?'-':nf(top.mean)}">${compact(top.mean)}</td>`).join('')}</tr>`,
    `<tr class="db-top-corrected"><th>보정 평균</th>${tops.map(top=>`<td class="number" title="${top.corrected===null?'-':nf(top.corrected)}">${compact(top.corrected)}</td>`).join('')}</tr>`
    ],'db-top-record-table')}<div class="db-top-record-footer"><span>상위 공격 최대 10건 · 보정률 ${nf(Number(d.options.contributionFactor||.95)*100)}%</span>${canEdit()?'<button class="btn sm" data-guild="edit-factor">보정률 수정</button>':''}</div></section></div>`;
  }
    function comboNotice(){
    const notes=month().comboNotices||{},stage=Number(state.comboStage);
    if(stage===3)return notes.stage3||canEdit()?`<details class="panel combo-notice combo-other-notes"><summary>3단계 조합 참고사항</summary><div class="combo-notice-text">${X(notes.stage3||'')}</div>${canEdit()?'<button class="btn sm" data-guild="edit-combo-notice" data-value="stage3">문구 수정</button>':''}</details>`:'';
    if(comboNoticeHidden(app().active))return `<div class="combo-notice-collapsed"><button class="btn sm" data-guild="show-combo-notice">TP · 스펙 안내 보기</button></div>`;
    if(!notes.tp&&!canEdit())return '';
    return `<section class="panel combo-notice combo-tp-notice" aria-label="4단계 조합 안내"><div class="combo-notice-head"><strong>4단계 조합 안내</strong><div class="btnbar">${canEdit()?'<button class="textbutton" data-guild="edit-combo-notice" data-value="tp">문구 수정</button>':''}<button class="textbutton" data-guild="hide-combo-notice">숨기기</button></div></div><div class="combo-notice-text">${X(notes.tp||'')}</div></section>`;
  }
  function combos(){return comboWorkspace.render();}
  function comboCards(rows){
    return rows.map(c=>{
      const source=/타비/.test(c.tactic||'')?'타비':/택틱/.test(c.tactic||'')?'택틱':'—',damage=formatExpectedDamage(c.expectedDamage),link=validURL(c.url)||validURL(c.video)||validURL(c.tacticUrl);
      const manual=c.manualCount===null||c.manualCount===undefined||c.manualCount===''?'—':c.manualCount;
      const stage3=c.stage===3,time=v=>v===null||v===undefined||v===''?'—':X(v)+'초';
      const summary=stage3?`<div class="combo-summary combo-summary-stage3"><span class="combo-stage">3단계</span><strong class="combo-boss">${c.boss}넴</strong><span class="combo-time" aria-label="필요시간 ${time(c.requiredSeconds)}"><small>필요</small><strong>${time(c.requiredSeconds)}</strong></span><span class="combo-time" aria-label="이월시간 ${time(c.remainingSeconds)}"><small>이월</small><strong>${time(c.remainingSeconds)}</strong></span><span class="combo-operation"><small>조작</small><strong>${X(c.tactic?.trim()||'전부 SET')}</strong></span></div>`:`<div class="combo-summary"><span class="combo-stage">${c.stage}단계</span><strong class="combo-boss">${c.boss}넴</strong><span class="combo-source">${source}</span><span>손컨 ${X(manual)}</span><span>TP ${X(c.tp||'—')}</span><span class="combo-damage"><small>기대딜</small><strong>${X(damage)}</strong></span>${sourceLinkBox(link)}</div>`;
      const details=stage3?(c.note?`<div class="combo-meta"><span>${X(c.note)}</span></div>`:''):(c.requiredSeconds||c.remainingSeconds||c.note||(c.tactic&&!/타비|택틱/.test(c.tactic))?`<div class="combo-meta">${c.requiredSeconds?`<span>필요 시간 ${c.requiredSeconds}초</span>`:''}${c.remainingSeconds?`<span>이월 ${c.remainingSeconds}초</span>`:''}${c.tactic&&!/타비|택틱/.test(c.tactic)?`<span>${X(c.tactic)}</span>`:''}${c.note?`<span>${X(c.note)}</span>`:''}</div>`:'');
      return `<article class="panel combo-card" data-boss-color="${c.boss}" aria-label="${c.stage}단계 ${c.boss}넴 추천 조합">${summary}${canEdit()?`<div class="combo-admin-actions"><button class="btn sm" data-guild="edit-combo" data-id="${X(c.id)}">수정</button><button class="btn sm danger" data-guild="delete-combo" data-id="${X(c.id)}">삭제</button></div>`:''}<div class="combo-party">${Array.from({length:5},(_,i)=>{const portrait=characterPortrait(api.characters,c.characters[i],c.stars?.[i]),url=portrait.url;return `<div>${url?`<span class="combo-source-art"><img src="${X(url)}" ${portraitAttributes(portrait)} alt="${X(c.characters[i])}">${portraitStarOverlay(portrait)}</span>`:'<div class="portrait-missing">?</div>'}<strong class="${isBoosterCharacter(app(),c.characters[i],api.characters)?'is-booster':''}">${X(c.characters[i]||'미선택')}</strong><span>★ ${X(c.stars?.[i]||'?')}</span></div>`;}).join('')}</div>${details}</article>`;
    }).join('')||'<div class="panel empty">등록된 추천 조합이 없습니다.</div>';
  }
  function editComboNotice(key){
    if(!['tp','stage3'].includes(key))return;
    openForm(key==='tp'?'4단계 조합 안내':'3단계 조합 참고사항',[{name:'text',label:'안내 문구',type:'textarea',value:month().comboNotices?.[key]||''}],values=>{month().comboNotices||={tp:'',stage3:''};month().comboNotices[key]=values.text;persist();render();});
  }
  function editMember(id){
    const p=person(id),left=p?.status==='left';
    openForm(p?'클랜원 정보':'클랜원 등록',[{name:'name',label:'닉네임',value:p?.name||'',required:true},{name:'uid',label:'UID',value:p?.uid||''},{name:'joinedAt',label:'가입월',type:'month',value:p?.joinedAt||thisMonth()},...(left?[{name:'leftAt',label:'탈퇴월',type:'month',value:p.leftAt}]:[]),{name:'memo',label:'비고',value:p?.memo||''}],values=>{const previous=p?.joinedAt;const record={...p,...values,status:p?.status||'active'};const saved=upsertMember(app(),record,app().active,month().membership?.[id]?.fromDay||1,month().membership?.[id]?.toDay??null);saved.joinedAt=monthOnly(saved.joinedAt);saved.leftAt=left?monthOnly(saved.leftAt):'';if(!saved.periods?.length)saved.periods=[{joined:saved.joinedAt,left:saved.leftAt}];else{if(saved.periods[0].joined===previous)saved.periods[0].joined=saved.joinedAt;if(left)saved.periods.at(-1).left=saved.leftAt;}persist();render();});
  }
  function toggleMember(id){
    const p=person(id);if(!p)return;
    const leaving=p.status==='active';openForm(leaving?'탈퇴 처리':'클랜원 복귀',[{name:'month',label:leaving?'탈퇴월':'복귀월',type:'month',value:thisMonth(),required:true}],values=>{if(!monthOnly(values.month))throw Error('월을 선택하세요.');if(leaving&&p.periods?.at(-1)?.joined>values.month)throw Error('탈퇴월은 가입월보다 빠를 수 없습니다.');if(!leaving&&p.periods?.at(-1)?.left>values.month)throw Error('복귀월은 마지막 탈퇴월보다 빠를 수 없습니다.');upsertMember(app(),{...p,status:leaving?'left':'active',leftAt:leaving?values.month:''},app().active,month().membership?.[id]?.fromDay||1,leaving?latestDay():null);p.periods||=[{joined:p.joinedAt,left:''}];if(leaving)p.periods.at(-1).left=values.month;else p.periods.push({joined:values.month,left:''});persist();render();});
  }

  function editHistory(key){
    const existing=app().clanHistory?.find(x=>x.month===key),archived=api.getArchiveMonth?.(key);
    const summary=archived?summarizeArchive(archived,app().roster):null;
    const h=existing||(summary?{
      month:key,memberCount:summary.memberCount,
      winners:Object.fromEntries(['damage','contribution','game'].map(metric=>[
        metric,archived.events.length?sortArchiveRankings(summary.rows,metric).slice(0,2).map(p=>p.name):[]
      ]))
    }:{month:key||app().active,memberCount:null,winners:{damage:[],contribution:[],game:[]}});
    const auto=(h.month||key||app().active)>=AUTOMATIC_HISTORY_FROM;
    const base=[{name:'month',label:'월',type:'month',value:h.month,required:true},
      {name:'clanRank',label:'클랜 순위 (공식 발표 후)',type:'number',value:h.clanRank||''}];
    const legacy=[{name:'memberCount',label:'참가 인원',type:'number',value:h.memberCount||''},
      ...['damage','contribution','game'].flatMap((metric,i)=>[0,1].map(rank=>({
        name:metric+rank,label:['피해량','기여도','인게임'][i]+` ${rank+1}위`,
        value:h.winners?.[metric]?.[rank]||''
      })))];
    openForm(auto?'클랜 순위 · 연혁 관리':'월별 클랜전 결과',
      [...base,...(auto?[]:legacy),{name:'archiveUrl',label:'원본 이력 링크',type:'url',value:h.archiveUrl||''},
        {name:'notes',label:'연혁·비고',value:h.notes||''}],v=>{
        if(v.archiveUrl&&!validURL(v.archiveUrl))throw Error('링크를 확인하세요.');
        if(!existing&&(app().clanHistory||[]).some(x=>x.month===v.month))throw Error('해당 월의 기록이 이미 있습니다.');
        if(auto&&v.month!==h.month)throw Error('자동 집계 월은 월 이름을 변경할 수 없습니다.');
        if(!auto&&v.memberCount&&(!Number.isInteger(Number(v.memberCount))||Number(v.memberCount)<1||Number(v.memberCount)>30))
          throw Error('참가 인원은 1~30명입니다.');
        const record={
          ...h,month:v.month,clanRank:v.clanRank===''?(typeof h.clanRank==='string'&&!/^\d+$/.test(h.clanRank)?h.clanRank:null):(Number(v.clanRank)||null),notes:v.notes,archiveUrl:v.archiveUrl,
          ...(auto?{pendingResult:h.pendingResult||(!h.autoFinalizedAt)}:{
            memberCount:Number(v.memberCount)||null,
            winners:Object.fromEntries(['damage','contribution','game'].map(m=>[m,[v[m+0],v[m+1]]]))
          })
        };
        if(existing)Object.assign(existing,record);
        else (app().clanHistory||=[]).push(record);
        rebuildHall();persist();render();
      });
  }
  function rebuildHall(){app().hallOfFame=historicalHall(app().clanHistory||[]);}
  async function closeHistoryMonth(key){
    if(!canEdit())return api.unlock?.();
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)||key<AUTOMATIC_HISTORY_FROM||key>app().active)
      return notify('현재 또는 지난 클랜전 월을 확인해 주세요.');
    try{
      const record=app().months[key]||api.getArchiveMonth?.(key)||await api.loadHistoryMonth?.(key);
      if(!record)return notify('해당 월의 배틀로그를 불러오지 못했습니다.');
      if(!record.events?.length)return notify('입력된 배틀로그가 없어 마감할 수 없습니다.');
      if(!record.events.some(e=>Number(e.day)===Number(record.options?.days||5)))
        return notify('마지막 일차 배틀로그를 입력한 뒤 마감할 수 있습니다.');
      const summary=monthlyBattleSummary(record,app().roster);
      const old=app().clanHistory?.find(h=>h.month===key);
      if(old?.autoFinalizedAt&&!resultNeedsReconfirm(old,summary))
        return notify('이미 최신 기록으로 확정된 클랜전입니다.');
      const names=['피해량','기여도','인게임'];
      const labels=['damage','contribution','game'].map((m,i)=>names[i]+': '+(summary.winners[m]||[]).map((v,j)=>(j+1)+'위 '+v).join(', '));
      if(!confirm(key+' 클랜전 결과를 '+(old?.autoFinalizedAt?'재확정':'확정')+'할까요?\n'
        +'입력된 배틀로그 '+summary.eventCount+'건 / 참가 인원 '+summary.memberCount+'명\n'
        +labels.join('\n')+'\n클랜 순위·연혁과 이전 월 기록은 그대로 유지합니다.'))return;
      const result=confirmMonthlyResult(old,summary);
      if(old)Object.assign(old,result);
      else (app().clanHistory||=[]).push(result);
      rebuildHall();persist();render();
      notify('월별 결과와 명예의 전당 갱신 내용을 저장 중입니다.');
    }catch(error){notify('클랜전 결과를 확정하지 못했습니다: '+error.message);}
  }
  function editCombo(id){
    const c=month().recommendations.find(x=>x.id===id),stage=Number(c?.stage||state.comboStage),stage3=stage===3;
    const timeFields=[{name:'requiredSeconds',label:'필요시간(초)',type:'number',value:c?.requiredSeconds??''},{name:'remainingSeconds',label:'이월시간(초)',type:'number',value:c?.remainingSeconds??''}];
    openForm(c?.sourceTacticId?'추천 조합 · 택틱 작업실 연동 (편성·기대딜은 택틱에서 수정)':'추천 조합',[{name:'stage',label:'단계',type:'number',value:stage,required:true},{name:'boss',label:'보스 번호',type:'number',value:c?.boss||1,required:true},{name:'characters',label:'캐릭터 5명 · 쉼표 구분',value:c?.characters.join(', ')||'',required:true},{name:'stars',label:'성급 5자리',value:c?.stars.join('')||'55555',required:true},...(stage3?[...timeFields,{name:'tactic',label:'조작택틱',value:c?.tactic?.trim()||'전부 SET'}]:[{name:'expectedDamage',label:'기대딜',value:c?.expectedDamage??''},...timeFields,{name:'manualCount',label:'손컨 횟수',type:'number',value:c?.manualCount??''},{name:'tp',label:'TP',value:c?.tp||''},{name:'tactic',label:'조작·택틱',value:c?.tactic||''},{name:'url',label:'영상·택틱 링크',type:'url',value:c?.url||c?.video||''}]),{name:'note',label:c?.sourceTacticId?'메모 (택틱 작업실 연동)':'비고',value:c?.note||''}],v=>{
      const chars=v.characters.split(/[,，]/).map(n=>n.trim()).filter(Boolean);
      if(chars.length!==5||!(/^[1-6]{5}$/).test(v.stars))throw Error('캐릭터 5명과 성급 5자리를 입력하세요.');
      if(![3,4].includes(Number(v.stage))||![1,2,3,4,5].includes(Number(v.boss)))throw Error('단계는 3~4, 보스는 1~5입니다.');
      if(v.url&&!validURL(v.url))throw Error('링크를 확인하세요.');
      const data={...c,...v,id:c?.id||makeId(),characters:chars,stars:[...v.stars],stage:Number(v.stage),boss:Number(v.boss),requiredSeconds:v.requiredSeconds===''?null:Number(v.requiredSeconds),remainingSeconds:v.remainingSeconds===''?null:Number(v.remainingSeconds)};
      if(data.stage===3&&!data.tactic?.trim())data.tactic='전부 SET';
      if(data.stage===4&&v.manualCount!==''&&!/^(?:[0-9])(?:\.5)?$/.test(v.manualCount))throw Error('손컨은 0~9.5까지 0.5 단위로 입력하세요.');
      if(c?.sourceTacticId){
        const sourceTactic=month().tactics.find(t=>String(t.id)===String(c.sourceTacticId));
        if(sourceTactic){sourceTactic.manualCount=v.manualCount;sourceTactic.tp=v.tp;sourceTactic.note=v.note;}
      }
      if(c)Object.assign(c,data);else month().recommendations.push(data);persist();render();
    });
  }
  document.addEventListener('click',async event=>{const b=event.target.closest('[data-guild]');if(!b)return;const key=b.dataset.guild;if(['add-member','edit-member','toggle-member','add-combo','edit-combo','delete-combo','edit-factor','add-history','edit-history','close-month','edit-combo-notice'].includes(key)&&!canEdit()){api.unlock();return;}switch(key){
    case 'day':state.day=Number(b.dataset.value);render();break;
    case 'dashboard-day':state.dashboardDay=Number(b.dataset.value);render();break;
    case 'sort':state.sort=b.dataset.value;render();break;
    case 'profile':state.profile=b.dataset.id;api.navigate('profile');break;
    case 'pdf':try{await downloadProfilePdf(profileData());notify('이력서 PDF를 저장했습니다.');}catch(e){notify('PDF 생성에 실패했습니다: '+e.message);}break;
    case 'db-tab':state.db=b.dataset.value;if(state.db==='archive'&&api.openArchive)api.openArchive();else{api.onDbTabChange?.(state.db);render();}break;
    case 'top-boss':state.boss=Number(b.dataset.value);render();break;
    case 'combo-stage':state.comboStage=b.dataset.value;render();break;
    case 'edit-combo-notice':editComboNotice(b.dataset.value);break;
    case 'hide-combo-notice':setComboNoticeHidden(app().active,true);render();break;
    case 'show-combo-notice':setComboNoticeHidden(app().active,false);render();break;
    case 'combo-boss':state.comboBoss=b.dataset.value;render();break;
    case 'add-member':editMember();break;case 'edit-member':editMember(b.dataset.id);break;case 'toggle-member':toggleMember(b.dataset.id);break;
    case 'add-history':editHistory();break;case 'edit-history':editHistory(b.dataset.value);break;case 'close-month':await closeHistoryMonth(b.dataset.value);break;
    case 'add-combo':editCombo();break;case 'edit-combo':editCombo(b.dataset.id);break;
    case 'delete-combo':if(confirm('이 추천 조합을 삭제할까요? 택틱과 연결된 조합은 추천 조합에서만 제외합니다.')){const removing=month().recommendations.find(c=>c.id===b.dataset.id);suppressTacticRecommendation(month(),removing);month().recommendations=month().recommendations.filter(c=>c.id!==b.dataset.id);persist();render();}break;
    case 'edit-factor':openForm('평균 보정률',[{name:'factor',label:'보정률(%)',type:'number',value:Number(month().options.contributionFactor||.95)*100}],v=>{if(!(Number(v.factor)>0&&Number(v.factor)<=100))throw Error('보정률은 0 초과 100 이하입니다.');month().options.contributionFactor=Number(v.factor)/100;api.replay(month());persist();render();});break;
  }});
  document.addEventListener('change',e=>{if(e.target.id==='guild-profile'){state.profile=e.target.value;render();}});
  document.addEventListener('input',e=>{if(e.target.id==='guild-roster-search'){state.search=e.target.value;document.querySelector('#guild-roster-table').innerHTML=rosterTable(!!document.querySelector('[data-roster-active]'));}});
  return {openArchive:()=>{state.db='archive';},isArchiveOpen:()=>state.db==='archive',dashboard,ranking,profile,roster:()=>roster().replace('guild-roster-table','guild-roster-table" data-roster-active="true'),db,combos,afterMonthChange:()=>{state.day=null;state.dashboardDay=null;state.comboStage='4';state.profile=CLAN_PROFILE;},profileData};
}
