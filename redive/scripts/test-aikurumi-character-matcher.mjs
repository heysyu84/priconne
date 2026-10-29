import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveAikurumiParty} from '../public/aikurumi-character-matcher.mjs';
import {previewAikurumiTactic} from '../public/aikurumi-tactic-review.mjs';

const unitMap=JSON.parse(readFileSync(new URL('../data/character-unit-map.json',import.meta.url),'utf8'));
const positionUnits=JSON.parse(readFileSync(new URL('../data/character-positions.json',import.meta.url),'utf8')).units;
const team=[
 {prefabId:118101,unitName:'Ranpha',currentRarity:5},
 {prefabId:132001,unitName:'Echidna (Summer)',currentRarity:5},
 {prefabId:180601,unitName:'Kyaru (Princess)',currentRarity:5},
 {prefabId:106701,unitName:'Homare',currentRarity:5},
 {prefabId:133101,unitName:'Violet',currentRarity:5}
];

test('same five original JP IDs resolve to Korean canonical variants, not translations',()=>{
 const result=resolveAikurumiParty(team,unitMap,positionUnits);
 assert.equal(result.complete,true);
 assert.deepEqual(result.koreanNames,['란파','수키드나','프캬루','호마레','바이올렛']);
 assert.match(result.foreignNames[2],/黑猫/);
 assert.match(result.foreignNames[4],/紫罗兰/);
 assert.equal(result.issues.length,0);
});

test('read-only preview auto-fills Korean names from IDs and keeps user registration locked',()=>{
 const source='全SET 自动ON\n1:11 黑猫 〇〇－〇〇\n1:06 黑猫 自动 OFF\n0:59 紫罗兰 〇〇〇〇〇';
 const t={id:14265,charas:team,damage:45000,autoDamage:31100};
 const l={index:0,remarks:source,link:'https://www.youtube.com/watch?v=example'};
 const p=previewAikurumiTactic(t,l,{unitMap,positionUnits});
 assert.equal(p.characterMatchSource,'korean-unit-id');
 assert.deepEqual(p.matchedKoreanNames,['란파','수키드나','프캬루','호마레','바이올렛']);
 assert.equal(p.issues.some(i=>i.code==='unmatched-korean-names'),false);
 assert.deepEqual(p.rows[0].checked,[true,true,true,true,true,true]);
 assert.equal(p.registrationAllowed,false);
 assert.equal(p.sourceText,source);
});

test('duplicate unit ID and unknown ID never count as valid party',()=>{
 const dup=resolveAikurumiParty([...team.slice(0,4),team[0]],unitMap,positionUnits);
 assert.equal(dup.complete,false);
 assert.equal(dup.issues.some(i=>i.code==='repeated-unit-id'),true);
 const unknown=resolveAikurumiParty([...team.slice(0,4),{prefabId:999999,unitName:'Mystery'}],unitMap,positionUnits);
 assert.equal(unknown.complete,false);
 assert.equal(unknown.issues.some(i=>i.code==='unmapped-unit-id'),true);
 const p=previewAikurumiTactic({charas:[...team.slice(0,4),{prefabId:999999,unitName:'Mystery'}]},
   {remarks:'全SET 自动ON'},{unitMap,positionUnits});
 assert.equal(p.matchedKoreanNames,null);
 assert.equal(p.registrationAllowed,false);
});

test('ambiguous aliases in a party are excluded rather than guessed',()=>{
 const same=resolveAikurumiParty(team,unitMap,positionUnits,
  {'118101':['共通'], '133101':['共通']});
 assert.equal(same.issues.some(i=>i.code==='ambiguous-alias'),true);
 assert.equal(same.rows[0].aliases.includes('共通'),false);
 assert.equal(same.rows[4].aliases.includes('共通'),false);
});

test('human-entered wrong Korean variant cannot override authoritative unit ID',()=>{
 const t={id:1,charas:team};
 const p=previewAikurumiTactic(t,{remarks:'全SET 自动ON'},
  {unitMap,positionUnits,koreanNames:['란파','수에키드나','프캬루','호마레','바이올렛']});
 assert.equal(p.characterMatchSource,'korean-unit-id');
 assert.equal(p.matchedKoreanNames[1],'수키드나');
 assert.equal(p.registrationAllowed,false);
});
