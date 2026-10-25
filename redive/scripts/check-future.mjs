import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleFutureBosses,addBossMonths,normalizeFutureLineup,futureKnown} from '../server/future-bosses.mjs';
import initial from '../data/future-bosses.json' with {type:'json'};
const sqlite=new DatabaseSync(':memory:');
for(const name of ['0000_safe_hex.sql','0001_amusing_epoch.sql'])sqlite.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
const stmt=(sql,args=[])=>({bind(...values){return stmt(sql,values)},async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}});
const env={DB:{prepare:stmt},CLAN_ADMIN_BOOTSTRAP_EMAIL:'owner@site.test'};
const request=(method='GET',owner=false)=>new Request('https://site.test/api/future-bosses',{method,headers:method==='POST'?{Origin:'https://site.test','Content-Type':'application/json','X-Redive-Request':'1',...(owner?{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@site.test'}:{})}:{},body:method==='POST'?'{}':undefined});
let checks=0;async function check(name,run){await run();console.log('PASS '+name);checks++;}
const nativeFetch=globalThis.fetch;let calls=0;
await check('JP dates map to Korea by thirteen months',async()=>{assert.equal(addBossMonths('2025-09',13),'2026-10');assert.equal(addBossMonths('2026-10',13),'2027-11');});
await check('boss identity follows prefab IDs even when positions change',async()=>{
  const base=initial.months['2026-11'].bosses,raw=[...base].reverse().map((b,i)=>({index:i,prefabId:b.prefabId,unitName:b.sourceName}));
  const result=normalizeFutureLineup(raw,'2026-10',999,futureKnown());assert.equal(result.krMonth,'2027-11');assert.equal(result.bosses[0].name,base[4].name);assert.equal(result.bosses[4].name,base[0].name);
  raw[1].prefabId=raw[0].prefabId;assert.equal(normalizeFutureLineup(raw,'2026-10',999,futureKnown()),null);
});
await check('a failed upstream refresh retains all thirteen verified monthly lineups',async()=>{
  globalThis.fetch=async()=>{calls++;throw new Error('Temporary upstream failure')};
  const result=await(await handleFutureBosses(request(),env)).json();assert.equal(Object.keys(result.months).length,13);assert.ok(result.refreshError);assert.equal(result.months['2026-11'].bosses[0].name,'와이번');
  await handleFutureBosses(request(),env);assert.equal(calls,1);
});
await check('manual refresh requires the configured administrator',async()=>{assert.equal((await handleFutureBosses(request('POST'),env)).status,401);});
await check('verified new source periods extend the cache without replacing earlier months',async()=>{
  const base=initial.months['2026-11'].bosses;
  globalThis.fetch=async url=>Response.json({code:200,data:String(url).includes('clanBattleList')?[{startTime:'2026-10-25',clanBattleId:999}]:base.map((b,i)=>({index:i,prefabId:b.prefabId,unitName:b.sourceName}))});
  const result=await(await handleFutureBosses(request('POST',true),env)).json();assert.equal(result.months['2027-11'].bosses[0].name,'와이번');assert.deepEqual(result.months['2026-11'],initial.months['2026-11']);assert.equal(Object.keys(result.months).length,14);
});
globalThis.fetch=nativeFetch;sqlite.close();console.log(checks+' future-boss checks passed');
