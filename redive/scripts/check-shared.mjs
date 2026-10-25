import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleSharedState,validateDocument} from '../server/shared-store.mjs';
import {initialState} from '../server/initial-state.mjs';

// Exercise the actual SQL and request handler, including two independent clients.
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(readFileSync(new URL('../drizzle/0000_safe_hex.sql',import.meta.url),'utf8'));
function statement(sql,values=[]){return {bind(...args){return statement(sql,args);},async first(){return sqlite.prepare(sql).get(...values)||null;},async run(){const result=sqlite.prepare(sql).run(...values);return {success:true,meta:{changes:Number(result.changes)}};}};}
const DB={prepare:statement,async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
const env={DB,CLAN_ADMIN_BOOTSTRAP_EMAIL:'owner@site.test'};
const owner={'oai-authenticated-user-id':'owner-site-id','oai-authenticated-user-email':'owner@site.test'};
const other={'oai-authenticated-user-id':'other-site-id','oai-authenticated-user-email':'other@site.test'};
const read=(headers={},since='')=>handleSharedState(new Request('https://site.test/api/state'+(since?'?since='+since:''),{headers}),env,initialState);
const put=(document,revision,headers=owner,origin='https://site.test')=>handleSharedState(new Request('https://site.test/api/state',{method:'PUT',headers:{...headers,Origin:origin,'Content-Type':'application/json','X-Redive-Request':'1'},body:JSON.stringify({document,revision})}),env,initialState);
let checks=0,initialSavedDocument;
async function check(name,fn){await fn();checks++;console.log('PASS '+name);}

await check('October seed is valid and anonymous visitors can read shared records',async()=>{
  assert.equal(validateDocument(initialState),true);const response=await read();assert.equal(response.status,200);const result=await response.json();
  assert.equal(result.revision,1);assert.equal(result.canEdit,false);assert.equal(result.document.seasons['2026-10'].logs.length,138);assert.equal(result.document.seasons['2026-10'].tactics.length,43);assert.equal(result.document.pinHash,undefined);
  initialSavedDocument=JSON.stringify(result.document);
});
await check('a signed-in non-owner cannot claim administration or write',async()=>{
  const result=await(await read(other)).json();assert.equal(result.canEdit,false);assert.equal(sqlite.prepare('SELECT count(*) n FROM clan_admins').get().n,0);
  assert.equal((await put(initialState,1,other)).status,403);assert.equal((await put(initialState,1,{})).status,401);
});
await check('only the configured owner binds to their stable site identity',async()=>{
  assert.equal((await(await read(owner)).json()).canEdit,true);
  assert.equal(sqlite.prepare('SELECT user_id FROM clan_admins').get().user_id,owner['oai-authenticated-user-id']);
  assert.equal((await(await read({...other,'oai-authenticated-user-email':owner['oai-authenticated-user-email']})).json()).canEdit,false);
});
await check('owner changes persist and an independent viewer receives the same tactic and note',async()=>{
  const draft=structuredClone(initialState);draft.seasons['2026-10'].tactics[0].note='공유 확인';draft.seasons['2026-10'].logs[0].note='공용 기록';
  const result=await(await put(draft,1)).json();assert.equal(result.revision,2);
  const viewer=await(await read()).json();assert.equal(viewer.document.seasons['2026-10'].tactics[0].note,'공유 확인');assert.equal(viewer.document.seasons['2026-10'].logs[0].note,'공용 기록');
  const unchanged=await(await read({},2)).json();assert.equal(unchanged.document,undefined);assert.equal(unchanged.revision,2);
});
await check('stale concurrent edits are rejected without overwriting the saved data',async()=>{
  const draft=structuredClone(initialState);draft.seasons['2026-10'].logs[0].note='오래된 창';assert.equal((await put(draft,1)).status,409);
  const viewer=await(await read()).json();assert.equal(viewer.revision,2);assert.equal(viewer.document.seasons['2026-10'].logs[0].note,'공용 기록');assert.equal(sqlite.prepare('SELECT count(*) n FROM clan_revisions').get().n,2);
});
await check('cross-origin requests, malformed tactics, and stage 5 data are rejected',async()=>{
  assert.equal((await put(initialState,2,owner,'https://other.test')).status,403);
  const invalid=structuredClone(initialState);invalid.seasons['2026-10'].tactics[0].stage=5;assert.equal((await put(invalid,2)).status,400);
  invalid.seasons['2026-10'].tactics[0].stage=4;invalid.seasons['2026-10'].tactics[0].rows[0].checked.pop();assert.equal((await put(invalid,2)).status,400);
  assert.equal((await(await read()).json()).revision,2);
});
await check('a new deployment seed never overwrites existing records and versions are retained',async()=>{
  const changedSeed=structuredClone(initialState);changedSeed.members[0].name='잘못된 배포 원본';
  const result=await handleSharedState(new Request('https://site.test/api/state'),env,changedSeed);assert.notEqual((await result.json()).document.members[0].name,'잘못된 배포 원본');
  assert.equal(sqlite.prepare('SELECT document FROM clan_revisions WHERE revision = 1').get().document,initialSavedDocument);
});
await check('roster upgrades preserve existing edits and only add missing people',async()=>{
  const stored=JSON.parse(sqlite.prepare('SELECT document FROM clan_state WHERE id = ?').get('clan').document);stored.members=stored.members.filter(m=>m.status==='active');stored.members[0].note='관리자가 수정한 메모';stored.siteCopy={'배틀로그':'전투 기록'};delete stored.referenceVersion;
  sqlite.prepare('UPDATE clan_state SET document = ? WHERE id = ?').run(JSON.stringify(stored),'clan');
  const result=await(await read()).json();assert.equal(result.document.members.length,128);assert.equal(result.document.members[0].note,'관리자가 수정한 메모');assert.equal(result.document.siteCopy['배틀로그'],'전투 기록');assert.equal(result.document.seasons['2026-10'].logs[0].note,'공용 기록');
});
await check('older clients preserve shared copy, future overrides, and restored roster references',async()=>{
  const current=await(await read()).json();
  current.document.futureOverrides={'2026-11':{bosses:Array.from({length:5},(_,i)=>({slot:i+1,name:'편집 보스 '+(i+1),portrait:'assets/future-1.1.png'}))}};
  assert.equal((await put(current.document,current.revision)).status,200);
  const legacy=await(await read()).json(),draft=structuredClone(legacy.document);
  delete draft.siteCopy;delete draft.futureOverrides;delete draft.referenceVersion;
  draft.members=draft.members.filter(m=>m.status==='active');
  assert.equal((await put(draft,legacy.revision)).status,200);
  const result=await(await read()).json();assert.equal(result.document.members.length,128);assert.equal(result.document.siteCopy['배틀로그'],'전투 기록');assert.equal(result.document.futureOverrides['2026-11'].bosses[0].name,'편집 보스 1');assert.equal(result.document.referenceVersion,initialState.referenceVersion);assert.equal(result.document.seasons['2026-10'].logs[0].note,'공용 기록');
});
await check('reader migration updates only the requested tactic and carry metadata once',async()=>{
 const old=await(await read(owner)).json(),legacy=structuredClone(old.document),id='a8244c97-ada4-442e-8afb-0b95b875d515';
 const target=legacy.seasons['2026-10'].tactics.find(t=>t.id===id);
 target.rows=[{id:'old-line',text:'old source',checked:Array(6).fill(false)}];target.text='old source';target.note='retain administrator note';
 legacy.referenceVersion='roster-r1361-v1';
 const carry=legacy.seasons['2026-10'].tactics.find(t=>t.category==='carry');carry.note='필요 이월시간: 26초 · 육성 조건 유지';delete carry.requiredCarrySeconds;
 const logs=JSON.stringify(legacy.seasons['2026-10'].logs),others=JSON.stringify(legacy.seasons['2026-10'].tactics.filter(t=>t.id!==id&&t.category!=='carry'));
 sqlite.prepare('UPDATE clan_state SET document = ? WHERE id = ?').run(JSON.stringify(legacy),'clan');
 const updated=await(await read(owner)).json(),after=updated.document.seasons['2026-10'],fresh=after.tactics.find(t=>t.id===id),source=initialState.seasons['2026-10'].tactics.find(t=>t.id===id);
 assert.equal(updated.revision,old.revision+1);assert.equal(JSON.stringify(after.logs),logs);assert.equal(JSON.stringify(after.tactics.filter(t=>t.id!==id&&t.category!=='carry')),others);
 assert.deepEqual(fresh.rows,source.rows);assert.equal(fresh.rows.length,17);assert.equal(fresh.text,source.text);assert.equal(fresh.note,'retain administrator note');
 assert.equal(after.tactics.find(t=>t.id===carry.id).requiredCarrySeconds,26);assert.equal(after.tactics.find(t=>t.id===carry.id).note,'육성 조건 유지');
 assert.equal((await(await read(owner)).json()).revision,updated.revision);
 fresh.rows[0].text='later administrator edit';fresh.text='later administrator edit';
 assert.equal((await put(updated.document,updated.revision)).status,200);
 const final=await(await read(owner)).json();assert.equal(final.document.seasons['2026-10'].tactics.find(t=>t.id===id).rows[0].text,'later administrator edit');
});
console.log(checks+' shared-store checks passed');sqlite.close();
