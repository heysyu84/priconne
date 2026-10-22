import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import fs from 'node:fs';
import {startPresence, BROWSER_PRESENCE_KEY, PRESENCE_INTERVAL_MS} from '../public/presence.mjs';

const sqlite=new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync(new URL('../drizzle/0002_regular_dreaming_celestial.sql',import.meta.url),'utf8'));
sqlite.exec("CREATE TABLE clan_state (id TEXT PRIMARY KEY,payload TEXT);INSERT INTO clan_state VALUES ('main','preserve clan records');");
const DB={prepare(sql){const statement=sqlite.prepare(sql);let args=[];const p={bind(...values){args=values;return p;},async first(){return statement.get(...args)||null;},async run(){const result=statement.run(...args);return {meta:{changes:Number(result.changes)}};}};return p;},async batch(statements){return Promise.all(statements.map(statement=>statement.run()));}};
globalThis.__presenceTestDB=DB;
registerHooks({resolve(specifier,context,next){
  if(specifier==='cloudflare:workers')return {url:'data:text/javascript,export const env={DB:globalThis.__presenceTestDB}',shortCircuit:true};
  if(specifier.endsWith('/api-access'))return next(specifier+'.ts',context);
  return next(specifier,context);
}});
const route=await import('../app/api/presence/route.ts');
const origin='https://priconne.pages.dev',url='https://records.invalid/api/presence';
const request=(id,source=origin,extra={})=>new Request(url,{method:'POST',headers:{origin:source,'content-type':'application/json',...extra},body:JSON.stringify({browserId:id})});
const read=()=>route.GET(new Request(url,{headers:{origin}}));
const originalNow=Date.now;let time=1_000_000;Date.now=()=>time;
try {
  assert.deepEqual(await (await read()).json(),{online:0});
  let response=await route.POST(request('a'.repeat(32)));assert.equal(response.status,200);assert.deepEqual(await response.json(),{online:1});
  assert.equal(response.headers.get('access-control-allow-origin'),origin);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await (await route.POST(request('a'.repeat(32)))).json(),{online:1},'Tabs sharing one browser identity count once');
  time+=30_000;
  assert.deepEqual(await (await route.POST(request('b'.repeat(32),'https://heysyu84.github.io'))).json(),{online:2});
  time+=30_000;
  assert.deepEqual(await (await read()).json(),{online:1},'An inactive browser expires after 60 seconds');
  await route.POST(request('b'.repeat(32)));assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM clan_presence').get().n,1);
  for(const id of ['',null,'bad','c'.repeat(33),{name:'invalid'}])assert.equal((await route.POST(request(id))).status,400);
  assert.equal((await route.POST(request('c'.repeat(32),origin,{'content-length':'999'}))).status,413);
  for(const source of ['https://untrusted.pages.dev','https://priconne.pages.dev.attacker.invalid','http://priconne.pages.dev']) {
    response=await route.POST(request('c'.repeat(32),source));assert.equal(response.status,403);assert.equal(response.headers.has('access-control-allow-origin'),false);
  }
  for(const source of [origin,'https://heysyu84.github.io']) {
    response=route.OPTIONS(new Request(url,{method:'OPTIONS',headers:{origin:source,'access-control-request-method':'POST','access-control-request-headers':'content-type'}}));
    assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-origin'),source);
  }
  assert.equal(sqlite.prepare("SELECT payload FROM clan_state WHERE id='main'").get().payload,'preserve clan records');
  time+=route.PRESENCE_TTL_MS;assert.deepEqual(await (await read()).json(),{online:0});
  sqlite.exec('DROP TABLE clan_presence');assert.equal((await read()).status,503);
} finally {Date.now=originalNow;}

const saved=new Map(),storage={getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)};
const document={visibilityState:'visible',addEventListener(){},removeEventListener(){}},window={addEventListener(){},removeEventListener(){}};
const calls=[],counts=[],timers=[];let status=200;
const apiFetch=async(path,options)=>{calls.push({path,body:JSON.parse(options.body)});return Response.json({online:2},{status});};
const options={apiFetch,onCount:count=>counts.push(count),storage,document,window,locks:null,
  setInterval:(fn,delay)=>{timers.push({fn,delay});return timers.length;},clearInterval(){}};
const first=startPresence(options);await new Promise(setImmediate);
const second=startPresence(options);await new Promise(setImmediate);
assert.equal(calls.length,2);assert.equal(calls[0].body.browserId,calls[1].body.browserId);
assert.equal(calls[0].body.browserId,saved.get(BROWSER_PRESENCE_KEY));assert.match(calls[0].body.browserId,/^[a-f0-9]{32}$/);
assert.equal(calls[0].path,'/api/presence');assert.equal(timers[0].delay,PRESENCE_INTERVAL_MS);assert.equal(counts.at(-1),2);
document.visibilityState='hidden';await first.heartbeat();assert.equal(calls.length,2);
document.visibilityState='visible';status=503;await first.heartbeat();assert.equal(counts.at(-1),null,'A failed count is not displayed as zero');
first.stop();second.stop();const before=calls.length;await first.heartbeat();assert.equal(calls.length,before);
console.log('PASS: shared browser identities, 60-second expiry, inactive cleanup, exact CORS allowlist, isolated counts, graceful failures and non-blocking client heartbeats');
