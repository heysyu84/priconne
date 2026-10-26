import {cleanOcrName,memberCandidates} from './battle-image-parser.mjs';

const nicknameKey=value=>String(value??'').normalize('NFKC').replace(/[\s_()[\]·.\-]/g,'').toLowerCase();
export function reliableOcrNickname(value){
 const name=cleanOcrName(value);
 if(!name||name.length>20||/[\r\n]/.test(name)||/\d{4,}/.test(name))return false;
 const letters=(name.match(/\p{L}/gu)||[]).length;
 const symbols=(name.match(/[^\p{L}\p{N}\s]/gu)||[]).length;
 return letters>=2&&letters/name.length>=.6&&symbols<=1&&!/(?:데미지|대미지|피해량|전투로그|단계째|입힌|실전|일시)/.test(name);
}

// A unique, explicitly registered name wins over a confident OCR hallucination.
// Unknown names need agreement; they must never fall back to substring matching.
export function selectNicknameReading(readings,roster=[]){
 const candidates=memberCandidates(roster),cleaned=readings.map(read=>({...read,text:cleanOcrName(read.text)})).filter(read=>read.text);
 const known=cleaned.flatMap(read=>{
  const matches=candidates.filter(candidate=>candidate.key===nicknameKey(read.text));
  const ids=new Set(matches.map(candidate=>candidate.id));
  const short=(read.text.match(/\p{L}/gu)||[]).length<2;
  const repeated=cleaned.filter(other=>nicknameKey(other.text)===nicknameKey(read.text)).length>=2;
  return ids.size===1&&(!short||repeated)?[{...read,memberId:matches[0].id}]:[];
 });
 const ids=new Set(known.map(read=>read.memberId));
 if(ids.size===1)return {...known.sort((a,b)=>(b.confidence||0)-(a.confidence||0))[0],registered:true};
 if(ids.size>1)return null;
 const plausible=cleaned.filter(read=>reliableOcrNickname(read.text));
 const repeated=plausible.filter(read=>plausible.filter(other=>nicknameKey(other.text)===nicknameKey(read.text)).length>=2);
 return repeated.sort((a,b)=>(b.confidence||0)-(a.confidence||0)).find(read=>Number(read.confidence)>=40)||null;
}

export function damageFromLabel(text){
 const value=String(text??'').normalize('NFKC').trim();
 if(!/^[0-9][0-9, .\u00a0]*$/.test(value))return null;
 const digits=value.replace(/[, .\u00a0]/g,'');
 if(!/^(?:0|[1-9]\d{0,11})$/.test(digits))return null;
 const number=Number(digits);
 return Number.isSafeInteger(number)&&number>0?number:null;
}

export function selectDamageReading(readings){
 const evidence=readings.map(read=>({...read,value:damageFromLabel(read.text)})).filter(read=>read.value!==null);
 const votes=new Map();
 for(const read of evidence)votes.set(read.value,(votes.get(read.value)||0)+1);
 const ranked=[...votes].sort((a,b)=>b[1]-a[1]);
 const damage=ranked[0]?.[0]??'';
 return {damage,review:!!damage&&(ranked[0][1]<2||ranked.length>1),candidates:ranked.map(([value])=>value),
  details:readings.map(read=>(read.source||'숫자 영역')+': '+(read.text||'미인식')).join(' / ')};
}
