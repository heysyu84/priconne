import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assignSupports, characterKey, expectedDamage, planThreeAttacks} from '../public/combo-planner.mjs';

function validOwnParties(parties, result) {
  assert.ok(result, 'A support assignment must exist');
  const own = parties.flatMap((party, index) => party.filter(name => name !== result.supports[index]));
  assert.equal(new Set(own).size, own.length, 'An owned character cannot appear in two attacks');
  assert.equal(result.supports.filter(Boolean).length, result.borrowCount);
}
const disjoint = [['a','b','c','d','e'],['f','g','h','i','j'],['k','l','m','n','o']];
assert.equal(assignSupports(disjoint).borrowCount, 0);
const shared = [['a','b','c','d','e'],['a','f','g','h','i'],['a','j','k','l','m']];
validOwnParties(shared, assignSupports(shared));assert.equal(assignSupports(shared).borrowCount, 2);
const cycle = [['a','b','c','d','e'],['a','f','g','h','i'],['b','f','j','k','l']];
validOwnParties(cycle, assignSupports(cycle));assert.equal(assignSupports(cycle).borrowCount, 3);
assert.equal(assignSupports([['a','b','c','d','e'],['a','b','c','f','g'],['h','i','j','k','l']]), null);
assert.equal(assignSupports([['a','b','c','d','e'],['a','b','f','g','h'],['a','b','i','j','k']]), null);
assert.equal(assignSupports([['a','a','b','c','d'],...disjoint.slice(1)]), null);
assert.equal(assignSupports([['','a','b','c','d'],...disjoint.slice(1)]), null);
const catalog = [{name:'루이즈마리', aliases:['루이즈','마리']}, {name:'루이즈마리(서머)', aliases:['수마리']}];
assert.equal(characterKey(' 루이즈 ', catalog), characterKey('마리', catalog));
assert.notEqual(characterKey('루이즈', catalog), characterKey('수마리', catalog));
for (const value of ['', null, undefined, '-', '미정', 0, -1, Infinity]) assert.equal(expectedDamage(value), null);
assert.equal(expectedDamage('3.1억'), 3.1);

const combo = (id, boss, chars, damage, extra = {}) => ({id, stage:4, boss, characters:chars, stars:['5','5','5','5','5'], expectedDamage:damage, manualCount:0, ...extra});
const fixture = [combo('first',1,disjoint[0],3.1),combo('second',2,disjoint[1],3.2),combo('third',3,disjoint[2],3.6)];
const aliasFixture = [combo('a',1,['루이즈','a','b','c','d'],4),combo('b',2,['마리','e','f','g','h'],3),combo('c',3,['i','j','k','l','m'],2)];
const aliasResult = planThreeAttacks(aliasFixture,catalog).plans[0];
assert.equal(aliasResult.borrowCount,1);validOwnParties(aliasResult.attacks.map(attack=>attack.keys),{supports:aliasResult.attacks.map(attack=>attack.supportKey),borrowCount:1});
assert.equal(planThreeAttacks(fixture,[],{bossIds:[1,2]}).plans.length,0);
assert.equal(planThreeAttacks(fixture).plans[0].totalDamage,9.9);
const repeat = fixture.map((value,index)=>({...value,boss:index<2?1:2}));
assert.equal(planThreeAttacks(repeat).plans.length,0);
assert.equal(planThreeAttacks(repeat,[],{distinctBosses:false}).plans[0].route,'1-1-2');
const many = Array.from({length:24},(_,i)=>combo('high-'+i,1,['a','b','c','d','x'+i],100-i));
many.push(combo('low-a',2,['f','g','h','i','j'],1),combo('low-b',3,['k','l','m','n','o'],1));
assert.equal(planThreeAttacks(many).plans[0].totalDamage,102,'Lower-ranked candidates must remain searchable');

// Independent oracle: try every per-team choice (own all five, or borrow
// any one of the five) rather than selecting owners of shared characters.
function bruteBorrowCount(parties) {
  let best = Infinity;
  for(let a=-1;a<5;a++)for(let b=-1;b<5;b++)for(let c=-1;c<5;c++) {
    const indices=[a,b,c],own=parties.flatMap((party,i)=>party.filter((_,j)=>j!==indices[i]));
    if(new Set(own).size===own.length)best=Math.min(best,indices.filter(index=>index>=0).length);
  }
  return best;
}
function brutePlans(items, distinct) {
  const routes=new Map();
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)for(let k=j+1;k<items.length;k++) {
    const picks=[items[i],items[j],items[k]],bosses=picks.map(value=>value.boss).sort((a,b)=>a-b);
    if(distinct&&new Set(bosses).size<3)continue;
    const borrowed=bruteBorrowCount(picks.map(value=>value.characters));
    if(!Number.isFinite(borrowed))continue;
    const total=picks.reduce((sum,value)=>sum+Number(value.expectedDamage),0),route=bosses.join('-'),previous=routes.get(route);
    if(!previous||total>previous[0]||(total===previous[0]&&borrowed<previous[1]))routes.set(route,[total,borrowed]);
  }
  return [...routes.values()].sort((a,b)=>b[0]-a[0]||a[1]-b[1]).slice(0,5);
}
let randomState=5381;
const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/2**32;};
for(let trial=0;trial<36;trial++) {
  const items=Array.from({length:8},(_,index)=>{
    const names=new Set();while(names.size<5)names.add('c'+Math.floor(random()*19));
    return combo('trial-'+index,1+Math.floor(random()*5),[...names],1+Math.floor(random()*8));
  });
  const before=JSON.stringify(items);
  for(const distinctBosses of [true,false]) {
    const actual=planThreeAttacks(items,[],{distinctBosses});
    assert.deepEqual(actual.plans.map(plan=>[plan.totalDamage,plan.borrowCount]),brutePlans(items,distinctBosses));
    for(const plan of actual.plans)validOwnParties(plan.attacks.map(attack=>attack.keys),{supports:plan.attacks.map(attack=>attack.supportKey),borrowCount:plan.borrowCount});
  }
  assert.equal(JSON.stringify(items),before,'Recommendations are read-only');
}

const source=JSON.parse(fs.readFileSync(new URL('../public/guild-source.json',import.meta.url),'utf8'));
const recommendations=source.recommendations['2026-10'],original=JSON.stringify(recommendations);
const productionCatalog=JSON.parse(fs.readFileSync(new URL('../public/characters.json',import.meta.url),'utf8')).characters;
const result=planThreeAttacks(recommendations,productionCatalog);
assert.equal(result.plans.length,5);assert.equal(result.plans[0].totalDamage,9.9);
for(const plan of result.plans)validOwnParties(plan.attacks.map(attack=>attack.keys),{supports:plan.attacks.map(attack=>attack.supportKey),borrowCount:plan.borrowCount});
assert.equal(JSON.stringify(recommendations),original);
console.log('PASS: exact three-attack optimization, per-attack support matching, alias/variant rules, boss constraints, untruncated candidates and 72 randomized brute-force comparisons');
