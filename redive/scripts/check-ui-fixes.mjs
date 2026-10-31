import assert from 'node:assert/strict';
import {runtimeFixture} from './runtime-fixture.mjs';

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
