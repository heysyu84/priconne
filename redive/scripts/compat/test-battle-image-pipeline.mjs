import assert from 'node:assert/strict';
import {createBattleImageImport} from '../../public/compat/battle-image-import.mjs';

// Exercise crop detection, field-only OCR, matching, sorting and persistence together.
// Fake OCR isolates application behavior; recognition quality still needs real screenshots.
const image={width:1280,height:590,data:new Uint8ClampedArray(1280*590*4)};image.data.fill(255);
const rectangle=(x,y,w,h,color)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)image.data.set([...color,255],(yy*image.width+xx)*4);};
for(const y of [160,267,374]){
 rectangle(389,y+1,130,25,[202,35,90]);rectangle(524,y+2,69,22,[228,97,107]);rectangle(612,y,120,24,[96,154,238]);
}
const listeners={},nodes=new Map();let html='',persisted=0,terminated=0,closed=0;
globalThis.document={
 addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn),getElementById:id=>nodes.get(id),
 createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){},fillRect(){},putImageData(){},getImageData:(x,y,w,h)=>w===1280&&h===590?image:{data:new Uint8ClampedArray(w*h*4)}})})
};
globalThis.createImageBitmap=async()=>({width:1280,height:590,close(){closed++;}});
globalThis.confirm=()=>true;
const app={active:'2026-09',roster:[{id:'a',name:'사이트이름',aliases:['다람이']},{id:'b',name:'하니'}]};
const month={options:{days:5},memberIds:['a','b'],bosses:[{id:1,name:'테스트보스'}],events:[]};
const importer=createBattleImageImport({getApp:()=>app,getMonth:()=>month,canEdit:()=>true,notify(){},navigate(){},
 replay:m=>m.events.forEach(e=>e.stage=4),persist(){persisted++;},render(){html=importer.view();}});
const action=name=>{const button={dataset:{bli:name},closest:()=>({})};for(const fn of listeners.click)fn({target:{closest:()=>button},preventDefault(){}});};
const change=target=>{target.closest=()=>({});for(const fn of listeners.change)fn({target});};
const reading=(text,confidence=90)=>({text,confidence});
const row=(names,damage,date)=>[
 reading('실전'),...names.map(([text,confidence])=>reading(text,confidence)),
 ...damage.map(text=>reading(text)),reading(date),reading('4'),reading('테스트보스'),reading('테스트보스')
];
let readings=[
 ...row([['아무글자',99],['다람이',35],['다람이',60]],['189633896','189633896','189633896'],'2026/09/28 23:53'),
 reading('모의전'),
 ...row([['하니',90],['하니',90],['하니',90]],['360074666','360074666','360074666'],'2026/09/28 23:42')
];
let parameters={};const calls=[];
globalThis.Tesseract={createWorker:async()=>({
 setParameters:async value=>parameters={...parameters,...value},
 recognize:async canvas=>{
  assert.ok(canvas.width<1300&&canvas.height<500,'Detailed OCR must never scan the whole row or portraits');
  assert.ok(readings.length,'Unexpected OCR pass');calls.push({...parameters});return {data:readings.shift()};
 },terminate:async()=>terminated++
})};
change({id:'bli-files',files:[new Blob(['fixture'],{type:'image/png'})]});action('analyze');
for(let tries=0;tries<100&&!terminated;tries++)await new Promise(resolve=>setImmediate(resolve));
assert.equal(terminated,1);assert.equal(closed,1);assert.equal(readings.length,0);
assert.match(html,/등록 가능한 선택 기록 2건/);assert.match(html,/모의전 1건 제외/);
assert.match(html,/<option value="a" selected>사이트이름/);
assert.ok(!html.includes('data-bli-name-map="아무글자"'),'Known alias wins over high-confidence hallucination');
assert.equal(calls.filter(call=>call.tessedit_char_whitelist==='0123456789, ').length,6);
assert.deepEqual(month.events,[],'Analyzing images must not write battle records');
action('commit');
assert.equal(persisted,1);assert.deepEqual(month.events.map(e=>e.memberId),['b','a']);
assert.deepEqual(month.events.map(e=>e.damage),[360074666,189633896]);
assert.deepEqual(month.events.map(e=>e.gameAt),['2026-09-28T23:42','2026-09-28T23:53']);
assert.deepEqual(month.events.map(e=>e.seq),[1,2]);

// Re-importing the same screenshot must offer no duplicate records.
readings=[...row([['다람이',90],['다람이',90],['다람이',90]],['189633896','189633896','189633896'],'2026/09/28 23:53'),reading('모의전'),
 ...row([['하니',90],['하니',90],['하니',90]],['360074666','360074666','360074666'],'2026/09/28 23:42')];
action('analyze');for(let tries=0;tries<100&&terminated<2;tries++)await new Promise(resolve=>setImmediate(resolve));
assert.equal(terminated,2);assert.match(html,/등록 가능한 선택 기록 0건/);assert.match(html,/중복 후보/);
assert.equal(month.events.length,2);assert.equal(persisted,1);
console.log('PASS: adaptive field OCR, alias matching, practice exclusion, chronological commit and duplicate review');
