import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runtimeFixture} from './runtime-fixture.mjs';
import {estimateCarry,replayMonth} from '../public/battle-engine.mjs';
import {convertForeignTactic} from '../public/tactic-parser.mjs';

let checks=0;
const check=(name,run)=>{run();checks++;console.log('PASS '+name);};
const app=runtimeFixture(),data=app.get();
const source=JSON.parse(fs.readFileSync(new URL('../data/2026-10-source.json',import.meta.url),'utf8')).data;
const month=source.months['2026-10'];
check('real imported records replace the design fixtures and start read-only',()=>{
 assert.equal(data.settings.editable,false);
 assert.deepEqual(Object.keys(data.seasons),['2026-10']);
 assert.equal(data.logs.length,month.events.length);assert.equal(data.tactics.length,month.tactics.length);
 assert.equal(data.members.length,128);assert.equal(data.members.filter(m=>m.status==='active').length,month.memberIds.length);
 const prior=new Map(month.events.map(e=>[e.id,e]));
 for(const event of data.logs)for(const key of ['id','seq','day','boss','memberId','damage','carry'])assert.equal(event[key],prior.get(event.id)[key]);
 assert.equal(data.replayWarnings.length,0);
});
check('every current primary and secondary view renders',()=>{
 let count=0;
 for(const [section,tabs]of Object.entries({overview:['bosses','dashboard','logs'],tactics:['combos','workspace','tools','external','converter','trash'],records:['ranking','profile','archive','history','hall','chronicle'],clan:['members','alumni','rates','characters','settings']})){
  for(const tab of tabs){app.ui.section=section;app.ui.tabs[section]=tab;const html=app.renderPage();assert.ok(html.length>100,section+'/'+tab);assert.doesNotMatch(html,/INDEPENDENT DESIGN LAB|독립된 디자인 시제품|화면 체험용/);count++;}
 }
 assert.equal(count,20);
});
check('rendering records leaves every shared record unchanged',()=>{
 const before=JSON.stringify(app.sharedDocument());
 for(const tab of ['ranking','profile','archive','history','hall','chronicle']){app.ui.section='records';app.ui.tabs.records=tab;app.renderPage();}
 assert.equal(JSON.stringify(app.sharedDocument()),before);
});
check('authenticated editing adds one precise attack and deletion restores the month',()=>{
 data.settings.editable=true;app.ui.section='overview';app.ui.tabs.overview='logs';app.ui.day=2;
 const candidate=app.allSeasonStats().find(s=>s.active&&s.remaining),boss=data.bosses.find(b=>!b.locked);
 assert.ok(candidate);assert.ok(boss);const count=data.logs.length;
 assert.equal(app.saveCompleteLog({memberId:candidate.member.id,boss:String(boss.id),day:'2',damage:'1',unit:'1',bonus:'0'}),true);
 assert.equal(data.logs.length,count+1);assert.equal(data.logs.at(-1).damage,1);
 app.deleteCompleteLog(data.logs.at(-1).id);assert.equal(data.logs.length,count);
});
check('safe integer HP and carry calculations retain one-HP precision',()=>{
 const m=structuredClone(month);m.options.autoContribution=false;m.events=[{id:'one-hp',seq:1,day:1,boss:1,memberId:'fixture',damage:Number(m.bosses[0].hp[m.options.startStage])-1,carry:false}];
 replayMonth(m);assert.equal(m.events[0].after,1);
 assert.equal(estimateCarry({hp:599999999,second:900000000}).seconds,51);
 assert.ok(estimateCarry({hp:1.1,second:10}).error);
});
check('foreign tactic conversion retains actor names and all six SET columns',()=>{
 const parsed=convertForeignTactic('1:30 オートON\n1:00 ユイ SET\n0:30 ユイ 解除',['유이'],['ユイ']);
 assert.match(parsed.text,/유이 ON/);assert.match(parsed.text,/유이 OFF/);assert.ok(parsed.rows.every(r=>r.checked.length===6));
});
console.log(checks+' current-interface checks passed');
