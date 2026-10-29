import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const snapshot=JSON.parse(readFileSync(new URL('../public/aikurumi-snapshot.json',import.meta.url),'utf8'));
const elements=new Map();
for(const id of ['list','detail','boss','filter','search','month','list-title','summary']){
 elements.set(id,{value:id==='boss'||id==='filter'?'all':'',innerHTML:'',textContent:'',scrollTop:0,handlers:{},
   addEventListener(type,fn){this.handlers[type]=fn;}});
}
globalThis.document={getElementById:id=>elements.get(id)};
globalThis.fetch=async path=>{
 assert.equal(path,'./aikurumi-snapshot.json');
 return {ok:true,json:async()=>snapshot};
};
await import('../public/aikurumi-lab.mjs');
for(let i=0;i<5&&(!elements.get('list').innerHTML.includes('data-item'));i++)
  await new Promise(resolve=>setImmediate(resolve));

test('mobile/desktop source comparison panel receives real data',()=>{
 assert.match(elements.get('list-title').textContent,/215/);
 assert.match(elements.get('summary').textContent,/행동 대상/);
 assert.match(elements.get('list').innerHTML,/data-item/);
 assert.match(elements.get('detail').innerHTML,/원문 전체/);
 const picker=elements.get('filter');picker.value='timeline';picker.handlers.change();
 assert.match(elements.get('detail').innerHTML,/원문 근거/);
 picker.value='all';picker.handlers.change();
 assert.doesNotMatch(elements.get('detail').innerHTML,/<button[^>]*data-action="register"/);
});
test('unmatched actor and no-body filters update the displayed items',()=>{
 const filter=elements.get('filter');
 filter.value='unknown';
 filter.handlers.change();
 assert.match(elements.get('list-title').textContent,/외부 자료/);
 assert.match(elements.get('list').innerHTML,/행동 대상 확인/);
 filter.value='notes';
 filter.handlers.change();
 assert.match(elements.get('detail').innerHTML,/변환 가능한 조작문이 없습니다/);
 filter.value='all';
 filter.handlers.change();
});
test('search by task ID and previous/next navigation work without writes',()=>{
 const search=elements.get('search');
 search.value='14265';
 search.handlers.input();
 assert.match(elements.get('list').innerHTML,/#14265/);
 const initial=elements.get('detail').innerHTML;
 const nav=elements.get('detail').handlers.click;
 nav({target:{closest:()=>({dataset:{nav:'next'}})}});
 assert.match(elements.get('detail').innerHTML,/#14265/);
 assert.ok(initial);
 search.value='';
 search.handlers.input();
});
