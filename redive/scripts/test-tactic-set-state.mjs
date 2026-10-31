import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {commandState,recalculateSetRows,restateSetRows,repairExcludedSetRows} from '../public/tactic-set-state.mjs';
import {commandState as workspaceCommand,recalculateTacticRows,restateTacticRows} from '../public/compat/tactics-model.mjs';
import {convertForeignTactic} from '../public/tactic-parser.mjs';

const party=['바이올렛','캬루','스미레(바이올렛)','수레시아','수리아'];
const bits=values=>values.map(Boolean);

test('workspace and external review use exactly the same SET interpreter',()=>{
  const starting=bits([0,0,0,0,0,0]);
  for(const line of ['1:30 전부 SET, AUTO OFF','0:59 스미레(바이올렛) 후 캬루 ON','캬루 ON, 캬루 OFF','수레시아, 수리아 순으로 ON']){
    assert.deepEqual(workspaceCommand(line,starting,party),commandState(line,starting,party));
  }
});

test('follow-up actor, ordered actions, AUTO, exclusion and one-time UB',()=>{
  assert.deepEqual(commandState('스미레(바이올렛) 후 캬루 ON',bits([0,0,0,0,0,0]),party),bits([0,1,0,0,0,0]));
  assert.deepEqual(commandState('캬루 ON, 캬루 OFF',bits([0,0,0,0,0,0]),party),bits([0,0,0,0,0,0]));
  assert.deepEqual(commandState('캬루 한번만',bits([0,1,0,0,0,0]),party),bits([0,1,0,0,0,0]));
  assert.deepEqual(commandState('캬루 한번만',bits([0,0,0,0,0,0]),party),bits([0,0,0,0,0,0]));
  assert.deepEqual(commandState('수레시아, 수리아 순으로 ON, AUTO ON',bits([0,0,0,0,0,0]),party),bits([0,0,0,1,1,1]));
  assert.deepEqual(commandState('캬루 제외 전부 OFF',bits([1,1,1,1,1,1]),party),bits([0,1,0,0,0,1]));
  assert.deepEqual(commandState('전부 OFF (캬루 제외)',bits([1,1,1,1,1,1]),party),bits([0,1,0,0,0,1]));
  for(const source of ['전부SET','全SET','开始UBSET:全员'])assert.deepEqual(commandState(source,bits([0,0,0,0,0,0]),party),bits([1,1,1,1,1,0]),source);
});

test('editing one row recalculates downstream auto rows, but respects checked overrides',()=>{
  const rows=[
    {text:'전부 OFF, AUTO OFF',checked:bits([0,0,0,0,0,0]),manualChecks:false},
    {text:'캬루 ON',checked:bits([0,0,0,0,0,0]),manualChecks:false},
    {text:'캬루 한번만, 수리아 ON',checked:bits([0,0,0,0,0,0]),manualChecks:false},
    {text:'바이올렛 OFF',checked:bits([1,1,1,1,1,1]),manualChecks:true},
    {text:'수리아 OFF',checked:bits([0,0,0,0,0,0]),manualChecks:false}
  ];
  recalculateSetRows(rows,party);
  assert.deepEqual(rows[2].checked,bits([0,1,0,0,1,0]));
  assert.deepEqual(rows[3].checked,bits([1,1,1,1,1,1]));
  assert.deepEqual(rows[4].checked,bits([1,1,1,1,0,1]));
  rows[1].text='캬루 OFF';
  recalculateTacticRows(rows,party,[],1);
  assert.deepEqual(rows[2].checked,bits([0,0,0,0,1,0]));
  assert.deepEqual(rows[3].checked,bits([1,1,1,1,1,1]));
});

