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
assert.equal(catalog.length,352);
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
const renamed={네피네라:'네피',성레짓타:'성짓타',앤글:'앤글레어',엔요리:'앤요리',엔카리:'앤카리',이이올렛:'이사올렛',크소라:'성소라',크유이:'성유이',페코린느:'페코'};
for(const [legacy,official] of Object.entries(renamed)){
  const updated=findCharacter(catalog,official);
  assert.ok(updated,official);
  assert.ok(updated.aliases.includes(legacy),legacy);
  assert.equal(findCharacter(catalog,legacy)?.id,updated.id,'Legacy saved tactic name should resolve to same character');
  assert.ok(findCharacter(combined,official).sourcePortrait,'New default must use image library '+official);
  assert.equal(findCharacter(combined,legacy).id,updated.id);
}
const confirmed={루이즈:'마리',미오:'혼다',성요리:'클요리',에키드나:'수키드나',원유미:'앨유미',퍼라엘:'파라엘',퓨오리:'마오리'};
for (const [oldName,canon] of Object.entries(confirmed)) {
  const target=findCharacter(catalog,canon);
  assert.ok(target && target.aliases.includes(oldName),oldName);
  assert.equal(findCharacter(catalog,oldName).id,target.id);
  assert.ok(findCharacter(combined,oldName).sourcePortrait,oldName);
}
assert.ok(findCharacter(catalog,'마리').aliases.includes('루이즈마리'));
assert.equal(findCharacter(combined,'루이즈마리').id,findCharacter(combined,'마리').id);
const availableNames=new Set(library.characters.map(c=>c.name));
assert.equal(catalog.filter(c=>!availableNames.has(c.name)).length,0);
assert.equal(library.characters.filter(c=>!catalog.some(x=>x.name===c.name)).length,0);
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
const known=characterPortrait(combined,'에키드나',5);
assert.match(decodeURIComponent(known.url),/images\/수키드나5.png$/);
const override=characterPortrait(combined,'네네카',3,'data:image/png;base64,AAAA');
assert.equal(override.url,'data:image/png;base64,AAAA');
assert.equal(override.showStarOverlay,false);
const page=fs.readFileSync(path.join(root,'portrait-maker.html'),'utf8');
assert.ok(!page.includes('PurikoneKrSemi'),'Third-party repo label must not appear in public composer UI');
const shell=fs.readFileSync(path.join(root,'clan-shell.html'),'utf8');
assert.match(shell, /<script type="module" src="\.\/clan\.js(?:\?[^"]+)?"><\/script>/);
const client=fs.readFileSync(path.join(root,'clan.js'),'utf8');
assert.ok(client.includes('withPortraitLibrary(CHARACTERS.characters,PORTRAIT_LIBRARY)'));
assert.ok(client.includes("'/portrait-library.json'"));
// Regression: a missing 5-star portrait (e.g. Aoi) must use a SMALL overlay,
// not a second full-sized image outside the 62px portrait container.
const guildSource=fs.readFileSync(path.join(root,'guild-workspace.mjs'),'utf8');
const guildCss=fs.readFileSync(path.join(root,'guild.css'),'utf8');
assert.ok(guildSource.includes('class="combo-source-art"'), 'Recommendation markup must match the CSS overlay wrapper');
assert.ok(!guildSource.includes('class="combo-art"'), 'Old unmatched wrapper must not return');
assert.ok(guildCss.includes('.combo-party .combo-source-art{position:relative'), 'The portrait container must be positioned');
assert.ok(guildCss.includes('>img.source-star-overlay{position:absolute'), 'The star icon must be an overlay, not a normal image');
const aoi=characterPortrait(combined,'아오이',5);
assert.equal(aoi.showStarOverlay,true);
assert.match(portraitStarOverlay(aoi),/source-star-overlay/);
console.log('PASS imported images:',library.characters.length,'named characters;',starFiles,'rarity files;',mapped,'catalog matches; selected rarity and legacy fallback verified');
