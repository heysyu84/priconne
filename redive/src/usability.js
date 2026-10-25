// Shared controls and compact views used by the production interface.
const adminMode=()=>!!data.settings.editable&&(!syncState.started||syncState.canEdit);
const RESULT_METRICS=[['game','인게임'],['contribution','기여도'],['damage','피해량']];
subpageNames.tactics.external='이월 계산기';
subpageNames.records.history='명예의 전당';
subpageNames.records.hall='수상 횟수';
copyRegistry.add('이월 계산기');copyRegistry.add('수상 횟수');

function ensureCharacterReference(){
  data.characters??=[];
  data.history??=structuredClone(HISTORY_REFERENCE);data.awards??=structuredClone(AWARD_REFERENCE);
  for(const reference of CHARACTER_REFERENCE){
    const existing=data.characters.find(c=>c.name===reference.name||(c.aliases||[]).includes(reference.name)||reference.aliases.includes(c.name));
    if(existing){
      existing.aliases=[...new Set([...(existing.aliases||[]),...reference.aliases])].filter(name=>name!==existing.name);
      existing.unitId=reference.unitId;existing.position=reference.position;existing.place=reference.place;
      existing.defaultStar=reference.defaultStar;
    }else data.characters.push({...structuredClone(reference),booster:false});
  }
  for(const season of [data,...Object.values(data.seasons||{})])for(const tactic of season.tactics||[]){
    if(tactic.category!=='carry'||isVideoUrl(tactic.video))continue;
    const reference=CARRY_VIDEO_REFERENCE.find(r=>r.id===tactic.id||r.party.join('|')===tactic.party.join('|'));
    if(reference)tactic.video=reference.video;
  }
}
const scopedReferences=applyGameScope;
applyGameScope=()=>{scopedReferences();ensureCharacterReference();};
function characterReference(name){return data.characters.find(c=>c.name===name)||CHARACTER_REFERENCE.find(c=>c.name===name||(c.aliases||[]).includes(name));}
function defaultCharacterStars(names){return names.map(name=>characterReference(name)?.defaultStar||5);}
portraitHtml=(name,star)=>{
  const c=data.characters.find(c=>c.name===name),base=GAME_ASSETS.characters[name],reference=CHARACTER_REFERENCE.find(r=>r.name===name||r.aliases.includes(name)||c?.aliases?.includes(r.name));
  const url=c?.images?.[6]||base?.[6]||reference?.images?.[6]||c?.images?.[star]||c?.images?.default||base?.[star]||base?.default||reference?.images?.[star]||reference?.images?.default;
  return url?`<img src="${X(url)}" alt="${X(name)}" width="128" height="128" loading="lazy">`:`<span aria-hidden="true">${X(name.slice(0,1))}</span>`;
};
matchName=(member,query)=>partyTools.matchesMember(member,query,chosung);

fullTactics=()=>{
  if(ui.tabs.tactics==='tools')ui.tabs.tactics='external';
  if(['converter','trash'].includes(ui.tabs.tactics)&&!adminMode())ui.tabs.tactics='workspace';
  if(ui.tabs.tactics==='planner'){ui.tabs.tactics='combos';ext.distributionOpen=true;findPlans();}
  const work=ui.tabs.tactics==='workspace';
  const tabs=[['combos','추천 조합'],['workspace','택틱 작업실'],['external','이월 계산기'],...(adminMode()?[['converter','택틱 변환기']]:[])];
  return titleBar('택틱',work&&adminMode()?simpleButton('삭제함','v2-tactic-trash')+simpleButton('택틱 추가','new-tactic','','primary'):'')+pageTabs(tabs)+({combos:recommendationRows,workspace:completeWorkspace,external:completeExternal,converter:completeConverter,trash:completeTrash}[ui.tabs.tactics]||recommendationRows)();
};
fullClan=()=>{
  if(ui.tabs.clan==='characters'&&!adminMode())ui.tabs.clan='members';
  return titleBar(ui.tabs.clan==='settings'?'설정':'클랜 DB')+pageTabs([['members','클랜원'],['alumni','역대 클랜원'],['rates','기여도'],['future','미래 보스'],...(adminMode()?[['characters','캐릭터·초상화']]:[]),['settings','설정']])+({members:()=>completeRoster(false),alumni:()=>completeRoster(true),rates:completeRates,future:futureBossSettings,characters:characterLibrary,settings:completeSettings}[ui.tabs.clan]||(()=>completeRoster(false)))();
};
fullRecords=()=>titleBar('기록·통계',ui.tabs.records==='profile'?'':simpleButton('인쇄','print'))+pageTabs([['ranking','월간 순위'],['profile','개인 이력'],['archive','과거 기록'],['history','명예의 전당'],['hall','수상 횟수']])+({ranking:completeRanking,profile:completeProfile,archive:completeArchive,history:completeHistory,hall:completeHall}[ui.tabs.records]||completeRanking)();

