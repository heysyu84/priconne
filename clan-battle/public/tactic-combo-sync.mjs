import { CARRY_GROUP, groupOf, titleFor } from './tactics-model.mjs?v=20261024-carry-tactics01';

// Full-battle stage-4 tactics are the source for the recommendation list.
// Keep stage-3 recommendations and historical records intact.
const normal=s=>String(s??'').normalize('NFKC').replace(/\s+/g,'').toLocaleLowerCase('ko-KR');
const typeOf=t=>/타비/.test(String(t.group||t.source||''))?'타비':'택틱';
const sameNumber=(a,b)=>Number(a)===Number(b)&&Number.isFinite(Number(a));
const tpOf=note=>String(note||'').match(/\bTP\s*[:：]?\s*(\d+(?:\.\d+)?\+?)/i)?.[1]||'';
export function stripTpFromMemo(note){
 const source=String(note||'');
 if(!tpOf(source))return source;
 return source
  .replace(/\bTP\s*[:：]?\s*\d+(?:\.\d+)?\+?(?:\s*이상\s*필수|\s*이상|\s*필수)?(?:\s*\([^)]{0,160}\))?(?:\s*는\s*되야\s*돌아갈\s*것\s*같음)?/gi,'')
  .replace(/([:：])\s*[,，;；]+\s*/g,'$1 ')
  .replace(/\s*([,，;；])\s*(?=[,，;；])/g,'')
  .replace(/^[\s,，;；·]+|[\s,，;；·]+$/g,'')
  .replace(/^\s*필수\s*[:：]\s*$/,'')
  .replace(/[ \t]{2,}/g,' ')
  .trim();
}
export function tacticReady(t){
 return !!(t&&groupOf(t)!==CARRY_GROUP&&!t.trashedAt&&t.id&&[1,2,3,4,5].includes(Number(t.boss))&&
  Array.isArray(t.characters)&&t.characters.length===5&&t.characters.every(x=>String(x||'').trim())&&
  new Set(t.characters.map(normal)).size===5&&Array.isArray(t.stars)&&t.stars.length===5&&
  t.stars.every(x=>/^[1-6]$/.test(String(x)))&&
  Array.isArray(t.rows)&&t.rows.some(row=>String(row.text||'').trim()));
}
const identity=t=>[Number(t.boss),...(Array.isArray(t.characters)?t.characters:[]).map(normal),...(Array.isArray(t.stars)?t.stars:[]).map(String)].join('|');
const sameSource=(combo,tactic)=>{
 const source=typeOf(tactic);
 return source===(/타비/.test(String(combo.tactic||''))?'타비':'택틱');
};
const fromTactic=t=>({
 stage:4,boss:Number(t.boss),characters:[...t.characters],stars:t.stars.map(String),
 expectedDamage:String(t.expectedDamage||''),tactic:typeOf(t),url:String(t.tacticUrl||t.video||''),
 video:String(t.video||''),tacticUrl:String(t.tacticUrl||''),
 manualCount:String(t.manualCount??''),tp:String(t.tp??''),
 note:String(t.note||''),sourceTacticId:String(t.id)
});
const sameRecord=(combo,t)=>Number(combo.stage)===4&&Number(combo.boss)===Number(t.boss)&&
 identity(combo)===identity(t)&&sameSource(combo,t)&&sameNumber(combo.expectedDamage,t.expectedDamage);

