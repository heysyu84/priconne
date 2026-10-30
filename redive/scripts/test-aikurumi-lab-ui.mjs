import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createExternalReview} from '../public/aikurumi-review-ui.mjs';
const load=n=>JSON.parse(readFileSync(new URL('../public/'+n,import.meta.url),'utf8'));
const files={'aikurumi-snapshot-stage3.json':load('aikurumi-snapshot-stage3.json'),'aikurumi-snapshot.json':load('aikurumi-snapshot.json'),'aikurumi-youtube-candidates.json':load('aikurumi-youtube-candidates.json')};
function fixture(admin=false){
 const requests=[],writes=[],root={isConnected:true,innerHTML:'',addEventListener(){},querySelector(){return null;}};
 const workspace=createExternalReview({getContext:()=>({canEdit:admin,seasons:{'2026-11':{tactics:[],recommendations:[]}}}),onApply:admin?async entries=>{writes.push(entries);return {message:'적용 완료'};}:null,
 fetcher:async uri=>{const file=new URL(uri).pathname.split('/').at(-1);requests.push(file);assert.ok(files[file]);return {ok:true,json:async()=>structuredClone(files[file])};}});
 workspace.mount(root);return {workspace,root,requests,writes};
}
test('loading the screen automatically reads both stages and fetched YouTube TL without pasted descriptions',async()=>{
 const {workspace,root,requests}=fixture();await workspace.load();assert.equal(requests.length,3);
 assert.match(root.innerHTML,/유튜브 설명란/);assert.match(root.innerHTML,/69/);assert.match(root.innerHTML,/기대딜/);assert.match(root.innerHTML,/택틱 조건/);
 const item=workspace.items.find(i=>i.candidate?.rows?.length);assert.ok(item);workspace.selected=item.key;
 assert.ok(workspace.detailView(item).includes(item.candidate.rows[0].text));
 assert.doesNotMatch(root.innerHTML,/API 수집|stage 6|registrationAllowed|TEST \/ 읽기 전용|캐릭터 매칭|원본 딜 수치/);
});
test('standalone reader has no application writer and inspecting sources never writes',async()=>{
 const {workspace,root,writes}=fixture();await workspace.load();assert.doesNotMatch(root.innerHTML,/data-review-action="apply"/);
 await workspace.apply([workspace.current()]);assert.equal(writes.length,0);
});
test('refresh replaces unedited generated rows while keeping manual edits and clearing their confirmation',async()=>{
 const {workspace,writes}=fixture(true);await workspace.load();
 const item=workspace.items.find(i=>i.stage===4&&i.candidate?.rows?.length>3),other=workspace.items.find(i=>i.stage===4&&i.key!==item.key&&i.rows.length);assert.ok(other);
 const generated=workspace.draft(item),edited=workspace.draft(other);edited.rows[0].text='직접 수정한 조작문';edited.edited=true;edited.confirmed=true;
 const fresh=structuredClone(files['aikurumi-youtube-candidates.json']);
 const ref=fresh.references.find(r=>r.videoId===item.candidate.videoId&&r.taskId===item.task.id&&r.linkIndex===item.link.index);
 assert.ok(ref);ref.rows=ref.rows.slice(0,2);ref.rowCount=ref.rows.length;
 workspace.fetcher=async uri=>{const file=new URL(uri).pathname.split('/').at(-1);return {ok:true,json:async()=>structuredClone(file.includes('candidates')?fresh:files[file])};};
 await workspace.load();const refreshed=workspace.items.find(i=>i.key===item.key),manual=workspace.items.find(i=>i.key===other.key);
 assert.equal(workspace.draft(refreshed).rows.length,2);assert.notEqual(workspace.draft(refreshed),generated);
 assert.equal(workspace.draft(manual),edited);assert.equal(edited.rows[0].text,'직접 수정한 조작문');assert.equal(edited.confirmed,false);assert.equal(writes.length,0);
});
test('selecting a filtered tactic preserves the boss, type, status, search and filtered navigation',async()=>{
 const {workspace,root}=fixture();await workspace.load();
 const item=workspace.items.find(i=>i.stage===4&&i.boss===1&&i.source==='youtube');assert.ok(item);
 Object.assign(workspace,{stage:4,boss:'1',operation:item.operation,status:'youtube',query:item.party[0]});workspace.draw();
 const before=workspace.visible().map(i=>i.key),chosen=workspace.visible().at(-1);assert.ok(chosen);
 const click=(kind,key)=>workspace.event({type:'click',target:{closest:()=>({dataset:{reviewAction:kind,key}})},preventDefault(){}});
 click('select',chosen.key);
 assert.equal(workspace.selected,chosen.key);assert.equal(workspace.stage,4);assert.equal(workspace.boss,'1');
 assert.equal(workspace.operation,item.operation);assert.equal(workspace.status,'youtube');assert.equal(workspace.query,item.party[0]);
 assert.deepEqual(workspace.visible().map(i=>i.key),before);
 assert.match(root.innerHTML,/data-review-filter="boss"[^>]*>[\s\S]*?<option value="1" selected>1넴<\/option>/);
 click('next');assert.equal(workspace.selected,before[0]);assert.equal(workspace.boss,'1');
 assert.deepEqual(workspace.visible().map(i=>i.key),before);
});
test('the title metadata shows the displayed row count, including row edits and empty timelines',async()=>{
 const {workspace,root}=fixture();await workspace.load();
 const item=workspace.items.find(i=>i.stage===4&&i.candidate?.rows?.length);assert.ok(item);
 workspace.selected=item.key;const draft=workspace.draft(item),initial=draft.rows.length;
 assert.match(workspace.detailView(item),new RegExp('review-row-count">출력 '+initial+'행'));
 assert.match(workspace.listItem(item),new RegExp('review-row-count">출력 '+initial+'행'));
 const detail={innerHTML:''},listCount={textContent:''};
 root.querySelector=selector=>selector==='.review-detail'?detail:selector==='.review-item.active .review-row-count'?listCount:null;
 const click=(kind,index)=>workspace.event({type:'click',target:{closest:()=>({dataset:{reviewAction:kind,index}})},preventDefault(){}});
 click('add-row');assert.match(detail.innerHTML,new RegExp('출력 '+(initial+1)+'행'));assert.equal(listCount.textContent,'출력 '+(initial+1)+'행');
 click('remove-row','0');assert.equal(listCount.textContent,'출력 '+initial+'행');
 draft.rows=[];workspace.drawDetail();assert.match(detail.innerHTML,/출력 0행/);assert.equal(listCount.textContent,'출력 0행');
});
test('administrator application stays blocked until reviewed, then sends structured SET rows',async()=>{
 const {workspace,writes}=fixture(true);await workspace.load();const item=workspace.items.find(i=>i.stage===4&&i.preview.matchedKoreanNames&&!i.damage.ambiguous);
 workspace.selected=item.key;const draft=workspace.draft(item);draft.rows=[{text:'1:30 전부 SET, AUTO 온',checked:Array(6).fill(true)}];
 await workspace.apply([item]);assert.equal(writes.length,0);draft.confirmed=true;
 await workspace.apply([item]);assert.equal(writes.length,1);assert.equal(writes[0][0].draft.rows[0].checked.length,6);
});
test('editing a reviewed condition clears verification and does not silently apply',async()=>{
 const {workspace,writes}=fixture(true);await workspace.load();const item=workspace.current(),draft=workspace.draft(item);draft.confirmed=true;
 workspace.event({type:'input',target:{dataset:{reviewField:'tp'},type:'text',value:'4.3+',matches(){return false;}}});
 assert.equal(draft.confirmed,false);assert.equal(draft.tp,'4.3+');assert.equal(writes.length,0);
});
test('video grouping and stage-3 solver lead back to specific reviewed source links',async()=>{
 const {workspace,root}=fixture();await workspace.load();assert.match(workspace.videoView(),/3단계/);assert.match(workspace.videoView(),/4단계/);
 workspace.view='compose';workspace.draw();assert.match(root.innerHTML,/<p>2026\.11 · 3단계<\/p>/);
 assert.match(workspace.composeView(),/풀오토 · 1~5넴 캐릭터 중복 없는 조합/);assert.equal(workspace.solutions[0].length,5);assert.ok(workspace.solutions[0].every(Boolean));
 for(const solution of workspace.solutions){
  assert.ok(solution.every(item=>item.stage===3&&item.operation==='full-auto'));
  assert.equal(new Set(solution.flatMap(item=>item.task.charas.map(c=>c.prefabId))).size,25);
 }
});
test('a stage 3 group registers its five full-auto parties without fabricating or requiring a translated timeline',async()=>{
 const {workspace,writes,root}=fixture(true);await workspace.load();workspace.view='compose';workspace.draw();
 const items=workspace.solutions[0];for(const item of items){const d=workspace.draft(item);d.rows=[];d.confirmed=false;}
 const action={dataset:{reviewAction:'apply-group',index:'0'}};
 const event={type:'click',target:{matches(){return false;},closest:()=>action},preventDefault(){}};
 workspace.event(event);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(writes.length,1);assert.equal(writes[0].length,5);
 assert.ok(writes[0].every(({item,draft})=>item.stage===3&&item.operation==='full-auto'&&draft.lineupOnly&&draft.confirmed&&draft.rows.length===0));
 assert.ok(items.every(item=>workspace.draft(item).confirmed===false));assert.match(root.innerHTML,/적용 완료/);
});
test('registration errors remain visible and missing months are explained before writing',async()=>{
 const {workspace,writes,root}=fixture(true);await workspace.load();workspace.view='compose';workspace.draw();
 const items=workspace.solutions[0];workspace.getContext=()=>({canEdit:true,seasons:{}});
 const item=workspace.items.find(i=>i.stage===4&&!i.damage.ambiguous);workspace.draft(item).confirmed=true;
 await workspace.apply([item]);assert.equal(writes.length,0);assert.match(root.innerHTML,/월을 새로 만들고 적용/);
 workspace.onApply=async()=>{throw Error('저장 연결 확인');};
 await workspace.apply(items,{lineupOnly:true,confirmed:true});assert.match(root.innerHTML,/role="alert">저장 연결 확인/);assert.equal(workspace.pending,false);
});
