import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const season=fs.readFileSync(root+'src/season.js','utf8');
const first=season.indexOf('const TRANSCEND_CARRY_BONUS=-1350;');
const last=season.indexOf('function recalculateSeason()',first);
assert(first>0&&last>first,'transcend adjustment is required before recalc');
const run=vm.runInNewContext(season.slice(first,last)+'\napplyTranscendCarryBonuses',{});
const logs=[
 {id:'carry',role:'초월',bonus:0},
 {id:'other',role:'이월타',bonus:0},
 {id:'old',role:'초월',bonus:-1350},
 {id:'manual',role:'초월',bonus:400},
 {id:'source',role:'초월 준비',bonus:0}
];
assert.equal(run(logs),3);
assert.deepEqual(logs.map(e=>e.bonus),[-1350,0,-1350,-950,0]);
assert.equal(run(logs),0,'Never apply penalty twice');
logs[0].role='이월타';logs[3].role='일반';
assert.equal(run(logs),2);
assert.equal(logs[0].bonus,0);
assert.equal(logs[3].bonus,400);
logs[2].role='일반';assert.equal(run(logs),1);
assert.equal(logs[2].bonus,0);
logs[0].role='초월';assert.equal(run(logs),1);
logs[0].bonus=-1100;logs[0].role='일반';run(logs);
assert.equal(logs[0].bonus,-1100,'Do not overwrite manually edited bonus');
for(const path of ['src/season.js','public/app.js','../docs/compact/app.js']){
 const code=fs.readFileSync(root+path,'utf8');
 assert(code.includes('applyTranscendCarryBonuses(data.logs)'),path+' must adjust the stored bonus');
 assert(code.indexOf('applyTranscendCarryBonuses(data.logs)')<code.indexOf('e.contribution=engineContribution(e,month);'),path);
}
const shared=fs.readFileSync(root+'src/shared.js','utf8');
assert(shared.includes('syncState.transcendBonusPending=month===latest'));
assert(shared.includes('persistShared({autoTranscend:true})'));
assert(!fs.readFileSync(root+'public/battle-engine.mjs','utf8').includes('TRANSCEND_CARRY_BONUS'));
console.log('PASS: transcend carry bonus -13,500,000, idempotence, existing month and safe persistence');

const entry=fs.readFileSync(root+'src/entry-controls.js','utf8');
const operations=fs.readFileSync(root+'src/operations.js','utf8');
assert(entry.includes('predictedTranscendEntryBonus('),'Entry must predict a stage-2/3 to 4 carry');
assert(entry.includes("field.value=predicted?'-13500000':'0'"),'Visible bonus must be prefilled');
assert(entry.includes("field.name==='usesCarry'"),'Carry checkbox must update suggested bonus');
assert(entry.includes("field.dataset.transcendEdited==='1'"),'Manual bonus changes must be preserved');
assert(operations.includes('data-auto-transcend='),'Quick form must prefill on first render');
