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
 const matched=items.filter(x=>x.key&&key(text).includes(x.key)).sort((a,b)=>b.key.length-a.key.length);
 if(!matched.length)return null;
 const distinct=[...new Set(matched.map(x=>x.id))];
 // Two independently named members/bosses within one row is ambiguous.
 return distinct.length===1?matched[0]:null;
}
export function memberCandidates(roster=[]){
 return roster.flatMap(person=>[person.name,...(person.aliases||[])].filter(Boolean)
   .map(name=>({id:person.id,name:person.name,alias:name,key:key(name)})));
}
export function bossCandidates(bosses=[]){
 return bosses.flatMap(boss=>[boss.name,String(boss.id)+'넴',String(boss.id)+'번째'].filter(Boolean)
   .map(name=>({id:Number(boss.id),name:boss.name,alias:name,key:key(name)})));
}
export function parseBattleLogText(input,{roster=[],bosses=[],mode='detail',source=''}={}){
 const text=clean(input);
 if(!text)return null;
 const lines=String(input).split(/\n+/).map(clean).filter(Boolean);
 const detectedMember=bestMatch(text,memberCandidates(roster));
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
