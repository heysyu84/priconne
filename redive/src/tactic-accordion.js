// This is another view of the workspace's tactics and selection, not a data copy.
function accordionWorkspace(archive=false){
  const navigation=workspaceNavigation(archive),list=workspaceList();
  const selected=list.find(t=>t.id===ui.selectedTactic);
  if(!selected)ext.accordionOpen=false;
  const empty=ext.workGroup==='carry'&&carryTimeRange()!=='all'?'해당 시간대의 이월 택틱이 없습니다.':'등록된 택틱이 없습니다.';
  return navigation+`<section class="tactic-accordion workspace-restored" aria-label="조합별 택틱"><div class="sheet-heading"><h2>택틱 목록 <small>${list.length}개</small></h2>${carryTimeFilter()}</div><div class="tactic-accordion-list">${list.map((t,index)=>tacticAccordionItem(t,index,!!ext.accordionOpen&&t.id===selected?.id,archive)).join('')||`<p class="no-rows">${empty}</p>`}</div></section>`;
}
function tacticAccordionItem(t,index,open,archive){
  const trigger='tactic-accordion-trigger-'+index,panel='tactic-accordion-panel-'+index;
  const needed=t.category==='carry'?minimumCarry(t):null;
  const label=(t.boss?t.boss+'넴':'미분류')+' '+t.party.join(' ')+', 기대딜 '+tacticDamageLabel(t)+'억';
  const characters=t.party.map((name,i)=>`<span class="tactic-accordion-unit ${i===t.support?'support':''}"><span class="unit-face star-${t.stars[i]}">${portraitHtml(name,t.stars[i])}</span><strong class="${partyNameClasses(t,name,i)}">${X(name)}</strong><small class="${rarityClass(t.stars[i])}">★${X(t.stars[i])}${i===t.support?' · 서포트':''}</small></span>`).join('');
  return `<article class="tactic-accordion-item ${open?'is-open':''}" style="${t.boss?bossStyle(t.boss):'--boss:var(--muted);--boss-wash:var(--wash);--boss-ink:var(--text)'}" data-tactic-id="${X(t.id)}"><h3 class="tactic-accordion-heading"><button type="button" id="${trigger}" class="tactic-accordion-trigger" data-action="v2-accordion-tactic" data-id="${X(t.id)}" aria-expanded="${open}" aria-controls="${panel}" aria-label="${X(label)}"><span class="tactic-accordion-boss"><strong>${t.boss?X(t.boss+'넴 · '+bossBy(t.boss).name):'미분류'}</strong><small>${t.category==='carry'?(needed===null?'이월시간 미입력':needed+'초 이월'):t.stage+'단계'}</small></span><span class="tactic-accordion-party">${characters}</span><span class="tactic-accordion-stats"><span>기대딜 <b>${tacticDamageLabel(t)}<small>억</small></b></span><span>손컨 <b class="${t.hands?'danger':''}">${tacticHands(t)}</b> · TP <b class="${tacticTpClass(t.tp)}">${X(t.tp||'—')}</b></span></span><span class="tactic-accordion-chevron" aria-hidden="true">${icon('down')}</span></button></h3><div id="${panel}" class="tactic-accordion-panel work-editor" role="region" aria-labelledby="${trigger}" ${open?'':'hidden'}>${open?(archive?readOnlyWorkspaceTactic(t):workEditor(t)):''}</div></article>`;
}
