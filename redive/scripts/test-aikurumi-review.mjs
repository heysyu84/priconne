import test from 'node:test';
import assert from 'node:assert/strict';
import {previewAikurumiTactic} from '../public/aikurumi-tactic-review.mjs';

const task={id:14265,type:2,charas:[
 {prefabId:118101,unitName:'Ranpha',currentRarity:5,rank:38},
 {prefabId:132001,unitName:'Echidna (Summer)',currentRarity:5,rank:38},
 {prefabId:180601,unitName:'Kyaru (Princess)',currentRarity:5,rank:38},
 {prefabId:106701,unitName:'Homare',currentRarity:5,rank:38},
 {prefabId:133101,unitName:'Violet',currentRarity:5,rank:38}
],damage:45000,autoDamage:31100,halfAutoDamage:39000};
const source='全SET 自动ON\n1:11 黑猫 〇〇－〇〇\n1:06 黑猫 自动 OFF';
const link={index:1,name:'39000 工場長',link:'https://www.youtube.com/watch?v=example',remarks:source};
const kor=['란파','수에키드나','프캬루','호마레','바이올렛'];

test('review preview preserves source, original IDs and six SET/AUTO states',()=>{
 const p=previewAikurumiTactic(task,link,{koreanNames:kor,sourceAliases:['兰法龙','','黑猫','','紫罗兰'],bossSlot:1,stage:4});
 assert.equal(p.sourceText,source);
 assert.equal(p.sourceTaskId,14265);
 assert.equal(p.sourceLinkIndex,1);
 assert.equal(p.originalLineup[0].prefabId,118101);
 assert.equal(p.originalLineup[1].rank,38);
 assert.equal(p.matchedKoreanNames[2],'프캬루');
 assert.deepEqual(p.rows[0].checked,[true,true,true,true,true,true]);
 assert.equal(p.status,'needs-review');
 assert.equal(p.registrationAllowed,false);
 assert.deepEqual(p.damageRaw,{manual:45000,auto:31100,halfAuto:39000,easyManual:null});
});

test('missing manually confirmed Korean names never masquerades as validated',()=>{
 const p=previewAikurumiTactic(task,link);
 assert.equal(p.matchedKoreanNames,null);
 assert.equal(p.issues.some(x=>x.code==='unmatched-korean-names'),true);
 assert.equal(p.registrationAllowed,false);
});

test('source note without actions remains notes-only and is never invented as tactic',()=>{
 const p=previewAikurumiTactic(task,{index:2,remarks:'水菲最后可能死'});
 assert.equal(p.status,'notes-only');
 assert.equal(p.rows.length,0);
 assert.equal(p.notes,'水菲最后可能死');
 assert.equal(p.registrationAllowed,false);
});

test('source equipment preamble is preserved alongside timeline rather than parsed as SET',()=>{
 const original='水璃亚 ★5 R38 全部\n◆TL\n1:30 开始(✕〇〇〇〇) 自动ON';
 const p=previewAikurumiTactic(task,{index:3,remarks:original},{koreanNames:kor});
 assert.equal(p.sourceText,original);
 assert.match(p.notes,/R38/);
 assert.doesNotMatch(p.timeline,/R38/);
 assert.equal(p.rows[0].checked.length,6);
});

test('incomplete source lineup is invalid and never creates editable action rows',()=>{
 const p=previewAikurumiTactic({...task,charas:task.charas.slice(0,4)},link,{koreanNames:kor});
 assert.equal(p.status,'invalid');
 assert.equal(p.rows.length,0);
 assert.equal(p.registrationAllowed,false);
});

test('unrecognized instruction is flagged, not silently registered',()=>{
 const p=previewAikurumiTactic(task,{index:4,remarks:'全SET 自动ON\n0:30 无法识别的特殊条件'},{koreanNames:kor});
 assert.equal(p.issues.some(x=>x.code==='unparsed-instructions'),true);
 assert.equal(p.registrationAllowed,false);
});

test('ambiguous one-second source timing ranges remain visible and require review',()=>{
 const raw='全SET 自动ON\n1:17-16 黑猫 ON\n1:09 紫罗兰 OFF';
 const p=previewAikurumiTactic(task,{index:5,remarks:raw},{koreanNames:kor,sourceAliases:['兰法龙','','黑猫','','紫罗兰']});
 assert.equal(p.sourceText,raw);
 assert.ok(p.issues.some(issue=>issue.code==='time-range'&&issue.message.includes('1:17-16')));
 assert.equal(p.registrationAllowed,false);
});
