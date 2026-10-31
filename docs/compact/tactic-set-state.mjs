// Shared SET interpreter for the tactic workspace and external review.
const norm = value => String(value ?? '').normalize('NFKC');
const escapeRegex = value => value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
const six = value => Array.from({length: 6}, (_, i) => value?.[i] === true || value?.[i] === 'TRUE');
const FULL = /(?:전부|전원|전체|모두|全員|全员|全体|全部|全)/u;
const AUTO = /(?<![\p{L}\p{N}])(?:AUTO|오토)(?![\p{L}\p{N}])/iu;
const TRIGGER = /(?:후|다음|이후|직후)(?![\p{L}\p{N}])\s*/gu;
const ACTION = /(?<![\p{L}\p{N}])(?:SET\s*(?:해제|OFF)|한번만|ON|OFF|SET|오프|온|해제|解除|切|켜기|끄기)(?![\p{L}\p{N}])/giu;

function characterTokens(characters = [], catalog = []) {
  const entries = new Map();
  const list = characters.slice(0, 5).map(norm);
  for (let i = 0; i < list.length; i++) {
    const name = list[i];
    if (!name) continue;
    const record = catalog.find(c => norm(c?.name) === name || c?.aliases?.some(a => norm(a) === name));
    const aliases = [name, ...(record?.aliases || []).map(norm)];
    for (const length of [2, 3]) {
      if (name.length > length) {
        const short = name.slice(0, length);
        if (list.filter(other => other.startsWith(short)).length === 1) aliases.push(short);
      }
    }
    for (const alias of aliases) {
      if (!alias) continue;
      if (!entries.has(alias)) entries.set(alias, new Set());
      entries.get(alias).add(i);
    }
  }
  const tokens = [...entries].filter(([, indices]) => indices.size === 1).map(([name, indices]) => [name, [...indices][0]]);
  tokens.sort((a, b) => b[0].length - a[0].length);
  return {tokens, pattern: tokens.length
    ? new RegExp('(?<![\\p{L}\\p{N}])(' + tokens.map(([name]) => escapeRegex(name)).join('|') + ')(?![\\p{L}\\p{N}])', 'giu')
    : null};
}

function namedSlots(fragment, matcher) {
  if (!matcher.pattern) return [];
  const index = new Map(matcher.tokens);
  const result = new Set();
  for (const hit of norm(fragment).matchAll(matcher.pattern)) result.add(index.get(hit[1]));
  return [...result].filter(Number.isInteger);
}


// Preserve the five SET flags encoded by game/foreign-TL O/X snapshots.
// ASCII 0/1 only count inside brackets to avoid matching time/damage numbers.
function snapshotState(value) {
  const source=norm(value).replace(/\uFE0F/g,'');
  const bracketed=source.match(/\[\s*([O〇○◯⭕Xx×✕✖❌ー\-01]{5,6})\s*\]/iu);
  const bare=bracketed?null:source.match(/(?<![\p{L}\p{N}])([O〇○◯⭕Xx×✕✖❌ー\-]{5,6})(?![\p{L}\p{N}])/iu);
  const flags=(bracketed||bare)?.[1];
  return flags?[...flags].map(c=>/[O〇○◯⭕1]/iu.test(c)):null;
}
function normalizedCommand(value) {
  return norm(value)
    .replace(/(전부|전원|전체|모두|全員|全员|全体|全部|全)\s*(SET|ON|OFF)(?![A-Za-z])/giu,'$1 $2')
    .replace(/(?:시작|초동|初動|开始|開幕)\s*UB\s*SET\s*[:：]\s*(全员|全員|전부|전원)/giu,'$1 SET');
}
function hasActionTarget(text,matcher) {
  const source=normalizedCommand(text);
  let end=0;
  for(const match of source.matchAll(ACTION)) {
    const action=match[0].replace(/\s+/g,'').toUpperCase();
    let subject=source.slice(end,match.index);
    end=match.index+match[0].length;
    if(action==='한번만')continue;
    const triggers=[...subject.matchAll(TRIGGER)];
    if(triggers.length)subject=subject.slice(triggers.at(-1).index+triggers.at(-1)[0].length);
    if(AUTO.test(subject)||FULL.test(subject)||namedSlots(subject,matcher).length)return true;
  }
  return false;
}

