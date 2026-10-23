import assert from 'node:assert/strict';
import {syncTacticRecommendations,migrateTacticConditions,stripTpFromMemo} from '../public/tactic-combo-sync.mjs';

assert.equal(stripTpFromMemo('TP 3.2, 6p 1합류, 육성 확인'),'6p 1합류, 육성 확인');
assert.equal(stripTpFromMemo('필수 : TP 4.1+, 탱커 HP, 마방 4.0+'),'필수 : 탱커 HP, 마방 4.0+');
assert.equal(stripTpFromMemo('TP 4.2 이상 필수'),'');
assert.equal(stripTpFromMemo('TP 4.1 (아마 4.0+ 는 되야 돌아갈 것 같음)'),'');
assert.equal(stripTpFromMemo('단순 메모'),'단순 메모');

const tactic={id:'t1',boss:1,group:'택틱정리',characters:['A','B','C','D','E'],
 stars:['5','5','5','5','5'],expectedDamage:'3.5',note:'필수 : TP 4.1+, 탱커 HP, 마방 4.0+',
 rows:[{text:'AUTO 온',checked:[false,false,false,false,false,true]}]};
const old={id:'old1',stage:4,boss:1,tactic:'택틱',characters:[...tactic.characters],stars:[...tactic.stars],
 expectedDamage:'3.5',manualCount:'0.5',tp:'4.2',note:'TP 4.2, 6p 1합류'};
const month={tactics:[tactic],recommendations:[old]};
assert.equal(migrateTacticConditions(month),true);
assert.equal(tactic.manualCount,'0.5');
assert.equal(tactic.tp,'4.2');
assert.equal(tactic.note,'필수 : 탱커 HP, 마방 4.0+');
assert.equal(old.note,'6p 1합류');
assert.equal(migrateTacticConditions(month),false);
assert.equal(syncTacticRecommendations(month),true);
assert.equal(old.sourceTacticId,'t1');
assert.equal(old.manualCount,'0.5');
assert.equal(old.tp,'4.2');
tactic.manualCount='1.5';
tactic.tp='4.0+';
assert.equal(syncTacticRecommendations(month),true);
assert.equal(old.manualCount,'1.5');
assert.equal(old.tp,'4.0+');
tactic.tp='';
assert.equal(syncTacticRecommendations(month),true);
assert.equal(old.tp,'');
assert.equal(syncTacticRecommendations(month),false);
assert.equal(old.note,'');
assert.equal(old.legacyRecommendationNote,'6p 1합류');

tactic.note='탱커 HP 40만+, 전장 300 필수';
assert.equal(syncTacticRecommendations(month),true);
assert.equal(old.note,'탱커 HP 40만+, 전장 300 필수');
assert.equal(old.legacyRecommendationNote,'6p 1합류');
assert.equal(syncTacticRecommendations(month),false);

tactic.note='수정한 조건';
assert.equal(syncTacticRecommendations(month),true);
assert.equal(old.note,'수정한 조건');

tactic.note='';
assert.equal(syncTacticRecommendations(month),true);
assert.equal(old.note,'');
assert.equal(syncTacticRecommendations(month),false);

console.log('PASS tactic TP/manual-count/memo migration & sync, old memo retained separately');
