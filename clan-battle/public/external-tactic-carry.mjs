const STORAGE_KEY = 'nyang-external-tactic-carry:v1';
// Consume URLs before matching time references so video addresses remain intact.
const TIME_REFERENCE = /(?:[a-z][a-z\d+.-]*:\/\/|www\.|youtu\.be\/)[^\s<>"']+|(?<![\d.:：])(\d{1,2})([:：])([0-5]\d)(?![\d.:：])|(?<![\d.:：])(\d{1,3})([ \u00a0]*초)/gi;
const SECOND_REFERENCE_CONTEXT = /^[ \u00a0]*(?:(?:가|는|이|도)[ \u00a0]*)?(?:아님|아니|아닌|아냐|아뇨|말고|대신|시점|타이밍|무렵|쯤|즈음|때|되자|되면|되는|될|남았|남은|남으면)/;

export function parseExternalCarryTime(value, max = 90, min = 0) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d+):([0-5]\d)$/);
  const seconds = /^\d+$/.test(text) ? Number(text) : match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
  return Number.isSafeInteger(seconds) && seconds >= min && seconds <= max ? seconds : null;
}

const clock = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// Clock times anywhere in the text are battle timestamps, including parenthetical
// warnings and both ends of a range. Second counts need an explicit timestamp
// context (e.g. "70초 아님"); durations such as "1초 후" remain unchanged.
export function shiftExternalTacticTimes(source, originalSeconds, carrySeconds) {
  if (!Number.isSafeInteger(originalSeconds) || originalSeconds <= 0 || !Number.isSafeInteger(carrySeconds) || carrySeconds < 0 || carrySeconds > originalSeconds) {
    throw new RangeError('원본 전투시간과 이월 시간을 확인하세요.');
  }
  const delta = originalSeconds - carrySeconds;
  let matched = 0, negative = 0, outside = 0;
  const text = String(source).replace(TIME_REFERENCE, (whole, minutes, colon, seconds, secondCount, unit, offset, input) => {
    if (minutes === undefined && secondCount === undefined) return whole;
    if (secondCount !== undefined && !SECOND_REFERENCE_CONTEXT.test(input.slice(offset + whole.length))) return whole;
    // A hyphen directly between two clock times is a range, not a negative sign.
    if (input[offset - 1] === '-' && !/\d[:：][0-5]\d[ \u00a0]*$/.test(input.slice(0, offset - 1))) return whole;
    const time = secondCount === undefined ? Number(minutes) * 60 + Number(seconds) : Number(secondCount);
    if (time > originalSeconds) {outside++;return whole;}
    matched++;
    const shifted = time - delta, absolute = Math.abs(shifted);
    if (shifted < 0) negative++;
    if (delta === 0) return whole;
    if (secondCount !== undefined) return (shifted < 0 ? '-' : '') + (secondCount.startsWith('0') ? String(absolute).padStart(secondCount.length, '0') : String(absolute)) + unit;
    return (shifted < 0 ? '-' : '') + String(Math.floor(absolute / 60)).padStart(minutes.length, '0') + colon + String(absolute % 60).padStart(2, '0');
  });
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
    status.textContent = calculated.error || (!hasSource ? '원문을 붙여넣으면 계산 결과가 표시됩니다.' : !calculated.matched ? '계산할 시간을 찾지 못했습니다. 1:17 또는 70초 아님 같은 전투 시점 표기를 확인하세요.' : `${clock(calculated.originalSeconds)} → ${clock(calculated.carrySeconds)} · 시간 ${calculated.matched}개 계산`);
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
    return `<section class="panel tw-external" aria-labelledby="tw-external-heading"><div class="tw-external-head"><div><h2 id="tw-external-heading">외부 택틱 이월 계산</h2><p class="muted small">복사한 택틱을 붙여넣으세요. 본문·괄호·시간 범위의 전투 시점을 함께 계산합니다.</p></div><div class="field tw-external-base"><label for="tw-external-base">원본 전투시간</label><input id="tw-external-base" inputmode="numeric" value="${X(data.original)}" placeholder="1:30 / 90" aria-describedby="tw-external-status"></div></div><div class="tw-external-columns"><div class="tw-external-column"><label for="tw-external-source">붙여넣은 원문</label><textarea id="tw-external-source" spellcheck="false" autocomplete="off" placeholder="1:17 네네카 UB\n0:53 캬루 UB\n0:20 전체 SET" aria-describedby="tw-external-help"></textarea></div><div class="tw-external-column"><div class="tw-external-result-head"><label for="tw-external-result">계산 결과</label><button type="button" class="btn sm primary" data-tw="external-copy" disabled>결과 복사</button></div><textarea id="tw-external-result" readonly spellcheck="false" aria-describedby="tw-external-status tw-external-note" placeholder="이월 시간에 맞춘 결과"></textarea></div></div><div id="tw-external-status" class="tw-external-status" role="status" aria-live="polite"></div><p id="tw-external-note" class="tw-external-note small" hidden></p><p id="tw-external-help" class="muted small tw-external-help">문장·캐릭터명·SET 값·줄바꿈은 그대로 유지합니다. 최근 입력은 이 브라우저에 저장됩니다.</p></section>`;
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
