import assert from 'node:assert/strict';
import {runtimeFixture} from './runtime-fixture.mjs';

let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
function scenario(order='asc'){
  const app=runtimeFixture(),data=app.get();data.settings.editable=true;
  data.logs=[];data.dayClosures=[];data.rules.levels=[{stage:4,count:9999}];data.rules.startStage=4;
  app.ui.section='overview';app.ui.tabs.overview='logs';app.ui.day=1;app.ext.logOrder=order;app.ext.allDays=false;app.recalculateSeason();
  const people=data.members.filter(m=>data.memberships[m.id]);
  for(let i=0;i<3;i++)assert.equal(app.saveCompleteLog({memberId:people[i].id,boss:'1',day:'1',unit:'1',damage:String((i+1)*10000000),bonus:'0'}),true);
  return {app,data,people,ids:data.logs.map(e=>e.id)};
}
const visible=app=>app.getFilteredCompleteLogs().map(e=>e.id);

await check('dashboard headings sort the full roster in both directions without changing records',async()=>{
  const app=runtimeFixture();app.ui.section='overview';app.ui.tabs.overview='members';
  const before=JSON.stringify(app.sharedDocument());
  const click=app.listeners.click.find(fn=>fn.toString().includes("if(a==='member-sort')"));assert.ok(click);
  for(const key of ['name','remaining','carry']){
    for(let n=0;n<2;n++){
      await click({target:{closest:()=>({dataset:{action:'member-sort',value:key}})}});
      const html=app.fullDashboard(),head=html.slice(0,html.indexOf('</thead>'));
      assert.ok(!html.slice(0,html.indexOf('<table')).includes('member-sort'));
      assert.ok(head.includes(`aria-sort="${app.ui.sortDir<0?'descending':'ascending'}"`));
      const ids=[...html.matchAll(/data-dashboard-member="([^"]+)"/g)].map(m=>m[1]);
      const stats=app.allSeasonStats(),map=new Map(stats.map(s=>[s.member.id,s]));assert.equal(ids.length,stats.length);
      for(let i=1;i<ids.length;i++){
        const a=map.get(ids[i-1]),b=map.get(ids[i]);
        const delta=key==='name'?a.member.name.localeCompare(b.member.name,'ko'):a[key]-b[key];
        assert.ok(delta*app.ui.sortDir<=0);
      }
    }
  }
  assert.equal(JSON.stringify(app.sharedDocument()),before);
});

await check('inline edits keep record identity and extra data while replaying precise HP and bonuses',()=>{
  const {app,data,people,ids}=scenario(),id=ids[0];data.logs[0].legacyExtra={keep:true};
  assert.equal(app.updateInlineLog(id,'damage','254,123,456'),true);
  assert.equal(data.logs[0].damage,254123456);assert.equal(data.logs[1].before,data.bossSettings[0].hp[4]-254123456);
  assert.equal(app.updateInlineLog(id,'memberId',people[2].id),true);assert.equal(data.logs[0].memberId,people[2].id);
  assert.equal(app.updateInlineLog(id,'boss','2'),true);assert.equal(data.logs[0].boss,2);assert.equal(data.logs[0].before,data.bossSettings[1].hp[4]);
  const actual=data.logs[0].actual,after=data.logs[0].after;
  assert.equal(app.updateInlineLog(id,'bonus','-1,350,000'),true);assert.equal(data.logs[0].bonus,-135);
  assert.equal(data.logs[0].actual,actual);assert.equal(data.logs[0].after,after);
  assert.equal(data.logs[0].id,id);assert.equal(data.logs[0].legacyExtra.keep,true);
});

