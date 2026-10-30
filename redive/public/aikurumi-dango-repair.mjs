// Correct previously imported, unmodified YouTube TL rows from the
// matching source-linked dango snapshots. Never overwrite user edits.
import {previewAikurumiTactic} from './aikurumi-tactic-review.mjs?v=20261030-dango03';
import {commandState} from './tactic-set-state.mjs?v=20261030-set-sync02';

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
    if(!source?.rows?.length)continue;
    for(const existing of [...(season.tactics||[]),...(season.recommendations||[])]){
      const meta=existing.externalSource;
      if(!meta||String(meta.month)!==String(snapshot.krMonth)||Number(meta.taskId)!==Number(task.id)
        ||Number(meta.linkOrdinal)!==ordinal||!sameUrl(meta.url,link.link))continue;
      // A legacy import marked generated checkboxes as manual. Only the exact
      // previous generated content is safe to migrate automatically.
      const saved=existing.rows||[];
      // The collection job sometimes emitted an extra "[원문 확인: ver.]"
      // after a valid timeline. Only tolerate that exact generated suffix.
      const generated=source.rows;
      const missingArtifact=generated.length===saved.length+1&&/^\s*(?:ㄴ\s*)?\[원문 확인:\s*ver\.\s*\]$/i.test(generated.at(-1)?.text||'');
      const exactSource=saved.length===generated.length||missingArtifact;
      const originalMatch=exactSource&&saved.every((r,i)=>matchesOriginal(r,generated[i]));
      // Older (pre-fix) imports began with AUTO ON but omitted five SET flags.
      // Accept them only if every row still matches its own textual commands.
      const sameTimes=saved.length===preview.rows.length&&saved.every((row,i)=>{
       const clock=value=>String(value||'').match(/^\s*(\d{1,2}:[0-5]\d)\b/)?.[1]||'';
       return clock(row.text)===clock(preview.rows[i].text);
      });
      let previous=[false,false,false,false,false,false];
      const autoOnlyLegacy=!!sameTimes&&/^\s*AUTO\s*(?:ON|온)\s*$/i.test(saved[0]?.text||'')
       &&saved.every(row=>{
        const expected=commandState(row.text,previous,existing.party||preview.matchedKoreanNames||[]);
        const correct=identical(row.checked?.map(Boolean),expected);
        previous=expected;return correct;
       });
      if(!originalMatch&&!autoOnlyLegacy){skipped++;continue;}
      const corrected=preview.rows.map((row,i)=>({
       ...(saved[i]||{id:existing.id+'-dango-'+i}),
       text:row.text,checked:[...row.checked],manualChecks:false
      }));
      if(!identical(saved.map(r=>[r.text,r.checked]),corrected.map(r=>[r.text,r.checked]))){
       for(const row of corrected)delete row.runs;
       existing.rows=corrected;
       existing.text=corrected.map(r=>r.text).join('\n');
       repaired++;
      }
    }
   }
 }
 return {repaired,skipped};
}
