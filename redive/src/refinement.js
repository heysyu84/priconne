const listPages={dashboard:1,roster:1,ranking:1};
function applyGameScope(){
  for(const season of [data,...Object.values(data.seasons||{})]){
    season.rules.startStage=Math.min(4,Number(season.rules.startStage)||2);
    season.rules.levels=[1,2,3,4].map(stage=>({stage,count:stage===4?9999:Number(season.rules.levels.find(l=>l.stage===stage)?.count)||0}));
    for(const t of season.tactics)t.stage=4;
  }
  if(ui.section==='tactics'&&ui.tabs.tactics==='planner'){ui.tabs.tactics='combos';ext.distributionOpen=true;}
}
function pagedList(rows,key,size=10,unit='명'){
  const pages=Math.max(1,Math.ceil(rows.length/size));listPages[key]=Math.max(1,Math.min(pages,listPages[key]||1));
  const page=listPages[key];return {rows:rows.slice((page-1)*size,page*size),start:(page-1)*size,footer:pages===1?'':`<div class="list-pager"><span>${rows.length}${unit}</span><div><button data-action="v3-list-page" data-group="${key}" data-value="${page-1}" ${page===1?'disabled':''}>이전</button><span>${page} / ${pages}</span><button data-action="v3-list-page" data-group="${key}" data-value="${page+1}" ${page===pages?'disabled':''}>다음</button></div></div>`};
}
function openMemberInfo(id){
  const m=currentMember(id),p=data.memberships[id];
  openDrawer(m.name,`<dl class="member-info"><div><dt>UID</dt><dd>${X(m.uid||'—')}</dd></div><div><dt>가입</dt><dd>${X(m.joined?.slice(0,7)||'—')}</dd></div><div><dt>소속</dt><dd>${X(membershipPeriod(m))}</dd></div><div><dt>참가 일차</dt><dd>${p?p.from+'–'+p.to+'일차':'—'}</dd></div>${m.note?`<div><dt>메모</dt><dd>${X(m.note)}</dd></div>`:''}</dl>`,simpleButton(m.status==='active'?'탈퇴':'복귀','v2-member-status',id)+simpleButton('수정','edit-member',id,'primary'));
}
function profileDayDonut(events){
  const days=Array.from({length:Math.min(Math.max(currentBattleDay(),ui.day,...data.logs.map(e=>e.day)),data.rules.days)},(_,i)=>i+1),day=Number(ext.profileDay)||0,rows=day?events.filter(e=>e.day===day):events;
  return `<section class="profile-donut"><div class="profile-chart-controls"><div class="day-pills" role="group" aria-label="개인 이력 일차">${[[0,'전체'],...days.map(d=>[d,d+'일차'])].map(([d,name])=>`<button data-action="v3-profile-day" data-value="${d}" class="${day===d?'active ':''}${d===currentBattleDay()?'day-current':''}" aria-pressed="${day===d}">${name}</button>`).join('')}</div>${metricSwitch('개인 이력')}</div>${richBossShare(rows,chartView.metric)}<div class="profile-chart-foot">${day?day+'일차':'전체 일차'} · 공격 ${rows.length}건</div></section>`;
}
function recommendationDistribution(){
  if(!ext.distributionOpen)return '';
  const plans=ext.foundPlans||[];
  return `<section class="distribution-panel"><div class="sheet-heading"><h2>추천 분배</h2>${simpleButton('닫기','v3-distribution')}</div>${plans.length?rowTable(['추천 조합','합계 기대딜',''],plans.slice(0,5).map((p,i)=>`<tr><td>${p.ids.map(id=>{const t=tacticById(id);return `<span class="distribution-boss" style="${bossStyle(t.boss)}">${t.boss}넴</span>`;}).join('<span class="separator"> / </span>')}</td><td class="right numeric">${expectedDamageValue(p.damage)}</td><td class="right">${simpleButton('선택','v2-use-plan',String(i),'quiet')}</td></tr>`),'distribution-table'):'<p class="no-rows">겹치지 않는 3타 조합이 없습니다.</p>'}</section>`;
}
function attackSlot(slot,index){
  if(!slot)return '<span class="slot-unused">—</span>';
  const e=slot.basic,c=slot.carry,estimated=slot.pending&&e.damage>e.before?engineEstimate({hp:e.before,second:e.damage,seconds:90}):null,seconds=estimated?.seconds,pending=Number.isInteger(seconds)&&seconds>0?seconds+'초':'*';
  const boss=(event,carry=false)=>`<button class="dashboard-boss ${carry?'dashboard-carry-boss':'dashboard-basic-boss'}" style="${bossStyle(event.boss)}" data-action="edit-log" data-id="${event.id}" title="${index+1}타${carry?' 이월':''} · ${event.boss}넴">${event.boss}</button>`;
  return `<span class="dashboard-attack">${boss(e)}${c?`<span class="slot-separator" aria-hidden="true">/</span>${boss(c,true)}`:slot.pending?`<span class="slot-separator" aria-hidden="true">/</span><strong class="carry-ready" title="${pending==='*'?'이월시간 계산에 필요한 오버킬 기록 없음':'오버킬 기준 예상 이월 '+pending}" aria-label="미사용 이월 ${pending==='*'?'계산 가능한 오버킬 기록 없음':pending}">${pending}</strong>`:''}</span>`;
}
function attackEntryState(fd){
  const old=data.logs.find(e=>e.id===String(fd.get('logId')||'')),boss=bossBy(fd.get('boss'));
  const stage=old&&old.boss===boss.id?old.stage:boss.stage;
  const automatic=[2,3].includes(stage)&&fd.has('autoDamage');
  return {boss,old,stage,automatic,damage:automatic?Number(data.bossSettings.find(b=>b.id===boss.id).hp[stage]):numberValue(fd.get('damage'))*Number(fd.get('unit')||100000000)};
}
function syncAttackEntry(form){
  if(!form)return;
  if(!data.bosses.some(b=>String(b.id)===String(new FormData(form).get('boss'))))return;
  const fd=new FormData(form),state=attackEntryState(fd),field=form.querySelector('[name="damage"]'),auto=form.querySelector('.early-auto');
  if(auto)auto.hidden=![2,3].includes(state.stage);
  if(field){
    field.readOnly=state.automatic;
    if(state.automatic){field.value=String(state.damage/Number(fd.get('unit')||1));field.dataset.wasAuto='1';}
    else if(field.dataset.wasAuto==='1'&&!state.old){field.value='';field.dataset.wasAuto='0';}
  }
}
document.addEventListener('click',event=>{
  const b=event.target.closest('[data-action]');if(b?.dataset.action==='clear-plan'){ext.onlyPicks=false;return;}if(!b||!b.dataset.action.startsWith('v3-'))return;
  event.preventDefault();event.stopImmediatePropagation();
  const action=b.dataset.action;
  if(action==='v3-list-page'){listPages[b.dataset.group]=Number(b.dataset.value);render();}
  if(action==='v3-member-info')openMemberInfo(b.dataset.id);
  if(action==='v3-profile-day'){ext.profileDay=Number(b.dataset.value);chartView.boss=0;render();}
  if(action==='v3-distribution'){ext.distributionOpen=!ext.distributionOpen;if(ext.distributionOpen){findPlans();if(ext.foundPlans?.length){ui.picks=[...ext.foundPlans[0].ids];ext.selectedSupports={...(ext.foundPlans[0].supports||{})};ext.onlyPicks=true;}}render();}
  if(action==='v3-selected-only'){ext.onlyPicks=!ext.onlyPicks;render();}
  if(action==='v3-boss-tactics'){nav('tactics','combos');ui.boss=Number(b.dataset.id);ext.stage=4;render();}
},true);
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.dataset.input==='v3-rank-metric'){ui.rankSort=el.value;listPages.ranking=1;render();}
  if(el.dataset.input==='v3-quick-auto')syncAttackEntry(el.closest('form'));
});
