// 택틱 변환기 -> 택틱 작업실 클립보드 전송 규격.
// 기존 6개 체크박스 + 본문 붙여넣기 형식은 그대로 유지합니다.
export const TACTIC_TRANSFER_PREFIX='#NYANG_TACTIC_V1\t';
const clean=value=>String(value??'').trim();
export const slotTacticLineup=lineup=>Array.isArray(lineup)&&lineup.length===5
  &&lineup.every((name,i)=>new RegExp('^캐릭터\\s*'+(i+1)+'
export function serializeTacticTransfer(lineup, body){
 const slots=slotTacticLineup(lineup);
 if(!slots&&!validTacticLineup(lineup))throw Error('실제 캐릭터 5명이나 순서대로 된 캐릭터 1~5를 지정해 주세요.');
 if(!clean(body))throw Error('변환 결과가 비어 있습니다.');
 return TACTIC_TRANSFER_PREFIX+JSON.stringify(slots?
   {mode:'slots',characters:Array.from({length:5},(_,i)=>'캐릭터 '+(i+1))}:
   {characters:lineup})+'\n'+body;
}
export function parseTacticTransfer(input){
 const normalized=String(input??'').replace(/\r\n?/g,'\n');
 if(!normalized.startsWith('#NYANG_TACTIC_V1'))return null;
 const newline=normalized.indexOf('\n');
 if(newline<0||!normalized.startsWith(TACTIC_TRANSFER_PREFIX))throw Error('택틱 편성 정보 형식이 올바르지 않습니다.');
 let payload;
 try{payload=JSON.parse(normalized.slice(TACTIC_TRANSFER_PREFIX.length,newline));}
 catch{throw Error('택틱 편성 정보를 읽을 수 없습니다.');}
 const slots=payload?.mode==='slots'&&slotTacticLineup(payload.characters);
 if(!slots&&!validTacticLineup(payload?.characters))throw Error('택틱 편성 정보의 캐릭터 이름과 순서를 확인하세요.');
 const text=normalized.slice(newline+1);
 if(!clean(text))throw Error('붙여넣을 택틱 내용이 비어 있습니다.');
 return {mode:slots?'slots':'named',characters:[...payload.characters],text};
}
).test(clean(name)));
export const validTacticLineup=lineup=>Array.isArray(lineup)&&lineup.length===5
  &&lineup.every(name=>name===clean(name)&&name.length>0&&name.length<=60&&!/[\t\r\n]/.test(name)&&!/^캐릭터\s*[1-5]$/.test(name))
  &&new Set(lineup.map(name=>name.normalize('NFKC').replace(/\s+/g,'').toLowerCase())).size===5;
export const hasTacticSlots=text=>/캐릭터\\s*[1-5](?!\\d)/.test(String(text??''));
export function resolveTacticSlots(text,lineup){
 if(!validTacticLineup(lineup))throw Error('택틱 작업실에서 캐릭터 5명을 먼저 편성해 주세요.');
 return String(text).replace(/캐릭터\\s*([1-5])(?!\\d)/g,(_,slot)=>lineup[Number(slot)-1]);
}
export function serializeTacticTransfer(lineup, body){
 if(!validTacticLineup(lineup))throw Error('캐릭터 5명의 이름과 정확한 편성 순서를 지정해 주세요.');
 if(!clean(body))throw Error('변환 결과가 비어 있습니다.');
 return TACTIC_TRANSFER_PREFIX+JSON.stringify({characters:lineup})+'\n'+body;
}
export function parseTacticTransfer(input){
 const normalized=String(input??'').replace(/\r\n?/g,'\n');
 if(!normalized.startsWith('#NYANG_TACTIC_V1'))return null;
 const newline=normalized.indexOf('\n');
 if(newline<0||!normalized.startsWith(TACTIC_TRANSFER_PREFIX))throw Error('택틱 편성 정보 형식이 올바르지 않습니다.');
 let payload;
 try{payload=JSON.parse(normalized.slice(TACTIC_TRANSFER_PREFIX.length,newline));}
 catch{throw Error('택틱 편성 정보를 읽을 수 없습니다.');}
 if(!validTacticLineup(payload?.characters))throw Error('택틱 편성에 캐릭터 5명의 올바른 이름이 필요합니다.');
 const text=normalized.slice(newline+1);
 if(!clean(text))throw Error('붙여넣을 택틱 내용이 비어 있습니다.');
 return {characters:[...payload.characters],text};
}
