import assert from 'node:assert/strict';
import {syncTacticRecommendations,tacticReady,suppressTacticRecommendation} from '../public/tactic-combo-sync.mjs';

const tactic=(id,source='택틱정리')=>({
 id,group:source,boss:2,characters:['라비','파오이','게무기','리리컬','수셰피'],
 stars:['5','5','5','5','5'],expectedDamage:'3.1',
 note:'TP 4.2 · 전장 확인',video:'https://www.youtube.com/watch?v=abc1234',
 rows:[{text:'AUTO 온, 전부 SET'}]
});
const match={id:'legacy-combo',stage:4,boss:2,characters:['라비','파오이','게무기','리리컬','수셰피'],
 stars:['5','5','5','5','5'],expectedDamage:'3.1',tactic:'택틱',tp:'4.3',
 manualCount:'2',note:'손수 입력한 비고',url:'https://www.youtube.com/watch?v=other',
 requiredSeconds:22};
const stage3={id:'stage3',stage:3,boss:1,characters:['A','B','C','D','E'],stars:['5','5','5','5','5']};
const a=tactic('a'),b=tactic('b','타비비토');
const month={tactics:[a,b],recommendations:[structuredClone(match),structuredClone(stage3)]};
assert.equal(tacticReady(a),true);
assert.equal(syncTacticRecommendations(month),true);
assert.equal(month.recommendations.length,3);
assert.equal(month.recommendations.find(x=>x.id==='legacy-combo').sourceTacticId,'a');
const original=JSON.stringify(month.recommendations);
assert.equal(syncTacticRecommendations(month),false,'repeat must be idempotent');
assert.equal(JSON.stringify(month.recommendations),original);
a.characters[0]='알라비';a.expectedDamage='3.8';a.video='https://www.youtube.com/watch?v=new';
assert.equal(syncTacticRecommendations(month),true);
const updated=month.recommendations.find(x=>x.sourceTacticId==='a');
assert.equal(updated.characters[0],'알라비');
assert.equal(updated.expectedDamage,'3.8');
assert.equal(updated.manualCount,'2');
assert.equal(updated.tp,'4.3');
assert.equal(updated.note,'손수 입력한 비고');
assert.equal(updated.url,'https://www.youtube.com/watch?v=other');
assert.equal(updated.requiredSeconds,22);
assert.deepEqual(month.recommendations.find(x=>x.id==='stage3'),stage3);
const generated=month.recommendations.find(x=>x.sourceTacticId==='b');
assert.equal(generated.stage,4);
assert.equal(generated.tactic,'타비');
assert.equal(generated.tp,'4.2');
assert.equal(generated.note,'전장 확인');
assert.equal(suppressTacticRecommendation(month,generated),true);
month.recommendations=month.recommendations.filter(x=>x!==generated);
assert.equal(syncTacticRecommendations(month),false);
assert.equal(month.recommendations.some(x=>x.sourceTacticId==='b'),false);
a.trashedAt='2026-10-23T12:00:00.000Z';
assert.equal(syncTacticRecommendations(month),true);
assert.equal(month.recommendations.some(x=>x.sourceTacticId==='a'),false);
assert.deepEqual(month.recommendations.find(x=>x.id==='stage3'),stage3);
console.log('Tactic-to-recommendation automatic synchronization: passed');
