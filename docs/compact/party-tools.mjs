const compact=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[\s·,，、/|]+/g,'');

// Compare English keyboard input without changing what the member typed.
export function hangulKeyboard(value){
  const initial=['r','R','s','e','E','f','a','q','Q','t','T','d','w','W','c','z','x','v','g'];
  const middle=['k','o','i','O','j','p','u','P','h','hk','ho','hl','y','n','nj','np','nl','b','m','ml','l'];
  const final=['','r','R','rt','s','sw','sg','e','f','fr','fa','fq','ft','fx','fv','fg','a','q','qt','t','T','d','w','c','z','x','v','g'];
  const jamo={'ㄱ':'r','ㄲ':'R','ㄴ':'s','ㄷ':'e','ㄸ':'E','ㄹ':'f','ㅁ':'a','ㅂ':'q','ㅃ':'Q','ㅅ':'t','ㅆ':'T','ㅇ':'d','ㅈ':'w','ㅉ':'W','ㅊ':'c','ㅋ':'z','ㅌ':'x','ㅍ':'v','ㅎ':'g','ㅏ':'k','ㅐ':'o','ㅑ':'i','ㅒ':'O','ㅓ':'j','ㅔ':'p','ㅕ':'u','ㅖ':'P','ㅗ':'h','ㅘ':'hk','ㅙ':'ho','ㅚ':'hl','ㅛ':'y','ㅜ':'n','ㅝ':'nj','ㅞ':'np','ㅟ':'nl','ㅠ':'b','ㅡ':'m','ㅢ':'ml','ㅣ':'l'};
  return [...String(value||'')].map(char=>{
    const code=char.codePointAt(0)-0xac00;
    if(code>=0&&code<11172)return initial[Math.floor(code/588)]+middle[Math.floor(code/28)%21]+final[code%28];
    return jamo[char]||char;
  }).join('');
}

export function matchesMember(member,query,initials=()=> ''){
  const q=compact(query);if(!q)return true;
  const values=[member.name,member.uid||'',...(member.aliases||[]),initials(member.name)];
  return values.some(value=>compact(value).includes(q)||compact(hangulKeyboard(value)).includes(q));
}

export function parseLineup(source,characters){
  const lookup=new Map();
  for(const c of characters)for(const alias of [c.name,...(c.aliases||[])]){
    const key=compact(alias);if(!key)continue;
    const entries=lookup.get(key)||[];if(!entries.includes(c.name))entries.push(c.name);lookup.set(key,entries);
  }
  const tokens=String(source||'').trim().split(/[\s,，、·/|]+/u).filter(Boolean),names=[],unknown=[],ambiguous=[];
  for(const token of tokens){
    const found=lookup.get(compact(token))||[];
    const exact=characters.find(c=>compact(c.name)===compact(token));
    if(exact)names.push(exact.name);
    else if(found.length===1)names.push(found[0]);
    else if(found.length>1)ambiguous.push({token,names:found});
    else unknown.push(token);
  }
  const identities=names.map(name=>characters.find(c=>c.name===name)?.unitId||name);
  const duplicates=names.filter((name,index)=>identities.indexOf(identities[index])!==index);
  return {names,unknown,ambiguous,duplicates:[...new Set(duplicates)],valid:names.length===5&&!unknown.length&&!ambiguous.length&&!duplicates.length};
}

export function lineupOrder(names,characters){
  const entries=names.map((name,index)=>({name,index,character:characters.find(c=>c.name===name)}));
  const unknown=entries.filter(e=>!Number.isFinite(e.character?.position)).map(e=>e.name);
  const inversions=[];
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
    const a=entries[i],b=entries[j];
    if(Number.isFinite(a.character?.position)&&Number.isFinite(b.character?.position)&&a.character.position<b.character.position)inversions.push([a.name,b.name]);
  }
  const sorted=[...entries].sort((a,b)=>{
    if(!Number.isFinite(a.character?.position)||!Number.isFinite(b.character?.position))return a.index-b.index;
    return b.character.position-a.character.position||a.index-b.index;
  }).map(e=>e.name);
  return {valid:!unknown.length&&!inversions.length,unknown,inversions,sorted};
}
