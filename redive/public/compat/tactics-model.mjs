import { makeId } from './roster.mjs';
import { shiftTimeline } from './engine.mjs';
import {commandState,recalculateSetRows,restateSetRows} from '../tactic-set-state.mjs?v=20261031-set32fix01';
export {commandState};

export const CARRY_GROUP = '이월 택틱';
export const GROUPS = ['택틱정리', '타비비토', CARRY_GROUP];
export const carryTacticsVisible = month => month?.options?.showCarryTactics !== false;
export const tacticGroupsFor = month => GROUPS.filter(group => group !== CARRY_GROUP || carryTacticsVisible(month));
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const groupOf = tactic => tactic.group || (GROUPS.includes(tactic.source) ? tactic.source : GROUPS[0]);
export const checkedSix = checked => Array.from({length:6}, (_, i) => checked?.[i] === true || checked?.[i] === 'TRUE');
export const titleFor = tactic => `${tactic.boss ? tactic.boss+'넴' : '보스 미분류'} ${tactic.characters.map(c=>c||'미선택').join(' ')} 성급 ${tactic.stars.map(s=>s||'?').join('')}, 손컨 ${tactic.manualCount === '' || tactic.manualCount == null ? '—' : tactic.manualCount}, TP ${tactic.tp || '—'}, 기대딜 ${tactic.expectedDamage || '미입력'}`;
export function compareTactics(a, b) {
  const boss = tactic => Number(tactic.boss) > 0 ? Number(tactic.boss) : Infinity;
  if (boss(a) !== boss(b)) return boss(a) < boss(b) ? -1 : 1;
  const damage = tactic => {
    const raw = String(tactic.expectedDamage ?? '').replace(/[,\s]/g, '');
    return Math.max(...raw.split(/[~～]/).map(part => {
      const rich = part.match(/^(?:(\d+(?:\.\d+)?)억)?(?:(\d+(?:\.\d+)?)만)?$/);
      if (rich && (rich[1] || rich[2])) return Number(rich[1] || 0) + Number(rich[2] || 0) / 10000;
      const simple = part.match(/^(\d+(?:\.\d+)?)(억|만)?$/);
      return simple ? Number(simple[1]) * (simple[2] === '만' ? 0.0001 : 1) : -Infinity;
    }));
  };
  const left = damage(a), right = damage(b);
  return left === right ? 0 : left > right ? -1 : 1;
}
export const newRow = (checked = [], text = '') => ({id:makeId(), text, checked:checkedSix(checked), manualChecks:false});
// Editing the instruction text switches only that row back to automatic SET mode.
// A checkbox-only edit remains a manual override until its instruction text changes.
export function replaceTacticRowText(row, text) {
  row.text = text;
  delete row.runs;
  row.manualChecks = false;
}

