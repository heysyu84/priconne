// Isolated refresh: official API -> transient full descriptions -> structured
// Korean preview only. Never save a third-party description in the repository.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {listAikurumiYouTubeVideos,fetchYouTubeDescriptions} from './aikurumi-youtube-api.mjs';
import {createYouTubeTacticCandidates} from './aikurumi-youtube-candidates.mjs';
const root=resolve(import.meta.dirname,'..');
const snapshots=['aikurumi-snapshot-stage3.json','aikurumi-snapshot.json']
  .map(name=>JSON.parse(readFileSync(resolve(root,'public',name),'utf8')));
if(snapshots.some(s=>s.readOnly!==true)||snapshots.map(s=>s.stage).join(',')!=='3,6')
 throw Error('Unexpected source stages or non-read-only snapshot');
const links=[...new Set(snapshots.flatMap(s=>listAikurumiYouTubeVideos(s).map(v=>v.videoId)))];
const apiKey=process.env.YOUTUBE_API_KEY;
if(!apiKey)throw Error('YOUTUBE_API_KEY missing: do not publish empty results');
const found=await fetchYouTubeDescriptions(links.map(videoId=>({videoId})),{apiKey});
const derived=createYouTubeTacticCandidates(snapshots,found);
if(found.received===0||derived.totalReferences<100)throw Error('Incomplete source index: refusing overwrite');
const videosLinked=new Set(derived.references.map(r=>r.videoId));
if(derived.references.some(r=>!videosLinked.has(r.videoId)||r.rows.some(x=>x.text.length>230)))
  throw Error('Inconsistent derived source');
const counts={requested:found.requested,received:found.received,missing:found.missing.length,
 references:derived.totalReferences,statuses:derived.statuses,
 stage3:derived.references.filter(x=>x.stage===3).length,stage4:derived.references.filter(x=>x.stage===6).length};
console.log('YOUTUBE_CANDIDATE_COUNTS',JSON.stringify(counts));
const output=resolve(root,'public/aikurumi-youtube-candidates.json');
const published=resolve(root,'../docs/aikurumi-lab/aikurumi-youtube-candidates.json');
const compact=resolve(root,'../docs/compact/aikurumi-youtube-candidates.json');
writeFileSync(output,JSON.stringify(derived,null,2)+'\n');
writeFileSync(published,JSON.stringify(derived,null,2)+'\n');
writeFileSync(compact,JSON.stringify(derived,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY)
 writeFileSync(process.env.GITHUB_STEP_SUMMARY,
  '## YouTube 일본어 TL 자동 매칭 / 변환 (검토용)\n'
  +'설명란 원문은 저장·게시하지 않고, 변환된 한국어 조작문만 28일 만료형으로 게시합니다.\n'
  +Object.entries(counts).map(([k,v])=>'- '+k+': '+JSON.stringify(v)).join('\n')+'\n',{flag:'a'});
