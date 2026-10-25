import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function buildCharacterReference(root=fileURLToPath(new URL('..',import.meta.url))){
  const read=name=>JSON.parse(fs.readFileSync(path.join(root,'data',name),'utf8'));
  const source=read('character-positions.json'),names=read('character-unit-map.json');
  const lookup=new Map(source.units.flatMap(unit=>(names[unit.unitId]||[]).map(name=>[name,unit])));
  const characters=read('character-catalog.json').characters.map(c=>{
    const unit=[c.name,...c.aliases].map(name=>lookup.get(name)).find(Boolean);
    const asset=value=>value?'https://priconne.pages.dev/'+String(value).replace(/^\//,''):null;
    return {id:'catalog-'+(unit?.unitId||'custom')+'-'+encodeURIComponent(c.name),name:c.name,aliases:[...new Set([...c.aliases,...(unit?[...(names[unit.unitId]||[]),unit.japanese,unit.english]:[])])].filter(name=>name!==c.name),images:{default:asset(c.portrait),...Object.fromEntries(Object.entries(c.byStar).map(([star,url])=>[star,asset(url)]))},...(unit?{unitId:unit.unitId,position:unit.position,place:unit.place}:{}),defaultStar:c.byStar['6']?6:5};
  });
  const missing=characters.filter(c=>c.position===undefined);
  if(missing.length)throw Error('Unmapped character positions: '+missing.map(c=>c.name).join(', '));
  const videos=read('tactic-video-links.json');
  const legacy=read('2026-10-source.json').data||{};
  fs.writeFileSync(path.join(root,'src','character-reference.js'),'// Generated from the source data in data/.\nconst CHARACTER_REFERENCE='+JSON.stringify(characters)+';\nconst CHARACTER_POSITION_SOURCE='+JSON.stringify({source:source.source,sourceRepository:source.sourceRepository,retrievedAt:source.retrievedAt,count:source.units.length})+';\nconst CARRY_VIDEO_REFERENCE='+JSON.stringify(videos)+';\nconst HISTORY_REFERENCE='+JSON.stringify(legacy.clanHistory||[])+';\nconst AWARD_REFERENCE='+JSON.stringify(legacy.hallOfFame||[])+';\n');
  return characters;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('Character references: '+buildCharacterReference().length);
