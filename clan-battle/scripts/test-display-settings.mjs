import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readTextScale,saveTextScale,normalizeTextScale,applyTextScale,migrateMobileTextScale,readTacticBaseScale} from '../public/display-settings.mjs';
import {scaleStyles,buildDisplayStyles} from './build-display-styles.mjs';

const saved=new Map([['clan-records','unchanged']]);
const storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
assert.equal(readTextScale(storage),100);
assert.equal(saveTextScale(150,storage),150);
assert.equal(readTextScale(storage),150);
assert.equal(saved.get('clan-records'),'unchanged');
assert.equal(saved.size,2,'Display preferences must not replace existing data');
for(const invalid of [NaN,Infinity,'broken'])assert.equal(normalizeTextScale(invalid),100);
assert.equal(normalizeTextScale(50),100);assert.equal(normalizeTextScale(300),200);
const denied={getItem(){throw Error('Storage unavailable');},setItem(){throw Error('Storage unavailable');}};
assert.equal(readTextScale(denied),100);assert.equal(saveTextScale(175,denied),175);
const properties=new Map(),root={dataset:{},style:{setProperty:(name,value)=>properties.set(name,value)}};
applyTextScale(150,root);assert.equal(root.dataset.textScale,'150');assert.equal(properties.get('--user-text-scale'),'1.5');
applyTextScale(100,root);assert.equal(root.dataset.textScale,'100');assert.equal(properties.get('--user-text-scale'),'1');


const mobileSaved=new Map([['nyang-display-text-scale-v1','115']]);
const mobileStore={getItem:key=>mobileSaved.get(key)??null,setItem:(key,value)=>mobileSaved.set(key,value)};
assert.equal(migrateMobileTextScale(mobileStore,false),115,'Desktop must preserve 115%');
assert.equal(migrateMobileTextScale(mobileStore,true),100,'Only the old 115% mobile default migrates');
assert.equal(mobileSaved.get('nyang-display-mobile-base-110-v1'),'1');
assert.equal(readTacticBaseScale(mobileStore),115,'Retain the old tactic appearance before resetting the general preference');
assert.equal(migrateMobileTextScale(mobileStore,true),100,'Migration does not run twice');
saveTextScale(115,mobileStore);
assert.equal(migrateMobileTextScale(mobileStore,true),115,'A deliberate new 115% choice is preserved');
const customStore=new Map([['nyang-display-text-scale-v1','150']]);
const personal={getItem:key=>customStore.get(key)??null,setItem:(key,val)=>customStore.set(key,val)};
assert.equal(migrateMobileTextScale(personal,true),150,'Other personal text preferences must remain');
const recoveredValues=new Map([['nyang-display-mobile-base-110-v1','1'],['nyang-display-text-scale-v1','100']]);
const recovered={getItem:key=>recoveredValues.get(key)??null,setItem:(key,val)=>recoveredValues.set(key,val)};
assert.equal(migrateMobileTextScale(recovered,true),100);
assert.equal(readTacticBaseScale(recovered),115,'Recover tactic size discarded by the previous migration');
assert.equal(migrateMobileTextScale(denied,true),100);
applyTextScale(100,root,readTacticBaseScale(recovered));
assert.equal(properties.get('--mobile-tactic-base'),'1.15');

const css=scaleStyles('html,body{font-size:16px}.a{font-size:1em}.a strong{font-size:inherit}@media(max-width:800px){.a{font:700 12px/1.5 sans-serif}.b{--battle-log-font-size:13px;font-size:var(--battle-log-font-size)}}');
assert.ok(css.includes('calc((16px) * var(--ui-text-scale,1))'));
assert.ok(css.includes('font-size:1em!important')&&css.includes('font-size:inherit!important'),'Relative and inherited sizes must not be scaled twice');
assert.ok(css.includes('@media(max-width:800px)')&&css.includes('calc((12px) * var(--ui-text-scale,1))'),'Responsive and shorthand fonts must retain their cascade');
assert.ok(css.includes('round(nearest,var(--battle-log-font-size),1px)'));
assert.ok(!css.includes('calc((var(--battle-log-font-size))'),'Shared table sizes must scale once');
assert.ok(!css.includes(':not([data-text-scale="100"])'),'100% and higher preferences must use the same baseline');
assert.ok(!scaleStyles('input:checked:after{font-size:12px}'),'Fixed checkbox marks must keep their size');
const actual=buildDisplayStyles();assert.ok(actual.includes('/* readability.css */')&&actual.includes('/* display-settings.css */'));
assert.ok(!actual.includes('[data-text-scale="100"]'),'No legacy 100%-only font overrides');
assert.ok(actual.includes('round(nearest,'),'Ordinary text uses whole pixels');