// Run exactly once per saved month. Move legacy TP text out of notes, and
// import recommendation-only hand-control / TP values before syncing canonical tactics.
export function migrateTacticConditions(month){
 if(!month||!Array.isArray(month.tactics)||Number(month.tacticConditionsVersion)>=1)return false;
 const recommendations=Array.isArray(month.recommendations)?month.recommendations:[];
 for(const tactic of month.tactics){
  const linked=recommendations.find(r=>String(r.sourceTacticId||'')===String(tactic.id));
  const exact=recommendations.filter(r=>(!r.sourceTacticId||String(r.sourceTacticId)===String(tactic.id))&&sameRecord(r,tactic));
  const possible=recommendations.filter(r=>(!r.sourceTacticId||String(r.sourceTacticId)===String(tactic.id))&&Number(r.stage)===4&&identity(r)===identity(tactic)&&sameSource(r,tactic));
  const source=linked||(exact.length===1?exact[0]:null)||(possible.length===1?possible[0]:null);
  if(tactic.manualCount===undefined||tactic.manualCount===null||tactic.manualCount===''){
   tactic.manualCount=source?.manualCount===undefined||source?.manualCount===null?'':String(source.manualCount);
  }
  if(tactic.tp===undefined||tactic.tp===null||tactic.tp===''){
   tactic.tp=String(source?.tp||tpOf(tactic.note)||'');
  }
  tactic.note=stripTpFromMemo(tactic.note);
 }
 // Legacy recommendation notes should also no longer show duplicated TP text.
 for(const record of recommendations){
  if((record.tp===undefined||record.tp===null||record.tp==='')&&tpOf(record.note))record.tp=tpOf(record.note);
  record.note=stripTpFromMemo(record.note);
 }
 month.tacticConditionsVersion=1;
 return true;
}
export function syncTacticRecommendations(month){
 if(!month||!Array.isArray(month.tactics))return false;
 const migrated=migrateTacticConditions(month);
 if(!Array.isArray(month.recommendations))month.recommendations=[];
 const hidden=new Set(Array.isArray(month.hiddenTacticRecommendationIds)?month.hiddenTacticRecommendationIds:[]);
 const rows=month.recommendations;
 const linked=new Set();
 let changed=migrated;
 for(const tactic of month.tactics){
  if(!tacticReady(tactic)||hidden.has(String(tactic.id)))continue;
  let current=rows.find(row=>String(row.sourceTacticId||'')===String(tactic.id));
  if(!current){
   current=rows.find(row=>!row.sourceTacticId&&!linked.has(String(row.id))&&sameRecord(row,tactic));
   if(!current){
    // If the expectation changed in the tactic editor, match one unambiguous
    // legacy record by boss + exact lineup + stars + tactic source.
    const alternatives=rows.filter(row=>!row.sourceTacticId&&!linked.has(String(row.id))&&
      Number(row.stage)===4&&identity(row)===identity(tactic)&&sameSource(row,tactic));
    if(alternatives.length===1)current=alternatives[0];
   }
   if(current){current.sourceTacticId=String(tactic.id);changed=true;}
  }
  const incoming=fromTactic(tactic);
  if(!current){
   rows.push({id:'tactic-combo-'+String(tactic.id),...incoming,tacticSourceUrl:incoming.url,
    requiredSeconds:null,remainingSeconds:null});
   changed=true;continue;
  }
  linked.add(String(current.id));
  // The tactic workspace is canonical for hand-controls and TP too.
  // Preserve recommendation-specific times and custom URLs; the memo mirrors its tactic.
  for(const field of ['stage','boss','characters','stars','expectedDamage','tactic','manualCount','tp']){
   const next=incoming[field];
   if(JSON.stringify(current[field])!==JSON.stringify(next)){current[field]=next;changed=true;}
  }
  // Only refresh source-linked URL when it has not been manually changed.
  const prior=current.tacticSourceUrl;
  // A previously curated link may intentionally differ from the tactic's video.
  const mayUpdate=prior!==undefined?current.url===prior:!current.url;
  if(mayUpdate&&current.url!==incoming.url){current.url=incoming.url;changed=true;}
  if(current.tacticSourceUrl!==incoming.url){current.tacticSourceUrl=incoming.url;changed=true;}
  // The linked tactic is canonical for the displayed memo. Reflect edits and clearing
  // immediately; retain a legacy recommendation-only memo for recovery.
  if(String(current.note??'')!==incoming.note){
   if(current.note&&!Object.prototype.hasOwnProperty.call(current,'legacyRecommendationNote'))
    current.legacyRecommendationNote=String(current.note);
   current.note=incoming.note;
   changed=true;
  }
 }
 // Do not leave orphaned automatically-linked records when source is deleted/incomplete.
 const active=new Set(month.tactics.filter(t=>tacticReady(t)&&!hidden.has(String(t.id))).map(t=>String(t.id)));
 for(let i=rows.length-1;i>=0;i--)if(rows[i].sourceTacticId&&!active.has(String(rows[i].sourceTacticId))){
  if(String(rows[i].id||'').startsWith('tactic-combo-'))rows.splice(i,1);
  else delete rows[i].sourceTacticId; // Preserve manually entered recommendation details.
  changed=true;
 }
 return changed;
}
export function suppressTacticRecommendation(month,record){
 if(!record?.sourceTacticId)return false;
 const key=String(record.sourceTacticId);
 month.hiddenTacticRecommendationIds??=[];
 if(!month.hiddenTacticRecommendationIds.includes(key))
  month.hiddenTacticRecommendationIds.push(key);
 return true;
}

