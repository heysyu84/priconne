// Shared SET interpreter for the tactic workspace and external review.
const norm = value => String(value ?? '').normalize('NFKC');
const escapeRegex = value => value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
const six = value => Array.from({length: 6}, (_, i) => value?.[i] === true || value?.[i] === 'TRUE');
const FULL = /(?:전부|전원|전체|모두|全員|全员|全体|全部)/u;
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

export function commandState(text, previous = [], characters = [], catalog = []) {
  const state = six(previous);
  const source = norm(text);
  const matcher = characterTokens(characters, catalog);
  let end = 0;
  for (const match of source.matchAll(ACTION)) {
    let subject = source.slice(end, match.index);
    const action = match[0].replace(/\s+/g, '').toUpperCase();
    end = match.index + match[0].length;
    // The actor preceding "후" is a trigger, not a SET target.
    const triggers = [...subject.matchAll(TRIGGER)];
    if (triggers.length) subject = subject.slice(triggers.at(-1).index + triggers.at(-1)[0].length);
    const wholeParty = FULL.test(subject);
    const auto = AUTO.test(subject);
    if (action === '한번만') continue; // A single UB does not change the persistent SET flag.
    const enabled = action === 'ON' || action === 'SET' || action === '온' || action === '켜기';
    if (auto) state[5] = enabled;
    if (wholeParty) {
      const exceptions = subject.includes('제외') ? namedSlots(subject, matcher) : [];
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

export function recalculateSetRows(rows, characters = [], catalog = [], start = 0) {
  for (let i = Math.max(0, start); i < rows.length; i++) {
    if (rows[i].manualChecks !== true) rows[i].checked = commandState(rows[i].text, rows[i - 1]?.checked, characters, catalog);
  }
  return rows;
}
