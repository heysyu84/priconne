import {readFile, writeFile, mkdir} from 'node:fs/promises';
import './build.mjs';

await mkdir('server',{recursive:true});
const source=await readFile('src/imported-month.js','utf8');
const imported=JSON.parse(source.slice(source.indexOf('=')+1).trim().replace(/;$/,''));
const initial={schema:1,referenceVersion:'roster-r1361-reader-v2',recordUpdates:[{month:'2026-10',id:'a8244c97-ada4-442e-8afb-0b95b875d515',fields:['stars','rows','text']}],siteCopy:{},futureOverrides:{},members:JSON.parse(await readFile('data/roster-reference.json','utf8')),characters:imported.characters,communityLinks:imported.communityLinks,seasons:{[imported.month]:imported.season},activeMonth:imported.month,importedSource:{...imported.provenance,key:imported.key}};
await writeFile('server/initial-state.mjs','export const initialState='+JSON.stringify(initial)+';\n');
let html=await readFile('public/index.html','utf8');
html=html.replace('냥냥클랜 2026년 10월 자료로 확인하는 새 인터페이스 시제품','냥냥클랜 클랜전 기록과 택틱').replace(/((?:src|href)=")\.\/([^"?#]+)(?:\?[^"#]*)?"/g,(_,prefix,file)=>`${prefix}./${file}?v=20261026-redive-ui06"`);
await writeFile('server/shell.mjs','export const shell='+JSON.stringify(html)+';\n');
console.log('Prepared shared server seed and retained interface');
