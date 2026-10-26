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

export function memberMatchRank(member,query,initials=()=> ''){
  const q=compact(query);if(!q)return 0;
  const name=compact(member.name),aliases=(member.aliases||[]).map(compact),uid=compact(member.uid),initial=compact(initials(member.name));
  // Literal names always come before two-beolsik keyboard interpretations.
  if(name===q)return 0;
  if(name.startsWith(q))return 1;
  if(name.includes(q))return 2;
  if(aliases.some(value=>value===q))return 3;
  if(aliases.some(value=>value.startsWith(q)))return 4;
  if(aliases.some(value=>value.includes(q)))return 5;
  if(uid.includes(q)||initial.includes(q))return 6;
  const keys=[member.name,...(member.aliases||[]),initials(member.name)].map(value=>compact(hangulKeyboard(value)));
  if(keys.some(value=>value===q))return 7;
  if(keys.some(value=>value.startsWith(q)))return 8;
  return keys.some(value=>value.includes(q))?9:Infinity;
}

export function matchesMember(member,query,initials=()=> ''){
  return Number.isFinite(memberMatchRank(member,query,initials));
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
