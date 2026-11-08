import assert from 'node:assert/strict';
import {runtimeFixture} from './runtime-fixture.mjs';
import {decodeLegacy,encodeLegacy} from '../public/legacy-codec.mjs';

const app=runtimeFixture(),data=app.get();
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}

check('monthly boss names override stale slot portraits without changing records',()=>{
  const names=['프로스트 하운드','랜드 슬로스','번사우르스','다크 가고일','글러튼'];
  const files=['1.4','2.5','3.9','4.2','5.10'];
  const before=JSON.stringify(app.sharedDocument());
  for(let index=0;index<names.length;index++){
    const boss={id:index+1,name:names[index],portraitKey:String(index+1)};
    const art=app.bossArt(boss);
    assert.equal(art.name,names[index]);
    assert.equal(art.image,'./assets/future-'+files[index]+'.png');
    const face=app.bossFace(boss);
    assert.ok(face.includes('alt="'+names[index]+'"'));
    assert.ok(face.includes(art.image));
  }
  assert.equal(JSON.stringify(app.sharedDocument()),before);
});

check('explicit hidden portraits and custom images remain respected',()=>{
  const boss={id:1,name:'프로스트 하운드',portraitKey:'none'};
  assert.equal(app.bossArt(boss),null);
  boss.portraitKey='1';boss.portraitUrl='https://example.com/custom.png';
  assert.equal(app.bossArt(boss).image,boss.portraitUrl);
  assert.equal(app.bossArt(boss).name,boss.name);
});

check('tactic notes follow portraits for normal and carry tactics',()=>{
  for(const category of ['main','tabi','carry']){
    const tactic={...data.tactics[0],category,note:'위험 <주의>\n두 번째 메모'};
    const html=app.tacticReadingHeader(tactic);
    const portrait=html.indexOf('class="tactic-header-party"'),memo=html.indexOf('class="tactic-note tactic-reading-note"');
    assert.ok(portrait>=0&&memo>portrait,category);
    assert.equal((html.match(/tactic-reading-note/g)||[]).length,1);
    assert.ok(html.includes('&lt;주의&gt;<br>두 번째 메모'));
    if(category==='carry')assert.ok(html.indexOf('carry-summary')<portrait);
  }
});

check('skip link focuses the current content without replacing the route or filters',()=>{
  app.ui.section='records';app.ui.tabs.records='history';app.location.hash='#records/history';
  const before=JSON.stringify(app.ui);let prevented=0,focused=0,scrolled=0;
  const main=app.document.getElementById('main');
  main.setAttribute=(key,value)=>{assert.equal(key,'tabindex');assert.equal(value,'-1');};
  main.focus=()=>{focused++;};main.scrollIntoView=()=>{scrolled++;};
  app.skipToMain({target:{closest:selector=>selector==='a.skip-link'?{}:null},preventDefault(){prevented++;}});
  assert.equal(prevented,1);assert.equal(focused,1);assert.equal(scrolled,1);
  assert.equal(app.location.hash,'#records/history');assert.equal(JSON.stringify(app.ui),before);
  app.skipToMain({target:{closest:()=>null},preventDefault(){throw new Error('unrelated link intercepted');}});
  assert.equal(focused,1);
});


check('record tabs precede day selection and keep the same heading across tabs',()=>{
 const f=runtimeFixture();f.ui.section='records';f.ui.tabs.records='ranking';
 const ranking=f.fullRecords(),tabs=ranking.indexOf('role="tablist"'),days=ranking.indexOf('class="records-day-filter"');
 assert.ok(tabs>=0&&days>tabs);
 assert.match(ranking.slice(days),/class="day-switch"/);
 const heading=ranking.slice(0,tabs);
 for(const tab of ['profile','history','hall','archive']){
  f.ui.tabs.records=tab;
  const html=f.fullRecords();
  assert.equal(html.slice(0,html.indexOf('role="tablist"')),heading,tab);
  assert.doesNotMatch(html.slice(0,html.indexOf('role="tablist"')),/day-switch/);
 }
});

