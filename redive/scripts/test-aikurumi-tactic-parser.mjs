import test from 'node:test';
import assert from 'node:assert/strict';
test('mixed mask and command lines preserve initial SET and standalone UB names without duplicated-name warnings',()=>{
 const names=['피오','수리아','와카나','수레시아','성치카'];
 const value=convertForeignTactic('1:30 全SET AUTO ON\n1:12 피오\n0:30 〇〇〇〇〇',names);
 assert.deepEqual(value.rows[0].checked,[true,true,true,true,true,true]);
 assert.ok(value.rows.some(row=>/1:12 피오 UB/.test(row.text)));assert.equal(value.warnings.length,0);
});
import {convertForeignTactic} from '../public/tactic-parser.mjs';

// Grounded in a public Aikurumi JP 2025-10 stage=6 link remark.
const names=['란파','수에키드나','프캬루','호마레','바이올렛'];
const aliases=['兰法龙','','黑猫','','紫罗兰'];
const sample='全SET 自动ON\n1:11 黑猫　〇〇－〇〇\n1:06 黑猫　自动 OFF\n0:59 紫罗兰　〇〇〇〇〇\n0:45 黑猫　－－－〇－\n0:35 兰法龙　〇〇－〇－ / 自动 ON\n0:34 黑猫　〇〇〇〇－';
test('a trigger followed by another character firing and turning OFF at the same time becomes once-only',()=>{
 const r=convertForeignTactic('1:30 ○○✕○○ AUTO OFF\n0:59 スミレ ○○○○○\n프캬루 ○○✕○○\n0:50 BOSS ○○○○○\n프캬루 ○○✕○○',names);
 assert.equal(r.rows.length,3);assert.equal(r.rows[1].text,'0:59 바이올렛 후 프캬루 한번만');
 assert.equal(r.rows[2].text,'0:50 보스 후 프캬루 한번만');
 assert.deepEqual(r.rows[1].checked,[true,true,false,true,true,false]);assert.equal(r.warnings.length,0);
 assert.match(r.rows[1].source,/スミレ[\s\S]*프캬루/);
});
test('once-only comes before remaining ON commands and retains all unrelated SET changes',()=>{
 const r=convertForeignTactic('1:30 ○○✕✕○ AUTO OFF\n0:59 바이올렛 ✕○○✕○\n프캬루 ✕○✕○○',names);
 assert.equal(r.rows[1].text,'0:59 바이올렛 후 프캬루 한번만, 호마레 ON, 란파 OFF');
 assert.deepEqual(r.rows[1].checked,[false,true,false,true,true,false]);
});
test('explicit ON and OFF commands share the same once-only rule as OX masks',()=>{
 const r=convertForeignTactic('1:30 전부 OFF AUTO ON\n0:59 바이올렛 후 프캬루 ON\n0:59 프캬루 후 프캬루 OFF',names);
 assert.equal(r.rows[1].text,'0:59 바이올렛 후 프캬루 한번만');assert.equal(r.rows[1].checked[2],false);assert.equal(r.rows[1].checked[5],true);
});
test('different times and conditional later triggers cannot be collapsed into once-only',()=>{
 for(const source of ['1:30 ○○✕○○ AUTO OFF\n0:59 바이올렛 ○○○○○\n0:58 프캬루 ○○✕○○',
  '1:30 ○○✕○○ AUTO OFF\n0:59 바이올렛 ○○○○○\n프캬루 1스킬 시작 후 ○○✕○○']){
  const r=convertForeignTactic(source,names);assert.equal(r.rows.length,3);assert.doesNotMatch(r.text,/한번만/);
 }
});
test('compaction does not reorder a second character OFF then ON at the same time',()=>{
 const r=convertForeignTactic('1:30 ○○✕○○ AUTO OFF\n0:59 바이올렛 ✕○○○○\n프캬루 ○○✕○○',names);
 assert.equal(r.rows.length,3);assert.equal(r.rows[1].checked[0],false);assert.equal(r.rows[2].checked[0],true);
});

test('real source: 全SET and Chinese AUTO establish all five SET states',()=>{
  const r=convertForeignTactic(sample,names,aliases);
  assert.equal(r.rows.length,7);
  assert.deepEqual(r.rows[0].checked,[true,true,true,true,true,true]);
  assert.match(r.rows[0].text,/전부 SET/);
  assert.doesNotMatch(r.rows[0].text,/全 SET|원문 확인/);
  assert.equal(r.unmappedActors.includes('全'),false);
});

test('real source: dango symbols compare against previous state, not all-OFF',()=>{
  const r=convertForeignTactic(sample,names,aliases);
  assert.deepEqual(r.rows[1].checked,[true,true,false,true,true,true]);
  assert.deepEqual(r.rows[2].checked,[true,true,false,true,true,false]);
  assert.deepEqual(r.rows[3].checked,[true,true,true,true,true,false]);
  assert.match(r.rows[1].text,/프캬루 OFF/);
});

test('real source: slash between 5-cell mask and AUTO is punctuation',()=>{
  const r=convertForeignTactic(sample,names,aliases);
  assert.deepEqual(r.rows[5].checked,[true,true,false,true,false,true]);
  assert.equal(r.warnings.some(w=>w.includes('원문')&&w.includes('/')),false);
  assert.match(r.rows[5].text,/AUTO 온/);
});

test('all-party SET dialect variants are recognized without introducing a sixth unit',()=>{
  for(const command of ['全SET','全部SET','全員SET','全キャラSET','전부 SET','全员SET']){
    const r=convertForeignTactic(command,names,aliases);
    assert.equal(r.rows.length,1,command);
    assert.deepEqual(r.rows[0].checked.slice(0,5),[true,true,true,true,true],command);
    assert.match(r.rows[0].text,/전부 SET/,command);
    assert.equal(r.unmappedActors.length,0,command);
  }
});

test('explicit sequential ON with Japanese 順に retains source ordering',()=>{
  const r=convertForeignTactic('1:09 キャラ1、キャラ2 順にON',['A','B','C','D','E']);
  assert.match(r.text,/A, B 순으로 ON/);
});

test('unrecognized instructions raise a warning instead of disappearing',()=>{
  const r=convertForeignTactic('全SET 自动ON\n0:30 触发未知機制',names,aliases);
  assert.ok(r.warnings.length>0);
});
