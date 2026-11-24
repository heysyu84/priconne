import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot=fileURLToPath(new URL('../..',import.meta.url));
for(const pathname of ['redive/public/app.js','docs/compact/app.js']){
  const app=fs.readFileSync(path.join(repoRoot,pathname),'utf8');
  assert(!app.includes('동일한 클랜원·보스·피해량의 공격이 오늘'),pathname+' still shows the standard duplicate prompt');
  assert(!app.includes('이미 같은 클랜원의 '),pathname+' still shows the quick-entry duplicate prompt');
  assert(!app.includes('const suspect=data.logs.filter(e=>e.day===day'),pathname+' still scans standard entry history for warnings');
  assert(!app.includes('const duplicates=data.logs.filter(row=>row.day===day&&row.memberId'),pathname+' still scans quick-entry history for warnings');
  assert(app.includes("if(form.dataset.logSubmitPending==='1')return false;"),pathname+' must retain the normal-form click guard');
  assert(app.includes("if(form?.dataset?.logSubmitPending==='1')return false;"),pathname+' must retain the quick-entry click guard');
  assert(app.includes('if(!old&&!carry&&used>=data.rules.daily)'),pathname+' must retain daily attack limit');
  assert(app.includes('if(!old&&!carry&&daily.filter(row=>!row.carry).length>=data.rules.daily)'),pathname+' must retain quick-entry daily attack limit');
}
console.log('Battle log duplicate-history confirmation removed; submit and attack safeguards preserved.');
