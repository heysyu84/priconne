import assert from 'node:assert/strict';
import {syncTacticRecommendations,visibleTacticRecommendations,recommendationDisplayOrder}
 from '../public/tactic-combo-sync.mjs';

const tactic=(id,group,boss,damage)=>({id,group,boss,stars:['5','5','5','5','5'],
 characters:['가'+id,'나'+id,'다'+id,'라'+id,'마'+id],
 expectedDamage:damage,rows:[{text:'AUTO 온, 전부 SET'}]});
const tactics=[
 tactic('one','택틱정리',2,'2.8'),
 tactic('two','택틱정리',1,'3.1'),
 tactic('three','타비비토',1,'2.9'),
 tactic('four','타비비토',2,'3.4')
];
const month={tactics,recommendations:[
 {id:'legacy-unmatched',stage:4,boss:1,characters:['X','Y','Z','W','V'],expectedDamage:'10',tactic:'택틱'},
 {id:'stage3',stage:3,boss:5,remainingSeconds:90,characters:[]}
]};
assert.equal(syncTacticRecommendations(month),true);
const visible=visibleTacticRecommendations(month);
assert.equal(visible.length,5);
assert.equal(visible.some(x=>x.id==='legacy-unmatched'),false);
const ordered=visible.filter(x=>x.stage===4).sort(recommendationDisplayOrder);
assert.deepEqual(ordered.map(x=>x.boss),[1,1,2,2]);
assert.deepEqual(ordered.map(x=>x.expectedDamage),['3.1','2.9','3.4','2.8']);
assert.deepEqual(ordered.map(x=>x.tactic),['택틱','타비','타비','택틱']);
assert.equal(visible.filter(x=>x.stage===3).length,1);
const previous=JSON.stringify(month.recommendations);
assert.equal(syncTacticRecommendations(month),false);
assert.equal(JSON.stringify(month.recommendations),previous);
console.log('Stage-4 recommendation list sorting and de-duplication passed');
