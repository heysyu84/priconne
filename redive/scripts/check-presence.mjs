import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {startPresence,BROWSER_PRESENCE_KEY} from '../public/presence.mjs';
import {createApiClient} from '../public/compat/api-client.mjs';

const values=new Map([[BROWSER_PRESENCE_KEY,'a'.repeat(32)]]),calls=[],counts=[];
const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
const document={visibilityState:'visible',addEventListener(){},removeEventListener(){}},window={addEventListener(){},removeEventListener(){}};
const fetcher=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({online:7}),{headers:{'Content-Type':'application/json'}});};
const apiFetch=createApiClient({apiOrigin:'https://clan.example',pageOrigin:'https://priconne.pages.dev',storage,fetcher});
const client=()=>startPresence({apiFetch,onCount:count=>counts.push(count),storage,crypto:webcrypto,document,window,locks:null,setInterval:()=>1,clearInterval(){}});
const first=client();await new Promise(resolve=>setImmediate(resolve));
const second=client();await new Promise(resolve=>setImmediate(resolve));
assert.equal(calls.length,2);assert.equal(calls[0].url,'https://clan.example/api/presence');assert.equal(calls[0].options.credentials,'omit');
assert.equal(JSON.parse(calls[0].options.body).browserId,'a'.repeat(32));assert.equal(calls[0].options.body,calls[1].options.body);assert.deepEqual(counts,[7,7]);
document.visibilityState='hidden';await first.heartbeat();assert.equal(calls.length,2);
document.visibilityState='visible';await first.heartbeat();assert.equal(calls.length,3);
first.stop();second.stop();await first.heartbeat();assert.equal(calls.length,3);
console.log('PASS presence uses the original browser identity across tabs, reports the shared count, skips hidden tabs and stops cleanly');