export function ensureTactics(app, metadata = {}, rowFormats = {}) {
  let changed = false;
  for (const [key, month] of Object.entries(app.months)) {
    // Import current-month carry tactics exactly once per ID while respecting edits and deletions.
    if (key === '2026-10' && Array.isArray(metadata.carryTactics)) {
      const purged = new Set(Array.isArray(month.purgedTactics) ? month.purgedTactics : []);
      const known = new Set((month.tactics || []).map(t => String(t.id)));
      for (const seed of metadata.carryTactics) {
        if (seed.month !== key || known.has(seed.id) || purged.has(seed.id)) continue;
        const {month: _, ...tactic} = seed;
        month.tactics.push(structuredClone(tactic));
        known.add(seed.id);
        changed = true;
      }
    }
    // Apply the October 2026 maximum-rarity and Lyrical-name correction once to
    // records already stored by the live app, not only to newly imported seeds.
    // Other tactic groups, deletions, notes, and manually edited steps stay intact.
    if (key === '2026-10' && Array.isArray(metadata.carryTactics) && Number(month.carryStarsRevision || 0) < 1) {
      const carrySeeds = new Map(metadata.carryTactics.map(t => [String(t.id), t]));
      for (const t of month.tactics || []) {
        const seed = carrySeeds.get(String(t.id));
        if (!seed || groupOf(t) !== CARRY_GROUP) continue;
        const normalized = (t.characters || []).map(name => name === '페리컬' ? '리리컬' : name);
        if (JSON.stringify(normalized) !== JSON.stringify(t.characters)) { t.characters = normalized; changed = true; }
        // Only apply the seed rarity when the character in every slot is still
        // the original one. This avoids assigning a different character's stars
        // to a lineup that the site administrator has already customized.
        if (normalized.length === 5 && normalized.every((name, i) => name === seed.characters[i])
            && JSON.stringify(t.stars) !== JSON.stringify(seed.stars)) {
          t.stars = [...seed.stars];
          changed = true;
        }
        for (const row of t.rows || []) {
          for (const field of ['text', 'sourceText']) {
            if (typeof row[field] === 'string' && row[field].includes('페리컬')) {
              row[field] = row[field].replace(/페리컬/g, '리리컬');
              changed = true;
            }
          }
          if (Array.isArray(row.runs)) for (const run of row.runs) {
            if (typeof run.text === 'string' && run.text.includes('페리컬')) {
              run.text = run.text.replace(/페리컬/g, '리리컬');
              changed = true;
            }
          }
        }
        for (const field of ['note', 'originalTitle']) {
          if (typeof t[field] === 'string' && t[field].includes('페리컬')) {
            t[field] = t[field].replace(/페리컬/g, '리리컬');
            changed = true;
          }
        }
        const revisedTitle = titleFor(t);
        if (t.title !== revisedTitle) { t.title = revisedTitle; changed = true; }
      }
      month.carryStarsRevision = 1;
      changed = true;
    }
    // Fix the October carry sheet's explicit B-to-F lineup order. The original
    // import reversed it, so reverse character slots, stars, and the five SET
    // checkboxes together. AUTO is the sixth column and must not move.
    // Apply this only to known imported IDs whose lineup is still in old order.
    if (key === '2026-10' && Array.isArray(metadata.carryTactics) && Number(month.carryLineupRevision || 0) < 1) {
      const byId = new Map(metadata.carryTactics.map(seed => [String(seed.id), seed]));
      const startInstruction = (characters, checked) => {
        const auto = checked?.[5] ? 'AUTO ON' : 'AUTO OFF';
        const setNames = characters.filter((_, index) => checked?.[index]);
        return auto + (setNames.length ? ', ' + setNames.join(', ') + ' SET' : '');
      };
      for (const tactic of month.tactics || []) {
        const corrected = byId.get(String(tactic.id));
        if (!corrected || groupOf(tactic) !== CARRY_GROUP) continue;
        const oldOrder = [...corrected.characters].reverse();
        const currentOrder = (tactic.characters || []).map(name => name === '페리컬' ? '리리컬' : name);
        if (currentOrder.length !== 5 || !currentOrder.every((name, index) => name === oldOrder[index])) continue;
        const setup = (tactic.rows || []).find(row => row.id === tactic.id + '-start');
        const previousInstruction = setup ? startInstruction(currentOrder, setup.checked) : '';
        tactic.characters = [...corrected.characters];
        tactic.stars = [...corrected.stars];
        for (const row of tactic.rows || []) {
          if (!Array.isArray(row.checked) || row.checked.length < 6) continue;
          row.checked = [...row.checked.slice(0, 5).reverse(), ...row.checked.slice(5)];
        }
        if (setup && setup.text === previousInstruction) {
          setup.text = startInstruction(tactic.characters, setup.checked);
          delete setup.runs;
        }
        tactic.title = titleFor(tactic);
        changed = true;
      }
      month.carryLineupRevision = 1;
      changed = true;
    }
    // Apply the right-to-left command order and empty-hand-control default to
    // existing 2~5넴 carry tactics; preserve 1넴 and user-edited rows.
    if (key === '2026-10' && Array.isArray(metadata.carryTactics) && Number(month.carryCommandRevision || 0) < 1) {
      const byId = new Map(metadata.carryTactics.filter(seed => Number(seed.boss) >= 2 && Number(seed.boss) <= 5)
        .map(seed => [String(seed.id), seed]));
      for (const tactic of month.tactics || []) {
        const seed = byId.get(String(tactic.id));
        if (!seed || groupOf(tactic) !== CARRY_GROUP || Number(tactic.boss) !== Number(seed.boss)) continue;
        let updated = false;
        if (tactic.manualCount === '' || tactic.manualCount == null) {
          tactic.manualCount = '0';
          updated = true;
        }
        const sameLineup = Array.isArray(tactic.characters) && tactic.characters.length === 5
          && tactic.characters.every((name, i) => name === seed.characters[i]);
        if (sameLineup) {
          const referenceRows = new Map((seed.rows || []).map(row => [String(row.id), row]));
          for (const row of tactic.rows || []) {
            const reference = referenceRows.get(String(row.id));
            if (!reference?.preRightToLeftText || row.text !== reference.preRightToLeftText) continue;
            row.text = reference.text;
            delete row.runs;
            updated = true;
          }
        }
        if (updated) {
          tactic.title = titleFor(tactic);
          changed = true;
        }
      }
      month.carryCommandRevision = 1;
      changed = true;
    }
    // Use '후' after the left-side timing trigger in October carry tactics.
    // Keep 1넴, changed character lists and manually edited steps untouched.
    if (key === '2026-10' && Array.isArray(metadata.carryTactics) && Number(month.carryAfterRevision || 0) < 1) {
      const references = new Map(metadata.carryTactics
        .filter(t => Number(t.boss) >= 2 && Number(t.boss) <= 5)
        .map(t => [String(t.id), t]));
      for (const tactic of month.tactics || []) {
        const reference = references.get(String(tactic.id));
        if (!reference || groupOf(tactic) !== CARRY_GROUP || Number(tactic.boss) !== Number(reference.boss)) continue;
        if (!Array.isArray(tactic.characters) || tactic.characters.length !== 5
            || !tactic.characters.every((name, index) => name === reference.characters[index])) continue;
        const steps = new Map((reference.rows || []).map(row => [String(row.id), row]));
        let updated = false;
        for (const step of tactic.rows || []) {
          const referenceStep = steps.get(String(step.id));
          if (!referenceStep?.preAfterTriggerText || step.text !== referenceStep.preAfterTriggerText) continue;
          step.text = referenceStep.text;
          delete step.runs;
          updated = true;
        }
        if (updated) { tactic.title = titleFor(tactic); changed = true; }
      }
      month.carryAfterRevision = 1;
      changed = true;
    }
    // Keep the October carry tactic intermediate-damage suffix in parentheses
    // and use commas for listed characters (preserving explicit action order).
    // Only revise exactly matching imported rows from 2~5넴. User edits and
    // all 1넴 entries are intentionally left untouched.
    if (key === '2026-10' && Array.isArray(metadata.carryTactics) && Number(month.carryDamageCommaRevision || 0) < 1) {
      const byId = new Map(metadata.carryTactics
        .filter(t => Number(t.boss) >= 2 && Number(t.boss) <= 5)
        .map(t => [String(t.id), t]));
      for (const tactic of month.tactics || []) {
        const seed = byId.get(String(tactic.id));
        if (!seed || groupOf(tactic) !== CARRY_GROUP || Number(tactic.boss) !== Number(seed.boss)) continue;
        if (!Array.isArray(tactic.characters) || tactic.characters.length !== 5
            || !tactic.characters.every((name, index) => name === seed.characters[index])) continue;
        const byStep = new Map((seed.rows || []).map(row => [String(row.id), row]));
        for (const step of tactic.rows || []) {
          const expected = byStep.get(String(step.id));
          if (!expected?.preDamageCommaFormatText || step.text !== expected.preDamageCommaFormatText) continue;
          step.text = expected.text;
          delete step.runs;
          changed = true;
        }
      }
      month.carryDamageCommaRevision = 1;
      changed = true;
    }
    // Normalize all separators between actions in 2~5넴 carry tactics to commas.
    // Also clean up legacy '· (중간딜 ...)' / '· 중간딜 ...' after standalone
    // actions, using only the exact known source phrases so manual edits survive.
    if (key === '2026-10' && Array.isArray(metadata.carryTactics) && Number(month.carryActionCommaRevision || 0) < 1) {
      const carryRefs = new Map(metadata.carryTactics
        .filter(seed => Number(seed.boss) >= 2 && Number(seed.boss) <= 5)
        .map(seed => [String(seed.id), seed]));
      for (const tactic of month.tactics || []) {
        const seed = carryRefs.get(String(tactic.id));
        if (!seed || groupOf(tactic) !== CARRY_GROUP || Number(tactic.boss) !== Number(seed.boss)) continue;
        if (!Array.isArray(tactic.characters) || tactic.characters.length !== 5
            || !tactic.characters.every((name, index) => name === seed.characters[index])) continue;
        const stepRefs = new Map((seed.rows || []).map(step => [String(step.id), step]));
        for (const step of tactic.rows || []) {
          const ref = stepRefs.get(String(step.id));
          if (!ref || typeof step.text !== 'string') continue;
          if (ref.preActionCommaFormatText && step.text === ref.preActionCommaFormatText) {
            step.text = ref.text;
            delete step.runs;
            changed = true;
            continue;
          }
          // An older intermediate-damage display can still be present in
          // persisted states that skipped an earlier metadata migration.
          if (!ref.text.includes(' (중간딜 ') || /\b(?:ON|OFF|SET)\b/.test(ref.text)) continue;
          const legacyParenthesis = ref.text.replace(' (중간딜 ', ' · (중간딜 ');
          const legacyRaw = ref.preDamageCommaFormatText;
          if (step.text === legacyParenthesis || (legacyRaw && step.text === legacyRaw)) {
            step.text = ref.text;
            delete step.runs;
            changed = true;
          }
        }
      }
      month.carryActionCommaRevision = 1;
      changed = true;
    }
    if (!month.tacticsMetadataVersion) {
      for (const missing of metadata.missingTactics || []) {
        if (missing.month === key && !month.tactics.some(t => t.id === missing.id)) { const {month:_, ...t} = missing; month.tactics.push(structuredClone(t)); changed = true; }
      }
      month.tacticsMetadataVersion = 1; changed = true;
    }
    for (const t of month.tactics) {
      const m = metadata[key]?.[t.id];
      if (!t.editorVersion) {
        t.originalTitle ??= t.title;
        // The earlier September prototype assigned boss 1 to every unclassified tactic.
        if (m) { t.boss=m.boss; t.stars=[...m.stars]; t.expectedDamage=m.expectedDamage; t.originalTitle=m.originalTitle; }
        else if (!/^[1-5]넴/.test(t.title || '') && key === '2026-09') t.boss = null;
        t.characters = Array.from({length:5}, (_, i) => String(t.characters?.[i] || ''));
        t.stars = Array.from({length:5}, (_, i) => String(t.stars?.[i] || ''));
        t.group = groupOf(t); t.expectedDamage ??= '';
        for (const row of t.rows) { row.id ||= makeId(); row.checked=checkedSix(row.checked); row.manualChecks ??= true; }
        t.editorVersion=1; t.title=titleFor(t); changed=true;
      }
      if (!t.rowFormatsVersion) {
        const reference=rowFormats[key]?.[t.id]||[];
        for(const [index,row] of t.rows.entries()){
          const original=reference[index]?.text===row.text?reference[index]:reference.find(r=>r.text===row.text);
          if(original?.runs&&!row.runs&&original.runs.map(r=>r.text).join('')===row.text)row.runs=structuredClone(original.runs);
        }
        t.rowFormatsVersion=1;changed=true;
      }
    }
  }
  return changed;
}

