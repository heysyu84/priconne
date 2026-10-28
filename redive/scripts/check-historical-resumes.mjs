import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runtimeFixture} from './runtime-fixture.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL('../public/'+path,import.meta.url)));
const years=[2019,2020,2021,2022,2023,2024,2025],entries=years.flatMap(y=>read('history-'+y+'/manifest.json').months);
assert.equal(entries.length,78);assert.equal(new Set(entries.map(m=>m.month)).size,78);
const app=runtimeFixture();app.ui.section='records';app.ui.tabs.records='archive';
app.evaluate('oldResumeIndex='+JSON.stringify({months:entries})+';');const before=JSON.stringify(app.sharedDocument());
let months=0,attacks=0,personal=0,missing=0;
for(const entry of entries.filter(e=>e.month<'2024-01')){
 const d=read('history-'+entry.month.slice(0,4)+'/'+entry.month+'.json');months++;attacks+=d.logs.length;
 assert.equal(d.month,entry.month);assert.equal(d.logs.length,entry.attacks);
 assert.equal(new Set(d.logs.map(l=>l.seq)).size,d.logs.length);
 if(d.coverage==='summary'){missing++;assert.equal(d.logs.length,0);assert.equal(d.totals.game,null);assert.equal(d.memberCount,null);}
 else{
  for(const [key,eventKey]of [['damage','actual'],['contribution','contribution']]){
   const total=d.logs.reduce((s,l)=>s+l[eventKey],0);assert.ok(Math.abs(total-d.totals[key])<.001,entry.month+' '+key);
   assert.ok(Math.abs(d.members.reduce((s,p)=>s+p[key],0)-d.totals[key])<.001);
  }
  if(d.coverage==='personal'){personal++;assert.ok(d.members.every(p=>p.damageRank===null));assert.equal(d.memberCount,null);}
  else if(d.logs.every(l=>Number.isFinite(l.game)))assert.ok(Math.abs(d.logs.reduce((s,l)=>s+l.game,0)-d.totals.game)<.001,entry.month+' game');
 }
 app.evaluate('oldResumeMonth='+JSON.stringify(d.month)+';oldResumeData='+JSON.stringify(d)+';oldResumePerson="__clan__";oldResumeDay=0;oldResumeProfileDay=0;oldResumeStage=0;');
 for(const view of ['summary','logs','ranking','profile','tactics']){
  app.ext.archiveView=view;const html=app.fullRecords();assert.equal(html.match(/NaN|undefined|null일차|null명|>0위/)?.[0],undefined,d.month+' '+view);
  assert.equal((html.match(/id="archive-month"/g)||[]).length,1);
  if(d.coverage==='summary')assert.match(html,/공격 상세 자료는 남아 있지 않습니다/);
  if(d.coverage==='personal'&&view==='ranking')assert.doesNotMatch(html,/ranking-detail/);
  if(d.coverage==='personal'&&view==='profile')assert.doesNotMatch(html,/>클랜 전체<\/option>/);
  if(view==='profile'&&d.days>5)assert.ok(html.includes('>'+d.days+'일차</button>'),entry.month+' last day');
  if(d.dayDetailAvailable===false&&view==='profile')assert.doesNotMatch(html,/daily-paired-bars/);
 }
}
assert.equal(months,54);assert.equal(attacks,31850);assert.equal(personal,2);assert.equal(missing,7);
assert.equal(read('history-2020/2020-10.json').logs.length,944);
assert.ok(read('history-2020/2020-04.json').logs.every(l=>l.day===null));
assert.equal(JSON.stringify(app.sharedDocument()),before);
console.log('PASS 54 additional months, 31,850 attacks, exact source totals, variable days, partial/missing coverage, all record views and live-data preservation');
// Check the report's drawing bounds without a browser or screenshot.
const labels=[],bounds=[];
const ctx={fillRect(x,y,w,h){bounds.push([x,y,w,h]);},fillText(label,x,y){labels.push({label:String(label),x,y});},beginPath(){},arc(x,y,r){bounds.push([x-r,y-r,r*2,r*2]);},stroke(){}};
globalThis.document={fonts:{ready:Promise.resolve()},createElement(){return {getContext:()=>ctx,toDataURL:()=> 'data:image/jpeg;base64,/9j/2Q=='};}};
const {createProfilePdf}=await import('../public/report-pdf.mjs');
for(const month of ['2019-11','2020-04','2023-01']){
 const d=read('history-'+month.slice(0,4)+'/'+month+'.json');labels.length=0;bounds.length=0;
 const result=await createProfilePdf({month,all:true,coverage:d.coverage,dayDetailAvailable:d.dayDetailAvailable,days:d.dayDetailAvailable===false?0:d.days,bosses:d.bossNames.map((name,i)=>({id:i+1,name})),events:d.logs,summary:{name:d.coverage==='personal'?'보관 기록 전체':'클랜 전체',...d.totals},contribution:l=>l.contribution});
 assert.equal(result.pages,1);assert.ok(labels.every(t=>Number.isFinite(t.x)&&Number.isFinite(t.y)&&t.y>=0&&t.y<=1754));assert.ok(bounds.every(b=>b.every(Number.isFinite)&&b[1]+b[3]<=1754));
 if(month==='2019-11'){assert.ok(labels.some(t=>t.label==='10일차'));assert.ok(!labels.some(t=>t.label.includes('클랜 합계')));}
 if(month==='2020-04'){assert.ok(labels.some(t=>t.label==='월 합계'));assert.ok(!labels.some(t=>t.label==='1일차'));}
 if(month==='2023-01'){assert.ok(labels.some(t=>t.label==='1단계'));assert.ok(labels.some(t=>t.label==='5단계'));}
}
console.log('PASS single-page report drawing bounds, ten-day records, unavailable-day totals, personal scope and historical stages');
