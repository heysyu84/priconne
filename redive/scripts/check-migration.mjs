import {stripTypeScriptTypes} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {decodeLegacy,encodeLegacy} from '../public/legacy-codec.mjs';
import {createLegacySharedClient} from '../public/legacy-shared-client.mjs';
import {createApiClient} from '../public/compat/api-client.mjs';
import {runtimeFixture} from './runtime-fixture.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const original=JSON.parse(fs.readFileSync(path.join(root,'data/2026-10-source.json'),'utf8')).data;
const current=Object.keys(original.months).sort().at(-1),past='2026-09';
const activeOnly={...structuredClone(original),active:current,months:{[current]:structuredClone(original.months[current])},storageVersion:2};
const archived=structuredClone(original.months[past]||original.months[current]);archived.month=past;
const archives={[past]:archived};
const reference=runtimeFixture().sharedDocument();
let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS '+name);}

await check('a no-op round trip preserves every original field and excludes unchanged archives',()=>{
  const payload=encodeLegacy(decodeLegacy(activeOnly,archives,reference),activeOnly,archives,reference);assert.deepEqual(payload.data,activeOnly);assert.equal(payload.restoreArchives,undefined);
});
await check('the actual UI normalization cannot accidentally migrate or rewrite original records',()=>{
  const app=runtimeFixture(),doc=decodeLegacy(activeOnly,archives,reference);app.applySharedDocument(doc);
  const result=encodeLegacy(app.sharedDocument(),activeOnly,archives,reference);assert.deepEqual(result.data,activeOnly);
});
await check('carry notes, trash, restoration, exact damage and old-only fields survive isolated edits',()=>{
  const doc=decodeLegacy(activeOnly,archives,reference),season=doc.seasons[current],carry=season.tactics.find(t=>t.category==='carry');
  const old=activeOnly.months[current].tactics.find(t=>t.id===carry.id);assert.ok(carry.requiredCarrySeconds);assert.ok(!carry.note.includes('필요 이월시간'));
  carry.requiredCarrySeconds=27;carry.note='새 메모';carry.deletedAt=123456789;season.logs[0].damage=123456789;season.logs[0].bonus=-135;
  let payload=encodeLegacy(doc,activeOnly,archives,reference),saved=payload.data.months[current].tactics.find(t=>t.id===carry.id);
  assert.equal(saved.note,'필요 이월시간: 27초 · 새 메모');assert.equal(saved.trashedAt,123456789);assert.equal(saved.video,old.video);assert.equal(payload.data.months[current].events[0].damage,123456789);assert.equal(payload.data.months[current].events[0].bonus,-135);
  const restored=decodeLegacy(payload.data,archives,reference);restored.seasons[current].tactics.find(t=>t.id===carry.id).deletedAt=null;
  assert.equal(encodeLegacy(restored,payload.data,archives,reference).data.months[current].tactics.find(t=>t.id===carry.id).trashedAt,null);
});
await check('past-month changes explicitly restore only the changed archive',()=>{
  const doc=decodeLegacy(activeOnly,archives,reference);doc.seasons[past].tactics[0].note='지난달 수정';
  const payload=encodeLegacy(doc,activeOnly,archives,reference);assert.equal(payload.restoreArchives,true);assert.deepEqual(Object.keys(payload.data.months).sort(),[past,current]);assert.deepEqual(payload.data.months[current],activeOnly.months[current]);
});
await check('booster changes patch the original list while retaining unknown entries',()=>{
  const state=structuredClone(activeOnly);state.boosterCharacters.push('미등록 미래 캐릭터');const doc=decodeLegacy(state,archives,reference),c=doc.characters.find(c=>c.booster);c.booster=false;
  const payload=encodeLegacy(doc,state,archives,reference);assert.ok(payload.data.boosterCharacters.includes('미등록 미래 캐릭터'));assert.ok(!payload.data.boosterCharacters.includes(c.name));assert.deepEqual(payload.data.clanHistory,state.clanHistory);
});

