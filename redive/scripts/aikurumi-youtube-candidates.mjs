// Server-side description -> scoped operational review rows, never full descriptions.
import {previewAikurumiTactic} from '../public/aikurumi-tactic-review.mjs';
import {youtubeVideoId,inspectYouTubeDescription} from './aikurumi-youtube-api.mjs';
import {extractTacticConditions} from '../public/aikurumi-review-model.mjs';
import {splitVideoDescription,matchedYouTubeSegment} from './aikurumi-youtube-segments.mjs';
import {normalizeYouTubeTimeline,translateYouTubeRow} from './aikurumi-youtube-timeline.mjs';
export {splitVideoDescription} from './aikurumi-youtube-segments.mjs';

export function createYouTubeTacticCandidates(snapshots,found,{fetchedAt=new Date().toISOString()}={}){
 const refs=[];
 for(const snap of snapshots)for(const boss of snap.bosses||[])for(const task of boss.tasks||[])
   for(const [ordinal,link] of (task.links||[]).entries()){
     const videoId=youtubeVideoId(link.link);
     if(!videoId)continue;
     refs.push({videoId,stage:Number(snap.stage),jpMonth:String(snap.jpMonth),
       boss:Number(boss.index),task,link,ordinal,snapshot:snap,bossNames:snap.bosses.map(b=>b.unitName)});
   }
 const videoMap=new Map((found?.videos||[]).map(v=>[v.videoId,v]));
 const references=refs.map(ref=>{
  const video=videoMap.get(ref.videoId),all=refs.filter(x=>x.videoId===ref.videoId);
  function extract(description,tacticLocation='description',commentId=null){
  const base={stage:ref.stage,boss:ref.boss,taskId:ref.task.id,
    linkIndex:ref.link.index??ref.ordinal,linkOrdinal:ref.ordinal,videoId:ref.videoId,
    status:'needs-source-check',matching:'',rowCount:0,issues:[],warnings:[],rows:[],
    sourceUrl:String(ref.link.link||''),youtubeHasTactic:null,tacticLocation,...(commentId?{commentId}:{})};
  if(!description)return {...base,status:video?'empty-description':'video-unavailable',
    matching:'no-description',youtubeHasTactic:video?false:null};
  const inspection=inspectYouTubeDescription(description);
  // Stage 3 is often just "全SET", without two timestamped action lines.
  // That is still a tactic: prefer YouTube and request human verification
  // rather than silently replacing it with Aikurumi's Chinese translation.
  const explicitSetup=/^\s*(?:[【\[（(★☆◆■●]+\s*)?(?:(?:初動|開幕|开始|开局)\s*[:：]?\s*)?(?:(?:全キャラ|全員|全体|全|すべて|全部)\s*(?:SET|セット|セト)|(?:AUTO|オート)\s*(?:ON|OFF|オン|オフ)|[OX〇○◯●⭕❌✕×✖✗ー－—-]{5})/imu
    .test(description);
  const japaneseTactic=inspection.mayContainTactic||explicitSetup;
  if(!japaneseTactic)return {...base,status:/(?:タイムライン|\bTL\b)/i.test(description)?'video-timeline-only':'no-youtube-tl',youtubeHasTactic:/(?:タイムライン|\bTL\b)/i.test(description),
    matching:'no-description-timeline'};
  base.youtubeHasTactic=true; // priority remains YouTube even when segmentation is ambiguous
  const segments=splitVideoDescription(description,ref.bossNames);
  const matched=matchedYouTubeSegment(segments,ref,all);
  if(!matched.segment)return {...base,matching:matched.match,diagnostics:{...matched.diagnostics,
   sections:segments.slice(0,30).map(s=>({boss:s.boss,header:String(s.header||'').slice(0,160),startSeconds:s.startSeconds,
    clockLines:inspectYouTubeDescription(s.text).candidateClockLines}))}};
  // A section that contains multiple unrelated time-lines is not safe to bind.
  const text=normalizeYouTubeTimeline(matched.segment.text,ref);
  if(text.length>14000||text.split('\n').length>200)
    return {...base,matching:'section-too-long'};
  const candidate=previewAikurumiTactic(ref.task,
    {...ref.link,remarks:text},{unitMap:ref.snapshot.characterData?.names,
      positionUnits:ref.snapshot.characterData?.positionUnits,
      stage:ref.stage,bossSlot:ref.boss,bossNames:ref.bossNames});
  const conditions=extractTacticConditions({...ref.task,remarks:'',exRemarks:''},{...ref.link,name:'',remarks:text},candidate);
  base.conditions={tp:conditions.tp,fields:conditions.fields.filter(f=>
    !/[\u3040-\u30ff\u3400-\u9fff]/u.test(f.value))};
  if(!candidate.rows.length)return {...base,matching:matched.match,status:/(?:タイムライン|\bTL\b)/i.test(description)?'video-timeline-only':'no-youtube-tl',youtubeHasTactic:/(?:タイムライン|\bTL\b)/i.test(description),
    diagnostics:{header:String(matched.segment.header||'').slice(0,160),lineCount:text.split('\n').length,
     instructionLines:text.split('\n').filter(s=>/(?:全|SET|AUTO|タイムライン|TL)/i.test(s)).map(s=>s.slice(0,180)).slice(0,12)},
    issues:candidate.issues.map(x=>x.code).slice(0,12)};
  // Keep every parsed operational row. Unresolved words/conditions stay marked
  // for review; throwing away the entire row loses required battle actions.
  const rows=candidate.rows.map(translateYouTubeRow);
  if(rows.length>250||rows.some(r=>r.text.length>2000))return {...base,matching:matched.match,
    status:'needs-source-check',issues:['timeline-too-long'],rowCount:rows.length};
  const unresolvedRows=rows.filter(r=>r.needsReview).length;
  const issues=candidate.issues.map(x=>x.code).slice(0,12);
  if(unresolvedRows)issues.push('translation-incomplete');
  return {...base,status:unresolvedRows||issues.length?'partial':'candidate',matching:matched.match,
    rowCount:rows.length,omittedRows:0,unresolvedRows,translatedRows:rows.length-unresolvedRows,
    issues:[...new Set(issues)],warningCount:candidate.warnings.length,
    unknownActorCount:candidate.unmappedActors.length,rows};
  }
  const results=[extract(video?.description),...(video?.authorTimelines||[]).map(c=>extract(c.text,'author-comment',c.id))];
  const quality=r=>(r.rows.length?1000:0)+(r.youtubeHasTactic===true?50:0)+(r.translatedRows||0)*2-(r.unresolvedRows||0)+(r.status==='candidate'?100:0)+(r.tacticLocation==='description'?1:0);
  results.sort((a,b)=>quality(b)-quality(a));const chosen=results[0];
  if(chosen.youtubeHasTactic===false&&['failed','limited','no-author-id'].includes(video?.commentsStatus))return {...chosen,status:'needs-source-check',youtubeHasTactic:null,issues:['comments-unavailable'],commentReadStatus:video.commentsStatus};
  return {...chosen,commentReadStatus:video?.commentsStatus||'not-requested'};
 });
 const statuses={};
 for(const item of references)statuses[item.status]=(statuses[item.status]||0)+1;
 const expiresAt=new Date(Date.parse(fetchedAt)+28*24*60*60*1000).toISOString();
 return {schema:'nyang-youtube-tactic-candidates-v1',extractionVersion:'20261030-tl04',source:'YouTube Data API v3',
   readOnly:true,registrationAllowed:false,fetchedAt,expiresAt,
   videoCount:videoMap.size,requestedVideoCount:found?.requested??new Set(refs.map(r=>r.videoId)).size,
   missingVideoCount:found?.missing?.length??0,totalReferences:references.length,statuses,references};
}
