// Public read-only grouping of Aikurumi video references.
// A creator collection contains one or more distinct video IDs. The video ID
// groups exact source links across bosses, stages and timestamp variants.
export function parseYouTubeVideoLink(raw) {
  let u;
  try {u=new URL(String(raw||''));}catch {return null;}
  const host=u.hostname.toLowerCase();
  let id='';
  if(host==='youtu.be'||host==='www.youtu.be'){
    const part=u.pathname.split('/')[1]||'';
    id=part.match(/^([\w-]{11})(?=https?:)/)?.[1]||part;
  }else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com',
     'youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)){
    if(u.pathname==='/watch')id=u.searchParams.get('v')||'';
    else if(/^\/(shorts|live|embed)\//.test(u.pathname))id=u.pathname.split('/')[2]||'';
  }
  if(!/^[A-Za-z0-9_-]{11}$/.test(id))return null;
  const fragment=new URLSearchParams(u.hash.replace(/^#/,''));
  const rawTime=u.searchParams.get('t')||u.searchParams.get('start')||fragment.get('t')||'';
  const parts=rawTime.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
  let startSeconds=null;
  if(parts&&rawTime){
    const n=Number(parts[1]||0)*3600+Number(parts[2]||0)*60+Number(parts[3]||0);
    if(n>=0&&Number.isSafeInteger(n))startSeconds=n;
  }
  return {videoId:id,startSeconds,rawUrl:String(raw)};
}

export function sourceCreator(label) {
  // Only use source attribution, never guess from the video title/ID.
  const text=String(label??'');
  const lines=text.split(/\r?\n/);
  const line=lines.find(l=>/(?:油管|YouTube|Youtube|ユーチューブ)\s*[:：]?\s*\S+/i.test(l));
  if(!line)return null;
  const match=line.match(/(?:油管|YouTube|Youtube|ユーチューブ)\s*[:：]?\s*(.+)$/i);
  return match?.[1]?.trim()||null;
}

export function groupAikurumiVideos(snapshots) {
  const byId=new Map();
  for(const snap of snapshots||[])for(const boss of snap?.bosses||[])
    for(const task of boss.tasks||[])for(const [i,link] of (task.links||[]).entries()){
      const info=parseYouTubeVideoLink(link.link);
      if(!info)continue;
      if(!byId.has(info.videoId))byId.set(info.videoId,{videoId:info.videoId,
        references:[],creators:new Map()});
      const group=byId.get(info.videoId),creator=sourceCreator(link.name);
      if(creator)group.creators.set(creator,(group.creators.get(creator)||0)+1);
      group.references.push({stage:Number(snap.stage),jpMonth:String(snap.jpMonth||''),
        boss:Number(boss.index),bossName:String(boss.unitName||''),taskId:task.id,
        linkIndex:link.index??i,linkOrdinal:i,sourceTitle:String(link.name||''),
        sourceUrl:String(link.link||''),startSeconds:info.startSeconds,
        sourceCreator:creator,sourceType:link.type??null});
    }
  const creators=new Map();
  for(const video of byId.values()){
    const names=[...video.creators.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    video.creator=names[0]?.[0]||'제작자 미확인';
    video.creatorNames=names.map(([name])=>name);
    video.references.sort((a,b)=>a.stage-b.stage||a.boss-b.boss||
      Number(a.taskId)-Number(b.taskId)||a.linkOrdinal-b.linkOrdinal);
    video.distinctBosses=new Set(video.references.map(r=>r.stage+':'+r.boss)).size;
    // Make the display name explicitly identify the source creator.
    video.label=video.creator+'의 택틱 영상';
    if(!creators.has(video.creator))creators.set(video.creator,[]);
    creators.get(video.creator).push(video);
  }
  return [...creators.entries()].map(([name,videos])=>({
    creator:name,videos:videos.sort((a,b)=>b.references.length-a.references.length||a.videoId.localeCompare(b.videoId)),
    videoCount:videos.length,referenceCount:videos.reduce((n,v)=>n+v.references.length,0),
    repeatedVideoCount:videos.filter(v=>v.references.length>1).length
  })).sort((a,b)=>b.repeatedVideoCount-a.repeatedVideoCount||
    b.referenceCount-a.referenceCount||a.creator.localeCompare(b.creator));
}

export function collectionTotals(groups) {
  return {creators:groups.length,
    videos:groups.reduce((n,g)=>n+g.videoCount,0),
    references:groups.reduce((n,g)=>n+g.referenceCount,0),
    repeatedVideos:groups.reduce((n,g)=>n+g.repeatedVideoCount,0)};
}
