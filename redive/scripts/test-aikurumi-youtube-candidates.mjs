import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {splitVideoDescription,createYouTubeTacticCandidates} from './aikurumi-youtube-candidates.mjs';
const load=n=>JSON.parse(readFileSync(new URL('../public/'+n,import.meta.url),'utf8'));
const snapshots=[load('aikurumi-snapshot-stage3.json'),load('aikurumi-snapshot.json')];
const report=videos=>({videos:videos.map(([id,description])=>({videoId:id,description}))});

test('detect explicit Japanese boss section without treating battle clocks as boss numbers',()=>{
 const sections=splitVideoDescription('【1ボス】\n1:30 AUTO ON\n1:12 ピオ SET\n【2ボス】\n1:30 全SET\n1:04 ネネカ OFF',
   ['ワイバーン','タフガイスト','バジリスク','ウールヴヘジン','レサトパルト']);
 assert.deepEqual(sections.map(s=>s.boss),[1,2]);
 assert.ok(sections[0].text.includes('ピオ'));
 assert.ok(!sections[0].text.includes('ネネカ'));
});

test('multi-boss YouTube cannot apply whole description to every tactic without headings',()=>{
 const output=createYouTubeTacticCandidates(snapshots,report([['gcLTnp88aSo','1:30 全SET 自動ON\n1:08 ピオ SET\n0:31 ピオ OFF']]));
 const matched=output.references.filter(x=>x.videoId==='gcLTnp88aSo');
 assert.equal(matched.length,21);
 assert.ok(matched.every(x=>x.status==='needs-source-check'));
 assert.ok(matched.every(x=>x.matching==='shared-video-without-sections'));
});

test('explicit boss sections match unique references but duplicate options remain review-only',()=>{
 const value='【1ボス】\n1:30 全SET AUTO ON\n1:09 ピオ SET\n0:44 シオリ OFF\n'+
   '【2ボス】\n1:30 全SET AUTO ON\n1:09 ネフィ SET\n0:44 アオイ OFF\n'+
   '【3ボス】\n1:30 全SET AUTO ON\n1:09 キャル SET\n0:44 シズル OFF\n'+
   '【4ボス】\n1:30 全SET AUTO ON\n1:09 ネネカ SET\n0:44 シズル OFF';
 const output=createYouTubeTacticCandidates(snapshots,report([['YYSf-2wPFVA',value]]));
 const matches=output.references.filter(x=>x.videoId==='YYSf-2wPFVA');
 assert.equal(matches.length,4);
 assert.ok(matches.every(x=>x.matching==='unique-boss'));
 assert.ok(matches.every(x=>['candidate','partial','needs-translation-review','no-parsable-timeline'].includes(x.status)));
});
test('public export contains only safe derived previews with a 28-day expiration',()=>{
 const src='1:30 全SET AUTO ON\n1:09 ピオ SET\n0:44 シオリ OFF';
 const output=createYouTubeTacticCandidates(snapshots,report([['JcqLd2C8mTA',src]]),
   {fetchedAt:'2026-10-30T00:00:00.000Z'});
 assert.equal(output.schema,'nyang-youtube-tactic-candidates-v1');
 assert.equal(output.expiresAt,'2026-11-27T00:00:00.000Z');
 assert.equal(output.readOnly,true);
 assert.equal(output.registrationAllowed,false);
 const one=output.references.find(x=>x.videoId==='JcqLd2C8mTA');
 assert.ok(one);
 assert.equal(one.matching,'single-video');
 assert.ok(!JSON.stringify(output).includes('시청해 주셔서 감사합니다'));
 assert.ok(output.references.every(r=>!Object.hasOwn(r,'description')&&!Object.hasOwn(r,'sourceText')&&
   r.rows.every(row=>!Object.hasOwn(row,'source')&&!Object.hasOwn(row,'raw'))));
});

test('unresolved operative fragments remain marked in their rows instead of deleting battle actions',()=>{
 const data=createYouTubeTacticCandidates(snapshots,report([['JcqLd2C8mTA',
  '1:30 全SET AUTO ON\n1:12 ネネカ 後 SET\n1:04 プリキャル 目押し\n0:32 AUTO OFF']]));
 const text=JSON.stringify(data);
 assert.ok(!text.includes('sourceText'));
 const one=data.references.find(r=>r.videoId==='JcqLd2C8mTA');
 assert.ok(one.rows.some(r=>r.time==='1:12'));assert.ok(one.rows.some(r=>r.time==='1:04'));
 assert.equal(one.omittedRows,0);assert.ok(one.unresolvedRows>0);
 assert.ok(one.rows.filter(r=>/[ぁ-ゟァ-ヿ一-龯]/u.test(r.text)).every(r=>r.needsReview));
});
