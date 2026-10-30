// Legacy recovery: restore YouTube-derived SET rows only when a previous
// dango fallback was copied verbatim. Never replace YouTube TL with Chinese TL.
import {previewAikurumiTactic} from './aikurumi-tactic-review.mjs?v=20261030-except01';

const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const identicalRows=(a,b)=>a?.length===b?.length&&a.every((r,i)=>
 r.text===b[i].text&&equal(r.checked?.map(Boolean),b[i].checked?.map(Boolean)));
const sameUrl=(a,b)=>{try{
 const u=new URL(a),v=new URL(b);
 return u.hostname===v.hostname&&u.searchParams.get('v')===v.searchParams.get('v');
}catch{return a===b;}};

export function repairImportedDangoTactics(seasons,snapshots,youtube){
 let repaired=0,skipped=0;
 if(!Array.isArray(youtube?.references)||Date.parse(youtube?.expiresAt)<=Date.now())
  return {repaired,skipped};
 for(const snapshot of snapshots||[]){
  const season=seasons?.[snapshot.krMonth];if(!season)continue;
  for(const boss of snapshot.bosses||[])for(const task of boss.tasks||[])
   for(const [ordinal,link] of (task.links||[]).entries()){
    if(!/(?:お団子|団子|ダンゴ|당고)\s*(?:ver\.?|版)?/iu.test(link.remarks||''))continue;
    // A video must contain an independently identified, completely parsed TL.
    // Missing, partial or ambiguous YouTube TL must be reviewed, not overwritten.
    const verified=youtube.references.find(r=>Number(r.stage)===Number(snapshot.stage)
      &&Number(r.boss)===Number(boss.index)&&Number(r.taskId)===Number(task.id)
      &&Number(r.linkOrdinal)===ordinal&&r.linkIndex===(link.index??ordinal)
      &&r.youtubeHasTactic===true&&r.status==='candidate'
      &&r.rows?.length>0&&r.rows.every(row=>!row.needsReview));
    if(!verified)continue;
    const chinese=previewAikurumiTactic(task,link,{
     unitMap:snapshot.characterData?.names,positionUnits:snapshot.characterData?.positionUnits,
     stage:snapshot.stage,bossSlot:boss.index,bossNames:snapshot.bosses.map(b=>b.unitName)
    });
    if(!chinese.preferredDango||!chinese.rows.length)continue;
    for(const existing of [...(season.tactics||[]),...(season.recommendations||[])]){
     const meta=existing.externalSource;
     if(meta?.source!=='youtube'||String(meta.month)!==String(snapshot.krMonth)
       ||Number(meta.taskId)!==Number(task.id)||Number(meta.linkOrdinal)!==ordinal
       ||!sameUrl(meta.url,link.link))continue;
     const old=existing.rows||[];
     // A manual edit or even a single changed checkbox prevents an overwrite.
     if(old.some(row=>row.manualChecks===true)||!identicalRows(old,chinese.rows)){
      skipped++;continue;
     }
     const next=verified.rows.map((row,i)=>({
      ...(old[i]||{id:existing.id+'-yt-'+i}),
      text:row.text,checked:[...row.checked],manualChecks:false
     }));
     if(!identicalRows(old,next)){
      for(const row of next)delete row.runs;
      existing.rows=next;existing.text=next.map(row=>row.text).join('\n');
      repaired++;
     }
    }
   }
 }
 return {repaired,skipped};
}
