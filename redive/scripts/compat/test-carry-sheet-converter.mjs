import assert from 'node:assert/strict';
import {deflateRawSync,inflateRawSync,crc32} from 'node:zlib';
import {readCarryWorkbook,openCarryZip,parseCarrySheetXml} from '../../public/compat/carry-sheet-xlsx.mjs';
import {convertCarryWorkbook,minimumCarryDamage,checkpointDamage,carryTacticPaste,carryTacticMetadata} from '../../public/compat/carry-sheet-converter.mjs';
import {serializeTacticTransfer,parseTacticTransfer} from '../../public/compat/tactic-transfer.mjs';
import {pastedRows} from '../../public/compat/tactics-model.mjs';

for(const [source,result]of [['3200','0.32'],['3850~3880','0.38'],['2910~2950','0.29'],['1억 5740~1억 6000','1.57'],['14600','1.46'],['0.329억','0.32']])assert.equal(minimumCarryDamage(source),result);
assert.equal(checkpointDamage('1억 370'),'1억 370만');
assert.equal(checkpointDamage('3080.0'),'3080만');
assert.throws(()=>minimumCarryDamage('미검증'));
const names=['수사렌','수리코','수미미','수페코','사루카'];
const catalog=names.map(name=>({name,aliases:[],byStar:name==='수페코'?{'6':'/6.png'}:{'5':'/5.png'}}));
const cell=value=>({value,gray:false});
const cells={B6:cell('6010~6020'),E6:cell('26초'),D13:cell('Set [OOOXO] (AUTO:❌)'),
 B14:cell('1:14'),C14:cell('수페코 디저트 버프 후딜캔'),
 B15:cell('1:08'),C15:cell('수페코 디저트 버프 후딜캔'),E15:cell('[OOOOO]'),F15:cell('3080'),
 B16:cell('1:05'),C16:{value:'수페코 → 사루카',gray:true},F16:cell('6020'),
 B17:cell('✅유의사항: 뉴페코 미보유 가능\n사용 TP차지: 수사렌 전2 풀강 기준 최소 2.0 이상\n영상')};
names.forEach((name,i)=>cells['BCDEF'[i]+'11']=cell(name));
const result=convertCarryWorkbook({sheets:[{name:'1넴',cells,links:{B17:'https://youtu.be/test'},merges:[]}]},{catalog});
assert.equal(result.tactics.length,1);const t=result.tactics[0];
assert.equal(t.rows[1].text,'1:14 디저트 버프 후딜캔 수페코 한번만');
assert.equal(t.rows[1].checked[3],false);
assert.equal(t.rows[2].text,'1:08 디저트 버프 후딜캔 수페코 ON (중간딜 3080만)');
assert.equal(t.rows[2].checked[3],true);
assert.equal(t.rows[3].text,'1:05 (중간딜 6020만)');
assert.deepEqual(t.rows[3].checked,[true,true,true,true,true,false]);
assert.equal(t.tp,'2.0+ (수사렌 전2 풀강 기준)');
assert.ok(!/TP/.test(t.note));assert.match(t.note,/뉴페코 미보유 가능/);assert.match(t.note,/26초/);
assert.deepEqual(t.stars,['5','5','5','6','5']);
const transfer=parseTacticTransfer(serializeTacticTransfer(t.characters,carryTacticPaste(t),carryTacticMetadata(t)));
assert.equal(transfer.metadata.group,'이월 택틱');assert.equal(transfer.metadata.expectedDamage,'0.60');
assert.equal(transfer.metadata.video,'https://youtu.be/test');assert.equal(transfer.metadata.tp,t.tp);
const rows=pastedRows(transfer.text,[],transfer.characters,catalog);
assert.deepEqual(rows.map(r=>r.checked),t.rows.map(r=>r.checked));
assert.deepEqual(rows.map(r=>r.text),t.rows.map(r=>r.text));
assert.equal(parseTacticTransfer(serializeTacticTransfer(names,'FALSE\tFALSE\tFALSE\tFALSE\tFALSE\tFALSE\t이전 형식')).metadata,undefined);
assert.throws(()=>serializeTacticTransfer(names,'본문',{...carryTacticMetadata(t),video:'javascript:alert(1)'}));

const styled=parseCarrySheetXml('<worksheet><sheetData><row r="1"><c r="C1" s="1" t="inlineStr"><is><t>자동 진행</t></is></c><c r="D1" s="1" t="inlineStr"><is><r><rPr><color rgb="FF000000"/></rPr><t>수동</t></r></is></c></row></sheetData></worksheet>',{fonts:[{}, {color:'#999999'}],formats:[{}, {fontId:1}]});
assert.equal(styled.cells.C1.gray,true);assert.equal(styled.cells.D1.gray,false);

// A minimal real XLSX package exercises ZIP deflate, XML entities, workbook relationships,
// inline cells and styles without publishing the user's workbook or its images.
function zip(entries){
 let offset=0;const locals=[],central=[];
 for(const [name,xml]of Object.entries(entries)){
  const n=Buffer.from(name),data=Buffer.from(xml),packed=deflateRawSync(data),crc=crc32(data);
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(n.length,26);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
  locals.push(local,n,packed);central.push(c,n);offset+=local.length+n.length+packed.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(entries).length,8);end.writeUInt16LE(Object.keys(entries).length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,directory,end]);
}
const sample=zip({'xl/workbook.xml':'<workbook><sheets><sheet name="1넴" r:id="r1"/></sheets></workbook>',
 'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml" Type="sheet"/></Relationships>',
 'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row><c r="C1" t="inlineStr"><is><t>수페코 &amp; 수미미</t></is></c></row></sheetData></worksheet>'});
const workbook=await readCarryWorkbook(sample,{inflate:async b=>inflateRawSync(b)});
assert.equal(workbook.sheets[0].cells.C1.value,'수페코 & 수미미');
assert.throws(()=>openCarryZip(Buffer.from('not an excel file')));
const corrupted=Buffer.from(sample);corrupted[45]^=1;
await assert.rejects(()=>readCarryWorkbook(corrupted,{inflate:async b=>inflateRawSync(b)}));
console.log('PASS: carry XLSX, gray checkpoints, implicit single UB, SET changes, damage/TP/note separation and metadata clipboard round-trip');
