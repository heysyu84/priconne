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
 const {workspace}=fixture();await workspace.load();assert.match(workspace.videoView(),/3단계/);assert.match(workspace.videoView(),/4단계/);
 assert.match(workspace.composeView(),/캐릭터 중복 없는 조합/);assert.equal(workspace.solutions[0].length,5);assert.ok(workspace.solutions[0].every(Boolean));
});
