import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {characterPortrait,withPortraitLibrary,findCharacter,portraitStarOverlay} from '../public/character-portraits.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../public');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'characters.json'),'utf8')).characters;
const library=JSON.parse(fs.readFileSync(path.join(root,'portrait-library.json'),'utf8'));
const combined=withPortraitLibrary(catalog,library);
assert.equal(catalog.length,327);
assert.equal(library.characters.length,352);
assert.ok(combined.length>=catalog.length);
function assertSourceExists(url){
  assert.ok(url.startsWith('/source-library/images/'),url);
  const relative=decodeURIComponent(url.slice(1));
  assert.ok(!relative.includes('..'),url);
  assert.ok(fs.existsSync(path.join(root,relative)),url);
}
let mapped=0,starFiles=0;
for(const c of library.characters){
  if(c.portrait) assertSourceExists(c.portrait);
  for(const file of Object.values(c.byStar)){
    assertSourceExists(file);
    starFiles++;
  }
}
for(const c of catalog)if(findCharacter(combined,c.name)?.sourcePortrait)mapped++;
assert.ok(mapped>=310,mapped);
const p3=characterPortrait(combined,'네네카',3);
const p5=characterPortrait(combined,'네네카',5);
assert.match(decodeURIComponent(p3.url),/images\/네네카3.png$/);
assert.match(decodeURIComponent(p5.url),/images\/네네카5.png$/);
assert.equal(p3.showStarOverlay,false);
assert.equal(p5.showStarOverlay,false);
const n5=characterPortrait(combined,'나나카',5);
assert.match(decodeURIComponent(n5.url),/images\/nostar\/나나카.png$/);
assert.equal(n5.showStarOverlay,true);
assert.match(portraitStarOverlay(n5),/stars\/5.png/);
const n6=characterPortrait(combined,'나나카',6);
assert.match(decodeURIComponent(n6.url),/images\/나나카6.png$/);
assert.equal(n6.showStarOverlay,false);
const unknown=characterPortrait(combined,'에키드나',5);
assert.ok(unknown.url.startsWith('/images/'),'Unmatched characters keep their original image');
const override=characterPortrait(combined,'네네카',3,'data:image/png;base64,AAAA');
assert.equal(override.url,'data:image/png;base64,AAAA');
assert.equal(override.showStarOverlay,false);
const page=fs.readFileSync(path.join(root,'portrait-maker.html'),'utf8');
assert.ok(!page.includes('PurikoneKrSemi'),'Third-party repo label must not appear in public composer UI');
const shell=fs.readFileSync(path.join(root,'clan-shell.html'),'utf8');
assert.ok(shell.includes('source-portraits2'));
console.log('PASS imported images:',library.characters.length,'named characters;',starFiles,'rarity files;',mapped,'catalog matches; selected rarity and legacy fallback verified');
