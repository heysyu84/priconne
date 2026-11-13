import assert from 'node:assert/strict';
import {sqlite,reset,initialState,savedState,request} from './api-test-fixture.mjs';
const {POST}=await import('../app/api/battle-entry/route.ts');
let state,memberId,serial=0;
function fixture(){
  state=initialState();const record=state.months[state.active];
  record.events=[];record.dayBreaks=[];
  record.options={...record.options,startStage:4,dailyAttacks:3,autoContribution:false};
  record.levels=[{stage:4,start:1,end:9999,count:9999}];
  memberId=record.memberIds[0];record.membership[memberId]={fromDay:1,toDay:null};
  for(const boss of record.bosses)boss.hp[4]=1000000000;
  reset(state);return record;
}
const entry=(extra={})=>({month:state.active,memberId,clientId:'fixture-entry-'+(++serial),boss:1,day:1,damage:1,damageMode:'manual',carry:false,bonus:0,memo:'',...extra});
const submit=body=>POST(request('/api/battle-entry',body));
async function refused(extra){const before=savedState();assert.equal((await submit(entry(extra))).status,400);assert.deepEqual(savedState(),before);}
fixture();await refused({carry:true});await refused({damage:0});await refused({damage:0.1});
for(let i=0;i<3;i++)assert.equal((await submit(entry())).status,200);
await refused({});assert.equal(JSON.parse(savedState().payload).months[state.active].events.length,3);
console.log('PASS unavailable carry, zero/fractional damage, and a fourth basic attack are rejected without writes');
fixture();
const basic=entry({damage:1000000000});assert.equal((await submit(basic)).status,200);
assert.equal((await submit(entry({carry:true,boss:2}))).status,200);
await refused({carry:true,boss:2});
const duplicate=await submit(basic);assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).duplicate,true);
assert.equal(JSON.parse(savedState().payload).months[state.active].events.length,2);
console.log('PASS a generated carry is usable once and request retries remain idempotent');
fixture();
for(let i=0;i<2;i++)assert.equal((await submit(entry({damage:1000000000}))).status,200);
await refused({boss:1});
console.log('PASS boss lap locks are enforced by the server');
{
  const record=fixture();
  record.events=[{id:'old-import-warning',seq:1,day:1,boss:2,memberId,damage:1,carry:true,bonus:0}];reset(state);
  assert.equal((await submit(entry())).status,200);
  const saved=JSON.parse(savedState().payload).months[state.active];assert.equal(saved.events[0].id,'old-import-warning');assert.equal(saved.events[0].damage,1);
}
console.log('PASS existing imported warning records are retained and do not block valid new attacks');
sqlite.close();
