const STORAGE_KEY = 'nyang-external-tactic-carry:v1';
const LEADING_TIME = /^([ \u00a0]*(?:(?:[-*•·●▶→]|\d+[.)])[ \u00a0]+)?(?:["'`\[（(【][ \u00a0]*)?)(\d{1,2})([:：])([0-5]\d)(?![\d:：])/;
const RANGE_TIME = /^([ \u00a0]*(?:[\]）)】][ \u00a0]*)?(?:[~〜～–—\-/])[ \u00a0]*(?:[\[（(【][ \u00a0]*)?)(\d{1,2})([:：])([0-5]\d)(?![\d:：])/;

export function parseExternalCarryTime(value, max = 90, min = 0) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d+):([0-5]\d)$/);
  const seconds = /^\d+$/.test(text) ? Number(text) : match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
  return Number.isSafeInteger(seconds) && seconds >= min && seconds <= max ? seconds : null;
}

const clock = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// Only leading timeline times (including ranges and spreadsheet cells) are edited.
// Everything between them, including tabs, line endings and SET values, is copied verbatim.
export function shiftExternalTacticTimes(source, originalSeconds, carrySeconds) {
  if (!Number.isSafeInteger(originalSeconds) || originalSeconds <= 0 || !Number.isSafeInteger(carrySeconds) || carrySeconds < 0 || carrySeconds > originalSeconds) {
    throw new RangeError('원본 전투시간과 이월 시간을 확인하세요.');
  }
  const delta = originalSeconds - carrySeconds;
  let matched = 0, negative = 0, outside = 0;
  const text = String(source).split(/([\r\n\t]+)/).map(cell => {
    if (!cell || /^[\r\n\t]+$/.test(cell)) return cell;
    let match = LEADING_TIME.exec(cell), cursor = 0, output = '';
    while (match) {
      const [whole, prefix, minutes, colon, seconds] = match;
      const time = Number(minutes) * 60 + Number(seconds);
      let next = minutes + colon + seconds;
      if (time > originalSeconds) outside++;
      else {
        matched++;
        const shifted = time - delta, absolute = Math.abs(shifted);
        if (shifted < 0) negative++;
        next = (shifted < 0 ? '-' : '') + String(Math.floor(absolute / 60)).padStart(minutes.length, '0') + colon + String(absolute % 60).padStart(2, '0');
      }
      output += prefix + next;
      cursor += whole.length;
      match = RANGE_TIME.exec(cell.slice(cursor));
    }
    return output + cell.slice(cursor);
  }).join('');
  return {text, matched, negative, outside, delta};
}

