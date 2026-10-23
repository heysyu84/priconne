// Stage-4 tactics are the canonical source for the stage-4 recommendation list.
// Keep stage-3 recommendations and manual-only fields intact.
const normal=s=>String(s??'').normalize('NFKC').replace(/\s+/g,'').toLocaleLowerCase('ko-KR');
const typeOf=t=>/타비/.test(String(t.group||t.source||''))?'타비':'택틱';
const sameNumber=(a,b)=>Number(a)===Number(b)&&Number.isFinite(Number(a));
const tpOf=note=>String(note||'').match(/(?:^|[\s,])TP\s*[:：]?\s*(\d+(?:\.\d+)?\+?)/i)?.[1]||'';
const extraNote=note=>String(note||'').replace(/(?:^|[\s,])TP\s*[:：]?\s*\d+(?:\.\d+)?\+?/ig,'').replace(/^[\s,·]+|[\s,·]+$/g,'');
export function tacticReady(t){
 return !!(t&&!t.trashedAt&&t.id&&[1,2,3,4,5].includes(Number(t.boss))&&
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
 video:String(t.video||''),tacticUrl:String(t.tacticUrl||''),tp:tpOf(t.note),
 note:extraNote(t.note),sourceTacticId:String(t.id)
});
const sameRecord=(combo,t)=>Number(combo.stage)===4&&Number(combo.boss)===Number(t.boss)&&
 identity(combo)===identity(t)&&sameSource(combo,t)&&sameNumber(combo.expectedDamage,t.expectedDamage);
export function syncTacticRecommendations(month){
 if(!month||!Array.isArray(month.tactics))return false;
 if(!Array.isArray(month.recommendations))month.recommendations=[];
 const hidden=new Set(Array.isArray(month.hiddenTacticRecommendationIds)?month.hiddenTacticRecommendationIds:[]);
 const rows=month.recommendations;
 const linked=new Set();
 let changed=false;
 for(const tactic of month.tactics){
  if(!tacticReady(tactic)||hidden.has(String(tactic.id)))continue;
  let current=rows.find(row=>String(row.sourceTacticId||'')===String(tactic.id));
  if(!current){
   current=rows.find(row=>!row.sourceTacticId&&!linked.has(String(row.id))&&sameRecord(row,tactic));
   if(current){current.sourceTacticId=String(tactic.id);changed=true;}
  }
  const incoming=fromTactic(tactic);
  if(!current){
   rows.push({id:'tactic-combo-'+String(tactic.id),...incoming,tacticSourceUrl:incoming.url,manualCount:null,
    requiredSeconds:null,remainingSeconds:null});
   changed=true;continue;
  }
  linked.add(String(current.id));
  // Do not overwrite manually curated recommendation-specific fields:
  // TP, hand-controls, required/remaining seconds, commentary, custom URLs.
  for(const field of ['stage','boss','characters','stars','expectedDamage','tactic']){
   const next=incoming[field];
   if(JSON.stringify(current[field])!==JSON.stringify(next)){current[field]=next;changed=true;}
  }
  // Only refresh source-linked URL when it has not been manually changed.
  const prior=current.tacticSourceUrl;
  // A previously curated link may intentionally differ from the tactic's video.
  const mayUpdate=prior!==undefined?current.url===prior:!current.url;
  if(mayUpdate&&current.url!==incoming.url){current.url=incoming.url;changed=true;}
  if(current.tacticSourceUrl!==incoming.url){current.tacticSourceUrl=incoming.url;changed=true;}
  // New records with no curated TP/notes take defaults from the tactic.
  if((current.tp===undefined||current.tp===null||current.tp==='')&&incoming.tp){current.tp=incoming.tp;changed=true;}
  if((current.note===undefined||current.note===null||current.note==='')&&incoming.note){current.note=incoming.note;changed=true;}
 }
 // Do not leave orphaned automatically-linked records when source is deleted/incomplete.
 const active=new Set(month.tactics.filter(t=>tacticReady(t)&&!hidden.has(String(t.id))).map(t=>String(t.id)));
 for(let i=rows.length-1;i>=0;i--)if(rows[i].sourceTacticId&&!active.has(String(rows[i].sourceTacticId))){
  rows.splice(i,1);changed=true;
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

// Recommended stage-4 listings are a view of the real tactic workspace, not
// an accumulation of legacy sheet imports and generated recommendation copies.
// Keep old unmatched records in storage for recovery; never expose them as extra tactics.
export function visibleTacticRecommendations(month){
 const active=new Set((month?.tactics||[]).filter(tacticReady)
  .filter(t=>!(month.hiddenTacticRecommendationIds||[]).includes(String(t.id)))
  .map(t=>String(t.id)));
 const seen=new Set();
 return (month?.recommendations||[]).filter(row=>{
  if(Number(row.stage)!==4)return true;
  const id=String(row.sourceTacticId||'');
  if(!id||!active.has(id)||seen.has(id))return false;
  seen.add(id);return true;
 });
}
