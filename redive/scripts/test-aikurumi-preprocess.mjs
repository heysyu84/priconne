import test from 'node:test';
import assert from 'node:assert/strict';
import {splitAikurumiTimeline} from '../public/aikurumi-tactic-preprocess.mjs';
import {convertForeignTactic} from '../public/tactic-parser.mjs';

test('real-format Aikurumi character RANK and equipment preamble stays in notes',()=>{
  const source='水璃亚 ★5 R38 全部\n若菜 ★5 R38 全部\n生菜 ★5 R38 专用360\n◆职阶强化\n增幅者 初动TPLv5★1\n◆TL\n1:30 开始(✕〇〇〇〇) 自动ON\n1:20 若菜 ON';
  const result=splitAikurumiTimeline(source);
  assert.equal(result.firstActionLine,7);
  assert.match(result.notes,/R38/);
  assert.match(result.notes,/职阶强化/);
  assert.doesNotMatch(result.timeline,/R38|职阶强化|◆TL/);
  assert.match(result.timeline,/1:30 开始/);
  assert.equal(result.original,source);
});

test('full-party initial SET remains an action, not character metadata',()=>{
  const source='全SET 自动ON\n1:11 黑猫 〇〇－〇〇';
  const result=splitAikurumiTimeline(source);
  assert.equal(result.firstActionLine,1);
  assert.equal(result.notes,'');
  assert.equal(result.timeline,source);
});

test('cross masks (✕) and bracketed sets are parsed as five-position state',()=>{
  const first=convertForeignTactic('1:30 开始(✕〇〇〇〇) 自动ON',['A','B','C','D','E']);
  assert.equal(first.rows.length,1);
  assert.deepEqual(first.rows[0].checked,[false,true,true,true,true,true]);
  assert.equal(first.warnings.length,0);
  const second=convertForeignTactic('【－－－－〇】 自动ON',['A','B','C','D','E']);
  assert.deepEqual(second.rows[0].checked,[false,false,false,false,true,true]);
  assert.equal(second.warnings.length,0);
});

test('no recognizable timeline yields notes only, never an invented action',()=>{
  const source='水璃亚 ★5 R38 全部\n仅供参考';
  const result=splitAikurumiTimeline(source);
  assert.equal(result.hasAction,false);
  assert.equal(result.timeline,'');
  assert.equal(result.notes,source);
});
