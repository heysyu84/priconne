import assert from 'node:assert/strict';
import {createBattleImageImport} from '../public/battle-image-import.mjs';

const listeners={},nodes=new Map();let html='',renders=0;
globalThis.document={addEventListener:(key,fn)=>(listeners[key]??=[]).push(fn),getElementById:id=>nodes.get(id)};
const app={active:'2026-10',roster:[{id:'m1',name:'테스트클랜원'}]};
const month={options:{days:5},memberIds:['m1'],bosses:[{id:1,name:'테스트보스'}],events:[]};
const importer=createBattleImageImport({getApp:()=>app,getMonth:()=>month,persist(){},render(){renders++;html=importer.view();},navigate(){},notify(){},canEdit:()=>true,unlock(){},replay(){}});
function action(name){const button={dataset:{bli:name},closest:()=>({})};for(const fn of listeners.click)fn({target:{closest:()=>button},preventDefault(){}});}
nodes.set('bli-raw',{value:'2026/10/23 12:30\n테스트클랜원\n테스트보스 입힌 데미지 123456789'});
action('parse-text');
const id=html.match(/data-bli-id="([^"]+)"/)[1];
function change(field,value){const target={dataset:{bliField:field},value,checked:value,closest:s=>s==='[data-bli-id]'?{dataset:{bliId:id}}:{}};for(const fn of listeners.change)fn({target});}
assert.match(html,/등록 가능한 선택 기록 1건/);
change('selected',false);
assert.match(html,/등록 가능한 선택 기록 0건/);
assert.match(html,/data-bli="commit" disabled/);
change('selected',true);
assert.match(html,/등록 가능한 선택 기록 1건/);
assert.ok(!html.includes('data-bli="commit" disabled'));
change('damage','');change('damage','123456789');
assert.match(html,/data-bli="commit" disabled/);
const before=renders;change('selected',true);
assert.ok(renders>before,'Selection must immediately update the displayed actions');
assert.match(html,/등록 가능한 선택 기록 1건/);
assert.ok(!html.includes('data-bli="commit" disabled'),'A corrected, selected row must enable registration');
assert.deepEqual(month.events,[],'Preview interactions must not add battle records');
console.log('PASS: OCR review selection, counts and registration button after correcting a row');

nodes.set('bli-raw',{value:'2026/10/23 12:30\n테스트클랜원\n테스트보스 입힌 데미지 234567890'});action('parse-text');
assert.match(html,/동일 시각/);
let ids=[...html.matchAll(/data-bli-id="([^"]+)"/g)].map(m=>m[1]);
const shift={dataset:{bliShift:ids[1],direction:'-1'},closest:()=>({})};
for(const fn of listeners.click)fn({target:{closest:()=>shift},preventDefault(){}});
assert.equal([...html.matchAll(/data-bli-id="([^"]+)"/g)][0][1],ids[1]);
const image=new Blob(['test'],{type:'image/png'});
for(const fn of listeners.change)fn({target:{id:'bli-files',files:[image],closest:()=>({})}});
assert.match(html,/data-bli-crop-surface/);
for(const fn of listeners.change)fn({target:{dataset:{bliCropField:'x'},value:'95',closest:()=>({})}});
assert.match(html,/left:95%/);assert.match(html,/data-bli-crop-field="w" value="5.0"/);
const surface={getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}),setPointerCapture(){},querySelector:()=>({style:{}})};
for(const fn of listeners.pointerdown)fn({target:{closest:()=>surface},clientX:10,clientY:20,pointerId:1,preventDefault(){}});
for(const fn of listeners.pointermove)fn({clientX:70,clientY:80});
for(const fn of listeners.pointerup)fn({});html=importer.view();
assert.match(html,/left:10%;top:20%;width:60/);assert.match(html,/data-bli-crop-field="h" value="60.0"/);
action('reset-crop');assert.match(html,/left:13.3%/);
action('clear');assert.ok(!html.includes('data-bli-crop-surface'));assert.deepEqual(month.events,[]);
console.log('PASS: same-minute order and local crop selection/reset');

// Exercise the actual asynchronous image pipeline without downloading an OCR model.
app.roster=[{id:'m1',name:'리온'},{id:'m2',name:'질풍리온'},{id:'m3',name:'슈'}];
month.memberIds=app.roster.map(p=>p.id);
const readings=[
 '2026/10/23 12:30\n리온\n테스트보스 입힌 데미지 233831766',
 '실전','_ 질풍리온','333831766','테스트보스',
 '모의전 2026/10/23 12:31\n슈\n테스트보스 입힌 데미지 336598960',
 '2026/10/23 12:32\n리온\n테스트보스 입힌 데미지 322316115',
 '실전','직풍리온','슈','322316115','테스트보스'
];
let terminated=false,closed=false;
globalThis.Tesseract={createWorker:async()=>({
 setParameters:async()=>{},recognize:async()=>({data:{text:readings.shift()}}),
 terminate:async()=>{terminated=true;}
})};
globalThis.createImageBitmap=async()=>({width:1536,height:709,close(){closed=true;}});
document.createElement=()=>({width:0,height:0,getContext:()=>({drawImage(){},fillRect(){},getImageData:()=>({data:new Uint8ClampedArray(4)}),putImageData(){}})});
for(const fn of listeners.change)fn({target:{id:'bli-files',files:[image],closest:()=>({})}});
action('analyze');
for(let tries=0;tries<100&&!terminated;tries++)await new Promise(resolve=>setImmediate(resolve));
assert.ok(terminated&&closed,'The OCR worker and bitmap must be released');
assert.equal(readings.length,0,'Read individual fields and retry an unresolved full nickname');
assert.match(html,/등록 가능한 선택 기록 2건/);
assert.match(html,/333,831,766/,'Use the dedicated damage crop, including the correct first digit');
assert.ok(!html.includes('336,598,960'),'Do not offer a recognized practice battle for registration');
assert.match(html,/<option value="m2" selected>질풍리온/);
assert.match(html,/<option value="m3" selected>슈/);
assert.deepEqual(month.events,[],'OCR analysis must not register records automatically');
console.log('PASS: field OCR, full nickname matching/retry, damage correction and practice exclusion');

action('clear');terminated=false;
readings.push(
 '2026/10/23 12:30\n입힌 데미지 333831766','실전','아메스','아메스','아메스','333831766','테스트보스',
 '2026/10/23 12:31\n입힌 데미지 336598960','모의전',
 '2026/10/23 12:32\n입힌 데미지 322316115','실전','아메스','아메스','아메스','322316115','테스트보스'
);
for(const fn of listeners.change)fn({target:{id:'bli-files',files:[image],closest:()=>({})}});
action('analyze');for(let tries=0;tries<100&&!terminated;tries++)await new Promise(resolve=>setImmediate(resolve));
assert.ok(terminated);assert.equal(readings.length,0);
assert.match(html,/등록 가능한 선택 기록 0건/);
assert.match(html,/data-bli-name-map="아메스"/);
assert.match(html,/모의전 1건 제외/);
for(const fn of listeners.change)fn({target:{dataset:{bliNameMap:'아메스'},value:'m3',closest:()=>({})}});
assert.match(html,/등록 가능한 선택 기록 2건/,'One nickname mapping must resolve and select every matching valid row');
assert.equal(app.roster.find(p=>p.id==='m3').name,'슈','Mapping must preserve the canonical site name');
assert.deepEqual(app.roster.find(p=>p.id==='m3').aliases,undefined,'A temporary game nickname must not silently become a permanent alias');
assert.deepEqual(month.events,[]);
console.log('PASS: practice badge OCR and one-time nickname mapping across the batch without changing site names');
