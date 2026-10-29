import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const snapshot=JSON.parse(readFileSync(new URL('../public/aikurumi-snapshot.json',import.meta.url),'utf8'));
const stage3=JSON.parse(readFileSync(new URL('../public/aikurumi-snapshot-stage3.json',import.meta.url),'utf8'));
const youtubeCandidates=JSON.parse(readFileSync(new URL('../public/aikurumi-youtube-candidates.json',import.meta.url),'utf8'));
const elements=new Map();
for(const id of ['list','detail','boss','filter','search','month','list-title','summary','operation','stage3-section','compose-output','compose-button','compose-mode','view-mode','youtube-collections','collection-output','collection-status','repeated-only','tactic-panes']){
 elements.set(id,{value:id==='boss'||id==='filter'||id==='operation'?'all':id==='compose-mode'?'full-auto':id==='month'?'6':id==='view-mode'?'tactics':'',innerHTML:'',textContent:'',scrollTop:0,hidden:false,disabled:false,checked:id==='repeated-only',handlers:{},
   addEventListener(type,fn){this.handlers[type]=fn;},scrollIntoView(){}});
}
elements.get('month').options=[{value:'6',textContent:''},{value:'3',textContent:''}];
globalThis.document={getElementById:id=>elements.get(id)};
globalThis.fetch=async path=>{
 assert.ok(['./aikurumi-snapshot.json','./aikurumi-snapshot-stage3.json','./aikurumi-youtube-candidates.json'].includes(path));
 return {ok:true,json:async()=>path.includes('candidates')?youtubeCandidates:path.includes('stage3')?stage3:snapshot};
};
await import('../public/aikurumi-lab.mjs');
for(let i=0;i<12&&(!elements.get('list').innerHTML.includes('data-item')||elements.get('detail').innerHTML.includes('API 수집 결과 확인 중'));i++)
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

test('YouTube collection mode groups creators by exact video across stages',async()=>{
 const view=elements.get('view-mode');
 view.value='videos';view.handlers.change();
 for(let i=0;i<12&&!elements.get('collection-status').textContent.includes('136');i++)
   await new Promise(resolve=>setImmediate(resolve));
 assert.equal(elements.get('youtube-collections').hidden,false);
 assert.equal(elements.get('tactic-panes').hidden,true);
 const status=elements.get('collection-status').textContent;
 assert.match(status,/영상 72개/);
 assert.match(status,/136건/);
 assert.match(status,/9개/);
 const html=elements.get('collection-output').innerHTML;
 assert.match(html,/Eruru/);
 assert.match(html,/ぽちょむきん/);
 assert.match(html,/3단계/);
 assert.match(html,/4단계/);
 assert.match(html,/data-video-reference/);
 assert.match(html,/시간 지정 원본/);
 assert.ok(!html.includes('YOUTUBE_API_KEY'));
 view.value='tactics';view.handlers.change();
 assert.equal(elements.get('youtube-collections').hidden,true);
 assert.equal(elements.get('tactic-panes').hidden,false);
});
test('creator collection can hide non-repeated video groups and restore them',async()=>{
 const view=elements.get('view-mode');view.value='videos';view.handlers.change();
 for(let i=0;i<12&&!elements.get('collection-status').textContent.includes('136');i++)
   await new Promise(resolve=>setImmediate(resolve));
 const onlyRepeated=elements.get('collection-output').innerHTML;
 const toggle=elements.get('repeated-only');toggle.checked=false;toggle.handlers.change();
 for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));
 const allVideos=elements.get('collection-output').innerHTML;
 assert.ok(allVideos.length>onlyRepeated.length);
 toggle.checked=true;toggle.handlers.change();
 for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));
 view.value='tactics';view.handlers.change();
});

test('video collection opens the exact matching stage-3 tactic and returns to review',async()=>{
 const view=elements.get('view-mode');
 view.value='videos';view.handlers.change();
 for(let i=0;i<12&&!elements.get('collection-output').innerHTML.includes('data-video-reference');i++)
  await new Promise(resolve=>setImmediate(resolve));
 const markup=elements.get('collection-output').innerHTML;
 const match=markup.match(/<div class="video-reference"><span>3단계 · (\d+)넴 · #(\d+)<\/span>[\s\S]*?<button[^>]*data-video-reference="(\d+)"/);
 assert.ok(match,'Expected a stage-3 source inside a repeated video collection');
 const [,boss,task,id]=match;
 await elements.get('collection-output').handlers.click({
  target:{closest:selector=>selector==='button[data-video-reference]'?{dataset:{videoReference:id}}:null}
 });
 assert.equal(view.value,'tactics');
 assert.equal(elements.get('month').value,'3');
 assert.equal(elements.get('tactic-panes').hidden,false);
 assert.match(elements.get('detail').innerHTML,new RegExp('택틱 #'+task));
 assert.match(elements.get('detail').innerHTML,new RegExp(boss+'넴'));
});

test('YouTube Data API derived Korean TL appears on exact video-linked tactic automatically',async()=>{
 const matched=youtubeCandidates.references.find(x=>x.stage===6&&(x.status==='partial'||x.status==='candidate')&&x.rows?.length);
 assert.ok(matched,'Expected at least one actually extracted timeline');
 const month=elements.get('month');month.value='6';month.handlers.change();
 for(let i=0;i<12&&!elements.get('list-title').textContent.includes('215');i++)
   await new Promise(resolve=>setImmediate(resolve));
 const search=elements.get('search');search.value=String(matched.taskId);search.handlers.input();
 elements.get('list').handlers.click({target:{closest:selector=>selector==='button[data-item]'?
  {dataset:{item:[matched.boss,matched.taskId,matched.linkIndex,matched.linkOrdinal].join(':')}}:null}});
 const html=elements.get('detail').innerHTML;
 assert.match(html,/API 자동 TL 변환 및 원문 대조/);
 assert.match(html,/일본어 설명란에서 자동 변환한 한국어 조작문/);
 assert.match(html,/기준 TL: YouTube 일본어 TL 우선/);
 assert.match(html,/aikurumi 중국어 TL · 참고 자료/);
 assert.match(html,/자동 등록되지 않습니다/);
 assert.ok(!html.includes('YOUTUBE_API_KEY'));
 search.value='';search.handlers.input();
});
