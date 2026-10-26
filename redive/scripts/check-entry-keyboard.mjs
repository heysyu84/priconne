import assert from 'node:assert/strict';
import {runtimeFixture} from './runtime-fixture.mjs';
import * as partyTools from '../public/party-tools.mjs';

let checks=0;
const check=(name,run)=>{run();checks++;console.log('PASS '+name);};
const keyEvent=(target,key,extra={})=>({target,key,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra});
const entryKeys=app=>app.listeners.keydown.find(handler=>handler.toString().includes('focusCarryFromDamage(event)'));
const inlineChange=app=>app.listeners.change.find(handler=>handler.toString().includes('updateInlineLog(row.dataset.inlineLog'));
const inlineKeys=app=>app.listeners.keydown.find(handler=>handler.toString().includes('commitInlineLogDraft()'));

function searchFixture(kind='member'){
  const app=runtimeFixture(),data=app.get();
  const people=[['kr','다람쥐'],['inside','deer'],['en','Eclair'],['exact','e'],['alias','다른이름']].map(([id,name])=>({id,name,aliases:id==='alias'?['easy']:[],status:'active'}));
  data.members=people;data.memberships=Object.fromEntries(people.map(member=>[member.id,{from:1,to:5}]));
  const hidden={value:''},box={hidden:true,options:[],style:{},querySelector(){return this.options.find(option=>option.getAttribute('aria-selected')==='true');},querySelectorAll(){return this.options.filter(option=>option.getAttribute('aria-disabled')!=='true');}};
  Object.defineProperty(box,'innerHTML',{set(html){this.html=html;this.options=[...html.matchAll(/<button\b([^>]*)>/g)].map(match=>{
    const attributes=Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute=>[attribute[1],attribute[2]]));
    return {id:attributes.id,dataset:{value:attributes['data-value']},classList:{toggle(){}},getAttribute:key=>attributes[key],setAttribute(key,value){attributes[key]=value;},scrollIntoView(){this.scrolled=true;}};
  });}});
  const picker={dataset:{selected:'',allowLocked:'0'},contains:()=>false,closest:()=>null,querySelector(selector){return selector==='[role=listbox]'?box:hidden;}};
  const input={id:'quick-'+kind,type:'search',value:'',dataset:{entrySearch:kind},attributes:{},selectionStart:0,selectionEnd:0,closest(selector){return selector==='.search-picker'?picker:selector.startsWith('form')?this.form:null;},select(){this.selectionStart=0;this.selectionEnd=this.value.length;},setCustomValidity(value){this.validity=value;},setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];},focus(){this.focused=true;}};
  const next={focus(){this.focused=true;}},form={dataset:{form:'v2-quick-log'},querySelector:()=>next};input.form=form;
  const change=app.listeners.input.find(handler=>handler.toString().includes('showEntryResults(input)'));
  const search=query=>{input.value=query;input.selectionStart=input.selectionEnd=query.length;change({target:input});};
  return {app,data,people,input,box,hidden,picker,next,form,search};
}

check('literal English names precede keyboard-converted Korean matches, with stable ties and aliases retained',()=>{
  const {app,search,box}=searchFixture();search('e');
  assert.deepEqual(box.options.map(option=>option.dataset.value),['exact','en','inside','alias','kr']);
  assert.equal(box.options[0].getAttribute('aria-selected'),'true');
  assert.deepEqual(Array.from(app.entryMatches('member','',{dataset:{}}),item=>item.value),['kr','inside','en','exact','alias']);
  assert.equal(partyTools.matchesMember({name:'다람쥐'},'e'),true);
  assert.equal(partyTools.matchesMember({name:'새닉',aliases:['나르']},'skfm'),true);
  assert.equal(partyTools.matchesMember({name:'테스트',uid:'123456'},'234'),true);
});

check('Up/Down change the highlighted result and Enter selects it without registering an attack',()=>{
  const {app,input,box,hidden,next,search}=searchFixture(),keydown=entryKeys(app);search('e');
  keydown(keyEvent(input,'ArrowDown'));assert.equal(box.options[1].getAttribute('aria-selected'),'true');
  keydown(keyEvent(input,'ArrowUp'));assert.equal(box.options[0].getAttribute('aria-selected'),'true');
  const before=JSON.stringify(app.get().logs),enter=keyEvent(input,'Enter');keydown(enter);
  assert.equal(hidden.value,'exact');assert.equal(input.value,'e');assert.equal(next.focused,true);assert.equal(box.hidden,true);assert.equal(enter.prevented,true);
  assert.equal(JSON.stringify(app.get().logs),before);
});

