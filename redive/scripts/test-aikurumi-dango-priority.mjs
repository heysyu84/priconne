import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewAikurumiTactic} from '../public/aikurumi-tactic-review.mjs';
import {convertForeignTactic,selectPreferredDangoTimeline} from '../public/tactic-parser.mjs';
import {buildReviewItems} from '../public/aikurumi-review-model.mjs';
import {repairImportedDangoTactics} from '../public/aikurumi-dango-repair.mjs';
import {splitVideoDescription} from './aikurumi-youtube-segments.mjs';

const source=JSON.parse(readFileSync(new URL('../public/aikurumi-snapshot.json',import.meta.url),'utf8'));
const task=source.bosses[0].tasks.find(t=>t.id===14265);
const ordinal=task.links.findIndex(l=>/39000/.test(l.name)&&/さんだ/.test(l.name));
const link=task.links[ordinal];
const options={unitMap:source.characterData.names,positionUnits:source.characterData.positionUnits,
 stage:source.stage,bossSlot:1,bossNames:source.bosses.map(b=>b.unitName)};
const preview=()=>previewAikurumiTactic(task,link,options);
const row=(text,checked)=>({text,checked,needsReview:false});
const candidate=(overrides={})=>({stage:source.stage,boss:1,taskId:task.id,linkIndex:link.index,linkOrdinal:ordinal,
 youtubeHasTactic:true,status:'candidate',rows:[row('1:30 AUTO 오프, 프캬루 SET',[false,false,true,false,false,false])],...overrides});
const bundle=entry=>({expiresAt:'2099-01-01T00:00:00.000Z',references:[entry]});
const chosen=entry=>buildReviewItems(source,bundle(entry)).find(i=>i.task.id===task.id&&i.ordinal===ordinal);

test('Sanda 3.9 Chinese dango is internally valid, but is NOT selected over YouTube',()=>{
 const chinese=preview();
 assert.equal(selectPreferredDangoTimeline(link.remarks).preferred,true);
 assert.equal(chinese.preferredDango,true);
 assert.deepEqual(chinese.rows[0].checked,[true,true,true,true,true,true]);
 const youtube=candidate();
 const item=chosen(youtube);
 assert.equal(item.source,'youtube');
 assert.equal(item.dangoPriority,false);
 assert.deepEqual(item.rows,youtube.rows);
 assert.notDeepEqual(item.rows,chinese.rows);
});

test('Only confirmed absence of YouTube TL allows Chinese dango fallback',()=>{
 const absent=chosen(candidate({youtubeHasTactic:false,status:'no-youtube-tl',rows:[]}));
 assert.equal(absent.source,'aikurumi');
 assert.equal(absent.dangoPriority,true);
 assert.deepEqual(absent.rows[0].checked,[true,true,true,true,true,true]);
 const uncertain=chosen(candidate({youtubeHasTactic:null,status:'video-unavailable',rows:[]}));
 assert.equal(uncertain.source,'youtube');
 assert.equal(uncertain.dangoPriority,false);
 assert.equal(uncertain.rows.length,0);
 const partial=chosen(candidate({youtubeHasTactic:true,status:'needs-source-check',rows:[]}));
 assert.equal(partial.source,'youtube');
 assert.equal(partial.rows.length,0);
});

test('Within a single TL, the dango O/X mode takes precedence over its prose mode',()=>{
 const raw='全SET AUTO OFF\n0:15 A OFF\n【お団子ver.】\n1:30 〇〇〇〇〇 ON\n0:15 A ー〇〇〇〇 OFF';
 const converted=convertForeignTactic(raw,['A','B','C','D','E']);
 assert.equal(converted.format,'dango');
 assert.deepEqual(converted.rows[0].checked,[true,true,true,true,true,true]);
 assert.deepEqual(converted.rows.at(-1).checked,[false,true,true,true,true,false]);
 assert.equal(converted.rows.length,2);
});

test('Previously imported Chinese rows can only restore a complete, trusted YouTube TL',()=>{
 const original=preview().rows.map((r,i)=>({id:'row-'+i,text:r.text,checked:[...r.checked],manualChecks:false}));
 const makeEntry=rows=>({id:'existing',party:preview().matchedKoreanNames,rows:structuredClone(rows),
  text:rows.map(r=>r.text).join('\n'),externalSource:{month:source.krMonth,taskId:task.id,
  linkOrdinal:ordinal,url:link.link,source:'youtube'}});
 const cleanVideo=candidate({rows:[row('1:30 AUTO 온, 전부 SET',[true,true,true,true,true,true])]});
 const apply=(entry,video)=>repairImportedDangoTactics({[source.krMonth]:{tactics:[entry]}},[source],bundle(video));
 const saved=makeEntry(original);
 assert.equal(apply(saved,cleanVideo).repaired,1);
 assert.equal(saved.rows.length,1);
 assert.deepEqual(saved.rows[0].checked,[true,true,true,true,true,true]);
 const unresolved=makeEntry(original);
 assert.equal(apply(unresolved,candidate({status:'partial',rows:[{...cleanVideo.rows[0],needsReview:true}]})).repaired,0);
 assert.equal(unresolved.rows.length,9);
 const manuallyEdited=structuredClone(original);manuallyEdited[0].manualChecks=true;
 const manual=makeEntry(manuallyEdited);
 assert.equal(apply(manual,cleanVideo).repaired,0);
 assert.equal(manual.rows.length,9);
});

test('YouTube segmentation retains only the paired dango continuation',()=>{
 const description='1ボス 39000\n1:30 全SET AUTO ON\n0:03 ランファ OFF\n【お団子ver.】\n1:30 〇〇〇〇〇 ON\n0:03 ー〇〇〇〇\n【別編成】39001\n1:30 〇〇〇〇〇 ON';
 const sections=splitVideoDescription(description,source.bosses.map(b=>b.unitName));
 assert.equal(sections.length,2);
 assert.match(sections[0].text,/お団子ver/);
 assert.doesNotMatch(sections[1].text,/お団子ver/);
});
