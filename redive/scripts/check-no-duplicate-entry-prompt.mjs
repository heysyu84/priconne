import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot=fileURLToPath(new URL('../..',import.meta.url));
const paths=['redive/src/admin.js','redive/src/log-tools.js','redive/public/app.js','docs/compact/app.js'];
const texts=new Map(paths.map(name=>[name,fs.readFileSync(path.join(repoRoot,name),'utf8')]));
for(const [name,app] of texts){
  assert(!app.includes('동일한 클랜원·보스·피해량의 공격이 오늘'),name+' contains the regular-entry warning');
  assert(!app.includes('이미 같은 클랜원의 '),name+' contains the quick-entry warning');
  assert(!app.includes('const suspect=data.logs.filter(e=>e.day===day'),name+' retains regular duplicate lookup');
  assert(!app.includes('const duplicates=data.logs.filter(row=>row.day===day&&row.memberId'),name+' retains quick-entry duplicate lookup');
}
for(const name of ['redive/src/admin.js','redive/public/app.js','docs/compact/app.js']){
  const app=texts.get(name);
  assert(app.includes("if(form.dataset.logSubmitPending==='1')return false;"),name+' must retain the normal-form click guard');
  assert(app.includes('if(!old&&!carry&&used>=data.rules.daily)'),name+' must retain normal-entry attack limits');
}
for(const name of ['redive/src/log-tools.js','redive/public/app.js','docs/compact/app.js']){
  const app=texts.get(name);
  assert(app.includes("if(form?.dataset?.logSubmitPending==='1')return false;"),name+' must retain the quick-entry click guard');
  assert(app.includes('if(!old&&!carry&&daily.filter(row=>!row.carry).length>=data.rules.daily)'),name+' must retain quick-entry attack limits');
}
console.log('PASS duplicate-entry confirmation absent in source and compiled bundles; attack and click guards preserved');
