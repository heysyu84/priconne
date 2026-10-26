import assert from 'node:assert/strict';
import {runtimeFixture} from './runtime-fixture.mjs';
import {replayMonth as replayNew} from '../public/battle-engine.mjs';
import {replayMonth as replayOld} from '../public/compat/engine.mjs';

for(const replay of [replayNew,replayOld]){
  const month={levels:[{stage:4,count:9999,start:1,end:9999}],options:{dailyAttacks:3,startStage:4},bosses:[{id:1,hp:{4:1000},contribution:{4:1}}],events:[
    {id:'kill',seq:1,day:1,boss:1,memberId:'a',damage:1100,carry:false},
    {id:'edited',seq:2,day:1,boss:1,memberId:'a',damage:100,carry:true},
  ]};
  replay(month);assert.equal(month.events[1].carryFrom,'kill');
  month.events[1].carry=false;replay(month);
  assert.equal(month.events[1].carryFrom,undefined);
  assert.equal(month.events[1].carryIndex,-1);
  assert.equal(month.events[1].hitIndex,2);
  month.events[1].carry=true;replay(month);
  assert.equal(month.events[1].carryFrom,'kill');
  month.events[1].memberId='b';replay(month);
  assert.equal(month.events[1].carryFrom,null);
}

const app=runtimeFixture(),data=app.get(),member=data.members.find(m=>data.memberships[m.id]);
app.ui.day=1;data.dayClosures=[];
data.logs=[
  {id:'basic-1',seq:1,day:1,memberId:member.id,boss:3,actual:100,carry:false,kill:false},
  {id:'basic-2',seq:2,day:1,memberId:member.id,boss:5,actual:100,carry:false,kill:true},
  {id:'basic-3',seq:3,day:1,memberId:member.id,boss:1,actual:100,carry:false,kill:false,carryFrom:'basic-2'},
];
let stats=app.allSeasonStats().find(s=>s.member.id===member.id);
assert.equal(stats.carry,1);assert.equal(stats.slots[1].carry,undefined);
assert.equal(stats.slots[1].pending,true);assert.equal(stats.slots[2].basic.id,'basic-3');
data.logs[2].carry=true;
stats=app.allSeasonStats().find(s=>s.member.id===member.id);
assert.equal(stats.carry,0);assert.equal(stats.slots[1].carry.id,'basic-3');
assert.equal(stats.slots.length,2);
console.log('PASS carry-to-normal replay, member reassignment, stale dashboard links, pending carry and true carry');
