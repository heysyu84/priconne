// Field-scoped changes explicitly requested for the retained shared records.
export function applyRecordUpdates(previous,initial){
 const document=structuredClone(previous);
 for(const update of initial.recordUpdates||[]){
  const source=initial.seasons[update.month]?.tactics.find(t=>t.id===update.id);
  const target=document.seasons[update.month]?.tactics.find(t=>t.id===update.id);
  if(!source||!target)continue;
  for(const field of update.fields)if(['stars','rows','text'].includes(field))target[field]=structuredClone(source[field]);
 }
 for(const season of Object.values(document.seasons))for(const tactic of season.tactics){
  if(tactic.category!=='carry')continue;
  const match=String(tactic.note||'').match(/(?:필요\s*)?이월\s*시간\s*[:：]?\s*(\d+)\s*초/);
  if(!(Number(tactic.requiredCarrySeconds)>0)&&match)tactic.requiredCarrySeconds=Number(match[1]);
  tactic.note=String(tactic.note||'').replace(/(?:필요\s*)?이월\s*(?:시간)?\s*[:：]?\s*(?:\d+\s*분\s*)?\d+\s*초\s*(?:기준|필요)?/g,'').replace(/^[\s·|,;]+|[\s·|,;]+$/g,'').replace(/\s*·\s*·\s*/g,' · ').trim();
 }
 return document;
}
