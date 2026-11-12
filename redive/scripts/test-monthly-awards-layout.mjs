import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/usability.css'),'utf8');
const start=app.indexOf("completeHistory=()=>rowTable(['월','클랜 순위'");
const end=app.indexOf('const JUNE_2020_WINNERS',start);
assert(start>=0&&end>start,'Production monthly-awards renderer must exist');
const monthly=app.slice(start,end);
for(const text of [
  "['월','클랜 순위','참가','인게임 1·2위','기여도 1·2위','피해량 1·2위','결과']",
  'class="honors-no-award"',
  'colspan="3"',
  'data-label="수상 내역"',
  'data-label="결과"',
  'class="winner-cell"'
])assert(monthly.includes(text),'Monthly-awards HTML must retain: '+text);
const marker='/* Monthly awards: keep column headings, ordinary months and missing-record months aligned.';
assert(css.includes(marker),'Alignment override must exist');
assert(css.includes('tbody td.winner-cell .winner-person{'),'Winners must have a dedicated layout');
assert(css.includes('display:inline-flex!important;'),'1st and 2nd places must be horizontal');
assert(css.includes('thead th:not(:first-child)'),'Headers must align with centered values');
assert(css.includes('tbody tr.honors-no-award td.honors-note-cell'),'Spanning note must stay centered');
const noteRow=monthly.match(/return '<tr class="honors-no-award">[\\s\\S]*?<\\/tr>';/)?.[0];
assert(noteRow,'Special-month row must be rendered');
const noteCells=[...noteRow.matchAll(/<td([^>]*)>/g)].map(match=>match[1]);
assert.equal(noteCells.length,5,'Special row must include month, rank, count, spanning note and result');
assert.equal(noteCells.reduce((total,attrs)=>total+Number(attrs.match(/colspan="(\\d+)"/)?.[1]||1),0),7,
  'Special-month cells must occupy the same seven-column grid as normal months');
console.log('Monthly-awards structure and alignment: PASS');
