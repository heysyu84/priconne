import assert from 'node:assert/strict';
import {runtimeFixture} from './runtime-fixture.mjs';

let checks=0;
const check=async(name,run)=>{await run();checks++;console.log('PASS '+name);};
function setup(){
  const app=runtimeFixture(),data=app.get(),base=structuredClone(data.tactics[0]);
  const tactic=(id,boss,category='main',extra={})=>({...structuredClone(base),id,stage:4,boss,category,damage:3.2,hidden:false,deletedAt:null,text:'1:30 AUTO 오프',rows:[{id:id+'-row',text:'1:30 AUTO 오프',checked:[false,false,false,false,false,false]}],...extra});
  data.tactics=[tactic('first',1),tactic('second',2),tactic('tabi',1,'tabi'),tactic('carry25',1,'carry',{requiredCarrySeconds:25}),tactic('carry35',2,'carry',{requiredCarrySeconds:35}),tactic('unassigned',0),tactic('hidden',1,'main',{hidden:true}),tactic('deleted',1,'main',{deletedAt:1})];
  data.rules.stage3Mode='show';data.rules.carryVisible=true;data.settings.editable=false;
  app.ui.section='tactics';app.ui.tabs.tactics='accordion';app.ui.boss=0;app.ui.selectedTactic='first';app.ext.workGroup='main';app.ext.accordionOpen=false;
  const handler=app.listeners.click.find(fn=>String(fn).includes("if(action==='v2-accordion-tactic')"));
  const click=async(action,id,value)=>handler({target:{closest:()=>({id:'tactic-accordion-trigger-0',dataset:{action,id,value}})},preventDefault(){},stopImmediatePropagation(){}});
  const view=()=>app.fullTactics();
  const ids=()=>[...view().matchAll(/class="tactic-accordion-trigger" data-action="v2-accordion-tactic" data-id="([^"]+)"/g)].map(m=>m[1]);
  return {app,data,click,view,ids};
}

await check('the new menu is between stage 3 and the original workspace, with its own route',()=>{
  const {app,view}=setup(),html=view();
  assert.ok(html.indexOf('data-value="stage3"')<html.indexOf('data-value="accordion"'));
  assert.ok(html.indexOf('data-value="accordion"')<html.indexOf('data-value="workspace"'));
  assert.match(html,/data-value="accordion">택틱 목록<\/button>/);
  assert.equal(app.evaluate("tacticTab('accordion')"),'accordion');
  assert.doesNotMatch(html,/id="recommendation-distribution"/);
  assert.doesNotMatch(html,/class="set-grid"/);
});

await check('opening, switching and closing a lineup uses one shared selected tactic and one editor',async()=>{
  const {app,click,view}=setup(),before=JSON.stringify(app.sharedDocument());
  await click('v2-accordion-tactic','first');assert.equal(app.ui.selectedTactic,'first');
  assert.equal((view().match(/aria-expanded="true" aria-controls="tactic-accordion-panel/g)||[]).length,1);
  assert.equal((view().match(/id="workspace-carry"/g)||[]).length,1);
  await click('v2-accordion-tactic','second');assert.equal(app.ui.selectedTactic,'second');
  assert.match(view(),/class="set-grid" data-tactic-id="second"/);
  assert.doesNotMatch(view(),/class="set-grid" data-tactic-id="first"/);
  await click('v2-accordion-tactic','second');assert.equal(app.ext.accordionOpen,false);
  assert.doesNotMatch(view(),/class="set-grid"/);
  assert.equal(JSON.stringify(app.sharedDocument()),before);
});

await check('both views share the selected lineup and show the same body without copies',async()=>{
  const {app,data,click,view}=setup();
  await click('v2-accordion-tactic','second');app.ui.tabs.tactics='workspace';
  assert.match(view(),/class="set-grid" data-tactic-id="second"/);
  data.tactics[1].rows[0].text='0:42 전원 SET';data.tactics[1].text='0:42 전원 SET';
  assert.match(view(),/전원 SET/);
  await click('v2-select-tactic','first');app.ui.tabs.tactics='accordion';
  assert.match(view(),/class="set-grid" data-tactic-id="first"/);
  await click('v2-accordion-tactic','second');assert.match(view(),/전원 SET/);
  assert.equal(data.tactics.length,8);
});

await check('group, boss, unassigned and carry-time filters use the workspace rules',async()=>{
  const {app,click,view,ids}=setup();assert.deepEqual(ids(),['unassigned','first','second']);
  app.ui.boss=-1;assert.deepEqual(ids(),['unassigned']);
  app.ui.boss=0;await click('v2-work-group',null,'tabi');assert.deepEqual(ids(),['tabi']);
  await click('v2-work-group',null,'carry');app.ext.carryTimeRange='20';assert.deepEqual(ids(),['carry25']);
  assert.match(view(),/id="carry-time-range"/);assert.match(view(),/25초 이월/);
  app.ui.boss=2;assert.deepEqual(ids(),[]);assert.match(view(),/해당 시간대의 이월 택틱이 없습니다/);
});

await check('reader controls cannot edit or open hidden, deleted or filtered-out tactics',async()=>{
  const {app,data,click,view}=setup(),before=JSON.stringify(app.sharedDocument());
  for(const id of ['hidden','deleted','tabi','missing'])await click('v2-accordion-tactic',id);
  assert.equal(app.ext.accordionOpen,false);
  await click('v2-accordion-tactic','first');await click('v2-edit-grid');
  assert.equal(app.ext.workEditing,false);assert.equal(data.settings.editable,false);
  assert.doesNotMatch(view(),/data-action="new-tactic"|data-action="v2-edit-grid"|data-action="delete-tactic"/);
  assert.equal(JSON.stringify(app.sharedDocument()),before);
});

await check('pending edits flush on the original tactic before opening another lineup',async()=>{
  const {app,data,click,view}=setup();data.settings.editable=true;
  await click('v2-accordion-tactic','first');await click('v2-edit-grid');
  assert.match(view(),/data-input="v2-row-text"/);
  data.tactics[0].rows[0].text='0:10 전원 OFF';app.ext.gridSaveTimer=1;
  await click('v2-accordion-tactic','second');
  assert.equal(data.tactics[0].text,'0:10 전원 OFF');
  assert.equal(data.tactics[1].text,'1:30 AUTO 오프');
  assert.equal(app.ext.gridSaveTimer,null);assert.equal(app.ext.workEditing,false);
});

await check('stage-3 auto hiding never removes the accordion and shared records exclude UI state',async()=>{
  const {app,data,click,view}=setup();data.rules.stage3Mode='hide';
  assert.doesNotMatch(view(),/data-value="stage3"/);assert.match(view(),/data-value="accordion"/);
  await click('v2-accordion-tactic','first');const shared=app.sharedDocument();
  assert.doesNotMatch(JSON.stringify(shared),/accordionOpen|tactic-accordion/);
  data.tactics[0].hidden=true;assert.doesNotMatch(view(),/class="set-grid"/);
  assert.equal(app.ext.accordionOpen,false);
});

console.log(`${checks} tactic accordion checks passed`);
