import assert from 'node:assert/strict';
import {planBattleRowMove} from '../public/battle-row-order.mjs';
import {replayMonth} from '../public/engine.mjs';

const fixture=()=>({options:{startStage:2,days:5,dailyAttacks:3,autoContribution:false},levels:[{stage:2,start:1,end:1,count:1},{stage:3,start:2,end:3,count:2}],bosses:[{id:1,hp:{2:1000,3:2000},contribution:{2:1,3:1}}],dayBreaks:[{id:'close-1',afterSeq:3,nextDay:2},{id:'close-2',afterSeq:5,nextDay:3}],events:[
 {id:'a',seq:1,day:1,boss:1,memberId:'one',member:'가',damage:400,carry:false},
 {id:'b',seq:2,day:1,boss:1,memberId:'two',member:'나',damage:800,carry:false},
 {id:'c',seq:3,day:1,boss:1,memberId:'two',member:'나',damage:500,carry:true},
 {id:'d',seq:4,day:2,boss:1,memberId:'three',member:'다',damage:300,carry:false},
 {id:'e',seq:5,day:2,boss:1,memberId:'four',member:'라',damage:100,carry:false},
 {id:'f',seq:6,day:3,boss:1,memberId:'five',member:'마',damage:100,carry:false}]});
let month=fixture();replayMonth(month);
const original=JSON.stringify(month),before=month.events.find(e=>e.id==='b').actual;
const plan=planBattleRowMove(month,'a','b',false);
assert.equal(JSON.stringify(month),original,'planning must not mutate live records');
Object.assign(month,{events:plan.events,dayBreaks:plan.dayBreaks});const warnings=replayMonth(month);
assert.deepEqual(month.events.map(e=>e.id),['b','a','c','d','e','f']);
assert.notEqual(month.events.find(e=>e.id==='b').actual,before,'actual damage must replay after moving');
assert.equal(month.events.find(e=>e.id==='c').carryFrom,null);
assert.ok(warnings.some(w=>w.id==='c'&&w.message.includes('연결할')),'moving a kill to another member must expose the broken carry link');
assert.deepEqual(month.events.map(e=>e.damage),[800,400,500,300,100,100]);
assert.deepEqual(month.events.map(e=>e.day),[1,1,1,2,2,3]);
assert.deepEqual(month.dayBreaks.map(b=>b.afterSeq),[3,5]);

month=fixture();const cross=planBattleRowMove(month,'b','e',true);Object.assign(month,{events:cross.events,dayBreaks:cross.dayBreaks});replayMonth(month);
assert.deepEqual(month.events.map(e=>e.id),['a','c','d','b','e','f']);
assert.equal(month.events.find(e=>e.id==='b').day,2);
assert.equal(month.events.find(e=>e.id==='c').day,1,'other attacks must stay on their day');
assert.deepEqual(month.dayBreaks.map(b=>b.afterSeq),[2,5]);
assert.deepEqual(month.events.map(e=>e.seq),[1,2,3,4,5,6]);
assert.equal(planBattleRowMove(month,'b','b'),null);
assert.throws(()=>planBattleRowMove(month,'missing','e'));
month=fixture();month.events=month.events.filter(e=>e.id!=='a'&&e.id!=='c');month.dayBreaks[0].afterSeq=2;
const emptyDay=planBattleRowMove(month,'b','d',true);
assert.equal(emptyDay.dayBreaks[0].afterSeq,0,'moving the final attack of a day must preserve an empty day');
assert.equal(emptyDay.dayBreaks[0].nextDay,2);
console.log('PASS: reverse display moves, replayed HP/carry links, cross-day moves, empty days and unchanged source records');
