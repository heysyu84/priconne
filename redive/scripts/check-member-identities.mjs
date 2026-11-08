import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const expected=new Map([['syn','236721957548'],['vodive','113821923458'],['voidive','113821923458'],['nera','716721947178']]);
let identities=0,files=0;
function inspect(value,where){
 if(Array.isArray(value)){value.forEach((item,index)=>inspect(item,where+'['+index+']'));return;}
 if(!value||typeof value!=='object')return;
 const uid=expected.get(String(value.name||'').toLowerCase());
 if(uid&&Object.hasOwn(value,'uid')){assert.equal(String(value.uid),uid,where+' '+value.name);identities++;}
 for(const key of ['name','member','recordedName'])if(typeof value[key]==='string')assert.ok(!['50091','상현','50091 (상현)'].includes(value[key]),where+'.'+key);
 for(const [key,item]of Object.entries(value))inspect(item,where+'.'+key);
}
for(const directory of ['data','public']){
 const base=path.join(root,directory);
 for(const file of fs.readdirSync(base,{recursive:true}).filter(file=>file.endsWith('.json'))){
  const full=path.join(base,file);if(!fs.statSync(full).isFile())continue;
  inspect(JSON.parse(fs.readFileSync(full,'utf8')),directory+'/'+file);files++;
 }
}
const roster=JSON.parse(fs.readFileSync(path.join(root,'data/roster-reference.json'),'utf8'));
const reye=roster.find(member=>member.name==='레예');
assert.equal(reye.left,'2025-06');assert.equal(reye.periods.at(-1).to,'2025-06');assert.equal(reye.sourcePeriod,'2022.11~2025.06');
const guild=JSON.parse(fs.readFileSync(path.join(root,'../clan-battle/public/guild-source.json'),'utf8'));
inspect(guild,'guild-source');assert.equal(guild.roster.find(member=>member.name==='레예').leftMonth,'2025-06');
assert.ok(identities>50,'scan the historical membership records as well as the reference roster');
console.log('PASS '+identities+' identity records across '+files+' JSON files; June 2025 membership references agree');

// The previous UI was changed only in the generated bundle. Keep source and
// deployed code reproducible so the next rebuild cannot undo those changes.
const build=fs.readFileSync(path.join(root,'scripts/build.mjs'),'utf8');
const modules=[...build.match(/const files=\[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(match=>match[1]);
const code=fs.readFileSync(path.join(root,'public/app.js'),'utf8').replace(/^import[^\n]+\n/gm,'');
const combined=modules.map(name=>fs.readFileSync(path.join(root,'src',name+'.js'),'utf8')).join('\n\n')+'\ninitializeCompletePrototype(); if(typeof fetch==="function") initializeSharedSync();\n';
assert.equal(code,combined,'the source modules must reproduce the current application exactly');
console.log('PASS current UI and source modules reproduce the same application');
