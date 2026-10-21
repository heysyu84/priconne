import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ensureTactics, titleFor, commandState, pastedRows, richLine, shiftedRuns, parseClock } from '../public/tactics-model.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL('../public/'+path,import.meta.url),'utf8'));
const html=fs.readFileSync(new URL('../public/clan-shell.html',import.meta.url),'utf8');
const app=JSON.parse(html.match(/<script id="seed-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const original=structuredClone(app),meta=read('tactic-metadata.json'),formats=read('tactic-row-formats.json'),catalog=read('characters.json').characters;
assert.equal(ensureTactics(app,meta,formats),true);
assert.equal(ensureTactics(app,meta,formats),false);
assert.equal(app.months['2026-09'].tactics.length,23);
assert.deepEqual([...new Set(app.months['2026-09'].tactics.map(t=>t.boss))].sort(),[1,2,3,4,5]);
assert.equal(app.months['2026-10'].tactics.length,16);
const target=app.months['2026-09'].tactics.find(t=>t.id==='택틱정리-62');
assert.deepEqual(target.stars,['5','5','5','6','5']);
assert.equal(target.expectedDamage,'3.3');
assert.equal(titleFor(target),'1넴 에키드나 알네카 프캬루 밤피 바이올렛 55565, 기대딜 3.3');
assert.equal(app.months['2026-10'].tactics.find(t=>t.id==='oct-택틱정리-145').boss,null);
let preserved=0;
for(const [monthKey,month] of Object.entries(original.months)){
  assert.deepEqual(month.events,app.months[monthKey].events);
  for(const t of month.tactics){
    const after=app.months[monthKey].tactics.find(item=>item.id===t.id);
    assert.deepEqual(after.rows.map(r=>({text:r.text,checked:r.checked})),t.rows.map(r=>({text:r.text,checked:r.checked})));
    for(const row of after.rows){
      if(row.runs){assert.equal(row.runs.map(r=>r.text).join(''),row.text);assert.equal(shiftedRuns(row.runs,90,90).map(r=>r.text).join(''),row.text);preserved++;}
      assert.equal(row.checked.length,6);
    }
  }
}
assert.ok(preserved>=370);
// Original rich text and SET flags stay intact through repeated carry conversions.
const source=JSON.stringify(target.rows);
for(const remaining of [61,30,90,0,61]){
  for(const row of target.rows){const html=richLine(row,target.characters,catalog,remaining,90);assert.ok(!html.includes('<script'));}
  assert.equal(JSON.stringify(target.rows),source);
}
const split=[{text:'1:',color:'#c2364f'},{text:'02 ',color:'#2d63bc'},{text:'프캬루 ON',color:'#218046'}];
assert.deepEqual(shiftedRuns(split,61),[{text:'0:33',color:'#c2364f'},{text:' ',color:'#2d63bc'},{text:'프캬루 ON',color:'#218046'}]);
assert.equal(richLine({text:'<img src=x onerror=alert(1)>'},[],catalog).includes('<img'),false);

const chars=['프캬루','호마레','에로체','수마레','바이올렛'];
assert.deepEqual(commandState('AUTO 오프, 바이올렛, 수마레, 에로체 SET',[],chars),[false,false,true,true,true,false]);
assert.deepEqual(commandState('1:02 프캬루 후 호마레 ON, AUTO 온',[false,false,true,true,true,false],chars),[false,true,true,true,true,true]);
assert.deepEqual(commandState('AUTO 온, 바이올렛 제외 SET',[],chars),[true,true,true,true,false,true]);
assert.deepEqual(commandState('전부 OFF',[true,true,true,true,true,true],chars),[false,false,false,false,false,true]);
assert.deepEqual(commandState('1:02 네피 ON',[],['네피네라','봉황','후부키','아이라','수네아']),[true,false,false,false,false,false]);
const rows=pastedRows('FALSE\tTRUE\tFALSE\tTRUE\tFALSE\tTRUE\t1:02 수마레 ON\n0:31 바이올렛 OFF',[false,false,false,false,false,false],chars);
assert.equal(rows.length,2);assert.deepEqual(rows[0].checked,[false,true,false,true,false,true]);assert.equal(rows[0].manualChecks,true);assert.equal(rows[1].checked[5],true);assert.equal(rows[1].manualChecks,false);
for(const [text,value] of [['61',61],['1:01',61],['0:00',0],['90',90]])assert.equal(parseClock(text),value);
for(const text of ['1:99','91','-1','nan',''])assert.ok(Number.isNaN(parseClock(text)));

assert.equal(catalog.length,67);let imageCount=0;
for(const character of catalog){for(const path of [character.portrait,...Object.values(character.byStar)]){const buffer=fs.readFileSync(new URL('../public'+path,import.meta.url));assert.equal(buffer.subarray(0,8).toString('hex'),'89504e470d0a1a0a');imageCount++;}}
assert.ok(catalog.find(c=>c.name==='에키드나').portrait.includes('unit-row-275'));
console.log(`PASS: 39 tactics, 454 original attacks unchanged, ${preserved} rich-text rows, carry conversion, SET import, ${imageCount} PNG mappings`);
