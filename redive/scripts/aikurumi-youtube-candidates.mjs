// Server-side, ephemeral YouTube description -> Korean tactic review candidates.
// Only DERIVED Korean operation rows and source identifiers may be exported.
// Never serialize YouTube's original description or Japanese source lines to public assets.
import {previewAikurumiTactic} from '../public/aikurumi-tactic-review.mjs';
import {youtubeVideoId} from './aikurumi-youtube-api.mjs';

function bossHeader(text,bossNames){
 const line=String(text).trim().slice(0,130);
 let m=line.match(/^(?:[【[(（#★☆◆■●\s]*)(?:第\s*)?([1-5])\s*(?:ボス|ネームド|ネム|体目|番目|넴|번\s*보스|BOSS\b|Boss\b)/iu);
 if(m)return Number(m[1]);
 m=line.match(/^(?:[【[(（#★☆◆■●\s]*)BOSS\s*([1-5])\b/iu);
 if(m)return Number(m[1]);
 const found=(bossNames||[]).map((n,i)=>n&&line.includes(n)?i+1:0).filter(Boolean);
 return found.length===1&&line.length<=75?found[0]:null;
}
export function splitVideoDescription(description,bossNames){
 const lines=String(description??'').replace(/\r\n?/g,'\n').split('\n');
 const starts=[];
 lines.forEach((line,index)=>{const boss=bossHeader(line,bossNames);if(boss)starts.push({boss,start:index,header:line.trim()});});
 if(!starts.length)return [{boss:null,header:null,text:lines.join('\n').slice(0,18000)}];
 const parts=[];
 for(let i=0;i<starts.length;i++){
  const p=starts[i],end=starts[i+1]?.start??lines.length;
  parts.push({boss:p.boss,header:p.header,text:lines.slice(p.start,end).join('\n').slice(0,18000)});
 }
 return parts;
}
const titleDamage=name=>{
 const first=String(name??'').split('\n')[0];
 const values=[...first.matchAll(/(?:^|[^\d])(\d{4,6})(?=$|[^\d])/gu)].map(x=>x[1]);
 return values.length===1?values[0]:null;
};
function hasToken(text,token){
 return token&&new RegExp('(^|[^0-9])'+token+'(?=$|[^0-9])','m').test(text);
}
function matchedSegment(sections,ref,videoRefs){
 if(sections.length===1&&sections[0].boss===null){
  const timelineStarts=[...sections[0].text.matchAll(/^\s*1:30(?:\s|$)/gm)].length;
  return videoRefs.length===1&&timelineStarts<=1
    ?{segment:sections[0],match:'single-video'}:
    {segment:null,match:videoRefs.length>1?'shared-video-without-sections':'multiple-timelines-without-sections'};
 }
 const matching=sections.filter(s=>s.boss===ref.boss);
 if(!matching.length)return {segment:null,match:'boss-section-not-found'};
 const perBoss=videoRefs.filter(x=>x.boss===ref.boss&&x.stage===ref.stage);
 if(matching.length===1&&perBoss.length===1)return {segment:matching[0],match:'unique-boss'};
 // Each identical source link can be tagged with a number from the first title
 // line, but a segment must contain EXACTLY ONE distinct referenced damage ID.
 const damage=titleDamage(ref.link.name);
 if(!damage)return {segment:null,match:'multiple-options-no-damage-marker'};
 const candidate=matching.filter(s=>hasToken(s.text,damage));
 if(candidate.length!==1)return {segment:null,match:'no-unique-damage-section'};
 const other=perBoss.filter(x=>x!==ref&&titleDamage(x.link.name)!==damage);
 if(other.some(otherRef=>hasToken(candidate[0].text,titleDamage(otherRef.link.name))))
  return {segment:null,match:'section-contains-multiple-damage-codes'};
 if(perBoss.some(x=>x!==ref&&titleDamage(x.link.name)===damage))
  return {segment:null,match:'same-damage-multiple-options'};
 return {segment:candidate[0],match:'unique-damage-section'};
}
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
  const base={stage:ref.stage,boss:ref.boss,taskId:ref.task.id,
    linkIndex:ref.link.index??ref.ordinal,linkOrdinal:ref.ordinal,videoId:ref.videoId,
    status:'needs-source-check',matching:'',rowCount:0,issues:[],warnings:[],rows:[],
    sourceUrl:String(ref.link.link||'')};
  if(!video?.description)return {...base,status:video?'empty-description':'video-unavailable',matching:'no-description'};
  const segments=splitVideoDescription(video.description,ref.bossNames);
  const matched=matchedSegment(segments,ref,all);
  if(!matched.segment)return {...base,matching:matched.match};
  // A section that contains multiple unrelated time-lines is not safe to bind.
  const text=matched.segment.text;
  if(text.length>14000||text.split('\n').length>200)
    return {...base,matching:'section-too-long'};
  const candidate=previewAikurumiTactic(ref.task,
    {...ref.link,remarks:text},{unitMap:ref.snapshot.characterData?.names,
      positionUnits:ref.snapshot.characterData?.positionUnits,
      stage:ref.stage,bossSlot:ref.boss,bossNames:ref.bossNames});
  if(!candidate.rows.length)return {...base,matching:matched.match,status:'no-parsable-timeline',
    issues:candidate.issues.map(x=>x.code).slice(0,12)};
  // The parser can emit raw source for unknown actors. NEVER publish those
  // verbatim in the review site's JSON: preserve only already-converted Korean
  // action lines, and flag the omitted lines explicitly for manual verification.
  const safeRows=candidate.rows.filter(row=>{
    const text=String(row.text||'');
    if(/[\u3040-\u30ff\u3400-\u9fff]/u.test(text)||/\[원문 확인:/u.test(text))return false;
    const m=String(row.time||'').match(/^(\d{1,2}):([0-5]\d)$/);
    if(m&&Number(m[1])*60+Number(m[2])>90)return false;
    return text.length>0&&text.length<=230;
  });
  const timed=safeRows.some(row=>/^(?:0?[01]):[0-5]\d$/.test(String(row.time||'')));
  const hasUnconverted=candidate.rows.length!==safeRows.length;
  const issues=candidate.issues.map(x=>x.code).slice(0,12);
  if(hasUnconverted)issues.push('source-lines-omitted');
  if(!timed||safeRows.length<2)return {...base,matching:matched.match,
    status:'needs-translation-review',rowCount:candidate.rows.length,issues:[...new Set(issues)],
    omittedRows:candidate.rows.length};
  return {...base,status:hasUnconverted||issues.length?'partial':'candidate',matching:matched.match,
    rowCount:candidate.rows.length,omittedRows:candidate.rows.length-safeRows.length,
    issues:[...new Set(issues)],warningCount:candidate.warnings.length,
    unknownActorCount:candidate.unmappedActors.length,
    // Korean structured steps only; no row.source, Japanese literal, or full description.
    rows:safeRows.slice(0,90).map(row=>({time:row.time||null,
      text:String(row.text||'').slice(0,230),
      checked:Array.isArray(row.checked)?row.checked.map(Boolean):[]}))
  };
 });
 const statuses={};
 for(const item of references)statuses[item.status]=(statuses[item.status]||0)+1;
 const expiresAt=new Date(Date.parse(fetchedAt)+28*24*60*60*1000).toISOString();
 return {schema:'nyang-youtube-tactic-candidates-v1',source:'YouTube Data API v3',
   readOnly:true,registrationAllowed:false,fetchedAt,expiresAt,
   videoCount:videoMap.size,totalReferences:references.length,statuses,references};
}
