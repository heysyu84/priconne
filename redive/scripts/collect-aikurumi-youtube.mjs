// Manual read-only audit of public YouTube descriptions via official videos.list.
// Never persist the descriptions in the public repo or print them in Action logs.
// Needs YOUTUBE_API_KEY (GitHub Actions secret); without one it exits safely.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {listAikurumiYouTubeVideos,fetchYouTubeDescriptions,
  summarizeYouTubeDescriptions} from './aikurumi-youtube-api.mjs';

const root=resolve(import.meta.dirname,'..');
const snapshot=JSON.parse(readFileSync(resolve(root,'public/aikurumi-snapshot.json'),'utf8'));
if(snapshot.readOnly!==true||!Array.isArray(snapshot.bosses))
  throw new Error('Snapshot is not a read-only validated source');
const videos=listAikurumiYouTubeVideos(snapshot);
console.log('YOUTUBE_INDEX',JSON.stringify({linkedOccurrences:videos.reduce((n,v)=>n+v.mentions.length,0),
  uniqueVideos:videos.length,jpMonth:snapshot.jpMonth,stage:snapshot.stage}));
const apiKey=process.env.YOUTUBE_API_KEY;
if(!apiKey){
  console.log('YOUTUBE_KEY_NOT_CONFIGURED: Add YOUTUBE_API_KEY in repository Actions secrets; no requests were sent.');
  process.exit(0);
}
try{
  const found=await fetchYouTubeDescriptions(videos,{apiKey});
  const summary=summarizeYouTubeDescriptions(videos,found);
  const counts={requested:summary.requested,received:summary.received,
    withDescription:summary.items.filter(x=>x.descriptionPresent).length,
    possibleTL:summary.items.filter(x=>x.mayContainTactic).length,
    kanaPresent:summary.items.filter(x=>x.containsJapaneseKana).length,
    missing:summary.missing.length};
  console.log('YOUTUBE_AUDIT_COUNTS',JSON.stringify(counts));
  if(process.env.GITHUB_STEP_SUMMARY){
    const md=['## YouTube 공식 API · 읽기 전용 검사',
      '설명란 원문은 저장·출력·게시하지 않습니다.',
      ...Object.entries(counts).map(([k,v])=>'- '+k+': '+v),''].join('\n');
    writeFileSync(process.env.GITHUB_STEP_SUMMARY,md,{flag:'a'});
  }
  // Report contains only derived counts and video IDs, NOT description text.
  const output=resolve(root,'tmp/youtube-description-audit.json');
  mkdirSync(resolve(root,'tmp'),{recursive:true});
  writeFileSync(output,JSON.stringify({
    ...summary,source:'youtube-data-api-v3',jpMonth:snapshot.jpMonth,
    collectedAt:new Date().toISOString(),readOnly:true
  },null,2)+'\n','utf8');
}catch(e){
  // Do not log the URL or the API key.
  console.error('YOUTUBE_FETCH_FAILED',e instanceof Error?e.message:'Unknown request failure');
  process.exitCode=1;
}
