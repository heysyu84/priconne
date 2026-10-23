import {characterPortrait, portraitAttributes, portraitStarOverlay} from './character-portraits.mjs?v=20261023-image-cleanup01';
import {isBoosterCharacter, formatExpectedDamage, sourceLinkBox, sourceLinkKind} from './view-settings.mjs?v=20261023-image-cleanup01';
import {planThreeAttacks} from './combo-planner.mjs?v=20261023-image-cleanup01';
import {visibleTacticRecommendations} from './tactic-combo-sync.mjs?v=20261023-sortcount01';

export function createComboWorkspace(api) {
  const {state, render, section, canEdit, characters, escapeHtml: X, notice} = api;
  let view = 'compact', lastMonth = '', selectedBosses = null, distinctBosses = true;
  const sortDamage=combo=>{
    const raw=String(combo.expectedDamage??'').replace(/[,\s]/g,'').replace(/억$/,'');
    const value=Number(raw);
    return raw&&Number.isFinite(value)&&value>=0?value:-Infinity;
  };
  // Primary: 1~5 boss order. Secondary: largest expected damage first.
  // Stage 3 has no expected damage: prefer greater carryover seconds there.
  const recommendationOrder=(a,b)=>
    Number(a.boss)-Number(b.boss) ||
    (Number(a.stage)===3
      ? Number(b.remainingSeconds||0)-Number(a.remainingSeconds||0)
      : sortDamage(b)-sortDamage(a)) ||
    String(a.id||'').localeCompare(String(b.id||''),'ko');
  const source = combo => [combo.url, combo.video, combo.tacticUrl].find(value => sourceLinkKind(value) !== 'empty');
  // Keep stored values intact. Render integer TP levels as 4.0 / 4.0+.
  const tpLabel = value => {
    const raw = String(value ?? '').trim();
    if (!raw) return '—';
    const match = raw.match(/^(\d+)(?:\.(\d+))?(\+)?$/);
    return X(match ? match[1] + '.' + (match[2] || '0') + (match[3] || '') : raw);
  };
  const seconds = value => value === null || value === undefined || value === '' ? '—' : X(value) + '초';
  const boss = value => `<span class="combo-mini-boss" data-boss-color="${X(value)}">${X(value)}넴</span>`;
  function party(combo, supportIndex = -1, compact = false) {
    return `<div class="combo-mini-party">${Array.from({length: 5}, (_, index) => {
      const name = combo.characters?.[index] || '미선택', borrowed = index === supportIndex;
      const portrait = characterPortrait(characters, name, combo.stars?.[index]);
      return `<span class="combo-mini-unit${borrowed ? ' is-support' : ''}" title="${X(name)} · ${X(combo.stars?.[index] || '?')}성${borrowed ? ' · 서포트' : ''}"><span class="combo-mini-art">${portrait.url ? `<img class="combo-mini-avatar" src="${X(portrait.url)}" ${portraitAttributes(portrait)} alt="${X(name)}" loading="lazy">${portraitStarOverlay(portrait)}` : '<span class="combo-mini-missing">?</span>'}${borrowed ? '<span class="combo-support-mark" aria-label="서포트">S</span>' : ''}</span><strong class="${isBoosterCharacter(api.app(), name, characters) ? 'is-booster' : ''}"${compact ? ` style="--combo-name-length:${Math.max(1, Array.from(name).length)}"` : ''}>${borrowed ? '[' + X(name) + ']' : X(name)}</strong>${compact ? `<small class="combo-mini-unit-star" aria-label="${X(combo.stars?.[index] || '?')}성">★${X(combo.stars?.[index] || '?')}</small>` : ''}</span>`;
    }).join('')}</div>`;
  }
  function metadata(combo) {
    if (Number(combo.stage) === 3) return `<span class="combo-mini-chip"><small>필요</small> ${seconds(combo.requiredSeconds)}</span><span class="combo-mini-chip is-tactic">${X(combo.tactic?.trim() || '전부 SET')}</span>`;
    const type = /타비/.test(combo.tactic || '') ? '타비' : /택틱/.test(combo.tactic || '') ? '택틱' : combo.tactic || '—';
    const manual = combo.manualCount === null || combo.manualCount === undefined || combo.manualCount === '' ? '—' : combo.manualCount;
    return `<span class="combo-mini-chip ${type === '택틱' ? 'is-tactic' : type === '타비' ? 'is-tabi' : ''}">${X(type)}</span><span class="combo-mini-chip${Number(manual) > 0 ? ' has-manual' : ''}">손컨 ${X(manual)}</span><span class="combo-mini-chip is-tp">TP ${tpLabel(combo.tp)}</span>`;
  }
  function compactRows(rows) {
    if (!rows.length) return '<div class="panel empty">등록된 추천 조합이 없습니다.</div>';
    return `<div class="combo-compact-list">${rows.map(combo => {
      const stage3 = Number(combo.stage) === 3;
      return `<article class="combo-compact-row${stage3 ? ' is-stage3' : ''}" data-boss-color="${X(combo.boss)}" aria-label="${X(combo.stage)}단계 ${X(combo.boss)}넴 추천 조합"><div class="combo-mini-layout"><div class="combo-mini-header">${boss(combo.boss)}<div class="combo-mini-facts">${metadata(combo)}${stage3 ? '' : sourceLinkBox(source(combo))}</div></div><div class="combo-mini-lineup">${party(combo, -1, true)}</div><div class="combo-mini-score"><small>${stage3 ? '이월' : '기대딜'}</small><strong>${stage3 ? seconds(combo.remainingSeconds) : X(formatExpectedDamage(combo.expectedDamage))}</strong></div>${combo.note ? `<p class="combo-mini-note">${X(combo.note)}</p>` : ''}${canEdit() ? `<div class="combo-mini-admin"><button class="btn sm" data-guild="edit-combo" data-id="${X(combo.id)}">수정</button><button class="btn sm danger" data-guild="delete-combo" data-id="${X(combo.id)}">삭제</button></div>` : ''}</div></article>`;
    }).join('')}</div>`;
  }
  function distribution() {
    const month = api.month(), bosses = month.bosses || [];
    const ids = selectedBosses === null ? bosses.map(value => Number(value.id)) : [...selectedBosses];
    const result = planThreeAttacks(visibleTacticRecommendations(month), characters, {bossIds: ids, distinctBosses, limit: 5});
    const controls = `<section class="panel combo-planner-controls"><div class="panel-head"><div><h2>4단계 3타 분배</h2><p class="small muted">내 캐릭터는 하루 1회 · 서포트는 타당 1명</p></div><label class="combo-repeat-option"><input type="checkbox" data-combo-change="distinct" ${distinctBosses ? 'checked' : ''}>서로 다른 보스</label></div><div class="combo-planner-bosses" role="group" aria-label="분배 대상 보스"><span class="small muted">대상 보스</span>${bosses.map(value => `<button class="btn sm ${ids.includes(Number(value.id)) ? 'selected' : ''}" data-combo-action="boss" data-value="${X(value.id)}" data-boss-color="${X(value.id)}" aria-pressed="${ids.includes(Number(value.id))}">${X(value.id)}넴</button>`).join('')}<button class="textbutton" data-combo-action="all-bosses">전체 선택</button></div><p class="small combo-support-help"><span class="combo-support-example">[이름]</span>은 중복을 풀기 위해 꼭 빌릴 캐릭터입니다. ‘자유’는 편성 중 누구든 1명 빌릴 수 있습니다.</p></section>`;
    if (!result.plans.length) {
      const message = distinctBosses && ids.length < 3 ? '서로 다른 보스 3개 이상을 선택해 주세요.' : result.candidateCount < 3 ? '기대딜이 등록된 4단계 조합이 3개 이상 필요합니다.' : '선택한 보스와 조합으로는 캐릭터 사용 조건을 만족하는 3타를 만들 수 없습니다.';
      return controls + `<section class="panel empty combo-planner-empty">${message}</section>`;
    }
    return controls + `<div class="combo-plan-caption">기대딜 합계가 높은 보스 분배 ${result.plans.length}개${result.skippedCount ? ` · 기대딜 또는 편성이 미완성인 ${result.skippedCount}개 조합 제외` : ''}</div><div class="combo-distribution-list">${result.plans.map((plan, rank) => `<article class="panel combo-distribution${rank === 0 ? ' is-best' : ''}" aria-label="${rank + 1}순위 3타 분배"><header class="combo-distribution-head"><div><span class="combo-plan-rank">${rank + 1}</span><strong>${plan.attacks.map(attack => X(attack.combo.boss) + '넴').join(' + ')}</strong><small>${plan.borrowCount ? '필수 서포트 ' + plan.borrowCount + '타' : '중복 없음'}</small></div><div class="combo-plan-total"><small>기대딜 합계</small><strong>${formatExpectedDamage(plan.totalDamage)}<span>억</span></strong></div></header><table class="combo-plan-table"><colgroup><col class="plan-boss-col"><col class="plan-party-col"><col class="plan-damage-col"><col class="plan-support-col"></colgroup><thead><tr><th scope="col">타격</th><th scope="col">조합</th><th scope="col">기대딜</th><th scope="col">서포트</th></tr></thead><tbody>${plan.attacks.map((attack, shot) => `<tr><th scope="row"><small>${shot + 1}타</small>${boss(attack.combo.boss)}</th><td>${party(attack.combo, attack.supportIndex)}</td><td class="combo-plan-damage"><strong>${formatExpectedDamage(attack.expectedDamage)}</strong>${sourceLinkBox(source(attack.combo))}</td><td class="combo-plan-support">${attack.supportIndex < 0 ? '<span class="muted">자유</span>' : `<strong>[${X(attack.combo.characters[attack.supportIndex])}]</strong>`}</td></tr>`).join('')}</tbody></table></article>`).join('')}</div>`;
  }
  function markup() {
    const month = api.month(), key = api.app().active;
    if (key !== lastMonth) { selectedBosses = null; lastMonth = key; }
    const stage = Number(state.comboStage), currentView = stage === 3 && view === 'planner' ? 'compact' : view;
    const rows = visibleTacticRecommendations(month).filter(combo => Number(combo.stage) === stage && (state.comboBoss === 'all' || Number(combo.boss) === Number(state.comboBoss))).sort(recommendationOrder);
    const modes = stage === 4 ? [['compact', '조합 목록'], ['planner', '3타 분배']] : [];
    const filters = `<div class="combo-workspace-toolbar"><div class="tabset" aria-label="추천 조합 단계">${[['4', '4단계'], ['3', '3단계']].map(([value, label]) => `<button data-guild="combo-stage" data-value="${value}" class="${state.comboStage === value ? 'active' : ''}">${label}</button>`).join('')}</div>${modes.length ? `<div class="tabset combo-view-tabs" role="group" aria-label="조합 목록과 3타 분배 전환">${modes.map(([value, label]) => `<button data-combo-action="view" data-value="${value}" class="${currentView === value ? 'active' : ''}" aria-pressed="${currentView === value}">${label}</button>`).join('')}</div>` : ''}</div>${currentView === 'planner' ? '' : `<div class="combo-workspace-boss-filter"><div class="tabset" aria-label="보스별 조합">${[['all', '전체 보스'], ...month.bosses.map(value => [String(value.id), value.id + '넴'])].map(([value, label]) => `<button data-guild="combo-boss" data-value="${value}" data-boss-color="${value}" class="${state.comboBoss === value ? 'active' : ''}">${label}</button>`).join('')}</div><span class="small muted">${rows.length}개 조합</span></div>`}`;
    return section('추천 조합', '', canEdit() ? (stage===4?'<button class="btn primary" data-page="tactics">＋ 택틱 작업실에서 조합 추가</button>':'<button class="btn primary" data-guild="add-combo">＋ 추천 조합</button>') : '') + `<div class="recommendation-workspace">${filters}${notice()}${currentView === 'planner' ? distribution() : compactRows(rows)}</div>`;
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-combo-action]');
    if (!button || !button.closest('.recommendation-workspace')) return;
    switch (button.dataset.comboAction) {
      case 'view':
        if (!['compact', 'planner'].includes(button.dataset.value)) return;
        view = button.dataset.value;
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
