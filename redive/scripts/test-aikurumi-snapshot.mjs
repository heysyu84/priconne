import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewAikurumiTactic} from '../public/aikurumi-tactic-review.mjs';

const data=JSON.parse(readFileSync(new URL('../public/aikurumi-snapshot.json',import.meta.url),'utf8'));
const tasks=data.bosses.flatMap(b=>b.tasks);
const links=tasks.flatMap(t=>t.links.map(l=>({t,l})));

test('JP 2025-10 KR 2026-11 offline snapshot is well-formed and explicitly read-only',()=>{
 assert.equal(data.source,'aikurumi.cn');
 assert.equal(data.readOnly,true);
 assert.equal(data.jpMonth,'2025-10');
 assert.equal(data.krMonth,'2026-11');
 assert.equal(data.stage,6);
 assert.equal(data.bosses.length,5);
 assert.equal(tasks.length,97);
 assert.equal(links.length,214);
});

test('all 96 distinct character IDs match a canonical KR name without guessing',()=>{
 const ids=new Set(tasks.flatMap(t=>t.charas.map(c=>c.prefabId)));
 assert.equal(ids.size,96);
 for(const id of ids){
  assert.ok(data.characterData.names[String(id)]?.[0],String(id));
  assert.ok(data.characterData.positionUnits.some(u=>u.unitId===id),String(id));
 }
});

test('all 214 variants render as review-only with no implicit registration',()=>{
 let textLinks=0,notesOnly=0,hasWarning=0;
 for(const boss of data.bosses)for(const task of boss.tasks)for(const link of task.links){
  const preview=previewAikurumiTactic(task,link,{
   unitMap:data.characterData.names,positionUnits:data.characterData.positionUnits,
   bossSlot:boss.index,stage:data.stage,bossNames:data.bosses.map(b=>b.unitName)
  });
  assert.equal(preview.registrationAllowed,false);
  assert.equal(preview.sourceText,String(link.remarks||''));
  assert.deepEqual(preview.originalLineup.map(x=>x.prefabId),task.charas.map(c=>c.prefabId));
  if(link.remarks?.trim()){textLinks++;if(!preview.timeline)notesOnly++;}
  if(preview.issues.length)hasWarning++;
 }
 assert.equal(textLinks,133);
 assert.equal(notesOnly,1);
 assert.ok(hasWarning>0);
});

test('distinct link variants remain distinct, including repeated task IDs',()=>{
 const keys=new Set();
 for(const boss of data.bosses)for(const task of boss.tasks)for(const [i,link] of task.links.entries()){
  const key=[boss.index,task.id,link.index??i,i].join(':');
  assert.equal(keys.has(key),false,'duplicate '+key);
  keys.add(key);
 }
 assert.equal(keys.size,214);
});
