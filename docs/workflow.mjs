import { sequenceVisible, setSequenceVisible } from './view-settings.mjs?v=20261023-image-cleanup01';
import { makeId, memberLabel, syncRoster, matchMembers, parseDamage } from './roster.mjs?v=20261022-ui14';
import { dayClosures, cancelDayClosure } from './battle-days.mjs?v=20261022-ui14';

export function createWorkflow(api) {
  const { getApp, getMonth, setApp, persist, replay, render, notify, navigate, section, nf, escapeHtml: X } = api;
  const state = { month: null, drafts: new Map(), query: '', filterDay: 'all', details: false, page: 1, restore: null, editing: null, picker: null, undo: [], rosterEdit: null, rosterSearch: '', rosterFilter: 'active', inputOpen:false };
  const app = () => getApp(), month = () => getMonth();
  const $ = s => document.querySelector(s);
  const canEdit=()=>api.canEdit?.()??true;
  const guard=()=>{if(canEdit())return true;api.unlock?.();return false;};
  const maxDay = () => Number(month().options.days || 5);
  const recentDay = () => Math.min(maxDay(), Math.max(1, ...month().events.map(e => Number(e.day) || 1),...(month().dayBreaks||[]).map(b=>b.nextDay)));
  const person = id => app().roster.find(p => p.id === id);
  const label = p => memberLabel(p, app().roster);
  const columns = () => ['member', 'boss', 'damage', 'carry', ...(state.details ? ['bonus', 'memo'] : [])];

  function draft() {
    const key = app().active;
    if (!state.drafts.has(key)) state.drafts.set(key, { day: recentDay(), memberId: '', memberQuery: '', boss: 1, damage: '', carry: false, autoDamage:true, bonus: '0', memo: '', beforeId: null });
    return state.drafts.get(key);
  }
  function remember() { state.undo.push(JSON.stringify(app())); if (state.undo.length > 10) state.undo.shift(); }
  function update(focus = null) { closePicker(); state.editing = null; state.restore = focus; render(); }
  function save(message, focus = null) { syncRoster(app()); replay(month()); draft().day=month().events.find(e=>e.id===draft().beforeId)?.day||recentDay();persist(); update(focus); if (message) notify(message); }
  function undo() {if(!guard())return;
    const snapshot = state.undo.pop();
    if (!snapshot) return notify('취소할 변경이 없습니다.');
    setApp(JSON.parse(snapshot));draft().day=recentDay();persist(); update({ quick: true }); notify('직전 변경을 취소했습니다.');
  }
  function participants(day, all = false) {
    return (month().memberIds || []).map(person).filter(Boolean).filter(p => {
      if (all) return true;
      const m = month().membership[p.id] || { fromDay: 1, toDay: null };
      return day >= m.fromDay && (m.toDay === null || m.toDay === undefined || day <= m.toDay);
    });
  }
  function usage(p, day) {
    const rows = month().events.filter(e => e.day === Number(day) && e.memberId === p.id);
    const normal = rows.filter(e => !e.carry).length;
    const pending = Math.max(0, rows.filter(e => !e.carry && e.kill).length - rows.filter(e => e.carry && e.carryIndex > 0).length);
    return `기본 ${normal}/${month().options.dailyAttacks || 3} · 미사용 이월 ${pending}`;
  }
  function memberInput(value, id, extra = '') {
    return `<input id="${id}" class="member-combobox" role="combobox" aria-label="${id === 'quick-member' ? '클랜원 이름 검색' : '클랜원 수정'}" aria-autocomplete="list" aria-expanded="false" aria-controls="wf-member-list" autocomplete="off" spellcheck="false" placeholder="이름 한 글자 · 초성 · UID" value="${X(value)}" ${extra}>`;
  }

  function quickView() {
    if(!canEdit())return '';
    const d = draft();
    return `<details class="panel quick-panel" ${state.inputOpen?'open':''} aria-label="배틀로그 입력"><summary>배틀로그 입력</summary><div class="panel-head"><div><div class="sub">이름 일부 입력 후 <kbd>↑↓</kbd> 선택 · <kbd>Tab</kbd> 다음 칸 · <kbd>Enter</kbd> 등록</div></div><button type="button" class="btn sm" data-wf="focus-quick">입력으로 이동 <kbd>/</kbd></button></div>
      ${d.beforeId ? `<div class="insert-banner">#${X(month().events.find(e => e.id === d.beforeId)?.seq || '')} 앞에 삽입합니다. <button type="button" class="textbutton" data-wf="cancel-insert">맨 뒤 입력으로 변경</button></div>` : ''}
      <form id="wf-quick-form" method="post"><div class="quick-grid">
      <div class="field day-current"><label>현재 일차</label><strong>${d.day}일차</strong></div>
      <div class="field"><label for="quick-member">클랜원</label>${memberInput(d.memberQuery, 'quick-member', 'data-quick="member"')}</div>
      <div class="field"><label for="quick-boss">보스</label><select id="quick-boss" data-quick="boss">${month().bosses.map(b => `<option value="${b.id}" ${Number(d.boss) === b.id ? 'selected' : ''}>${b.id} · ${X(b.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="quick-damage">피해량</label><input id="quick-damage" data-quick="damage" inputmode="decimal" autocomplete="off" placeholder="2·3단계 빈칸=최대 HP / 4단계 직접 입력" value="${X(d.damage)}"></div>
      <div class="field"><label for="quick-carry">이월 사용</label><label class="carry-control"><input id="quick-carry" type="checkbox" data-quick="carry" ${d.carry ? 'checked' : ''}><span>사용 <kbd>Space</kbd></span></label></div>
      
      <button class="btn primary quick-submit" type="submit">등록 <kbd>Enter</kbd></button></div>
      <div class="quick-auto"><label><input type="checkbox" data-quick="autoDamage" ${d.autoDamage?'checked':''}>2·3단계 최대 HP 자동 입력</label><small>직접 피해량을 입력하면 수동 기록</small>${d.day<maxDay()?`<button type="button" class="btn sm" data-wf="next-day">${d.day}일차 마감 → ${d.day+1}일차</button>`:''}</div><div class="quick-secondary"><div class="field"><label for="quick-bonus">가산점 (만)</label><input id="quick-bonus" data-quick="bonus" inputmode="decimal" value="${X(d.bonus)}"></div><div class="field"><label for="quick-memo">메모</label><input id="quick-memo" data-quick="memo" value="${X(d.memo)}" placeholder="선통·후통 확인사항 등"></div><div id="quick-usage" class="small muted">${d.memberId && person(d.memberId) ? X(usage(person(d.memberId), d.day)) : '등록 후 이름 입력 칸으로 돌아옵니다.'}</div></div></form></details>`;
  }
  function bossStrip(){return `<div class="battle-boss-strip" aria-label="보스별 남은 HP">${(api.getBosses?.()||[]).map(b=>`<button type="button" data-wf="pick-boss" data-boss-color="${b.id}" data-id="${b.id}" aria-pressed="${Number(draft().boss)===b.id}" title="${b.id}넴으로 공격 입력"><span class="mini-boss-art">${api.bossPortrait?.(b.id)?`<img src="${X(api.bossPortrait(b.id))}" alt="${X(b.name)}">`:b.id}</span><span class="mini-boss-data"><span class="mini-boss-original">${b.id}넴 · ${b.stage}단계 ${b.lap}회차</span><span class="mini-boss-inline"><b class="mini-boss-slot">${b.id}넴</b><b class="mini-boss-name">${X(b.name)}</b><span class="mini-boss-progress">${b.stage}단계 ${b.lap}회차</span></span><strong>${nf(b.hp)}</strong><small>${X(b.name)}</small></span></button>`).join('')}</div>`;}

  function filteredRows() {
    const query = state.query.toLowerCase();
    return [...month().events].sort((a, b) => b.seq - a.seq).filter(e => (state.filterDay === 'all' || e.day === Number(state.filterDay)) && (!query || `${e.member} ${person(e.memberId)?.uid || ''} ${e.seq} ${month().bosses[e.boss - 1]?.name || ''} ${e.memo || ''}`.toLowerCase().includes(query)));
  }
  function visibleRows() { return filteredRows().slice((state.page - 1) * 50, state.page * 50); }
  function gridCell(e, field, content, className = '') {
    return `<td role="gridcell" ${canEdit()?'tabindex="0"':''} class="${canEdit()?'edit-cell':'view-cell'} ${className}" data-row="${X(e.id)}" data-col="${field}" aria-label="#${e.seq} ${({ day: '일차', member: '클랜원', boss: '보스', damage: '피해량', carry: '이월 사용', role: '역할', bonus: '가산점', memo: '메모' })[field]}" ${canEdit()?'title="Enter 또는 F2로 수정 · 방향키로 이동"':''}>${content}</td>`;
  }
  function gridView() {
    const rows=filteredRows(),pages=Math.max(1,Math.ceil(rows.length/50)),seq=sequenceVisible();
    state.page=Math.min(state.page,pages);
    const shown=visibleRows(),warnings=new Map(replay(month()).map(w=>[w.id,w.message]));
    const cols=[...(seq?[[42]]:[]),[44],[92],[138],[118],[64],...(state.details?[[80],[160]]:[]),[118],[142],...(state.details?[[118]]:[]),...(canEdit()?[[94]]:[])];
    // The desktop percentages stay unchanged. Mobile gets content-sized columns
    // instead of inheriting the 720/1100px minimum table width.
    const mobileWidths=[...(seq?[34]:[]),40,78,90,84,45,...(state.details?[56,94]:[]),85,96,...(state.details?[90]:[]),...(canEdit()?[80]:[])];
    const mobileWidth=mobileWidths.reduce((sum,width)=>sum+width,0);
    const colspan=cols.length,colTotal=cols.reduce((sum,[width])=>sum+width,0);
    return `<div class="table-scroll battle-sheet-scroll"><table class="datatable battle-sheet compact-battle-sheet ${state.details?'with-details':''} ${canEdit()?'is-editable':'is-readonly'}" role="grid" aria-label="배틀로그 표" style="--mobile-battle-width:${mobileWidth}px"><colgroup>${cols.map(([width],index)=>`<col style="width:${width/colTotal*100}%;--mobile-col-width:${mobileWidths[index]}px">`).join('')}</colgroup><thead><tr>${seq?'<th>순번</th>':''}<th>일차</th><th>클랜원</th><th>보스 · 진행</th><th class="number">기록 피해량</th><th>${canEdit()?'이월 사용':'유형'}</th>${state.details?'<th>가산점(만)</th><th>메모</th>':''}<th class="number">실제 피해량</th><th class="number">남은 HP</th>${state.details?'<th class="number">기여도</th>':''}${canEdit()?'<th>행</th>':''}</tr></thead><tbody>${shown.map((e,index)=>{
      const b=month().bosses.find(b=>b.id===e.boss),warning=warnings.get(e.id),prev=shown[index-1];
      const carry=canEdit()?`<input type="checkbox" data-carry-record="${X(e.id)}" aria-label="#${e.seq} 이월 사용 체크" ${e.carry?'checked':''}>`:`<span class="pill ${e.carry?'blue':e.kill?'positive':'gray'} battle-kind">${e.carry?'이월타':e.kill?'격파':'일반'}</span>${e.carry&&e.kill?'<span class="pill positive battle-kind">격파</span>':''}`;
      return `${!prev||prev.day!==e.day?`<tr class="day-divider"><th colspan="${colspan}">${e.day}일차</th></tr>`:''}<tr class="${warning?'row-warning':''}">${seq?`<td class="h-num" title="${X(warning||'')}">${warning?'! ':''}${e.seq}</td>`:''}<td class="battle-day-cell">${e.day}일차</td>${gridCell(e,'member',`<strong>${X(e.member)}</strong>`,'member-cell')}${gridCell(e,'boss',`${e.boss} · ${X(b?.name||'')}<small>${e.stage}단계 · ${e.lap}회차</small>`,'boss-cell')}${gridCell(e,'damage',nf(e.damage),'number')}${gridCell(e,'carry',carry,'carry-cell')}${state.details?gridCell(e,'bonus',nf(e.bonus||0),'number')+gridCell(e,'memo',X(e.memo||''),'memo-cell'):''}<td class="number calculated">${nf(e.actual)}${e.kill?'<small class="inline-kill">격파</small>':''}</td><td class="number calculated hp-exact" title="${nf(e.before)} − ${nf(e.actual)} = ${nf(e.after)}"><strong>${nf(e.after)}</strong>${state.details?`<small>${nf(e.before)} − ${nf(e.actual)}</small>`:''}</td>${state.details?`<td class="number calculated contribution-cell">${nf(api.contribution(e,month()))}</td>`:''}${canEdit()?`<td class="row-tools"><button type="button" data-wf="insert-row" data-id="${X(e.id)}" title="이 행 앞에 입력 (Insert)" aria-label="#${e.seq} 앞에 입력">＋</button><button type="button" data-wf="delete-row" data-id="${X(e.id)}" title="이 공격 삭제 (Delete)" aria-label="#${e.seq} 삭제">×</button><button type="button" data-wf="split-day" data-id="${X(e.id)}" title="이 공격 뒤에서 일차 나누기">│</button></td>`:''}</tr>`;
    }).join('')||`<tr><td colspan="${colspan}"><div class="empty">공격 기록이 없습니다.</div></td></tr>`}</tbody></table></div><div class="sheet-footer"><span>${rows.length}건 · ${state.page} / ${pages} 페이지${warnings.size?` · 타수·이월 연결 주의 ${warnings.size}건`:''}</span><div class="btnbar"><button type="button" class="btn sm" data-wf="previous" ${state.page<=1?'disabled':''}>이전</button><button type="button" class="btn sm" data-wf="next" ${state.page>=pages?'disabled':''}>다음</button></div></div>`;
  }
  function battleView() {
    prepareMonth();
    return section('배틀로그', '', canEdit()?`<button type="button" class="btn" data-page="battle-import">📷 이미지 일괄 등록</button><button type="button" class="btn" data-wf="undo" ${state.undo.length&&canEdit() ? '' : 'disabled'}>실행 취소 <kbd>Ctrl Z</kbd></button><button type="button" class="btn" data-action="export">JSON 백업</button>`:'')
      + bossStrip() + quickView() + `<section class="panel sheet-panel section-spacer"><div class="panel-head"><div><h2>공격 내역 <span class="pill">${month().events.length}건</span></h2><div class="sub" ${canEdit()?'':'hidden'}>표에서 <kbd>←↑↓→</kbd> 이동 · <kbd>Enter / F2</kbd> 수정 · <kbd>Space</kbd> 이월 전환 · <kbd>Esc</kbd> 취소 · HP는 1 단위</div></div><div class="battle-view-options"><label class="switch small"><input id="wf-sequence" type="checkbox" ${sequenceVisible()?'checked':''}>순번 표시</label><label class="switch small"><input id="wf-details" type="checkbox" ${state.details ? 'checked' : ''}>상세 열</label></div></div>
      ${dayClosuresView()}<div class="filterbar"><input id="wf-log-search" aria-label="공격 기록 검색" placeholder="이름 · UID · 순번 · 보스 검색" value="${X(state.query)}"><select id="wf-day-filter" aria-label="공격 일차 필터"><option value="all">전체 일차</option>${Array.from({ length: maxDay() }, (_, i) => `<option value="${i + 1}" ${state.filterDay === String(i + 1) ? 'selected' : ''}>${i + 1}일차</option>`).join('')}</select></div><div id="wf-grid">${gridView()}</div></section>`;
  }

  function dayClosuresView() {
    if (!canEdit()) return '';
    const closures = dayClosures(month()).filter(b => b.id && b.shift > 0);
    if (!closures.length) return '';
    return `<div class="wf-day-closures" role="group" aria-label="일차 마감 관리"><strong>마감 이력</strong><div class="wf-day-closure-list">${closures.reverse().map(b => `<div class="wf-day-closure"><span>${b.day}일차 → ${b.nextDay}일차<small>${b.afterSeq ? `#${X(b.afterSeq)} 이후` : '첫 기록 전'}</small></span><button type="button" class="btn sm" data-wf="reopen-day" data-id="${X(b.id)}" aria-label="${b.day}일차 마감 취소">마감 취소</button></div>`).join('')}</div></div>`;
  }

  function closePicker() {
    if (state.picker?.input?.isConnected) state.picker.input.setAttribute('aria-expanded', 'false');
    $('#wf-member-list')?.remove(); state.picker = null;
  }
  function showPicker(input, context) {
    if (!input?.isConnected) return;
    const p = state.picker?.input === input ? state.picker : { input, context, index: 0 };
    p.matches = matchMembers(participants(context === 'quick' ? draft().day : state.editing?.event.day || 1, context !== 'quick'), input.value);
    p.index = Math.max(0, Math.min(p.index, p.matches.length - 1));
    state.picker = p;
    let box = $('#wf-member-list');
    if (!box) { box = document.createElement('div'); box.id = 'wf-member-list'; box.className = 'member-picker'; box.setAttribute('role', 'listbox'); document.body.append(box); }
    const rect = input.getBoundingClientRect();
    box.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 330)) + 'px';
    box.style.top = Math.min(rect.bottom + 5, window.innerHeight - 180) + 'px';
    box.style.width = Math.max(300, Math.min(400, window.innerWidth - 20)) + 'px';
    const day = context === 'quick' ? draft().day : state.editing?.event.day || 1;
    box.innerHTML = p.matches.slice(0, 30).map((member, i) => `<div role="option" id="wf-option-${i}" aria-selected="${i === p.index}" data-picker-id="${X(member.id)}" class="member-option ${i === p.index ? 'selected' : ''}"><div><strong>${X(label(member))}</strong><small>${member.uid ? 'UID ' + X(member.uid) : 'UID 미입력'}</small></div><span>${X(usage(member, day))}</span></div>`).join('') || '<div class="picker-empty">일치하는 참가자가 없습니다. 클랜원 관리에서 이름·UID와 참가 일차를 확인하세요.</div>';
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-activedescendant', `wf-option-${p.index}`);
    box.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }
  function selectedMember(input, all = false) {
    if (!input || (!input.value.trim() && !state.picker)) return null;
    const matches = matchMembers(participants(all ? state.editing?.event.day || 1 : draft().day, all), input.value);
    const exact = matches.find(p => [p.name, label(p), p.uid].includes(input.value.trim()));
    return (state.picker?.input === input ? state.picker.matches[state.picker.index] : null) || exact || matches[0];
  }
  function chooseMember(member, advance = false) {
    if (!member || !state.picker) return false;
    const { input, context } = state.picker;
    input.value = label(member);
    if (context === 'quick') {
      draft().memberId = member.id; draft().memberQuery = input.value;
      const usageBox = $('#quick-usage'); if (usageBox) usageBox.textContent = usage(member, draft().day);
      closePicker(); if (advance) focusQuick('boss');
    } else {
      state.editing.memberId = member.id; closePicker();
      if (advance) commitEditing({ row: state.editing.event.id, col: 'boss' });
    }
    return true;
  }
  function focusQuick(field = 'member') {
    const details=document.querySelector('.quick-panel');if(details){details.open=true;state.inputOpen=true;}
    const input = $(`#quick-${field}`);
    input?.focus({ preventScroll: false });
    if (input?.tagName === 'INPUT' && input.type !== 'checkbox') input.select();
  }
  function focusCell(row, col) {
    const cell = [...document.querySelectorAll('.edit-cell')].find(c => c.dataset.row === row && c.dataset.col === col);
    if (cell) { cell.focus({ preventScroll: true }); cell.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    else focusQuick();
  }
  function focusDestination(destination) {
    if (!destination) return;
    if (destination.quick) focusQuick(destination.field || 'member'); else focusCell(destination.row, destination.col);
  }
  function neighbor(row, col, dr = 0, dc = 0) {
    const rows = visibleRows(), cols = columns();
    let ri = rows.findIndex(e => e.id === row), ci = cols.indexOf(col) + dc;
    if (ci >= cols.length) { ci = 0; ri++; }
    if (ci < 0) { ci = cols.length - 1; ri--; }
    ri = Math.max(0, Math.min(rows.length - 1, ri + dr));
    return { row: rows[ri]?.id || row, col: cols[ci] || col };
  }
  function submitQuick() {
    if(!guard())return;
    const d = draft();
    const input = $('#quick-member');
    const member = person(d.memberId) && input?.value === label(person(d.memberId)) ? person(d.memberId) : selectedMember(input);
    const target=month().events.find(e=>e.id===d.beforeId),status=target&&Number(target.boss)===Number(d.boss)?{stage:target.stage}:api.getBosses().find(b=>b.id===Number(d.boss));
    const automatic=d.autoDamage&&!String(d.damage).trim()&&[2,3].includes(status?.stage);
    const damage = automatic?Number(month().bosses.find(b=>b.id===Number(d.boss)).hp[status.stage]):parseDamage(d.damage), bonus = Number(String(d.bonus || 0).replace(/,/g, ''));
    if (!member) { notify('참가 클랜원을 선택하세요. 이름 일부나 UID로 검색할 수 있습니다.'); focusQuick(); showPicker(input, 'quick'); return; }
    if (!Number.isFinite(damage)) { notify('피해량은 1 단위까지 정확한 숫자 또는 만·억 단위로 입력하세요. 소수점은 반올림하지 않습니다.'); return focusQuick('damage'); }
    if (!Number.isFinite(bonus)) { notify('가산점을 숫자로 입력하세요.'); return focusQuick('bonus'); }
    remember();
    const before = month().events.find(e => e.id === d.beforeId);
    const seq = before ? before.seq : Math.max(0, ...month().events.map(e => e.seq)) + 1;
    if (before) {month().events.forEach(e => { if (e.seq >= seq) e.seq++; });for(const boundary of month().dayBreaks||[])if(boundary.afterSeq>=seq)boundary.afterSeq++;}
    month().events.push({ id: makeId(), seq, day: Number(d.day), boss: Number(d.boss), memberId: member.id, member: label(member), recordedName: member.name, damage, damageMode:automatic?'max':'manual',carry: !!d.carry, bonus, memo: d.memo });
    Object.assign(d, { memberId: '', memberQuery: '', damage: '', carry: false, autoDamage:true, bonus: '0', memo: '', beforeId: null });
    state.page = 1;
    save('공격을 등록했습니다. 다음 이름을 입력하세요.', { quick: true });
  }
  function beginEdit(cell, initial = null) {if(!guard())return;
    if (state.editing) {
      const row = cell.dataset.row, col = cell.dataset.col;
      if (!commitEditing(null, false)) return;
      $('#wf-grid').innerHTML = gridView();
      cell = [...document.querySelectorAll('.edit-cell')].find(c => c.dataset.row === row && c.dataset.col === col);
      if (!cell) return;
    }
    closePicker();
    const event = month().events.find(e => e.id === cell.dataset.row), field = cell.dataset.col;
    if (!event) return;
    if (field === 'carry') { remember(); event.carry = !event.carry; return save('이월 사용 여부를 변경했습니다.', { row: event.id, col: field }); }
    state.editing = { event, field, cell, memberId: event.memberId };
    const value = initial === null ? String(field === 'member' ? event.member : event[field] ?? (field === 'role' ? '일반' : '')) : initial;
    let html;
    if (field === 'member') html = memberInput(value, 'wf-cell-editor');
    else if (field === 'boss') {
      const options = month().bosses.map(b => [b.id, `${b.id} · ${b.name}`]);
      html = `<select id="wf-cell-editor" aria-label="${field === 'boss' ? '보스 수정' : field === 'day' ? '일차 수정' : '역할 수정'}">${options.map(([v, t]) => `<option value="${X(v)}" ${String(v) === value ? 'selected' : ''}>${X(t)}</option>`).join('')}</select>`;
    } else html = `<input id="wf-cell-editor" aria-label="${field === 'damage' ? '피해량 수정' : field === 'bonus' ? '가산점 수정' : '메모 수정'}" inputmode="${['damage', 'bonus'].includes(field) ? 'decimal' : 'text'}" value="${X(value)}" autocomplete="off">`;
    cell.classList.add('is-editing'); cell.innerHTML = html;
    const input = $('#wf-cell-editor'); input.focus(); if (input.tagName === 'INPUT' && initial === null) input.select();
    if (field === 'member' && initial !== null) showPicker(input, 'grid');
  }
  function commitEditing(destination = null, redraw = true) {
    const editor = state.editing, input = $('#wf-cell-editor');
    if (!editor || !input) return true;
    const { event, field } = editor;
    let value = input.value;
    let member;
    if (field === 'member') {
      member = person(editor.memberId);
      if (!member || input.value !== label(member)) member = selectedMember(input, true);
      if (!member) { notify('클랜원을 선택하세요.'); input.focus(); return false; }
      value = member.id;
    } else if (field === 'damage') { value = parseDamage(value); if (!Number.isFinite(value)) { notify('피해량을 확인하세요.'); input.focus(); return false; } }
    else if (['boss', 'day', 'bonus'].includes(field)) { value = Number(value.replace(/,/g, '')); if (!Number.isFinite(value)) return false; }
    const old = field === 'member' ? event.memberId : event[field] ?? (field === 'role' ? '일반' : '');
    if (value !== old) {
      remember();
      if (field === 'member') { event.memberId = member.id; event.member = label(member); }
      else {event[field] = value;if(field==='damage')event.damageMode='manual';}
      syncRoster(app()); replay(month()); persist();
    }
    state.editing = null; closePicker();
    if (redraw) update(destination); return true;
  }
  function cancelEditing() { const edit = state.editing; if (edit) update({ row: edit.event.id, col: edit.field }); }
  function insertBefore(id) {if(!guard())return; draft().beforeId = id;draft().day=month().events.find(e=>e.id===id)?.day||recentDay(); update({ quick: true }); }
  function deleteRow(id) {if(!guard())return;
    const event = month().events.find(e => e.id === id); if (!event) return;
    if (!confirm(`#${event.seq} ${event.member}의 공격을 삭제할까요? 이후 HP·회차를 다시 계산합니다. 실행 취소로 되돌릴 수 있습니다.`)) return;
    remember(); month().events = month().events.filter(e => e.id !== id); save('공격 기록을 삭제했습니다.', { quick: true });
  }

  function finishDay(afterId=null){if(!guard())return;const row=afterId?month().events.find(e=>e.id===afterId):null,day=row?.day||recentDay();if(day>=maxDay())return notify('마지막 일차입니다.');const seq=row?.seq??Math.max(0,...month().events.map(e=>e.seq));if((month().dayBreaks||[]).some(b=>b.afterSeq===seq))return notify('이미 일차가 나뉜 위치입니다.');if(!confirm(`${day}일차를 마감하고 이후 기록을 ${day+1}일차로 나눌까요?`))return;remember();month().dayBreaks||=[];for(const b of month().dayBreaks)if(b.afterSeq>seq)b.nextDay++;month().dayBreaks.push({id:makeId(),afterSeq:seq,nextDay:day+1});draft().day=day+1;save('일차를 나눴습니다. 이후 입력은 다음 일차로 기록됩니다.',{quick:true});}
  function reopenDay(id) {
    if (!guard()) return;
    const closure = dayClosures(month()).find(b => b.id === id);
    if (!closure || !(closure.shift > 0)) return notify('이미 취소된 마감입니다.');
    const following = dayClosures(month()).some(b => b.afterSeq > closure.afterSeq);
    if (!confirm(`${closure.day}일차 마감을 취소할까요?\n공격 기록은 모두 유지되고 ${closure.nextDay}일차 기록은 ${closure.day}일차로 합쳐집니다.${following ? `\n이후 일차도 ${closure.shift}일씩 앞당겨집니다.` : ''}`)) return;
    remember();
    cancelDayClosure(month(), id);
    state.filterDay = 'all'; state.page = 1;
    save(`${closure.day}일차 마감을 취소했습니다. 공격 기록은 모두 유지했습니다.`);
  }
  function prepareMonth() {
    if (state.month !== app().active) {state.inputOpen=false; state.month = app().active; state.query = ''; state.filterDay = 'all'; state.page = 1; state.rosterEdit = null; }
  }
  function mount(page) {
    closePicker(); state.editing = null;
    prepareMonth();
    draft();
    const focus = state.restore; state.restore = null;
    if (focus?.roster) $('#roster-name')?.focus(); else if (focus) focusDestination(focus);
    
  }
  document.addEventListener('toggle',event=>{if(event.target.matches('.quick-panel'))state.inputOpen=event.target.open;},true);
  document.addEventListener('submit', event => {
    if (event.target.getAttribute('id') === 'wf-quick-form') { event.preventDefault(); closePicker(); submitQuick(); }
    
  });
  document.addEventListener('input', event => {
    const el = event.target;
    if (el.dataset.quick) {
      const key = el.dataset.quick;
      if (key === 'member') { draft().memberQuery = el.value; draft().memberId = ''; if (!event.isComposing) showPicker(el, 'quick'); }
      else if (!['carry','autoDamage'].includes(key)) draft()[key] = el.value;
    }
    if (el.id === 'wf-cell-editor' && state.editing?.field === 'member' && !event.isComposing) showPicker(el, 'grid');
    if (el.id === 'wf-log-search') { state.query = el.value; state.page = 1; $('#wf-grid').innerHTML = gridView(); }
    
  });
  document.addEventListener('compositionend', event => {
    if (event.target.id === 'quick-member') { draft().memberQuery = event.target.value; showPicker(event.target, 'quick'); }
    if (event.target.id === 'wf-cell-editor' && state.editing?.field === 'member') showPicker(event.target, 'grid');
  });
  document.addEventListener('change', event => {
    const el = event.target;
    if(el.dataset.carryRecord){if(!guard())return;const e=month().events.find(e=>e.id===el.dataset.carryRecord);if(e){remember();e.carry=el.checked;save('이월 사용을 변경했습니다.');}return;}
    if (el.dataset.quick) { draft()[el.dataset.quick] = el.type === 'checkbox' ? el.checked : ['day', 'boss'].includes(el.dataset.quick) ? Number(el.value) : el.value; }
    if (el.id === 'wf-sequence') { setSequenceVisible(el.checked); update(); }
    if (el.id === 'wf-details') { state.details = el.checked; update(); }
    if (el.id === 'wf-day-filter') { state.filterDay = el.value; state.page = 1; $('#wf-grid').innerHTML = gridView(); }
    
  });
  document.addEventListener('pointerdown', event => {
    if (event.target.closest('[data-picker-id]')) event.preventDefault();
    else if (state.picker && event.target !== state.picker.input) {
      if (state.picker.context === 'quick') {
        const member = selectedMember(state.picker.input);
        if (member) chooseMember(member);
      } else closePicker();
    }
  });
  document.addEventListener('click', event => {
    const pick = event.target.closest('[data-picker-id]');
    if (pick) { chooseMember(person(pick.dataset.pickerId), true); return; }
    const b = event.target.closest('[data-wf]'); if (!b) return;
    event.preventDefault();
    if (state.editing && b.dataset.wf !== 'undo' && !commitEditing(null, false)) return;
    switch (b.dataset.wf) {
      case 'next-day':finishDay();break;
      case 'split-day':finishDay(b.dataset.id);break;
      case 'reopen-day':reopenDay(b.dataset.id);break;
      case 'focus-quick': focusQuick(); break;
      case 'pick-boss': draft().boss=Number(b.dataset.id);update(state.inputOpen&&canEdit()?{quick:true,field:draft().memberId?'damage':'member'}:null);break;
      case 'undo': undo(); break;
      case 'previous': state.page = Math.max(1, state.page - 1); update(); break;
      case 'next': state.page++; update(); break;
      case 'cancel-insert': draft().beforeId = null; update({ quick: true }); break;
      case 'insert-row': insertBefore(b.dataset.id); break;
      case 'delete-row': deleteRow(b.dataset.id); break;
      
      
      
      
    }
  });
  document.addEventListener('dblclick', event => { const cell = event.target.closest('.edit-cell'); if (cell && !state.editing) beginEdit(cell); });
  document.addEventListener('focusout', event => {
    if (event.target.id === 'quick-member') {
      const p = selectedMember(event.target);
      if (p) { draft().memberId = p.id; draft().memberQuery = label(p); event.target.value = label(p); }
      closePicker();
    }
    if (event.target.id === 'wf-cell-editor' && state.editing) {
      const edit = state.editing;
      setTimeout(() => {
        if (state.editing !== edit || document.activeElement?.id === 'wf-cell-editor') return;
        const target = document.activeElement, cell = target?.closest('.edit-cell');
        const destination = cell ? { row: cell.dataset.row, col: cell.dataset.col } : target?.dataset.quick ? { quick: true, field: target.dataset.quick } : null;
        commitEditing(destination);
      }, 0);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.isComposing || event.keyCode === 229) return;
    const el = event.target, typing = el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && ($('#wf-grid') || $('#wf-roster-form')) && (!typing || (el.id === 'quick-member' && !el.value && !draft().damage))) { event.preventDefault(); undo(); return; }
    if (!typing && event.key === '/' && $('#quick-member')) { event.preventDefault(); focusQuick(); return; }
    if (event.ctrlKey && event.key === 'Enter' && $('#wf-quick-form')) { event.preventDefault(); closePicker(); submitQuick(); return; }
    if ((el.id === 'quick-member' || (el.id === 'wf-cell-editor' && state.editing?.field === 'member')) && state.picker) {
      const p = state.picker;
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); p.index = Math.max(0, Math.min(p.matches.length - 1, p.index + (event.key === 'ArrowDown' ? 1 : -1))); showPicker(el, p.context); return; }
      if (event.key === 'Escape') { event.preventDefault(); closePicker(); return; }
      if (event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey)) { const member = selectedMember(el, p.context !== 'quick'); if (member) { event.preventDefault(); chooseMember(member, true); return; } }
    }
    if (el.closest('#wf-quick-form')) {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (el.id === 'quick-member') { const member = selectedMember(el); if (member) { draft().memberId = member.id; draft().memberQuery = label(member); el.value = label(member); focusQuick('boss'); } else showPicker(el, 'quick'); }
        else if (el.id === 'quick-boss' || el.id === 'quick-day') focusQuick('damage');
        else submitQuick();
      }
      const fields = ['member', 'boss', 'damage', 'carry', 'bonus', 'memo'];
      if (['ArrowLeft', 'ArrowRight'].includes(event.key) && !event.altKey && !event.ctrlKey) {
        const left = event.key === 'ArrowLeft', key = el.dataset.quick, i = fields.indexOf(key);
        const canMove = el.tagName === 'SELECT' || el.type === 'checkbox' || (left ? el.selectionStart === 0 : el.selectionEnd === el.value.length);
        if (canMove && fields[i + (left ? -1 : 1)]) { event.preventDefault(); focusQuick(fields[i + (left ? -1 : 1)]); }
      }
      return;
    }
    if (el.id === 'wf-cell-editor' && state.editing) {
      const edit = state.editing;
      if (event.key === 'Escape') { event.preventDefault(); cancelEditing(); return; }
      if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); commitEditing(event.key === 'Enter' ? neighbor(edit.event.id, edit.field, event.shiftKey ? -1 : 1) : neighbor(edit.event.id, edit.field, 0, event.shiftKey ? -1 : 1)); return; }
      if (event.altKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); commitEditing(neighbor(edit.event.id, edit.field, event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0, event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0)); return; }
      return;
    }
    const cell = el.closest('.edit-cell');
    if (!cell) return;
    const row = cell.dataset.row, col = cell.dataset.col;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.key)) {
      event.preventDefault();
      const direction = neighbor(row, col, event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0, event.key === 'ArrowLeft' || (event.key === 'Tab' && event.shiftKey) ? -1 : event.key === 'ArrowRight' || event.key === 'Tab' ? 1 : 0);
      focusDestination(direction); return;
    }
    if (['Enter', 'F2'].includes(event.key) || (event.key === ' ' && col === 'carry')) { event.preventDefault(); beginEdit(cell); return; }
    if (event.key === 'Insert') { event.preventDefault(); insertBefore(row); return; }
    if (event.key === 'Delete') { event.preventDefault(); deleteRow(row); return; }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && col !== 'carry') { event.preventDefault(); beginEdit(cell, event.key); }
  });
  window.addEventListener('scroll', event => { if (state.picker && !event.target.closest?.('#wf-member-list')) closePicker(); }, true);
  return { battleView, mount, rememberExternal:()=>remember(), clearUndo:()=>{state.undo=[];}, hasDraft: () => { const d = draft(); return canEdit()&&!!(d.damage || d.memberQuery || state.editing); }, beforeNavigate: () => !state.editing || commitEditing(null, false), afterMonthChange: () => { closePicker(); state.rosterEdit = null; }, activeParticipants: () => participants(draft().day) };
}