check('boss result arrows skip locked bosses and Japanese/Korean IME confirmation never selects a result',()=>{
  const fixture=searchFixture('boss'),{app,input,box,search}=fixture,keydown=entryKeys(app);
  app.get().bosses[1].locked=true;search('');
  const enabled=box.options.filter(option=>option.getAttribute('aria-disabled')!=='true');
  assert.ok(enabled.length>1);keydown(keyEvent(input,'ArrowDown'));
  assert.equal(enabled[1].getAttribute('aria-selected'),'true');
  const before=input.value,composing=keyEvent(input,'Enter',{isComposing:true});keydown(composing);
  assert.equal(input.value,before);assert.equal(composing.prevented,false);assert.equal(box.hidden,false);
});

check('record entry arrows cross input boundaries while preserving cursor edits and skipping the rare bonus field',()=>{
  const app=runtimeFixture(),keydown=entryKeys(app),form={dataset:{form:'v2-quick-log'}};
  const control=(name,type='text')=>({name,type,value:'12345',dataset:{},selectionStart:2,selectionEnd:2,form,closest:()=>form,focus(){this.focused=true;}});
  const member=control('member','search'),boss=control('boss','search'),damage=control('damage'),carry=control('usesCarry','checkbox'),submit=control('submit','submit'),bonus=control('bonus');
  const fields={'[data-entry-search="member"]':member,'[data-entry-search="boss"]':boss,'[name="damage"]':damage,'[name="usesCarry"]':carry,'button[type="submit"]':submit,'[name=usesCarry]':carry};
  form.querySelector=selector=>fields[selector]||null;
  let event=keyEvent(damage,'ArrowRight');keydown(event);assert.equal(event.prevented,false);assert.ok(!carry.focused);
  damage.selectionStart=damage.selectionEnd=5;event=keyEvent(damage,'ArrowRight');keydown(event);assert.equal(carry.focused,true);assert.equal(event.prevented,true);
  keydown(keyEvent(damage,'ArrowUp'));assert.equal(boss.focused,true);
  damage.selectionStart=damage.selectionEnd=0;keydown(keyEvent(damage,'ArrowLeft'));assert.equal(boss.focused,true);
  keydown(keyEvent(carry,'ArrowRight'));assert.equal(submit.focused,true);
  event=keyEvent(damage,'Tab');keydown(event);assert.equal(event.prevented,true);assert.ok(!bonus.focused);
});

check('Enter on damage uses normal form validation and successful registration returns focus to the member field',()=>{
  const app=runtimeFixture(),data=app.get(),keydown=entryKeys(app);data.logs=[];data.dayClosures=[];data.rules.levels=[{stage:4,count:9999}];data.rules.startStage=4;app.recalculateSeason();
  const person=data.members.find(member=>data.memberships[member.id]);
  let nameFocused=0,damageFocused=0,submitted=0;
  app.elements['quick-member']={focus(){nameFocused++;}};app.elements['quick-damage']={focus(){damageFocused++;}};
  const form={dataset:{form:'v2-quick-log'},memberId:person.id,boss:'1',day:'1',unit:'1',damage:'250,123,456',bonus:'0',requestSubmit(){submitted++;app.saveCompleteLog(this);}};
  const input={name:'damage',type:'text',dataset:{},form,closest:()=>form};keydown(keyEvent(input,'Enter'));
  assert.equal(submitted,1);assert.equal(data.logs.length,1);assert.equal(data.logs[0].damage,250123456);assert.equal(nameFocused,1);assert.equal(damageFocused,0);
  form.damage='invalid';keydown(keyEvent(input,'Enter'));assert.equal(data.logs.length,1);assert.equal(nameFocused,1);
  keydown(keyEvent(input,'Enter',{isComposing:true}));assert.equal(submitted,2);
});

