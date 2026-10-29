// Isolated server-side YouTube Data API v3 reader. NEVER import this in a
// client-side page: the API key belongs in GitHub Actions secrets or a backend.
// Call videos.list(part=snippet) for up to 50 distinct videos per request.
export function youtubeVideoId(raw) {
  try {
    const u=new URL(String(raw??'').trim());
    const host=u.hostname.toLowerCase();
    let id=null;
    if(host==='youtu.be'||host==='www.youtu.be'){
      const segment=u.pathname.split('/').filter(Boolean)[0]||'';
      // Aikurumi has one mistakenly concatenated URL. Recover the first
      // complete ID only when the next characters clearly start another URL.
      id=segment.match(/^([a-zA-Z0-9_-]{11})(?=https?:)/)?.[1]||segment;
    }
    else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com',
      'youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)) {
      if(u.pathname==='/watch')id=u.searchParams.get('v');
      else if(/^\/(shorts|live|embed)\//.test(u.pathname))id=u.pathname.split('/')[2];
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(id||'')?id:null;
  }catch{return null;}
}

export function listAikurumiYouTubeVideos(snapshot) {
  const byVideo=new Map();
  for(const boss of snapshot?.bosses||[])for(const task of boss.tasks||[])
    for(const link of task.links||[]){
      const id=youtubeVideoId(link.link);
      if(!id)continue;
      if(!byVideo.has(id))byVideo.set(id,{videoId:id,mentions:[]});
      byVideo.get(id).mentions.push({boss:Number(boss.index),taskId:task.id,
        linkIndex:link.index??null,hasAikurumiText:!!String(link.remarks||'').trim()});
    }
  return [...byVideo.values()];
}

export function inspectYouTubeDescription(raw) {
  const description=String(raw??'');
  const lines=description.replace(/\r\n?/g,'\n').split('\n');
  // Heuristic only, never certify correctness: chapter timestamps are common.
  const candidate=lines.filter(line=>/^\s*[★☆⭐✩]?\s*(?:[01]?:)?[0-5]?\d:[0-5]\d(?:\s|$|[、,:：→➡）)])/u.test(line));
  const instructions=lines.filter(line=>/(?:SET|AUTO|オート|オン|オフ|UB|ユニオンバースト|手動|自動|自动|自动|セット|解除|キャンセル|目押し|後|前|ON|OFF|→|➡)/iu.test(line));
  return {descriptionLength:description.length,lineCount:lines.length,
    candidateClockLines:candidate.length,instructionHintLines:instructions.length,
    mayContainTactic:candidate.length>=2&&instructions.length>=1,
    containsJapaneseKana:/[\u3040-\u30ff]/u.test(description)};
}

export async function fetchYouTubeDescriptions(videos,{apiKey,fetchImpl=fetch}={}){
  if(!apiKey||!String(apiKey).trim())throw new Error('Missing YOUTUBE_API_KEY');
  const unique=[...new Map((videos||[]).map(v=>[v.videoId,v])).values()];
  if(unique.some(v=>!/^[a-zA-Z0-9_-]{11}$/.test(v.videoId)))throw new Error('Invalid YouTube video ID');
  const results=new Map();
  for(let start=0;start<unique.length;start+=50){
    const group=unique.slice(start,start+50);
    const uri=new URL('https://www.googleapis.com/youtube/v3/videos');
    uri.searchParams.set('part','snippet');
    uri.searchParams.set('id',group.map(v=>v.videoId).join(','));
    uri.searchParams.set('fields','items(id,snippet(title,description,channelTitle,publishedAt,defaultLanguage))');
    uri.searchParams.set('key',String(apiKey));
    const res=await fetchImpl(uri.href,{signal:AbortSignal.timeout(20000)});
    if(!res.ok)throw new Error('YouTube videos.list returned HTTP '+res.status+
      ' (verify API enablement, API key restrictions and quota)');
    const payload=await res.json();
    if(!Array.isArray(payload?.items))throw new Error('Malformed YouTube API response');
    for(const item of payload.items){
      if(!/^[a-zA-Z0-9_-]{11}$/.test(item?.id||''))continue;
      results.set(item.id,{
        videoId:item.id,
        title:String(item.snippet?.title??''),
        channelTitle:String(item.snippet?.channelTitle??''),
        publishedAt:String(item.snippet?.publishedAt??''),
        description:String(item.snippet?.description??'')
      });
    }
  }
  return {requested:unique.length,received:results.size,missing:unique.filter(v=>!results.has(v.videoId)).map(v=>v.videoId),
    videos:[...results.values()]};
}

// Only publish derived counters, NOT third-party full descriptions, to reports.
export function summarizeYouTubeDescriptions(videos,found){
  const byId=new Map(found.videos.map(v=>[v.videoId,v]));
  return {schema:'nyang-youtube-audit-v1',requested:videos.length,received:found.received,
    missing:found.missing,items:videos.map(v=>{
      const video=byId.get(v.videoId),analysis=video?inspectYouTubeDescription(video.description):null;
      return {videoId:v.videoId,mentions:v.mentions?.length||0,
        available:!!video,descriptionPresent:!!video?.description,
        candidateClockLines:analysis?.candidateClockLines||0,
        instructionHintLines:analysis?.instructionHintLines||0,
        mayContainTactic:analysis?.mayContainTactic||false,
        containsJapaneseKana:analysis?.containsJapaneseKana||false};
    })};
}
