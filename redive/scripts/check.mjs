import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as engine from '../public/battle-engine.mjs';
import * as parser from '../public/tactic-parser.mjs';
import * as partyTools from '../public/party-tools.mjs';
import * as logOrder from '../public/log-order.mjs';
import * as legacyTools from '../public/legacy-tools.mjs';
import {scaleStyles} from './build-text-scale.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const element=()=>({innerHTML:'',value:'',open:false,dataset:{},classList:{toggle(){},add(){},remove(){}},style:{setProperty(){}},addEventListener(){},focus(){},closest(){return null},querySelector(){return null}});
const elements={app:element(),drawer:element(),toast:element()};
class TestFormData{constructor(values){this.values=values;}get(name){return this.values[name]??null;}has(name){return Object.hasOwn(this.values,name);}}
const ctx={console,Date,Math,Number,String,Array,Object,Set,Map,JSON,RegExp,structuredClone,TextEncoder,FormData:TestFormData,crypto:{randomUUID:crypto.randomUUID},setTimeout(){},clearTimeout(){},localStorage:{getItem(){return null;},setItem(){}},document:{getElementById(id){return elements[id]||(elements[id]=element());},documentElement:element(),body:element(),addEventListener(){}},window:{addEventListener(){},scrollTo(){}},location:{hash:''},history:{replaceState(){},pushState(){}},engineReplay:engine.replayMonth,engineProgress:engine.bossProgress,engineContribution:engine.contribution,engineEstimate:engine.estimateCarry,partyTools,logOrder,legacyTools,...parser};
const bundledCode=fs.readFileSync(root+'public/app.js','utf8').replace(/^import[^\n]+\n/gm,'');
// Keep the original fixture scenarios, then validate the actual October import separately.
let code=bundledCode.replace('applyImportedSnapshot();','');
const exposed='\nthis.test={get:()=>data,ui,ext,renderPage,activateSeason,allSeasonStats,sha256Text,adjustedWithBase,findPlans,parseCarrySheet,parseDelimited,pasteRows,recalculateSeason,saveCompleteLog,deleteCompleteLog,visibleTactics,chartDailyData,chartValue,dailyStackedChart,richBossShare,bossArt,workspaceList,tacticDamageLabel,applyImportedSnapshot,engineMonth,rowTable,profileDayDonut,fullOverview,fullDashboard,fullTactics,workEditor,editCompleteTactic,quickLogForm,settingsRules,battleBossHealth,completeRanking,completeRoster,completeProfile,profilePhaseShares,dailyProfileBars,minimumCarry,thirdStageVisible,applyFutureLineupToSeason,copyFor,fullBattle,completeLogTable,NAV,nav,rankedStats,renderTacticGrid,comboDetailBody,selectTacticRow,recommendationRows,attackSlot,currentBattleDay,dayButtons,completeWorkspace,headerResourceButtons,completeRates,settingsDisplay,textScale,setTextScale,displayTacticNote,sharedDocument,normalizeCarryNotes,entrySearch,entryItems,entryMatches,focusCarryFromDamage,askDeleteLog};';
code+=exposed;
vm.runInNewContext(code,ctx,{timeout:20000});
const q=ctx.test;let checks=0;
function check(name,run){run();checks++;console.log('PASS '+name);}
check('30 members and isolated monthly data',()=>{assert.equal(q.get().members.filter(m=>m.status==='active').length,30);assert.equal(Object.keys(q.get().seasons).length,3);assert.equal(q.get().replayWarnings.length,0);assert.notEqual(q.get().seasons['2026-08'].logs.length+':'+q.get().seasons['2026-08'].logs.reduce((s,e)=>s+e.actual,0),q.get().seasons['2026-09'].logs.length+':'+q.get().seasons['2026-09'].logs.reduce((s,e)=>s+e.actual,0));});
check('all primary and secondary screens render',()=>{let pages=0;for(const[section,tabs]of Object.entries({overview:['bosses','members'],battle:[''],tactics:['combos','workspace','planner','tools','external','converter','trash'],records:['ranking','profile','archive','history','hall'],clan:['members','alumni','rates','characters','settings']}))for(const tab of tabs){q.ui.section=section;if(tab)q.ui.tabs[section]=tab;const html=q.renderPage();assert.ok(html.length>100,section+'/'+tab);assert.ok(!/CLAN BATTLE|RECORDS & INSIGHTS|새로운 흐름|INDEPENDENT DESIGN LAB|한눈에|이어가세요/.test(html));pages++;}for(const page of ['rules','data','access','links']){q.ext.settingsPage=page;assert.ok(q.renderPage().length>100);pages++;}assert.equal(pages,24);});
check('month switches preserve their own log counts',()=>{const count=q.get().logs.length;q.activateSeason('2026-09');assert.equal(q.get().result.sealed,true);q.activateSeason('2026-10');assert.equal(q.get().logs.length,count);});
check('new attack updates HP and delete restores it',()=>{q.ui.day=3;q.ui.section='overview';q.ui.tabs.overview='bosses';const member=q.allSeasonStats().find(s=>s.active&&s.remaining),boss=q.get().bosses.find(b=>!b.locked&&b.hp>125000000);const before=boss.hp,count=q.get().logs.length;const ok=q.saveCompleteLog({memberId:member.member.id,boss:String(boss.id),day:'3',damage:'1.25',unit:'100000000',bonus:'0'});assert.equal(ok,true);assert.equal(q.get().logs.length,count+1);assert.equal(q.get().bosses.find(b=>b.id===boss.id).hp,before-125000000);const event=q.get().logs.at(-1);q.deleteCompleteLog(event.id);assert.equal(q.get().logs.length,count);assert.equal(q.get().bosses.find(b=>b.id===boss.id).hp,before);});
check('next stage waits for all five bosses',()=>{const m={bosses:Array.from({length:5},(_,i)=>({id:i+1,hp:{2:100,3:200},contribution:{}})),levels:[{stage:2,start:1,end:1,count:1},{stage:3,start:2,end:99,count:98}],events:[{id:'a',seq:1,memberId:'m1',boss:1,day:1,damage:100}],options:{startStage:2,dailyAttacks:3}};engine.replayMonth(m);assert.equal(engine.bossProgress(m)[0].locked,true);for(let i=2;i<=5;i++)m.events.push({id:'a'+i,seq:i,memberId:'m'+i,boss:i,day:1,damage:100});engine.replayMonth(m);assert.ok(engine.bossProgress(m).every(b=>!b.locked&&b.stage===3));});
check('boss two laps ahead waits',()=>{const m={bosses:Array.from({length:5},(_,i)=>({id:i+1,hp:{4:100},contribution:{4:1}})),levels:[{stage:4,start:1,end:99,count:99}],events:[1,2].map(i=>({id:'b'+i,seq:i,memberId:'m'+i,boss:1,day:1,damage:100})),options:{startStage:4,dailyAttacks:3}};engine.replayMonth(m);assert.equal(engine.bossProgress(m)[0].locked,true);});
check('first/second attack carry estimate',()=>{assert.equal(engine.estimateCarry({hp:300000000,first:100000000,second:300000000,seconds:90}).seconds,50);assert.ok(engine.estimateCarry({hp:300000000,first:0,second:100000000}).error);});
check('external tactic preserves actions and line breaks',()=>assert.equal(q.adjustedWithBase('1:30 A ON\n1:12 B → C\n0:06 AUTO OFF',56,90),'0:56 A ON\n0:38 B → C\n— AUTO OFF'));
check('quoted CSV and multiline tactic import',()=>{const rows=q.parseDelimited('보스,편성,성급,손컨,TP,기대딜,원본시간,본문\r\n1,"유이 콧코로 페코린느 레이 사렌",55655,0.5,4.2+,1.8,0:56,"0:56 AUTO OFF\n0:30 전원 SET"');const parsed=q.parseCarrySheet(rows);assert.equal(parsed.length,1);assert.equal(parsed[0].duration,56);assert.equal(parsed[0].text.split('\n').length,2);});
check('foreign tactic conversion and six SET columns',()=>{const result=parser.convertForeignTactic('1:30 オートON\n1:00 ユイ SET\n0:30 ユイ 解除',['유이'],['ユイ']);assert.ok(result.text.includes('유이 ON'));assert.ok(result.text.includes('유이 OFF'));assert.ok(result.rows.every(r=>r.checked.length===6));});
check('hidden and deleted tactics stay out of recommendations',()=>{q.ext.stage=4;q.ui.boss=0;const t=q.get().tactics.find(t=>!t.hidden&&!t.deletedAt&&t.stage===4&&t.category==='main');t.hidden=true;assert.ok(!q.visibleTactics().some(x=>x.id===t.id));t.hidden=false;t.deletedAt=1;assert.ok(!q.visibleTactics().some(x=>x.id===t.id));delete t.deletedAt;});
check('three-party planner finds non-overlapping lineups',()=>{q.findPlans();assert.ok(q.ext.foundPlans.length>0);});
check('local password hash is SHA-256',()=>{for(const value of ['','abc','한글 비밀번호'])assert.equal(q.sha256Text(value),crypto.createHash('sha256').update(value).digest('hex'));});
check('charts use the selected month and daily record sums',()=>{
 for(const month of ['2026-09','2026-10']){
  q.activateSeason(month);q.ui.day=3;
  const events=q.get().logs.filter(e=>e.day<=q.ui.day);
  for(const metric of ['damage','contribution']){
   const rows=q.chartDailyData(events,metric),sum=rows.reduce((s,r)=>s+r.total,0),expected=events.reduce((s,e)=>s+(metric==='damage'?e.actual:e.contribution),0);
   assert.ok(Math.abs(sum-expected)<.01);
   assert.equal(rows.filter(r=>r.available).length,3);
  }
 }
 assert.ok(!/NaN|Infinity/.test(q.dailyStackedChart([])+q.richBossShare([])));
 assert.equal(q.chartValue(5609736000,'contribution'),'56.1억');
});
check('all bundled game artwork is present',()=>{
 const catalog=JSON.parse(fs.readFileSync(root+'public/assets/manifest.json','utf8'));
 assert.ok(Object.keys(catalog.bosses).length>=5);
 assert.ok(Object.keys(catalog.characters).length>=25);
 for(const art of [...Object.values(catalog.bosses).map(a=>a.image),...Object.values(catalog.characters).flatMap(c=>Object.values(c))])assert.ok(fs.statSync(root+'public/'+art.replace(/^\.\//,'')).size>1000,art);
 for(const b of q.get().bossSettings)assert.ok(q.bossArt(b));
});
const actualContext={...ctx};
vm.runInNewContext(bundledCode+exposed,actualContext,{timeout:20000});
const imported=actualContext.test,importedData=imported.get(),source=JSON.parse(fs.readFileSync(root+'data/2026-10-source.json','utf8')),original=source.data.months['2026-10'];
check('only October real data replaces the prototype fixtures',()=>{
 assert.deepEqual(Object.keys(importedData.seasons),['2026-10']);assert.equal(imported.ui.month,'2026-10');assert.equal(imported.ui.day,2);
 assert.equal(importedData.members.filter(m=>m.status==='active').length,original.memberIds.length);assert.equal(importedData.members.length,128);assert.equal(importedData.logs.length,original.events.length);assert.equal(importedData.tactics.length,original.tactics.length);
 assert.equal(importedData.importedSource.revision,source.revision);assert.equal(importedData.recommendations.length,original.recommendations.length);
 const roster=JSON.parse(fs.readFileSync(root+'data/roster-reference.json','utf8'));for(const p of importedData.members)assert.equal(p.name,roster.find(r=>r.id===p.id).name);
});
check('every imported attack retains its HP, lap and carry connection',()=>{
 assert.equal(importedData.replayWarnings.length,0);
 for(const row of original.events){const current=importedData.logs.find(e=>e.id===row.id);for(const key of ['seq','day','boss','memberId','damage','before','actual','after','stage','lap','carry','carryFrom','hitIndex','role'])assert.equal(current[key],row[key],row.seq+':'+key);}
 const expected=original.events.reduce((s,e)=>s+e.actual,0),actual=imported.allSeasonStats().reduce((s,p)=>s+p.damage,0);assert.equal(actual,expected);
});
check('43 tactics retain all SET text, states, groups and damage precision',()=>{
 assert.equal(importedData.tactics.length,43);
 for(const prior of original.tactics){const update=JSON.parse(fs.readFileSync(root+'data/tactic-3-4.4-r1432.json','utf8')).tactic,t=prior.id===update.id?update:prior;const current=importedData.tactics.find(c=>c.id===t.id);assert.equal(current.hidden,!!t.hidden);assert.equal(current.party.join('|'),t.characters.join('|'));assert.equal(current.stars.join(''),t.stars.join(''));assert.equal(current.rows.length,t.rows.length);for(let i=0;i<t.rows.length;i++){assert.equal(current.rows[i].text,t.rows[i].text);assert.equal(current.rows[i].checked.join(','),t.rows[i].checked.join(','));}assert.equal(imported.tacticDamageLabel(current),Number(t.expectedDamage).toLocaleString('ko-KR',{maximumFractionDigits:1}));}
 imported.ext.stage=4;imported.ui.boss=0;
 for(const [group,count] of [['main',10],['tabi',6],['carry',25],['hidden',2]]){imported.ext.workGroup=group;assert.equal(imported.workspaceList().length,count,group);}
 assert.equal(imported.visibleTactics().length,16);
 imported.ext.stage=3;assert.equal(imported.visibleTactics().length,5);imported.ext.stage=4;
});
check('all real-data pages render and reloading does not discard local edits',()=>{
 for(const[section,tabs]of Object.entries({overview:['bosses','members'],battle:[''],tactics:['combos','workspace','planner','tools','external','converter','trash'],records:['ranking','profile','archive','history','hall'],clan:['members','alumni','rates','characters','settings']}))for(const tab of tabs){imported.ui.section=section;if(tab)imported.ui.tabs[section]=tab;assert.ok(imported.renderPage().length>100,section+'/'+tab);}
 const note=importedData.logs[0].note;importedData.logs[0].note='local edit';imported.applyImportedSnapshot();assert.equal(importedData.logs[0].note,'local edit');importedData.logs[0].note=note;
});
check('the game ends in stage 4 and tactics have no stage chooser',()=>{
 const month=imported.engineMonth();for(const lap of [251,501,99999])assert.equal(engine.phaseForLap(lap,month),4);
 assert.ok(importedData.rules.levels.every(l=>l.stage<=4));assert.ok(importedData.tactics.every(t=>t.stage===4));
 imported.ui.section='tactics';imported.ui.tabs.tactics='workspace';const html=imported.fullTactics();assert.ok(!html.includes('data-input="v2-work-stage"'));assert.ok(!html.includes('3타 편성'));
 imported.ext.bossDraft=null;const settings=imported.settingsRules();assert.ok(!/value="[56]"[^>]*>[56]단계/.test(settings));
});
check('numeric table headings align and complete lists stay on one page',()=>{
 const html=imported.rowTable(['이름','값'],['<tr><td>A</td><td class="right numeric">10</td></tr>']);assert.ok(html.includes('<th class="right" data-label="값">'));
 imported.ui.section='overview';imported.ui.tabs.overview='bosses';assert.ok(!imported.fullOverview().includes('<h2>남은 타수</h2>'));
 const dashboard=imported.fullDashboard();assert.equal((dashboard.match(/class="dashboard-member"/g)||[]).length,22);
 const profile=imported.profileDayDonut(importedData.logs);assert.ok(profile.includes('ring-chart'));assert.ok(!profile.includes('profile-trend'));
 const editor=imported.workEditor(importedData.tactics[0]);assert.ok(editor.includes('class="set-auto"'));assert.ok(editor.includes('set-check auto-cell'));
});
check('early-stage attacks auto-fill HP while stage 4 keeps manual damage',()=>{
 const context={...ctx};vm.runInNewContext(bundledCode+exposed,context,{timeout:20000});const app=context.test,d=app.get();d.logs=[];d.dayClosures=[];app.ui.day=1;app.recalculateSeason();
 let boss=d.bosses.find(b=>!b.locked),member=d.members[0];assert.equal(boss.stage,2);
 assert.ok(app.saveCompleteLog({memberId:member.id,boss:String(boss.id),day:'1',damage:'',unit:'100000000',autoDamage:'on'}));
 assert.equal(d.logs[0].damage,d.bossSettings.find(b=>b.id===boss.id).hp[2]);assert.equal(d.logs[0].damageMode,'max');assert.equal(d.replayWarnings.length,0);
 d.logs=[];d.rules.levels=[{stage:1,count:0},{stage:2,count:0},{stage:3,count:0},{stage:4,count:9999}];d.rules.startStage=4;app.recalculateSeason();boss=d.bosses.find(b=>!b.locked);
 assert.ok(app.saveCompleteLog({memberId:member.id,boss:String(boss.id),day:'1',damage:'1.25',unit:'100000000',autoDamage:'on'}));assert.equal(d.logs[0].damage,125000000);assert.equal(d.logs[0].damageMode,'manual');assert.equal(d.replayWarnings.length,0);
});

check('battle HP and registration retain full integer values on the same page',()=>{
 imported.ui.section='battle';const html=imported.fullBattle(),health=imported.battleBossHealth();
 for(const boss of importedData.bosses){assert.ok(health.includes(boss.hp.toLocaleString('ko-KR')));assert.ok(health.includes(boss.max.toLocaleString('ko-KR')));}assert.ok(!/[억만]/.test(health));assert.equal((html.match(/data-form="v2-quick-log"/g)||[]).length,1);assert.ok(!html.includes('data-action="add-log"'));assert.ok(html.includes('name="unit" value="1"'));
});
check('all rankings and roster records are visible with unshortened numbers',()=>{
 const ranking=imported.completeRanking();assert.equal((ranking.match(/class="data-table ranking-unified"/g)||[]).length,1);assert.equal((ranking.match(/class="center rank-cell"/g)||[]).length,22);assert.equal((ranking.match(/class="center rank-cell desktop"/g)||[]).length,66);assert.ok(ranking.includes('ranking-columns desktop-ranking'));assert.ok(ranking.includes('table-wrap mobile-ranking'));assert.ok(!ranking.includes('list-pager'));assert.ok(!/[억만]/.test(ranking));assert.ok(ranking.indexOf('data-value="game"')<ranking.indexOf('data-value="contribution"'));assert.ok(ranking.indexOf('data-value="contribution"')<ranking.indexOf('data-value="damage"'));
 imported.ext.rosterQuery='';assert.equal((imported.completeRoster(false).match(/class="numeric uid-cell"/g)||[]).length,22);assert.equal((imported.completeRoster(true).match(/class="numeric uid-cell"/g)||[]).length,128);assert.equal(importedData.members.filter(m=>!m.uid).length,19);assert.ok(!imported.completeRoster(false).includes('data-label="탈퇴"'));
});
check('profile has four monthly phase shares and separate daily damage/contribution bars',()=>{
 const events=importedData.logs.filter(e=>e.memberId===imported.ui.profile),graphs=imported.profilePhaseShares(events);assert.equal((graphs.match(/class="phase-share"/g)||[]).length,4);const bars=imported.dailyProfileBars(events);assert.equal((bars.match(/class="paired-day"/g)||[]).length,5);assert.ok(bars.includes('paired-value damage'));assert.ok(bars.includes('paired-value contribution'));assert.ok(imported.completeProfile().includes('ops-profile-pdf'));
});
check('carry requirements remain separate from the original timeline clock',()=>{
 const tactic=importedData.tactics.find(t=>t.id==='carry-2026-10-1-3');assert.equal(imported.minimumCarry(tactic),26);assert.equal(tactic.duration,90);imported.ui.carry=26;const html=imported.workEditor(tactic);assert.ok(html.includes('26초'));assert.ok(!html.includes('원문 시작'));assert.ok(!html.includes('기준으로 본문 표시'));assert.ok(!html.includes('필요 이월시간:'));assert.equal(tactic.requiredCarrySeconds,26);assert.ok(tactic.note.includes('뉴페코 미보유 가능'));assert.ok(html.includes('data-input="ops-carry-received"'));assert.ok(!html.includes('id="workspace-carry"'));
});
check('stage 3 is available before stage 4 and can be explicitly retained',()=>{
 const bosses=structuredClone(importedData.bosses),mode=importedData.rules.stage3Mode;importedData.rules.stage3Mode='auto';assert.equal(imported.thirdStageVisible(),false);for(const boss of importedData.bosses)boss.stage=3;assert.equal(imported.thirdStageVisible(),true);importedData.bosses=bosses;importedData.rules.stage3Mode='show';assert.equal(imported.thirdStageVisible(),true);importedData.rules.stage3Mode=mode;
});
check('future lineups apply only to empty months without changing HP or multipliers',()=>{
 const season=structuredClone(importedData.seasons['2026-10']);assert.equal(imported.applyFutureLineupToSeason(season,'2026-11'),false);season.logs=[];const numbers=JSON.stringify(season.bossSettings.map(b=>({hp:b.hp,game:b.game})));assert.equal(imported.applyFutureLineupToSeason(season,'2026-11'),true);assert.equal(season.bossSettings[0].name,'와이번');assert.equal(JSON.stringify(season.bossSettings.map(b=>({hp:b.hp,game:b.game}))),numbers);
});
check('signed full-value bonuses affect contribution without changing boss HP',()=>{
 const context={...ctx};vm.runInNewContext(bundledCode+exposed,context,{timeout:20000});const app=context.test,d=app.get();d.logs=[];d.dayClosures=[];app.ui.day=1;app.ui.section='battle';d.rules.levels=[{stage:1,count:0},{stage:2,count:0},{stage:3,count:0},{stage:4,count:9999}];d.rules.startStage=4;app.recalculateSeason();
 const form={memberId:d.members[0].id,boss:'1',day:'1',damage:'1,000,000',unit:'1',bonus:'-1,350,000'};assert.equal(app.saveCompleteLog(form),true);const event=d.logs[0],hp=d.bosses[0].hp,base=engine.contribution({...event,bonus:0},app.engineMonth());assert.equal(event.bonus,-135);assert.equal(event.contribution,base-1350000);
 assert.equal(app.saveCompleteLog({...form,logId:event.id,bonus:'+250,000'}),true);assert.equal(event.contribution,base+250000);assert.equal(d.bosses[0].hp,hp);assert.equal(app.saveCompleteLog({...form,logId:event.id,bonus:'invalid'}),false);assert.equal(event.bonus,25);
 app.ext.details=true;const html=app.completeLogTable(d.logs);assert.ok(html.includes('data-label="가산점"'));assert.ok(html.includes('250,000'));assert.ok(app.quickLogForm().includes('id="quick-bonus"'));assert.ok(app.quickLogForm().indexOf('id="quick-bonus"')<app.quickLogForm().indexOf('<details'));
});
check('clan battle separates situation, dashboard and logs in that order',()=>{
 const context={...ctx,location:{hash:'#battle'}};vm.runInNewContext(bundledCode+exposed,context,{timeout:20000});const app=context.test;assert.equal(app.ui.section,'overview');assert.equal(app.ui.tabs.overview,'logs');assert.equal(app.NAV.length,4);
 let html=app.renderPage();assert.ok(html.includes('data-form="v2-quick-log"'));assert.ok(!html.includes('aria-label="보스 진행 현황"'));assert.ok(html.includes('complete-log-search'));
 app.ui.tabs.overview='bosses';html=app.renderPage();assert.ok(html.includes('class="battle-hud"'));assert.equal((html.match(/aria-label="보스 진행 현황"/g)||[]).length,1);assert.ok(!html.includes('data-form="v2-quick-log"'));assert.ok(html.indexOf('>상황판</button>')<html.indexOf('>대시보드</button>'));assert.ok(html.indexOf('>대시보드</button>')<html.indexOf('>배틀로그</button>'));
 app.ui.tabs.overview='members';const dashboard=app.renderPage();assert.ok(!/피해량|↳|compact-slot/.test(dashboard));assert.equal((dashboard.match(/class="dashboard-member"/g)||[]).length,22);app.nav('battle');assert.equal(app.ui.tabs.overview,'logs');
});
check('each ranking metric sorts the same complete roster and preserves full values',()=>{
 for(const metric of ['game','contribution','damage']){const descending=imported.rankedStats(metric,-1),ascending=imported.rankedStats(metric,1);assert.equal(descending.length,22);for(let i=1;i<22;i++){assert.ok(descending[i-1][metric]>=descending[i][metric]);assert.ok(ascending[i-1][metric]<=ascending[i][metric]);}assert.equal(new Set(descending.map(r=>r.member.id)).size,22);}
});
check('the unified tactic layout and selected reader row preserve all SET states and text',()=>{
 const t=importedData.tactics[0],before=JSON.stringify(t.rows),inline=imported.renderTacticGrid(t);assert.ok(inline.includes('tactic-layout-inline'));assert.ok(!inline.includes('ops-tactic-layout'));assert.ok(!inline.includes('tactic-layout-split'));assert.ok(inline.includes('aria-label="AUTO">A</th>'));assert.equal((inline.match(/type="checkbox"/g)||[]).length,t.rows.length*6);assert.equal(JSON.stringify(t.rows),before);
 const rows=t.rows.slice(0,3).map(r=>({dataset:{row:r.id},selected:false,classList:{toggle(name,on){this.active=on;},contains(){return !!this.active;}},setAttribute(name,value){this[name]=value;}})),table={dataset:{tacticId:t.id},querySelectorAll(){return rows;}};imported.selectTacticRow(table,1);assert.equal(rows[1]['aria-selected'],'true');assert.equal(imported.ext.tacticCursor[t.id],t.rows[1].id);imported.selectTacticRow(table,999);assert.equal(rows[2]['aria-selected'],'true');assert.equal(rows[1]['aria-selected'],'false');assert.equal(JSON.stringify(t.rows),before);
 const body=imported.comboDetailBody(t);assert.ok(!body.includes('class="party"'));assert.ok(body.includes('data-tactic-id="'+t.id+'"'));assert.equal(imported.tacticDamageLabel({damage:1.5}),'1.5');assert.equal(imported.tacticDamageLabel({damage:.7}),'0.7');imported.ui.section='overview';imported.ui.tabs.overview='bosses';assert.ok(!imported.fullOverview().includes('class="raid-link"'));
});
check('keyboard progress moves one row, survives lost focus and restores after reopening',()=>{
 const storage=new Map(),listeners={};const context={...ctx,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},document:{...ctx.document,addEventListener(type,handler){(listeners[type]??=[]).push(handler);}}};vm.runInNewContext(bundledCode+exposed,context,{timeout:20000});const app=context.test,t=app.get().tactics.find(t=>t.rows?.length>=3),rows=t.rows.slice(0,3).map(r=>({dataset:{row:r.id},classList:{toggle(name,on){this.active=on;},contains(){return !!this.active;}},setAttribute(){},scrollIntoView(){}})),table={dataset:{tacticId:t.id},querySelectorAll:()=>rows,closest(selector){return selector==='.tactic-grid-wrap .set-grid'?table:null;}};rows.forEach(row=>row.closest=()=>table);context.document.querySelector=()=>rows.find(r=>r.classList.active);app.selectTacticRow(table,0);
 const handler=listeners.keydown.find(fn=>fn.toString().includes('selectTacticRow'));assert.ok(handler);const press=(key,target=table)=>handler({key,target,preventDefault(){}});press('ArrowDown');assert.equal(app.ext.tacticCursor[t.id],rows[1].dataset.row);press('ArrowDown',context.document.body);assert.equal(app.ext.tacticCursor[t.id],rows[2].dataset.row);press('ArrowUp');assert.equal(app.ext.tacticCursor[t.id],rows[1].dataset.row);press('ArrowDown',{closest:()=>({})});assert.equal(app.ext.tacticCursor[t.id],rows[1].dataset.row);
 const reopened={...ctx,localStorage:context.localStorage};vm.runInNewContext(bundledCode+exposed,reopened,{timeout:20000});const restored=reopened.test,html=restored.renderTacticGrid(restored.get().tactics.find(x=>x.id===t.id));assert.ok(html.includes('data-row="'+rows[1].dataset.row+'" class="tactic-active-row"'));assert.equal(restored.ext.tacticCursor[t.id],rows[1].dataset.row);
});
check('dashboard carry seconds use the existing calculator and update from overkill records',()=>{
 const plain=html=>html.replace(/<[^>]+>/g,'');assert.equal(plain(imported.attackSlot({basic:{id:'a',boss:1,before:300000000,damage:402985074},pending:true},0)),'1/43초');assert.equal(plain(imported.attackSlot({basic:{id:'b',boss:3,before:100,damage:100},pending:true},0)),'3/*');
 const pending=importedData.logs.filter(e=>e.kill&&!e.carry&&!importedData.logs.some(c=>c.carryFrom===e.id));assert.equal(pending.length,2);for(const e of pending){const seconds=engine.estimateCarry({hp:e.before,second:e.damage,seconds:90}).seconds;assert.ok(plain(imported.attackSlot({basic:e,pending:true},0)).includes(seconds+'초'));}assert.ok(pending.some(e=>engine.estimateCarry({hp:e.before,second:e.damage,seconds:90}).seconds===31));assert.ok(pending.some(e=>engine.estimateCarry({hp:e.before,second:e.damage,seconds:90}).seconds===90));
});
check('compact reading keeps portrait headers, visible resources and precise source damage',()=>{
 const t=importedData.tactics[0],grid=imported.renderTacticGrid(t);
 assert.equal((grid.match(/class="set-character-face"/g)||[]).length,5);assert.equal((grid.match(/type="checkbox"/g)||[]).length,t.rows.length*6);
 assert.ok(!grid.includes('본문 클릭 후'));assert.ok(!grid.includes('<th>'+t.party[0]+'</th>'));
 imported.ext.workGroup='main';imported.ui.libraryOpen=true;const workspace=imported.completeWorkspace();
 assert.ok(workspace.includes('work-library expanded'));assert.ok(!workspace.includes('workspace-resources'));const resources=imported.headerResourceButtons();assert.equal((resources.match(/class="button header-resource-button"/g)||[]).length,4);assert.ok(resources.includes('>기존버전</a>'));for(const name of ['망령','세미','이월'])assert.ok(resources.includes('>'+name+'</a>'));
 for(const link of importedData.communityLinks)assert.ok(resources.includes('href="'+link.url+'"'));
 assert.equal(imported.tacticDamageLabel({damage:1.56}),'1.6');assert.equal(imported.tacticDamageLabel({damage:.38}),'0.4');
 const rate=importedData.bossSettings[0].contribution[4];importedData.bossSettings[0].contribution[4]=1.234567;
 assert.ok(imported.completeRates().includes('>1.23</td>'));assert.equal(importedData.bossSettings[0].contribution[4],1.234567);importedData.bossSettings[0].contribution[4]=rate;
 const roster=imported.completeRoster(true),names=[...roster.matchAll(/data-action="(?:profile|edit-member)" data-id="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(names.length,128);assert.ok(names.slice(0,22).every(id=>importedData.members.find(m=>m.id===id).status==='active'));assert.equal((roster.match(/class="roster-active"/g)||[]).length,22);
 assert.ok(imported.dayButtons().includes('day-current'));assert.ok(imported.dayButtons().includes('aria-current="date"'));
});
check('font size defaults to 100%, offers five steps and never changes shared records',()=>{
 const before=JSON.stringify(imported.sharedDocument());assert.equal(imported.textScale(),100);
 for(const scale of [90,95,100,105,110]){imported.setTextScale(scale);assert.equal(imported.textScale(),scale);assert.ok(imported.settingsDisplay().includes('value="'+scale+'" selected'));assert.equal(JSON.stringify(imported.sharedDocument()),before);}
 imported.setTextScale(120);assert.equal(imported.textScale(),110);imported.setTextScale(100);
});
check('hidden and deleted tactic menus require editing mode',()=>{
 const editing=importedData.settings.editable;imported.ui.section='tactics';imported.ui.tabs.tactics='workspace';importedData.settings.editable=false;imported.ext.workGroup='hidden';
 const readonly=imported.fullTactics();assert.ok(!readonly.includes('data-value="hidden"'));assert.ok(!readonly.includes('v2-tactic-trash'));assert.equal(imported.ext.workGroup,'main');assert.ok(readonly.includes('workspace-navigation'));
 importedData.settings.editable=true;const admin=imported.fullTactics();assert.ok(admin.includes('data-value="hidden"'));assert.ok(admin.includes('v2-tactic-trash'));importedData.settings.editable=editing;
});
check('text scaling retains responsive rules and never scales layout widths',()=>{
 const output=scaleStyles('.sample{font-size:13px;width:200px;padding:8px}@media(max-width:760px){.sample{font-size:clamp(12px,2vw,15px)}}');
 assert.ok(output.includes('html[data-text-scale] .sample'));assert.ok(output.includes('font-size:calc((13px) * var(--text-scale,1))'));assert.ok(output.includes('@media(max-width:760px)'));assert.ok(output.includes('clamp(12px,2vw,15px)'));assert.ok(!output.includes('width:200px'));assert.ok(!output.includes('padding:'));
 const reopened={...ctx,localStorage:{getItem:key=>key==='nyang-text-scale-v2'?'105':null,setItem(){}}};vm.runInNewContext(bundledCode+exposed,reopened,{timeout:20000});assert.equal(reopened.test.textScale(),105);assert.ok(reopened.test.settingsDisplay().includes('value="105" selected'));
});
check('attack entry searches members and boss names and Tab goes directly to carry',()=>{
 imported.ext.entryMember=importedData.members[0].id;const html=imported.quickLogForm();assert.ok(html.includes('data-entry-search="member"'));assert.ok(html.includes('data-entry-search="boss"'));assert.ok(!html.includes('<select id="quick-member"'));assert.ok(!html.includes('<select id="quick-boss"'));
 const b=importedData.bosses[0],picker={dataset:{allowLocked:'1'}};assert.ok(imported.entrySearch('boss','test-boss','boss',b.id,true).includes(b.id+' · '+b.name));assert.ok(imported.entryMatches('member','ㄴ',{dataset:{}}).some(item=>item.label==='나르'));assert.ok(imported.entryMatches('boss',String(b.id),picker).some(item=>Number(item.value)===b.id));
 let carryFocus=0,prevented=0;const event={key:'Tab',shiftKey:false,target:{name:'damage',form:{dataset:{form:'v2-quick-log'},querySelector:()=>({focus(){carryFocus++;}})}},preventDefault(){prevented++;}};
 assert.equal(imported.focusCarryFromDamage(event),true);assert.equal(carryFocus,1);assert.equal(prevented,1);event.shiftKey=true;assert.equal(imported.focusCarryFromDamage(event),false);assert.equal(carryFocus,1);
 const table=imported.completeLogTable(importedData.logs.slice(0,2));assert.equal((table.match(/data-action="entry-delete-log"/g)||[]).length,2);assert.ok(table.includes('type="button"'));
});
console.log(`${checks} checks passed`);
