import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {splitVideoDescription,createYouTubeTacticCandidates} from './aikurumi-youtube-candidates.mjs';
import {matchedYouTubeSegment,youtubeStartSeconds} from './aikurumi-youtube-segments.mjs';
import {normalizeYouTubeTimeline} from './aikurumi-youtube-timeline.mjs';
const load=n=>JSON.parse(readFileSync(new URL('../public/'+n,import.meta.url),'utf8'));
const snapshots=[load('aikurumi-snapshot-stage3.json'),load('aikurumi-snapshot.json')];
const report=videos=>({videos:videos.map(([id,description])=>({videoId:id,description}))});
test('YouTube aliases and direct converter rules produce one once-only row after Violet',()=>{
 const text='1:30 ○○✕○○ オートオフ\n0:59 スミレ ○○○○○\nキャル ○○✕○○\n0:50 BOSS ○○○○○\nキャル ○○✕○○';
 const data=createYouTubeTacticCandidates(snapshots,report([['3XR7r4dwSJI',text]]));
 const item=data.references.find(r=>r.videoId==='3XR7r4dwSJI');assert.ok(item);assert.equal(item.rows.length,3);
 assert.equal(item.rows[1].text,'0:59 바이올렛 후 프캬루 한번만');assert.equal(item.rows[1].needsReview,false);
 assert.deepEqual(item.rows[1].checked,[true,true,false,true,true,false]);
 assert.equal(item.rows[2].text,'0:50 보스 후 프캬루 한번만');
});
test('YouTube candidate rows shorten four-member commands and keep their exact SET flags',()=>{
 const text='1:30 ○○○○○ オートオン\n0:30 キャル ✕✕○✕✕\n0:20 キャル ✕✕✕✕✕\n0:10 スミレ ○○✕○○';
 const data=createYouTubeTacticCandidates(snapshots,report([['3XR7r4dwSJI',text]]));
 const item=data.references.find(r=>r.videoId==='3XR7r4dwSJI');assert.ok(item);
 assert.equal(item.rows[1].text,'0:30 프캬루 후 프캬루 제외 OFF');
 assert.deepEqual(item.rows[1].checked,[false,false,true,false,false,true]);
 assert.equal(item.rows[3].text,'0:10 바이올렛 후 프캬루 제외 ON');
 assert.deepEqual(item.rows[3].checked,[true,true,false,true,true,true]);
 assert.equal(item.rows[1].needsReview,false);assert.equal(item.rows[3].needsReview,false);
});
test('starred timed OX instructions stay in one timeline, including the 420-million source link',()=>{
 const text='1:30 ○○○○○ オートオン\n1:11 キャル ○○✕○○\n1:06 キャル ○○✕○○ オートオフ\n0:59 ヴァイオレット ○○○○○\n☆0:43 キャル(エイドcl)✕✕○○✕\n0:35 ランファ ○✕✕○✕\n☆0:33-32 キャル オートオン\n0:29 エキドナ ○○✕○✕ オートオフ\n☆0:17 キャル ○○○○✕ オートオン\n0:01 キャル';
 const sections=splitVideoDescription(text,[]);assert.equal(sections.length,1);
 const output=createYouTubeTacticCandidates(snapshots,report([['3XR7r4dwSJI',text]]));
 const ref=output.references.find(r=>r.videoId==='3XR7r4dwSJI');assert.ok(ref);assert.ok(['single-video','unique-party-section'].includes(ref.matching));
 assert.equal(ref.youtubeHasTactic,true);assert.ok(ref.rows.length>=10);assert.equal(ref.omittedRows,0);
 assert.ok(ref.rows.some(r=>r.time==='0:43'));assert.ok(ref.rows.some(r=>r.time==='0:17'));
 assert.ok(ref.rows.some(r=>r.time==='0:43'&&r.checked.filter(Boolean).length===2));
 assert.ok(ref.issues.includes('time-range'));
 const variants=splitVideoDescription('【編成1 4.2億】\n1:30 ○○○○○ AUTO ON\n0:01 キャル\n【編成2 3.9億】\n1:30 ○○○○○ AUTO ON\n0:01 キャル',[]);
 assert.equal(variants.length,2);
});
test('an unrecognized costume shorthand cannot silently become a different party costume',()=>{
 const snapshot=snapshots[1],task=snapshot.bosses.flatMap(b=>b.tasks).find(t=>t.charas.some(c=>snapshot.characterData.names[c.prefabId]?.includes('윈유니')));assert.ok(task);
 const text=normalizeYouTubeTimeline('1:12 水ユニ SET',{task,snapshot});assert.match(text,/水ユニ/);assert.doesNotMatch(text,/水윈유니/);
});

