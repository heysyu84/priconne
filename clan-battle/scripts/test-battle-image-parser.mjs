import assert from 'node:assert/strict';
import {
  parseBattleLogText,parseQuickLogText,sortBattleLogRows,
  detectDuplicateRows,validBattleLogRow,matchBossReadings,matchBossPortrait
} from '../public/battle-image-parser.mjs';

const roster=[
 {id:'p1',name:'다람이',aliases:[]},
 {id:'p2',name:'쁘띠어피치',aliases:[]}
];
const bosses=[
 {id:1,name:'데미카리드'},
 {id:2,name:'마담 엘렉트라'},
 {id:3,name:'트라이 로커'}
];
const input=[
 '데미카리드\n실전 4단계째\n입힌 데미지 189633896\n다람이\n일시 2026/09/28 23:53',
 '마담 엘렉트라\n실전 4단계째\n입힌 데미지 272557284\n쁘띠어피치\n일시 2026/09/28 23:48',
 '트라이 로커\n실전 4단계째\n입힌 데미지 360074666\n다람이\n일시 2026/09/28 23:42'
];
const parsed=input.map(text=>parseBattleLogText(text,{roster,bosses}));
assert.equal(parsed.length,3);
assert.deepEqual(parsed.map(row=>row.damage),[189633896,272557284,360074666]);
assert.deepEqual(parsed.map(row=>Number(row.bossId)),[1,2,3]);
assert.deepEqual(parsed.map(row=>row.memberName),['다람이','쁘띠어피치','다람이']);
assert.deepEqual(sortBattleLogRows(parsed).map(row=>row.gameAt),
 ['2026-09-28T23:42','2026-09-28T23:48','2026-09-28T23:53']);
for(const row of parsed)assert.deepEqual(
 validBattleLogRow(row,{monthKey:'2026-09',members:roster,bosses,day:1}),[]);
assert.ok(validBattleLogRow(parsed[0],{monthKey:'2026-10',members:roster,bosses,day:1})
 .includes('현재 클전 월과 다른 날짜'));
assert.deepEqual(detectDuplicateRows([...parsed,parsed[0]],[])
 .map(row=>row.duplicate),[false,false,false,true]);
const quick=parseQuickLogText('다람이 님이\n데미카리드 몬스터를\n189633896 데미지\n'+
 '쁘띠어피치 님이\n마담 엘렉트라 몬스터를\n272557284 데미지',{roster,bosses});
assert.equal(quick.length,2);
assert.deepEqual(quick.map(row=>row.damage),[189633896,272557284]);
assert.ok(quick.every(row=>!row.gameAt));
assert.ok(quick.every(row=>validBattleLogRow(row,{monthKey:'2026-09',members:roster,bosses,day:1})
 .includes('공격 시각 미확인')));
console.log('Battle screenshot parser regression tests: passed');
const overlapping=[{id:'short',name:'다람',aliases:[]},{id:'long',name:'다람이',aliases:[]}];
assert.equal(parseBattleLogText('다람이\n입힌 데미지 410562280',{roster:overlapping}).memberId,'long');
assert.equal(parseBattleLogText('다람\n다람이\n입힌 데미지 410562280',{roster:overlapping}).memberId,'');
assert.equal(parseBattleLogText('다람 님이 공격',{roster:overlapping}).memberId,'short');
assert.equal(parseBattleLogText('질풍리온',{roster:[{id:'a',name:'리온'},{id:'b',name:'질풍리온'}]}).memberId,'b');

for(const damage of ['189633896','189,633,896']){
 const split=parseQuickLogText('다람이 님이\n데미카리드 몬스터를\n입힌 데미지\n'+damage,{roster,bosses});
 assert.equal(split.length,1);assert.equal(split[0].memberId,'p1');assert.equal(split[0].damage,189633896);
}
const wrapped=parseQuickLogText('다람이\n데미카리드\n입힌 데미지\n189633896\n쁘띠어피치\n마담 엘렉트라\n272557284\n데미지',{roster,bosses});
assert.equal(wrapped.length,2);assert.deepEqual(wrapped.map(r=>r.damage),[189633896,272557284]);

assert.equal(parseBattleLogText('직풍리온',{roster:[{id:'short',name:'리온'},{id:'long',name:'질풍리온'}],memberField:true}).memberId,'');
assert.equal(parseBattleLogText('_ 질풍리온',{roster:[{id:'short',name:'리온'},{id:'long',name:'질풍리온'}],memberField:true}).memberId,'long');

const nameCases=[['` 질풍리온',[{id:'a',name:'질풍리온'}],'a'],['ㆍ 아메스',[{id:'a',name:'아메스'}],'a'],['쁘띠어피치',[{id:'a',name:'쁘띠'}],'a'],['다른슈',[{id:'a',name:'슈'}],'']];
for(const [text,roster,id] of nameCases)assert.equal(parseBattleLogText(text,{roster,memberField:true}).memberId,id);
const monthlyBosses=[{id:1,name:'프로스트 하운드'},{id:2,name:'랜드 슬로스'},{id:3,name:'번사우르스'},{id:4,name:'다크 가고일'},{id:5,name:'글러튼'}];
for(const [text,id] of [['[래대스로으',2],['다크마모일',4],['글러트',5],['프로스트하운',1]])assert.equal(matchBossReadings([{text,confidence:90}],monthlyBosses)?.id,id);
assert.equal(matchBossReadings([{text:'아메스',confidence:95}],monthlyBosses),null);
assert.equal(matchBossReadings([{text:'다크가고일',confidence:95}],[{id:1,name:'다크 가고일'},{id:2,name:'다크 가고일 2'}]),null);
assert.equal(matchBossPortrait([.2,.3,.4],[{bossId:3,bossReadScore:1,bossVisual:[.21,.31,.41]},{bossId:4,bossReadScore:1,bossVisual:[.7,.6,.9]}]),3);
assert.equal(matchBossPortrait([.2,.3,.4],[{bossId:3,bossReadScore:1,bossVisual:[.21,.31,.41]},{bossId:4,bossReadScore:1,bossVisual:[.22,.32,.42]}]),null);
console.log('PASS: OCR icon noise, abbreviated names, conservative boss matching and portrait ambiguity');
