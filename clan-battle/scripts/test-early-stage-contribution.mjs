import assert from 'node:assert/strict';
import {earlyStageContributionMultiplier,replayMonth,contribution} from '../public/engine.mjs';

for(const hp of [12000000,15000000,20000000,23000000,30000000,50000000,56000000,64000000,70000000,85000000]){
  const coefficient=earlyStageContributionMultiplier(hp);
  assert.ok(Math.abs(hp*coefficient-15750000)<0.000001);
}
assert.equal(earlyStageContributionMultiplier(12000000),1.3125);
assert.equal(earlyStageContributionMultiplier(0),null);
const month={options:{startStage:2,dailyAttacks:3,autoContribution:false,contributionBaseline:30000000},levels:[{stage:2,start:1,end:1,count:1},{stage:3,start:2,end:2,count:1},{stage:4,start:3,end:99,count:97}],bosses:[{id:1,hp:{2:12000000,3:50000000,4:100000000},contribution:{2:99,3:99,4:.2}}],events:[{id:'first',seq:1,day:1,boss:1,member:'A',damage:12000000},{id:'second',seq:2,day:1,boss:1,member:'B',damage:50000000}]};
replayMonth(month);
assert.equal(contribution(month.events[0],month),15750000);
assert.equal(contribution(month.events[1],month),15750000);
assert.equal(month.bosses[0].contribution[4],.2,'stage-4 manual coefficients stay unchanged');
month.bosses[0].hp[2]=24000000;replayMonth(month);
assert.equal(month.bosses[0].contribution[2],.65625);
assert.equal(contribution(month.events[0],month),7875000,'partial damage receives proportional contribution after an HP change');
month.options.contributionBaseline=40000000;replayMonth(month);
assert.equal(month.bosses[0].contribution[2],.875);
console.log('PASS: stage-2/3 HP-based contribution, partial hits, changed baselines and independent stage-4 settings');
