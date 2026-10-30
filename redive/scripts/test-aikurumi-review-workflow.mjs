import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as model from '../public/aikurumi-review-model.mjs';
import {decodeLegacy,encodeLegacy} from '../public/legacy-codec.mjs';
import {runtimeFixture} from './runtime-fixture.mjs';
const load=n=>JSON.parse(readFileSync(new URL('../public/'+n,import.meta.url),'utf8'));
const snapshots=[load('aikurumi-snapshot-stage3.json'),load('aikurumi-snapshot.json')],youtube=load('aikurumi-youtube-candidates.json');
const items=snapshots.flatMap(s=>model.buildReviewItems(s,youtube));
function reviewed(item){const d=model.reviewDraft(item);d.confirmed=true;d.rows=[{text:'1:30 전부 SET, AUTO 온',checked:[true,true,true,true,true,true]}];if(item.damage.ambiguous)d.damage=item.damage.options[0];return d;}
function fixture(){const f=runtimeFixture(),context=f.evaluate('this');context.model=model;f.evaluate('externalReviewModule=this.model; data.settings.editable=true;');return f;}

test('expected damage belongs to the selected video, with variant choices kept separate',()=>{
 const task={damage:45000,autoDamage:31100};
 assert.equal(model.sourceDamage(task,{name:'全set 33065\n油管 A',type:20}).value,3.3065);
 assert.equal(model.sourceDamage(task,{name:'36290/41740\n油管 B',type:10}).value,null);
 assert.deepEqual(model.sourceDamage(task,{name:'36290/41740\n油管 B',type:10}).options,[3.629,4.174]);
 assert.equal(model.sourceDamage(task,{name:'余52+20s\n油管 C',type:20}).value,3.11);
 assert.equal(model.sourceDamage(task,{name:'39000',damage:40500,type:10}).value,4.05);
});
test('TP and training conditions are extracted independently of the timeline and damage',()=>{
 const c=model.extractTacticConditions({}, {},{notes:'属性等级:暗Lv953\n属性技能强化:6页目全\n大师技能:99个(物理造成伤害+1%)\n职阶强化:【增幅者】初动TPLv4☆3\nLv358',originalLineup:[]});
 assert.equal(c.tp,'4.3');assert.ok(c.fields.some(f=>f.label==='속성 레벨'&&f.value==='어둠 Lv953'));
 assert.ok(c.fields.some(f=>f.label==='마스터 스킬'&&f.value.includes('99개')));
});
test('YouTube is authoritative while missing, expired and ambiguous matches never turn into Chinese defaults',()=>{
 const matched=items.find(i=>i.stage===4&&i.candidate?.youtubeHasTactic===true&&i.preview.rows.length);assert.ok(matched);
 assert.equal(matched.source,'youtube');assert.deepEqual(matched.rows,matched.candidate.rows);
 const missing=model.buildReviewItems(snapshots[1],{...youtube,references:[]}).find(i=>i.key===matched.key);
 assert.equal(missing.source,'youtube');assert.equal(missing.rows.length,0);
 const expired=model.buildReviewItems(snapshots[1],youtube,{now:Date.parse(youtube.expiresAt)+1}).find(i=>i.key===matched.key);
 assert.equal(expired.source,'youtube');assert.equal(expired.rows.length,0);
 const noTL=items.find(i=>i.candidate?.youtubeHasTactic===false&&i.candidate.status==='no-youtube-tl');assert.equal(noTL.source,'aikurumi');
});
test('an unreviewed, empty or unresolved timeline cannot be registered',()=>{
 const item=items.find(i=>i.stage===4&&i.preview.matchedKoreanNames),draft=reviewed(item);
 draft.confirmed=false;assert.throws(()=>model.buildReviewedTactic(item,draft,{id:'x'}),/확인/);
 draft.confirmed=true;draft.rows=[];assert.throws(()=>model.buildReviewedTactic(item,draft,{id:'x'}),/조작문/);
 draft.rows=[{text:'[원문 확인: 未翻訳]',checked:Array(6).fill(false)}];assert.throws(()=>model.buildReviewedTactic(item,draft,{id:'x'}),/미해석/);
});
test('full carry and remaining-plus-bonus preserve different timing semantics',()=>{
 const full=items.find(i=>i.stage===3&&i.carryDetail.status==='full');assert.ok(full);
 const a=model.buildReviewedTactic(full,reviewed(full),{id:'full'});assert.equal(a.remainingSeconds,90);assert.equal(a.requiredSeconds,null);
 const partial=items.find(i=>i.stage===3&&i.carryDetail.status==='remaining-plus-bonus');assert.ok(partial);
 const b=model.buildReviewedTactic(partial,reviewed(partial),{id:'partial'});
 assert.equal(b.requiredSeconds,90-partial.carryDetail.remainingSeconds);assert.equal(b.remainingSeconds,partial.carry);
});
test('administrator menu is hidden from viewers including direct review hashes',()=>{
 const f=fixture();f.get().settings.editable=false;f.ui.tabs.tactics='review';
 assert.doesNotMatch(f.fullTactics(),/data-value="review"|external-tactic-review/);
 assert.equal(f.ui.tabs.tactics,'workspace');f.get().settings.editable=true;
 assert.match(f.fullTactics(),/data-value="review"/);
});
test('reviewed stage 3 goes to recommendations and stage 4 goes to tactics, with repeat imports updating by source',async()=>{
 const f=fixture(),data=f.get(),sourceMonth='2026-11',beforeLogs=JSON.stringify(data.logs),beforeSeasons=JSON.stringify(data.seasons['2026-10']);
 const stage3=items.find(i=>i.stage===3&&i.preview.matchedKoreanNames&&i.carry!==null),stage4=items.find(i=>i.stage===4&&i.preview.matchedKoreanNames);
 const a=reviewed(stage3),b=reviewed(stage4);a.createMonth=true;b.createMonth=true;
 const apply=f.evaluate('applyExternalReviewedTactics');
 await apply([{item:stage3,draft:a},{item:stage4,draft:b}]);
 assert.equal(data.seasons[sourceMonth].recommendations.length,1);assert.equal(data.seasons[sourceMonth].tactics.length,1);
 const id=data.seasons[sourceMonth].tactics[0].id;b.damage=4.25;
 await apply([{item:stage4,draft:b}]);assert.equal(data.seasons[sourceMonth].tactics.length,1);
 assert.equal(data.seasons[sourceMonth].tactics[0].id,id);assert.equal(data.seasons[sourceMonth].tactics[0].damage,4.25);
 assert.equal(JSON.stringify(data.logs),beforeLogs);assert.equal(JSON.stringify(data.seasons['2026-10']),beforeSeasons);
 assert.equal(data.seasons[sourceMonth].bossSettings[0].name,'와이번');assert.equal(data.seasons[sourceMonth].logs.length,0);
});
test('locked or unauthorized application cannot create months or change tactics',async()=>{
 const f=fixture(),item=items.find(i=>i.stage===4&&i.preview.matchedKoreanNames),draft=reviewed(item);draft.createMonth=true;
 f.get().settings.editable=false;const before=JSON.stringify(f.get().seasons);
 await assert.rejects(f.evaluate('applyExternalReviewedTactics')([{item,draft}]),/관리자/);
 assert.equal(JSON.stringify(f.get().seasons),before);
});
test('source identity, exact damage, SET flags and conditions survive the production legacy codec',()=>{
 const f=fixture(),reference=f.sharedDocument(),item=items.find(i=>i.stage===4&&i.preview.matchedKoreanNames);
 const month='2026-11',season=structuredClone(reference.seasons['2026-10']);season.logs=[];season.tactics=[];season.recommendations=[];
 const root={months:{[month]:{month,options:{days:5,dailyAttacks:3,startStage:2},bosses:season.bossSettings,levels:season.rules.levels,events:[],tactics:[],recommendations:[],memberIds:[],membership:{}}},roster:[],clanHistory:[],hallOfFame:[]};
 const base=decodeLegacy(root,{},reference),draft=reviewed(item);draft.damage=3.3065;draft.tp='4.3+';draft.note='초동 TP 조건';
 const tactic=model.buildReviewedTactic(item,draft,{id:'import-exact'});base.seasons[month].tactics.push(tactic);
 const output=encodeLegacy(base,root,{},reference),decoded=decodeLegacy(output.data,{},reference);
 const actual=decoded.seasons[month].tactics[0];assert.equal(actual.externalSource.key,item.sourceKey);
 assert.equal(actual.damage,3.3065);assert.equal(actual.tp,'4.3+');assert.equal(actual.note,'초동 TP 조건');
 assert.deepEqual(actual.rows[0].checked,tactic.rows[0].checked);assert.equal(model.findImportedTactic(decoded.seasons[month],item).id,tactic.id);
});
