import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runtimeFixture} from './runtime-fixture.mjs';
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture({withKill=true,sync=false}={}){
 const app=runtimeFixture(),d=app.get();d.settings.editable=true;d.members=[{id:'nar',name:'나르',uid:'123',status:'active'},{id:'setup',name:'준비',uid:'456',status:'active'}];
 d.rules={...d.rules,days:5,daily:3,startStage:4,levels:[{stage:1,count:0},{stage:2,count:0},{stage:3,count:0},{stage:4,count:9999}],autoContribution:false,preserveContributionCoefficients:true};
 for(const b of d.bossSettings){b.hp={1:100,2:100,3:100,4:100};b.game={4:1};b.contribution={4:1};}
 d.memberships={nar:{from:1,to:5},setup:{from:1,to:5}};d.dayClosures=[];
 const row=(id,seq,memberId,boss,damage)=>({id,seq,memberId,boss,damage,day:5,carry:false,usesCarry:false,bonus:0});
 d.logs=[row('prepare',1,'setup',3,80),row('one',2,'nar',1,30),row('two',3,'nar',2,30),...(withKill?[row('finish',4,'nar',3,20)]:[])];
 app.ui.day=5;app.ui.section='overview';app.ui.tabs.overview='logs';app.recalculateSeason();
 Object.assign(app.sync,{started:sync,ready:sync,canEdit:true,authenticated:true,revision:10,pending:'',inFlight:false,status:'saved'});
 app.sync.baseline=JSON.stringify(app.sharedDocument());
 return app;
}
const carryFields=(extra={})=>new Map(Object.entries({logId:'',memberId:'nar',day:'5',boss:'3',damage:'1',unit:'1',usesCarry:'on',bonus:'0',note:'',gameAt:'',...extra}));
const stats=app=>app.evaluate('statsFor(data.members.find(p=>p.id==="nar"),5)');
const text=app=>app.elements.toast.innerHTML.replace(/<[^>]*>/g,'');
async function settle(app){for(let i=0;i<30&&app.evaluate('carryEntryRefresh');i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(app.evaluate('carryEntryRefresh'),null);}
let checks=0;
async function check(label,run){await run();checks++;console.log('PASS '+label);}
await check('an exact-HP cleanup kill creates a carry without needing overkill or a timestamp',()=>{
 const app=fixture(),s=stats(app);assert.equal(s.used,3);assert.equal(s.carry,1);assert.equal(s.slots[2].basic.before,s.slots[2].basic.damage);
 const html=app.evaluate('attackSlot(statsFor(data.members.find(p=>p.id==="nar"),5).slots[2],2)');assert.match(html,/★/);assert.match(html,/이월 보유 · 시간 미상/);assert.doesNotMatch(html,/\d+초/);
 assert.equal(app.saveCompleteLog(carryFields()),true);assert.equal(app.get().logs.at(-1).carryFrom,'finish');assert.equal(app.get().logs.at(-1).carryIndex,3);assert.equal(stats(app).carry,0);assert.equal(stats(app).used,3);
 assert.equal(app.saveCompleteLog(carryFields()),false);
});
await check('a typed remaining time is displayed while non-kills and another day do not create carries',()=>{
 const app=fixture();app.get().logs.find(e=>e.id==='finish').carrySeconds=35;
 assert.match(app.evaluate('attackSlot(statsFor(data.members.find(p=>p.id==="nar"),5).slots[2],2)'),/35초/);
 assert.equal(app.saveCompleteLog(carryFields({day:'4'})),false);
 app.get().logs.find(e=>e.id==='finish').damage=19;app.recalculateSeason();assert.equal(stats(app).carry,0);
 assert.doesNotMatch(app.evaluate('attackSlot(statsFor(data.members.find(p=>p.id==="nar"),5).slots[2],2)'),/carry-ready/);assert.equal(app.saveCompleteLog(carryFields()),false);
});
await check('inserting before the generating kill explains the position error; inserting after it succeeds',()=>{
 const app=fixture();assert.equal(app.saveCompleteLog(carryFields({insertAnchor:'finish',insertSide:'before'})),false);
 assert.match(text(app),/이 위치는 이월이 생기기 전/);assert.equal(app.get().logs.length,4);
 assert.equal(app.saveCompleteLog(carryFields({insertAnchor:'finish',insertSide:'after'})),true);assert.equal(app.get().logs.at(-1).carryFrom,'finish');
});
await check('a stale open input reloads the server kill and retries exactly once with the entered values',async()=>{
 const server=clone(fixture().sharedDocument()),app=fixture({withKill:false,sync:true});let reads=0;
 app.evaluate('globalThis').stateRequest=async()=>{reads++;return{revision:11,canEdit:true,authenticated:true,document:server};};
 assert.equal(app.saveCompleteLog(carryFields({damage:'7',note:'입력 보존'})),false);await settle(app);
 assert.equal(reads,1);assert.equal(app.get().logs.length,5);assert.equal(app.get().logs.at(-1).damage,7);assert.equal(app.get().logs.at(-1).note,'입력 보존');assert.equal(app.get().logs.at(-1).carryFrom,'finish');assert.equal(app.sync.revision,11);
 assert.equal(stats(app).carry,0);assert.equal(app.saveCompleteLog(carryFields()),false);assert.equal(app.get().logs.length,5);assert.equal(reads,1);
});
await check('a same-version server response and a failed read never invent a carry or erase the input state',async()=>{
 for(const fail of [false,true]){
  const app=fixture({withKill:false,sync:true}),before=clone(app.get().logs);let reads=0;
  app.evaluate('globalThis').stateRequest=async()=>{reads++;if(fail)throw Error('offline');return{revision:10,canEdit:true,authenticated:true,document:app.sharedDocument()};};
  app.saveCompleteLog(carryFields());await settle(app);assert.equal(reads,1);assert.deepEqual(clone(app.get().logs),before);assert.equal(app.sync.pending,'');
  assert.match(text(app),fail?/확인하지 못했습니다/:/사용할 이월이 없습니다/);
 }
});
await check('a refresh cannot overwrite a new local draft or submit after editing has been locked',async()=>{
 for(const change of ['draft','lock']){
  const server=clone(fixture().sharedDocument()),app=fixture({withKill:false,sync:true});let release;
  app.evaluate('globalThis').stateRequest=()=>new Promise(resolve=>{release=()=>resolve({revision:11,canEdit:true,authenticated:true,document:server});});
  app.saveCompleteLog(carryFields());
  if(change==='draft'){app.get().logs[0].note='동시에 수정';app.evaluate('persistShared()');}else app.get().settings.editable=false;
  release();await settle(app);assert.equal(app.get().logs.length,3);assert.equal(app.sync.revision,10);
  if(change==='draft'){assert.equal(app.get().logs[0].note,'동시에 수정');assert.ok(app.sync.pending);}
 }
});
for(const file of ['../public/app.js','../../docs/compact/app.js']){
 const code=fs.readFileSync(new URL(file,import.meta.url),'utf8');assert.match(code,/async function refreshCarryEntry\(fd\)/);assert.match(code,/carryVerified:true/);assert.match(code,/이월 보유 · 시간 미상/);
}
console.log(checks+' cleanup carry checks passed');