await check('invalid, closed-day and read-only inline changes leave every record intact',()=>{
  const {app,data,ids}=scenario(),before=JSON.stringify(data.logs);
  for(const [field,value]of [['damage','invalid'],['memberId','missing'],['boss','99'],['bonus','oops']])assert.equal(app.updateInlineLog(ids[0],field,value),false);
  assert.equal(JSON.stringify(data.logs),before);
  data.dayClosures=[{day:1,afterSeq:3,nextDay:2}];assert.equal(app.updateInlineLog(ids[0],'damage','2'),false);assert.equal(JSON.stringify(data.logs),before);
  data.dayClosures=[];data.settings.editable=false;assert.equal(app.updateInlineLog(ids[0],'damage','2'),false);assert.equal(JSON.stringify(data.logs),before);
});

await check('editor cells and end-of-row controls work in standard and detailed tables; readers stay read-only',()=>{
  const {app,data}=scenario();
  for(const details of [false,true]){
    app.ext.details=details;const html=app.completeLogTable(data.logs.slice(0,1));
    for(const field of ['boss','memberId','damage','carry',...(details?['bonus']:[])])assert.equal((html.match(new RegExp(`data-inline-log-field="${field}"`,'g'))||[]).length,2);
    for(const action of ['entry-delete-log','u-move-log','u-insert-log'])assert.ok(html.includes(`data-action="${action}"`));
    assert.ok(!html.includes('data-action="edit-log"'));assert.ok(html.includes('data-label="관리"'));
  }
  data.settings.editable=false;const html=app.completeLogTable(data.logs);
  assert.ok(!html.includes('data-inline-log-field'));assert.ok(!html.includes('data-action="entry-delete-log"'));
});

await check('up/down and drag insertion follow visible ascending and descending order',()=>{
  for(const order of ['asc','desc']){
    const {app,ids}=scenario(order),middle=ids[1];
    assert.equal(app.moveVisibleLog(middle,'up'),true);assert.equal(visible(app)[0],middle);
    assert.equal(app.moveVisibleLog(middle,'down'),true);assert.equal(visible(app)[1],middle);
    assert.equal(app.moveVisibleLog(middle,'down'),true);assert.equal(visible(app)[2],middle);
    const target=visible(app)[0];app.ext.draggedLog=middle;app.ext.logDrop={id:target,side:'before'};
    const drop=app.listeners.drop.find(fn=>fn.toString().includes('ext.draggedLog'));
    drop({target:{closest:()=>({dataset:{logId:target}})},preventDefault(){}});
    assert.equal(visible(app)[0],middle);
  }
});

await check('adding above or below creates an inline draft and saves on the same visual side in either order',()=>{
  for(const order of ['asc','desc'])for(const side of ['before','after']){
    const {app,data,ids}=scenario(order),anchor=ids[1];
    app.openInsertedLog(anchor,side);assert.ok(app.completeLogTable(app.getFilteredCompleteLogs()).includes('data-inline-log="draft"'));
    assert.equal(data.logs.length,3);app.ext.inlineLogDraft.damage='1,000,001';
    assert.equal(app.commitInlineLogDraft(),true);assert.equal(data.logs.length,4);assert.equal(app.ext.inlineLogDraft,null);
    const added=data.logs.find(e=>!ids.includes(e.id));assert.equal(added.damage,1000001);
    const result=visible(app);assert.equal(result.indexOf(added.id)-result.indexOf(anchor),side==='before'?-1:1);
  }
});

await check('visible row movement cannot cross a day boundary',()=>{
  for(const order of ['asc','desc']){
    const {app,data,people}=scenario(order);assert.equal(app.saveCompleteLog({memberId:people[0].id,boss:'1',day:'2',unit:'1',damage:'1000001',bonus:'0'}),true);
    app.ext.allDays=true;const dayTwo=data.logs.find(e=>e.day===2),before=JSON.stringify(data.logs);
    assert.equal(app.moveVisibleLog(dayTwo.id,order==='asc'?'up':'down'),false);assert.equal(JSON.stringify(data.logs),before);
  }
});

console.log(`${checks} dashboard and inline-log checks passed`);

