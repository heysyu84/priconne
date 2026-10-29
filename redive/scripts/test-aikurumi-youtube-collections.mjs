import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseYouTubeVideoLink,sourceCreator,groupAikurumiVideos,collectionTotals} from '../public/aikurumi-youtube-collections.mjs';
const data=name=>JSON.parse(readFileSync(new URL('../public/'+name,import.meta.url),'utf8'));
const stages=[data('aikurumi-snapshot-stage3.json'),data('aikurumi-snapshot.json')];
test('YouTube group key is video ID, not boss or link timestamp',()=>{
 const links=['https://youtu.be/gcLTnp88aSo?t=1m30s',
   'https://www.youtube.com/watch?v=gcLTnp88aSo&t=90',
   'https://www.youtube.com/watch?v=gcLTnp88aSo&start=90',
   'https://www.youtube.com/shorts/gcLTnp88aSo',
   'https://youtu.be/gcLTnp88aSo#t=90'];
 for(const raw of links)assert.equal(parseYouTubeVideoLink(raw)?.videoId,'gcLTnp88aSo');
 assert.equal(parseYouTubeVideoLink(links[0]).startSeconds,90);
 assert.equal(parseYouTubeVideoLink(links[1]).startSeconds,90);
 assert.equal(parseYouTubeVideoLink(links[2]).startSeconds,90);
 assert.equal(parseYouTubeVideoLink(links[4]).startSeconds,90);
 assert.equal(parseYouTubeVideoLink('https://youtu.be/LSCOSiF1fv8https://youtu.be/LSCOSiF1fv8').videoId,'LSCOSiF1fv8');
 for(const bad of ['https://youtube.com.evil.example/watch?v=gcLTnp88aSo','https://youtu.be/invalid','javascript:alert(1)'])
  assert.equal(parseYouTubeVideoLink(bad),null);
});
test('source creator labels are never invented without a matching attribution',()=>{
 assert.equal(sourceCreator('全set 33065\n油管 ぽちょむきん'),'ぽちょむきん');
 assert.equal(sourceCreator('xoooo 24900\n油管 Eruru'),'Eruru');
 assert.equal(sourceCreator('2025 クランバト C101'),null);
});
test('true source snapshots group 136 links into 72 distinct videos including 9 repeated videos',()=>{
 const groups=groupAikurumiVideos(stages),sum=collectionTotals(groups);
 assert.deepEqual(sum,{creators:sum.creators,videos:72,references:136,repeatedVideos:9});
 const videos=groups.flatMap(g=>g.videos);
 const eruru=videos.find(v=>v.videoId==='7tgdVxW_rz8');
 assert.equal(eruru.creator,'Eruru');
 assert.equal(eruru.references.length,22);
 assert.equal(eruru.distinctBosses,5);
 assert.equal(new Set(eruru.references.map(v=>v.stage)).size,1);
 const poch=videos.find(v=>v.videoId==='gcLTnp88aSo');
 assert.equal(poch.creator,'ぽちょむきん');
 assert.equal(poch.references.length,21);
 assert.equal(poch.distinctBosses,5);
 const sugi=groups.find(g=>g.creator==='スギさん');
 assert.ok(sugi.videos.some(v=>v.references.length>=4));
 assert.ok(sugi.videos.some(v=>v.distinctBosses===5));
});
test('mixed channel source attribution is reported, never falsely assigned to all links',()=>{
 const synthetic=JSON.parse(JSON.stringify(stages[0]));
 const boss=synthetic.bosses[0],unit=boss.tasks[0];
 synthetic.bosses=[{...boss,tasks:[{...unit,links:[
  {link:'https://youtu.be/gcLTnp88aSo?t=30',name:'油管 A'},
  {link:'https://youtu.be/gcLTnp88aSo?t=70',name:'油管 B'},
  {link:'https://youtu.be/gcLTnp88aSo?t=80',name:'油管 A'}
 ]}]}];
 const a=groupAikurumiVideos([synthetic]);
 assert.equal(a.length,1);
 assert.equal(a[0].creator,'A');
 assert.deepEqual(a[0].videos[0].creatorNames,['A','B']);
 assert.deepEqual(a[0].videos[0].references.map(r=>r.startSeconds),[30,70,80]);
});
