import assert from 'node:assert/strict';
import fs from 'node:fs';
import {characterPortrait,withPortraitLibrary,findCharacter} from '../public/character-portraits.mjs';
import {assetUrl} from '../public/site-paths.mjs';
import {legacyImagePaths} from '../public/legacy-image-paths.mjs';
const root=new URL('../public/',import.meta.url);
const catalog=JSON.parse(fs.readFileSync(new URL('characters.json',root))).characters;
const library=JSON.parse(fs.readFileSync(new URL('portrait-library.json',root)));
const combined=withPortraitLibrary(catalog,library);
const inventory=process.env.IMAGE_TREE_INDEX?new Set(JSON.parse(fs.readFileSync(process.env.IMAGE_TREE_INDEX))):null;
const exists=url=>inventory?inventory.has(decodeURIComponent(url)):fs.existsSync(new URL('.'+url,root));
assert.equal(catalog.length,351);
assert.equal(findCharacter(combined,'신루카').id,findCharacter(combined,'뉴루카').id);
for(const c of catalog){
 const entry=library.characters.find(x=>x.name===c.name);
 assert.ok(entry,c.name);
 assert.ok(c.portrait.startsWith('/source-library/images/'),c.name);
 assert.ok(exists(c.portrait),c.portrait);
 for(const url of Object.values(c.byStar))assert.ok(exists(url),url);
 for(let star=1;star<=6;star++){
  const p=characterPortrait(combined,c.name,star);
  assert.equal(p.url,entry.byStar[star]||entry.portrait||c.portrait,c.name+' '+star);
  assert.ok(p.candidates.every(p=>p.startsWith('/source-library/images/')));
  assert.ok(p.candidates.every(exists),c.name+' fallback');
 }
}
for(const [old,url] of Object.entries(legacyImagePaths)){
 assert.ok(exists(url),url);
 assert.equal(assetUrl(old),url,old);
 if(!old.includes('/bosses/'))assert.equal(characterPortrait(combined,'아오이',5,old).url,url);
}
assert.ok(exists('/source-library/images/Boss/4.20.webp'));
if(!inventory)for(const folder of ['characters','sheet-originals','bosses'])
 assert.ok(!fs.existsSync(new URL('images/'+folder,root)),folder);
assert.equal(characterPortrait(combined,'아오이',5,'/images/characters/unit-row-030.png').url,findCharacter(combined,'아오이').sourcePortrait);
console.log('PASS: 351 canonical characters, every rarity, all legacy paths, alias identity and relocated boss');
