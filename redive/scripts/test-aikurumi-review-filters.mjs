import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewAikurumiTactic} from '../public/aikurumi-tactic-review.mjs';
import {filterReviewItems,reviewFlags,reviewSummary} from '../public/aikurumi-review-filters.mjs';

const snap=JSON.parse(readFileSync(new URL('../public/aikurumi-snapshot.json',import.meta.url),'utf8'));
const items=[];
for(const b of snap.bosses)for(const t of b.tasks){
 const links=t.links?.length?t.links:[{index:0,name:'원본 링크 없음',remarks:''}];
 for(const [i,l]of links.entries()){
   items.push({id:[b.index,t.id,l.index??i,i].join(':'),boss:b,task:t,link:l,
     preview:previewAikurumiTactic(t,l,{unitMap:snap.characterData.names,
       positionUnits:snap.characterData.positionUnits,stage:snap.stage,
       bossSlot:b.index,bossNames:snap.bosses.map(x=>x.unitName)})});
 }
}
test('filters classify the real snapshot without implying any tactic is verified',()=>{
 const sum=reviewSummary(items);
 assert.equal(sum.total,215);
 assert.equal(sum.timeline,132);
 assert.equal(sum.notes,83);
 assert.ok(sum.warning>0);
 assert.ok(sum.unknown>0);
 assert.ok(sum.clean>=0);
 assert.equal(items.some(item=>item.preview.registrationAllowed),false);
});
test('all filter dimensions work independently and do not modify source',()=>{
 for(const [mode,key]of [['timeline','timeline'],['clean','clean'],['warning','warning'],['unknown','unknown'],['notes','notes']]){
   const values=filterReviewItems(items,{mode});
   assert.equal(values.length,reviewSummary(items)[key],mode);
 }
 const oneBoss=filterReviewItems(items,{boss:'2'});
 assert.ok(oneBoss.length>0);
 assert.ok(oneBoss.every(item=>item.boss.index===2));
 const search=filterReviewItems(items,{query:'14265'});
 assert.ok(search.length>0);
 assert.ok(search.every(item=>String(item.task.id).includes('14265')));
});
test('no warnings is only a formatting classification, not permission to import',()=>{
 const rows=filterReviewItems(items,{mode:'clean'});
 assert.ok(rows.length>0);
 for(const item of rows){
   assert.equal(reviewFlags(item.preview).noWarnings,true);
   assert.equal(item.preview.registrationAllowed,false);
 }
});