check('one common guide serves every tactic tab and stage 3 ignores the prior boss filter',()=>{
 const f=runtimeFixture(),d=f.get();d.rules.stage3Mode='show';
 f.ui.section='tactics';f.ui.boss=2;f.ext.noticeOpen=true;
 const before=JSON.stringify(f.sharedDocument());
 for(const tab of ['stage3','workspace','external']){
  f.ui.tabs.tactics=tab;
  const html=f.fullTactics();
  assert.equal((html.match(/data-action="v2-toggle-notice"/g)||[]).length,1,tab);
  assert.match(html,/class="tactics-subnav"/);
  assert.ok(html.indexOf('tactic-guide-toggle')<html.indexOf('role="tablist"'),'the common guide is first in keyboard and visual order');
  assert.match(html,/빨간색 이름 = 부스터 캐릭터/);
  assert.match(html,/추천 서포트를 파란색/);
  assert.equal((html.match(/모의전/g)||[]).length,1,tab);
  if(tab==='stage3'){
   assert.doesNotMatch(html,/workspace-boss-filters|data-action="boss-filter"/);
   assert.ok(f.workspaceList().some(t=>t.boss!==2));
  }else if(tab==='workspace')assert.match(html,/data-action="boss-filter"/);
 }
 assert.equal(JSON.stringify(f.sharedDocument()),before);
});
check('common guide edits remain identical across stages and survive the shared storage format',()=>{
 const f=runtimeFixture(),d=f.get(),text='【공통 안내】\n• 새 안내 <확인>';
 d.settings.editable=true;
 const handler=f.listeners.submit.find(fn=>String(fn).includes("kind==='v2-notice'"));
 const form={notice:text,dataset:{form:'v2-notice'}};form.closest=()=>form;
 handler({target:form,preventDefault(){},stopImmediatePropagation(){}});
 assert.equal(d.notices[3],text);assert.equal(d.notices[4],text);
 f.ui.section='tactics';d.rules.stage3Mode='show';
 for(const tab of ['stage3','workspace']){f.ui.tabs.tactics=tab;assert.match(f.fullTactics(),/새 안내 &lt;확인&gt;/);}
 const reference=f.sharedDocument(),month=f.ui.month,s=reference.seasons[month];
 const root={months:{[month]:{month,options:{days:5,dailyAttacks:3,startStage:2},bosses:s.bossSettings,levels:s.rules.levels,events:[],tactics:[],recommendations:[],memberIds:[],membership:{}}},roster:[]};
 const doc=decodeLegacy(root,{},reference);doc.seasons[month].notices={3:text,4:text};
 const encoded=encodeLegacy(doc,root,{},reference),restored=decodeLegacy(encoded.data,{},reference);
 assert.equal(restored.seasons[month].notices[3],text);assert.equal(restored.seasons[month].notices[4],text);
 d.settings.editable=false;form.notice='수정 불가';
 handler({target:form,preventDefault(){},stopImmediatePropagation(){}});
 assert.equal(d.notices[3],text);assert.equal(d.notices[4],text);
});

check('empty resource URLs remain as disabled monochrome header items',()=>{
 data.communityLinks=[{label:'망령 링크',url:''},{label:'세미 모음',url:'https://example.org/guide'},{label:'이월 모음',url:' '}];
 const html=app.evaluate('headerResourceButtons()');
 assert.match(html,/<span class="button header-resource-button header-resource-disabled" data-resource="ghost" aria-disabled="true" title="링크 미등록">망령<\/span>/);
 assert.match(html,/<a class="button header-resource-button" data-resource="semi" href="https:\/\/example\.org\/guide" target="_blank"/);
 assert.match(html,/<span class="button header-resource-button header-resource-disabled" data-resource="carry" aria-disabled="true" title="링크 미등록">이월<\/span>/);
 assert.equal((html.match(/header-resource-disabled/g)||[]).length,2);
});
check('link editor saves empty URL with its label and original ordering',()=>{
 data.settings.editable=true;
 const handler=app.listeners.submit.find(fn=>fn.toString().includes("if(kind==='v2-links')"));
 assert.ok(handler);
 const values={'label-0':'망령 링크','url-0':'','label-1':'세미 모음','url-1':'https://example.org/guide','label-2':'이월 모음','url-2':''};
 const form={dataset:{form:'v2-links'},...values,closest(){return this;}};
 let prevented=false;
 handler({target:form,preventDefault(){prevented=true;},stopImmediatePropagation(){}});
 assert.equal(prevented,true);
 assert.deepEqual(JSON.parse(JSON.stringify(data.communityLinks)),[
  {label:'망령 링크',url:''},{label:'세미 모음',url:'https://example.org/guide'},{label:'이월 모음',url:''}
 ]);
});

console.log(checks+' UI regression checks passed');
