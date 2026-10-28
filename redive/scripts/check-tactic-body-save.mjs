import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {decodeLegacy,encodeLegacy} from '../public/legacy-codec.mjs';
const root={active:'2026-10',roster:[],months:{'2026-10':{month:'2026-10',bosses:[],options:{},tactics:[],events:[]}}};
const body='1:30 AUTO 오프, 전부 SET\n1:12 바이올렛 OFF\n0:57 바이올렛 ON';
const original={id:'tactic',party:['파오이','커리코','윈에루','그레이스','바이올렛'],stars:[5,5,5,5,5],stage:4,category:'tabi',boss:2,damage:2.6,hands:0,tp:'4.2',duration:90,support:-1,note:'',video:'',links:[],hidden:false,text:body,rows:null};
const doc=decodeLegacy(root);doc.seasons['2026-10'].tactics.push(original);
const saved=encodeLegacy(doc,root).data;
const stored=saved.months['2026-10'].tactics[0];assert.equal(stored.rows.length,3);assert.equal(stored.rows.map(r=>r.text).join('\n'),body);
let reopened=decodeLegacy(saved);assert.equal(reopened.seasons['2026-10'].tactics[0].text,body);
reopened.seasons['2026-10'].tactics[0].damage=2.7;assert.deepEqual(encodeLegacy(reopened,saved).data.months['2026-10'].tactics[0].rows,stored.rows);
reopened.seasons['2026-10'].tactics[0].text=body+'\n0:20 AUTO 온';reopened.seasons['2026-10'].tactics[0].rows=null;assert.equal(encodeLegacy(reopened,saved).data.months['2026-10'].tactics[0].rows.length,4);
reopened=decodeLegacy(saved);Object.assign(reopened.seasons['2026-10'].tactics[0],{text:'',rows:[]});assert.deepEqual(encodeLegacy(reopened,saved).data.months['2026-10'].tactics[0].rows,[]);
for(const file of ['../src/tactics.js','../public/app.js','../../docs/compact/app.js']){
 const code=readFileSync(new URL(file,import.meta.url),'utf8'),fn=code.slice(code.indexOf('function saveCompleteTactic('),code.indexOf('\n',code.indexOf('function saveCompleteTactic(')));
 const ctx={FormData:class{constructor(){return new Map(Object.entries({tacticId:'',duration:'1:30',damage:'2.6',category:'tabi',boss:'2',hands:'0',tp:'4.2',text:body,note:'',video:'',support:'-1',...Object.fromEntries(original.party.map((p,i)=>['party-'+i,p])),...Object.fromEntries(original.stars.map((p,i)=>['star-'+i,String(p)]))}));}},timeToSec:()=>90,checkpoint(){},uid:()=> 'new',data:{tactics:[]},ui:{},ext:{},pasteRows:(text)=>text.split('\n').map(text=>({text,checked:[false,false,false,false,false,false]})),persist(){assert.equal(ctx.data.tactics[0].rows.length,3);},closeDrawer(){},nav(){},toast(){}};
 vm.runInNewContext(fn+';saveCompleteTactic({});',ctx);
}
console.log('PASS tactic form persists parsed rows before render; new/changed body round-trips; metadata preserves SET and formatting; explicit clearing remains supported');
