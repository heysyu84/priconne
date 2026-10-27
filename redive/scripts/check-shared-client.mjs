import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as engine from '../public/battle-engine.mjs';
import * as parser from '../public/tactic-parser.mjs';
import * as partyTools from '../public/party-tools.mjs';
import * as logOrder from '../public/log-order.mjs';
import * as legacyTools from '../public/legacy-tools.mjs';
import {handleSharedState} from '../server/shared-store.mjs';
import {initialState} from '../server/initial-state.mjs';

const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0000_safe_hex.sql',import.meta.url),'utf8'));
const stmt=(sql,args=[])=>({bind(...values){return stmt(sql,values);},async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}});
const env={CLAN_ADMIN_BOOTSTRAP_EMAIL:'owner@site.test',DB:{prepare:stmt,async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
const code=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'').replaceAll('import.meta.url',JSON.stringify(new URL('../public/app.js',import.meta.url).href));
const node=()=>({innerHTML:'',value:'',open:false,dataset:{},classList:{toggle(){},add(){},remove(){}},style:{setProperty(){}},addEventListener(){},querySelector(){return null;},close(){this.open=false;}});
let writes=0;
async function client(isOwner,storage=new Map()){
  const elements={app:node(),drawer:node(),toast:node(),'shared-status':node()},timers=new Set(),clickHandlers=[];let disconnected=false;
  const context={console,Date,Math,Number,String,Array,Object,Set,Map,JSON,RegExp,structuredClone,TextEncoder,AbortSignal,crypto,setTimeout(fn,ms){const t=setTimeout(()=>{timers.delete(t);fn();},ms);timers.add(t);return t;},clearTimeout(t){timers.delete(t);clearTimeout(t);},setInterval(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},document:{getElementById:id=>elements[id]||(elements[id]=node()),querySelector(){return null;},documentElement:node(),body:node(),addEventListener(type,handler,options){if(type==='click')clickHandlers.push({handler,capture:options===true||!!options?.capture});},hidden:false,activeElement:null},window:{addEventListener(){},scrollTo(){}},location:{hash:'',origin:'https://site.test'},history:{replaceState(){},pushState(){}},engineReplay:engine.replayMonth,engineProgress:engine.bossProgress,engineContribution:engine.contribution,engineEstimate:engine.estimateCarry,partyTools,logOrder,legacyTools,...parser};
  context.fetch=async(path,options={})=>{
    if(disconnected)throw new TypeError('Network unavailable');
    const headers=new Headers(options.headers);if(isOwner){headers.set('oai-authenticated-user-id','owner-site-id');headers.set('oai-authenticated-user-email','owner@site.test');}
    if(options.method==='PUT'){headers.set('Origin','https://site.test');writes++;}
    return handleSharedState(new Request('https://site.test'+path,{...options,headers}),env,initialState);
  };
  vm.runInNewContext(code+'\nthis.test={get:()=>data,ui,ext,sync:syncState,persist:()=>persist(),toggle:()=>toggleWriter(),flush:flushShared,poll:pollShared,apply:applySharedDocument,settingsData,legacyDocument,restorePreparedBackup,sharedBackup};',context,{timeout:20000});
  for(let n=0;n<50&&!context.test.sync.ready;n++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(context.test.sync.ready,true);
  return {...context.test,storage,drawer:elements.drawer,async click(action,id){const button={dataset:{action,id},disabled:false,isConnected:false,closest(selector){return selector==='[data-action]'?button:null;}};let stopped=false;const event={target:button,preventDefault(){},stopImmediatePropagation(){stopped=true;},stopPropagation(){stopped=true;}};for(const capture of [true,false])for(const item of clickHandlers)if(item.capture===capture&&!stopped)await item.handler(event);},offline:value=>disconnected=value,close(){for(const t of timers)clearTimeout(t);}};
}
let checks=0;
async function check(name,run){await run();checks++;console.log('PASS '+name);}
const admin=await client(true),viewer=await client(false),secondAdmin=await client(true);
await check('fresh clients start with the same shared data and server-assigned roles',async()=>{
  assert.equal(admin.sync.canEdit,true);assert.equal(viewer.sync.canEdit,false);assert.equal(admin.get().settings.editable,false);assert.equal(viewer.get().logs.length,138);assert.equal(admin.get().tactics.length,43);
});
await check('a viewer cannot enable writing or publish even after editing local memory',async()=>{
  const before=writes;viewer.toggle();assert.equal(viewer.get().settings.editable,false);viewer.get().logs[0].note='viewer change';viewer.persist();await viewer.flush();assert.equal(writes,before);await viewer.poll({force:true});assert.notEqual(viewer.get().logs[0].note,'viewer change');
});
await check('admin changes flow through the real save queue to an independent viewer',async()=>{
  admin.toggle();admin.get().logs[0].note='다른 기기에도 표시';admin.get().tactics[0].rows[0].checked[5]=!admin.get().tactics[0].rows[0].checked[5];admin.persist();await admin.flush();assert.equal(admin.sync.pending,'');
  await viewer.poll({force:true});assert.equal(viewer.get().logs[0].note,'다른 기기에도 표시');assert.equal(viewer.get().tactics[0].rows[0].checked[5],admin.get().tactics[0].rows[0].checked[5]);
});
await check('display preferences never publish a shared document',async()=>{
  const before=writes;admin.get().settings.large=true;admin.persist();await admin.flush();assert.equal(writes,before);assert.equal(JSON.parse(admin.storage.get('redive-ui-preferences-v1')).large,true);
});
await check('a stale admin draft remains recoverable and cannot overwrite another window',async()=>{
  secondAdmin.toggle();secondAdmin.get().logs[0].note='stale browser';secondAdmin.persist();await secondAdmin.flush();assert.equal(secondAdmin.sync.status,'conflict');assert.ok(secondAdmin.storage.get('redive-shared-draft-v1'));
  await viewer.poll({force:true});assert.equal(viewer.get().logs[0].note,'다른 기기에도 표시');
});
await check('offline edits survive and can save after a same-version reconnect',async()=>{
  admin.offline(true);admin.get().logs[1].note='연결 복구';admin.persist();await admin.flush();assert.equal(admin.sync.status,'offline');assert.ok(admin.storage.get('redive-shared-draft-v1'));
  admin.offline(false);await admin.poll({force:true});assert.equal(admin.sync.status,'pending');await admin.flush();assert.equal(admin.sync.status,'saved');await viewer.poll({force:true});assert.equal(viewer.get().logs[1].note,'연결 복구');
});
await check('reopening with empty browser storage loads saved server data',async()=>{
  const fresh=await client(false);assert.equal(fresh.get().logs[0].note,'다른 기기에도 표시');assert.equal(fresh.get().logs[1].note,'연결 복구');fresh.close();
});
await check('legacy browser edits are retained without silently replacing shared records',async()=>{
  const storage=new Map(),key='redive-independent-design-lab-v3-current-month',legacy=admin.sharedBackup(JSON.parse(admin.sync.baseline));legacy.logs[0].note='이전 브라우저만의 수정';storage.set(key,JSON.stringify(legacy));
  const migrated=await client(true,storage);assert.equal(migrated.legacyDocument().seasons['2026-10'].logs[0].note,'이전 브라우저만의 수정');assert.equal(migrated.get().logs[0].note,'다른 기기에도 표시');migrated.close();
});
await check('a restored backup is saved publicly even if its browser edit setting was off',async()=>{
  const document=structuredClone(JSON.parse(admin.sync.baseline));document.seasons['2026-10'].logs[2].note='복원한 공용 기록';admin.ext.pendingRestore=admin.sharedBackup(document);assert.equal(admin.ext.pendingRestore.settings.editable,false);admin.restorePreparedBackup();await admin.flush();
  await viewer.poll({force:true});assert.equal(viewer.get().logs[2].note,'복원한 공용 기록');
});
await check('site text and future overrides persist and arrive on another client',async()=>{
  admin.get().siteCopy={'배틀로그':'전투 기록'};admin.get().futureOverrides={};admin.persist();await admin.flush();await viewer.poll({force:true});assert.equal(viewer.get().siteCopy['배틀로그'],'전투 기록');assert.equal(admin.sync.pending,'');
});
await check('delete buttons confirm one record and propagate its removal through the actual click/save path',async()=>{
 const before=admin.get().logs.length,log=admin.get().logs.find(row=>!row.carry&&row.after>0);assert.ok(log);
 await admin.click('entry-delete-log',log.id);assert.equal(admin.get().logs.length,before);assert.ok(admin.drawer.innerHTML.includes('data-action="entry-confirm-delete"'));assert.ok(admin.drawer.innerHTML.includes('data-id="'+log.id+'"'));
 await admin.click('entry-confirm-delete',log.id);assert.equal(admin.get().logs.length,before-1);assert.ok(!admin.get().logs.some(row=>row.id===log.id));await admin.flush();assert.equal(admin.sync.pending,'');
 await viewer.poll({force:true});assert.equal(viewer.get().logs.length,before-1);assert.ok(!viewer.get().logs.some(row=>row.id===log.id));
});
for(const c of [admin,viewer,secondAdmin])c.close();sqlite.close();console.log(checks+' shared-client checks passed');

