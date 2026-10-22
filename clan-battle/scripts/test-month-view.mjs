import assert from 'node:assert/strict';
import {createMonthView} from '../public/month-view.mjs';

const freeze=o=>{for(const value of Object.values(o))if(value&&typeof value==='object')freeze(value);return Object.freeze(o);};
const live=freeze({month:'2026-10',events:[],bosses:[]});
let app=freeze({active:'2026-10',months:{'2026-10':live},archivedMonths:['2026-09','2026-08']});
const original=JSON.stringify(app),calls=[],replies=new Map(),cache=new Map();
const view=createMonthView({getApp:()=>app,cache,fetchMonth:key=>{
  calls.push(key);return new Promise((resolve,reject)=>replies.set(key,{resolve,reject}));
}});
assert.deepEqual(view.keys(),['2026-10','2026-09','2026-08']);
assert.equal(view.record(),live);assert.equal(view.isPast(),false);assert.equal(calls.length,0);
const september=view.select('2026-09'),sameRequest=view.load('2026-09');
assert.equal(view.key(),'2026-10');assert.equal(calls.length,1);
const past={month:'2026-09',events:[{id:'kept'}],bosses:[]};
replies.get('2026-09').resolve(past);
assert.equal(await september,true);assert.equal(await sameRequest,past);
assert.equal(view.record(),past);assert.equal(view.isPast(),true);
assert.equal(view.app().active,'2026-09');assert.equal(view.app().months['2026-09'],past);
assert.equal(JSON.stringify(app),original,'Archive viewing must never enter the editable save payload');
await view.select('2026-10');assert.equal(view.app(),app);assert.equal(view.isPast(),false);
await view.select('2026-09');assert.equal(calls.length,1,'A summary and detailed view share one fetched month');

const late=view.select('2026-08');
await view.select('2026-10');
replies.get('2026-08').resolve({events:[],bosses:[]});
assert.equal(await late,false);assert.equal(view.key(),'2026-10','A slow earlier request cannot undo a newer selection');
view.reset();assert.equal(view.record(),live);
await assert.rejects(()=>view.select('2020-01'),/조회할 월/);
assert.equal(view.key(),'2026-10');

app={...app,archivedMonths:[...app.archivedMonths,'2026-07']};
const failing=view.select('2026-07');replies.get('2026-07').reject(Error('offline'));
await assert.rejects(()=>failing,/offline/);assert.equal(view.record(),live);
const retry=view.select('2026-07');replies.get('2026-07').resolve({events:[],bosses:[]});
assert.equal(await retry,true);assert.equal(calls.filter(k=>k==='2026-07').length,2);
view.reset();assert.equal(view.isPast(),false);
console.log('PASS: lazy historical detail loading, shared cache, unchanged save payload, request races and failed-load recovery');
