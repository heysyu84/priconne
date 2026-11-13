import assert from 'node:assert/strict';
import {sqlite,control,reset,savedState,request} from './api-test-fixture.mjs';
const {PUT}=await import('../app/api/state/route.ts');
const past='2026-09',older='2026-08';
const put=(data,restoreArchives=true,editor=true)=>PUT(request('/api/state',{revision:1,data,archiveMode:'v1',restoreArchives},{'X-Nyang-Client':'4',...(editor?{'x-test-editor':'yes'}:{})}));
const archive=month=>sqlite.prepare('SELECT payload FROM clan_archive_months WHERE month=?').get(month)?.payload;
function fixture(){
  const state=reset(),old=structuredClone(state.months[state.active]);old.month=past;
  sqlite.prepare('INSERT INTO clan_archive_months VALUES(?,?,?)').run(past,JSON.stringify({...old,marker:'original'}),'original');
  const draft=structuredClone(state);
  draft.months[past]={...old,marker:'draft'};draft.months[older]={...old,month:older,marker:'new-archive'};
  return {state,draft};
}
for(const restore of [true,false]){
  const {draft}=fixture();let winner;
  control.beforeBatch=()=>{
    sqlite.prepare('UPDATE clan_state SET revision=2,updated_at=? WHERE id=?').run('winner','main');
    sqlite.prepare('UPDATE clan_archive_months SET payload=?,updated_at=? WHERE month=?').run(JSON.stringify({marker:'winner'}),'winner',past);
    winner={current:savedState().payload,archive:archive(past)};
  };
  assert.equal((await put(draft,restore)).status,409);
  assert.equal(savedState().revision,2);assert.equal(savedState().payload,winner.current);
  assert.equal(archive(past),winner.archive);assert.equal(archive(older),undefined);
}
console.log('PASS rejected concurrent saves cannot replace or add archives');
for(const restore of [true,false]){
  const {state,draft}=fixture(),original=archive(past);
  assert.equal((await put(draft,restore)).status,200);
  assert.equal(savedState().revision,2);
  assert.deepEqual(JSON.parse(savedState().payload).months,state.months);
  assert.equal(archive(past),restore?JSON.stringify(draft.months[past]):original);
  assert.equal(archive(older),JSON.stringify(draft.months[older]));
}
console.log('PASS a successful batch handles all archives, including existing ones, without changing battle records');
{
  const state=reset();assert.equal((await put(state)).status,200);assert.equal(savedState().revision,2);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM clan_archive_months').get().n,0);
  const snapshot=savedState().payload;assert.equal((await put(state,true,false)).status,403);assert.equal(savedState().payload,snapshot);
}
{
  const {draft}=fixture(),before=savedState().payload,old=archive(past);
  sqlite.exec("CREATE TRIGGER reject_archive BEFORE INSERT ON clan_archive_months BEGIN SELECT RAISE(ABORT,'fixture archive failure'); END;");
  assert.equal((await put(draft)).status,503);
  assert.equal(savedState().revision,1);assert.equal(savedState().payload,before);assert.equal(archive(past),old);assert.equal(archive(older),undefined);
  sqlite.exec('DROP TRIGGER reject_archive');
}
console.log('PASS current-only saves, editor gate, and rollback after archive failure');
sqlite.close();
