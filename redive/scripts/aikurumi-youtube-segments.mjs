import {resolveAikurumiParty} from '../public/aikurumi-character-matcher.mjs';

const compact=value=>String(value??'').normalize('NFKC').replace(/[\s・･·、,，:：()（）\[\]【】]/g,'').toLowerCase();
const clockSeconds=value=>{const a=value.split(':').map(Number);return a.length===3?a[0]*3600+a[1]*60+a[2]:a[0]*60+a[1];};
export function youtubeStartSeconds(link){
 try{const u=new URL(link),raw=u.searchParams.get('t')||u.searchParams.get('start')||u.hash.match(/t=([^&]+)/)?.[1];
  if(!raw)return null;if(/^\d+(?:\.\d+)?s?$/.test(raw))return Math.floor(Number(raw.replace(/s$/,'')));
  if(/^\d+(?::\d+){1,2}$/.test(raw))return clockSeconds(raw);
  const m=raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);return m&&m[0]?Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0):null;
 }catch{return null;}
}
function bossHeader(text,bossNames){
 const line=String(text).normalize('NFKC').trim().slice(0,180);
 const m=line.match(/(?:^|[^\d])(?:第\s*)?([1-5])\s*(?:ボス|ネームド|ネム|体目|番目|넴|번\s*보스|BOSS\b)/iu)
  ||line.match(/BOSS\s*([1-5])\b/iu);
 if(m)return Number(m[1]);
 const found=(bossNames||[]).map((n,i)=>n&&line.includes(String(n).normalize('NFKC'))?i+1:0).filter(Boolean);
 return found.length===1&&line.length<=130?found[0]:null;
}
export function splitVideoDescription(description,bossNames){
 const lines=String(description??'').normalize('NFKC').replace(/\r\n?/g,'\n').split('\n'),parts=[];
 let current={boss:null,header:null,startSeconds:null,lines:[]},lastBattle=91;
 const emit=()=>{if(current.lines.some(s=>s.trim()))parts.push({...current,text:current.lines.join('\n')});};
 for(let index=0;index<lines.length;index++){
  const line=lines[index],trimmed=line.trim(),clock=trimmed.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/),seconds=clock?clockSeconds(clock[1]):null;
  const boss=bossHeader(clock?.[2]||trimmed,bossNames);
  const battle=trimmed.match(/^(?:[★☆⭐✩]\s*)?(0?[01]):([0-5]\d)(?=\s|$|[、,:：])/);
  const battleSeconds=battle?Number(battle[1])*60+Number(battle[2]):null;
  const bossTitle=clock?.[2]||trimmed;
  const ordinalTitle=/(?:第\s*)?[1-5]\s*(?:ボス|ネームド|BOSS)|BOSS\s*[1-5]/i.test(bossTitle);
  const isBoss=boss!==null&&(ordinalTitle&&!battle||!/(?:\bUB\b|ユニオンバースト|通常攻撃|スキル|連打|目押し|SET|AUTO|解除)/i.test(bossTitle)&&!battle);
  const chapter=!!clock&&(seconds>90||seconds===0)&&!/(?:SET|OFF|UB|解除|連打|目押し)/i.test(clock[2]);
  const restart=battleSeconds!==null&&battleSeconds<=90&&lastBattle<90&&battleSeconds>lastBattle+3;
  const variant=/^(?:[①-⑳◆■●★☆【\[<(（]|(?:編成|パーティ|pattern|TL)\s*\d)/i.test(trimmed)
   &&/(?:\d[,.\d]*\s*(?:万|億)|全\s*(?:set|セット)|[ox〇○×✕ー-]{5}|編成|パーティ)/i.test(trimmed)
   &&current.lines.some(s=>/^\s*0?[01]:[0-5]\d/.test(s));
  if(isBoss||chapter||restart||variant){
   emit();current={boss:boss??current.boss,header:trimmed,startSeconds:chapter||isBoss&&clock?seconds:current.startSeconds,lines:[]};lastBattle=91;
  }
  current.lines.push(line);if(battleSeconds!==null&&battleSeconds<=90)lastBattle=battleSeconds;
 }
 emit();return parts.length?parts.map(({lines,...p})=>p):[{boss:null,header:null,startSeconds:null,text:''}];
}
function damages(text){
 const normalized=String(text).normalize('NFKC').replace(/(\d),(?=\d{3}(?:\D|$))/g,'$1');
 const values=new Set();
 for(const m of normalized.matchAll(/(\d+(?:\.\d+)?)\s*億(?:\s*(\d+(?:\.\d+)?)\s*万)?/g))values.add(Math.round(Number(m[1])*10000+Number(m[2]||0)));
 for(const m of normalized.matchAll(/(\d+(?:\.\d+)?)\s*万/g))values.add(Math.round(Number(m[1])));
 for(const m of normalized.matchAll(/(?:^|[^\d])(\d{4,6})(?=$|[^\d])/g))values.add(Number(m[1]));
 return values;
}
function damageMatches(text,target){
 if(damages(text).has(target))return true;
 const value=String(text).normalize('NFKC').replace(/(\d),(?=\d{3}(?:\D|$))/g,'$1');
 // A source's 3.74億 is rounded; match only within the displayed precision.
 for(const m of value.matchAll(/(\d+(?:\.(\d+))?)\s*億(?!\s*\d+\s*万)/g)){
  const precision=10000/10**(m[2]?.length||0);
  if(Math.abs(Number(m[1])*10000-target)<precision/2)return true;
 }
 return false;
}
const titleDamages=ref=>[...damages(String(ref.link.name||'').split('\n')[0])];
function partyAliases(ref){
 return resolveAikurumiParty(ref.task.charas,ref.snapshot.characterData?.names,ref.snapshot.characterData?.positionUnits).rows.map(r=>
  r.aliases.map(compact).filter(n=>n.length>=2&&!/^\d+$/.test(n)));
}
function partyHits(segment,aliases){const text=compact(segment.text);return aliases.filter(names=>names.some(n=>text.includes(n))).length;}
const mask=text=>String(text).normalize('NFKC').match(/[oOxX〇○◯●⭕❌✕×✖✗ー-]{5}/)?.[0].toLowerCase().replace(/[〇○◯●⭕]/g,'o').replace(/[❌✕×✖✗]/g,'x');
export function matchedYouTubeSegment(sections,ref,videoRefs){
 const perBoss=videoRefs.filter(x=>x.boss===ref.boss&&x.stage===ref.stage),aliases=partyAliases(ref);
 const options=sections.filter(s=>s.boss===null||s.boss===ref.boss),requestedTime=youtubeStartSeconds(ref.link.link);
 const linkedTimes=videoRefs.map(r=>youtubeStartSeconds(r.link.link)).filter(t=>t!==null);
 if(!options.length)return {segment:null,match:'boss-section-not-found'};
 // Match an actual chapter timestamp, never a battle's remaining-time clock.
 if(requestedTime!==null&&linkedTimes.filter(t=>t===requestedTime).length===1){
  const timed=options.filter(s=>s.startSeconds===requestedTime);
  if(timed.length===1)return {segment:timed[0],match:'source-timestamp'};
 }
 const scored=options.map(segment=>{
  const title=titleDamages(ref),exact=title.some(v=>damageMatches(segment.text,v)),hits=partyHits(segment,aliases);
  const different=perBoss.filter(other=>other!==ref&&other.task.id!==ref.task.id).map(other=>partyHits(segment,partyAliases(other)));
  const uniqueParty=hits>=4&&different.every(n=>n<hits);
  const expectedMask=mask(ref.link.name),sourceMask=mask(segment.text),maskMatches=expectedMask&&expectedMask===sourceMask;
  const conflict=perBoss.filter(other=>other!==ref&&titleDamages(other).some(v=>damageMatches(segment.text,v))).length;
  return {segment,exact,hits,uniqueParty,maskMatches,conflict,score:(exact?10:0)+(uniqueParty?8:0)+hits+(maskMatches?2:0)};
 }).sort((a,b)=>b.score-a.score);
 const best=scored[0],second=scored[1];
 const uniqueBest=!second||best.score>second.score;
 if(best.exact&&best.conflict===0&&uniqueBest)return {segment:best.segment,match:'unique-damage-section'};
 if(best.uniqueParty&&uniqueBest){
  const sameParty=perBoss.filter(other=>other!==ref&&partyHits(best.segment,partyAliases(other))===best.hits);
  if(!sameParty.length||best.maskMatches&&sameParty.every(other=>mask(other.link.name)!==mask(ref.link.name)))
   return {segment:best.segment,match:'unique-party-section'};
 }
 const bossOptions=options.filter(s=>s.boss===ref.boss);
 if(bossOptions.length===1&&perBoss.length===1)return {segment:bossOptions[0],match:'unique-boss'};
 if(sections.length===1&&sections[0].boss===null&&videoRefs.length===1)return {segment:sections[0],match:'single-video'};
 return {segment:null,match:sections.length===1&&sections[0].boss===null?'shared-video-without-sections':'ambiguous-party-section',
  diagnostics:{sections:options.length,bestPartyHits:best?.hits||0,damageMatched:!!best?.exact,
   sourceTimestamp:requestedTime,chapterCount:options.filter(s=>s.startSeconds!==null).length}};
}
