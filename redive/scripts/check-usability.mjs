import assert from 'node:assert/strict';
import {runtimeFixture} from './runtime-fixture.mjs';
import * as partyTools from '../public/party-tools.mjs';
import * as logOrder from '../public/log-order.mjs';
import * as legacyTools from '../public/legacy-tools.mjs';

let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
const app=runtimeFixture(),data=app.get();
await check('all position facts are retained and game order points to the right',()=>{
  assert.equal(app.positionSource.count,351);assert.equal(data.characters.find(c=>c.name==='리마').position,105);
  const names=['수사렌','수리코','수미미','수페코','사루카'],parsed=partyTools.parseLineup(names.join(' '),data.characters);
  assert.equal(parsed.valid,true);assert.deepEqual(parsed.names,names);assert.equal(partyTools.lineupOrder(parsed.names,data.characters).valid,true);
  const wrong=partyTools.lineupOrder([...names].reverse(),data.characters);assert.ok(wrong.inversions.length>0);assert.deepEqual(wrong.sorted,names);
  assert.equal(data.characters.find(c=>c.name==='수리아').position,413);assert.equal(data.characters.find(c=>c.name==='수밀리아').position,725);
});
await check('bulk names reject unknown characters and aliases for the same unit',()=>{
  assert.equal(partyTools.parseLineup('수사렌 수리코 수미미 수페코 모르는이름',data.characters).valid,false);
  assert.equal(partyTools.parseLineup('수사렌 수리코 수미미 수페코 수페코',data.characters).valid,false);
  assert.equal(partyTools.parseLineup('수니논 수니논4 수사렌 수리코 수미미',data.characters).valid,false);
  assert.ok(app.portraitHtml('수페코',5).includes('6.png'));assert.equal(app.defaultCharacterStars(['수페코'])[0],6);
});
await check('English keyboard input and renamed member aliases use the same search',()=>{
  assert.equal(partyTools.matchesMember({name:'나르',aliases:[]},'skfm'),true);
  assert.equal(partyTools.matchesMember({name:'새닉네임',aliases:['나르']},'skfm'),true);
  assert.ok(app.entryMatches('member','tb',{dataset:{}}).some(row=>row.label==='슈'));
});
await check('converter and portraits cannot be reached in reading mode',()=>{
  data.settings.editable=false;app.ui.section='tactics';app.ui.tabs.tactics='converter';assert.ok(!app.fullTactics().includes('>택틱 변환기</button>'));assert.equal(app.ui.tabs.tactics,'workspace');
  app.ui.section='clan';app.ui.tabs.clan='characters';assert.ok(!app.fullClan().includes('>캐릭터·초상화</button>'));assert.equal(app.ui.tabs.clan,'members');
  data.settings.editable=true;app.ui.section='tactics';app.ui.tabs.tactics='combos';assert.ok(app.fullTactics().includes('>택틱 변환기</button>'));
});
await check('font scale 100 means the old 110 and remains a browser preference',()=>{
  const before=JSON.stringify(app.sharedDocument());app.setTextScale(100);assert.equal(app.document.documentElement.style.values['--text-scale'],'1.1');
  app.setTextScale(90);assert.equal(app.textScale(),90);app.setTextScale(110);assert.equal(app.textScale(),110);app.setTextScale(115);assert.equal(app.textScale(),110);
  app.setTextScale(100);assert.equal(JSON.stringify(app.sharedDocument()),before);
});
await check('standard and detailed logs share their base columns; mobile editors retain row controls',()=>{
  for(const details of [false,true]){
    app.ext.details=details;const html=app.completeLogTable(data.logs.slice(0,2));
    const labels=['일차·회차','보스','클랜원','기록 피해량','유형',...(details?['실제 피해량','가산점','기여도','인게임','이전 HP','남은 HP']:[])];
    let at=-1;for(const label of labels){const next=html.indexOf('data-label="'+label+'"',at+1);assert.ok(next>at,label);at=next;}
    if(details){const mobile=html.slice(html.indexOf('<div class="battle-mobile-only"'));assert.ok(mobile.includes('data-side="before"'));assert.ok(mobile.includes('data-side="after"'));assert.ok(mobile.includes('data-direction="up"'));assert.ok(mobile.includes('data-direction="down"'));}
    else assert.ok(!html.includes('data-label="실제 피해량"'));
  }
});
await check('source links distinguish videos, documents and absent or unsafe links',()=>{
  const t={...data.tactics[0],video:'https://youtu.be/example'};assert.ok(app.videoButton(t,false,'combo').includes('class="video-play"'));
  t.video='https://docs.google.com/document/d/example';const doc=app.videoButton(t,false,'combo');assert.ok(doc.includes('class="source-document"'));assert.ok(!doc.includes('class="video-play"'));
  for(const url of ['', 'javascript:alert(1)']){t.video=url;const blank=app.videoButton(t,false,'combo');assert.ok(blank.includes('combo-source-box missing'));assert.ok(!blank.includes('href='));}
});
await check('a clan-wide profile survives polling and an intentional member selection remains selected',()=>{
  const q=runtimeFixture(),d=q.get();assert.equal(q.ui.profile,'__clan__');q.applySharedDocument(q.sharedDocument());assert.equal(q.ui.profile,'__clan__');
  q.ui.profile=d.members[0].id;q.applySharedDocument(q.sharedDocument());assert.equal(q.ui.profile,d.members[0].id);
});
await check('recommendations render automatically without controls and recompute after a saved deck changes',()=>{
  const q=runtimeFixture(),data=q.get(),before=q.sharedDocument(),plans=q.recommendedPlans();
  const html=q.completeWorkspace(),panel=html.match(/<section class="distribution-panel[\s\S]*?<\/section>/)?.[0];
  assert.ok(panel?.includes('추천 분배'));
  assert.ok(plans.length>0&&plans.length<=5);
  assert.doesNotMatch(panel,/<button|<input|data-action=/);
  assert.doesNotMatch(html,/v2-pick-tactic|v2-use-plan|r-clear-plan|직접 선택/);
  assert.deepEqual(q.sharedDocument(),before);
  data.tactics.find(t=>t.id===plans[0].attacks[0].combo.id).hidden=true;
  assert.notEqual(q.recommendedPlans(),plans);
  assert.ok(q.recommendedPlans().every(plan=>plan.attacks.every(({combo})=>!data.tactics.find(t=>t.id===combo.id).hidden)));
});
await check('a rounded coefficient presentation never overwrites the unedited exact value',()=>{
  const input={value:'0.11',dataset:{display:'0.11',exact:'0.1123456789'}},form={querySelector:()=>input},fd={get:()=>input.value};
  assert.equal(app.readCoefficientDraft(form,fd,1),.1123456789);input.dataset.changed='true';assert.equal(app.readCoefficientDraft(form,fd,1),.11);
});
await check('row movement and insertion preserve day boundaries and exact integers',()=>{
  const records=[{id:'a',seq:1,day:1,damage:123456789},{id:'b',seq:2,day:1,damage:234567891},{id:'c',seq:3,day:2,damage:345678912}];
  const moved=logOrder.moveRecord(records,'b','a','before');assert.deepEqual(moved.map(r=>r.id),['b','a','c']);assert.deepEqual(moved.map(r=>r.damage),[234567891,123456789,345678912]);
  const inserted=logOrder.insertRecord(moved,{id:'d',day:1,damage:456789123},'a','after');assert.deepEqual(inserted.map(r=>r.id),['b','a','d','c']);assert.equal(logOrder.refreshClosures([{day:1,afterSeq:2,nextDay:2}],inserted)[0].afterSeq,3);
  assert.throws(()=>logOrder.moveRecord(records,'a','c','before'),/같은 일차/);
});
await check('the actual registration path inserts against historical HP then replays all records',()=>{
  const q=runtimeFixture(),d=q.get();d.settings.editable=true;d.logs=[];d.dayClosures=[];d.rules.levels=[{stage:4,count:9999}];d.rules.startStage=4;q.ui.day=1;q.ui.section='overview';q.ui.tabs.overview='logs';q.recalculateSeason();
  const member=d.members.find(m=>d.memberships[m.id]),form={memberId:member.id,boss:'1',day:'1',unit:'1',damage:'123456789',bonus:'0'};
  assert.equal(q.saveCompleteLog(form),true);const first=d.logs[0];assert.equal(q.saveCompleteLog({...form,damage:'100000000',insertAnchor:first.id,insertSide:'before'}),true);
  assert.equal(d.logs[1].id,first.id);assert.equal(d.logs[0].before,d.bossSettings[0].hp[4]);assert.equal(d.logs[1].before,d.logs[0].after);assert.equal(d.logs[1].damage,123456789);
  assert.equal(q.moveLogRecord(first.id,d.logs[0].id,'before'),true);assert.equal(d.logs[0].id,first.id);assert.equal(d.logs[0].before,d.bossSettings[0].hp[4]);
});
await check('unlinked carries remain visible with an actionable record warning',()=>{
  const d=app.get(),old=d.replayWarnings;d.replayWarnings=[{id:d.logs[0].id,message:'연결할 일반 공격의 격파 기록이 없습니다.'}];
  const html=app.completeLogTable(d.logs.slice(0,1));assert.ok(html.includes('log-warning-row'));assert.ok(html.includes('연결할 일반 공격'));assert.ok(app.battleLogContent().includes('확인할 기록 1건'));d.replayWarnings=old;
});
await check('result confirmation updates both hall of fame and award counts exactly once',()=>{
  const q=runtimeFixture(),d=q.get(),before=q.awardRows().reduce((sum,row)=>sum+row.total,0);d.settings.editable=true;assert.equal(q.sealResult(q.ui.month),true);
  assert.equal(d.result.sealed,true);assert.ok(d.history.some(h=>h.month===q.ui.month));assert.equal(q.awardRows().reduce((sum,row)=>sum+row.total,0),before+6);
  q.sealResult(q.ui.month);assert.equal(q.awardRows().reduce((sum,row)=>sum+row.total,0),before+6);
  const html=q.completeHall();assert.ok(html.indexOf('인게임 1·2위')<html.indexOf('기여도 1·2위'));assert.ok(html.indexOf('기여도 1·2위')<html.indexOf('피해량 1·2위'));
});
await check('support assignment recovers feasible overlaps instead of rejecting them',()=>{
  const assignment=legacyTools.assignSupports([['a','b','c','d','e'],['a','f','g','h','i'],['b','f','j','k','l']]);assert.ok(assignment);assert.equal(assignment.supports.filter(Boolean).length,3);
  const [plan]=app.recommendedPlans();assert.equal(plan.attacks.length,3);assert.ok(plan.attacks.every(t=>Number.isInteger(t.supportIndex)));
});
await check('workbook transfers preserve party, carry requirement, video and six SET columns',()=>{
  const names=['수사렌','수리코','수미미','수페코','사루카'],body='TRUE\tFALSE\tTRUE\tFALSE\tTRUE\tFALSE\t1:30 AUTO OFF';
  const text=legacyTools.serializeTacticTransfer(names,body,{kind:'carry-sheet',group:'이월 택틱',boss:1,stars:['5','5','5','6','5'],expectedDamage:'0.38',tp:'4.2',manualCount:'1',note:'필요 이월시간: 26초 · 메모',video:'https://youtu.be/example'});
  const parsed=app.parseCompatiblePaste(text,data.tactics[0]);assert.equal(parsed.tactic.category,'carry');assert.equal(parsed.tactic.requiredCarrySeconds,26);assert.equal(parsed.tactic.note,'메모');assert.equal(parsed.rows[0].checked.length,6);assert.equal(parsed.tactic.video,'https://youtu.be/example');assert.equal(parsed.tactic.damage,.38);
});
await check('original text colours survive time shifting without accepting unsafe styles',()=>{
  const row={text:'1:20 위험 안내',runs:[{text:'1:20 ',color:'#cc3355'},{text:'위험 안내',color:'url(javascript:alert(1))'}]};
  const html=legacyTools.richLine(row,[],[],60,90);assert.ok(html.includes('0:50'));assert.ok(html.includes('color:#cc3355'));assert.ok(!html.includes('javascript:'));assert.ok(html.includes('위험 안내'));
});

await check('all stage 3 lineups render directly with timing and no tactic reader',()=>{
  const q=runtimeFixture(new Map(),{hash:'#tactics/combos'}),data=q.get();
  assert.equal(q.ui.tabs.tactics,'workspace');
  data.bosses.forEach(b=>{b.stage=3;b.locked=false;});
  data.rules.stage3Mode='auto';
  const normal=data.tactics.find(t=>t.stage===4&&t.category==='main'&&!t.hidden&&!t.deletedAt);
  const early={...structuredClone(normal),id:'test-stage-three',stage:3,category:'recommendation',requiredSeconds:26,remainingSeconds:84,
    video:'https://www.youtube.com/watch?v=test',recommendationOnly:true};
  data.recommendations=[early,{...early,id:'test-second-stage-three',boss:2},{...early,id:'test-archived-stage-three',deletedAt:1}];
  data.tactics.push({...early});
  q.ext.stage=3;q.ui.selectedTactic=early.id;
  let html=q.fullTactics();
  assert.match(html,/data-action="v2-combo-stage" data-value="3"[^>]+aria-pressed="true"/);
  assert.doesNotMatch(html,/data-action="tab"[^>]*data-value="combos"/);
  assert.equal(q.workspaceList().filter(t=>t.id===early.id).length,1);
  assert.ok(!q.workspaceList().some(t=>t.deletedAt||t.stage!==3));
  assert.match(html,/필요 시간<\/dt><dd>26초/);
  assert.match(html,/예상 이월<\/dt><dd>84초/);
  assert.equal((html.match(/data-lineup-id="test-stage-three"/g)||[]).length,1);
  assert.match(html,/data-lineup-id="test-second-stage-three"/);
  assert.doesNotMatch(html,/work-library|set-grid|등록된 조작문이 없습니다|distribution-heading|test-archived-stage-three/);
  assert.match(html,/www\.youtube\.com\/watch\?v=test/);
  assert.doesNotMatch(html,/data-input="v2-pick-tactic"/);
  data.bosses[0].stage=4;data.bosses[0].locked=true;
  assert.match(q.fullTactics(),/data-action="v2-combo-stage" data-value="3"/);
  data.bosses[0].locked=false;
  html=q.fullTactics();
  assert.equal(q.ext.stage,4);
  assert.doesNotMatch(html,/data-action="v2-combo-stage" data-value="3"/);
  assert.ok(!q.workspaceList().some(t=>t.stage===3));
  assert.equal(data.recommendations[0].id,early.id);
  data.rules.stage3Mode='show';
  assert.match(q.fullTactics(),/data-action="v2-combo-stage" data-value="3"/);
});

await check('time ranges remain aligned after carry adjustments and instruction colors survive',()=>{
  const q=runtimeFixture(),text='1:20 ~ 1:18 위험 안내';
  const row={text,runs:[{text:'1:20 ~ 1:18 위',color:'#aa3355'},{text:'험 안내',color:'#3344aa'}]};
  const html=q.tacticInstructionMarkup(row,{party:[],duration:90},60);
  assert.match(html,/class="tactic-time">0:50~<wbr>0:48/);
  assert.match(html,/class="tactic-instruction"><span style="color:#aa3355">위<\/span><span style="color:#3344aa">험 안내/);
  assert.equal(row.text,text);
});
await check('recommendations do not narrow the tactic library and both battle pages retain exact HP',()=>{
  const q=runtimeFixture(),data=q.get();
  q.ui.section='tactics';q.ext.stage=4;q.ext.workGroup='tabi';q.ui.boss=1;
  const ids=q.workspaceList().map(t=>t.id);
  assert.match(q.fullTactics(),/추천 분배/);
  assert.deepEqual(q.workspaceList().map(t=>t.id),ids);
  assert.equal(q.ext.workGroup,'tabi');
  assert.equal(q.ui.boss,1);
  data.bosses.forEach((boss,index)=>{boss.hp=123456789+index;boss.max=987654321+index;});
  q.ui.section='overview';
  for(const [tab,css] of [['bosses','raid-banner'],['logs','battle-health-boss']]){
    q.ui.tabs.overview=tab;
    const html=q.fullOverview();
    assert.equal((html.match(new RegExp('class="'+css+' ', 'g'))||[]).length,5);
    for(const boss of data.bosses){
      assert.ok(html.includes(boss.hp.toLocaleString('ko-KR')),tab+' current HP for boss '+boss.id);
      assert.ok(html.includes(boss.max.toLocaleString('ko-KR')),tab+' max HP for boss '+boss.id);
    }
  }
});

console.log(checks+' usability checks passed');