export function commandState(text, previous = [], characters = [], catalog = []) {
  const state = six(previous);
  const source = normalizedCommand(text);
  const snapshot=snapshotState(source);
  if(snapshot)for(let i=0;i<snapshot.length;i++)state[i]=snapshot[i];
  const matcher = characterTokens(characters, catalog);
  let end = 0;
  for (const match of source.matchAll(ACTION)) {
    let subject = source.slice(end, match.index);
    const action = match[0].replace(/\s+/g, '').toUpperCase();
    end = match.index + match[0].length;
    // The actor preceding "후" is a trigger, not a SET target.
    const triggers = [...subject.matchAll(TRIGGER)];
    if (triggers.length) subject = subject.slice(triggers.at(-1).index + triggers.at(-1)[0].length);
    const exceptions = subject.includes('제외') ? namedSlots(subject, matcher) : [];
    const wholeParty = FULL.test(subject) || exceptions.length > 0;
    const auto = AUTO.test(subject);
    if (action === '한번만') continue; // A single UB does not change the persistent SET flag.
    const enabled = action === 'ON' || action === 'SET' || action === '온' || action === '켜기';
    if (auto) state[5] = enabled;
    if (wholeParty) {
      // Also support "전부 OFF (캬루 제외)".
      const after = source.slice(end).match(/^\s*[(（]([^()（）]{1,100}제외[^()（）]{0,40})[)）]/u);
      if (after) exceptions.push(...namedSlots(after[1], matcher));
      for (let i = 0; i < 5; i++) if (!exceptions.includes(i)) state[i] = enabled;
    } else {
      for (const slot of namedSlots(subject, matcher)) state[slot] = enabled;
    }
  }
  return state;
}


// Explicit re-interpretation is conservative: a hand-confirmed SET snapshot
// must not be erased just because its descriptive instruction has no ON/OFF.
// Other rows are recalculated in order from the resulting preceding state.
export function restateSetRows(rows, characters = [], catalog = []) {
  const matcher=characterTokens(characters,catalog);
  let recalculated=0,preserved=0;
  for(let i=0;i<rows.length;i++){
    const row=rows[i],before=i>0?six(rows[i-1].checked):Array(6).fill(false);
    const inline=snapshotState(row.text);
    const savedSnapshot=snapshotState(row.sourceSnapshot);
    const actionable=hasActionTarget(row.text,matcher);
    if(!inline&&!actionable){
      if(savedSnapshot){
        const base=[...savedSnapshot.slice(0,5),before[5]];
        if(savedSnapshot.length===6)base[5]=savedSnapshot[5];
        row.checked=base;
        row.manualChecks=true;
        preserved++;
        continue;
      }
      if(row.manualChecks===true||(i===0&&six(row.checked).some(Boolean))){
        preserved++;
        continue;
      }
    }
    const seed= savedSnapshot
      ? [...savedSnapshot.slice(0,5),savedSnapshot.length===6?savedSnapshot[5]:before[5]]
      : i===0 && row.manualChecks===true && !inline
          && AUTO.test(norm(row.text)) && !FULL.test(norm(row.text))
          && !/제외/.test(norm(row.text)) && namedSlots(norm(row.text),matcher).length===0
        ? six(row.checked) : before;
    row.checked=commandState(row.text,seed,characters,catalog);
    row.manualChecks=false;
    recalculated++;
  }
  return {recalculated,preserved};
}

export function recalculateSetRows(rows, characters = [], catalog = [], start = 0) {
  for (let i = Math.max(0, start); i < rows.length; i++) {
    if (rows[i].manualChecks !== true) rows[i].checked = commandState(rows[i].text, rows[i - 1]?.checked, characters, catalog);
  }
  return rows;
}

// Older clients saved the named exception as the only SET target. Repair only
// explicitly automatic rows, then propagate their corrected state downstream.
export function repairExcludedSetRows(rows, characters = [], catalog = []) {
  const matcher = characterTokens(characters, catalog);
  let repairing = false, changed = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.manualChecks !== false) continue;
    const source = norm(row.text);
    if (!repairing) {
      const exclusion = source.match(/([^,，;；\n]*?)제외\s*(?:전부\s*)?(?:SET|ON|OFF|온|오프)(?![\p{L}\p{N}])/iu);
      if (!exclusion || !namedSlots(exclusion[1], matcher).length) continue;
      repairing = true;
    }
    const next = commandState(row.text, rows[i - 1]?.checked, characters, catalog);
    if (next.every((value, slot) => value === six(row.checked)[slot])) continue;
    row.checked = next;
    changed++;
  }
  return changed;
}