const regexEscape = s => String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const namesFor = (c, characters, catalog) => [...new Set([c,...(catalog.find(p=>p.name===c||p.aliases?.includes(c))?.aliases||[]),...[2,3].map(n=>c.length>n?c.slice(0,n):'').filter(short=>short&&characters.filter(name=>name.startsWith(short)).length===1)])].filter(Boolean);
export function recalculateTacticRows(rows, characters, catalog = [], start = 0) {
  return recalculateSetRows(rows, characters, catalog, start);
}
export function restateTacticRows(rows, characters, catalog = []) {
  return restateSetRows(rows, characters, catalog);
}

export function colorRuns(text, characters, catalog = []) {
  const tokens=[...new Set(characters.flatMap(c=>namesFor(c,characters,catalog)))].filter(Boolean).sort((a,b)=>b.length-a.length);
  const unit=`(?:${tokens.length?tokens.map(regexEscape).join('|')+'|':''}AUTO|전부)`;
  const pattern=new RegExp(`((?:${unit}[\\s,，·.]*?)*${unit})\\s*(?:순으로|순서대로)?\\s*(?:제외\\s*(?:전부\\s*)?)?(한번만|ON|OFF|SET|오프|온)`,'gi');
  const runs=[];let index=0;
  for (const match of String(text).matchAll(pattern)) {
    if(match.index>index)runs.push({text:text.slice(index,match.index)});
    runs.push({text:match[0],color:match[2]==='한번만'?'#218046':/^(ON|SET|온)$/i.test(match[2])?'#c2364f':'#2d63bc'});
    index=match.index+match[0].length;
  }
  if(index<text.length)runs.push({text:text.slice(index)});
  return runs.length?runs:[{text}];
}

