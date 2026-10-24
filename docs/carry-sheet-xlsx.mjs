// Read only the XML needed by the carry-tactic sheet. Images and macros are never loaded.
const utf8=new TextDecoder();
const MAX_XML=12_000_000,MAX_TOTAL_XML=35_000_000;
const entity=text=>String(text??'').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,key)=>{
  if(key[0]==='#'){
    const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
    return n>0&&n<=0x10ffff?String.fromCodePoint(n):'�';
  }
  return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[key.toLowerCase()];
});
const attributes=text=>Object.fromEntries([...String(text).matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m=>[m[1],entity(m[2]??m[3])]));
function elements(xml,name){
  const tag='(?:[\\w.-]+:)?'+name;
  return [...String(xml).matchAll(new RegExp('<'+tag+'(?=[\\s/>])([^>]*?)(?:\\s*/>|>([\\s\\S]*?)</'+tag+'\\s*>)','g'))]
    .map(m=>({attrs:attributes(m[1]),inner:m[2]||''}));
}
const first=(xml,name)=>elements(xml,name)[0];
const textNodes=xml=>elements(String(xml).replace(/<(?:[\w.-]+:)?rPh\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?rPh>/g,''),'t').map(n=>entity(n.inner)).join('');
function zipPath(base,target){
  if(!target||/^[a-z]+:|\\|\0/i.test(target))throw Error('엑셀 내부 파일 경로가 올바르지 않습니다.');
  const parts=target.startsWith('/')?[]:base.split('/').slice(0,-1);
  for(const part of target.split('/')){
    if(!part||part==='.')continue;
    if(part==='..'){if(!parts.length)throw Error('엑셀 내부 파일 경로가 올바르지 않습니다.');parts.pop();}
    else parts.push(part);
  }
  return parts.join('/');
}
async function inflateRaw(bytes,expected){
  let stream;
  try{stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}
  catch{throw Error('이 브라우저는 엑셀 압축을 읽을 수 없습니다. 최신 Chrome·Edge·Safari에서 열어 주세요.');}
  const reader=stream.getReader(),chunks=[];let length=0;
  try{
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;
      if(length>expected||length>MAX_XML){await reader.cancel();throw Error('엑셀 XML 크기가 허용 범위를 초과했습니다.');}chunks.push(value);}
  }catch(error){throw Error(error.message||'엑셀 압축을 읽지 못했습니다. 파일을 다시 저장해 주세요.');}
  const result=new Uint8Array(length);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
