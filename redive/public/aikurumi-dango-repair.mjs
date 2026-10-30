// Correct previously imported, unmodified YouTube TL rows from the
// matching source-linked dango snapshots. Never overwrite user edits.
import {previewAikurumiTactic} from './aikurumi-tactic-review.mjs?v=20261030-dango03';

const identical=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const matchesOriginal=(saved,source)=>saved?.text===source?.text
 &&Array.isArray(saved?.checked)&&identical(saved.checked.map(Boolean),source?.checked?.map(Boolean));
const sameUrl=(a,b)=>{try{return new URL(a).searchParams.get('v')===new URL(b).searchParams.get('v')&&new URL(a).hostname===new URL(b).hostname;}catch{return a===b;}};

export function repairImportedDangoTactics(seasons,snapshots,youtube){
 const candidates=youtube?.references||[];
 let repaired=0,skipped=0;
 for(const snapshot of snapshots||[]){
  const season=seasons?.[snapshot.krMonth];if(!season)continue;
  for(const boss of snapshot.bosses||[])for(const task of boss.tasks||[])
   for(const [ordinal,link] of (task.links||[]).entries()){
    if(!/(?:お団子|団子|ダンゴ|당고)\s*(?:ver\.?|版)?/iu.test(link.remarks||''))continue;
    const preview=previewAikurumiTactic(task,link,{unitMap:snapshot.characterData?.names,
      positionUnits:snapshot.characterData?.positionUnits,stage:snapshot.stage,bossSlot:boss.index,
      bossNames:snapshot.bosses.map(b=>b.unitName)});
    if(!preview.preferredDango||!preview.rows.length)continue;
    const source=candidates.find(r=>Number(r.stage)===Number(snapshot.stage)&&Number(r.boss)===Number(boss.index)
      &&Number(r.taskId)===Number(task.id)&&Number(r.linkOrdinal)===ordinal
      &&r.linkIndex===(link.index??ordinal));
    if(!source?.rows?.length||source.rows.length!==preview.rows.length)continue;
    for(const existing of [...(season.tactics||[]),...(season.recommendations||[])]){
      const meta=existing.externalSource;
      if(!meta||String(meta.month)!==String(snapshot.krMonth)||Number(meta.taskId)!==Number(task.id)
        ||Number(meta.linkOrdinal)!==ordinal||!sameUrl(meta.url,link.link))continue;
      // A legacy import marked generated checkboxes as manual. Only the exact
      // previous generated content is safe to migrate automatically.
      const saved=existing.rows||[];
      if(saved.length!==source.rows.length||!saved.every((r,i)=>matchesOriginal(r,source.rows[i]))){skipped++;continue;}
      let changed=false;
      for(let i=0;i<saved.length;i++){
       const expected=preview.rows[i];
       if(!identical(saved[i].checked,expected.checked)||saved[i].text!==expected.text){
        saved[i].text=expected.text;saved[i].checked=[...expected.checked];
        saved[i].manualChecks=false;delete saved[i].runs;changed=true;
       }
      }
      if(changed){existing.text=saved.map(r=>r.text).join('\n');repaired++;}
    }
   }
 }
 return {repaired,skipped};
}
