import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPrimaryTacticSource} from '../public/aikurumi-source-priority.mjs';
const base={videoId:'gcLTnp88aSo',rows:[{text:'1:20 AUTO 오프'}],youtubeHasTactic:true};
test('YouTube Japanese TL always wins even when Chinese has more lines',()=>{
 for(const status of ['candidate','partial','needs-translation-review','needs-source-check','no-parsable-timeline']){
  const actual=selectPrimaryTacticSource({...base,status,matching:'shared-video-without-sections'}, {youtubeReady:true,hasChineseTimeline:true});
  assert.equal(actual.source,'youtube');assert.equal(actual.chineseFallback,false);
 }
});
test('Only confirmed absence of YouTube TL permits automatic Chinese fallback',()=>{
 for(const status of ['no-youtube-tl','empty-description']){
  const actual=selectPrimaryTacticSource({status,youtubeHasTactic:false}, {youtubeReady:true,hasChineseTimeline:true});
  assert.equal(actual.source,'aikurumi');assert.equal(actual.chineseFallback,true);
 }
 const unavailable=selectPrimaryTacticSource({status:'video-unavailable',youtubeHasTactic:null},{youtubeReady:true,hasChineseTimeline:true});
 assert.equal(unavailable.source,'youtube-unverified');
 assert.equal(unavailable.chineseFallback,false);
});
test('Do not silently use Chinese before video status has loaded',()=>{
 assert.equal(selectPrimaryTacticSource(null,{youtubeReady:false,hasChineseTimeline:true}).source,'awaiting-youtube');
});
