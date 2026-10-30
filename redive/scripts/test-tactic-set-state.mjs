import assert from 'node:assert/strict';
import test from 'node:test';
import {commandState,recalculateSetRows} from '../public/tactic-set-state.mjs';
import {commandState as workspaceCommand,recalculateTacticRows} from '../public/compat/tactics-model.mjs';

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
