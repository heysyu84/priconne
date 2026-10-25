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

console.log(checks+' UI regression checks passed');
