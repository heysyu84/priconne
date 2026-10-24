// 해외 택틱 변환기 -> 택틱 작업실 클립보드 전송 규격.
// 6개 SET/AUTO 체크 + 본문 형식은 유지하며, 실명·슬롯 기반 편성을 모두 지원.
export const TACTIC_TRANSFER_PREFIX='#NYANG_TACTIC_V1\t';
const clean=value=>String(value??'').trim();
export const slotTacticLineup=lineup=>Array.isArray(lineup)&&lineup.length===5
  &&lineup.every((name,i)=>new RegExp('^캐릭터\\s*'+(i+1)+'$').test(clean(name)));
export const validTacticLineup=lineup=>Array.isArray(lineup)&&lineup.length===5
  &&lineup.every(name=>name===clean(name)&&name.length>0&&name.length<=60&&!/[\t\r\n]/.test(name)&&!/^캐릭터\s*[1-5]$/.test(name))
  &&new Set(lineup.map(name=>name.normalize('NFKC').replace(/\s+/g,'').toLowerCase())).size===5;
export const hasTacticSlots=text=>/캐릭터\s*[1-5](?!\d)/.test(String(text??''));
export function resolveTacticSlots(text,lineup){
 if(!validTacticLineup(lineup))throw Error('택틱 작업실에서 캐릭터 5명을 먼저 편성해 주세요.');
 return String(text).replace(/캐릭터\s*([1-5])(?!\d)/g,(_,slot)=>lineup[Number(slot)-1]);
}
function carryMetadata(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||input.kind!=='carry-sheet'||input.group!=='이월 택틱')throw Error('이월 시트 정보 형식이 올바르지 않습니다.');
 if(!Number.isInteger(input.boss)||input.boss<1||input.boss>5)throw Error('이월 택틱 보스를 확인하세요.');
 if(!Array.isArray(input.stars)||input.stars.length!==5||input.stars.some(v=>!/^([1-6])?$/.test(String(v))))throw Error('이월 택틱 성급을 확인하세요.');
 const expectedDamage=clean(input.expectedDamage);
 if(!/^\d{1,5}\.\d{2}$/.test(expectedDamage))throw Error('기대딜을 억 단위 소수점 두 자리로 입력하세요.');
 const tp=clean(input.tp),manualCount=clean(input.manualCount),note=clean(input.note),video=clean(input.video);
 if(tp.length>180||/[\t\r\n]/.test(tp)||note.length>12000)throw Error('TP 조건 또는 메모가 너무 깁니다.');
 if(manualCount&&!/^(?:\d{1,3})(?:\.5|\.0)?$/.test(manualCount))throw Error('손컨 횟수를 확인하세요.');
 if(video.length>2000)throw Error('영상 주소가 너무 깁니다.');
 if(video){let u;try{u=new URL(video);}catch{throw Error('영상 주소를 확인하세요.');}if(!['https:','http:'].includes(u.protocol))throw Error('영상 주소를 확인하세요.');}
 return {kind:'carry-sheet',group:'이월 택틱',boss:input.boss,stars:input.stars.map(String),expectedDamage,tp,manualCount,note,video};
}
export function serializeTacticTransfer(lineup, body, metadata=null){
 const slots=slotTacticLineup(lineup);
 if(!slots&&!validTacticLineup(lineup))throw Error('실제 캐릭터 5명이나 순서대로 된 캐릭터 1~5를 지정해 주세요.');
 if(!clean(body))throw Error('변환 결과가 비어 있습니다.');
 if(metadata&&slots)throw Error('이월 시트는 실제 캐릭터 이름으로 복사해 주세요.');
 const payload=slots?
   {mode:'slots',characters:Array.from({length:5},(_,i)=>'캐릭터 '+(i+1))}:
   {characters:lineup};
 if(metadata)payload.metadata=carryMetadata(metadata);
 return TACTIC_TRANSFER_PREFIX+JSON.stringify(payload)+'\n'+body;
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
 const result={mode:slots?'slots':'named',characters:[...payload.characters],text};
 if(payload.metadata!==undefined){if(slots)throw Error('이월 시트는 실제 캐릭터 이름이 필요합니다.');result.metadata=carryMetadata(payload.metadata);}
 return result;
}