// Render full-battle recommendations from the live tactic source, never from a
// potentially stale stored snapshot. Supplemental fields remain recommendation-only.
export function visibleTacticRecommendations(month){
 const stored=Array.isArray(month?.recommendations)?month.recommendations:[];
 const stage3=stored.filter(row=>Number(row.stage)!==4);
 const byTactic=new Map();
 for(const row of stored){
  if(Number(row.stage)!==4||!row.sourceTacticId)continue;
  const key=String(row.sourceTacticId);
  if(!byTactic.has(key))byTactic.set(key,row);
 }
 const suppressed=new Set((month?.hiddenTacticRecommendationIds||[]).map(String));
 const generated=(month?.tactics||[]).filter(t=>tacticReady(t)&&!t.hidden&&!suppressed.has(String(t.id))).map(t=>{
  const previous=byTactic.get(String(t.id));
  const fresh=fromTactic(t);
  const url=previous&&previous.tacticSourceUrl!==undefined&&previous.url!==previous.tacticSourceUrl
   ?previous.url:fresh.url;
  return {
   id:previous?.id||'tactic-combo-'+String(t.id),
   ...(previous||{}),
   ...fresh,
   url,requiredSeconds:previous?.requiredSeconds??null,remainingSeconds:previous?.remainingSeconds??null
  };
 });
 return [...stage3,...generated];
}

// Editing a source-linked recommendation must write to the canonical tactic;
// otherwise the next synchronization silently replaces the user's edits.
export function updateTacticFromRecommendation(month,sourceId,values){
 const tactic=(month?.tactics||[]).find(t=>String(t.id)===String(sourceId)&&!t.trashedAt);
 if(!tactic)throw Error('연결된 원본 택틱을 찾지 못했습니다. 택틱 작업실에서 확인해 주세요.');
 if(Number(values.stage)!==4)throw Error('연동된 추천 조합은 4단계로 유지됩니다. 3단계 조합은 별도로 등록해 주세요.');
 tactic.boss=Number(values.boss);
 tactic.characters=[...values.characters];
 tactic.stars=values.stars.map(String);
 tactic.expectedDamage=String(values.expectedDamage??'');
 tactic.manualCount=String(values.manualCount??'');
 tactic.tp=String(values.tp??'');
 tactic.note=String(values.note??'');
 tactic.tacticUrl=String(values.url??'');
 tactic.title=titleFor(tactic);
 const linked=(month.recommendations||[]).find(row=>String(row.sourceTacticId||'')===String(sourceId));
 if(linked){linked.url=tactic.tacticUrl;linked.tacticSourceUrl=tactic.tacticUrl;}
 syncTacticRecommendations(month);
 return tactic;
}

function comparableDamage(value) {
  const raw=String(value??'').replace(/[,\s]/g,'').replace(/억$/,'');
  if(!raw)return -Infinity;
  const number=Number(raw);
  return Number.isFinite(number)&&number>=0?number:-Infinity;
}
export function recommendationDisplayOrder(a,b){
  const bossOrder=Number(a.boss)-Number(b.boss);
  if(bossOrder)return bossOrder;
  if(Number(a.stage)===3&&Number(b.stage)===3){
    const carry=Number(b.remainingSeconds||0)-Number(a.remainingSeconds||0);
    if(carry)return carry;
  }else{
    const lhs=comparableDamage(a.expectedDamage),rhs=comparableDamage(b.expectedDamage);
    if(lhs!==rhs)return lhs<rhs?1:-1;
  }
  return String(a.id||'').localeCompare(String(b.id||''),'ko');
}
