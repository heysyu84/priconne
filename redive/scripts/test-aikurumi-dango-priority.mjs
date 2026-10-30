import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewAikurumiTactic} from '../public/aikurumi-tactic-review.mjs';
import {convertForeignTactic,selectPreferredDangoTimeline} from '../public/tactic-parser.mjs';
import {buildReviewItems} from '../public/aikurumi-review-model.mjs';
import {commandState} from '../public/tactic-set-state.mjs';
import {repairImportedDangoTactics} from '../public/aikurumi-dango-repair.mjs';
import {splitVideoDescription} from './aikurumi-youtube-segments.mjs';

const source=JSON.parse(readFileSync(new URL('../public/aikurumi-snapshot.json',import.meta.url),'utf8'));
const task=source.bosses[0].tasks.find(t=>t.id===14265);
const ordinal=task.links.findIndex(l=>/39000/.test(l.name)&&/さんだ/.test(l.name));
const link=task.links[ordinal];
const options={unitMap:source.characterData.names,positionUnits:source.characterData.positionUnits,stage:source.stage,bossSlot:1,bossNames:source.bosses.map(b=>b.unitName)};
const preview=()=>previewAikurumiTactic(task,link,options);

test('さんだ 3.9억: the initial OOOOO ON is six true flags, not all OFF',()=>{
 assert.ok(link.remarks.includes('【お団子ver.】'));
 assert.equal(selectPreferredDangoTimeline(link.remarks).preferred,true);
 const converted=preview();
 assert.equal(converted.preferredDango,true);
 assert.equal(converted.rows.length,9);
 assert.deepEqual(converted.rows[0].checked,[true,true,true,true,true,true]);
 assert.deepEqual(converted.rows[1].checked,[true,true,false,true,true,true]);
 assert.deepEqual(converted.rows.at(-1).checked,[false,true,true,true,true,true]);
 assert.match(converted.rows[0].text,/전부 SET/);
});

test('mixed prose TL and dango TL is parsed once, from dango section',()=>{
 const raw='全SET AUTO OFF\n0:15 A OFF\n【お団子ver.】\n1:30 〇〇〇〇〇 ON\n0:15 A ー〇〇〇〇 OFF';
 const r=convertForeignTactic(raw,['A','B','C','D','E']);
 assert.equal(r.format,'dango');
 assert.deepEqual(r.rows[0].checked,[true,true,true,true,true,true]);
 assert.deepEqual(r.rows.at(-1).checked,[false,true,true,true,true,false]);
 assert.equal(r.rows.length,2);
});

test('existing source-linked YouTube review uses dango rather than stale YouTube SET flags',()=>{
 const fake={expiresAt:'2099-01-01T00:00:00.000Z',references:[{
  stage:source.stage,boss:1,taskId:task.id,linkIndex:link.index,linkOrdinal:ordinal,
  youtubeHasTactic:true,status:'candidate',rows:[{text:'AUTO 온',checked:[false,false,false,false,false,true]}]
 }]};
 const item=buildReviewItems(source,fake).find(i=>i.task.id===task.id&&i.ordinal===ordinal);
 assert.ok(item);
 assert.equal(item.source,'youtube');
 assert.equal(item.dangoPriority,true);
 assert.deepEqual(item.rows[0].checked,[true,true,true,true,true,true]);
});

test('legacy AUTO-only rows are repaired only when none were manually modified',()=>{
 const correct=preview().rows;
 const party=preview().matchedKoreanNames;
 let previous=[false,false,false,false,false,false];
 const old=correct.map((row,i)=>{
  const text=i===0?'AUTO 온':row.text;
  const checked=commandState(text,previous,party);
  previous=checked;
  return {id:'old-row-'+i,text,checked:[...checked],manualChecks:true};
 });
 const candidate={stage:source.stage,boss:1,taskId:task.id,linkIndex:link.index,linkOrdinal:ordinal,
  rows:[...old.map(r=>({text:r.text,checked:r.checked})),{text:'ㄴ [원문 확인: ver.]',checked:previous}]};
 const makeEntry=rows=>({id:'existing',party,rows:structuredClone(rows),text:rows.map(r=>r.text).join('\n'),
  externalSource:{month:source.krMonth,taskId:task.id,linkOrdinal:ordinal,url:link.link}});
 const entry=makeEntry(old),seasons={[source.krMonth]:{tactics:[entry]}};
 assert.equal(repairImportedDangoTactics(seasons,[source],{references:[candidate]}).repaired,1);
 assert.deepEqual(entry.rows[0].checked,[true,true,true,true,true,true]);
 assert.equal(entry.rows.length,9);
 const changed=structuredClone(old);changed[3].checked[0]=!changed[3].checked[0];
 const manual=makeEntry(changed);
 assert.equal(repairImportedDangoTactics({[source.krMonth]:{tactics:[manual]}},[source],{references:[candidate]}).repaired,0);
 assert.equal(manual.rows[0].checked[0],false);
});

test('YouTube segmentation keeps dango with its parent tactic, not a later variant',()=>{
 const description='1ボス 39000\n1:30 全SET AUTO ON\n0:03 ランファ OFF\n【お団子ver.】\n1:30 〇〇〇〇〇 ON\n0:03 ー〇〇〇〇\n【別編成】39001\n1:30 〇〇〇〇〇 ON';
 const parts=splitVideoDescription(description,source.bosses.map(b=>b.unitName));
 assert.equal(parts.length,2);
 assert.match(parts[0].text,/お団子ver/);
 assert.doesNotMatch(parts[1].text,/お団子ver/);
});
