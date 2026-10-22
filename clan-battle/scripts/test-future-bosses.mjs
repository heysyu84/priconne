import test from 'node:test';
import assert from 'node:assert/strict';
import {addMonths,parseStartMonth,buildPreview} from './sync-future-bosses.mjs';

test('Japanese battle month maps to Korean battle month 13 months later',()=>{
 assert.equal(addMonths('2025-09',13),'2026-10');
 assert.equal(addMonths('2025-12',13),'2027-01');
 assert.equal(parseStartMonth('2025-09-23T05:00:00+09:00'),'2025-09');
});
test('match boss identity by prefab ID; not same slot from a different month',()=>{
 const catalog={
  '2026-10':{
   '1':{name:'프로스트 하운드',referenceKey:'1.4',portrait:'a.png'},
   '2':{name:'랜드 슬로스',referenceKey:'2.5'},
   '3':{name:'번사우르스',referenceKey:'3.9'},
   '4':{name:'다크 가고일',referenceKey:'4.2'},
   '5':{name:'글러튼',referenceKey:'5.10'}
  },catalog:{}
 };
 const boss=(slot,prefabId,sourceName='jp')=>({slot,prefabId,sourceName});
 const old={jpMonth:'2025-09',id:1,bosses:[boss(1,101),boss(2,102),boss(3,103),boss(4,104),boss(5,105)]};
 const future={jpMonth:'2025-10',id:2,bosses:[boss(1,102),boss(2,901,'新規'),boss(3,103),boss(4,104),boss(5,105)]};
 const data=buildPreview('2026-10',[old,future],catalog);
 assert.equal(data.months['2026-10'].bosses[0].name,'프로스트 하운드');
 assert.equal(data.months['2026-11'].bosses[0].name,'랜드 슬로스');
 assert.equal(data.months['2026-11'].bosses[1].name,'新規');
 assert.equal(data.months['2026-11'].bosses[1].status,'unmatched');
 assert.equal(data.months['2026-11'].bosses[0].status,'verified');
});
test('unfetched previews remain stored and live battle records are not generated',()=>{
 const data=buildPreview('2026-10',[],{catalog:{}},{months:{'2026-11':{krMonth:'2026-11',bosses:[]}}});
 assert.equal(data.months['2026-11'].krMonth,'2026-11');
 assert.equal(Object.hasOwn(data,'events'),false);
});
