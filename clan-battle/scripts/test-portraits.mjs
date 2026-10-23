import assert from 'node:assert/strict';
import fs from 'node:fs';
import {findCharacter, characterPortrait, portraitAttributes, handlePortraitError} from '../public/character-portraits.mjs';
const read = name => JSON.parse(fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8'));
const catalog=read('characters.json').characters,source=read('guild-source.json');
const html=fs.readFileSync(new URL('../public/clan-shell.html',import.meta.url),'utf8');
const app=JSON.parse(html.match(/<script id="seed-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
assert.equal(catalog.length,351);
assert.equal(new Set(catalog.map(c=>c.id)).size,351);
assert.equal(findCharacter(catalog,'에키드나').source.nameCell,'A275');
const references=new Set();let paths=0;
for(const c of catalog){
  assert.equal(findCharacter(catalog,' '+c.name.normalize('NFD')+' ').id,c.id);
  for(const url of [c.portrait,...Object.values(c.byStar)]){
    const bytes=fs.readFileSync(new URL('../public'+url,import.meta.url));
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');paths++;
  }
  assert.equal(characterPortrait(catalog,c.name,'1').url,c.byStar['1']||c.portrait);
  assert.equal(characterPortrait(catalog,c.name,'6').url,c.byStar['6']||c.portrait);
}
for(const month of Object.values(app.months))for(const t of month.tactics)for(const [i,name] of t.characters.entries()){
  references.add(name);assert.ok(characterPortrait(catalog,name,t.stars?.[i]).url,name);
}
for(const combos of Object.values(source.recommendations))for(const c of combos)for(const [i,name] of c.characters.entries()){
  references.add(name);assert.ok(characterPortrait(catalog,name,c.stars[i]).url,name);
}
const missingBefore=['수사렌','사키노','발즈루','무이미','뉴츠네','라이라엘','뉴사렌','리조미','크리스','지타','란파','워지타','느우카'];
for(const name of missingBefore)assert.ok(findCharacter(catalog,name),name);
assert.equal(findCharacter(catalog,'수사'),null);
assert.equal(findCharacter(catalog,''),null);
const base=findCharacter(catalog,'수사렌').byStar['5']||findCharacter(catalog,'수사렌').portrait;
assert.equal(characterPortrait(catalog,'수사렌',5,'javascript:alert(1)').url,base);
const p=characterPortrait(catalog,'수페코',6,'data:image/png;base64,AAAA');
assert.equal(p.candidates[0],'data:image/png;base64,AAAA');
assert.ok(portraitAttributes(p).includes('data-character-portrait'));
const image={matches:s=>s==='img[data-character-portrait]',dataset:{portraitFallbacks:JSON.stringify(p.candidates.slice(1))},src:p.url,hidden:false};
for(const expected of p.candidates.slice(1)){handlePortraitError({target:image});assert.equal(image.src,expected);assert.equal(image.hidden,false);}
handlePortraitError({target:image});assert.equal(image.hidden,true);
console.log(`PASS: ${catalog.length} characters, ${paths} portrait paths, all ${references.size} referenced names, 13 previously missing characters, exact variant matching, normalized names and same-character fallback chain`);
