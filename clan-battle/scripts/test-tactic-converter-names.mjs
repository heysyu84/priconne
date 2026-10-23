import assert from 'node:assert/strict';
import fs from 'node:fs';
import {convertForeignTactic as convert} from '../public/tactic-converter.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../public/characters.json',import.meta.url),'utf8')).characters;
const run=(text,ko=[],foreign=[])=>convert(text,ko,foreign,[],catalog);

let result=run('初動 네네카 SET\n1:12 네네카 캬루 ON\n0:53 캬루 OFF');
assert.equal(result.warnings.length,0);
assert.ok(!result.text.includes('[원문 확인:'));
assert.match(result.text,/네네카 SET/);
assert.match(result.text,/1:12 네네카 후 캬루 ON/);
assert.match(result.text,/0:53 캬루 OFF/);
assert.deepEqual(new Set(result.unmappedActors),new Set(['네네카','캬루']));
assert.ok(result.rows.every(row=>row.checked.length===6));
assert.ok(result.rows.every(row=>row.checked.slice(0,5).every(value=>value===false)),'names never guess numbered slots');

const party=['피오','수레시아','수리아','와카나','펜오이'];
result=run('初動 네네카 SET\n1:12 피오 캬루 SET → 수리아 SET\n0:53 캬루 OFF',party);
assert.equal(result.warnings.length,0);
assert.match(result.text,/캬루 ON, 수리아 ON/);
assert.equal(result.rows[1].checked[2],true);
assert.equal(result.rows[1].checked.length,6);
assert.ok(result.unmappedActors.includes('캬루'));
assert.ok(!result.unmappedActors.includes('수리아'));

// Foreign names do not need to be entered above just to preserve clear commands.
result=run('初動 ミサト SET\n1:12 ミサト ネネカ SET\n0:53 ネネカ 切');
assert.equal(result.warnings.length,0);
assert.match(result.text,/ミサト SET/);
assert.match(result.text,/ミサト 후 ネネカ ON/);
assert.match(result.text,/ネネカ OFF/);
assert.deepEqual(new Set(result.unmappedActors),new Set(['ミサト','ネネカ']));

result=run('1:12 피오 수레시아 → 수리아 SET');
assert.equal(result.warnings.length,0);
assert.match(result.text,/수레시아, 수리아 순으로 ON/);
result=run('1:12 수리아 SET → 수리아 切');
assert.match(result.text,/수리아 한번만/);
assert.equal(result.warnings.length,0);

// Registration removes the informational mapping gap and produces exact SET bits.
result=run('初動 ネネカ SET\n1:12 ネネカ キャル SET',['네네카','캬루','수리아','와카나','펜오이'],['ネネカ','キャル']);
assert.deepEqual(result.unmappedActors,[]);
assert.deepEqual(result.rows[1].checked.slice(0,2),[true,true]);
assert.equal(result.warnings.length,0);

// Ambiguous conditions continue to be displayed for review.
result=run('初動 네네카 SET\n1:12 네네카 캬루 SET ※ダメージ不足時のみ');
assert.match(result.text,/\[원문 확인: ※ダメージ不足時のみ\]/);
assert.equal(result.warnings.length,1);
result=run('1:12 ダメージ不足時のみ SET');
assert.ok(result.warnings.length>0);
result=run('1:12 알 수 없는 조작 조건');
assert.ok(result.warnings.length>0);

// A character-name suffix inside an unrelated word is not a command target.
result=run('1:12 플레이 SET');
assert.ok(!result.text.includes('캐릭터 1 ON'));
assert.ok(!result.unmappedActors.includes('레이'));

const source='1:30 시작 [❌❌❌❌❌] 오토ON\n1:17 수리아(오토) [ー⭕️ー⭕️ー] 오토OFF\n0:53 수레시아 [⭕️〇〇〇〇] ➡️ 성치카 [❌〇〇〇〇]';
result=run(source);
assert.equal(result.warnings.length,0);
assert.deepEqual(result.unmappedActors,[],'dango positions remain usable without name fields');
assert.ok(result.rows.every(row=>row.checked.length===6));
console.log('PASS: unregistered Korean/Japanese names, catalog aliases, known slots, unknown slots, conditions, once, arrows and anonymous dango');
