import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runtimeFixture} from './runtime-fixture.mjs';
let checks=0;
const check=async(name,run)=>{await run();checks++;console.log('PASS '+name);};
const clone=value=>JSON.parse(JSON.stringify(value));
await check('the first frame never exposes tactic management, including an editable browser cache',()=>{
 const first=runtimeFixture(new Map(),{hash:'#tactics/workspace'}),stored=clone(first.get());stored.settings.editable=true;
 const key=first.evaluate('KEY'),storage=new Map([[key,JSON.stringify(stored)]]);
 for(const apiOrigin of [undefined,'https://example.test']){
  const app=runtimeFixture(storage,{hash:'#tactics/workspace',apiOrigin});
  assert.equal(app.get().settings.editable,false);assert.ok(app.frames.length);
  for(const frame of app.frames)assert.doesNotMatch(frame,/data-action="(?:new-tactic|edit-tactic|hide-tactic|v2-tactic-trash)"/);
 }
});
await check('calendar defaults roll over at 05:00 KST even before any attack is recorded today',()=>{
 const app=runtimeFixture();app.get().rules.startDate='2026-10-24';app.get().logs=[];app.get().dayClosures=[];
 const day=iso=>app.evaluate('currentBattleDay('+Date.parse(iso)+')');
 assert.equal(day('2026-10-25T04:59:59+09:00'),1);assert.equal(day('2026-10-25T05:00:00+09:00'),2);
 assert.equal(day('2026-10-28T06:00:00+09:00'),5);assert.equal(day('2026-11-01T00:00:00+09:00'),5);
 assert.equal(day('2026-10-23T12:00:00+09:00'),1);
 delete app.get().rules.startDate;app.get().logs=[{day:2,gameAt:'2026-10-25T18:00'}];assert.equal(day('2026-10-26T06:00:00+09:00'),3);
 app.get().settings.defaultDayMode='manual';app.get().settings.defaultDay=2;assert.equal(app.evaluate('defaultBattleDay()'),2);
 app.ui.section='tactics';app.ui.day=1;app.evaluate("nav('overview')");assert.equal(app.ui.day,2);
});
await check('unhiding changes only the clicked ID and keeps the restored tactic selected in boss order',async()=>{
 const app=runtimeFixture(),data=app.get(),base=clone(data.tactics[0]);data.settings.editable=true;
 const make=(id,boss,hidden,category='main')=>({...clone(base),id,boss,stage:4,hidden,category,deletedAt:null});
 data.tactics=[make('boss4',4,false,'tabi'),make('wanted',2,true,'tabi'),make('other',1,true),make('boss1',1,false,'tabi')];
 app.ui.section='tactics';app.ui.tabs.tactics='workspace';app.ui.boss=5;app.ui.selectedTactic='wanted';app.ext.workGroup='hidden';app.ext.carryTimeRange='20';
 const handler=app.listeners.click.find(fn=>fn.toString().includes('const matches=data.tactics.filter'));
 const click=async id=>{const button={dataset:{action:'hide-tactic',id},closest:selector=>selector==='[data-action]'?button:null};await handler({target:button,preventDefault(){},stopImmediatePropagation(){}});};
 await click('wanted');assert.equal(data.tactics.find(t=>t.id==='wanted').hidden,false);assert.equal(data.tactics.find(t=>t.id==='other').hidden,true);
 assert.equal(app.ui.selectedTactic,'wanted');assert.equal(app.ext.workGroup,'tabi');assert.equal(app.ui.boss,0);assert.equal(app.ext.carryTimeRange,'all');
 assert.deepEqual(clone(app.evaluate('workspaceList().map(t=>t.boss)')),[1,2,4]);
 data.tactics.push(make('other',3,true));await click('other');assert.ok(data.tactics.filter(t=>t.id==='other').every(t=>t.hidden));
});
await check('tactic spinners use tenths while precise carry damage stays editable without rounding',()=>{
 const app=runtimeFixture();app.get().settings.editable=true;app.get().tactics[0].damage=1.57;
 app.evaluate('editCompleteTactic(data.tactics[0].id)');
 const html=app.elements['drawer-body']?.innerHTML||Object.values(app.elements).map(e=>e.innerHTML).join('');
 assert.match(html,/id="tactic-damage"[^>]*step="0\.1"[^>]*value="1\.57"/);
 const listener=app.listeners.input.find(fn=>fn.toString().includes("field?.id==='tactic-damage'"));let base='1.57';
 listener({target:{id:'tactic-damage',value:'3.1',setAttribute:(key,value)=>{if(key==='value')base=value;}}});assert.equal(base,'3.1');
});
await check('CSV controls are absent and print controls follow admin mode across record views',()=>{
 const app=runtimeFixture();
 for(const editable of [false,true]){
  app.get().settings.editable=editable;
  for(const tab of ['ranking','profile','archive','history','hall','chronicle']){
   app.ui.section='records';app.ui.tabs.records=tab;app.ext.archiveView='summary';const html=app.fullRecords();
   assert.doesNotMatch(html,/<button[^>]+data-action="[^"]*csv/i);
   if(!editable)assert.doesNotMatch(html,/<button[^>]+data-action="[^"]*print/i);
  }
 }
 app.get().settings.editable=true;app.ui.tabs.records='ranking';assert.match(app.fullRecords(),/data-action="print"/);
});
await check('imported months share the chooser, lifetime awards and full historical stage range',()=>{
 const app=runtimeFixture(),sample=JSON.parse(fs.readFileSync(new URL('../public/history-2024/2024-01.json',import.meta.url)));
 const months=[2024,2025].flatMap(y=>JSON.parse(fs.readFileSync(new URL('../public/history-'+y+'/manifest.json',import.meta.url))).months);
 app.evaluate('oldResumeIndex='+JSON.stringify({months})+';oldResumeMonth="2024-01";oldResumeData='+JSON.stringify(sample)+';');
 app.ui.section='records';app.ui.tabs.records='archive';app.ext.archiveView='summary';
 const html=app.fullRecords();assert.equal((html.match(/id="archive-month"/g)||[]).length,1);assert.equal((html.match(/<option[^>]* selected/g)||[]).length,1);
 assert.match(html,/<optgroup label="2024년">/);assert.match(html,/<summary>1단계<\/summary>/);assert.match(html,/<summary>5단계<\/summary>/);
 for(const view of ['logs','ranking','profile','tactics']){app.ext.archiveView=view;const body=app.fullRecords();assert.equal((body.match(/id="archive-month"/g)||[]).length,1);assert.doesNotMatch(body,/NaN|undefined/);}
 app.ext.archiveView='profile';assert.match(app.fullRecords(),/<option value="5"[^>]*>5단계/);
 const history=app.completeHistory();assert.equal((history.match(/2024\.01/g)||[]).length,1);assert.match(history,/winner-person"><b>1위<\/b>/);assert.match(history,/winner-person"><b>2위<\/b>/);
 assert.doesNotMatch(app.completeHall(),/별도|1위 \d+ \/ 2위/);
 app.evaluate("switchMonthTo('2026-10',true)");assert.equal(app.evaluate('oldResumeMonth'),'');assert.match(app.fullRecords(),/value="2026-10" selected/);
});
await check('the clan archive contains sourced events and excludes membership counts',()=>{
 const app=runtimeFixture();app.ui.section='records';app.ui.tabs.records='chronicle';const html=app.fullRecords();
 assert.match(html,/리리다이브/);assert.match(html,/궁극 연성/);assert.match(html,/2025\.10/);assert.match(app.evaluate('CLAN_ARCHIVE_SOURCE'),/gid=1411801387/);assert.doesNotMatch(html,/원본|메코/);assert.match(html,/메이코패스/);
 assert.doesNotMatch(html,/\d+인|\d+명|클랜원 수|참가 인원/);
});
console.log(checks+' startup/archive regression checks passed');
