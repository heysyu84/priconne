import assert from 'node:assert/strict';
import {readTextScale,saveTextScale,normalizeTextScale,applyTextScale,migrateMobileTextScale} from '../public/display-settings.mjs';
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
assert.equal(migrateMobileTextScale(mobileStore,true),100,'Migration does not run twice');
saveTextScale(115,mobileStore);
assert.equal(migrateMobileTextScale(mobileStore,true),115,'A deliberate new 115% choice is preserved');
const customStore=new Map([['nyang-display-text-scale-v1','150']]);
const personal={getItem:key=>customStore.get(key)??null,setItem:(key,val)=>customStore.set(key,val)};
assert.equal(migrateMobileTextScale(personal,true),150,'Other personal text preferences must remain');

const css=scaleStyles('html,body{font-size:16px}.a{font-size:1em}.a strong{font-size:inherit}@media(max-width:800px){.a{font:700 12px/1.5 sans-serif}.b{--battle-log-font-size:13px;font-size:var(--battle-log-font-size)}}');
assert.ok(css.includes('calc((16px) * var(--user-text-scale,1))'));
assert.ok(css.includes('font-size:1em!important')&&css.includes('font-size:inherit!important'),'Relative and inherited sizes must not be scaled twice');
assert.ok(css.includes('@media(max-width:800px)')&&css.includes('calc((12px) * var(--user-text-scale,1))'),'Responsive and shorthand fonts must retain their cascade');
assert.ok(css.includes('font-size:var(--battle-log-font-size)!important'));
assert.ok(!css.includes('calc((var(--battle-log-font-size))'),'Shared table sizes must scale once');
assert.ok(css.includes(':not([data-text-scale="100"])'),'Default display must leave all existing styles intact');
assert.ok(!scaleStyles('input:checked:after{font-size:12px}'),'Fixed checkbox marks must keep their size');
const actual=buildDisplayStyles();assert.ok(actual.includes('/* readability.css */')&&actual.includes('/* display-settings.css */'));
console.log('PASS: private display preferences, storage denial, reset, inherited fonts, shorthand fonts, responsive cascade and table scale tokens');