export function createExternalTacticCarry({baseSeconds, escapeHtml: X, copyText, notify}) {
  let draft = null;
  const $ = selector => document.querySelector(selector);
  function load() {
    if (draft) return draft;
    const initial = clock(baseSeconds());
    draft = {source: '', original: initial, carry: initial};
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      for (const key of ['source', 'original', 'carry']) if (typeof saved?.[key] === 'string') draft[key] = saved[key];
    } catch {}
    return draft;
  }
  function save() {
    try {localStorage.setItem(STORAGE_KEY, JSON.stringify(load()));} catch {}
  }
  function result() {
    const {source, original, carry} = load();
    const originalSeconds = parseExternalCarryTime(original, baseSeconds(), 1);
    if (originalSeconds === null) return {error: `원본 전투시간을 1~${baseSeconds()}초 또는 1:30 형식으로 입력하세요.`};
    const carrySeconds = parseExternalCarryTime(carry, originalSeconds);
    if (carrySeconds === null) return {error: `이월 받은 시간을 0~${originalSeconds}초 또는 1:05 형식으로 입력하세요.`};
    return {...shiftExternalTacticTimes(source, originalSeconds, carrySeconds), originalSeconds, carrySeconds};
  }
  function refresh() {
    const output = $('#tw-external-result');
    if (!output) return;
    const calculated = result(), hasSource = !!load().source;
    output.value = calculated.error ? '' : calculated.text;
    const status = $('#tw-external-status');
    status.textContent = calculated.error || (!hasSource ? '원문을 붙여넣으면 계산 결과가 표시됩니다.' : !calculated.matched ? '계산할 시간을 찾지 못했습니다. 행이나 셀 앞의 1:17 형식을 확인하세요.' : `${clock(calculated.originalSeconds)} → ${clock(calculated.carrySeconds)} · 시간 ${calculated.matched}개 계산`);
    status.dataset.error = String(!!calculated.error);
    const notes = [];
    if (calculated.negative) notes.push(`전투시간을 벗어난 시간 ${calculated.negative}개는 음수로 표시했습니다. 해당 행도 결과와 복사에 포함됩니다.`);
    if (calculated.outside) notes.push(`원본 전투시간보다 큰 시간 ${calculated.outside}개는 그대로 두었습니다.`);
    const note = $('#tw-external-note');
    note.hidden = !notes.length;
    note.textContent = notes.join(' ');
    $('[data-tw="external-copy"]').disabled = !!calculated.error || !hasSource;
    const reset = $('[data-tw="original"]');
    if (reset) {
      reset.disabled = !calculated.error && calculated.delta === 0;
      reset.title = `원본 ${load().original}로 초기화`;
      reset.setAttribute('aria-label', reset.title);
    }
  }
  function view() {
    const data = load();
    return `<section class="panel tw-external" aria-labelledby="tw-external-heading"><div class="tw-external-head"><div><h2 id="tw-external-heading">외부 택틱 이월 계산</h2><p class="muted small">복사한 택틱을 붙여넣으세요. 행이나 셀 앞의 1:17 형식 시간만 계산합니다.</p></div><div class="field tw-external-base"><label for="tw-external-base">원본 전투시간</label><input id="tw-external-base" inputmode="numeric" value="${X(data.original)}" placeholder="1:30 / 90" aria-describedby="tw-external-status"></div></div><div class="tw-external-columns"><div class="tw-external-column"><label for="tw-external-source">붙여넣은 원문</label><textarea id="tw-external-source" spellcheck="false" autocomplete="off" placeholder="1:17 네네카 UB\n0:53 캬루 UB\n0:20 전체 SET" aria-describedby="tw-external-help"></textarea></div><div class="tw-external-column"><div class="tw-external-result-head"><label for="tw-external-result">계산 결과</label><button type="button" class="btn sm primary" data-tw="external-copy" disabled>결과 복사</button></div><textarea id="tw-external-result" readonly spellcheck="false" aria-describedby="tw-external-status tw-external-note" placeholder="이월 시간에 맞춘 결과"></textarea></div></div><div id="tw-external-status" class="tw-external-status" role="status" aria-live="polite"></div><p id="tw-external-note" class="tw-external-note small" hidden></p><p id="tw-external-help" class="muted small tw-external-help">문장·캐릭터명·SET 값·줄바꿈은 그대로 유지합니다. 최근 입력은 이 브라우저에 저장됩니다.</p></section>`;
  }
  function mount() {
    const input = $('#tw-external-source');
    if (input) input.value = load().source;
    refresh();
  }
  function input(element) {
    const key = {'tw-external-source': 'source', 'tw-external-base': 'original', 'tw-carry': 'carry'}[element.id];
    if (!key) return false;
    load()[key] = element.value;
    save();
    refresh();
    return true;
  }
  function apply(value) {
    load().carry = String(value);
    const calculated = result();
    if (!calculated.error) {
      load().carry = clock(calculated.carrySeconds);
      if ($('#tw-carry')) $('#tw-carry').value = load().carry;
    }
    save();
    refresh();
    if (calculated.error) notify(calculated.error);
    return !calculated.error;
  }
  function reset() {
    load().carry = load().original;
    if ($('#tw-carry')) $('#tw-carry').value = load().carry;
    save();
    refresh();
  }
  function copy() {
    const calculated = result();
    if (calculated.error) return notify(calculated.error);
    if (load().source) copyText(calculated.text);
  }
  return {view, mount, input, apply, reset, copy, carryValue: () => load().carry, originalValue: () => load().original, isOriginal: () => result().delta === 0};
}