function inlineFixture(){
  const app=runtimeFixture(),data=app.get();data.logs=[];data.dayClosures=[];data.rules.levels=[{stage:4,count:9999}];data.rules.startStage=4;app.recalculateSeason();
  const person=data.members.find(member=>data.memberships[member.id]);
  assert.equal(app.saveCompleteLog({memberId:person.id,boss:'1',day:'1',unit:'1',damage:'250123456',bonus:'0'}),true);
  const id=data.logs[0].id,row={dataset:{inlineLog:id},querySelectorAll:()=>[],querySelector:()=>null};
  const input={id:'inline-log-w-'+id+'-carry',type:'checkbox',checked:true,dataset:{inlineLogField:'carry'},closest:()=>row,setAttribute(){}};
  return {app,data,id,row,input};
}

check('inline carry editing uses a checkbox and automatically keeps the normal/kill attack label',()=>{
  const {app,data,id,input}=inlineFixture(),change=inlineChange(app);
  const html=app.completeLogTable(data.logs);assert.equal((html.match(/type="checkbox"[^>]+data-inline-log-field="carry"/g)||[]).length,2);assert.ok(!html.includes('<select class="inline-log-type"'));
  change({target:input});assert.equal(data.logs[0].carry,true);assert.equal(data.logs[0].usesCarry,true);assert.equal(data.logs[0].type,'carry');assert.equal(data.logs[0].id,id);
  input.checked=false;change({target:input});assert.equal(data.logs[0].carry,false);assert.equal(data.logs[0].type,'normal');
  app.updateInlineLog(id,'damage',String(data.bossSettings[0].hp[4]));assert.equal(data.logs[0].kill,true);
  assert.ok(app.completeLogTable(data.logs).includes('>격파</span>'));
});

check('a refused carry checkbox change restores the saved value and never mutates a closed or read-only record',()=>{
  const {app,data,input}=inlineFixture(),before=JSON.stringify(data.logs);data.dayClosures=[{day:1}];inlineChange(app)({target:input});
  assert.equal(input.checked,false);assert.equal(JSON.stringify(data.logs),before);
  data.dayClosures=[];data.settings.editable=false;input.checked=true;inlineChange(app)({target:input});assert.equal(input.checked,false);assert.equal(JSON.stringify(data.logs),before);
});

check('an inserted draft stores checked state as a boolean and Enter on damage registers it once',()=>{
  const {app,data,id}=inlineFixture();app.openInsertedLog(id,'after');
  const tag={textContent:'',classList:{toggle(){}}},row={dataset:{inlineLog:'draft'},querySelector:()=>tag,querySelectorAll:()=>[]};
  const carry={checked:true,dataset:{inlineLogField:'carry'},closest:()=>row};inlineChange(app)({target:carry});assert.equal(app.ext.inlineLogDraft.carry,true);assert.equal(tag.textContent,'이월타');assert.equal(data.logs.length,1);
  carry.checked=false;inlineChange(app)({target:carry});assert.equal(app.ext.inlineLogDraft.carry,false);assert.equal(tag.textContent,'일반');
  let focused=0;app.elements['quick-member']={focus(){focused++;}};
  const damage={value:'30,000,001',dataset:{inlineLogField:'damage'},closest:()=>row};inlineKeys(app)(keyEvent(damage,'Enter'));
  assert.equal(data.logs.length,2);assert.equal(data.logs.find(record=>record.id!==id).damage,30000001);assert.equal(app.ext.inlineLogDraft,null);assert.equal(focused,1);
});

check('Enter saves an existing damage cell and moves to its member field, while invalid edits stay put',()=>{
  const {app,data,id,row}=inlineFixture();let focused=0;
  app.elements['inline-log-w-'+id+'-memberId']={focus(){focused++;}};
  const input={id:'inline-log-w-'+id+'-damage',value:'250,000,001',dataset:{inlineLogField:'damage'},closest:()=>row};
  inlineKeys(app)(keyEvent(input,'Enter'));assert.equal(data.logs[0].damage,250000001);assert.equal(focused,1);
  input.value='invalid';inlineKeys(app)(keyEvent(input,'Enter'));assert.equal(data.logs[0].damage,250000001);assert.equal(focused,1);
});

console.log(`${checks} entry keyboard and carry-checkbox checks passed`);