test('short exclusion commands preserve the named member for both starting states and AUTO settings',()=>{
 for(let excluded=0;excluded<5;excluded++)for(const enabled of [false,true])for(const excludedState of [false,true]){
  const before=Array(6).fill(!enabled);before[excluded]=excludedState;
  const expected=Array(6).fill(enabled);expected[excluded]=excludedState;expected[5]=before[5];
  const line=party[excluded]+' 제외 '+(enabled?'ON':'OFF');
  assert.deepEqual(commandState(line,before,party),expected,line);
  assert.deepEqual(workspaceCommand(line,before,party),expected,line);
 }
 assert.deepEqual(commandState('스미레(바이올렛) 후 캬루 한번만, 캬루 제외 SET, AUTO ON',[],party),bits([1,0,1,1,1,1]));
});

test('converted exclusion rows retain identical SET flags when the workspace recalculates them',()=>{
 for(const source of [
  '1:30 ○○✕○○ AUTO ON\n0:30 ✕✕✕✕✕\n0:20 ○○✕○○',
  '1:30 ○○○○○ AUTO ON\n0:30 ✕✕○✕✕',
  '1:30 ✕✕✕✕✕ AUTO OFF\n0:59 キャラ5 ○○○○○\nキャラ2 ○✕○○○'
 ]){
  const result=convertForeignTactic(source,party),rows=structuredClone(result.rows);
  recalculateSetRows(rows,party);
  assert.deepEqual(rows.map(row=>row.checked),result.rows.map(row=>row.checked),source);
 }
});

test('stored Grace exclusion repairs the initial row and all subsequent automatic rows',()=>{
 const names=['메두사','사쿠라','그레이스','알리스','할무기'];
 const rows=[
  ['AUTO 온, 그레이스 제외 SET',[0,0,1,0,0,1]],
  ['1:12 메두사 후 그레이스 ON, AUTO 온',[0,0,1,0,0,1]],
  ['1:07 할무기 후 AUTO 온, 그레이스 OFF',[0,0,0,0,0,1]],
  ['0:57 할무기 후 그레이스 ON, AUTO 온, 메두사 OFF',[0,0,1,0,0,1]],
  ['0:50 메두사 후 메두사 ON, AUTO 온',[1,0,1,0,0,1]],
  ['0:27 할무기 후 AUTO 온, 할무기 OFF',[1,0,1,0,0,1]]
 ].map(([text,checked],i)=>({id:'grace-'+i,text,checked:bits(checked),manualChecks:false}));
 const originals=rows.map(({checked,...rest})=>rest);
 assert.equal(repairExcludedSetRows(rows,names),6);
 assert.deepEqual(rows.map(row=>row.checked),[
  [1,1,0,1,1,1],[1,1,1,1,1,1],[1,1,0,1,1,1],
  [0,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,0,1]
 ].map(bits));
 assert.deepEqual(rows.map(({checked,...rest})=>rest),originals);
 assert.equal(repairExcludedSetRows(rows,names),0);
});

test('exclusion repair respects manual and legacy checkbox rows and ignores unknown exception names',()=>{
 const names=['메두사','사쿠라','그레이스','알리스','할무기'];
 const rows=[
  {text:'그레이스 제외 SET',checked:bits([0,0,1,0,0,0]),manualChecks:false},
  {text:'메두사 OFF',checked:bits([0,1,0,0,0,0]),manualChecks:true},
  {text:'그레이스 ON',checked:bits([1,1,1,1,1,1]),manualChecks:false},
  {text:'할무기 OFF',checked:bits([1,0,1,0,1,1])}
 ];
 const manual=structuredClone(rows[1]),legacy=structuredClone(rows[3]);
 assert.equal(repairExcludedSetRows(rows,names),2);
 assert.deepEqual(rows[1],manual);assert.deepEqual(rows[3],legacy);
 assert.deepEqual(rows[2].checked,bits([0,1,1,0,0,0]));
 const unknown=[{text:'없는캐릭 제외 SET',checked:bits([0,1,0,0,0,0]),manualChecks:false}];
 assert.equal(repairExcludedSetRows(unknown,names),0);
 const explicit=[{text:'그레이스 제외 SET',checked:bits([0,0,1,0,0,0]),manualChecks:true}];
 assert.equal(repairExcludedSetRows(explicit,names),0);
});


