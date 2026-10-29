import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findNonOverlappingStage3} from '../public/aikurumi-stage3-composer.mjs';
import {classifySourceTactic,OPERATION_LABELS,sourceDamage} from '../public/aikurumi-operation-types.mjs';

const read=name=>JSON.parse(readFileSync(new URL('../public/'+name,import.meta.url),'utf8'));
const s3=read('aikurumi-snapshot-stage3.json'),s6=read('aikurumi-snapshot.json');

test('source stage3 actually provides 95 complete five-character candidate teams',()=>{
 assert.equal(s3.stage,3);
 assert.equal(s3.bosses.length,5);
 assert.equal(s3.bosses.reduce((n,b)=>n+b.tasks.length,0),95);
 assert.equal(s3.bosses.every(b=>b.tasks.every(t=>t.charas.length===5)),true);
});
test('five-boss zero-overlap solutions use only actual source IDs',()=>{
 const result=findNonOverlappingStage3(s3,{operation:'full-auto',limit:5});
 assert.equal(result.status,'solved');
 assert.ok(result.solutions.length>0);
 assert.ok(result.eligiblePerBoss.every(x=>x.count>0));
 const actual=new Map(s3.bosses.flatMap(b=>b.tasks.map(t=>[t.id,t])));
 for(const s of result.solutions){
  assert.equal(s.lineup.length,5);
  assert.deepEqual(s.lineup.map(x=>x.boss),[1,2,3,4,5]);
  const units=s.lineup.flatMap(x=>x.characterIds);
  assert.equal(new Set(units).size,25);
  for(const part of s.lineup)assert.deepEqual(part.characterIds,actual.get(part.taskId)?.charas.map(c=>c.prefabId));
 }
 assert.deepEqual(result.solutions[0].lineup.map(x=>x.taskId),[14253,14254,14255,14256,14426]);
 assert.equal(result.solutions[0].totalDamage,46000);
});
test('classify original source link types and carry separately',()=>{
 const sample={type:1,canAuto:[20,40],autoDamage:12000,halfAutoDamage:14000};
 const full=classifySourceTactic(sample,{type:20,damage:0});
 assert.equal(full.operation,'full-auto');
 assert.equal(full.carry,true);
 assert.deepEqual(full.categories,['full-auto','carry']);
 assert.equal(classifySourceTactic(sample,{type:40}).operation,'semi-auto');
 assert.equal(classifySourceTactic(sample,{type:50}).operation,'easy-manual');
 assert.equal(classifySourceTactic(sample,{type:10}).operation,'manual');
 assert.equal(classifySourceTactic(sample,{type:999}).operation,'unknown');
 assert.equal(OPERATION_LABELS['carry'],'이월용');
 assert.equal(sourceDamage(sample,'semi-auto'),14000);
});
test('cannot compose with source stage6 or missing boss candidates',()=>{
 assert.equal(findNonOverlappingStage3(s6).status,'invalid-stage');
 const result=findNonOverlappingStage3(s3,{operation:'manual'});
 assert.equal(result.status,'missing-boss');
 assert.equal(result.solutions.length,0);
});
test('underlying character reuse is prohibited even across translated alias variants',()=>{
 const copied=JSON.parse(JSON.stringify(s3));
 const fixedId=copied.bosses[0].tasks[0].charas[0].prefabId;
 for(const b of copied.bosses)for(const t of b.tasks)t.charas[0].prefabId=fixedId;
 const result=findNonOverlappingStage3(copied);
 assert.equal(result.status,'no-zero-overlap');
 assert.equal(result.solutions.length,0);
});
