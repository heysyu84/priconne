import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeFixture} from './runtime-fixture.mjs';
import {decodeLegacy,encodeLegacy} from '../public/legacy-codec.mjs';

function fixture(){
 const f=runtimeFixture();f.get().settings.editable=true;f.get().rules.stage3Mode='show';f.ext.stage=3;
 const base={...structuredClone(f.get().tactics.find(t=>t.stage===4)),hidden:false};
 f.get().recommendations=[{...structuredClone(base),id:'stage3-a',stage:3,category:'recommendation',recommendationOnly:true,deletedAt:null},
  {...structuredClone(base),id:'stage4-recommendation',stage:4,deletedAt:null}];
 f.get().tactics.push({...structuredClone(base),id:'stage3-legacy',stage:3,deletedAt:null});
 return f;
}
function click(f,action,id){
 const handler=f.listeners.click.find(fn=>String(fn).includes("startsWith('stage3-')"));assert.ok(handler);
 const button={dataset:{action,id}};handler({target:{closest:()=>button},preventDefault(){},stopImmediatePropagation(){}});
}
test('stage 3 deletion and restoration preserve stage 4 and all other months',()=>{
 const f=fixture(),data=f.get(),otherMonths=JSON.stringify(data.seasons),stage4=JSON.stringify(data.tactics.filter(t=>t.stage===4));
 assert.match(f.recommendationRows(),/stage3-delete/);click(f,'stage3-delete-confirm','stage3-a');
 assert.ok(data.recommendations[0].deletedAt);assert.doesNotMatch(f.recommendationRows(),/data-combo="stage3-a"/);
 click(f,'stage3-restore','stage3-a');assert.equal(data.recommendations[0].deletedAt,null);
 assert.match(f.recommendationRows(),/data-combo="stage3-a"/);assert.equal(JSON.stringify(data.seasons).includes('stage3-a'),true);
 assert.equal(JSON.stringify(data.tactics.filter(t=>t.stage===4)),stage4);
 const initialOther=JSON.parse(otherMonths);for(const month of Object.keys(initialOther))if(month!==f.ui.month)assert.equal(JSON.stringify(data.seasons[month]),JSON.stringify(initialOther[month]));
});
test('reset moves all current-month stage 3 parties to recoverable trash, without reviving legacy fallback parties',()=>{
 const f=fixture(),data=f.get(),stage4=JSON.stringify(data.tactics.filter(t=>t.stage===4));
 click(f,'stage3-reset-confirm',f.ui.month);
 const records=f.evaluate('stage3RecommendationRecords()');assert.ok(records.length>=2);assert.ok(records.every(t=>t.deletedAt));
 assert.match(f.recommendationRows(),/등록된 조합이 없습니다/);assert.match(f.recommendationRows(),/stage3-trash/);
 assert.equal(data.recommendations.find(t=>t.id==='stage4-recommendation').deletedAt,null);
 assert.equal(JSON.stringify(data.tactics.filter(t=>t.stage===4)),stage4);
 click(f,'stage3-restore','stage3-legacy');assert.match(f.recommendationRows(),/data-combo="stage3-legacy"/);
});
test('readers, sealed months and stale month confirmations cannot reset or delete parties',()=>{
 const f=fixture(),before=JSON.stringify(f.get().recommendations);
 f.get().settings.editable=false;assert.doesNotMatch(f.recommendationRows(),/stage3-delete|stage3-reset/);
 click(f,'stage3-reset-confirm',f.ui.month);assert.equal(JSON.stringify(f.get().recommendations),before);
 f.get().settings.editable=true;f.get().result.sealed=true;click(f,'stage3-delete-confirm','stage3-a');assert.equal(JSON.stringify(f.get().recommendations),before);
 f.get().result.sealed=false;click(f,'stage3-reset-confirm','1999-01');assert.equal(JSON.stringify(f.get().recommendations),before);
});
for(const copy of [false,true])test('new month begins without prior stage 3 parties; stage 4 copy = '+copy,()=>{
 const f=fixture(),data=f.get(),month='2026-11',oldRecommendations=JSON.stringify(data.recommendations),oldLogs=JSON.stringify(data.logs);
 const form={month,...(copy?{copyTactics:true}:{}),dataset:{form:'v2-new-month'}};form.closest=()=>form;
 const handler=f.listeners.submit.find(fn=>String(fn).includes("kind==='v2-new-month'"));assert.ok(handler);
 handler({target:form,preventDefault(){},stopImmediatePropagation(){}});
 assert.equal(f.ui.month,month);assert.equal(data.recommendations.length,0);assert.equal(data.tactics.filter(t=>t.stage===3).length,0);
 assert.equal(data.tactics.length,copy?data.seasons['2026-10'].tactics.filter(t=>t.stage!==3&&!t.deletedAt).length:0);
 assert.equal(data.logs.length,0);assert.equal(JSON.stringify(data.seasons['2026-10'].recommendations),oldRecommendations);assert.equal(JSON.stringify(data.seasons['2026-10'].logs),oldLogs);
});
test('stage 3 soft deletion and restoration survive the original storage format',()=>{
 const f=fixture(),reference=f.sharedDocument(),month=f.ui.month,season=reference.seasons[month];
 const root={months:{[month]:{month,options:{days:5,dailyAttacks:3,startStage:2},bosses:season.bossSettings,levels:season.rules.levels,events:[],tactics:[],recommendations:[],memberIds:[],membership:{}}},roster:[],clanHistory:[],hallOfFame:[]};
 const doc=decodeLegacy(root,{},reference);doc.seasons[month].recommendations=[{...structuredClone(season.recommendations[0]),deletedAt:12345}];
 const encoded=encodeLegacy(doc,root,{},reference),decoded=decodeLegacy(encoded.data,{},reference);
 assert.equal(decoded.seasons[month].recommendations[0].deletedAt,12345);
 decoded.seasons[month].recommendations[0].deletedAt=null;
 const saved=encodeLegacy(decoded,encoded.data,{},reference),restored=decodeLegacy(saved.data,{},reference);
 assert.equal(restored.seasons[month].recommendations[0].deletedAt,null);
});
