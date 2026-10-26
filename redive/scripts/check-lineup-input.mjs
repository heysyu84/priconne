import assert from 'node:assert/strict';
import {runtimeFixture} from './runtime-fixture.mjs';

const names=['수사렌','수리코','수미미','수페코','사루카'];
let checks=0;
const check=(name,run)=>{run();checks++;console.log('PASS '+name);};
function setup(kind='tactic'){
  const app=runtimeFixture(),feedback={textContent:'',danger:false,classList:{toggle(name,value){feedback.danger=value;}}},order={innerHTML:''},preview={innerHTML:''};
  const section={querySelector(selector){return ({'.lineup-text-feedback':feedback,'.lineup-order-feedback':order,'.lineup-preview':preview})[selector];}};
  const stars=names.map(()=>({value:'5'})),selects=names.map((_,index)=>({value:'',form:{querySelector:()=>stars[index]},parentElement:{querySelector:()=>({innerHTML:''})}}));
  for(let index=0;index<5;index++)app.elements[(kind==='converter'?'convert-name-':'party-')+index]=selects[index];
  app.document.querySelector=selector=>selector.startsWith('[data-lineup-kind=')?section:stars[Number(selector.match(/star-(\d)/)?.[1])]||null;
  const input={value:'',selectionStart:0,selectionEnd:0,dataset:{input:'u-lineup-text',kind},closest:()=>section,focus(){throw Error('IME focus must not be changed');}};
  const inputHandler=app.listeners.input.find(handler=>handler.toString().includes('applyLineupText(event.target,event.isComposing)'));
  const compositionEnd=app.listeners.compositionend.find(handler=>handler.toString().includes('applyLineupText(event.target)'));
  const type=(value,composing=true)=>{input.value=value;input.selectionStart=input.selectionEnd=value.length;inputHandler({target:input,isComposing:composing});};
  return {app,selects,stars,feedback,order,preview,input,type,compositionEnd};
}

check('the fifth Korean name applies during the final composing input, without arrows, whitespace or blur',()=>{
  const {app,selects,stars,feedback,preview,input,type}=setup(),before=JSON.stringify(app.sharedDocument());
  type('수사렌 수리코 수미미 수페코 사루ㅋ');assert.ok(selects.every(select=>select.value===''));assert.equal(feedback.danger,false);
  const value=names.join(' ');type(value);
  assert.deepEqual(selects.map(select=>select.value),names);assert.equal(feedback.textContent,'편성에 적용됨');assert.ok(preview.innerHTML.includes('<img'));
  assert.equal(input.value,value);assert.equal(input.selectionStart,value.length);assert.equal(input.selectionEnd,value.length);
  assert.deepEqual(stars.map(star=>Number(star.value)),Array.from(app.defaultCharacterStars(names)));
  assert.equal(JSON.stringify(app.sharedDocument()),before);
});

check('composition end and repeated final input do not reset manually chosen stars for an unchanged party',()=>{
  const {selects,stars,input,type,compositionEnd}=setup();type(names.join(' '));stars[3].value='3';
  compositionEnd({target:input});type(names.join(' '),false);
  assert.deepEqual(selects.map(select=>select.value),names);assert.equal(stars[3].value,'3');
});

check('the converter also recognizes the last composing syllable immediately and retains the entered text',()=>{
  const {app,selects,feedback,input,type}=setup('converter');type(names.join(' '));
  assert.deepEqual(selects.map(select=>select.value),names);assert.equal(feedback.textContent,'편성에 적용됨');
  assert.equal(app.ext.converterLineupText,input.value);assert.deepEqual(Array.from(app.ext.converterNames),names);
});

check('unknown or duplicate names never replace the lineup and are reported when composition finishes',()=>{
  for(const bad of ['수사렌 수리코 수미미 수페코 모르는이름','수사렌 수리코 수미미 수페코 수페코']){
    const {selects,feedback,input,type,compositionEnd}=setup();type(bad);assert.ok(selects.every(select=>select.value===''));assert.equal(feedback.danger,false);
    compositionEnd({target:input});assert.equal(feedback.danger,true);assert.match(feedback.textContent,/찾지 못함|중복/);assert.ok(selects.every(select=>select.value===''));
  }
});

check('pasted names still apply immediately and subsequent valid edits update all five portraits',()=>{
  const {selects,type}=setup();type(names.join(' '),false);assert.deepEqual(selects.map(select=>select.value),names);
  type([...names].reverse().join(' '));assert.deepEqual(selects.map(select=>select.value),[...names].reverse());
});

console.log(`${checks} live lineup input checks passed`);