// Run the original production route's SQL and CORS checks with a fixture-only
// editor token. No production URL is contacted and no live records are changed.
const legacy=process.env.REDIVE_LEGACY_SOURCE||fileURLToPath(new URL('../../clan-battle',import.meta.url));
if(!fs.existsSync(path.join(legacy,'app/api/state/route.ts')))throw Error('Original API source missing. Set REDIVE_LEGACY_SOURCE to the clan-battle source directory.');
const ts={ScriptTarget:{ES2022:99},ModuleKind:{ES2022:99},transpileModule(source){return {outputText:stripTypeScriptTypes(source,{mode:'transform'})};}};
const sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE clan_state (id TEXT PRIMARY KEY,revision INTEGER,payload TEXT,updated_at TEXT);CREATE TABLE clan_archive_months(month TEXT PRIMARY KEY,payload TEXT,updated_at TEXT);CREATE TABLE clan_revisions(revision INTEGER PRIMARY KEY,payload TEXT,created_at TEXT);');
sqlite.prepare('INSERT INTO clan_state VALUES (?,?,?,?)').run('main',1,JSON.stringify(activeOnly),new Date().toISOString());
sqlite.prepare('INSERT INTO clan_archive_months VALUES (?,?,?)').run(past,JSON.stringify(archived),new Date().toISOString());
const statement=(sql,args=[])=>({bind(...values){return statement(sql,values);},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}});
globalThis.__rediveFixtureEnv={DB:{prepare:statement,async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const stmt of statements)result.push(await stmt.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}}};
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'redive-api-'));
const fixtureToken='ab'.repeat(32),fixturePassword='fixture-only';
fs.writeFileSync(path.join(directory,'env.mjs'),'export const env=globalThis.__rediveFixtureEnv;');
fs.writeFileSync(path.join(directory,'editor.mjs'),`export const hasEditor=async request=>request.headers.get('authorization')==='Bearer ${fixtureToken}';`);
function compile(name,source){const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;fs.writeFileSync(path.join(directory,name),result);}
compile('access.mjs',fs.readFileSync(path.join(legacy,'app/api-access.ts'),'utf8'));
for(const [file,name]of [['app/api/state/route.ts','state.mjs'],['app/api/archive/route.ts','archive.mjs']]){
  let source=fs.readFileSync(path.join(legacy,file),'utf8').replace(/from\s+["']cloudflare:workers["']/g,"from './env.mjs'").replace(/from\s+["']\.\.\/\.\.\/api-access["']/g,"from './access.mjs'").replace(/from\s+["']\.\.\/\.\.\/editor-access["']/g,"from './editor.mjs'");
  source=source.replace(/from\s+["']\.\.\/\.\.\/\.\.\/public\/engine.mjs["']/g,'from '+JSON.stringify(pathToFileURL(path.join(legacy,'public/engine.mjs')).href));compile(name,source);
}
const stateRoute=await import(pathToFileURL(path.join(directory,'state.mjs')).href),archiveRoute=await import(pathToFileURL(path.join(directory,'archive.mjs')).href);
const origin='https://priconne.pages.dev',backend='https://fixture-clan.test';
async function fetcher(url,options={}){
  const parsed=new URL(url,backend);assert.equal(parsed.origin,backend);
  const headers=new Headers(options.headers);headers.set('Origin',origin);const request=new Request(parsed,{...options,headers});
  if(parsed.pathname==='/api/editor'){
    if(options.method==='POST'){const body=await request.json();if(body.action==='lock')return Response.json({editor:false});if(body.pin!==fixturePassword)return Response.json({error:'비밀번호 확인'},{status:403});return Response.json({editor:true,token:fixtureToken,expiresAt:Date.now()+3600000});}
    return Response.json({editor:headers.get('Authorization')==='Bearer '+fixtureToken});
  }
  if(parsed.pathname==='/api/archive')return archiveRoute.GET(request);
  if(parsed.pathname==='/api/state')return options.method==='PUT'?stateRoute.PUT(request):stateRoute.GET(request);
  throw Error('Unexpected fixture URL '+parsed.pathname);
}
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};};
let selected=current;
const newClient=createLegacySharedClient({apiOrigin:backend,pageOrigin:origin,storage:storage(),fetcher,reference,selectedMonth:()=>selected});
const originalClient=createApiClient({apiOrigin:backend,pageOrigin:origin,storage:storage(),fetcher});
let doc,revision;
await check('the new client reads the original current records and archive through actual routes',async()=>{
  const result=await newClient.request('/api/state');doc=result.document;revision=result.revision;assert.equal(result.canEdit,false);assert.equal(doc.seasons[current].logs.length,activeOnly.months[current].events.length);assert.ok(doc.seasons[past]);
});
await check('readers cannot publish by changing browser memory, and wrong passwords remain locked',async()=>{
  await assert.rejects(newClient.request('/api/state',{method:'PUT',body:JSON.stringify({revision,document:doc})}),error=>error.status===403);
  await assert.rejects(newClient.login('incorrect'),error=>error.status===403);assert.equal((await newClient.request('/api/state')).canEdit,false);
});
await check('new-interface changes are readable immediately by the original interface',async()=>{
  await newClient.login(fixturePassword);const change=structuredClone(doc);change.seasons[current].tactics[0].note='new-interface';
  const saved=await newClient.request('/api/state',{method:'PUT',body:JSON.stringify({revision,document:change})});revision=saved.revision;
  const raw=await(await originalClient('/api/state?compact=1')).json();assert.equal(raw.data.months[current].tactics[0].note,'new-interface');assert.equal(raw.revision,revision);
});
await check('original-interface changes, trash and exact log damage reach the new interface',async()=>{
  await originalClient('/api/editor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:fixturePassword})});
  const raw=await(await originalClient('/api/state?compact=1')).json();raw.data.months[current].tactics[0].note='original-interface';raw.data.months[current].tactics[1].trashedAt=123456789;raw.data.months[current].events[0].damage=123456789;
  const response=await originalClient('/api/state',{method:'PUT',headers:{'Content-Type':'application/json','X-Nyang-Client':'4'},body:JSON.stringify({revision:raw.revision,data:raw.data,archiveMode:'v1'})});assert.equal(response.status,200);
  const latest=await newClient.request('/api/state?since='+revision);revision=latest.revision;doc=latest.document;assert.equal(doc.seasons[current].tactics[0].note,'original-interface');assert.equal(doc.seasons[current].tactics[1].deletedAt,123456789);assert.equal(doc.seasons[current].logs[0].damage,123456789);
});
await check('both interfaces enforce revision conflicts without replacing current data',async()=>{
  await assert.rejects(newClient.request('/api/state',{method:'PUT',body:JSON.stringify({revision:1,document:doc})}),error=>error.status===409);
  const raw=await(await originalClient('/api/state?compact=1')).json();assert.equal(raw.data.months[current].tactics[0].note,'original-interface');
});
await check('editing an archive updates that archive and leaves the current month untouched',async()=>{
  const changed=structuredClone(doc);changed.seasons[past].tactics[0].note='past-month';const result=await newClient.request('/api/state',{method:'PUT',body:JSON.stringify({revision,document:changed})});revision=result.revision;
  const archivedResult=await(await originalClient('/api/archive?month='+past)).json();assert.equal(archivedResult.data.tactics[0].note,'past-month');
  const currentResult=await(await originalClient('/api/state?compact=1')).json();assert.equal(currentResult.data.months[current].tactics[0].note,'original-interface');
});
await check('a later archive selection refreshes an archive even when the current revision is unchanged',async()=>{
  const observer=createLegacySharedClient({apiOrigin:backend,pageOrigin:origin,storage:storage(),fetcher,reference,selectedMonth:()=>selected});selected=current;const initial=await observer.request('/api/state');
  const currentResult=await(await originalClient('/api/state?compact=1')).json(),pastResult=await(await originalClient('/api/archive?month='+past)).json();pastResult.data.tactics[0].note='archive-from-original';
  const response=await originalClient('/api/state',{method:'PUT',headers:{'Content-Type':'application/json','X-Nyang-Client':'4'},body:JSON.stringify({revision:currentResult.revision,data:{...currentResult.data,months:{...currentResult.data.months,[past]:pastResult.data}},archiveMode:'v1',restoreArchives:true})});assert.equal(response.status,200);
  const onCurrent=await observer.request('/api/state?since='+initial.revision);assert.equal(onCurrent.document.seasons[past].tactics[0].note,'past-month');
  selected=past;const onPast=await observer.request('/api/state?since='+onCurrent.revision);assert.equal(onPast.document.seasons[past].tactics[0].note,'archive-from-original');
});
await check('untrusted origins and writes without the version header are rejected by the original route',async()=>{
  const request=new Request(backend+'/api/state',{headers:{Origin:'https://untrusted.test'}});assert.equal((await stateRoute.GET(request)).status,403);
  assert.equal((await stateRoute.PUT(new Request(backend+'/api/state',{method:'PUT',headers:{Origin:origin,Authorization:'Bearer '+fixtureToken,'Content-Type':'application/json'},body:'{}'}))).status,409);
});
await check('verified external 3/4-stage tactics save through the actual production route without changing October',async()=>{
 const model=await import('../public/aikurumi-review-model.mjs');
 const youtube=JSON.parse(fs.readFileSync(path.join(root,'public/aikurumi-youtube-candidates.json'),'utf8'));
 const latest=await newClient.request('/api/state'),doc=structuredClone(latest.document),before=JSON.stringify(doc.seasons[current].logs);
 const target=structuredClone(doc.seasons[current]);target.logs=[];target.tactics=[];target.recommendations=[];target.dayClosures=[];target.result={rank:null,sealed:false,winners:null};target.rules.startDate='';doc.seasons['2026-11']=target;doc.activeMonth='2026-11';
 for(const name of ['aikurumi-snapshot-stage3.json','aikurumi-snapshot.json']){
  const snapshot=JSON.parse(fs.readFileSync(path.join(root,'public',name),'utf8'));
  const item=model.buildReviewItems(snapshot,youtube).find(i=>i.preview.matchedKoreanNames&&!i.damage.ambiguous);
  const draft=model.reviewDraft(item);draft.confirmed=true;draft.rows=[{text:'1:30 전부 SET, AUTO 온',checked:Array(6).fill(true)}];draft.damage=3.3065;draft.tp='4.3+';
  const tactic=model.buildReviewedTactic(item,draft,{id:'fixture-external-'+item.stage});
  (item.stage===3?target.recommendations:target.tactics).push(tactic);
 }
 const saved=await newClient.request('/api/state',{method:'PUT',body:JSON.stringify({revision:latest.revision,document:doc})});
 assert.ok(saved.revision>latest.revision);
 const result=await newClient.request('/api/state');
 assert.equal(result.document.seasons['2026-11'].tactics.length,1);assert.equal(result.document.seasons['2026-11'].recommendations.length,1);
 assert.equal(result.document.seasons['2026-11'].tactics[0].damage,3.3065);assert.equal(result.document.seasons['2026-11'].tactics[0].tp,'4.3+');
 assert.ok(result.document.seasons['2026-11'].tactics[0].externalSource.key);
 assert.equal(JSON.stringify(result.document.seasons[current].logs),before);
});
await newClient.lock();sqlite.close();delete globalThis.__rediveFixtureEnv;fs.rmSync(directory,{recursive:true,force:true});console.log(checks+' migration checks passed');