function isVideoUrl(value){try{const url=new URL(value);return /^https?:$/.test(url.protocol)&&/(^|\.)(youtube\.com|youtu\.be|nicovideo\.jp|bilibili\.com|vimeo\.com)$/.test(url.hostname);}catch{return false;}}
function videoButton(t,small=false){
  const label=small?'영상':'원본 영상',cls=`button video-link${small?' work-list-video':''}`;
  if(!/^https?:\/\//i.test(t.video||''))return small?`<span class="${cls} missing" aria-label="등록된 영상 없음">${label}</span>`:'';
  return `<a class="${cls}" href="${X(t.video)}" style="${t.boss?bossStyle(t.boss):'--boss:#7186a1'}" target="_blank" rel="noopener noreferrer" aria-label="${X(t.boss+'넴 '+t.party.join(' ')+' 원본 영상')}"><svg class="video-play" viewBox="0 0 24 18" aria-hidden="true"><rect x="1" y="1" width="22" height="16" rx="5"/><path d="m10 5 7 4-7 4Z"/></svg><span>${label}</span></a>`;
}
workspaceListItem=(item,selectedId)=>{
  const carry=item.category==='carry',seconds=carry?minimumCarry(item):null;
  const label=`${item.boss?item.boss+'넴':'미분류'} ${item.party.join(' ')}, 성급 ${item.stars.join('')}, 손컨 ${tacticHands(item)}, TP ${item.tp||'—'}, 기대딜 ${tacticDamageLabel(item)}`;
  return `<div class="work-list-row ${carry?'is-carry':''}" style="${item.boss?bossStyle(item.boss):'--boss:#aeb5c1'}">${carry?`<div class="work-list-carry">${seconds===null?'이월시간 미입력':seconds+'초 이월'}</div>`:''}<button type="button" class="work-item work-list-fields ${item.id===selectedId?'active':''}" data-action="v2-select-tactic" data-id="${item.id}" aria-label="${X(label)}"><span class="work-list-boss">${item.boss?item.boss+'넴':'미분류'}</span><strong class="work-list-party">${X(item.party.join(' '))}</strong><span class="work-list-stars">${tacticStarString(item)}</span><small class="work-list-hands ${item.hands?'danger':''}"><span class="work-field-label">손컨 </span>${tacticHands(item)}</small><small class="work-list-tp ${item.tp.includes('+')?'danger':''}"><span class="work-field-label">TP </span>${X(item.tp||'—')}</small><span class="work-list-damage"><span class="work-field-label">기대딜 </span>${tacticDamageLabel(item)}</span></button>${videoButton(item,true)}</div>`;
};
tacticReadingHeader=t=>{
  const carry=t.category==='carry',note=displayTacticNote(t),needed=carry?minimumCarry(t):null,warning=carry&&needed!==null&&ui.carry<needed;
  const memo=note?`<div class="tactic-note tactic-reading-note">${X(note).replace(/\n/g,'<br>')}</div>`:'';
  const received=carry?`<section class="carry-summary"><div><span>필요 이월</span><strong>${needed===null?'—':needed+'초'}</strong></div><div class="field"><label for="carry-main-received">받은 이월 · 초</label><input id="carry-main-received" type="number" min="1" max="90" inputmode="numeric" data-input="ops-carry-received" value="${ui.carry}"></div><p class="carry-warning danger" ${warning?'':'hidden'}>필요 이월보다 짧습니다.</p></section>`:'';
  const links=(t.links||[]).filter(link=>/^https?:\/\//i.test(link.url||''));
  const sources=links.length?`<div class="tactic-intro-links">${links.map(link=>`<a class="button source-link" href="${X(link.url)}" target="_blank" rel="noopener noreferrer">${X(link.label)}</a>`).join('')}</div>`:'';
  return `<div class="work-editor-head tactic-reading-head ${carry?'is-carry':''}">${carry?`<div class="tactic-intro-top">${received}${memo}</div>`:memo}<div class="tactic-summary-row"><div class="tactic-identity"><h2>${t.boss?t.boss+'넴 · '+X(bossBy(t.boss).name):'미분류'}</h2><div class="tactic-metadata"><span class="${t.hands?'danger':''}">손컨 <b>${tacticHands(t)}</b></span> · <span class="${t.tp.includes('+')?'danger':''}">TP <b>${X(t.tp||'—')}</b></span> · <span class="tactic-damage-meta">기대딜 <strong>${tacticDamageLabel(t)}</strong>${videoButton(t)}</span></div>${sources}</div><div class="tactic-header-party">${party(t)}</div></div>${adminMode()?`<div class="work-actions">${simpleButton('편성 수정','edit-tactic',t.id)}${simpleButton(t.hidden?'다시 표시':'숨기기','hide-tactic',t.id)}${simpleButton('복제','duplicate-tactic',t.id)}${simpleButton('삭제','delete-tactic',t.id,'danger')}</div>`:''}</div>`;
};
comboDetailBody=t=>`<div class="combo-detail-controls"><label>이월 받은 시간 <input aria-label="이월 받은 시간" data-input="ops-combo-carry" data-id="${t.id}" value="${fmtTime(ui.carry)}" inputmode="numeric"></label>${simpleButton('본문 복사','copy-tactic',t.id)}${t.recommendationOnly?'':simpleButton('작업실에서 열기','v2-open-workspace',t.id)}${videoButton(t)}</div>${displayTacticNote(t)?`<p class="tactic-note">${X(displayTacticNote(t)).replace(/\n/g,'<br>')}</p>`:''}${renderTacticGrid(t,false)}`;

function calculatorPopover(){
  const b=bossBy(activeTactic()?.boss||ui.boss||1);
  const fields=[['hp','보스 남은 HP',b.hp],['first','선통 피해량',0],['second','후통 예상 피해량',300000000],['seconds','후통 전투시간 · 초',90]];
  return `<details class="calculator-popover"><summary class="button calculator-launch">${icon('clock')}이월 계산</summary><div class="calculator-box" role="group" aria-label="이월 시간 계산"><div class="calculator-heading"><strong>선통·후통 이월</strong><button class="icon-button" type="button" data-action="u-close-calculator" aria-label="계산 닫기">${icon('close')}</button></div><div class="estimate-fields">${fields.map(([key,label,value])=>`<div class="field"><label for="estimate-${key}">${label}</label><input id="estimate-${key}" data-input="v2-estimate" value="${nf(ext.estimatorInputs?.['estimate-'+key]??value)}" inputmode="numeric"></div>`).join('')}</div><div class="estimate-result"><span>예상 이월</span><strong id="estimate-result" class="mono">—</strong><button class="button primary" type="button" data-action="u-apply-estimate">적용</button><span id="estimate-error" role="status"></span></div><div class="calculator-remaining"><label for="carry-remaining">격파 순간 남은 시간</label><input id="carry-remaining" data-input="v2-remaining-calculator" value="0:36" inputmode="numeric"><strong id="carry-result">0:56</strong><button type="button" class="button" data-action="u-apply-remaining">적용</button></div></div></details>`;
}
completeExternal=()=>`<div class="external-controls"><div class="field"><label for="external-base">원본 전투시간</label><input id="external-base" data-input="v2-external" value="${fmtTime(ext.externalBase||90)}" inputmode="numeric"></div><div class="field"><label for="external-carry">이월 받은 시간</label><input id="external-carry" data-input="v2-external" value="${fmtTime(ext.externalSeconds||90)}" inputmode="numeric"></div>${calculatorPopover()}${simpleButton('초기화','v2-external-reset')}${simpleButton('복사','copy-external')}</div><div class="external-columns"><div class="field"><label for="external-text">원문</label><textarea id="external-text" data-input="v2-external" rows="18" spellcheck="false">${X(ext.externalText||'')}</textarea></div><div class="field"><label>이월 적용</label><pre id="external-output" class="code-output"></pre></div></div>`;

textScale=()=>{
  if(![90,95,100,105,110].includes(ext.textScaleV2)){
    try{const saved=Number(localStorage.getItem('nyang-text-scale-v2'));ext.textScaleV2=[90,95,100,105,110].includes(saved)?saved:100;}catch{ext.textScaleV2=100;}
  }return ext.textScaleV2;
};
setTextScale=value=>{const scale=Number(value);if(![90,95,100,105,110].includes(scale))return;ext.textScaleV2=scale;try{localStorage.setItem('nyang-text-scale-v2',String(scale));}catch{}applyAppearance();};
const previousTextAppearance=applyAppearance;
applyAppearance=()=>{previousTextAppearance();document.documentElement.style.setProperty('--text-scale',String(1.1*textScale()/100));};
settingsDisplay=()=>`<section class="settings-sheet"><div class="setting-row"><h3>화면 테마</h3><div>${['light','dark'].map(theme=>`<button class="button ${data.settings.theme===theme?'selected':''}" data-action="set-theme" data-value="${theme}">${theme==='light'?'라이트':'다크'}</button>`).join('')}</div></div><div class="setting-row"><h3>글자 크기</h3><select class="select-field" data-input="ops-text-scale" aria-label="화면 글자 크기">${[90,95,100,105,110].map(value=>`<option value="${value}" ${value===textScale()?'selected':''}>${value}%${value===100?' · 기본':''}</option>`).join('')}</select></div><label class="setting-row"><h3>행 간격 줄이기</h3><input type="checkbox" data-setting="compact" ${data.settings.compact?'checked':''}></label><div class="setting-row"><h3>기본 조회 일차</h3><select data-input="v2-default-day" class="select-field">${Array.from({length:data.rules.days},(_,i)=>`<option value="${i+1}" ${data.settings.defaultDay===i+1?'selected':''}>${i+1}일차</option>`).join('')}</select></div></section>`;

completeRoster=(alumni=false)=>{
  const rows=data.members.filter(m=>(alumni||m.status==='active')&&matchName(m,ext.rosterQuery)).sort((a,b)=>Number(b.status==='active')-Number(a.status==='active')||a.name.localeCompare(b.name,'ko'));
  return `<div class="toolbar"><div class="toolbar-left"><input class="search-input" id="roster-search" data-input="v2-roster-query" aria-label="클랜원 검색" placeholder="이름 · 초성 · UID" value="${X(ext.rosterQuery)}"><span>${rows.length}명</span></div>${simpleButton('추가','add-member')}</div>`+rowTable(['클랜원','UID',...(alumni?[]:['가입']),'소속 기간'],rows.map(m=>`<tr class="${m.status==='active'?'roster-active':'graduated'}"><td>${adminMode()?`<button class="text-button member-link" data-action="edit-member" data-id="${m.id}" title="클랜원 수정">${X(m.name)}</button>`:memberLink(m)}</td><td class="numeric uid-cell">${X(m.uid||'미기재')}</td>${alumni?'':`<td class="nowrap">${X(m.joined?.slice(0,7)||'미기재')}</td>`}<td class="tenure-cell"><strong>${memberTenure(m)===null?'미기재':memberTenure(m)+'개월'}</strong>${alumni?`<small>${X(membershipPeriod(m))}</small>`:''}</td></tr>`),`roster-complete dense-table ${alumni?'alumni-compact':'members-compact'}`);
};
completeRates=()=>{
  const levels=seasonLevels(data.rules).filter(l=>l.count),tops=data.bossSettings.map(b=>topStats(b.id));
  const factors=levels.map(l=>`<tr><th>${l.stage}단계<small>${l.start}${l.count>=9999?'–':'–'+l.end}</small></th>${data.bossSettings.map(b=>`<td class="right numeric">${Number.isFinite(b.contribution[l.stage])?Number(b.contribution[l.stage]).toLocaleString('ko-KR',{maximumFractionDigits:2}):'—'}</td>`).join('')}</tr>`);
  const tenThousands=value=>Math.round(Number(value)/10000).toLocaleString('ko-KR');
  const topRows=Array.from({length:data.rules.samples},(_,i)=>`<tr><th>${i+1}위</th>${tops.map(t=>`<td class="right numeric">${t.samples[i]?tenThousands(t.samples[i].damage):'—'}</td>`).join('')}</tr>`);
  for(const key of ['mean','corrected'])topRows.push(`<tr class="average-row"><th>${key==='mean'?'평균':'보정 평균'}</th>${tops.map(t=>`<td class="right numeric">${t[key]?tenThousands(Math.round(t[key])):'—'}</td>`).join('')}</tr>`);
  return boardSection('단계별 보스 기여도 배율',rowTable(['단계',...data.bossSettings.map(b=>b.id+'넴')],factors,'coefficient-table exact-table compact-rate-table'),simpleButton('보정률 '+Math.round(data.rules.factor*100)+'%','v2-factor'))+boardSection('4단계 상위 기록',`<div class="table-tools single-line"><span>상위 ${data.rules.samples}건 · 단위: 만</span><span>기준 기여도 ${nf(data.rules.baseline)}</span></div>`+rowTable(['순위',...data.bossSettings.map(b=>b.id+'넴')],topRows,'top-damage-table exact-table compact-rate-table'));
};
const archiveWithDetails=completeArchive;
completeArchive=()=>{
  const html=archiveWithDetails();
  if(ext.archiveView!=='summary')return html;
  return html.replace(/<th[^>]*data-label="열기"[^>]*>열기<\/th>/g,'').replace(/<td[^>]*data-label="열기"[^>]*>[\s\S]*?<\/td>/g,'');
};

function historyMonths(){return [...new Set([...(data.history||[]).map(h=>h.month),...Object.keys(data.seasons)])].sort().reverse();}
function historySeason(month){return month===ui.month?data:data.seasons[month];}
function historyResult(month){
  const stored=(data.history||[]).find(h=>h.month===month),season=historySeason(month);
  if(!season)return {month,rank:stored?.clanRank,count:stored?.memberCount||0,winners:Object.fromEntries(RESULT_METRICS.map(([metric])=>[metric,(stored?.winners?.[metric]||[]).map(name=>({name}))])),sealed:true,stored};
  const summary=seasonSummary(month);return {month,rank:season.result.rank??stored?.clanRank,count:summary.count,winners:season.result.winners||summary.winners,sealed:!!season.result.sealed,changed:season.result.sealed&&season.result.fingerprint!==resultFingerprint(season.logs),stored};
}
completeHistory=()=>rowTable(['월','클랜 순위','참가','인게임 1·2위','기여도 1·2위','피해량 1·2위','결과'],historyMonths().map(month=>{
  const result=historyResult(month),season=historySeason(month);
  return `<tr><td>${month.replace('-','.')}</td><td>${adminMode()?`<button class="text-button" data-action="u-history-rank" data-id="${month}">${result.rank?result.rank+'위':'입력'}</button>`:result.rank?result.rank+'위':'—'}</td><td class="center">${result.count||'—'}</td>${RESULT_METRICS.map(([metric])=>`<td class="winner-cell">${winnerText(result.winners,metric)}</td>`).join('')}<td>${season&&adminMode()?simpleButton(result.changed?'다시 확정':result.sealed?'확정됨':'결과 확정','u-confirm-result',month,result.sealed?'quiet':'primary'):`<span class="result-status ${result.sealed?'sealed':''}">${result.sealed?'확정':'미확정'}</span>`}</td></tr>`;
}),'history-table exact-table');
function awardRows(){
  const map=new Map((data.awards||[]).map(p=>[p.name,{...structuredClone(p),id:data.members.find(m=>m.name===p.name)?.id||p.name}]));
  for(const month of Object.keys(data.seasons)){
    if((data.history||[]).some(h=>h.month===month))continue;
    const result=historySeason(month).result;if(!result.sealed||!result.winners)continue;
    for(const [metric]of RESULT_METRICS)for(const [index,person]of(result.winners[metric]||[]).entries()){
      if(!map.has(person.name))map.set(person.name,{id:person.id,name:person.name,game:[0,0],contribution:[0,0],damage:[0,0],total:0});
      const row=map.get(person.name);row[metric][index]++;row.total++;
    }
  }
  return [...map.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'ko'));
}
completeHall=()=>`<div class="table-tools"><span>확정한 월별 결과 기준</span></div>`+rowTable(['클랜원','인게임 1위 / 2위','기여도 1위 / 2위','피해량 1위 / 2위','총 수상'],awardRows().map(p=>`<tr><td><button class="text-button" data-action="u-award-history" data-name="${X(p.name)}">${X(p.name)}</button></td>${RESULT_METRICS.map(([metric])=>`<td class="center numeric">${p[metric]?.[0]||0} / ${p[metric]?.[1]||0}</td>`).join('')}<td class="center numeric"><strong>${p.total}</strong></td></tr>`),'hall-table award-count-table exact-table');

function sealResult(month){
  if(!ensureEdit())return false;const season=historySeason(month);if(!season)return false;
  checkpoint();const winners=winnersFrom(season.logs),old=(data.history||[]).find(h=>h.month===month);
  season.result={...season.result,sealed:true,confirmedAt:Date.now(),winners,fingerprint:resultFingerprint(season.logs)};
  const result={...old,month,clanRank:season.result.rank,memberCount:seasonSummary(month).count,winners:Object.fromEntries(RESULT_METRICS.map(([metric])=>[metric,winners[metric].map(p=>p.name)]))};
  data.awards??=[];
  for(const [metric]of RESULT_METRICS)for(let place=0;place<2;place++){
    const before=old?.winners?.[metric]?.[place],after=result.winners[metric][place];if(before===after)continue;
    if(before){const row=data.awards.find(p=>p.name===before);if(row){row[metric][place]=Math.max(0,row[metric][place]-1);row.total=Math.max(0,row.total-1);}}
    if(after){let row=data.awards.find(p=>p.name===after);if(!row){row={name:after,game:[0,0],contribution:[0,0],damage:[0,0],total:0};data.awards.push(row);}row[metric][place]++;row.total++;}
  }
  data.history??=[];if(old)Object.assign(old,result);else data.history.push(result);
  persist();closeDrawer();render();toast('월별 결과 확정',true);return true;
}

function lineupInput(kind){
  const value=kind==='converter'?ext.converterLineupText||'':'';
  return `<section class="lineup-text-entry" data-lineup-kind="${kind}"><label for="${kind}-lineup-text">캐릭터명 한 번에 입력</label><input id="${kind}-lineup-text" class="lineup-name-input" data-input="u-lineup-text" data-kind="${kind}" value="${X(value)}" placeholder="수사렌 수리코 수미미 수페코 사루카" autocomplete="off" spellcheck="false"><div class="lineup-text-feedback" role="status"></div><div class="lineup-order-feedback" role="status"></div><div class="lineup-preview"></div></section>`;
}
function lineupNames(kind){return Array.from({length:5},(_,i)=>document.getElementById((kind==='converter'?'convert-name-':'party-')+i)?.value||'');}
function setLineupNames(kind,names,stars=null){
  for(let i=0;i<5;i++){
    const select=document.getElementById((kind==='converter'?'convert-name-':'party-')+i);if(select)select.value=names[i]||'';
    if(kind==='tactic'){
      const star=select?.form?.querySelector(`[name="star-${i}"]`);if(star)star.value=String(stars?.[i]||defaultCharacterStars([names[i]])[0]);
    }
  }
  if(kind==='converter'){ext.converterNames=[...names];for(let i=0;i<5;i++){const alias=document.getElementById('convert-alias-'+i);if(alias&&!alias.value)alias.value=characterReference(names[i])?.aliases?.find(value=>/[ぁ-ヿ一-龯]/.test(value))||'';}refreshConverter();}
  updateLineupPreview(kind);
}
function updateLineupPreview(kind){
  const section=document.querySelector(`[data-lineup-kind="${kind}"]`);if(!section)return;
  const names=lineupNames(kind),actual=names.filter(Boolean),order=partyTools.lineupOrder(actual,data.characters);
  const warning=section.querySelector('.lineup-order-feedback');
  warning.innerHTML=order.inversions.length?`<span class="lineup-order-warning">위치 확인: ${X(order.inversions[0][0])} · ${X(order.inversions[0][1])}</span><button type="button" class="button quiet" data-action="u-sort-lineup" data-kind="${kind}">위치순 정렬</button>`:order.unknown.length?`<span class="field-help">위치 정보 미확인: ${X(order.unknown.join(', '))}</span>`:actual.length?'<span class="lineup-order-ok">위치순 확인</span>':'';
  section.querySelector('.lineup-preview').innerHTML=actual.length?party({party:actual,stars:kind==='converter'?defaultCharacterStars(actual):names.map((name,i)=>Number(document.querySelector(`[name="star-${i}"]`)?.value)||5).filter((n,i)=>names[i]),support:-1}):'';
  for(let i=0;i<5;i++){
    const select=document.getElementById((kind==='converter'?'convert-name-':'party-')+i);if(!select)continue;
    let face=select.parentElement.querySelector('.lineup-slot-face');if(!face){face=document.createElement('span');face.className='lineup-slot-face';select.before(face);}face.innerHTML=names[i]?portraitHtml(names[i]):'';
  }
}
function applyLineupText(input){
  const kind=input.dataset.kind,section=input.closest('.lineup-text-entry'),parsed=partyTools.parseLineup(input.value,data.characters);
  if(kind==='converter')ext.converterLineupText=input.value;
  const messages=[];if(parsed.unknown.length)messages.push('찾지 못함: '+parsed.unknown.join(', '));if(parsed.ambiguous.length)messages.push('이름 확인: '+parsed.ambiguous.map(p=>p.token).join(', '));if(parsed.duplicates.length)messages.push('중복: '+parsed.duplicates.join(', '));
  if(parsed.names.length>5)messages.push('캐릭터는 5명까지 입력하세요.');
  section.querySelector('.lineup-text-feedback').textContent=messages.join(' · ')||(!input.value.trim()?'':parsed.valid?'편성에 적용됨':`${parsed.names.length}/5명`);
  section.querySelector('.lineup-text-feedback').classList.toggle('danger',!!messages.length);
  if(parsed.valid)setLineupNames(kind,parsed.names);
}
const tacticFormWithoutNames=editCompleteTactic;
editCompleteTactic=id=>{
  tacticFormWithoutNames(id);const form=drawer.querySelector('form[data-form="v2-tactic"]');if(!form)return;
  form.querySelector('.tactic-lineup-form')?.insertAdjacentHTML('beforebegin',lineupInput('tactic'));
  if(!id)for(let i=0;i<5;i++){const select=form.querySelector(`[name="party-${i}"]`);select?.insertAdjacentHTML('afterbegin','<option value="">선택</option>');if(select)select.value='';}
  updateLineupPreview('tactic');
};
const converterWithoutNames=completeConverter;
completeConverter=()=>lineupInput('converter')+converterWithoutNames();
const tacticSaveWithoutValidation=saveCompleteTactic;
saveCompleteTactic=form=>{
  const fd=new FormData(form),names=Array.from({length:5},(_,i)=>String(fd.get('party-'+i)||''));
  if(names.some(name=>!data.characters.some(c=>c.name===name))||new Set(names).size!==5){toast('서로 다른 캐릭터 5명을 선택하세요.');return false;}
  return tacticSaveWithoutValidation(form);
};

const operationalRenderComplete=afterOperationalRender;
afterOperationalRender=()=>{operationalRenderComplete();if(ui.section==='tactics'&&ui.tabs.tactics==='converter')updateLineupPreview('converter');};
for(const action of ['u-confirm-result','u-seal-result','u-history-rank','u-insert-log','u-move-log'])writerActions.add(action);
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  const action=button.dataset.action;if(!action.startsWith('u-')||action==='u-move-log')return;
  event.preventDefault();event.stopImmediatePropagation();
  if(action==='u-close-calculator'){button.closest('details').open=false;return;}
  if(action==='u-apply-estimate'||action==='u-apply-remaining'){
    const result=action==='u-apply-estimate'?estimateResult():{seconds:Math.min(90,timeToSec(document.getElementById('carry-remaining').value)+20)};
    if(result.error||!(result.seconds>0&&result.seconds<=90)){toast(result.error||'시간을 확인하세요.');return;}
    ext.externalSeconds=result.seconds;const field=document.getElementById('external-carry');if(field){field.value=fmtTime(result.seconds);updateExternal();}button.closest('details').open=false;return;
  }
  if(action==='u-sort-lineup'){
    const kind=button.dataset.kind,names=lineupNames(kind),order=partyTools.lineupOrder(names.filter(Boolean),data.characters);
    if(order.unknown.length){toast('위치를 확인할 수 없는 캐릭터가 있습니다.');return;}
    const stars=kind==='tactic'?names.map((name,i)=>Number(document.querySelector(`[name="star-${i}"]`)?.value)||5):null;
    setLineupNames(kind,order.sorted,stars?order.sorted.map(name=>stars[names.indexOf(name)]):null);return;
  }
  if(action==='u-confirm-result'){
    if(!ensureEdit())return;const month=button.dataset.id,season=historySeason(month);if(!season)return;
    openDrawer(month.replace('-','.')+' 결과 확정',rowTable(['항목','1위·2위'],RESULT_METRICS.map(([metric,label])=>`<tr><th>${label}</th><td class="winner-cell">${winnerText(winnersFrom(season.logs),metric)}</td></tr>`),'result-preview'),simpleButton('취소','close-drawer')+simpleButton('확정','u-seal-result',month,'primary'));return;
  }
  if(action==='u-seal-result'){sealResult(button.dataset.id);return;}
  if(action==='u-history-rank'){
    if(!ensureEdit())return;const month=button.dataset.id,result=historyResult(month);
    openDrawer(month.replace('-','.')+' 클랜 순위',`<input name="month" type="hidden" value="${month}"><div class="field"><label for="history-clan-rank">클랜 순위</label><input id="history-clan-rank" name="rank" type="number" min="1" required value="${result.rank||''}"></div>`,'<button class="button primary" type="submit">저장</button>','',false,'u-history-rank');return;
  }
  if(action==='u-award-history'){
    const name=button.dataset.name,rows=[];
    for(const month of historyMonths()){const result=historyResult(month);if(!result.sealed)continue;for(const [metric,label]of RESULT_METRICS)for(const [i,p]of(result.winners[metric]||[]).entries())if(p.name===name)rows.push(`<tr><td>${month.replace('-','.')}</td><td>${label}</td><td>${i+1}위</td></tr>`);}
    openDrawer(name+' 수상 기록',rowTable(['월','항목','순위'],rows),simpleButton('닫기','close-drawer'));return;
  }
  if(action==='u-insert-log')openInsertedLog(button.dataset.id,button.dataset.side);
},true);
document.addEventListener('submit',event=>{
  const form=event.target;if(form.dataset.form!=='u-history-rank')return;event.preventDefault();event.stopImmediatePropagation();if(!ensureEdit())return;
  const fd=new FormData(form),month=String(fd.get('month')),rank=Number(fd.get('rank'));if(!Number.isSafeInteger(rank)||rank<1){toast('순위를 확인하세요.');return;}
  checkpoint();const season=historySeason(month);if(season)season.result.rank=rank;
  data.history??=[];let row=data.history.find(h=>h.month===month);if(!row){row={month,winners:{game:[],contribution:[],damage:[]}};data.history.push(row);}row.clanRank=rank;persist();closeDrawer();render();toast('클랜 순위 저장',true);
},true);
document.addEventListener('input',event=>{if(event.target.dataset.input==='u-lineup-text'&&!event.isComposing)applyLineupText(event.target);});
document.addEventListener('compositionend',event=>{if(event.target.dataset.input==='u-lineup-text')applyLineupText(event.target);});
document.addEventListener('change',event=>{if(event.target.id?.startsWith('party-')||event.target.name?.startsWith('star-'))updateLineupPreview('tactic');if(event.target.id?.startsWith('convert-name-'))updateLineupPreview('converter');});
document.addEventListener('toggle',event=>{if(event.target.matches?.('.calculator-popover')&&event.target.open)updateEstimator();},true);
document.addEventListener('click',event=>{for(const popover of document.querySelectorAll?.('.calculator-popover[open]')||[])if(!popover.contains(event.target))popover.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape')for(const popover of document.querySelectorAll?.('.calculator-popover[open]')||[])popover.open=false;});
