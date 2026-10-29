import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const snapshot=JSON.parse(readFileSync(new URL('../public/aikurumi-snapshot.json',import.meta.url),'utf8'));
const stage3=JSON.parse(readFileSync(new URL('../public/aikurumi-snapshot-stage3.json',import.meta.url),'utf8'));
const elements=new Map();
for(const id of ['list','detail','boss','filter','search','month','list-title','summary','operation','stage3-section','compose-output','compose-button','compose-mode']){
 elements.set(id,{value:id==='boss'||id==='filter'||id==='operation'?'all':id==='compose-mode'?'full-auto':id==='month'?'6':'',innerHTML:'',textContent:'',scrollTop:0,hidden:false,handlers:{},
   addEventListener(type,fn){this.handlers[type]=fn;}});
}
elements.get('month').options=[{value:'6',textContent:''},{value:'3',textContent:''}];
globalThis.document={getElementById:id=>elements.get(id)};
globalThis.fetch=async path=>{
 assert.ok(['./aikurumi-snapshot.json','./aikurumi-snapshot-stage3.json'].includes(path));
 return {ok:true,json:async()=>path.includes('stage3')?stage3:snapshot};
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
 nav({target:{closest:selector=>selector==='button[data-nav]'?{dataset:{nav:'next'}}:null}});
 assert.match(elements.get('detail').innerHTML,/#14265/);
 assert.ok(initial);
 search.value='';
 search.handlers.input();
});

test('YouTube description pasted into preview is converted only in local memory',()=>{
 const detail=elements.get('detail');
 const entry=elements.get('search');
 entry.value='14265';entry.handlers.input();
 const textArea={value:'全SET 自动ON\n1:11 黑猫 〇〇－〇〇\n1:06 黑猫 自动 OFF'};
 const result={innerHTML:'',textContent:''};
 detail.querySelector=selector=>selector==='textarea[data-youtube-input]'?textArea:
   selector==='[data-youtube-output]'?result:null;
 detail.handlers.click({target:{closest:selector=>selector==='button[data-youtube]'?
   {dataset:{youtube:'preview'}}:null}});
 assert.match(result.innerHTML,/YouTube 설명란 변환/);
 assert.match(result.innerHTML,/1:11/);
 assert.match(result.innerHTML,/저장·공유·자동 등록되지 않습니다/);
 detail.handlers.click({target:{closest:selector=>selector==='button[data-youtube]'?
   {dataset:{youtube:'clear'}}:null}});
 assert.equal(textArea.value,'');
 assert.equal(result.innerHTML,'');
 entry.value='';entry.handlers.input();
});

test('source operation category filter separates carry and full-auto',()=>{
 const type=elements.get('operation');
 type.value='carry';type.handlers.change();
 assert.match(elements.get('list').innerHTML,/이월용/);
 assert.ok(!elements.get('list').innerHTML.includes('미분류'));
 type.value='full-auto';type.handlers.change();
 assert.match(elements.get('list').innerHTML,/풀오토/);
 type.value='all';type.handlers.change();
});
test('switching to stage3 enables true five-boss zero-overlap recommendations',async()=>{
 const month=elements.get('month');
 month.value='3';month.handlers.change();
 for(let i=0;i<10&&!elements.get('list-title').textContent.includes('100');i++)
   await new Promise(resolve=>setImmediate(resolve));
 assert.equal(elements.get('stage3-section').hidden,false);
 assert.equal(month.value,'3');
 elements.get('compose-button').handlers.click();
 const result=elements.get('compose-output').innerHTML;
 assert.match(result,/캐릭터 25명 전원 중복 없음/);
 assert.match(result,/#14253 검토하기/);
 assert.match(elements.get('list-title').textContent,/100/);
 month.value='6';month.handlers.change();
 for(let i=0;i<10&&!elements.get('list-title').textContent.includes('215');i++)
  await new Promise(resolve=>setImmediate(resolve));
 assert.equal(elements.get('stage3-section').hidden,true);
});
