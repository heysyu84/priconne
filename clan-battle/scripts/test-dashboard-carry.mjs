import assert from 'node:assert/strict';
import {dashboardDay} from '../public/guild-model.mjs';
import {replayMonth} from '../public/engine.mjs';
import {createGuildWorkspace} from '../public/guild-workspace.mjs';

globalThis.document={addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];}};
globalThis.window={addEventListener(){}};
globalThis.localStorage={getItem(){return null;},setItem(){}};

const month={options:{dailyAttacks:3,days:5,startStage:4},levels:[{stage:4,start:1,end:999,count:999}],dayBreaks:[],memberIds:['a','b','other'],bosses:Array.from({length:5},(_,i)=>({id:i+1,hp:{4:100000000},contribution:{}})),events:[
  {id:'prior',seq:1,day:1,boss:1,memberId:'other',damage:25000000,carry:false},
  {id:'overkill',seq:2,day:1,boss:1,memberId:'a',damage:100000000,carry:false},
  {id:'cap',seq:3,day:1,boss:1,memberId:'b',damage:500000000,carry:false},
  {id:'normal',seq:4,day:1,boss:2,memberId:'a',damage:10000000,carry:false},
  {id:'exact',seq:5,day:1,boss:3,memberId:'a',damage:100000000,carry:false}
]};
replayMonth(month);
const app={active:'2026-10',roster:month.memberIds.map(id=>({id,name:id})),months:{'2026-10':month}};
const guild=createGuildWorkspace({getApp:()=>app,getMonth:()=>month,render(){},persist(){throw Error('Reading the dashboard must not save data');},section:title=>`<h1>${title}</h1>`,nf:String,formatContribution:String,escapeHtml:String,notify(){},openForm(){},canEdit:()=>false,characters:[]});
const before=JSON.stringify(month),result=dashboardDay(month,'a',1);
assert.deepEqual([result.used,result.remaining,result.pending],[3,0,2]);
assert.equal(result.slots[0].basic.before,75000000);
assert.equal(result.slots[0].basic.actual,75000000);
assert.equal(result.slots[0].basic.damage,100000000);
assert.equal(result.slots[0].carrySeconds,43);
assert.equal(dashboardDay(month,'b',1).slots[0].carrySeconds,90);
assert.equal(result.slots[1].pending,false);
assert.equal(result.slots[1].carrySeconds,null);
assert.equal(result.slots[2].pending,true);
assert.equal(result.slots[2].carrySeconds,null);
const html=guild.dashboard();
assert.match(html,/class="pending-carry carry-seconds"[^>]*aria-label="미사용 이월 43초">43초<\/strong>/);
assert.match(html,/class="pending-carry"[^>]*오버킬 기록 없음[^>]*>★<\/strong>/);
assert.ok(!/undefined초|NaN초/.test(html));
assert.equal(JSON.stringify(month),before);

// Editing or removing an earlier attack changes this boss's actual remaining HP.
month.events[0].damage=50000000;replayMonth(month);
assert.equal(dashboardDay(month,'a',1).slots[0].carrySeconds,65);
const prior=month.events.shift();replayMonth(month);
assert.equal(dashboardDay(month,'a',1).slots[0].carrySeconds,null);
prior.damage=25000000;month.events.unshift(prior);replayMonth(month);
assert.equal(dashboardDay(month,'a',1).slots[0].carrySeconds,43);

// Using an available carry replaces its time with the attacked boss.
month.events.push({id:'used-carry',seq:6,day:1,boss:4,memberId:'a',damage:1000000,carry:true});
replayMonth(month);
const used=dashboardDay(month,'a',1);
assert.equal(used.slots[0].carry.boss,4);
assert.equal(used.slots[0].pending,false);
assert.equal(used.slots[0].carrySeconds,null);
assert.equal(used.pending,1);
assert.ok(!guild.dashboard().includes('>43초</strong>'));
assert.match(guild.dashboard(),/data-boss-color="1">1넴<\/span><span class="boss-chip" data-boss-color="4">4넴<\/span>/);

// Day boundaries and other members cannot consume or supply this member's carry.
month.dayBreaks.push({afterSeq:6,nextDay:2});
month.events.push({id:'day-two',seq:7,day:2,boss:2,memberId:'a',damage:100000000,carry:false});
replayMonth(month);
assert.equal(dashboardDay(month,'a',1).slots.length,3);
assert.equal(dashboardDay(month,'a',2).slots.length,1);
assert.equal(dashboardDay(month,'a',2).slots[0].carrySeconds,29);
assert.equal(dashboardDay(month,'b',1).slots[0].carrySeconds,90);

// Preserve exact ceiling near the 20-second boundary; never invent missing data.
for(const [damage,hp,expected] of [[100,99,21],[100,89,30],[100,88,31],[100000000,75000000,43],[500000000,100000000,90],[100,100,null],[100,0,null],[100,undefined,null],[Number.MAX_SAFE_INTEGER+1,1,null]]){
  const event={id:'edge',seq:1,day:1,boss:1,memberId:'edge',kill:true,carry:false,damage,before:hp};
  const fixture={options:{dailyAttacks:3},events:[event]};
  const unchanged=JSON.stringify(fixture);
  assert.equal(dashboardDay(fixture,'edge',1).slots[0].carrySeconds,expected,`${hp}/${damage}`);
  assert.equal(JSON.stringify(fixture),unchanged);
}
console.log('PASS: dashboard overkill time, exact rounding and 90-second cap; source HP, corrected/deleted hits, consumed carry, daily/member isolation, unknown-time fallback, readonly HTML and no record mutation');