test('initial five-symbol O/X snapshots are interpreted before AUTO commands',()=>{
 const party=['수사렌','수리코','수미미','수페코','사루카'];
 const zeros=bits([0,0,0,0,0,0]);
 assert.deepEqual(commandState('1:30 OOOOO AUTO ON',zeros,party),bits([1,1,1,1,1,1]));
 assert.deepEqual(commandState('1:30 [xoxxo] AUTO OFF',zeros,party),bits([0,1,0,0,1,0]));
 assert.deepEqual(commandState('1:30 [〇⭕️ー❌○] AUTO OFF',zeros,party),bits([1,1,0,0,1,0]));
 assert.deepEqual(commandState('1:30 [OOOOO] 오토 OFF',zeros,party),bits([1,1,1,1,1,0]));
});

test('SET restatement preserves manual snapshots with descriptive rows and recomputes explicit commands',()=>{
 const party=['수사렌','수리코','수미미','수페코','사루카'];
 const rows=[
  {text:'AUTO OFF, 수페코 제외 SET',checked:bits([1,1,1,0,1,0]),manualChecks:true},
  {text:'1:14 수페코 디저트 버프 후딜캔',checked:bits([1,1,1,0,1,0]),manualChecks:true},
  {text:'1:08 수페코 ON',checked:bits([1,1,1,1,1,0]),manualChecks:true},
  {text:'1:05 사루카 (중간딜 6020만)',checked:bits([1,1,1,1,1,0]),manualChecks:true},
  {text:'0:32 수페코 OFF',checked:bits([0,0,0,0,0,0]),manualChecks:false}
 ];
 const result=restateSetRows(rows,party);
 assert.equal(result.preserved,2);
 assert.deepEqual(rows.map(row=>row.checked),[
  [1,1,1,0,1,0],
  [1,1,1,0,1,0],
  [1,1,1,1,1,0],
  [1,1,1,1,1,0],
  [1,1,1,0,1,0]
 ].map(bits));
 assert.equal(rows[1].manualChecks,true);
 assert.equal(rows[3].manualChecks,true);
 assert.equal(rows[2].manualChecks,false);
});

test('imported sourceSnapshot and first-row AUTO-only instructions retain real starting state',()=>{
 const party=['바이올렛','캬루','스미레(바이올렛)','수레시아','수리아'];
 const rows=[
  {text:'AUTO OFF',checked:bits([1,1,1,1,1,1]),manualChecks:true},
  {text:'1:24 표시만',sourceSnapshot:'[OOXXO]',checked:bits([1,1,0,0,1,0]),manualChecks:false},
  {text:'0:32 수레시아 ON, AUTO ON',checked:bits([0,0,0,0,0,0]),manualChecks:false}
 ];
 const result=restateSetRows(rows,party);
 assert.equal(result.preserved,1);
 assert.deepEqual(rows.map(row=>row.checked),[
  [1,1,1,1,1,0],[1,1,0,0,1,0],[1,1,0,1,1,1]
 ].map(bits));
});


test('both deployed editors use the safe restatement path without wiping every manual checkbox',()=>{
 for(const relative of ['../public/app.js','../../docs/compact/app.js']){
  const source=fs.readFileSync(new URL(relative,import.meta.url),'utf8');
  assert.match(source,/if\(action==='v2-restate'\)[^\n]*legacyTools\.restateTacticRows/);
  assert.doesNotMatch(source,/for\(const row of rows\)row\.manualChecks=false/);
 }
 const party=['수사렌','수리코','수미미','수페코','사루카'];
 const rows=[{text:'1:30 [OOOOO] AUTO ON',checked:Array(6).fill(false),manualChecks:true}];
 assert.deepEqual(restateTacticRows(structuredClone(rows),party),restateSetRows(structuredClone(rows),party));
});