test('detect explicit Japanese boss section without treating battle clocks as boss numbers',()=>{
 const sections=splitVideoDescription('【1ボス】\n1:30 AUTO ON\n1:12 ピオ SET\n【2ボス】\n1:30 全SET\n1:04 ネネカ OFF',
   ['ワイバーン','タフガイスト','バジリスク','ウールヴヘジン','レサトパルト']);
 assert.deepEqual(sections.map(s=>s.boss),[1,2]);
 assert.ok(sections[0].text.includes('ピオ'));
 assert.ok(!sections[0].text.includes('ネネカ'));
});
test('video start timestamps and rounded chapter damage resolve only one precise source variant',()=>{
 assert.equal(youtubeStartSeconds('https://youtu.be/abcdefghijk?t=2m8s'),128);
 const snapshot=snapshots[1],task=snapshot.bosses[0].tasks[0];
 const ref={stage:6,boss:1,task,snapshot,link:{name:'33065',link:'https://youtu.be/abcdefghijk'}},other={...ref,task:{...task,id:task.id+1},link:{name:'38600'}};
 const sections=[{boss:1,text:'ワイバーン 3.31億',startSeconds:128},{boss:1,text:'ワイバーン 3.86億',startSeconds:240}];
 assert.equal(matchedYouTubeSegment(sections,ref,[ref,other]).segment,sections[0]);
 const collision={...ref,task:{...task,id:task.id+2},link:{name:'33120'}};
 assert.equal(matchedYouTubeSegment(sections,ref,[ref,collision]).segment,null);
});
test('a second TL starting below 1:30 is split, while a boss UB cue stays inside its battle',()=>{
 const sections=splitVideoDescription('【1ボス】\n1:16 キャル\n1:07 ワイバーン UB\n0:03 キャル\n1:16 キャル\n0:02 キャル',['ワイバーン']);
 assert.equal(sections.length,2);assert.match(sections[0].text,/1:07 ワイバーン UB/);assert.doesNotMatch(sections[1].text,/1:07/);
});
test('a Japanese author-comment TL wins over an empty description, without silently selecting Chinese',()=>{
 const output=createYouTubeTacticCandidates(snapshots,{videos:[{videoId:'JcqLd2C8mTA',description:'動画の目次',commentsStatus:'complete',authorTimelines:[{id:'comment',text:'1:30 全SET AUTO ON\n1:12 AUTO OFF\n0:32 AUTO ON'}]}]});
 const item=output.references.find(r=>r.videoId==='JcqLd2C8mTA');assert.equal(item.tacticLocation,'author-comment');assert.equal(item.commentId,'comment');assert.equal(item.youtubeHasTactic,true);assert.ok(item.rows.length>=3);
});
test('unavailable comments never certify that a YouTube TL is absent',()=>{
 const output=createYouTubeTacticCandidates(snapshots,{videos:[{videoId:'JcqLd2C8mTA',description:'概要',commentsStatus:'failed'}]});
 const item=output.references.find(r=>r.videoId==='JcqLd2C8mTA');assert.equal(item.youtubeHasTactic,null);assert.equal(item.status,'needs-source-check');
});
test('a chapter-only full-auto compilation is not mistaken for a written battle timeline',()=>{
 const output=createYouTubeTacticCandidates(snapshots,{videos:[{videoId:'gcLTnp88aSo',description:'全ボスフルオート紹介\n0:00 はじめに\n2:08 ワイバーン 33,065万\n3:45 ワイバーン 29,490万\n5:12 タフガイスト 26,175万',commentsStatus:'complete'}]});
 const refs=output.references.filter(r=>r.videoId==='gcLTnp88aSo');assert.equal(refs.length,21);
 assert.ok(refs.every(r=>r.status==='no-youtube-tl'&&r.youtubeHasTactic===false&&r.rows.length===0));
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
