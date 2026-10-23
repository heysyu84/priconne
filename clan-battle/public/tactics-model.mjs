import { makeId } from './roster.mjs?v=20261022-pages10';
import { shiftTimeline } from './engine.mjs?v=20261022-pages10';

export const GROUPS = ['택틱정리', '타비비토'];
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const groupOf = tactic => tactic.group || (tactic.source === '타비비토' ? '타비비토' : '택틱정리');
export const checkedSix = checked => Array.from({length:6}, (_, i) => checked?.[i] === true || checked?.[i] === 'TRUE');
export const titleFor = tactic => `${tactic.boss ? tactic.boss+'넴' : '보스 미분류'} ${tactic.characters.map(c=>c||'미선택').join(' ')} ${tactic.stars.map(s=>s||'?').join('')}, 기대딜 ${tactic.expectedDamage || '미입력'}`;
export function compareTactics(a, b) {
  const boss = tactic => Number(tactic.boss) > 0 ? Number(tactic.boss) : Infinity;
  if (boss(a) !== boss(b)) return boss(a) < boss(b) ? -1 : 1;
  const damage = tactic => {
    const match = String(tactic.expectedDamage ?? '').replace(/[,\s]/g, '').match(/^(\d+(?:\.\d+)?)(억|만)?$/);
    if (!match) return -Infinity;
    const value = Number(match[1]) / (match[2] === '만' ? 10000 : 1);
    return Number.isFinite(value) ? value : -Infinity;
  };
  const left = damage(a), right = damage(b);
  return left === right ? 0 : left > right ? -1 : 1;
}
export const newRow = (checked = [], text = '') => ({id:makeId(), text, checked:checkedSix(checked), manualChecks:false});

export function ensureTactics(app, metadata = {}, rowFormats = {}) {
  let changed = false;
  for (const [key, month] of Object.entries(app.months)) {
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
export function commandState(text, previous, characters, catalog = []) {
  const result=checkedSix(previous);
  const names=characters.map(c=>namesFor(c,characters,catalog));
  const tokens=[...new Set(names.flat())].sort((a,b)=>b.length-a.length);
  if (!tokens.length) return result;
  const unit=`(?:${tokens.map(regexEscape).join('|')}|AUTO|전부)`;
  const pattern=new RegExp(`((?:${unit}[\\s,，·.]*?)*${unit})\\s*(?:순으로|순서대로)?\\s*(제외\\s*(?:전부\\s*)?)?(한번만|ON|OFF|SET|오프|온)`,'gi');
  for (const match of String(text).matchAll(pattern)) {
    const [,subjects,except,command]=match;
    if (command === '한번만') continue;
    const on=/^(ON|SET|온)$/i.test(command);
    const selected=names.map((aliases,i)=>aliases.some(n=>subjects.includes(n))?i:-1).filter(i=>i>=0);
    if (/AUTO/i.test(subjects)) result[5]=on;
    if (/전부/.test(subjects)) for(let i=0;i<5;i++) result[i]=on;
    else if (except) { for(let i=0;i<5;i++) if(!selected.includes(i)) result[i]=on; }
    else for (const i of selected) result[i]=on;
  }
  return result;
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
