// Pure parser for in-game Princess Connect clan battle log screenshots.
// No images, OCR data or raw text are stored in the clan database.
const clean=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const key=s=>clean(s).replace(/[\s_()[\]·.\-]/g,'').toLowerCase();
const digits=s=>Number(String(s??'').replace(/[^\d]/g,''));
const datePattern=/(20\d{2})\s*[\/.\-]\s*(0?[1-9]|1[0-2])\s*[\/.\-]\s*([0-2]?\d|3[01])\s*(?:일시|기록|at)?\s*([0-2]?\d)\s*:\s*([0-5]\d)/;
function dateFromText(text){
 const match=clean(text).match(datePattern);
 if(!match)return '';
 const [_,y,m,d,h,minute]=match;
 const date=new Date(Date.UTC(+y,+m-1,+d,+h,+minute));
 if(date.getUTCFullYear()!==+y||date.getUTCMonth()!==+m-1||date.getUTCDate()!==+d||+h>23)return '';
 return y+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0')+'T'+h.padStart(2,'0')+':'+minute;
}
function detectDamage(text){
 const raw=clean(text).replace(/(?<=\d)[ ,](?=\d{3}(?:\D|$))/g,'');
 const label=/((?:입힌\s*데미지|입힌\s*대미지|데미지|대미지|DAMAGE|DMG)\s*[:：]?\s*)([\d][\d, .]{5,15})/ig;
 let m,values=[];
 while((m=label.exec(raw))!==null){const value=digits(m[2]);if(value>=100000&&value<=1000000000000)values.push(value);}
 if(values.length)return values[0];
 const numbers=[...raw.matchAll(/(?:^|[^\d])((?:\d[,. ]?){7,12})(?=$|[^\d])/g)].map(m=>digits(m[1]))
   .filter(n=>n>=100000&&n<=1000000000000);
 return numbers.length===1?numbers[0]:null;
}
function bestMatch(text,items){
 const normalized=key(text);
 const occurrences=items.flatMap(item=>{
  if(!item.key)return [];
  const spans=[];let from=0,index;
  while((index=normalized.indexOf(item.key,from))!==-1){spans.push({...item,start:index,end:index+item.key.length});from=index+1;}
  return spans;
 });
 // A short nickname inside a longer nickname is one occurrence, not two people.
 const matched=occurrences.filter(a=>!occurrences.some(b=>b.key.length>a.key.length&&b.start<=a.start&&b.end>=a.end));
 if(!matched.length)return null;
 const distinct=[...new Set(matched.map(x=>x.id))];
 // Two independently named members/bosses within one row is ambiguous.
 return distinct.length===1?matched[0]:null;
}
export function cleanOcrName(value){
 return String(value??'').normalize('NFKC').replace(/^[\s\p{P}\p{S}ㆍ·]+|[\s\p{P}\p{S}ㆍ·]+$/gu,'').trim();
}
function fieldMember(text,candidates){
 const normalized=key(cleanOcrName(text));
 const exact=candidates.filter(c=>c.key===normalized),ids=new Set(exact.map(c=>c.id));
 if(ids.size)return ids.size===1?exact[0]:null;
 // The site may use an abbreviated nickname. Never infer one-letter names,
 // or select a short name when another registered full name also contains it.
 const partial=candidates.filter(c=>c.key.length>=2&&normalized.includes(c.key)&&!candidates.some(other=>other.id!==c.id&&other.key.includes(c.key)));
 return new Set(partial.map(c=>c.id)).size===1?partial[0]:null;
}
function editDistance(a,b){
 let previous=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=0;i<a.length;i++){
  const next=[i+1];for(let j=0;j<b.length;j++)next.push(Math.min(next[j]+1,previous[j+1]+1,previous[j]+(a[i]===b[j]?0:1)));
  previous=next;
 }
 return previous[b.length];
}
export function matchBossReadings(readings,bosses=[]){
 const letters=value=>String(value??'').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
 const ranked=bosses.map(boss=>{
  const aliases=[boss.name,...(boss.aliases||[])].map(letters);
  let score=0,raw='';
  for(const reading of readings){
   const value=letters(reading.text),confidence=Number(reading.confidence??100);
   if(!value||value.length<3)continue;
   for(const alias of aliases){
    let similarity=0;
    if(value.includes(alias))similarity=1;
    else if(value.length>=3&&alias.startsWith(value)&&confidence>=20)similarity=.94;
    else if(confidence>=40&&value.length>=Math.max(3,alias.length-1)){
     const a=value.normalize('NFD'),b=alias.normalize('NFD');
     similarity=1-editDistance(a,b)/Math.max(a.length,b.length);
    }
    if(similarity>score){score=similarity;raw=reading.text;}
   }
  }
  return {id:Number(boss.id),name:boss.name,score,raw};
 }).sort((a,b)=>b.score-a.score);
 const best=ranked[0],next=ranked[1]?.score||0;
 return best&&best.score>=.62&&best.score-next>=.25?best:null;
}
export function matchBossPortrait(visual,rows=[]){
 if(!Array.isArray(visual)||!visual.length)return null;
 const ranked=rows.filter(row=>row.bossId&&row.bossReadScore===1&&row.bossVisual?.length===visual.length).map(row=>({id:Number(row.bossId),distance:row.bossVisual.reduce((sum,value,i)=>sum+(value-visual[i])**2,0)/visual.length})).sort((a,b)=>a.distance-b.distance);
 const best=ranked[0],different=ranked.find(row=>row.id!==best?.id);
 return best&&best.distance<=.012&&(!different||different.distance-best.distance>=.012)?best.id:null;
}
export function memberCandidates(roster=[]){
 return roster.flatMap(person=>[person.name,...(person.aliases||[])].filter(Boolean)
   .map(name=>({id:person.id,name:person.name,alias:name,key:key(name)})));
}
export function bossCandidates(bosses=[]){
 return bosses.flatMap(boss=>[boss.name,String(boss.id)+'넴',String(boss.id)+'번째'].filter(Boolean)
   .map(name=>({id:Number(boss.id),name:boss.name,alias:name,key:key(name)})));
}
export function parseBattleLogText(input,{roster=[],bosses=[],mode='detail',source='',memberField=false}={}){
 const text=clean(input);
 if(!text)return null;
 const lines=String(input).split(/\n+/).map(clean).filter(Boolean);
 const candidates=memberCandidates(roster);
 const nameLines=lines.map(line=>line.replace(/^(?:클랜원|닉네임|플레이어)\s*[:：]\s*/,'').replace(/\s*님이.*$/,'').trim());
 const exact=nameLines.flatMap(line=>candidates.filter(candidate=>candidate.key===key(line)));
 const exactIds=new Set(exact.map(candidate=>candidate.id));
 const detectedMember=memberField?fieldMember(text,candidates):exactIds.size===1?exact[0]:exactIds.size>1?null:bestMatch(text,candidates);
 const detectedBoss=bestMatch(text,bossCandidates(bosses));
 const date=dateFromText(text);
 const damage=detectDamage(text);
 const stage=(text.match(/([1-6])\s*단계(?:째)?/)||[])[1]||'';
 // OCR may miss clan member names; avoid treating random labels as a valid member.
 const name=detectedMember?.name||'';
 const boss=detectedBoss?.id||'';
 const warnings=[];
 if(!name)warnings.push('클랜원 확인 필요');
 if(!boss)warnings.push('보스 확인 필요');
 if(!Number.isSafeInteger(damage)||!(damage>0))warnings.push('피해량 확인 필요');
 if(!date)warnings.push('공격 일시 확인 필요');
 if(mode==='quick')warnings.push('간단 로그: 정확한 공격 시각을 확인하세요');
 return {id:'ocr-'+Math.random().toString(36).slice(2),source,rawText:lines.join('\n'),
  memberId:detectedMember?.id||'',memberName:name,bossId:boss,damage:damage??'',gameAt:date,
  stage,carry:false,selected:mode!=='quick'&&warnings.length===0,warnings};
}
export function parseQuickLogText(input,options={}){
 // Each quick-log record normally ends in "N 데미지"; retain individual blocks.
 const lines=String(input??'').split('\n').map(clean).filter(Boolean);
 const blocks=[];let ongoing=[];
 for(const line of lines){
   if(/^(?:전투\s*로그|상세|도움말|클랜전)/.test(line))continue;
   ongoing.push(line);
   if(detectDamage(ongoing.join('\n'))!==null && (/(?:데미지|대미지|damage)\s*$/i.test(line)||/[\d][\d,. ]{5,}/.test(line))){
     blocks.push(ongoing.join('\n'));ongoing=[];
   }
 }
 if(ongoing.some(line=>/\d{7,12}/.test(line)))blocks.push(ongoing.join('\n'));
 return blocks.map(block=>parseBattleLogText(block,{...options,mode:'quick'})).filter(Boolean);
}
export function fingerprint({memberId,bossId,damage,gameAt}){
 return [String(gameAt||''),String(memberId||''),Number(bossId)||0,Number(damage)||0].join('|');
}
export function detectDuplicateRows(rows,existing=[]){
 const seen=new Set();
 return rows.map(row=>{
   const fp=fingerprint(row);
   const another=seen.has(fp)&&!!row.gameAt&&!!row.memberId&&!!row.bossId&&!!row.damage;
   if(row.gameAt&&row.memberId&&row.bossId&&row.damage)seen.add(fp);
   const stored=existing.some(e=>{
     const same=String(e.memberId)===String(row.memberId)&&Number(e.boss)===Number(row.bossId)&&Number(e.damage)===Number(row.damage);
     return same && (e.gameAt ? String(e.gameAt)===String(row.gameAt) : Number(e.day)===Number(row.day));
   });
   return {...row,duplicate:another||stored};
 });
}
export function sortBattleLogRows(rows){
 return [...rows].sort((a,b)=>String(a.gameAt||'9999').localeCompare(String(b.gameAt||'9999'))||Number(a.order||0)-Number(b.order||0));
}
export function validBattleLogRow(row,{monthKey='',members=[],bosses=[],day=1}={}){
 const reasons=[];
 if(!members.some(m=>m.id===row.memberId))reasons.push('클랜원 미확인');
 if(!bosses.some(b=>Number(b.id)===Number(row.bossId)))reasons.push('보스 미확인');
 if(!Number.isSafeInteger(Number(row.damage))||Number(row.damage)<=0)reasons.push('피해량 오류');
 if(!Number.isInteger(+day)||+day<1)reasons.push('일차 오류');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(row.gameAt)))reasons.push('공격 시각 미확인');
 else if(monthKey && !row.gameAt.startsWith(monthKey+'-'))reasons.push('현재 클전 월과 다른 날짜');
 if(row.duplicate)reasons.push('중복 후보');
 return reasons;
}
