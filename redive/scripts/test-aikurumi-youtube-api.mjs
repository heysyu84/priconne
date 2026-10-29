import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {youtubeVideoId,listAikurumiYouTubeVideos,inspectYouTubeDescription,
  fetchYouTubeDescriptions,summarizeYouTubeDescriptions} from './aikurumi-youtube-api.mjs';
const snapshot=JSON.parse(readFileSync(new URL('../public/aikurumi-snapshot.json',import.meta.url),'utf8'));
const videos=listAikurumiYouTubeVideos(snapshot);

test('only verified YouTube hostnames and 11-character IDs are accepted',()=>{
  for(const url of ['https://www.youtube.com/watch?v=gcLTnp88aSo&t=90',
    'https://youtu.be/gcLTnp88aSo','https://m.youtube.com/shorts/gcLTnp88aSo',
    'https://www.youtube.com/live/gcLTnp88aSo','https://www.youtube-nocookie.com/embed/gcLTnp88aSo'])
    assert.equal(youtubeVideoId(url),'gcLTnp88aSo',url);
  assert.equal(youtubeVideoId('https://youtu.be/LSCOSiF1fv8https://youtu.be/LSCOSiF1fv8https://docs.google.com/spreadsheets/d/example'),'LSCOSiF1fv8');
  for(const url of ['https://youtube.com.evil.example/watch?v=gcLTnp88aSo',
    'javascript:alert(1)','https://youtube.com/watch?v=bad',
    'https://vimeo.com/gcLTnp88aSo'])
    assert.equal(youtubeVideoId(url),null,url);
});

test('actual Aikurumi October snapshot has 65 distinct linked videos',()=>{
  assert.equal(videos.length,65);
  assert.equal(videos.reduce((total,v)=>total+v.mentions.length,0),113);
  assert.equal(videos.find(v=>v.videoId==='gcLTnp88aSo').mentions.length,21);
});

test('API requests are batched in groups of 50; never expose secrets in output',async()=>{
 const calls=[];
 const fakeFetch=async url=>{
   const u=new URL(url),keys=u.searchParams.get('id').split(',');
   calls.push({idCount:keys.length,part:u.searchParams.get('part'),key:u.searchParams.get('key'),
     fields:u.searchParams.get('fields')});
   return {ok:true,json:async()=>({items:keys.map(id=>({id,
     snippet:{title:'테스트',channelTitle:'테스트 채널',description:
       '1:30 全SET 自動ON\n1:09 キャル ON\n0:45 ランファ OFF'}}))})};
 };
 const report=await fetchYouTubeDescriptions(videos,{apiKey:'private-test-only',fetchImpl:fakeFetch});
 assert.equal(report.requested,65);
 assert.equal(report.received,65);
 assert.deepEqual(calls.map(c=>c.idCount),[50,15]);
 assert.ok(calls.every(c=>c.part==='snippet'&&c.key==='private-test-only'));
 assert.equal(report.missing.length,0);
 const summary=summarizeYouTubeDescriptions(videos,report);
 assert.equal(summary.items.length,65);
 assert.ok(summary.items.every(x=>x.mayContainTactic));
 assert.ok(!JSON.stringify(summary).includes('private-test-only'));
 assert.ok(!JSON.stringify(summary).includes('自動ON'));
 assert.ok(!JSON.stringify(summary).includes('テスト 채널'));
});
test('missing video or empty descriptions are not misreported as extracted TL',async()=>{
 const fakeFetch=async()=>({ok:true,json:async()=>({items:[
  {id:'gcLTnp88aSo',snippet:{title:'Public title',description:''}}]})});
 const selected=videos.slice(0,3);
 const result=await fetchYouTubeDescriptions(selected,{apiKey:'unused',fetchImpl:fakeFetch});
 const summary=summarizeYouTubeDescriptions(selected,result);
 assert.equal(result.missing.length,selected.length-1);
 assert.equal(summary.items[0].descriptionPresent,false);
 assert.equal(summary.items[0].mayContainTactic,false);
 assert.ok(summary.items.slice(1).every(x=>x.available===false));
});
test('YouTube API errors are sanitized, and missing key makes no request',async()=>{
 let called=false;
 await assert.rejects(()=>fetchYouTubeDescriptions(videos,{apiKey:'',fetchImpl:async()=>{called=true;}}),/Missing YOUTUBE_API_KEY/);
 assert.equal(called,false);
 await assert.rejects(()=>fetchYouTubeDescriptions(videos.slice(0,1),{apiKey:'TOP_SECRET',
  fetchImpl:async()=>({ok:false,status:403})}),e=>e.message.includes('HTTP 403')&&!e.message.includes('TOP_SECRET'));
});
test('chapter list alone must not be declared a tactic',()=>{
 const chapters=inspectYouTubeDescription('00:00 はじめに\n00:40 説明\n01:20 まとめ');
 assert.equal(chapters.mayContainTactic,false);
 const tactic=inspectYouTubeDescription('1:30 AUTO ON\n1:11 キャル OFF\n0:59 ランファ SET');
 assert.equal(tactic.mayContainTactic,true);
});