// Evaluate the actual generated font declarations and authored media variables.
// This is arithmetic/CSS-source verification, not a browser layout simulation.
function rules(css,width,dpr){
  css=css.replace(/\/\*[\s\S]*?\*\//g,'');const out=[];let start=0;
  while(start<css.length){
    const open=css.indexOf('{',start);if(open<0)break;
    let end=open+1,depth=1;for(;end<css.length&&depth;end++)depth+=css[end]==='{'?1:css[end]==='}'?-1:0;
    const head=css.slice(start,open).trim(),body=css.slice(open+1,end-1);start=end;
    if(head.startsWith('@media')){
      const checks=[...head.matchAll(/(min|max)-(width|resolution)\s*:\s*([\d.]+)/g)];
      if(checks.every(([,bound,kind,n])=>bound==='min'?(kind==='width'?width:dpr)>=+n:(kind==='width'?width:dpr)<=+n))out.push(...rules(body,width,dpr));
    }else if(head.startsWith('@'))out.push(...rules(body,width,dpr));
    else out.push({head,body});
  }
  return out;
}
function args(value){const result=[];let depth=0,start=0;for(let i=0;i<value.length;i++){if(value[i]==='(')depth++;if(value[i]===')')depth--;if(value[i]===','&&!depth){result.push(value.slice(start,i));start=i+1;}}result.push(value.slice(start));return result;}
function evaluate(value,variables){
  value=value.trim().replace(/!important$/,'').trim();
  if(value.startsWith('var(')){const [key,fallback='0']=args(value.slice(4,-1));return evaluate(variables[key.trim()]??fallback,variables);}
  if(value.startsWith('max('))return Math.max(...args(value.slice(4,-1)).map(x=>evaluate(x,variables)));
  if(value.startsWith('round(')){const [,n,step]=args(value.slice(6,-1)),interval=evaluate(step,variables);return Math.round(evaluate(n,variables)/interval)*interval;}
  if(value.startsWith('calc('))return value.slice(5,-1).split(/\s+\*\s+/).reduce((n,x)=>n*evaluate(x,variables),1);
  if(value.startsWith('(')&&value.endsWith(')'))return evaluate(value.slice(1,-1),variables);
  assert.match(value,/^-?[\d.]+(?:px)?$/,'Unsupported test arithmetic: '+value);return parseFloat(value);
}
const settings=fs.readFileSync(new URL('../public/display-settings.css',import.meta.url),'utf8');
function font(selector,width,dpr,scale=100,tactic=100){
  const variables={'--user-text-scale':String(scale/100),'--mobile-tactic-base':String(tactic/100)};
  for(const {head,body} of rules(settings,width,dpr))if(head==='html[data-text-scale]')for(const decl of body.split(';')){const pos=decl.indexOf(':');if(pos>0)variables[decl.slice(0,pos).trim()]=decl.slice(pos+1);}
  let value;
  for(const {head,body} of rules(actual,width,dpr))if(head.split(',').map(x=>x.trim()).includes('html[data-text-scale] '+selector))for(const decl of body.split(';'))if(decl.startsWith('font-size:'))value=decl.slice(10);
  assert.ok(value,'Missing font declaration '+selector);return evaluate(value,variables);
}
for(const width of [320,375,800]){
  assert.equal(font('body',width,3),17);
  assert.equal(font('.mobile-nav button',width,3),12);
  assert.equal(font('.mobile-nav button span',width,3),20);
  assert.equal(font('.tw-grid .tw-text-cell>[data-tw-text]',width,3),15);
  assert.equal(font('.tw-grid .tw-text-cell>[data-tw-text]',width,3,100,115),17.25);
}
for(const [width,dpr,body,menu] of [[1360,1,16,16],[2560,1,18,18],[3840,1,22,20],[2560,1.5,16,16]]){
  assert.equal(font('body',width,dpr),body);assert.equal(font('.sidebar .nav',width,dpr),menu);
}
for(const [width,dpr] of [[320,3],[375,3],[800,1],[801,1],[1360,1],[2560,1],[3840,1],[2560,1.5]]){
  for(const selector of ['body',width<=800?'.mobile-nav button':'.sidebar .nav']){
    let previous=0;
    for(let n=100;n<=200;n+=5){const size=font(selector,width,dpr,n);assert.ok(size>=previous,`${width}px ${selector} shrank at ${n}%`);assert.equal(size,Math.round(size));previous=size;}
  }
}
console.log('PASS: private preferences, preserved tactic size, mobile 110%/115%, desktop minimums and monotonic 100–200% fonts');
