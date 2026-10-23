import {parseBattleLogText,parseQuickLogText,detectDuplicateRows,sortBattleLogRows,validBattleLogRow} from './battle-image-parser.mjs?v=20261023-image01';
import {makeId,memberLabel} from './roster.mjs?v=20261022-ui14';

const OCR_URL='https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
let ocrPromise=null;
function loadOcr(){
 if(globalThis.Tesseract?.createWorker)return Promise.resolve(globalThis.Tesseract);
 if(ocrPromise)return ocrPromise;
 ocrPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=OCR_URL;script.async=true;
  script.onload=()=>globalThis.Tesseract?.createWorker?resolve(globalThis.Tesseract):reject(new Error('OCR 엔진이 로드되지 않았습니다.'));
  script.onerror=()=>reject(new Error('OCR 엔진을 내려받지 못했습니다. 인터넷 연결을 확인해 주세요.'));
  document.head.append(script);
 }).catch(e=>{ocrPromise=null;throw e;});
 return ocrPromise;
}
function toCanvas(bitmap,frame){
 const width=Math.floor(bitmap.width*frame.w),height=Math.floor(bitmap.height*frame.h);
 const scale=Math.min(2.4,2100/Math.max(1,width),720/Math.max(1,height));
 const canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.imageSmoothingQuality='high';
 ctx.drawImage(bitmap,Math.round(bitmap.width*frame.x),Math.round(bitmap.height*frame.y),width,height,0,0,canvas.width,canvas.height);
 return canvas;
}
const detailFrames=[
 {x:.133,y:.252,w:.563,h:.176},{x:.133,y:.438,w:.563,h:.172},{x:.133,y:.623,w:.563,h:.165}
];
const quickFrame={x:.711,y:.242,w:.215,h:.565};
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const formatNumber=n=>Number(n||0).toLocaleString('ko-KR');
export function createBattleImageImport(api){
 const {getApp,getMonth,persist,render,navigate,notify,canEdit,unlock,replay,beforeCommit}=api;
 const state={rows:[],processing:false,cancel:false,progress:'',mode:'detail',ocrStatus:'',errors:[],day:null,raw:'',completed:0,total:0};
 const $=id=>document.getElementById(id);
 const month=()=>getMonth();
 const members=()=>getApp().roster.filter(p=>(month().memberIds||[]).includes(p.id));
 const validDays=()=>Math.max(1,Number(month().options?.days)||5);
 const defaultDay=()=>Math.max(1,...month().events.map(e=>Number(e.day)||1),...(month().dayBreaks||[]).map(e=>Number(e.nextDay)||1));
 const selectedDay=()=>Math.min(validDays(),Math.max(1,Number(state.day??defaultDay())));
 const setDay=value=>{state.day=Math.min(validDays(),Math.max(1,Number(value)||1));};
 const normalized=()=>detectDuplicateRows(state.rows.map(x=>({...x,day:selectedDay()})),month().events);
 function score(row){
  const errs=validBattleLogRow(row,{monthKey:getApp().active,members:members(),bosses:month().bosses,day:selectedDay()});
  if(row.stage && !/^[1-6]$/.test(String(row.stage)))errs.push('단계 표기 확인');
  return errs;
 }
 const editingAllowed=()=>!!canEdit();
 const errors=()=>normalized().filter(r=>r.selected).flatMap(r=>score(r));
 function options(rows,value,blank='선택하세요'){
  return '<option value="">'+escapeHtml(blank)+'</option>'+rows.map(o=>'<option value="'+escapeHtml(o.id)+'" '+(String(o.id)===String(value)?'selected':'')+'>'+escapeHtml(o.name)+'</option>').join('');
 }
 function itemHtml(row,index){
  const warnings=score(row),bad=warnings.length>0;
  const memberOptions=options(members().map(p=>({id:p.id,name:memberLabel(p,getApp().roster)})),row.memberId,'클랜원 확인');
  const bossOptions=options(month().bosses.map(b=>({id:b.id,name:b.id+'넴 · '+b.name})),row.bossId,'보스 확인');
  return '<div class="bli-row '+(bad?'needs-check':'')+'" data-bli-id="'+escapeHtml(row.id)+'">'+
   '<div class="bli-row-top"><label><input type="checkbox" data-bli-field="selected" '+(row.selected?'checked':'')+' '+(bad?'disabled':'')+'> 등록</label>'+
   '<strong>#'+(index+1)+'</strong><span>'+escapeHtml(row.source||'입력')+'</span>'+
   '<button class="btn sm" type="button" data-bli-remove="'+escapeHtml(row.id)+'">삭제</button></div>'+
   '<div class="bli-fields">'+
   '<label>공격 일시<input data-bli-field="gameAt" type="datetime-local" value="'+escapeHtml(row.gameAt||'')+'"></label>'+
   '<label>클랜원<select data-bli-field="memberId">'+memberOptions+'</select></label>'+
   '<label>보스<select data-bli-field="bossId">'+bossOptions+'</select></label>'+
   '<label>기록 피해량<input data-bli-field="damage" type="text" inputmode="numeric" value="'+escapeHtml(row.damage===''?'':formatNumber(row.damage))+'" placeholder="정확한 숫자"></label>'+
   '<label class="bli-carry">이월 사용<input type="checkbox" data-bli-field="carry" '+(row.carry?'checked':'')+'></label></div>'+
   '<div class="bli-row-note">'+(row.stage?'<span>화면 단계: '+escapeHtml(row.stage)+'단계</span>':'')+
   (bad?'<strong>검토: '+escapeHtml(warnings.join(' · '))+'</strong>':'<span>등록 가능</span>')+'</div>'+
   '<details><summary>인식된 원문 확인</summary><pre>'+escapeHtml(row.rawText||'')+'</pre></details></div>';
 }
 function view(){
  if(!editingAllowed())return '<section class="panel bli-shell"><h2>이미지 일괄 등록</h2><p>관리자 작성 잠금을 해제해야 사용할 수 있습니다.</p><button class="btn" type="button" data-bli="unlock">작성 잠금 해제</button><button class="btn" type="button" data-page="battle">배틀로그로 돌아가기</button></section>';
  const rows=sortBattleLogRows(normalized());
  const day=selectedDay();
  const count=rows.filter(r=>r.selected&&!score(r).length).length;
  return '<section class="panel bli-shell"><div class="bli-head"><div><h2>공격 이력 이미지 일괄 등록</h2>'+
   '<p class="muted">이미지는 브라우저에서만 임시 처리합니다. 서버에는 확정한 공격 기록만 저장하며, OCR은 첫 사용 시 언어 모델을 내려받습니다.</p></div>'+
   '<button class="btn sm" type="button" data-page="battle">← 배틀로그</button></div>'+
   '<div class="bli-upload">'+
   '<label class="field"><span>스크린샷 형식</span><select id="bli-mode"><option value="detail" '+(state.mode==='detail'?'selected':'')+'>전투 로그 상세 (추천 · 이미지당 약 3건)</option><option value="quick" '+(state.mode==='quick'?'selected':'')+'>우측 간단 로그 (공격 시각 수동 확인)</option></select></label>'+
   '<div class="bli-pick"><label class="btn primary" for="bli-files">＋ 스크린샷 여러 장 선택</label><input type="file" id="bli-files" accept="image/png,image/jpeg,image/webp" multiple hidden><span>PNG · JPG · WebP / 1회 최대 60장, 장당 25MB</span></div>'+
   '<div class="bli-controls"><button type="button" class="btn" data-bli="analyze" '+(state.processing?'disabled':'')+'>선택 이미지 분석 시작</button>'+
   (state.processing?'<button type="button" class="btn" data-bli="cancel">다음 이미지부터 중단</button>':'')+
   '<button type="button" class="btn" data-bli="clear" '+(state.processing?'disabled':'')+'>미리보기 비우기</button></div>'+
   '<p class="bli-progress" id="bli-progress" role="status">'+escapeHtml(state.progress||'파일은 분석 전까지 브라우저 메모리에만 보관합니다.')+'</p></div>'+
   '<details class="bli-manual"><summary>OCR 텍스트 직접 붙여넣기 · 잘못 인식된 화면 재분석</summary>'+
   '<p class="muted">이미지 인식이 실패했으면 추출한 텍스트를 직접 입력해 기록을 추가할 수 있습니다. 행 별 값은 아래에서 편집 가능합니다.</p>'+
   '<textarea id="bli-raw" rows="5" placeholder="일시 2026/09/28 23:53&#10;다람이&#10;데미카리드 4단계째 입힌 데미지 189633896">'+escapeHtml(state.raw)+'</textarea>'+
   '<button class="btn sm" type="button" data-bli="parse-text">텍스트 분석하여 추가</button></details>'+
   '<div class="bli-review"><h3>등록 전 확인 <span class="pill">'+rows.length+'건</span></h3>'+
   '<div class="bli-review-controls"><label>적용 일차<select id="bli-day">'+Array.from({length:validDays()},(_,i)=>'<option value="'+(i+1)+'" '+(i+1===day?'selected':'')+'>'+(i+1)+'일차</option>').join('')+'</select></label>'+
   '<span class="muted">현재 '+escapeHtml(getApp().active)+'월 기록 · 등록 시 맨 뒤에 시간순 추가</span></div>'+
   (state.errors.length?'<div class="bli-warning">'+escapeHtml(state.errors.join('\n'))+'</div>':'')+
   (rows.length?rows.map(itemHtml).join(''):'<p class="muted">인식된 기록이 없습니다. 이미지를 선택해 분석하거나 텍스트를 추가해 주세요.</p>')+
   '<div class="bli-bottom"><strong>등록 가능한 선택 기록 '+count+'건</strong><button class="btn primary" type="button" data-bli="commit" '+(!count||state.processing?'disabled':'')+'>검토한 '+count+'건 일괄 등록</button></div>'+
   '<p class="muted">날짜·닉네임·피해량·보스는 반드시 확인하세요. 중복 또는 현재 클전 월과 다른 기록은 자동으로 등록하지 않습니다. 이월 여부는 직접 지정해야 합니다.</p></div></section>';
 }
 // Excludes screenshots from persistence: File/Bitmap/Canvas are not serialized.
 let picked=[];
 let jobId=0;
 async function analyze(){
  if(state.processing||!editingAllowed())return;
  if(!picked.length){notify('스크린샷을 먼저 선택하세요.');return;}
  state.processing=true;state.cancel=false;state.errors=[];state.total=picked.length;state.completed=0;
  const files=picked.splice(0);
  state.progress='OCR 엔진 및 한국어 모델 준비 중…';render();
  let worker=null,run=++jobId;
  try{
   const Tesseract=await loadOcr();
   if(run!==jobId||state.cancel)return;
   worker=await Tesseract.createWorker('kor+eng',1,{
     logger:message=>{if(run!==jobId)return;if(message.status==='recognizing text'){
       const percent=Math.round(Number(message.progress||0)*100);
       const el=$('bli-progress');if(el)el.textContent='이미지 '+(state.completed+1)+'/'+state.total+' · 문자 분석 '+percent+'%';
     }}
   });
   for(const file of files){
    if(state.cancel||run!==jobId)break;
    try{
     const bitmap=await createImageBitmap(file);
     try{
      const frames=state.mode==='detail'?detailFrames:[quickFrame];
      for(let i=0;i<frames.length;i++){
       if(state.cancel)break;
       const canvas=toCanvas(bitmap,frames[i]);
       const result=await worker.recognize(canvas);
       canvas.width=0;canvas.height=0;
       const text=result.data?.text||'';
       const options={roster:members(),bosses:month().bosses,source:file.name+' · '+(i+1)+'행'};
       const parsed=state.mode==='detail'? [parseBattleLogText(text,options)].filter(Boolean):
         parseQuickLogText(text,options);
       for(const row of parsed){
         if(!row.damage && !row.memberName && !row.bossId && !row.gameAt)continue;
         row.order=state.rows.length;row.selected=true;state.rows.push(row);
       }
      }
     }finally{bitmap.close();}
    }catch(error){state.errors.push(file.name+': '+(error.message||'이미지 처리 실패'));}
    state.completed++;
    state.progress=state.completed+'/'+state.total+'장 분석 완료';const status=$('bli-progress');if(status)status.textContent=state.progress;
   }
  }catch(error){state.errors.push('이미지 인식 실패: '+(error.message||String(error)));state.progress='이미지 분석에 실패했습니다.';}
  finally{
   if(worker)await worker.terminate().catch(()=>{});
   files.length=0;picked.length=0;
   state.processing=false;state.cancel=false;
   updateRows(true);
   state.progress+= ' · 수정할 기록을 확인한 뒤 등록하세요.';render();
  }
 }
 function updateRows(selectNew=false){
  const checked=detectDuplicateRows(state.rows.map(x=>({...x,day:selectedDay()})),month().events);
  state.rows=checked.map(r=>{
    const ok=validBattleLogRow(r,{monthKey:getApp().active,members:members(),bosses:month().bosses,day:selectedDay()}).length===0;
    return {...r,selected:selectNew?ok&&r.selected!==false:(ok?r.selected:false)};
  });
 }
 function commit(){
  if(!editingAllowed())return unlock?.();
  if(state.processing){notify('이미지 분석이 끝난 다음 등록할 수 있습니다.');return;}
  const sorted=sortBattleLogRows(normalized());
  const selection=sorted.filter(row=>row.selected);
  if(!selection.length){notify('등록할 정상 기록을 선택해 주세요.');return;}
  const invalid=selection.flatMap(row=>score(row));
  if(invalid.length){notify('등록 대상에 확인이 필요한 값이 있습니다: '+[...new Set(invalid)].join(', '));return;}
  const existing=[...month().events].sort((a,b)=>a.seq-b.seq);
  const last=existing.at(-1),lastDay=Number(last?.day||1),day=selectedDay();
  if(existing.length&&day<lastDay){notify('기존 마지막 공격보다 앞선 일차는 일괄 추가할 수 없습니다. 일차를 확인하세요.');return;}
  const datedExisting=existing.filter(e=>e.gameAt&&Number(e.day)===day).map(e=>e.gameAt).sort();
  if(datedExisting.length&&selection[0].gameAt<datedExisting.at(-1)){
   notify('기존 등록된 같은 일차의 공격보다 이전 시각입니다. 공격 순서를 먼저 확인하세요.');return;
  }
  if(!confirm('선택한 '+selection.length+'건을 '+day+'일차 배틀로그 맨 뒤에 등록할까요?\n공격 순서와 이월 여부가 올바른지 확인해 주세요.'))return;
  const copy=structuredClone(month());
  copy.events??=[];
  copy.dayBreaks??=[];
  const maxSeq=Math.max(0,...copy.events.map(e=>Number(e.seq)||0));
  if(day>lastDay||(maxSeq===0&&day!==1)){
   copy.dayBreaks.push({afterSeq:maxSeq,nextDay:day});
  }
  const people=new Map(getApp().roster.map(p=>[p.id,p]));
  const imported=selection.map((r,i)=>{
   const person=people.get(r.memberId);
   return {id:makeId(),seq:maxSeq+i+1,day,boss:Number(r.bossId),memberId:person.id,
    member:memberLabel(person,getApp().roster),recordedName:person.name,
    damage:Number(r.damage),damageMode:'manual',carry:!!r.carry,bonus:0,memo:'',gameAt:r.gameAt,source:'image-import'};
  });
  copy.events.push(...imported);
  try{replay(copy);}
  catch(error){notify('집계 검증 실패: '+error.message);return;}
  const mismatch=imported.filter((r,i)=>selection[i].stage&&Number(selection[i].stage)!==Number(copy.events.find(e=>e.id===r.id)?.stage));
  if(mismatch.length&&!confirm('화면에 표시된 단계와 사이트 계산 단계가 다른 기록이 '+mismatch.length+'건 있습니다.\n기존 배틀로그에 이전 공격이 누락되었을 수 있습니다. 그래도 등록할까요?'))return;
  const warnings=copy.events.filter(e=>imported.some(i=>i.id===e.id)&&e.carry&&!e.carryFrom);
  if(warnings.length&&!confirm('연결할 격파 기록이 없는 이월 공격이 '+warnings.length+'건 있습니다.\n그래도 등록할까요?'))return;
  // Atomic local mutation; existing app persistence handles server syncing.
  beforeCommit?.();
  const previousEvents=structuredClone(month().events),previousBreaks=structuredClone(month().dayBreaks||[]);
  month().events.push(...imported);
  month().dayBreaks=copy.dayBreaks;
  try{replay(month());}
  catch(error){month().events=previousEvents;month().dayBreaks=previousBreaks;try{replay(month());}catch{}notify('등록 취소: '+error.message);return;}
  persist();
  const insertedIds=new Set(imported.map(e=>e.gameAt+'|'+e.memberId+'|'+e.boss+'|'+e.damage));
  state.rows=state.rows.filter(r=>!insertedIds.has(r.gameAt+'|'+r.memberId+'|'+r.bossId+'|'+r.damage));
  state.progress=selection.length+'건을 배틀로그에 등록했습니다.';
  navigate('battle');
  notify('이미지에서 추출한 공격 기록 '+selection.length+'건을 등록했습니다.');
 }
 function mount(page){if(page!=='battle-import')return;}
 document.addEventListener('change',event=>{
  if(!event.target.closest('.bli-shell'))return;
  const element=event.target;
  if(element.id==='bli-mode'){state.mode=element.value;render();return;}
  if(element.id==='bli-files'){
   picked=Array.from(element.files||[]).slice(0,60);
   if(Array.from(element.files||[]).length>60||picked.some(f=>f.size>25*1024*1024||!/^image\/(png|jpeg|webp)$/.test(f.type))){
    picked=[];notify('최대 60장, 장당 25MB 이하의 PNG·JPG·WebP만 선택하세요.');return;
   }
   state.progress=picked.length+'장 선택됨 · 분석 시작을 누르세요.';
   const status=$('bli-progress');if(status)status.textContent=state.progress;
   return;
  }
  if(element.id==='bli-day'){setDay(element.value);updateRows();render();return;}
  const holder=element.closest('[data-bli-id]');if(!holder)return;
  const row=state.rows.find(x=>x.id===holder.dataset.bliId);
  if(!row)return;
  const field=element.dataset.bliField;if(!field)return;
  if(field==='selected'){row.selected=element.checked;return;}
  if(field==='carry'){row.carry=element.checked;return;}
  row[field]=field==='damage'?Number(String(element.value).replace(/[^\d]/g,''))||'':element.value;
  updateRows();render();
 });
 document.addEventListener('input',event=>{
  if(event.target?.id==='bli-raw')state.raw=event.target.value;
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-bli],[data-bli-remove]');if(!button)return;
  if(!button.closest('.bli-shell'))return;
  event.preventDefault();
  switch(button.dataset.bli){
   case 'unlock':unlock?.();break;
   case 'analyze':void analyze();break;
   case 'cancel':state.cancel=true;state.progress='현재 OCR 처리 후 중단합니다.';break;
   case 'clear':if(state.processing)return;state.rows=[];state.errors=[];picked=[];state.progress='미리보기를 비웠습니다.';render();break;
   case 'commit':commit();break;
   case 'parse-text':{
    const v=$('bli-raw')?.value||'';
    const options={roster:members(),bosses:month().bosses,source:'텍스트 입력'};
    const imported=state.mode==='quick'?parseQuickLogText(v,options):[parseBattleLogText(v,options)].filter(Boolean);
    for(const row of imported){row.selected=true;row.order=state.rows.length;state.rows.push(row);}
    state.raw='';updateRows(true);render();break;
   }
  }
  if(button.dataset.bliRemove){state.rows=state.rows.filter(r=>r.id!==button.dataset.bliRemove);render();}
 });
 return {view,mount};
}
