// Pure, read-only character resolution for externally collected JP tactics.
// Canonical Korean names come from the site's unit-ID map; never infer a
// costume variant from a transliterated English/Chinese display name.
const clean=value=>String(value??'').trim();
const key=value=>clean(value).normalize('NFKC').replace(/[\s・·()（）]/g,'').toLocaleLowerCase('ko-KR');

// Only high-confidence aliases grounded in observed JP October-2025 Aikurumi
// tactic lines. An ambiguous shorthand is NOT auto-mapped across characters.
export const VERIFIED_SOURCE_ALIASES=Object.freeze({
 '118101':['兰法龙'],
 '180601':['黑猫'],
 '133101':['紫罗兰','スミレ'],
 '103801':['栞'],
 '130101':['若菜'],
 '134001':['菲欧'],
 '135601':['诗夏'],
 '181201':['プリシェ','姫フィ','プリフィ'],
 '135101':['水シェ','水フィ'],
 '135401':['水モネ'],
 '133501':['ニュサレ'],
 '180801':['リトリリ','リリカル'],
 '129501':['ちぇる']
});

// Short JP names are resolved only inside the known five-unit party. Any
// collision between costumes is removed by the existing owner check below.
export function japanesePartyAliases(japanese){
 const full=clean(japanese),normal=full.normalize('NFKC'),base=normal.replace(/\s*\([^)]*\)\s*/g,'').trim();
 if(!base)return [];
 const aliases=[normal,base];
 const costumes=[[/サマー|水着/,['水','水着','夏']],[/プリンセス/,['プリ','プ','P','姫']],[/ニューイヤー|正月/,['ニュ','正月','新年']],
  [/クリスマス/,['クリ','聖夜']],[/ハロウィン/,['ハロ']],[/アルファ|アルファ/,['アル','α']],
  [/作業服|作業着/,['作','作業服']],[/オーバーロード/,['オバ']],[/儀装束/,['儀']],[/ステージ/,['ステ']],
  [/ウィンター/,['冬']],[/バレンタイン/,['バレ']],[/スプリング/,['春']],[/ドレス/,['ドレス']],[/エンジェル/,['天']]];
 for(const [pattern,prefixes]of costumes)if(pattern.test(normal))for(const prefix of prefixes)aliases.push(prefix+base);
 return [...new Set(aliases)];
}

export function resolveAikurumiParty(charas, unitNames={}, positionUnits=[], extraAliases={}){
  const units=new Map((Array.isArray(positionUnits)?positionUnits:positionUnits?.units||[])
    .map(u=>[Number(u.unitId),u]));
  const issues=[];
  if(!Array.isArray(charas)||charas.length!==5)
    issues.push({code:'incomplete-lineup',message:'원본 캐릭터가 5명이 아님'});
  const ids=(Array.isArray(charas)?charas:[]).map(c=>Number(c?.prefabId));
  if(ids.length!==new Set(ids).size)
    issues.push({code:'repeated-unit-id',message:'원본 편성의 캐릭터 ID 중복'});
  const rows=(Array.isArray(charas)?charas:[]).map((c,index)=>{
    const id=Number(c?.prefabId);
    const korean=(unitNames[String(id)]||[]).map(clean).filter(Boolean);
    const canonical=korean[0]||null;
    const unit=units.get(id);
    if(!Number.isSafeInteger(id)||id<=0||!canonical||!unit)
      issues.push({code:'unmapped-unit-id',slot:index+1,id:Number.isSafeInteger(id)?id:null,message:'한국어 캐릭터 ID 대조 실패'});
    const aliases=[clean(c?.unitName),clean(unit?.japanese),clean(unit?.english),...japanesePartyAliases(unit?.japanese),
      ...korean,...(VERIFIED_SOURCE_ALIASES[String(id)]||[]),...(extraAliases[String(id)]||[])].filter(Boolean);
    return {slot:index+1,prefabId:Number.isSafeInteger(id)?id:null,
      koreanName:canonical,sourceName:clean(c?.unitName),aliases:[...new Set(aliases)],
      matchType:canonical&&unit?'exact-unit-id':'unresolved'};
  });
  // Never feed an alias into a slot if it points to more than one member of
  // this specific party. Suppress it and keep a review warning.
  const owners=new Map();
  for(const row of rows)for(const alias of row.aliases){
    const normalized=key(alias);
    if(!owners.has(normalized))owners.set(normalized,new Set());
    owners.get(normalized).add(row.slot);
  }
  let collisionCount=0;
  for(const row of rows){
    const duplicates=row.aliases.filter(alias=>(owners.get(key(alias))?.size||0)>1);
    if(duplicates.length){
      collisionCount+=duplicates.length;
      row.aliases=row.aliases.filter(alias=>!duplicates.includes(alias));
    }
  }
  if(collisionCount)issues.push({code:'ambiguous-alias',message:'둘 이상의 캐릭터에 해당하는 별칭 제외',count:collisionCount});
  return {rows,koreanNames:rows.map(r=>r.koreanName),foreignNames:rows.map(r=>r.aliases.join('|')),
    complete:rows.length===5&&rows.every(r=>r.matchType==='exact-unit-id')&&!issues.some(i=>i.code==='repeated-unit-id'),
    issues};
}
