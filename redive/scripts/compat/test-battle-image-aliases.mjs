import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseBattleLogText} from '../../public/compat/battle-image-parser.mjs';

const source=await readFile(new URL('../../src/retained-tools.js',import.meta.url),'utf8');
const start=source.indexOf('const imageNicknameKey='),end=source.indexOf('batchImportPage=',start);
assert.ok(start>=0&&end>start,'Extract the actual screenshot importer integration');

function importer(members=[{id:'a',name:'사이트이름',aliases:[]},{id:'b',name:'다른회원',aliases:['Previous.Name']}]){
  const state={admin:true,editable:true,saves:0,snapshots:[],data:{members}};
  const context={
    data:state.data,ext:{},ui:{month:'2026-10'},
    legacyTools:{createBattleImageImport:options=>options},
    adminMode:()=>state.admin,ensureEdit:()=>state.editable,
    checkpoint:()=>state.snapshots.push(structuredClone(state.data)),persist:()=>state.saves++,
    toggleWriter(){},toast(){},render(){}
  };
  const callbacks=vm.runInNewContext(source.slice(start,end)+'\nscreenshotImporter();',context);
  return {...state,permissions:state,callbacks};
}

const app=importer(),{saveNicknameAlias:save,removeNicknameAlias:remove}=app.callbacks;
assert.equal(typeof save,'function');assert.equal(typeof remove,'function');
assert.equal(save('a','  Ｎｅｗ　Ｎａｍｅ  ').ok,true);
assert.deepEqual([...app.data.members[0].aliases],['New Name']);
assert.equal(app.data.members[0].name,'사이트이름','Keep the site nickname unchanged');
assert.deepEqual(app.snapshots[0].members[0].aliases,[],'Checkpoint must precede the mutation');
assert.equal(app.permissions.saves,1);
assert.equal(parseBattleLogText('New Name',{roster:app.data.members,memberField:true}).memberId,'a');

// A reload uses persisted aliases rather than the importer's temporary name mappings.
const reloaded=importer(structuredClone(app.data.members));
assert.equal(parseBattleLogText('New Name',{roster:reloaded.data.members,memberField:true}).memberId,'a');
assert.equal(save('a','new-name').ok,true);
assert.equal(app.permissions.saves,1,'Equivalent aliases do not create additional writes');
assert.equal(save('a','Previous_Name').ok,false,'Reject aliases already linked to someone else');
assert.equal(save('a','다른 회원').ok,false,'Reject another site nickname after parser normalization');
assert.equal(app.permissions.saves,1);

for(const value of ['', '   ', '._-()[]·', 'x'.repeat(41), '닉\n네임', '닉\u007f네임']){
  assert.equal(save('a',value).ok,false,JSON.stringify(value));
}
assert.equal(save('missing','새이름').ok,false);
assert.equal(app.permissions.saves,1,'Invalid aliases must not mutate or persist');

app.permissions.admin=false;
assert.equal(save('a','잠금이름').ok,false);assert.equal(remove('a','New Name').ok,false);
app.permissions.admin=true;app.permissions.editable=false;
assert.equal(save('a','동기화충돌').ok,false);assert.equal(remove('a','New Name').ok,false);
assert.equal(app.permissions.saves,1,'Blocked edits must not persist');
app.permissions.editable=true;

assert.equal(remove('a','ＮＥＷ_ＮＡＭＥ').ok,true);
assert.deepEqual([...app.data.members[0].aliases],[]);
assert.deepEqual(app.snapshots[1].members[0].aliases,['New Name']);
assert.equal(app.permissions.saves,2);
assert.equal(remove('a','New Name').ok,true,'Removing an absent alias is idempotent');
assert.equal(remove('missing','New Name').ok,false);
assert.equal(app.permissions.saves,2);
assert.equal(parseBattleLogText('New Name',{roster:app.data.members,memberField:true}).memberId,'');

console.log('PASS: screenshot alias callbacks persist, survive reload, reject conflicts and respect edit locks');
