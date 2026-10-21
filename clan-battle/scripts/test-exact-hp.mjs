import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseDamage } from '../public/roster.mjs';
import { replayMonth, bossProgress, validateBattleNumbers, estimateCarry } from '../public/engine.mjs';
const html=fs.readFileSync(new URL('../public/clan-shell.html',import.meta.url),'utf8');
const seed=JSON.parse(html.match(/<script id="seed-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
for(const [input,value] of [['1',1],['1,323,456,789',1323456789],['1.00000001억',100000001],['0.00000001억',1],['1.2345만',12345],['1.000',1],['9007199254740991',Number.MAX_SAFE_INTEGER]])assert.equal(parseDamage(input),value,input);
for(const input of ['0.1','1.000000001억','1.23456만','9007199254740992','9007199254740993','1.0000000000000001억'])assert.ok(Number.isNaN(parseDamage(input)),input);
const d=structuredClone(seed.months['2026-10']);d.options.autoContribution=false;
d.levels=[{stage:2,start:1,end:1,count:1},{stage:3,start:2,end:2,count:1},{stage:4,start:3,end:100,count:98}];
d.bosses[0].hp[2]=1323456789;d.bosses[0].hp[3]=1400000003;
d.events=[323456788,1000000000,1,17].map((damage,i)=>({id:'exact-'+i,seq:i+1,day:1,member:'검증',memberId:'exact-member',boss:1,damage,carry:i===3}));
replayMonth(d);
assert.deepEqual(d.events.map(e=>e.after),[1000000001,1,0,1399999986]);
assert.equal(d.events[2].kill,true);assert.equal(d.events[3].lap,2);assert.equal(d.events[3].stage,3);assert.equal(d.events[3].carryFrom,'exact-2');
assert.equal(bossProgress(d)[0].hp,1399999986);
d.events[0].damage++;
replayMonth(d);
assert.deepEqual(d.events.map(e=>e.after),[1000000000,0,1400000002,1399999985]);
assert.equal(d.events[3].carryFrom,'exact-1');
const saved=structuredClone(d);d.events[0].damage=.1;assert.throws(()=>replayMonth(d),/1 단위/);d.events=saved.events;d.bosses[0].hp[2]=.1;assert.throws(()=>validateBattleNumbers(d),/1 HP 단위/);
d.bosses[0].hp[2]=Number.MAX_SAFE_INTEGER;d.events=[{id:'limit',seq:1,day:1,member:'검증',boss:1,damage:Number.MAX_SAFE_INTEGER-1,carry:false}];replayMonth(d);assert.equal(d.events[0].after,1);
// The carry ceiling also uses an exact integer ratio at a one-HP boundary.
assert.equal(estimateCarry({hp:600000000,second:900000000}).seconds,50);
assert.equal(estimateCarry({hp:599999999,second:900000000}).seconds,51);
assert.equal(estimateCarry({hp:Number.MAX_SAFE_INTEGER,second:Number.MAX_SAFE_INTEGER}).seconds,0);
assert.equal(estimateCarry({hp:Number.MAX_SAFE_INTEGER-1,second:Number.MAX_SAFE_INTEGER}).seconds,21);
assert.ok(estimateCarry({hp:1.1,second:10}).error);
let checked=0;
for(const month of Object.values(seed.months)){replayMonth(month);for(const event of month.events){assert.ok(Number.isSafeInteger(event.before));assert.ok(Number.isSafeInteger(event.actual));assert.ok(Number.isSafeInteger(event.after));assert.equal(event.before-event.actual,event.after);checked++;}}
const art=JSON.parse(fs.readFileSync(new URL('../public/bosses.json',import.meta.url),'utf8'));
for(const [key,month] of Object.entries(seed.months))for(const boss of month.bosses){assert.equal(art[key][boss.id].name,boss.name);const bytes=fs.readFileSync(new URL('../public'+art[key][boss.id].portrait,import.meta.url));assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');}
console.log(`PASS: 1 HP remainder, exact decimal-unit parsing, kill/lap/edit cascade, carry ceiling, ${checked} archived attacks, 10 boss PNGs`);