export function shiftedRuns(runs, remaining, base=90) {
  if(remaining===null||remaining===undefined)return runs.map(r=>({...r}));
  const text=runs.map(r=>r.text).join('');
  const style=[];for(const run of runs)for(let i=0;i<run.text.length;i++)style.push(run.color);
  const out=[];
  const append=(text,color)=>{if(!text)return;const last=out.at(-1);if(last&&last.color===color)last.text+=text;else out.push({text,color});};
  const copy=(start,end)=>{for(let i=start;i<end;i++)append(text[i],style[i]);};
  let cursor=0;
  for(const match of text.matchAll(/\b(\d{1,2}):(\d{2})\b/g)){
    copy(cursor,match.index);append(shiftTimeline(match[0],remaining,base),style[match.index]);cursor=match.index+match[0].length;
  }
  copy(cursor,text.length);return out;
}
export function richLine(row, characters, catalog=[], remaining=null, base=90) {
  const runs=row.runs?.map(r=>r.text).join('')===row.text?row.runs:colorRuns(row.text,characters,catalog);
  return shiftedRuns(runs,remaining,base).map(r=>{
    const safeColor=/^(#[a-f\d]{3,8}|rgba?\([\d.,%\s]+\))$/i.test(r.color||'')?r.color:null;
    return safeColor?`<span style="color:${safeColor}">${escapeHtml(r.text)}</span>`:escapeHtml(r.text);
  }).join('');
}

const booleanValue = value => /^(TRUE|FALSE|☑|☐|□|✓|✔)$/i.test(value.trim()) ? /^(TRUE|☑|✓|✔)$/i.test(value.trim()) : null;
export function pastedRows(text, previous, characters, catalog=[]) {
  let checked=checkedSix(previous);
  return String(text).replace(/\r\n?/g,'\n').split('\n').filter(line=>line.trim()).map(line=>{
    const cells=line.split('\t');let states=null,body=line;
    for(let i=0;i<=cells.length-7;i++){
      const candidate=cells.slice(i,i+6).map(booleanValue);
      if(candidate.every(v=>v!==null)){states=candidate;body=cells.slice(i+6).join(' ').trim();break;}
    }
    checked=states||commandState(body,checked,characters,catalog);
    return {...newRow(checked,body),manualChecks:!!states};
  });
}

export function parseClock(input, cap=90) {
  const text=String(input).trim();let seconds;
  if(/^\d+$/.test(text))seconds=Number(text);
  else { const m=text.match(/^(\d+):([0-5]\d)$/);if(!m)return NaN;seconds=Number(m[1])*60+Number(m[2]); }
  return Number.isFinite(seconds)&&seconds>=0&&seconds<=cap?seconds:NaN;
}
export const clock = seconds => `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
