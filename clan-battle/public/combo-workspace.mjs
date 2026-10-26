import {characterPortrait, portraitAttributes, portraitStarOverlay} from './character-portraits.mjs?v=20261023-image-cleanup01';
import {isBoosterCharacter, formatExpectedDamage, sourceLinkBox, sourceLinkKind} from './view-settings.mjs?v=20261023-image-cleanup01';
import {planThreeAttacks} from './combo-planner.mjs?v=20261023-image-cleanup01';
import {isStageFourUnlocked} from './guild-model.mjs?v=20261024-boss-lap-lock01';
import {visibleTacticRecommendations,recommendationDisplayOrder} from './tactic-combo-sync.mjs?v=20261026-combo-live02';

export function createComboWorkspace(api) {
  const {state, render, section, canEdit, characters, escapeHtml: X, notice} = api;
  let view = 'compact', lastMonth = '', selectedBosses = null, distinctBosses = true, plannerPrepared = false, helpOpen = false;
  const source = combo => [combo.url, combo.video, combo.tacticUrl].find(value => sourceLinkKind(value) !== 'empty');
  // Keep stored values intact. Render integer TP levels as 4.0 / 4.0+.
  const tpLabel = value => {
    const raw = String(value ?? '').trim();
    if (!raw) return '—';
    const match = raw.match(/^(\d+)(?:\.(\d+))?(\+)?$/);
    return X(match ? match[1] + '.' + (match[2] || '0') + (match[3] || '') : raw);
  };
  const seconds = value => value === null || value === undefined || value === '' ? '—' : X(value) + '초';
  const warningManual = value => value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) !== 0;
  const warningTp = value => String(value ?? '').includes('+');
  const starMarkup = value => { const star=String(value||'?'); return /^\d$/.test(star)&&star!=='5'&&star!=='6'?'<span class="tactic-warning">'+X(star)+'</span>':X(star); };
  const boss = value => `<span class="combo-mini-boss" data-boss-color="${X(value)}">${X(value)}넴</span>`;
  function party(combo, supportIndex = -1, compact = false) {
    return `<div class="combo-mini-party">${Array.from({length: 5}, (_, index) => {
      const name = combo.characters?.[index] || '미선택', borrowed = index === supportIndex;
      const portrait = characterPortrait(characters, name, combo.stars?.[index]);
      return `<span class="combo-mini-unit${borrowed ? ' is-support' : ''}" title="${X(name)} · ${X(combo.stars?.[index] || '?')}성${borrowed ? ' · 서포트' : ''}"><span class="combo-mini-art">${portrait.url ? `<img class="combo-mini-avatar" src="${X(portrait.url)}" ${portraitAttributes(portrait)} alt="${X(name)}" loading="lazy">${portraitStarOverlay(portrait)}` : '<span class="combo-mini-missing">?</span>'}${borrowed ? '<span class="combo-support-mark" aria-label="서포트">S</span>' : ''}</span><strong class="${isBoosterCharacter(api.app(), name, characters) ? 'is-booster' : ''}"${compact ? ` style="--combo-name-length:${Math.max(1, Array.from(name).length)}"` : ''}>${borrowed ? '[' + X(name) + ']' : X(name)}</strong>${compact ? `<small class="combo-mini-unit-star" aria-label="${X(combo.stars?.[index] || '?')}성">★${starMarkup(combo.stars?.[index])}</small>` : ''}</span>`;
    }).join('')}</div>`;
  }
  function metadata(combo) {
    if (Number(combo.stage) === 3) return `<span class="combo-mini-chip"><small>필요</small> ${seconds(combo.requiredSeconds)}</span><span class="combo-mini-chip is-tactic">${X(combo.tactic?.trim() || '전부 SET')}</span>`;
    const type = /타비/.test(combo.tactic || '') ? '타비' : /택틱/.test(combo.tactic || '') ? '택틱' : combo.tactic || '—';
    const manual = combo.manualCount === null || combo.manualCount === undefined || combo.manualCount === '' ? '—' : combo.manualCount;
    return `<span class="combo-mini-chip ${type === '택틱' ? 'is-tactic' : type === '타비' ? 'is-tabi' : ''}">${X(type)}</span><span class="combo-mini-chip${warningManual(combo.manualCount) ? ' has-manual tactic-warning' : ''}">손컨 ${X(manual)}</span><span class="combo-mini-chip is-tp${warningTp(combo.tp)?' tactic-warning':''}">TP ${tpLabel(combo.tp)}</span>`;
  }
  function compactRows(rows) {
    if (!rows.length) return '<div class="panel empty">등록된 추천 조합이 없습니다.</div>';
    return `<div class="combo-compact-list">${rows.map(combo => {
      const stage3 = Number(combo.stage) === 3;
      return `<article class="combo-compact-row${stage3 ? ' is-stage3' : ''}" data-boss-color="${X(combo.boss)}" aria-label="${X(combo.stage)}단계 ${X(combo.boss)}넴 추천 조합"><div class="combo-mini-layout"><div class="combo-mini-header">${boss(combo.boss)}<div class="combo-mini-facts">${metadata(combo)}${stage3 ? '' : sourceLinkBox(source(combo))}</div></div><div class="combo-mini-lineup">${party(combo, -1, true)}</div><div class="combo-mini-score"><small>${stage3 ? '이월' : '기대딜'}</small><strong>${stage3 ? seconds(combo.remainingSeconds) : X(formatExpectedDamage(combo.expectedDamage))}</strong></div>${combo.note ? `<p class="combo-mini-note">${X(combo.note)}</p>` : ''}${combo.sourceTacticId||canEdit() ? `<div class="combo-mini-admin">${combo.sourceTacticId ? `<button class="btn sm" type="button" data-open-tactic="${X(combo.sourceTacticId)}" title="이 추천 조합의 원본 택틱을 열어 편성을 확인합니다">원본 택틱 보기</button>` : ''}${canEdit() ? `<button class="btn sm" data-guild="edit-combo" data-id="${X(combo.id)}">수정</button><button class="btn sm danger" data-guild="delete-combo" data-id="${X(combo.id)}">삭제</button>` : ''}</div>` : ''}</div></article>`;
    }).join('')}</div>`;
  }
  function distribution() {
    const month = api.month(), bosses = month.bosses || [];
    const ids = selectedBosses === null ? bosses.map(value => Number(value.id)) : [...selectedBosses];
    const result = planThreeAttacks(visibleTacticRecommendations(month), characters, {bossIds: ids, distinctBosses, limit: 5});
    const controls = `<section class="panel combo-planner-controls"><div class="panel-head"><div><h2>4단계 3타 분배</h2></div><label class="combo-repeat-option"><input type="checkbox" data-combo-change="distinct" ${distinctBosses ? 'checked' : ''}>서로 다른 보스</label></div><div class="combo-planner-bosses" role="group" aria-label="분배 대상 보스"><span class="small muted">대상 보스</span>${bosses.map(value => `<button class="btn sm ${ids.includes(Number(value.id)) ? 'selected' : ''}" data-combo-action="boss" data-value="${X(value.id)}" data-boss-color="${X(value.id)}" aria-pressed="${ids.includes(Number(value.id))}">${X(value.id)}넴</button>`).join('')}<button class="textbutton" data-combo-action="all-bosses">전체 선택</button></div></section>`;
    if (!result.plans.length) {
      const message = distinctBosses && ids.length < 3 ? '서로 다른 보스를 세 곳 이상 선택해 주세요.' : result.candidateCount < 3 ? '기대딜이 등록된 4단계 조합이 3개 이상 필요합니다.' : '선택한 보스와 조합으로는 캐릭터 사용 조건을 만족하는 3타를 만들 수 없습니다.';
      return controls + `<section class="panel empty combo-planner-empty">${message}</section>`;
    }
    return controls + `<div class="combo-plan-caption">기대딜 합계가 높은 3타 추천분배${result.skippedCount ? ` · 기대딜 또는 편성이 미완성인 ${result.skippedCount}개 조합 제외` : ''}</div><div class="combo-distribution-list">${result.plans.map((plan, rank) => `<article class="panel combo-distribution${rank === 0 ? ' is-best' : ''}" aria-label="${rank + 1}순위 3타 분배"><header class="combo-distribution-head"><div><span class="combo-plan-rank">${rank + 1}</span><strong>${plan.attacks.map(attack => X(attack.combo.boss) + '넴').join(' + ')}</strong><small>${plan.borrowCount ? '필수 서포트 ' + plan.borrowCount + '타' : '중복 없음'}</small></div><div class="combo-plan-total"><small>기대딜 합계</small><strong>${formatExpectedDamage(plan.totalDamage)}<span>억</span></strong></div></header><table class="combo-plan-table"><colgroup><col class="plan-boss-col"><col class="plan-party-col"><col class="plan-damage-col"><col class="plan-support-col"></colgroup><thead><tr><th scope="col">타격</th><th scope="col">조합</th><th scope="col">기대딜</th><th scope="col">서포트</th></tr></thead><tbody>${plan.attacks.map((attack, shot) => `<tr><th scope="row"><small>${shot + 1}타</small>${boss(attack.combo.boss)}</th><td>${party(attack.combo, attack.supportIndex)}</td><td class="combo-plan-damage"><strong>${formatExpectedDamage(attack.expectedDamage)}</strong>${sourceLinkBox(source(attack.combo))}</td><td class="combo-plan-support">${attack.supportIndex < 0 ? '<span class="muted">자유</span>' : `<strong>[${X(attack.combo.characters[attack.supportIndex])}]</strong>`}</td></tr>`).join('')}</tbody></table></article>`).join('')}</div>`;
  }
  function markup() {
    const month = api.month(), key = api.app().active;
    if (key !== lastMonth) { selectedBosses = null; lastMonth = key; view = 'compact'; plannerPrepared = false; helpOpen = false; }
    const stage4Open=isStageFourUnlocked(month);
    // Never strand viewers on an automatically hidden third-stage tab.
    if(stage4Open&&String(state.comboStage)==='3'){state.comboStage='4';view='compact';}
    const stage = Number(state.comboStage), currentView = stage === 3 && view === 'planner' ? 'compact' : view;
    const rows = visibleTacticRecommendations(month).filter(combo => Number(combo.stage) === stage && (state.comboBoss === 'all' || Number(combo.boss) === Number(state.comboBoss))).sort(recommendationDisplayOrder);
    const menuTabs = [...(stage4Open?[]:[['3', '3단계']]), ['4', '4단계']];
    const filters = `<div class="combo-workspace-toolbar"><div class="tabset" role="group" aria-label="추천 조합 단계와 3타 분배">${menuTabs.map(([value, label]) => { const selected = currentView === 'compact' && String(stage) === value; return `<button type="button" data-combo-action="tab" data-value="${value}" class="${selected ? 'active' : ''}" aria-pressed="${selected}">${label}</button>`; }).join('')}</div><div class="combo-planner-actions" role="group" aria-label="추천분배 조작"><button type="button" class="btn sm ${plannerPrepared ? 'active' : ''}" data-combo-action="recommend">${plannerPrepared ? '비우기' : '추천분배'}</button><button type="button" class="btn sm" data-combo-action="toggle-planner" aria-controls="combo-plan-panel" aria-expanded="${currentView === 'planner'}">${currentView === 'planner' ? '닫기' : '열기'}</button><button type="button" class="btn sm" data-combo-action="help" aria-expanded="${helpOpen}">안내</button></div></div>${currentView === 'planner' ? '' : `<div class="combo-workspace-boss-filter"><div class="tabset" aria-label="보스별 조합">${[['all', '전체 보스'], ...month.bosses.map(value => [String(value.id), value.id + '넴'])].map(([value, label]) => `<button data-guild="combo-boss" data-value="${value}" data-boss-color="${value}" class="${state.comboBoss === value ? 'active' : ''}">${label}</button>`).join('')}</div></div>`}`;
    return section('추천 조합', '', canEdit() ? (stage===4?'<button class="btn primary" data-page="tactics">＋ 택틱 작업실에서 조합 추가</button>':'<button class="btn primary" data-guild="add-combo">＋ 추천 조합</button>') : '') + `<div class="recommendation-workspace">${filters}${helpOpen?'<div class="panel combo-planner-help" role="note">추천분배는 4단계 조합 중 중복 캐릭터를 피하면서 기대딜 합계가 높은 3타를 계산합니다. 비우기는 분배를 초기화하고, 열기·닫기는 결과만 펼치거나 접습니다.</div>':''}${notice()}<div id="combo-plan-panel">${currentView === 'planner' ? distribution() : compactRows(rows)}</div></div>`;
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-combo-action]');
    if (!button || !button.closest('.recommendation-workspace')) return;
    switch (button.dataset.comboAction) {
      case 'tab':
        if (!['3', '4'].includes(button.dataset.value)) return;
        if(button.dataset.value==='3'&&isStageFourUnlocked(api.month()))return;
        state.comboStage = button.dataset.value;
        view = 'compact';
        break;
      case 'recommend':
        if(plannerPrepared){plannerPrepared=false;view='compact';selectedBosses=null;distinctBosses=true;}
        else{plannerPrepared=true;state.comboStage='4';view='planner';}
        break;
      case 'toggle-planner':
        if(view==='planner')view='compact';
        else{plannerPrepared=true;state.comboStage='4';view='planner';}
        break;
      case 'help':
        helpOpen=!helpOpen;
        break;
      case 'boss': {
        if (selectedBosses === null) selectedBosses = new Set(api.month().bosses.map(value => Number(value.id)));
        const id = Number(button.dataset.value);
        selectedBosses.has(id) ? selectedBosses.delete(id) : selectedBosses.add(id);
        break;
      }
      case 'all-bosses': selectedBosses = null; break;
      default: return;
    }
    render();
  });
  document.addEventListener('change', event => {
    if (!event.target.matches?.('[data-combo-change="distinct"]')) return;
    distinctBosses = event.target.checked; render();
  });
  return {render: markup};
}
