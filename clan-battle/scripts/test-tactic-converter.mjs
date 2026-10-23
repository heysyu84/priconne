import assert from 'node:assert/strict';
import {convertForeignTactic as convert} from '../public/tactic-converter.mjs';
import {pastedRows,commandState} from '../public/tactics-model.mjs';
import {parseTacticTransfer,serializeTacticTransfer} from '../public/tactic-transfer.mjs';
const ko=['피오','수레시아','수리아','와카나','펜오이'],ja=['ピオ','スレシア','スリア','ワカナ','ペンオイ'];
const run=raw=>convert(raw,ko,ja);
let result=run('初動 ピオ SET\n1:12 ピオ スレシア → スリア SET');
assert.match(result.text,/수레시아, 수리아 순으로 ON/);assert.deepEqual(result.rows[1].checked.slice(0,3),[true,true,true]);assert.equal(result.warnings.length,0);
result=run('初動 ピオ SET\n1:12 ピオ スレシア SET → スレシア 切 → スリア SET');
assert.match(result.text,/수레시아 한번만, 수리아 ON/);assert.deepEqual(result.rows[1].checked.slice(0,3),[true,false,true]);
result=run('初動 ピオ SET\n1:12 ピオ スレシア SET ※ダメージ不足時のみ');
assert.match(result.text,/\[원문 확인: ※ダメージ不足時のみ\]/);assert.ok(result.warnings.length);assert.match(result.rows[1].source,/不足/);
result=run('初動 ピオ SET\n1:12 ピオ スレシア SET\n1:12 ピオ スレシア 切');
assert.equal(result.rows.length,2);assert.match(result.text,/1:12 피오 후 수레시아 한번만/);assert.equal(result.rows[1].checked[1],false);
result=run('初動 OXXXX\n1:12 ピオ OXXXX → OOXXX → OOOXX');assert.match(result.text,/수레시아, 수리아 순으로 ON/);
result=run('初動 XXXXX\n1:12 ピオ OXXXX → XXXXX → XXOXX');assert.match(result.text,/피오 한번만, 수리아 ON/);assert.deepEqual(result.rows.at(-1).checked.slice(0,3),[false,false,true]);
result=run('1:12 ピオ スレシア SET → AUTO OFF → スリア SET → AUTO ON');assert.match(result.text,/수레시아 ON, AUTO 오프, 수리아 ON, AUTO 온/);
result=run('初動 AUTO ON 全員 SET');assert.equal(result.text,'AUTO 온, 전부 SET');assert.deepEqual(result.rows[0].checked,[true,true,true,true,true,true]);
for(const source of ['初動 ピオ SET\n1:12 ピオ スレシア SET\n1:12 ピオ スレシア 切','初動 OXXXX\n1:12 ピオ OXXXX → OOXXX → OOOXX','初動 AUTO ON 全員 SET']){
 result=run(source);const transfer=parseTacticTransfer(serializeTacticTransfer(ko,result.pasteText));
 const pasted=pastedRows(transfer.text,[],ko);assert.deepEqual(pasted.map(r=>r.checked),result.rows.map(r=>r.checked));
 let previous=[];for(const row of result.rows){previous=commandState(row.text,previous,ko);assert.deepEqual(previous,row.checked);}
}
console.log('PASS: ordered commands, AUTO order, conditions, once, dango and clipboard round-trip');
