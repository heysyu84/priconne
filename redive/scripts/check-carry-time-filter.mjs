import assert from 'node:assert/strict';
import {runtimeFixture} from './runtime-fixture.mjs';

let checks=0;
const check=async(name,run)=>{await run();checks++;console.log('PASS '+name);};
function setup(){
 const app=runtimeFixture(),data=app.get(),base=data.tactics.find(t=>t.category==='carry')||data.tactics[0];
 const tactic=(id,seconds,boss=1,extra={})=>({...structuredClone(base),id,stage:4,category:'carry',boss,requiredCarrySeconds:seconds,note:'',hidden:false,deletedAt:null,rows:[{id:id+'-row',text:'0:20 전원 SET',checked:[true,true,true,true,true,false]}],text:'0:20 전원 SET',...extra});
 data.tactics=[tactic('s19',19),tactic('s20',20),tactic('s29','29',2),tactic('s30',30),tactic('s39',39,2),tactic('s40',40),tactic('s49',49,2),tactic('s50',50),tactic('s90',90,2),tactic('unknown',null),tactic('legacy37',null,1,{note:'필요 이월 시간: 37초'}),tactic('hidden30',30,1,{hidden:true}),tactic('deleted30',30,1,{deletedAt:'2026-10-01'}),tactic('main',80,1,{category:'main'})];
 data.rules.carryVisible=true;data.settings.editable=false;
 app.ui.section='tactics';app.ui.tabs.tactics='workspace';app.ui.boss=0;app.ui.libraryOpen=true;app.ext.workGroup='carry';app.ext.carryTimeRange='all';
 const html=()=>app.fullTactics(),ids=()=>[...html().matchAll(/data-action="v2-select-tactic" data-id="([^"]+)"/g)].map(match=>match[1]).sort();
 const change=app.listeners.change.find(handler=>handler.toString().includes("key==='v2-carry-time-range'"));
 const choose=async value=>change({target:{dataset:{input:'v2-carry-time-range'},value}});
 return {app,data,html,ids,choose};
}

await check('required-time bands have no gaps or overlap at 20/29/30/39/40/49/50/90 seconds',()=>{
 const {app,ids}=setup();
 for(const [range,expected]of [['20',['s20','s29']],['30',['legacy37','s30','s39']],['40',['s40','s49']],['50',['s50','s90']]]){
  app.ext.carryTimeRange=range;assert.deepEqual(ids(),expected);
 }
 app.ext.carryTimeRange='all';const all=ids();assert.equal(all.length,11);assert.ok(all.includes('unknown'));assert.ok(all.includes('s19'));
});

await check('the carry-only selector sits between the title and list toggle, with exact seconds kept on cards',()=>{
 const {app,html}=setup(),view=html(),heading=view.indexOf('<h2>택틱 '),filter=view.indexOf('id="carry-time-range"'),toggle=view.indexOf('data-action="toggle-library"');
 assert.ok(heading<filter&&filter<toggle);for(const label of ['전체','20초대','30초대','40초대','50초+'])assert.ok(view.includes('>'+label+'</option>'));
 assert.ok(view.includes('29초 이월'));assert.ok(view.includes('37초 이월'));
 app.ext.workGroup='main';assert.ok(!html().includes('id="carry-time-range"'));
});

await check('readers can filter immediately, expand the list and keep shared records untouched',async()=>{
 const {app,data,html,ids,choose}=setup();html();const before=JSON.stringify(app.sharedDocument());app.ui.libraryOpen=false;
 await choose('30');assert.deepEqual(ids(),['legacy37','s30','s39']);assert.equal(app.ui.libraryOpen,true);assert.ok(html().includes('<h2>택틱 3</h2>'));
 assert.ok(ids().includes(app.ui.selectedTactic));assert.equal(data.settings.editable,false);assert.equal(JSON.stringify(app.sharedDocument()),before);
});

await check('time and boss filters combine without leaking hidden, deleted or normal tactics',()=>{
 const {app,ids}=setup();app.ext.carryTimeRange='20';app.ui.boss=2;assert.deepEqual(ids(),['s29']);
 app.ui.boss=1;assert.deepEqual(ids(),['s20']);app.ext.workGroup='main';app.ext.carryTimeRange='50';assert.deepEqual(ids(),['main']);
});

await check('an empty band shows an empty result instead of another tactic, and All restores the list',async()=>{
 const {app,html,ids,choose}=setup();app.ui.boss=5;await choose('40');assert.deepEqual(ids(),[]);
 const view=html();assert.ok(view.includes('<h2>택틱 0</h2>'));assert.ok(view.includes('해당 시간대의 이월 택틱이 없습니다.'));assert.ok(!view.includes('class="set-grid"'));
 app.ui.boss=0;await choose('all');assert.equal(ids().length,11);
});

await check('switching categories returns to All and invalid filter values cannot alter selection',async()=>{
 const {app,html,choose}=setup();await choose('20');const selected=app.ui.selectedTactic;await choose('other');assert.equal(app.ext.carryTimeRange,'20');assert.equal(app.ui.selectedTactic,selected);
 const click=app.listeners.click.find(handler=>handler.toString().includes("if(action==='v2-work-group')"));
 const group=async value=>click({target:{closest:()=>({dataset:{action:'v2-work-group',value}})},preventDefault(){},stopImmediatePropagation(){}});
 await group('main');assert.ok(!html().includes('id="carry-time-range"'));await group('carry');assert.equal(app.ext.carryTimeRange,'all');assert.ok(html().includes('value="all" selected'));
});

await check('pending text edits are saved on the original tactic before switching the time band',async()=>{
 const {app,data,choose}=setup();data.settings.editable=true;app.ui.selectedTactic='s20';app.ext.workEditing=true;app.ext.gridSaveTimer=1;
 data.tactics.find(t=>t.id==='s20').rows[0].text='0:10 전원 OFF';
 await choose('30');assert.equal(data.tactics.find(t=>t.id==='s20').text,'0:10 전원 OFF');assert.equal(app.ext.gridSaveTimer,null);assert.equal(app.ext.workEditing,false);
});

console.log(`${checks} carry-time filter checks passed`);
