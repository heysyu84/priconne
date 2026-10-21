import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dayClosures,cancelDayClosure} from '../public/battle-days.mjs';
import {replayMonth,bossProgress,contribution} from '../public/engine.mjs';
import {ensureRoster} from '../public/roster.mjs';
import {createWorkflow} from '../public/workflow.mjs';

const shell=fs.readFileSync(new URL('../public/clan-shell.html',import.meta.url),'utf8');
const seed=JSON.parse(shell.match(/<script id="seed-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const migrated=structuredClone(seed);ensureRoster(migrated,migrated.rosterSeed);
function sampleApp() {
  const app=structuredClone(migrated);app.active='2026-10';
  const month=app.months[app.active],member=app.roster[0];
  month.events=Array.from({length:6},(_,i)=>({id:`attack-${i+1}`,seq:i+1,day:1,memberId:member.id,member:member.name,boss:i<3?1:2,damage:i===0?month.bosses[0].hp[2]:1,carry:i===1,bonus:0,memo:`메모 ${i+1}`,damageMode:'manual'}));
  month.dayBreaks=[{id:'first',afterSeq:1,nextDay:2},{id:'middle',afterSeq:3,nextDay:3},{id:'latest',afterSeq:6,nextDay:4}];
  month.membership[member.id]={fromDay:1,toDay:null};
  month.membership[app.roster[1].id]={fromDay:2,toDay:3};
  replayMonth(month);return app;
}
const inputFields=['id','seq','memberId','member','boss','damage','carry','bonus','memo','damageMode'];
const inputs=month=>month.events.map(e=>Object.fromEntries(inputFields.map(k=>[k,e[k]])));
const hp=month=>month.events.map(e=>[e.id,e.before,e.after,e.actual,e.stage,e.lap,e.kill]);
let app=sampleApp(),month=app.months[app.active];
const originalInputs=inputs(month),originalHP=hp(month),originalProgress=bossProgress(month),otherMonth=JSON.stringify(app.months['2026-09']);
assert.deepEqual(month.events.map(e=>e.day),[1,2,2,3,3,3]);
assert.deepEqual(dayClosures(month).map(b=>[b.id,b.day,b.nextDay]),[['first',1,2],['middle',2,3],['latest',3,4]]);
// A persisted boundary can be cancelled after reload, including an empty last day.
month=JSON.parse(JSON.stringify(month));cancelDayClosure(month,'latest');replayMonth(month);
assert.deepEqual(month.dayBreaks.map(b=>b.id),['first','middle']);
assert.deepEqual(inputs(month),originalInputs);assert.deepEqual(hp(month),originalHP);
// Removing a middle closure merges its records and shifts later boundaries only.
month=sampleApp().months['2026-10'];cancelDayClosure(month,'middle');replayMonth(month);
assert.deepEqual(month.dayBreaks,[{id:'first',afterSeq:1,nextDay:2},{id:'latest',afterSeq:6,nextDay:3}]);
assert.deepEqual(month.events.map(e=>e.day),[1,2,2,2,2,2]);
assert.deepEqual(inputs(month),originalInputs);assert.deepEqual(hp(month),originalHP);
assert.deepEqual(bossProgress(month),originalProgress);
assert.deepEqual(month.membership[app.roster[1].id],{fromDay:2,toDay:2});
// Carry links and daily hit counters are recalculated for the merged day.
assert.equal(month.events[1].carryFrom,null);
cancelDayClosure(month,'first');replayMonth(month);
assert.ok(month.events.every(e=>e.day===1));assert.equal(month.events[1].carryFrom,'attack-1');assert.equal(month.events[1].carryIndex,1);
assert.equal(month.events[2].hitIndex,2);assert.deepEqual(inputs(month),originalInputs);assert.deepEqual(hp(month),originalHP);
assert.deepEqual(month.membership[app.roster[1].id],{fromDay:1,toDay:1});
assert.equal(month.membership[app.roster[0].id].toDay,null);
const beforeUnknown=JSON.stringify(month);assert.equal(cancelDayClosure(month,'missing'),null);assert.equal(JSON.stringify(month),beforeUnknown);
// Legacy imports can skip a day with no attacks: remove the whole saved gap.
const gap={events:[],dayBreaks:[{id:'gap',afterSeq:2,nextDay:3},{id:'after',afterSeq:5,nextDay:5}],membership:{member:{fromDay:3,toDay:5}}};
cancelDayClosure(gap,'gap');assert.deepEqual(gap.dayBreaks,[{id:'after',afterSeq:5,nextDay:3}]);assert.deepEqual(gap.membership.member,{fromDay:1,toDay:3});
const empty={events:[],dayBreaks:[{id:'empty',afterSeq:0,nextDay:2}]};cancelDayClosure(empty,'empty');assert.deepEqual(empty.dayBreaks,[]);

// Exercise the actual UI handlers, including the code gate and undo behavior.
let listeners={},editor=false,saves=0,unlocks=0,answer=true;
globalThis.document={addEventListener(type,fn){(listeners[type]||=[]).push(fn);},querySelector:()=>null,querySelectorAll:()=>[],activeElement:null};
globalThis.window={addEventListener(){}};
globalThis.confirm=()=>answer;
function workflow() {
  listeners={};
  return createWorkflow({getApp:()=>app,getMonth:()=>app.months[app.active],setApp:value=>{app=value;for(const m of Object.values(app.months))replayMonth(m);},persist:()=>saves++,replay:replayMonth,render(){},notify(){},navigate(){},section:h=>`<h1>${h}</h1>`,nf:String,escapeHtml:v=>String(v??''),contribution,canEdit:()=>editor,unlock:()=>unlocks++});
}
function click(action,id) {
  const b={dataset:{wf:action,id}};
  for(const fn of listeners.click)fn({target:{closest:s=>s==='[data-wf]'?b:null},preventDefault(){}});
}
app=sampleApp();let controller=workflow();
assert.ok(!controller.battleView().includes('data-wf="reopen-day"'));
const locked=JSON.stringify(app);click('reopen-day','middle');assert.equal(unlocks,1);assert.equal(JSON.stringify(app),locked);assert.equal(saves,0);
editor=true;assert.ok(controller.battleView().includes('aria-label="2일차 마감 취소"'));
answer=false;click('reopen-day','middle');assert.equal(JSON.stringify(app),locked);assert.equal(saves,0);
answer=true;click('reopen-day','middle');assert.equal(saves,1);
assert.equal(app.months['2026-10'].events.length,6);assert.deepEqual(inputs(app.months['2026-10']),originalInputs);
assert.equal(JSON.stringify(app.months['2026-09']),otherMonth);
const reopened=JSON.stringify(app);
click('undo');assert.deepEqual(app.months['2026-10'].dayBreaks.map(b=>b.id),['first','middle','latest']);
assert.deepEqual(inputs(app.months['2026-10']),originalInputs);
// A new controller after a refresh has no undo history, but retains cancel buttons.
app=JSON.parse(reopened);controller=workflow();assert.ok(controller.battleView().includes('aria-label="2일차 마감 취소"'));
click('reopen-day','latest');assert.deepEqual(app.months['2026-10'].dayBreaks.map(b=>b.id),['first']);
assert.deepEqual(inputs(app.months['2026-10']),originalInputs);
click('next-day');assert.equal(app.months['2026-10'].dayBreaks.length,2);assert.equal(app.months['2026-10'].dayBreaks.at(-1).afterSeq,6);
console.log('PASS: saved close cancellation after reload, empty/latest/middle/skipped days, intact attacks and exact HP, membership ranges, daily hits/carry relinking, editor gate, confirmation, undo and re-closing');
