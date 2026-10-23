(async()=>{'use strict';
const {menuArtMarkup}=await import('./menu-art.mjs?v=20261022-sd01');
const {summarizeArchive,sortArchiveRankings}=await import('./archive-summary.mjs?v=20261022-import01');
const {createMonthView}=await import('./month-view.mjs?v=20261022-import01');
const {sequenceVisible}=await import('./view-settings.mjs?v=20261023-image-cleanup01');
const {installPortraitFallback,withPortraitLibrary,findCharacter,normalizeCharacterName}=await import('./character-portraits.mjs?v=20261023-image-cleanup01');
installPortraitFallback();
const {assetUrl}=await import('./site-paths.mjs?v=20261023-image-cleanup01');
const {browserApiClient}=await import('./api-client.mjs?v=20261024-public-battle-append01');
const apiFetch=browserApiClient();
const {startPresence}=await import('./presence.mjs?v=20261023-combo01');
startPresence({apiFetch,onCount:count=>{const value=document.getElementById('online-count'),badge=document.getElementById('online-presence');if(!value||!badge)return;const text=count===null?'—':String(count);if(value.textContent!==text)value.textContent=text;badge.dataset.connected=String(count!==null);}});
const Engine=await import('./engine.mjs?v=20261022-ui14');
const {ensureRoster,syncRoster,memberLabel}=await import('./roster.mjs?v=20261022-ui14');
const {createWorkflow}=await import('./workflow.mjs?v=20261024-admin-battle-entry01');
const {ensureTactics}=await import('./tactics-model.mjs?v=20261024-tactic-conditions01');
const {syncTacticRecommendations}=await import('./tactic-combo-sync.mjs?v=20261024-tactic-conditions01');
const {applySourceData,remainingAttacks}=await import('./guild-model.mjs?v=20261022-hall01');
const {createGuildWorkspace}=await import('./guild-workspace.mjs?v=20261024-tactic-conditions01');
const {createTacticWorkspace}=await import('./tactics-workspace.mjs?v=20261024-tactic-note-unlabeled01');
const {createBattleImageImport}=await import('./battle-image-import.mjs?v=20261023-extraction03');
const [TACTIC_META,CHARACTERS,ROW_FORMATS,BOSS_ART,GUILD_SOURCE,PORTRAIT_LIBRARY,FUTURE_BOSSES]=await Promise.all(['/tactic-metadata.json','/characters.json','/tactic-row-formats.json','/bosses.json','/guild-source.json','/portrait-library.json','/future-bosses.json'].map(async path=>{const response=await fetch(assetUrl(path)+'?v=20261023-image-cleanup01');if(!response.ok)throw Error('택틱 자료를 불러오지 못했습니다.');return response.json()}));
const CHARACTER_CATALOG=withPortraitLibrary(CHARACTERS.characters,PORTRAIT_LIBRARY);
const DEFAULT=JSON.parse(document.getElementById('seed-data').textContent);
const STORAGE='nyangnyang-work-recovery-v1';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const deepcopy=o=>JSON.parse(JSON.stringify(o));
const X=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>typeof n==='number'&&!Number.isFinite(n)?'-':Number(n||0).toLocaleString('ko-KR',{maximumFractionDigits:2});
const formatContribution=n=>{const value=Number(n??0);return Number.isFinite(value)?Math.round(value).toLocaleString('ko-KR'):'-';};
const abbrev=n=>{if(typeof n==='number'&&!Number.isFinite(n))return '-';n=Number(n)||0;if(Math.abs(n)>=1e8)return (n/1e8).toFixed(2).replace(/\.00$/,'')+'억';if(Math.abs(n)>=1e4)return(n/1e4).toFixed(1).replace(/\.0$/,'')+'만';return nf(n)};
const code=(kind,txt)=>`<span class="pill ${kind}">${X(txt)}</span>`;
const rnumber=n=>Math.round(Number(n)||0);
const monthFormat=m=>m.replace('-','년 ')+'월';
const seedMonth=deepcopy(DEFAULT.months['2026-10']);
let boot;
try { const response=await apiFetch('/api/state?compact=1',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();boot=await response.json(); }
catch { $('#content').innerHTML='<section class="panel"><h1>기록에 연결하지 못했습니다</h1><p class="muted">연결을 확인한 뒤 다시 시도해 주세요. 기존 기록은 변경되지 않았습니다.</p><button class="btn primary" onclick="location.reload()">다시 연결</button></section>';$('#sync-state').textContent='연결 실패';return; }
let app=boot.data||deepcopy(DEFAULT);
let splitStorage=boot.splitStorage===true,restoreArchivesPending=false;
const archiveCache=new Map();
const importedArchiveMonths=Array.from({length:8},(_,i)=>'2026-'+String(i+1).padStart(2,'0'));
const monthView=createMonthView({getApp:()=>app,cache:archiveCache,availableMonths:importedArchiveMonths,
  prepare:record=>{
    if(!Array.isArray(record.sourceRankings)){Engine.replayMonth(record);return;}
    // Imported months use an older sheet schema. Hydrate the read-only view
    // without replaying or rewriting its source HP, sequence or stage values.
    const memberNames=[...new Set([...(record.members||[]),...record.events.map(e=>e.member)].filter(Boolean))];
    record.members=memberNames;
    const idsByName=new Map();
    for(const name of memberNames){
      const match=app.roster?.find(p=>p.name===name||p.aliases?.includes(name));
      idsByName.set(name,match?.id||'archive-member-'+record.month+'-'+encodeURIComponent(name));
    }
    record.memberIds=memberNames.map(name=>idsByName.get(name));
    record.membership||={};
    for(const id of record.memberIds)record.membership[id]||={fromDay:1,toDay:Number(record.options?.days)||5};
    record.dayBreaks||=[];
    record.tactics||=[];
    const pending=new Map();
    const totals=new Map(record.sourceRankings.map(p=>[p.name,Number(p.game)||0]));
    const weights=new Map();
    for(const e of [...record.events].sort((a,b)=>a.seq-b.seq)){
      e.memberId=idsByName.get(e.member)||'archive-member-'+record.month+'-'+encodeURIComponent(e.member||'unknown');
      const key=e.day+':'+e.memberId;
      if(!pending.has(key))pending.set(key,[]);
      const carries=pending.get(key);
      if(e.carry){
        const index=carries.findIndex(x=>Number(x.hitIndex)===Number(e.carryIndex));
        const matched=index>=0?carries.splice(index,1)[0]:carries.shift();
        e.carryFrom=matched?.id||null;
      }else if(e.kill){
        carries.push({id:e.id,hitIndex:e.hitIndex});
      }
      const base=(Number(e.actual)||0)*(Number(record.bosses.find(b=>b.id===Number(e.boss))?.game?.[e.stage])||1);
      e.archiveWeight=base;
      weights.set(e.member,(weights.get(e.member)||0)+base);
    }
    for(const e of record.events){
      e.sourceGame=(totals.get(e.member)||0)*e.archiveWeight/(weights.get(e.member)||1);
      delete e.archiveWeight;
    }
  },
  fetchMonth:async key=>{
    const fromSheet=importedArchiveMonths.includes(key);
    const archivePath='/archive-data/'+key+'.json';
    const url=location.hostname==='heysyu84.github.io'
      ? assetUrl(archivePath)
      : 'https://heysyu84.github.io/priconne'+archivePath;
    const res=fromSheet?await fetch(url,{cache:'no-store'}):await apiFetch('/api/archive?month='+key,{cache:'no-store'});
    if(!res.ok)throw Error('과거 월 데이터를 가져오지 못했습니다. 다시 시도해 주세요.');
    return fromSheet?await res.json():(await res.json()).data;
  }
});
let detailMonthLoading='',detailMonthRequest=0;
const canEdit=()=>editor&&!monthView.isPast();
let archiveLoading='',archiveError='';
const archiveKeys=()=>{const latest=Object.keys(app.months).sort().at(-1);return [...new Set([...importedArchiveMonths,...(app.archivedMonths||[]),...Object.keys(app.months).filter(k=>k!==latest)])].sort().reverse()};
const rosterMigrated=ensureRoster(app,DEFAULT.rosterSeed||[]);
const tacticsMigrated=ensureTactics(app,TACTIC_META,ROW_FORMATS);
const guildMigrated=applySourceData(app,GUILD_SOURCE);
const comboSynced=Object.values(app.months).map(syncTacticRecommendations).some(Boolean);
app.active=Object.keys(app.months).sort().at(-1);
let editor=false;try{const result=await apiFetch('/api/editor',{cache:'no-store'});editor=!!(await result.json()).editor;}catch{}
let revision=boot.revision,dirty=0,saving=false,saveTimer=null,blocked=false;
for(const month of Object.values(app.months))Engine.replayMonth(month);
let ui={page:'overview',day:'all',filter:'',boss:'all',member:seedMonth.members[0],rank:'damage',tactic:seedMonth.tactics[0]?.id||'',tacticSearch:'',editor:false,editLog:null,calcSeconds:61,calcText:'',calcResult:null,configStage:4,historyMonth:null,logPage:1,archiveSort:'contribution'};
const archiveHash=location.hash.match(/^#archive(?:=(\d{4}-\d{2}))?$/);
if(archiveHash){ui.page='archive';ui.archiveMonth=archiveHash[1]||null;}
const current=()=>monthView.record();
const money=n=>nf(Math.round(n));
const workflow=createWorkflow({getApp:monthView.app,getMonth:current,setApp:value=>{app=value;syncRoster(app);for(const d of Object.values(app.months))Engine.replayMonth(d)},persist,replay:Engine.replayMonth,render,notify:notice,navigate:goto,section,nf,escapeHtml:X,contribution:contrib,formatContribution,getBosses:()=>bossStatus(),bossPortrait:id=>bossPortrait(id),canEdit,canSubmitBattle:()=>!monthView.isPast(),submitPublicBattle,unlock:unlock,openForm});
const tacticWorkspace=createTacticWorkspace({getApp:monthView.app,getMonth:current,persist:()=>{workflow.clearUndo();persist()},render,notify:notice,navigate:goto,section,copyText,estimateCarry:Engine.estimateCarry,catalog:CHARACTER_CATALOG,bossStatus:()=>bossStatus(),bossPortrait:id=>bossPortrait(id),canEdit,unlock:unlock,openForm});
const guild=createGuildWorkspace({getApp:monthView.app,getMonth:current,persist,render,notify:notice,navigate:goto,section,nf,escapeHtml:X,aggregates,contribution:contrib,formatContribution,replay:Engine.replayMonth,characters:CHARACTER_CATALOG,canEdit,unlock,openForm,archiveView:archiveRecords,getArchiveMonth:key=>archiveCache.get(key)||app.months[key],loadHistoryMonth:key=>monthView.load(key),openArchive:()=>goto('archive'),onDbTabChange:()=>{if(location.hash.startsWith('#archive'))window.history.replaceState(null,'',location.pathname+location.search);}});
const imageImporter=createBattleImageImport({getApp:monthView.app,getMonth:current,persist,render,navigate:goto,notify:notice,canEdit,unlock,replay:Engine.replayMonth,beforeCommit:()=>workflow.rememberExternal()});
function persist(){
  if(!canEdit())return false;
  syncTacticRecommendations(app.months[app.active]);
  try{localStorage.setItem(STORAGE,JSON.stringify(app))}catch{}
  dirty++;saveStatus('saving');clearTimeout(saveTimer);saveTimer=setTimeout(flushSave,450);
}
async function submitPublicBattle(entry){
 if(monthView.isPast())throw Error('과거 클랜전에는 공격을 등록할 수 없습니다.');
 if(editor)throw Error('관리자 입력은 기존 등록 경로를 이용해 주세요.');
 const response=await apiFetch('/api/battle-entry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(entry)});
 let result={};try{result=await response.json()}catch{}
 if(!response.ok)throw Error(result.error||'공격 등록 서버에 연결하지 못했습니다. 입력값은 유지됩니다.');
 if(!result.data?.months||!Number.isSafeInteger(result.revision))throw Error('저장 결과를 확인할 수 없습니다. 새로고침해 중복 등록 여부를 확인해 주세요.');
 app=result.data;
 ensureRoster(app,DEFAULT.rosterSeed||[]);
 ensureTactics(app,TACTIC_META,ROW_FORMATS);
 applySourceData(app,GUILD_SOURCE);
 for(const record of Object.values(app.months))syncTacticRecommendations(record);
 for(const record of Object.values(app.months))Engine.replayMonth(record);
 revision=result.revision;
 saveStatus('saved');
}
function saveStatus(state){const el=$('#sync-state');if(!el)return;el.dataset.state=state;el.textContent={saved:'● 저장 완료',saving:'저장 중…',error:'다시 저장',conflict:'변경 충돌'}[state]||'연결 중';}
async function flushSave(){
  if(saving||!dirty||blocked)return;saving=true;saveStatus('saving');
  try{while(dirty){const change=dirty;const response=await apiFetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json','X-Nyang-Client':'4'},body:JSON.stringify({revision,data:app,archiveMode:splitStorage?'v1':undefined,restoreArchives:restoreArchivesPending})});const result=await response.json();if(!response.ok){if(response.status===403){editor=false;render();}blocked=response.status===409;throw Error(result.error||'저장하지 못했습니다.');}revision=result.revision;if(dirty===change)dirty=0;
    if(splitStorage&&!dirty){const live=Object.keys(app.months).sort().at(-1);if(live){app.archivedMonths=[...new Set([...(app.archivedMonths||[]),...Object.keys(app.months).filter(k=>k!==live)])].sort().reverse();app.months={[live]:app.months[live]};app.active=live;}}restoreArchivesPending=false;}
    saveStatus('saved');$('#sync-message').classList.add('hidden');
  }catch(error){saveStatus(blocked?'conflict':'error');const box=$('#sync-message');box.innerHTML=X(error.message)+' <button class="textbutton" id="backup-conflict">JSON 백업</button> <button class="textbutton" id="retry-connection">'+(blocked?'최신 기록 다시 불러오기':'다시 저장')+'</button>';box.classList.remove('hidden');}
  finally{saving=false;}
}
function notice(t){let el=$('#toast');el.textContent=t;el.classList.remove('hidden');clearTimeout(notice._t);notice._t=setTimeout(()=>el.classList.add('hidden'),3200)}
function archiveVisible(){return ui.page==='db'&&guild.isArchiveOpen();}
function goto(page){
  if(!workflow.beforeNavigate()||!tacticWorkspace.beforeNavigate())return;
  if(page==='archive'){guild.openArchive();ui.page='db';}else ui.page=page==='calculator'?'tactics':page;
  ui.editor=false;render();
  if(archiveVisible()){
    const key=archiveKeys().includes(ui.archiveMonth)?ui.archiveMonth:archiveKeys()[0];
    window.history.replaceState(null,'','#archive'+(key?'='+key:''));
    if(key)void loadArchive(key);
  }else if(location.hash.startsWith('#archive'))window.history.replaceState(null,'',location.pathname+location.search);
  window.scrollTo({top:0,behavior:'instant'});
}
async function selectDetailMonth(key,overview=false){
  if(!monthView.keys().includes(key))return;
  if(!workflow.beforeNavigate()||!tacticWorkspace.beforeNavigate()){$('#month-select').value=monthView.key();return;}
  const request=++detailMonthRequest;detailMonthLoading=key;render();
  try{
    if(!await monthView.select(key)||request!==detailMonthRequest)return;
    workflow.afterMonthChange();workflow.clearUndo();guild.afterMonthChange();
    ui.member=current().members[0];ui.tactic=current().tactics[0]?.id||'';ui.day='all';ui.logPage=1;
    if(overview||archiveVisible())goto('overview');
  }catch(error){if(request===detailMonthRequest)notice(error.message);}
  finally{if(request===detailMonthRequest){detailMonthLoading='';render();}}
}
function sortedEvents(d=current()){return [...d.events].sort((a,b)=>(a.seq-b.seq)||Number(a.sourceRow||0)-Number(b.sourceRow||0))}
function maxDay(){return Math.max(current().options.days||5,...current().events.map(e=>e.day||0),1)}
function phase(lap,d=current()){return d.levels.find(l=>l.count>0&&Number(lap)>=l.start&&Number(lap)<=l.end)?.stage||d.options.startStage||2}
function score(e,d=current()){return Number.isFinite(e.sourceGame)?e.sourceGame:(Number(e.actual)||0)*(Number(d.bosses[e.boss-1]?.game?.[e.stage])||0)}
function contrib(e,d=current()){return Number.isFinite(e.sourceContribution)?e.sourceContribution:Engine.contribution(e,d)}
function aggregates(d=current(),through=maxDay()){
 const people={};for(let [index,name] of d.members.entries())people[name]={name,memberId:d.memberIds[index],damage:0,contribution:0,game:0,shots:0,carry:0,dayDamage:0,dayContribution:0,byDay:{},byBoss:{}};
 for(const e of d.events){if(Number(e.day)>through)continue;const n=e.member||'미등록';let p=people[n]||(people[n]={name:n,damage:0,contribution:0,game:0,shots:0,carry:0,dayDamage:0,dayContribution:0,byDay:{},byBoss:{}});p.damage+=Number(e.actual)||0;p.contribution+=contrib(e,d);p.game+=score(e,d);p.shots+=!e.carry?1:0;p.carry+=e.carry?1:0;p.byDay[e.day]||(p.byDay[e.day]={damage:0,contribution:0,shots:0,carry:0});let day=p.byDay[e.day];day.damage+=Number(e.actual)||0;day.contribution+=contrib(e,d);day.shots+=e.carry?0:1;day.carry+=e.carry?1:0;p.byBoss[e.boss]||(p.byBoss[e.boss]={damage:0,shots:0,best:0});let b=p.byBoss[e.boss];b.damage+=Number(e.actual)||0;b.shots++;b.best=Math.max(b.best,Number(e.actual)||0)}
 for(let p of Object.values(people)){const membership=d.membership[p.memberId]||{fromDay:1,toDay:null};p.allowedShots=Math.max(0,Math.min(through,membership.toDay??through)-membership.fromDay+1)*Number(d.options.dailyAttacks||3);p.missing=Math.max(0,p.allowedShots-p.shots);p.dayDamage=p.byDay[through]?.damage||0;p.dayContribution=p.byDay[through]?.contribution??0}return Object.values(people)
}
function bossStatus(d=current()){return Engine.bossProgress(d)}
function bossPortrait(id){
  const boss=current().bosses.find(b=>b.id===Number(id));
  if(!boss)return '';
  const monthly=BOSS_ART[monthView.key()]?.[id];
  const catalog=BOSS_ART.catalog||{};
  const art=monthly?.name===boss.name?monthly:
    catalog[boss.name]||Object.values(catalog).find(item=>item.aliases?.includes(boss.name));
  const code=art?.referenceKey;
  if(art?.portrait?.startsWith('/images/bosses/'))return assetUrl(art.portrait);
  return /^[1-5]\.\d+$/.test(code||'')
    ? 'https://purikonekrsemi.github.io/PurikoneKrSheet/images/Boss/'+code+'.png'
    : '';
}
function section(head,subtitle='',actions=''){const art=menuArtMarkup(ui.page);return `<div class="hero ${art?'hero-with-art':''}"><div class="hero-copy"><div class="hero-heading"><h1>${X(head)}</h1></div>${actions?`<div class="btnbar">${actions}</div>`:''}</div>${art}</div>`}
function metric(label,value,desc){return `<div class="metric"><div class="k">${X(label)}</div><div class="v">${X(value)}</div><div class="d">${X(desc)}</div></div>`}
function dateOptions(){return ['all',...Array.from({length:maxDay()},(_,i)=>String(i+1))].map(day=>`<button class="${ui.day===day?'active':''}" data-day="${day}">${day==='all'?'전체':`${day}일차`}</button>`).join('')}
function bossTiles(d=current()){return `<section class="raid-boss-section" aria-label="보스 진행 현황"><div class="raid-section-label"><span>✦ RAID BOSSES</span></div><div class="boss-grid">${bossStatus(d).map((b,i)=>`<article class="boss-card" data-boss-card="${b.id}" data-boss-color="${b.id}" style="--boss-tone:${['#ea9999','#ffe599','#b6d7a8','#a4c2f4','#b4a7d6'][i]}"><div class="boss-top"><div class="boss-art">${bossPortrait(b.id)?`<img src="${X(bossPortrait(b.id))}" alt="${X(b.name)} 보스">`:`<span>${b.id}</span>`}<span class="boss-emblem">${b.id}</span></div><div><div class="boss-num">BOSS ${String(b.id).padStart(2,'0')}</div><h2 class="boss-name">${X(b.name)}</h2><div class="boss-phase">${b.stage}단계 <strong>${b.lap}회차</strong></div></div></div><div class="boss-hp"><span>남은 HP</span><strong><span class="boss-hp-value">${nf(b.hp)}</span><span class="boss-hp-ratio">/ ${nf(b.max)}</span></strong></div><div class="track boss-track"><div class="bar ${b.hp/b.max<.25?'orange':''}" style="width:${Math.max(0,Math.min(100,b.hp/b.max*100))}%"></div></div><div class="boss-info"><span>MAX ${nf(b.max)}</span><span>${b.max?(b.hp/b.max*100).toFixed(1):0}%</span></div><button type="button" class="boss-tactic-link" data-boss-center="${b.id}">${b.id}넴 택틱 보기 <span>→</span></button></article>`).join('')}</div></section>`}
function overview(){const d=current(),remaining=remainingAttacks(d),day=maxDay(),arr=aggregates(d,day),events=d.events,dam=arr.reduce((s,p)=>s+p.damage,0),game=arr.reduce((s,p)=>s+p.game,0),top=[...arr].sort((a,b)=>b.contribution-a.contribution).slice(0,7),max=top[0]?.contribution||1,lev=bossStatus(d).reduce((a,b)=>Math.max(a,b.lap),1);return section('클랜전 상황판',`${monthFormat(monthView.key())} · 보스 진행과 다음 공격을 한눈에`,`<button class="btn" data-go="battle">배틀로그 ↗</button><button class="btn primary" data-go="tactics">택틱 확인 →</button>`)+bossTiles(d)+`<div class="metrics raid-stats">${metric('누적 실제 피해량',abbrev(dam),'초과 피해 제외 합계')}${metric('누적 인게임 점수',abbrev(game),'보스·단계별 배율 적용')}${metric('잔여타수',nf(remaining.normal)+'+'+nf(remaining.carry)+'타',remaining.day+'일차'+(remaining.ended?' 종료':' · 기본타 + 이월타'))}${metric('최고 진행 회차',lev+'회차','5개 보스 중 최고')}</div><div class="grid-2"><section class="panel"><div class="panel-head"><h2>최근 배틀로그</h2><button class="btn sm ghost" data-go="battle">전체 기록 보기 →</button></div>${logTable(sortedEvents(d).slice(-9).reverse(),false)}</section><section class="panel"><div class="panel-head"><h2>기여도 상위</h2><button class="btn sm ghost" data-go="members">개인 통계 →</button></div><div class="rank-list">${top.map((p,i)=>`<div><div class="rank-head"><div class="rank-name"><span class="rank-num">${i+1}</span>${X(p.name)}</div><span class="rank-data">${formatContribution(p.contribution)}</span></div><div class="track"><div class="bar" style="width:${Number.isFinite(p.contribution)?p.contribution/max*100:0}%"></div></div></div>`).join('')}</div></section></div><div class="note section-spacer" ${editor?'':'hidden'}>공격 기록은 입력한 순서대로 계산됩니다. 월별 설정과 택틱은 선택한 월에만 적용되며 변경 사항은 자동 저장됩니다.</div>`}
function logTable(rows,showEdit=true){
 if(!rows.length)return '<div class="empty">조회할 공격 기록이 없습니다.</div>';
 const seq=sequenceVisible();
 return `<div class="table-scroll"><table class="datatable recent-battle-table"><thead><tr>${seq?'<th>순번</th>':''}<th class="day-heading">일차</th><th class="boss-progress-heading">보스 · 진행</th><th class="member-heading">클랜원</th><th class="number">기록 피해량</th><th class="type-heading">유형</th><th class="number">실제 피해량</th><th class="number">기여도</th>${showEdit&&canEdit()?'<th></th>':''}</tr></thead><tbody>${rows.map(e=>`<tr>${seq?`<td class="h-num">#${e.seq}</td>`:''}<td class="battle-day-cell">${e.day}일차</td><td class="boss-cell">${e.boss} · ${X(current().bosses.find(b=>b.id===e.boss)?.name||e.boss+'넴')}<small>${e.stage}단계 · ${e.lap}회차</small></td><td class="member-cell" title="${X(e.member)}"><strong>${X(e.member)}</strong></td><td class="number">${nf(e.damage)}</td><td class="carry-cell">${e.carry?code('blue battle-kind','이월타'):e.kill?code('positive battle-kind','격파'):code('gray battle-kind','일반')}${e.carry&&e.kill?code('positive battle-kind','격파'):''}</td><td class="number calculated">${nf(e.actual)}</td><td class="number calculated contribution-cell">${formatContribution(contrib(e))}</td>${showEdit&&canEdit()?`<td><button class="btn sm" data-editlog="${X(e.id)}">수정</button></td>`:''}</tr>`).join('')}</tbody></table></div>`;
}
function battle(){return workflow.battleView()}
function roster(){return guild.roster()}
function tactics(){return tacticWorkspace.view()}
function calculator(){return tacticWorkspace.calculator()}
function members(){return guild.ranking()}
function futureBossPreview(){
  const months=Object.values(FUTURE_BOSSES.months||{}).filter(c=>c.krMonth>=app.active).sort((a,b)=>a.krMonth.localeCompare(b.krMonth));
  const selected=FUTURE_BOSSES.months?.[monthView.key()];
  const verified=selected?.bosses?.length===5&&selected.bosses.every(b=>b.status==='verified');
  const updated=FUTURE_BOSSES.updatedAt?new Date(FUTURE_BOSSES.updatedAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'최초 수집 대기';
  const apply=verified&&canEdit()?'<button class="btn sm" data-action="applyfuture">선택 월 보스 이름 적용</button>':'';
  return `<section class="panel section-spacer future-boss-panel"><div class="panel-head"><div><h2>미래 클랜전 보스 편성</h2><p class="small muted">일본 서버 편성을 13개월 뒤 한국 서버 예정 월로 표시합니다. 원본: Aikurumi · 최종 갱신: ${X(updated)}</p></div>${apply}</div>
  ${months.length?'<div class="future-months">'+months.map((c,i)=>`<details class="future-month" ${i===0?'open':''}><summary><strong>${X(monthFormat(c.krMonth))}</strong><span class="muted small">일섭 ${X(monthFormat(c.jpMonth))} · ${c.bosses.filter(b=>b.status==='verified').length}/5명 매칭</span></summary><div class="future-boss-list">${c.bosses.map(b=>{const img=b.status==='verified'&&(b.portrait||(/^[0-9]+[.][0-9]+$/.test(b.referenceKey||'')?'https://purikonekrsemi.github.io/PurikoneKrSheet/images/Boss/'+b.referenceKey+'.png':''));return `<div class="future-boss-item"><div class="future-boss-art">${img?`<img loading="lazy" src="${X(img)}" alt="">`:`<span>${b.slot}</span>`}</div><strong>${b.slot}넴 · ${X(b.name)}</strong><span class="small ${b.status==='verified'?'muted':'warning'}">${b.status==='verified'?'보스 확인':'한글 이름 확인 필요'}</span></div>`}).join('')}</div></details>`).join('')+'</div>':'<p class="muted small">아직 원본 사이트에서 확인한 편성 데이터가 없습니다. GitHub 동기화가 성공하면 여기에 자동 표시됩니다.</p>'}
  <p class="small muted">미리보기는 기록과 분리됩니다. 5명 모두 확인된 달에만 보스 이름을 적용할 수 있으며 HP·점수 배율은 자동 변경하지 않습니다.</p></section>`;
}
function applyFutureBossNames(){
  if(!canEdit())return unlock();
  const lineup=FUTURE_BOSSES.months?.[monthView.key()];
  if(!lineup||lineup.bosses?.length!==5||lineup.bosses.some(b=>b.status!=='verified'))return notice('5명의 보스가 모두 확인된 편성만 적용할 수 있습니다.');
  const month=current();
  if(month.events.length||month.tactics.some(t=>!t.trashedAt))return notice('기록이나 택틱이 있는 월은 자동 적용하지 않습니다. 필요하면 월별 설정에서 직접 변경해 주세요.');
  if(!confirm(monthFormat(monthView.key())+' 보스 5명의 이름만 적용할까요? HP·배율은 기존 설정을 유지합니다.'))return;
  const next=deepcopy(month);
  for(const b of lineup.bosses){const target=next.bosses.find(x=>x.id===b.slot);if(target)target.name=b.name;}
  Engine.replayMonth(next);app.months[app.active]=next;persist();render();notice('확인된 보스 이름을 적용했습니다. HP와 배율은 별도로 확인해 주세요.');
}
function settings(){const d=current(),s=ui.configStage;return section('규칙 · 월별 설정','보스 교체·HP 변경·단계 전환 구간·기여도·인게임 배율을 관리하는 설정실',`<button class="btn" data-action="export">설정 포함 백업</button><button class="btn primary ${canEdit()?'':'hidden'}" data-action="saverules">설정 저장</button>`)+`<div class="panel"><div class="panel-head"><h2>클랜전 기본 설정</h2><span class="pill warning">${monthView.isPast()?'과거 월 조회':'현재 월에만 적용'}</span></div><div class="settings-grid"><div class="field"><label>개최 월</label><input value="${X(monthView.key())}" disabled></div><div class="field"><label>개최 일수</label><input type="number" id="setting-days" min="1" max="10" value="${d.options.days}"></div><div class="field"><label>시작 단계</label><select id="setting-start"><option value="2" ${d.options.startStage===2?'selected':''}>2단계</option><option value="1" ${d.options.startStage===1?'selected':''}>1단계</option><option value="3" ${d.options.startStage===3?'selected':''}>3단계</option></select></div><div class="field"><label>일일 기본 타수</label><input type="number" id="setting-shots" min="1" max="10" value="${d.options.dailyAttacks}"></div></div><div class="divider"></div><h3>단계별 회차 구간</h3><div class="table-scroll"><table class="datatable rule-table"><thead><tr><th>단계</th><th>시작 회차</th><th>종료 회차</th><th>회차 수</th></tr></thead><tbody>${d.levels.map(l=>`<tr><td>${l.stage}단계</td><td><input type="number" data-level="${l.stage}-start" min="1" value="${l.start??''}"></td><td><input type="number" data-level="${l.stage}-end" min="1" value="${l.end??''}"></td><td>${l.count||'—'}</td></tr>`).join('')}</tbody></table></div></div><section class="panel section-spacer"><div class="panel-head"><h2>보스별 상세 수치</h2><span class="small muted">선택한 월의 보스·단계별 설정</span></div><div class="settings-tabs">${[1,2,3,4,5,6].map(n=>`<button data-stage="${n}" class="${n===s?'active':''}">${n}단계</button>`).join('')}</div><div class="table-scroll"><table class="datatable rule-table"><thead><tr><th>보스</th><th>보스 이름</th><th>최대 HP</th><th>인게임 점수 배율</th><th>내부 기여도 배율</th></tr></thead><tbody>${d.bosses.map(b=>`<tr><td>${b.id}넴</td><td><input data-boss="${b.id}-name" value="${X(b.name)}" style="text-align:left;width:148px"></td><td><input data-boss="${b.id}-hp" type="number" step="1" min="1" value="${b.hp[s]??0}"></td><td><input data-boss="${b.id}-game" type="number" step="any" value="${b.game[s]??1}"></td><td><input data-boss="${b.id}-contribution" type="number" step="any" value="${b.contribution[s]??''}" placeholder="-" ${s===4&&d.options.autoContribution?'disabled':''}></td></tr>`).join('')}</tbody></table></div><div class="note section-spacer">배율은 입력한 소수점 정밀도로 저장합니다. HP나 회차 구간을 바꾸면 선택한 월의 기록을 다시 계산합니다. 다른 월의 설정과 기록에는 적용되지 않습니다.</div></section><section class="panel section-spacer">${extraRuleFields(d)}</section>`+futureBossPreview()}
function saveRules(){
  if(!canEdit()){unlock();return false;}
  const d=current(),candidate=deepcopy(d),o=candidate.options,ruleError=message=>{notice(message);return false;};
  o.days=Math.min(10,Math.max(1,rnumber($('#setting-days')?.value)));o.startStage=Number($('#setting-start')?.value||2);o.dailyAttacks=Math.max(1,rnumber($('#setting-shots')?.value));o.killBonus=0;
  for(const [id,key] of [['setting-battle','battleSeconds'],['setting-carry-bonus','carryBonusSeconds'],['setting-carry-max','carryMaxSeconds'],['setting-samples','contributionSamples']])if($('#'+id))o[key]=Number($('#'+id).value);
  if($('#setting-factor'))o.contributionFactor=Number($('#setting-factor').value)/100;
  if($('#setting-auto'))o.autoContribution=$('#setting-auto').checked;
  o.contributionBaseline=30000000;
  if(!(o.battleSeconds>0)||o.carryBonusSeconds<0||!(o.carryMaxSeconds>0)||!(o.contributionSamples>=1)||!(o.contributionFactor>0)||!(o.contributionBaseline>0))return ruleError('시간·표본 수·기여도 기준을 확인하세요.');
  $$('[data-level]').forEach(el=>{const [stage,kind]=el.dataset.level.split('-');candidate.levels.find(l=>l.stage===+stage)[kind]=el.value===''?null:Number(el.value)});candidate.levels.forEach(l=>l.count=l.start&&l.end?Math.max(0,l.end-l.start+1):0);
  const ranges=candidate.levels.filter(l=>l.count>0).sort((a,b)=>a.start-b.start);
  if(!ranges.length||ranges[0].start!==1||ranges[0].stage!==o.startStage||ranges.some((l,i)=>i&&l.start!==ranges[i-1].end+1))return ruleError('단계 구간은 1회차부터 빈 구간·중복 없이 이어져야 합니다.');
  let invalid=false;$$('[data-boss]').forEach(el=>{const [id,field]=el.dataset.boss.split('-');const b=candidate.bosses.find(b=>b.id===+id);if(field==='name')b.name=el.value.trim()||b.name;else{const value=el.value===''?null:Number(el.value);if((field==='hp'&&(!Number.isSafeInteger(value)||!(value>0)))||(field==='game'&&!(value>=0))||(field==='contribution'&&value!==null&&!(value>=0)))invalid=true;b[field][String(ui.configStage)]=value;}});
  if(invalid)return ruleError('보스 HP는 1 HP 단위의 양의 정수로, 배율은 0 이상으로 입력하세요.');
  try{Engine.replayMonth(candidate)}catch(error){return ruleError(error.message)}app.months[app.active]=candidate;persist();notice('선택한 월의 규칙과 계산 결과를 저장했습니다.');render();return true;
}
function history(){const entries=[...new Set([...Object.keys(app.months),...archiveKeys()])].sort().reverse();return section('월별 아카이브','월마다 보스와 규칙을 따로 보관합니다.',`<button class="btn primary" data-action="newmonth">＋ 다음 달 만들기</button>`)+`<div class="grid-even">${entries.map(key=>{const d=app.months[key];return `<div class="history-month"><div><strong>${monthFormat(key)} 클랜전</strong><small>${d?d.bosses.map(b=>X(b.name)).join(' · '):'과거 기록 별도 보관'}</small><div class="small muted" style="margin-top:8px">${d?'공격 '+d.events.length+'건 · 택틱 '+d.tactics.filter(t=>!t.trashedAt).length+'개':'월별 아카이브에서 조회'}</div></div><button class="btn ${key===app.active?'primary':''}" ${key===app.active?`data-select-month="${key}"`:`data-open-archive="${key}"`}>${key===app.active?'조회 중':'과거 기록 →'}</button></div>`}).join('')}</div><section class="panel section-spacer ${editor?'':'hidden'}"><h2>백업과 복원</h2><p class="muted small">변경 사항은 자동 저장됩니다. JSON 백업에는 모든 월의 공격 기록·택틱·설정이 포함됩니다. 백업을 복원하면 현재 데이터를 해당 내용으로 교체합니다.</p><div class="btnbar"><button class="btn" data-action="export">JSON 백업 저장</button><label class="btn">JSON 백업 복원<input type="file" id="import-json" accept=".json,application/json" style="display:none"></label></div></section>`+futureBossPreview()}
// Past months are loaded only when opened. They are never mixed into the
// editable current-month state or sent with ordinary battle-log saves.
async function loadArchive(key){
  if(!/^\d{4}-\d{2}$/.test(key))return;
  if(ui.archiveMonth!==key){ui.archiveLogPage=1;ui.archiveLogMember='';ui.archiveLogDay='';}
  ui.archiveMonth=key;archiveError='';
  if(archiveVisible())window.history.replaceState(null,'','#archive='+key);
  if(archiveCache.has(key)||app.months[key]){if(archiveVisible())render();return;}
  if(archiveLoading===key)return;
  archiveLoading=key;if(archiveVisible())render();
  try{
    await monthView.load(key);
  }catch(e){archiveError=e.message||'과거 기록 조회 실패';}
  finally{if(archiveLoading===key)archiveLoading='';if(archiveVisible()&&ui.archiveMonth===key)render();}
}
function archiveRecords(){
  const keys=archiveKeys(),key=ui.archiveMonth&&keys.includes(ui.archiveMonth)?ui.archiveMonth:keys[0];
  if(!key)return '<section class="panel empty">지난 클랜전 기록이 아직 없습니다.</section>';
  const d=archiveCache.get(key)||app.months[key];
  const nav=`<section class="panel archive-record-selector"><div class="field"><label for="archive-month-select">조회 월</label><select id="archive-month-select">${keys.map(k=>`<option value="${X(k)}" ${k===key?'selected':''}>${monthFormat(k)}</option>`).join('')}</select></div>${canEdit()?`<button class="btn sm" data-guild="edit-history" data-value="${X(key)}">클랜전 결과 수정</button>`:''}</section>`;
  if(!d)return nav+`<section class="panel empty">${archiveLoading===key?'과거 기록을 불러오는 중입니다…':archiveError?X(archiveError)+' <button class="btn sm" data-open-archive="'+X(key)+'">다시 시도</button>':'월을 선택하면 해당 기록을 불러옵니다.'}</section>`;
  const summary=summarizeArchive(d,app.roster,(app.clanHistory||[]).find(h=>h.month===key)),sorted=sortArchiveRankings(summary.rows,ui.archiveSort);
  const metrics=`<div class="metrics archive-record-metrics">${[['실제 피해량 합계',nf(summary.damage)],['인게임 점수 합계',nf(summary.game)],['클랜 등수',summary.clanRank?nf(summary.clanRank)+'위':'-'],['클랜원 수',nf(summary.memberCount)+'명']].map(([label,value])=>`<div class="metric"><div class="k">${label}</div><div class="v">${value}</div></div>`).join('')}</div>`;
  const columns=[['damage','실제 피해량'],['contribution','기여도'],['game','인게임 점수']];
  const logs=[...(d.events||[])].sort((a,b)=>(a.seq||0)-(b.seq||0));
  const memberNames=[...new Set(logs.map(e=>e.member).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
  const chosenMember=ui.archiveLogMember||'',chosenDay=ui.archiveLogDay||'';
  const filteredLogs=logs.filter(e=>(!chosenMember||e.member===chosenMember)&&(!chosenDay||String(e.day)===chosenDay));
  const pageSize=50,pageCount=Math.max(1,Math.ceil(filteredLogs.length/pageSize)),page=Math.min(pageCount,Math.max(1,Number(ui.archiveLogPage)||1));
  const visibleLogs=filteredLogs.slice((page-1)*pageSize,page*pageSize);
  const logSection=`<section class="panel"><div class="panel-head"><h2>상세 배틀로그 · ${nf(filteredLogs.length)}건</h2>${d.sourceUrl?'<a href="'+X(d.sourceUrl)+'" target="_blank" rel="noopener noreferrer">원본 구글 시트 ↗</a>':''}</div>
    <div class="archive-record-selector" style="display:flex;gap:12px;flex-wrap:wrap;align-items:end">
      <div class="field"><label for="archive-log-member-select">클랜원</label><select id="archive-log-member-select"><option value="">전체</option>${memberNames.map(name=>`<option value="${X(name)}" ${name===chosenMember?'selected':''}>${X(name)}</option>`).join('')}</select></div>
      <div class="field"><label for="archive-log-day-select">일차</label><select id="archive-log-day-select"><option value="">전체</option>${[1,2,3,4,5].map(n=>`<option value="${n}" ${String(n)===chosenDay?'selected':''}>${n}일차</option>`).join('')}</select></div>
      <div class="field"><label for="archive-log-page-select">페이지</label><select id="archive-log-page-select">${Array.from({length:pageCount},(_,i)=>`<option value="${i+1}" ${i+1===page?'selected':''}>${i+1} / ${pageCount}</option>`).join('')}</select></div>
    </div>
    <div class="table-scroll"><table class="datatable"><thead><tr><th>번호</th><th>일차</th><th>단계</th><th>회차</th><th>보스</th><th>클랜원</th><th>입력 피해량</th><th>실제 피해량</th><th>격파 후 HP</th><th>기여도</th><th>구분</th></tr></thead><tbody>${visibleLogs.map(e=>`<tr><td class="h-num">${nf(e.seq)}</td><td>${nf(e.day)}</td><td>${nf(e.stage)}</td><td>${nf(e.lap)}</td><td>${X(d.bosses?.find(b=>b.id===e.boss)?.name||e.boss)}</td><th>${X(e.member||'-')}</th><td class="number">${nf(e.damage)}</td><td class="number">${nf(e.actual)}</td><td class="number">${nf(e.after)}</td><td class="number">${formatContribution(e.sourceContribution??e.contribution??0)}</td><td>${e.carry?'이월':e.kill?'격파':'일반'}</td></tr>`).join('')||'<tr><td colspan="11">기록이 없습니다.</td></tr>'}</tbody></table></div>
    </section>`;
  return nav+metrics+`<section class="panel archive-record-ranking"><div class="panel-head"><h2>${monthFormat(key)} 월별 순위</h2></div><div class="table-scroll"><table class="datatable archive-ranking-table"><thead><tr><th>순위</th><th>클랜원</th>${columns.map(([metric,label])=>`<th><button class="sort-head ${ui.archiveSort===metric?'active':''}" data-archive-sort="${metric}" aria-pressed="${ui.archiveSort===metric}">${label}${ui.archiveSort===metric?' ↓':''}</button></th>`).join('')}</tr></thead><tbody>${sorted.map((p,i)=>`<tr><td class="h-num">${i+1}</td><th>${X(p.name)}</th>${columns.map(([metric])=>`<td class="number ${ui.archiveSort===metric?'sorted':''}">${metric==='contribution'?formatContribution(p[metric]):nf(p[metric])}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="5" class="empty">기록이 없습니다.</td></tr>'}</tbody></table></div></section>`+logSection;
}
async function exportData(){if(!editor)return unlock();let data=app;if(splitStorage){try{const response=await apiFetch('/api/archive?all=1',{cache:'no-store'});if(!response.ok)throw Error();const archives=(await response.json()).months||{};data={...app,months:{...archives,...app.months}};}catch{notice('전체 백업에 필요한 과거 기록을 가져오지 못했습니다. 기록 손실을 막기 위해 백업을 중단했습니다.');return;}}const blob=new Blob([JSON.stringify({version:4,exportedAt:new Date().toISOString(),data},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='nyangnyang-clan-'+app.active+'-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);notice('JSON 백업 파일을 저장했습니다')}
async function importJSON(file){if(!editor){unlock();return;}try{let data=JSON.parse(await file.text());if(!data?.data?.months||!Object.keys(data.data.months).length)throw Error('지원하지 않는 백업 형식');if(!confirm('현재 클랜 데이터를 이 백업 내용으로 교체할까요? 먼저 현재 데이터의 JSON 백업을 권장합니다.'))return;for(const d of Object.values(data.data.months)){if(!Array.isArray(d.bosses)||!Array.isArray(d.events)||!Array.isArray(d.tactics)||!Array.isArray(d.members)||!d.options)throw Error('월별 데이터가 올바르지 않습니다.');Engine.replayMonth(d);}app=data.data;monthView.reset();ensureRoster(app,DEFAULT.rosterSeed||[]);ensureTactics(app,TACTIC_META,ROW_FORMATS);applySourceData(app,GUILD_SOURCE);for(const d of Object.values(app.months))Engine.replayMonth(d);workflow.afterMonthChange();restoreArchivesPending=splitStorage;persist();ui.page='overview';notice('백업 복원 내용을 저장 중입니다. 완료 상태를 확인해 주세요.');render()}catch(e){notice('백업 파일을 읽을 수 없습니다: '+e.message)}}
function newMonth(){if(!canEdit()){unlock();return;}if(!workflow.beforeNavigate())return;const last=Object.keys(app.months).sort().at(-1);const [y,m]=last.split('-').map(Number),next=new Date(y,m,1),key=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`;if(app.months[key]){app.active=key;workflow.afterMonthChange();goto('settings');return}const preview=FUTURE_BOSSES.months?.[key];const ready=preview?.bosses?.length===5&&preview.bosses.every(b=>b.status==='verified');if(!confirm(`${monthFormat(key)} 새 클랜전을 만들까요? 전월 HP·배율·단계 규칙을 복사하고 ${ready?'확인된 미래 보스 이름을 적용합니다.':'보스 이름은 전월 것을 임시 복사합니다.'} 공격 기록과 택틱은 빈 상태로 만듭니다.`))return;const prev=app.months[last],ids=app.roster.filter(p=>p.status==='active').map(p=>p.id);app.months[key]={month:key,bosses:deepcopy(prev.bosses),levels:deepcopy(prev.levels),members:[],memberIds:ids,membership:Object.fromEntries(ids.map(id=>[id,{fromDay:1,toDay:null}])),options:deepcopy(prev.options),events:[],tactics:[],recommendations:[],communityLinks:deepcopy(prev.communityLinks||[]),comboNotices:deepcopy(prev.comboNotices||GUILD_SOURCE.recommendationWarnings||{}),dayBreaks:[],guildDataVersion:1};if(ready)for(const b of preview.bosses){const dest=app.months[key].bosses.find(x=>x.id===b.slot);if(dest)dest.name=b.name;}syncRoster(app);app.active=key;workflow.afterMonthChange();guild.afterMonthChange();ui.member=current().members[0];persist();goto('settings');notice('새 클랜전을 생성했습니다. 보스와 배율을 수정하세요.')}
function copyText(txt){if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(txt).then(()=>notice('복사했습니다')).catch(()=>fallbackCopy(txt));}else fallbackCopy(txt)}
function fallbackCopy(txt){const ta=document.createElement('textarea');ta.value=txt;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.focus();ta.select();let ok=false;try{ok=document.execCommand('copy')}catch(e){}ta.remove();notice(ok?'복사했습니다':'복사 기능이 제한된 브라우저입니다. 직접 선택해 복사해 주세요.')}
const pages={overview,dashboard:()=>guild.dashboard(),battle,'battle-import':()=>imageImporter.view(),roster,tactics,calculator:tactics,members,profile:()=>guild.profile(),db:()=>guild.db(),combos:()=>guild.combos(),settings,history,archive:()=>guild.db()};const labels={overview:'클랜전 상황판',dashboard:'대시보드',battle:'배틀로그','battle-import':'이미지 일괄 등록',roster:'클랜원 관리',tactics:'택틱 작업실',calculator:'택틱 작업실',members:'월간 순위',profile:'개인 이력',db:'클랜 DB',combos:'추천 조합',settings:'규칙 · 월별 설정',history:'월별 아카이브',archive:'과거 기록'};
function render(){document.title=`냥냥클랜 리리다이브 · ${labels[ui.page]}`;$('#top-name').textContent=labels[ui.page];const months=monthView.keys(),selector=$('#month-select');selector.innerHTML=months.map(m=>`<option value="${m}" ${m===(detailMonthLoading||monthView.key())?'selected':''}>${monthFormat(m)}</option>`).join('');selector.disabled=!!detailMonthLoading;$$('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===ui.page));$('#content').innerHTML=(pages[ui.page]||overview)()+`<div class="foot">© 냥냥클랜 리리다이브</div>`;$$('.field').forEach((field,i)=>{const input=field.querySelector('input,select,textarea'),label=field.querySelector('label');if(input&&label&&!label.contains(input)){if(!input.id)input.id='field-'+ui.page+'-'+i;label.htmlFor=input.id;}});workflow.mount(ui.page);tacticWorkspace.mount(ui.page);imageImporter.mount(ui.page);$$('[data-action="export"],[data-editor-only]').forEach(el=>el.classList.toggle('hidden',!editor));const access=$('#editor-control');if(access){access.textContent=editor?'🔒 작성 잠금':'🔓 작성 잠금 해제';access.dataset.admin=editor?'lock':'unlock';}if(!canEdit()&&['settings'].includes(ui.page)){$$('#content input,#content select,#content textarea').forEach(el=>el.disabled=true);}}
function handleAction(a){switch(a.dataset.action){case 'export':exportData();break;case 'newmonth':newMonth();break;case 'saverules':saveRules();break;case 'applyfuture':applyFutureBossNames();break;case 'addbooster':addBoosterCharacter();break;case 'removebooster':removeBoosterCharacter(Number(a.dataset.boosterIndex));break;}}
document.addEventListener('click',e=>{let b=e.target.closest('button,[data-go]');if(!b)return;if(b.dataset.page){goto(b.dataset.page);return}if(b.dataset.bossCenter){tacticWorkspace.openBoss(Number(b.dataset.bossCenter));goto('tactics');return}if(b.dataset.go){goto(b.dataset.go);return}if(b.dataset.action){handleAction(b);return}if(b.dataset.day){ui.day=b.dataset.day;ui.logPage=1;render();return}if(b.dataset.pager){ui.logPage+=Number(b.dataset.pager);render();return}if(b.dataset.lognew!==undefined){ui.editLog='';render();$('#editor-anchor')?.scrollIntoView({behavior:'smooth',block:'start'});return}if(b.dataset.editlog){ui.editLog=b.dataset.editlog;render();$('#editor-anchor')?.scrollIntoView({behavior:'smooth',block:'start'});return}if(b.dataset.logcancel!==undefined){ui.editLog=null;render();return}if(b.dataset.stage){if(ui.page==='settings'){if(canEdit()&&saveRules()===false)return;ui.configStage=Number(b.dataset.stage);render()}return}if(b.dataset.openArchive){ui.archiveMonth=b.dataset.openArchive;goto('archive');return}if(b.dataset.archiveSort){ui.archiveSort=b.dataset.archiveSort;render();return}if(b.dataset.selectMonth){void selectDetailMonth(b.dataset.selectMonth,true);return}});
document.addEventListener('change',e=>{const v=e.target;if(v.id==='archive-month-select'){void loadArchive(v.value);return}if(v.id==='archive-log-member-select'){ui.archiveLogMember=v.value;ui.archiveLogPage=1;render();return}if(v.id==='archive-log-day-select'){ui.archiveLogDay=v.value;ui.archiveLogPage=1;render();return}if(v.id==='archive-log-page-select'){ui.archiveLogPage=Number(v.value)||1;render();return}if(v.id==='setting-auto')$$('[data-boss$="-contribution"]').forEach(el=>{if(ui.configStage===4)el.disabled=v.checked});if(v.id==='month-select'){void selectDetailMonth(v.value);return}if(v.id==='log-boss'){ui.boss=v.value;ui.logPage=1;render()}if(v.id==='rank-metric'){ui.rank=v.value;render()}if(v.id==='profile-member'){ui.member=v.value;render()}if(v.id==='import-json'&&v.files?.[0])importJSON(v.files[0]);});
document.addEventListener('input',e=>{if(e.target.id==='log-search'){ui.filter=e.target.value;ui.logPage=1;let pos=e.target.selectionStart;render();let el=$('#log-search');el?.focus();el?.setSelectionRange(pos,pos)}});
document.addEventListener('submit',e=>{if(e.target.id==='log-form'){e.preventDefault();updateLog(e.target)}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='booster-new-name'){e.preventDefault();addBoosterCharacter();}});
function extraRuleFields(d){
  const o=d.options,boosters=Array.isArray(app.boosterCharacters)?app.boosterCharacters:[],editable=canEdit();
  return `<h3>이월 시간 규칙</h3><div class="settings-grid"><div class="field"><label>기본 전투시간 (초)</label><input id="setting-battle" type="number" min="1" value="${o.battleSeconds||90}"></div><div class="field"><label>이월 보정시간 (초)</label><input id="setting-carry-bonus" type="number" min="0" value="${o.carryBonusSeconds??20}"></div><div class="field"><label>최대 이월시간 (초)</label><input id="setting-carry-max" type="number" min="1" value="${o.carryMaxSeconds||90}"></div></div><div class="divider"></div>
  <details class="booster-settings" id="booster-details"><summary><strong>부스터 캐릭터 일람</strong><span class="pill">총 ${boosters.length}명 · 공통 설정</span></summary>
  <div class="booster-settings-body"><p class="small muted">등록된 캐릭터 이름은 모든 월의 추천 조합과 택틱에서 부스터로 구분됩니다. 명단은 기본적으로 숨겨져 있습니다.</p>
  <ul class="booster-list">${boosters.length?boosters.map((name,index)=>`<li><span>${X(name)}</span>${editable?`<button type="button" class="btn sm" data-action="removebooster" data-booster-index="${index}" aria-label="${X(name)} 부스터 목록에서 삭제">삭제</button>`:''}</li>`).join(''):'<li class="muted">등록된 부스터 캐릭터가 없습니다.</li>'}</ul>
  ${editable?`<div class="booster-add-row"><div class="field"><label for="booster-new-name">부스터 캐릭터 추가</label><input id="booster-new-name" list="booster-character-suggestions" maxlength="60" placeholder="캐릭터 이름 입력" autocomplete="off"></div><button type="button" class="btn primary" data-action="addbooster">추가</button></div><datalist id="booster-character-suggestions">${CHARACTER_CATALOG.map(c=>`<option value="${X(c.name)}"></option>`).join('')}</datalist><p class="small muted">관리자 작성 권한으로 추가·삭제하면 즉시 서버에 저장됩니다. 목록에 없는 신규 캐릭터 이름도 등록할 수 있습니다.</p>`:'<p class="small muted">캐릭터를 추가하거나 삭제하려면 작성 잠금을 해제하세요.</p>'}
  </div></details>`;
}
function updateBoosterView(message){
  const wasOpen=$('#booster-details')?.open;
  render();
  if(wasOpen)$('#booster-details').open=true;
  if(message)notice(message);
}
function addBoosterCharacter(){
  if(!canEdit())return unlock();
  const input=$('#booster-new-name'),raw=input?.value.trim().replace(/\s+/g,' ');
  if(!raw)return notice('추가할 캐릭터 이름을 입력하세요.');
  if(raw.length>60)return notice('캐릭터 이름은 60자 이내로 입력해 주세요.');
  const character=findCharacter(CHARACTER_CATALOG,raw);
  const name=character?.name||raw;
  const list=Array.isArray(app.boosterCharacters)?app.boosterCharacters:[];
  if(list.some(value=>normalizeCharacterName(value)===normalizeCharacterName(name)||
     (character&&findCharacter(CHARACTER_CATALOG,value)?.name===character.name)))return notice('이미 등록된 부스터 캐릭터입니다.');
  app.boosterCharacters=[...list,name];
  persist();
  updateBoosterView(character?'부스터 캐릭터를 추가했습니다.':'부스터 이름을 등록했습니다. 캐릭터 도감에 추가되면 자동으로 연결됩니다.');
  $('#booster-new-name')?.focus();
}
function removeBoosterCharacter(index){
  if(!canEdit())return unlock();
  const list=Array.isArray(app.boosterCharacters)?app.boosterCharacters:[];
  if(!Number.isInteger(index)||index<0||index>=list.length)return;
  if(!confirm(list[index]+'을(를) 부스터 일람에서 삭제할까요?'))return;
  app.boosterCharacters=list.filter((_,i)=>i!==index);
  persist();
  updateBoosterView('부스터 캐릭터를 삭제했습니다.');
}
function openForm(title,fields,onSave){
 document.querySelector('#guild-dialog')?.remove();const dialog=document.createElement('dialog');dialog.id='guild-dialog';dialog.className='guild-dialog';dialog.innerHTML=`<form><div class="panel-head"><h2>${X(title)}</h2><button type="button" class="btn sm" data-close-dialog>×</button></div><div class="dialog-fields">${fields.map(f=>`<div class="field ${f.type==='textarea'?'full':''}"><label for="dialog-${X(f.name)}">${X(f.label)}</label>${f.type==='textarea'?`<textarea id="dialog-${X(f.name)}" name="${X(f.name)}" rows="7" ${f.required?'required':''}>${X(f.value??'')}</textarea>`:`<input id="dialog-${X(f.name)}" name="${X(f.name)}" type="${f.type||'text'}" value="${X(f.value??'')}" ${f.required?'required':''} autocomplete="${f.type==='password'?'off':'on'}" ${f.type==='number'?'step="any"':''}>`}</div>`).join('')}</div><p class="dialog-error" role="alert"></p><div class="form-actions"><button type="button" class="btn" data-close-dialog>취소</button><button type="submit" class="btn primary">저장</button></div></form>`;document.body.append(dialog);dialog.showModal();dialog.querySelectorAll('[data-close-dialog]').forEach(b=>b.onclick=()=>dialog.close());dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const button=dialog.querySelector('[type="submit"]');button.disabled=true;try{const values=Object.fromEntries(new FormData(event.target));await onSave(values);dialog.close();}catch(error){dialog.querySelector('.dialog-error').textContent=error.message;}finally{button.disabled=false;}};dialog.addEventListener('close',()=>dialog.remove());
}
function unlock(){if(monthView.isPast())return notice('과거 월의 상세 기록을 조회하고 있습니다.');openForm('작성 잠금 해제',[{name:'pin',label:'작성 비밀번호',type:'password',required:true}],async values=>{const response=await apiFetch('/api/editor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:values.pin})});const result=await response.json();if(!response.ok)throw Error(result.error);editor=true;persist();render();notice('작성 잠금을 해제했습니다.');});}
async function lockEditor(){if(dirty){await flushSave();if(dirty)return notice('변경 사항 저장 후 잠글 수 있습니다.');}const response=await apiFetch('/api/editor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'lock'})});if(response.ok){editor=false;render();notice('작성 권한을 잠갔습니다.');}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-admin]');if(!b)return;b.closest('.admin-menu')?.removeAttribute('open');if(b.dataset.admin==='unlock')unlock();if(b.dataset.admin==='lock')lockEditor();if(b.dataset.admin==='change-pin'){if(!editor)return unlock();openForm('작성 비밀번호 변경',[{name:'pin',label:'현재 비밀번호',type:'password',required:true},{name:'newPin',label:'새 비밀번호',type:'password',required:true}],async values=>{const response=await apiFetch('/api/editor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'change',...values})});const result=await response.json();if(!response.ok)throw Error(result.error);notice('작성 비밀번호를 변경했습니다.');});}});

document.addEventListener('click',event=>{if(event.target.closest('#sync-state')){if(dirty)flushSave();else notice('모든 변경 사항이 저장되어 있습니다.');}if(event.target.closest('#backup-conflict'))exportData();if(event.target.closest('#retry-connection')){if(blocked){if(confirm('현재 창의 저장되지 않은 변경을 버리고 최신 기록을 불러올까요? 필요하면 먼저 JSON 백업을 저장해 주세요.'))location.reload();}else flushSave();}});
window.addEventListener('beforeunload',event=>{if(dirty||workflow.hasDraft()||tacticWorkspace.hasDraft()){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&dirty)flushSave();});
ui.member=current().members[0];ui.tactic=current().tactics[0]?.id||'';
saveStatus('saved');if(editor&&(!boot.data||rosterMigrated||tacticsMigrated||guildMigrated||comboSynced))persist();

if(ui.page==='archive'){guild.openArchive();ui.page='db';}
render();
if(archiveVisible()){const key=archiveKeys().includes(ui.archiveMonth)?ui.archiveMonth:archiveKeys()[0];if(key)void loadArchive(key);}
// Battle logs and tactic corrections synchronize silently between browsers.
// Prefer a lightweight server-sent revision stream; legacy API deployments fall
// back to short polling. Never replace a local draft or an in-flight save.
let syncInFlight=false,liveConnected=false,remoteRevision=revision;
function liveSafe(){
  if(document.hidden||dirty||saving||blocked||document.querySelector('dialog[open]'))return false;
  if(workflow.hasDraft()||tacticWorkspace.hasDraft())return false;
  if(editor&&ui.page==='settings')return false;
  const focused=document.activeElement;
  return !focused?.isContentEditable&&!['INPUT','SELECT','TEXTAREA'].includes(focused?.tagName);
}
async function refreshShared(){
  if(syncInFlight||!liveSafe())return;
  syncInFlight=true;
  try{
    const response=await apiFetch('/api/state?since='+revision+(splitStorage?'&compact=1':''),{cache:'no-store'});
    if(!response.ok)return;
    const next=await response.json();
    if(!next.data||next.revision<=revision||!liveSafe())return;
    const active=app.active;
    splitStorage=next.splitStorage===true||splitStorage;
    app=next.data;
    ensureRoster(app,DEFAULT.rosterSeed||[]);
    ensureTactics(app,TACTIC_META,ROW_FORMATS);
    applySourceData(app,GUILD_SOURCE);
    for(const record of Object.values(app.months))syncTacticRecommendations(record);
    if(app.months[active])app.active=active;
    for(const month of Object.values(app.months))Engine.replayMonth(month);
    revision=next.revision;
    remoteRevision=revision;
    render();
  }catch{}finally{syncInFlight=false;}
}
function startRealtime(){
  if(typeof EventSource!=='function')return;
  const origin=document.querySelector('meta[name="nyang-api-origin"]')?.content||location.origin;
  const url=new URL('/api/changes',origin);
  url.searchParams.set('since',String(revision));
  const stream=new EventSource(url.href);
  let everConnected=false;
  stream.addEventListener('open',()=>{liveConnected=true;everConnected=true;});
  stream.addEventListener('change',event=>{
    try{
      const currentRevision=Number(JSON.parse(event.data)?.revision);
      if(!Number.isSafeInteger(currentRevision)||currentRevision<=revision)return;
      remoteRevision=Math.max(remoteRevision,currentRevision);
      void refreshShared();
    }catch{}
  });
  stream.addEventListener('error',()=>{
    liveConnected=false;
    // A previously unsupported server cannot stream yet: stop retrying it.
    // When a working connection drops, EventSource reconnects automatically.
    if(!everConnected)stream.close();
  });
  window.addEventListener('beforeunload',()=>stream.close(),{once:true});
}
startRealtime();
setInterval(()=>{
  if(remoteRevision>revision||!liveConnected)void refreshShared();
},2000);
document.addEventListener('focusout',()=>{
  if(remoteRevision>revision)setTimeout(()=>{void refreshShared()},0);
});
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)void refreshShared();
});
})();