let crcTable;
function crc32(bytes){
  crcTable??=Array.from({length:256},(_,i)=>{let n=i;for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
  let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;
}
export function openCarryZip(input,{inflate=inflateRaw}={}){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(bytes.length<22||bytes.length>45_000_000)throw Error('45MB 이하의 .xlsx 파일을 선택해 주세요.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}
  if(end<0)throw Error('엑셀 파일을 읽을 수 없습니다. .xlsx 형식으로 다시 저장해 주세요.');
  const count=view.getUint16(end+10,true),start=view.getUint32(end+16,true),size=view.getUint32(end+12,true);
  if(view.getUint16(end+4,true)||view.getUint16(end+6,true)||count===65535||count>12000||start+size>end)throw Error('분할·ZIP64 엑셀 파일은 지원하지 않습니다. 일반 .xlsx로 저장해 주세요.');
  const entries=new Map();let at=start,total=0;
  for(let i=0;i<count;i++){
    if(at+46>end||view.getUint32(at,true)!==0x02014b50)throw Error('엑셀 압축 목록이 손상되었습니다.');
    const nameLength=view.getUint16(at+28,true),extraLength=view.getUint16(at+30,true),commentLength=view.getUint16(at+32,true);
    if(at+46+nameLength+extraLength+commentLength>end)throw Error('엑셀 압축 목록이 손상되었습니다.');
    const name=utf8.decode(bytes.subarray(at+46,at+46+nameLength));
    if(entries.has(name))throw Error('엑셀 내부에 중복된 파일 경로가 있습니다.');
    entries.set(name,{flags:view.getUint16(at+8,true),method:view.getUint16(at+10,true),crc:view.getUint32(at+16,true),compressed:view.getUint32(at+20,true),length:view.getUint32(at+24,true),offset:view.getUint32(at+42,true)});
    at+=46+nameLength+extraLength+commentLength;
  }
  const cache=new Map();
  return {has:name=>entries.has(name),async text(name,optional=false){
    if(cache.has(name))return cache.get(name);
    const e=entries.get(name);if(!e){if(optional)return '';throw Error('엑셀 구성 파일이 없습니다: '+name);}
    if(e.flags&1)throw Error('암호가 설정된 엑셀 파일은 지원하지 않습니다.');
    if(e.length>MAX_XML||(total+=e.length)>MAX_TOTAL_XML)throw Error('엑셀 XML이 너무 큽니다. 필요한 시트만 남긴 사본을 사용해 주세요.');
    const off=e.offset;
    if(off+30>bytes.length||view.getUint32(off,true)!==0x04034b50)throw Error('엑셀 압축 데이터가 손상되었습니다.');
    const from=off+30+view.getUint16(off+26,true)+view.getUint16(off+28,true);
    if(from+e.compressed>start)throw Error('엑셀 압축 데이터가 손상되었습니다.');
    const packed=bytes.subarray(from,from+e.compressed);
    const unpacked=e.method===0?packed:e.method===8?await inflate(packed,e.length):null;
    if(!unpacked||unpacked.length!==e.length||crc32(unpacked)!==e.crc)throw Error('엑셀 압축 데이터가 손상되었거나 지원하지 않는 압축 방식입니다.');
    const xml=utf8.decode(unpacked);
    if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('외부 문서 참조가 포함된 엑셀 XML은 읽지 않습니다.');
    cache.set(name,xml);return xml;
  }};
}
function colorFrom(xml){
  const a=first(xml,'color')?.attrs;if(!a)return null;
  let rgb=a.rgb?.slice(-6);
  if(!rgb&&a.theme!==undefined)rgb=Number(a.theme)===0?'ffffff':Number(a.theme)===1?'000000':null;
  if(!rgb&&a.indexed!==undefined)rgb=({8:'000000',9:'ffffff',22:'c0c0c0',23:'808080',64:'000000'})[Number(a.indexed)];
  if(!rgb||!/^[\da-f]{6}$/i.test(rgb))return null;
  const tint=Number(a.tint||0);
  return '#'+[0,2,4].map(i=>{const n=parseInt(rgb.slice(i,i+2),16);return Math.max(0,Math.min(255,Math.round(tint<0?n*(1+tint):n+(255-n)*tint))).toString(16).padStart(2,'0');}).join('');
}
const mutedColor=color=>{
  if(!/^#[\da-f]{6}$/i.test(color||''))return false;
  const a=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  return Math.max(...a)-Math.min(...a)<=12&&Math.min(...a)>=110&&Math.max(...a)<=220;
};
function richText(xml){
  const runs=elements(xml,'r').map(r=>({text:textNodes(r.inner),color:colorFrom(first(r.inner,'rPr')?.inner||'')}));
  return {value:runs.length?runs.map(r=>r.text).join(''):textNodes(xml),runs};
}
export function parseCarrySheetXml(xml,{strings=[],fonts=[],formats=[],relationships={}}={}){
  const cells={};
  for(const c of elements(first(xml,'sheetData')?.inner||'','c')){
    const ref=c.attrs.r;if(!/^[A-Z]{1,3}[1-9]\d*$/.test(ref||''))continue;
    const v=entity(first(c.inner,'v')?.inner||''),style=formats[Number(c.attrs.s||0)]||{},font=fonts[Number(style.fontId||0)]||{};
    const rich=c.attrs.t==='s'?strings[Number(v)]||{value:'',runs:[]}:c.attrs.t==='inlineStr'?richText(first(c.inner,'is')?.inner||''):{value:v,runs:[]};
    const runs=rich.runs.length?rich.runs:[{text:rich.value,color:null}];
    const visible=runs.filter(r=>r.text.trim());
    cells[ref]={value:rich.value,gray:visible.length>0&&visible.every(r=>mutedColor(r.color||font.color)),color:font.color||null,formula:entity(first(c.inner,'f')?.inner||''),bold:!!font.bold};
  }
  const links={};for(const l of elements(xml,'hyperlink')){
    const target=relationships[l.attrs['r:id']];if(target&&/^https?:\/\//i.test(target))links[l.attrs.ref]=target;
  }
  return {cells,links,merges:elements(xml,'mergeCell').map(c=>c.attrs.ref)};
}
export async function readCarryWorkbook(input,options={}){
  const zip=openCarryZip(input,options),workbook=await zip.text('xl/workbook.xml');
  const relationXml=await zip.text('xl/_rels/workbook.xml.rels');
  const rels=Object.fromEntries(elements(relationXml,'Relationship').filter(r=>r.attrs.TargetMode!=='External').map(r=>[r.attrs.Id,zipPath('xl/workbook.xml',r.attrs.Target)]));
  const sharedRel=elements(relationXml,'Relationship').find(r=>/\/sharedStrings$/.test(r.attrs.Type));
  const styleRel=elements(relationXml,'Relationship').find(r=>/\/styles$/.test(r.attrs.Type));
  const stringsXml=await zip.text(sharedRel?rels[sharedRel.attrs.Id]:'xl/sharedStrings.xml',true);
  const stylesXml=await zip.text(styleRel?rels[styleRel.attrs.Id]:'xl/styles.xml',true);
  const strings=elements(stringsXml,'si').map(s=>richText(s.inner));
  const fonts=elements(first(stylesXml,'fonts')?.inner||'','font').map(f=>({color:colorFrom(f.inner),bold:!!first(f.inner,'b')}));
  const formats=elements(first(stylesXml,'cellXfs')?.inner||'','xf').map(f=>f.attrs);
  const sheets=[];let cellCount=0;
  for(const s of elements(workbook,'sheet')){
    const name=s.attrs.name;if(s.attrs.state==='hidden'||s.attrs.state==='veryHidden')continue;
    if(!/^[1-5]\s*넴$/.test(name)&&!/유의사항|사용방법/.test(name))continue;
    const path=rels[s.attrs['r:id']];if(!path)continue;
    const folder=path.slice(0,path.lastIndexOf('/')+1),base=path.slice(path.lastIndexOf('/')+1);
    const sr=await zip.text(folder+'_rels/'+base+'.rels',true);
    const relationships=Object.fromEntries(elements(sr,'Relationship').filter(r=>/\/hyperlink$/.test(r.attrs.Type)).map(r=>[r.attrs.Id,r.attrs.Target]));
    const parsed=parseCarrySheetXml(await zip.text(path),{strings,fonts,formats,relationships});
    cellCount+=Object.keys(parsed.cells).length;if(cellCount>250000)throw Error('시트 셀이 너무 많습니다. 보스별 택틱 시트만 남긴 파일을 사용해 주세요.');
    sheets.push({name,...parsed});
  }
  if(!sheets.some(s=>/^[1-5]\s*넴$/.test(s.name)))throw Error('1넴~5넴 탭을 찾지 못했습니다. 이월 모음 원본 형식의 .xlsx 파일을 선택해 주세요.');
  return {sheets};
}
