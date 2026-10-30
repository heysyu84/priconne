// Read-only priority policy for a matched external tactic.
// YouTube ORIGINAL Japanese TL is authoritative when present. Chinese Aikurumi
// TL is only a fallback after confirming the YouTube video has no actionable TL.
// Ambiguous YouTube multi-tactic sections must never silently become Chinese TL.
export function selectPrimaryTacticSource(entry,{youtubeReady=false,hasChineseTimeline=false,hasYouTubeLink=false}={}){
 if(!entry&&hasYouTubeLink)return {source:'youtube-unverified',label:'YouTube 확인 필요',
  chineseFallback:false,needsHumanCheck:true,reason:youtubeReady?'missing-video-result':'not-fetched'};
 if(!entry)return {
  source:youtubeReady?'aikurumi':'awaiting-youtube',
  label:youtubeReady?'aikurumi 중국어 TL':'유튜브 조회 중',
  chineseFallback:youtubeReady,
  needsHumanCheck:!youtubeReady,
  reason:youtubeReady?'not-a-linked-youtube-tactic':'not-fetched'
 };
 const evidence=entry.youtubeHasTactic;
 if(evidence===true){
  const hasDerived=Array.isArray(entry.rows)&&entry.rows.length>0;
  return {source:'youtube',label:'YouTube 일본어 TL 우선',
   chineseFallback:false,needsHumanCheck:entry.status!=='candidate',
   hasDerived,reason:entry.matching||entry.status};
 }
 if(evidence===false&&['no-youtube-tl','empty-description'].includes(entry.status)){
  return {source:'aikurumi',label:'YouTube TL 없음 → aikurumi 중국어 대체',
   chineseFallback:true,needsHumanCheck:!hasChineseTimeline,reason:entry.status};
 }
 if(evidence===false&&entry.status==='no-parsable-timeline'){
  return {source:'aikurumi',label:'YouTube 조작 TL 미검출 → aikurumi 중국어 대체',
   chineseFallback:true,needsHumanCheck:!hasChineseTimeline,reason:entry.status};
 }
 // Unavailable/private or low-confidence evidence is NOT proof TL is absent.
 return {source:'youtube-unverified',label:'YouTube 확인 불가 · 중국어는 참고만',
  chineseFallback:false,needsHumanCheck:true,reason:entry.status};
}
