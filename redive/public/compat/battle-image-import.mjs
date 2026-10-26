import {parseBattleLogText,parseQuickLogText,detectDuplicateRows,sortBattleLogRows,validBattleLogRow,cleanOcrName,matchBossReadings,matchBossPortrait} from './battle-image-parser.mjs';
import {makeId,memberLabel} from './roster.mjs';

const OCR_SOURCES=[
 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js',
 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/7.0.0/tesseract.min.js',
 'https://unpkg.com/tesseract.js@7.0.0/dist/tesseract.min.js'
];
let ocrPromise=null;
function loadOcr(report=()=>{}){
 if(globalThis.Tesseract?.createWorker)return Promise.resolve(globalThis.Tesseract);
 if(ocrPromise)return ocrPromise;
 ocrPromise=(async()=>{
  let lastError=null;
  for(let i=0;i<OCR_SOURCES.length;i++){
   report('OCR 엔진 다운로드 중 ('+(i+1)+'/'+OCR_SOURCES.length+')…');
   try{
    await new Promise((resolve,reject)=>{
     const script=document.createElement('script');
     let settled=false;
     const finish=error=>{
      if(settled)return;settled=true;clearTimeout(timeout);
      script.onload=null;script.onerror=null;
      if(error){script.remove();reject(error);}else resolve();
     };
     const timeout=setTimeout(()=>finish(new Error('엔진 다운로드 15초 제한시간 초과')),15000);
     script.src=OCR_SOURCES[i];script.async=true;
     script.onload=()=>finish(globalThis.Tesseract?.createWorker?null:new Error('엔진 실행 함수가 없습니다.'));
     script.onerror=()=>finish(new Error('엔진 CDN 접속 실패'));
     document.head.append(script);
    });
    return globalThis.Tesseract;
   }catch(error){lastError=error;}
  }
  throw new Error('OCR 엔진 다운로드 실패: '+(lastError?.message||'알 수 없는 오류')+' · 네트워크/CDN 연결을 확인하세요.');
 })().catch(error=>{ocrPromise=null;throw error;});
 return ocrPromise;
}
function toCanvas(bitmap,frame,maximumScale=2.4){
 const width=Math.floor(bitmap.width*frame.w),height=Math.floor(bitmap.height*frame.h);
 const scale=Math.min(maximumScale,2100/Math.max(1,width),720/Math.max(1,height));
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
// Narrow label crops exclude the portrait, reset icon and date underline.
const detailFields={member:{x:.33,y:.44,w:.25,h:.19},damage:{x:.72,y:.02,w:.26,h:.30},date:{x:.365,y:.65,w:.225,h:.28},kind:{x:.30,y:.07,w:.19,h:.25}};
function fieldFrame(row,field){return {x:row.x+row.w*field.x,y:row.y+row.h*field.y,w:row.w*field.w,h:row.h*field.h};}
function labelCanvas(bitmap,row,box,style='raw'){
 const crop=toCanvas(bitmap,fieldFrame(row,box),5),ctx=crop.getContext('2d',{willReadFrequently:true});
 if(style!=='raw'){
  const image=ctx.getImageData(0,0,crop.width,crop.height);
  for(let i=0;i<image.data.length;i+=4){
   const r=image.data[i],g=image.data[i+1],b=image.data[i+2];
   const ink=style==='white'?Math.min(r,g,b)>180:Math.max(r,g,b)<145;
   image.data[i]=image.data[i+1]=image.data[i+2]=ink?0:255;
  }
  ctx.putImageData(image,0,0);
 }
 const padded=document.createElement('canvas');padded.width=crop.width+50;padded.height=crop.height+50;
 const target=padded.getContext('2d');target.fillStyle='white';target.fillRect(0,0,padded.width,padded.height);target.drawImage(crop,25,25);crop.width=crop.height=0;
 return padded;
}
function portraitFingerprint(bitmap,row){
 const canvas=document.createElement('canvas');canvas.width=12;canvas.height=8;const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const width=bitmap.width*row.w;
 ctx.drawImage(bitmap,bitmap.width*(row.x+row.w*.02),bitmap.height*row.y+width*.008,width*.235,width*.075,0,0,12,8);
 const data=ctx.getImageData(0,0,12,8).data,values=[];
 for(let i=0;i<data.length;i+=4)values.push(data[i]/255,data[i+1]/255,data[i+2]/255);
 canvas.width=canvas.height=0;return values;
}
async function readLabel(worker,bitmap,row,box,style='raw',whitelist=''){
 await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:whitelist});
 const crop=labelCanvas(bitmap,row,box,style);
 try{const result=await worker.recognize(crop);return {text:String(result.data?.text||'').trim(),confidence:Number(result.data?.confidence||0)};}
 finally{crop.width=crop.height=0;}
}
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const formatNumber=n=>Number(n||0).toLocaleString('ko-KR');
function reliableOcrNickname(value){
 const name=cleanOcrName(value);
 if(!name||name.length>20||/[\r\n]/.test(name)||/\d{4,}/.test(name))return false;
 const letters=(name.match(/\p{L}/gu)||[]).length;
 const symbols=(name.match(/[^\p{L}\p{N}\s]/gu)||[]).length;
 return letters>=2&&symbols<=Math.max(1,Math.floor(name.length/3))&&!/(?:데미지|대미지|피해량|전투로그|단계째|입힌)/.test(name);
}
export function createBattleImageImport(api){
 const {getApp,getMonth,persist,render,navigate,notify,canEdit,unlock,replay,beforeCommit,saveNicknameAlias,removeNicknameAlias}=api;
 const state={cropOpen:false,cropIndex:0,cropFrames:{detail:structuredClone(detailFrames),quick:[structuredClone(quickFrame)]},rows:[],processing:false,cancel:false,progress:'',mode:'detail',ocrStatus:'',errors:[],day:null,raw:'',completed:0,total:0,nameMatches:{}};
 const $=id=>document.getElementById(id);
 const month=()=>getMonth();
 const members=()=>getApp().roster.filter(p=>(month().memberIds||[]).includes(p.id));
 const validDays=()=>Math.max(1,Number(month().options?.days)||5);
 const defaultDay=()=>Math.max(1,...month().events.map(e=>Number(e.day)||1),...(month().dayBreaks||[]).map(e=>Number(e.nextDay)||1));
 const selectedDay=()=>Math.min(validDays(),Math.max(1,Number(state.day??defaultDay())));
 const setDay=value=>{state.day=Math.min(validDays(),Math.max(1,Number(value)||1));};
 const normalized=()=>detectDuplicateRows(state.rows.map(x=>({...x,day:selectedDay()})),month().events);
 function score(row){
  const errs=validBattleLogRow(row,{monthKey:getApp().active,members:members(),bosses:month().bosses,day:selectedDay()})
   .filter(error=>error!=='중복 후보'||!row.duplicateOverride);
  if(row.stage && !/^[1-6]$/.test(String(row.stage)))errs.push('단계 표기 확인');
  return errs;
 }
 const editingAllowed=()=>!!canEdit();
 const errors=()=>normalized().filter(r=>r.selected).flatMap(r=>score(r));
 function options(rows,value,blank='선택하세요'){
  return '<option value="">'+escapeHtml(blank)+'</option>'+rows.map(o=>'<option value="'+escapeHtml(o.id)+'" '+(String(o.id)===String(value)?'selected':'')+'>'+escapeHtml(o.name)+'</option>').join('');
 }
 function itemHtml(row,index,orderedRows){
  const warnings=score(row),bad=warnings.length>0;
  const memberOptions=options(members().map(p=>({id:p.id,name:memberLabel(p,getApp().roster)})),row.memberId,'클랜원 확인');
  const bossOptions=options(month().bosses.map(b=>({id:b.id,name:b.id+'넴 · '+b.name})),row.bossId,'보스 확인');
  return '<div class="bli-row '+(bad?'needs-check':'')+'" data-bli-id="'+escapeHtml(row.id)+'">'+
   '<div class="bli-row-top"><label><input type="checkbox" data-bli-field="selected" '+(row.selected?'checked':'')+' '+(bad?'disabled':'')+'> 등록</label>'+
   '<strong>#'+(index+1)+'</strong><span>'+escapeHtml(row.source||'입력')+'</span>'+
   (orderedRows.some((r,i)=>i!==index&&r.gameAt&&r.gameAt===row.gameAt)?'<span class="bli-order">동일 시각 · 순서 확인 <button class="btn sm" type="button" data-bli-shift="'+escapeHtml(row.id)+'" data-direction="-1" aria-label="공격 순서 위로" '+(index===0||orderedRows[index-1].gameAt!==row.gameAt?'disabled':'')+'>↑</button><button class="btn sm" type="button" data-bli-shift="'+escapeHtml(row.id)+'" data-direction="1" aria-label="공격 순서 아래로" '+(index===orderedRows.length-1||orderedRows[index+1].gameAt!==row.gameAt?'disabled':'')+'>↓</button></span>':'')+
   '<button class="btn sm" type="button" data-bli-remove="'+escapeHtml(row.id)+'">삭제</button></div>'+
   '<div class="bli-fields">'+
   '<label>공격 일시<input data-bli-field="gameAt" type="datetime-local" value="'+escapeHtml(row.gameAt||'')+'"></label>'+
   '<label>클랜원<select data-bli-field="memberId">'+memberOptions+'</select>'+(row.ocrName?'<small>OCR 이름: '+escapeHtml(row.ocrName)+(row.memberId?'':' · 명단에서 선택')+'</small>':row.ocrRawName?'<small>인식 불확실: '+escapeHtml(row.ocrRawName)+' · 개별 확인 필수</small>':'<small>이름 미인식 · 개별 확인 필수</small>')+'</label>'+
   '<label>보스<select data-bli-field="bossId">'+bossOptions+'</select></label>'+
   '<label>기록 피해량<input data-bli-field="damage" type="text" inputmode="numeric" value="'+escapeHtml(row.damage===''?'':formatNumber(row.damage))+'" placeholder="정확한 숫자"></label>'+
   '<label class="bli-carry">이월 사용<input type="checkbox" data-bli-field="carry" '+(row.carry?'checked':'')+'></label></div>'+
   '<div class="bli-row-note">'+(row.duplicate&&!row.duplicateOverride?'<button class="btn sm" type="button" data-bli-duplicate="'+escapeHtml(row.id)+'">중복이 아닌 별개 공격으로 확인</button>':'')+(row.stage?'<span>화면 단계: '+escapeHtml(row.stage)+'단계</span>':'')+
   (bad?'<strong>검토: '+escapeHtml(warnings.join(' · '))+'</strong>':'<span>등록 가능</span>')+'</div>'+
   '<details><summary>인식된 원문 확인</summary><pre>'+escapeHtml(row.rawText||'')+'</pre></details></div>';
 }
 function nameMapping(){
  const names=[...new Set(state.rows.map(row=>row.ocrName).filter(name=>reliableOcrNickname(name)))];
  const uncertain=state.rows.filter(row=>!row.ocrName&&row.ocrRawName).length;
  const roster=members(),choices=roster.map(p=>({id:p.id,name:memberLabel(p,getApp().roster)}));
  const saved=roster.flatMap(person=>(person.aliases||[]).map(alias=>({alias,person})));
  return '<details class="bli-name-map" open><summary>인게임 닉네임 → 사이트 클랜원 연결</summary>'+
   '<p class="muted">OCR 이름이 불확실한 '+uncertain+'건은 자동 연결에서 제외합니다. 아래에서 개별 확인하세요. 연결만 하면 이번 분석에 적용되며, 정확한 별칭은 별도로 저장할 수 있습니다.</p>'+
   (names.length?'<div class="bli-fields">'+names.map(name=>{
    const rows=state.rows.filter(row=>row.ocrName===name),ids=new Set(rows.map(row=>row.memberId)),value=ids.size===1?rows[0].memberId:'';
    const already=roster.some(p=>p.id===value&&[p.name,...(p.aliases||[])].some(alias=>alias.normalize('NFKC').toLowerCase()===name.normalize('NFKC').toLowerCase()));
    return '<div class="bli-name-item"><label><span class="bli-name-text" title="'+escapeHtml(name)+'">'+escapeHtml(name)+' · '+rows.length+'건</span><select data-bli-name-map="'+escapeHtml(name)+'">'+options(choices,value,'사이트 클랜원 선택')+'</select></label>'+(value&&!already?'<button class="btn sm" type="button" data-bli="remember-alias" data-alias="'+escapeHtml(name)+'">확인한 별칭 기억하기</button>':'')+'</div>';
   }).join('')+'</div>':'')+
   (uncertain?'<details class="bli-uncertain"><summary>인식 불확실 '+uncertain+'건 · 개별 확인</summary><p>숫자, 기호, 화면의 다른 문구를 이름으로 잘못 읽은 기록입니다. 같은 숫자라도 동일인물이라는 뜻이 아니므로 자동으로 묶지 않습니다.</p></details>':'')+
   '<details class="bli-alias-manager"><summary>인게임 별칭 직접 등록 · 삭제</summary><p class="muted">게임에서 실제로 확인한 닉네임만 입력하세요. 시트 클랜원 이름은 변경되지 않습니다.</p>'+
   '<div class="bli-alias-add"><input id="bli-alias-name" type="text" maxlength="40" aria-label="정확한 인게임 닉네임" placeholder="인게임 닉네임"><select id="bli-alias-member" aria-label="사이트 클랜원 선택">'+options(choices,'','클랜원 선택')+'</select><button class="btn sm" type="button" data-bli="save-alias">별칭 저장</button></div>'+
   (saved.length?'<div class="bli-saved-aliases">'+saved.map(({alias,person})=>'<span class="bli-saved-alias"><span>'+escapeHtml(alias)+' → '+escapeHtml(person.name)+'</span><button class="btn sm" type="button" data-bli="remove-alias" data-member-id="'+escapeHtml(person.id)+'" data-alias="'+escapeHtml(alias)+'">삭제</button></span>').join('')+'</div>':'')+
   '</details></details>';
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
   cropEditor()+
   '<p class="bli-progress" id="bli-progress" role="status">'+escapeHtml(state.progress||'파일은 분석 전까지 브라우저 메모리에만 보관합니다.')+'</p></div>'+
   '<details class="bli-manual"><summary>OCR 텍스트 직접 붙여넣기 · 잘못 인식된 화면 재분석</summary>'+
   '<p class="muted">이미지 인식이 실패했으면 추출한 텍스트를 직접 입력해 기록을 추가할 수 있습니다. 행 별 값은 아래에서 편집 가능합니다.</p>'+
   '<textarea id="bli-raw" rows="5" placeholder="일시 2026/09/28 23:53&#10;다람이&#10;데미카리드 4단계째 입힌 데미지 189633896">'+escapeHtml(state.raw)+'</textarea>'+
   '<button class="btn sm" type="button" data-bli="parse-text">텍스트 분석하여 추가</button></details>'+
   '<div class="bli-review"><h3>등록 전 확인 <span class="pill">'+rows.length+'건</span></h3>'+
   '<div class="bli-review-controls"><label>적용 일차<select id="bli-day">'+Array.from({length:validDays()},(_,i)=>'<option value="'+(i+1)+'" '+(i+1===day?'selected':'')+'>'+(i+1)+'일차</option>').join('')+'</select></label>'+
   '<span class="muted">현재 '+escapeHtml(getApp().active)+'월 기록 · 등록 시 맨 뒤에 시간순 추가</span></div><p class="muted">게임 닉네임과 명단 이름이 다르면 클랜원을 한 번 선택하세요. 이번 분석에서 같은 인식 이름에 함께 적용합니다.</p>'+
   nameMapping()+
   (state.errors.length?'<div class="bli-warning">'+escapeHtml(state.errors.join('\n'))+'</div>':'')+
   (rows.length?rows.map((row,index)=>itemHtml(row,index,rows)).join(''):'<p class="muted">인식된 기록이 없습니다. 이미지를 선택해 분석하거나 텍스트를 추가해 주세요.</p>')+
   '<div class="bli-bottom"><strong>등록 가능한 선택 기록 '+count+'건</strong><button class="btn primary" type="button" data-bli="commit" '+(!count||state.processing?'disabled':'')+'>검토한 '+count+'건 일괄 등록</button></div>'+
   '<p class="muted">날짜·닉네임·피해량·보스는 반드시 확인하세요. 중복 또는 현재 클전 월과 다른 기록은 자동으로 등록하지 않습니다. 이월 여부는 직접 지정해야 합니다.</p></div></section>';
 }
 // Excludes screenshots from persistence: File/Bitmap/Canvas are not serialized.
 let picked=[],previewUrl='',drag=null;
 function clearPreview(){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';}
 function cropEditor(){
  if(!previewUrl)return '';
  const frames=state.cropFrames[state.mode],index=Math.min(state.cropIndex,frames.length-1),frame=frames[index];
  return '<details class="bli-crop" '+(state.cropOpen?'open':'')+'><summary>인식 영역 지정 · 화면 비율이 다를 때</summary><p>행을 선택하고 이미지 위에서 드래그하여 이름·보스·피해량·일시가 모두 들어오게 지정하세요. 지정 영역은 이번 분석의 모든 이미지에 적용됩니다.</p><label>영역 <select id="bli-crop-index" '+(state.processing?'disabled':'')+'>'+frames.map((_,i)=>'<option value="'+i+'" '+(index===i?'selected':'')+'>'+(state.mode==='detail'?(i+1)+'번째 공격':'우측 간단 로그')+'</option>').join('')+'</select></label><button class="btn sm" type="button" data-bli="reset-crop" '+(state.processing?'disabled':'')+'>기본 영역</button><div class="bli-crop-image" data-bli-crop-surface><img src="'+escapeHtml(previewUrl)+'" alt="선택한 첫 스크린샷의 OCR 영역 미리보기" draggable="false"><span class="bli-crop-box" style="left:'+frame.x*100+'%;top:'+frame.y*100+'%;width:'+frame.w*100+'%;height:'+frame.h*100+'%"></span></div><div class="bli-crop-numbers">'+[['x','왼쪽'],['y','위쪽'],['w','너비'],['h','높이']].map(([key,label])=>'<label>'+label+' %<input type="number" inputmode="decimal" min="0" max="100" step="0.1" data-bli-crop-field="'+key+'" value="'+(frame[key]*100).toFixed(1)+'" '+(state.processing?'disabled':'')+'></label>').join('')+'</div></details>';
 }
 function constrainFrame(frame){
  frame.x=Math.max(0,Math.min(.99,frame.x));frame.y=Math.max(0,Math.min(.99,frame.y));
  frame.w=Math.max(.01,Math.min(1-frame.x,frame.w));frame.h=Math.max(.01,Math.min(1-frame.y,frame.h));return frame;
 }
 function currentFrame(){return state.cropFrames[state.mode][Math.min(state.cropIndex,state.cropFrames[state.mode].length-1)];}
 let jobId=0;
 async function analyze(){
  if(state.processing||!editingAllowed())return;
  if(!picked.length){notify('스크린샷을 먼저 선택하세요.');return;}
  state.processing=true;state.cancel=false;state.cancelReason='';state.errors=[];state.total=picked.length;state.completed=0;
  const files=picked.slice(),mode=state.mode,frames=structuredClone(state.cropFrames[state.mode]),contextMonth=getApp().active;
  let practiceCount=0;
  state.progress='OCR 엔진 및 한국어 모델 준비 중…';render();
  let worker=null,run=++jobId;
  try{
   const Tesseract=await loadOcr(message=>{
    if(run!==jobId)return;
    state.progress=message;const el=$('bli-progress');if(el)el.textContent=message;
   });
   if(run!==jobId||state.cancel){state.cancelReason||='모델 준비 중 화면이 변경됐습니다.';return;}
   state.progress='한국어 OCR 모델 초기화 중…';const status=$('bli-progress');if(status)status.textContent=state.progress;
   const sources=[
    {name:'기본 CDN',options:{}},
    {name:'대체 CDN',options:{
     workerPath:'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/7.0.0/worker.min.js',
     corePath:'https://unpkg.com/tesseract.js-core@7.0.0',
     langPath:'https://unpkg.com/@tesseract.js-data/kor@1.0.0/4.0.0_best_int'
    }}
   ];
   let initializationError=null;
   for(let attempt=0;attempt<sources.length&&!worker;attempt++){
    if(state.cancel)break;
    const source=sources[attempt];
    state.progress='한국어 OCR 모델 준비 중 ('+(attempt+1)+'/'+sources.length+') · '+source.name;
    const stage=$('bli-progress');if(stage)stage.textContent=state.progress;
    let startTimer=null,abandoned=false;
    try{
     const pendingWorker=Tesseract.createWorker('kor',1,{
      ...source.options,
      logger:message=>{
       if(run!==jobId||state.cancel)return;
       const stages={'loading tesseract core':'문자인식 엔진 불러오는 중','initializing tesseract':'문자인식 엔진 초기화 중','loading language traineddata':'한국어 모델 다운로드 중','initializing api':'한국어 모델 적용 중','recognizing text':'문자 분석 중'};
       const phase=stages[message.status]||String(message.status||'OCR 처리 중');
       const percent=Math.round(Math.min(1,Math.max(0,Number(message.progress)||0))*100);
       state.progress=(message.status==='recognizing text'?'이미지 '+(state.completed+1)+'/'+state.total+' · ':'')+phase+' '+percent+'%';
       const el=$('bli-progress');if(el)el.textContent=state.progress;
      }
     }).then(async value=>{
      if(abandoned){await value.terminate().catch(()=>{});throw new Error('OCR 초기화 제한시간 초과');}
      return value;
     });
     worker=await Promise.race([
      pendingWorker,
      new Promise((_,reject)=>{startTimer=setTimeout(()=>{
       abandoned=true;reject(new Error('한국어 OCR 모델 준비가 75초를 초과했습니다.'));
      },75000);})
     ]);
    }catch(error){
     initializationError=error;
     if(attempt+1<sources.length&&!state.cancel){
      state.progress='한국어 OCR 모델 초기화 실패 · 대체 다운로드 경로를 시도합니다.';
      const el=$('bli-progress');if(el)el.textContent=state.progress;
     }
    }finally{clearTimeout(startTimer);}
   }
   if(!worker)throw initializationError||new Error('OCR 모델 초기화가 중단됐습니다.');
   for(const file of files){
    if(state.cancel||run!==jobId)break;
    try{
     const bitmap=await createImageBitmap(file);
     try{
      if(getApp().active!==contextMonth){state.cancel=true;break;}
      for(let i=0;i<frames.length;i++){
       if(state.cancel)break;
       const canvas=toCanvas(bitmap,frames[i]);
       const result=await worker.recognize(canvas);
       canvas.width=0;canvas.height=0;
       if(state.cancel||getApp().active!==contextMonth){state.cancel=true;break;}
       const text=result.data?.text||'';
       if(mode==='detail'&&/모의\s*전/.test(text)){practiceCount++;continue;}
       const options={roster:members(),bosses:month().bosses,source:file.name+' · '+(i+1)+'행'};
       const parsed=mode==='detail'? [parseBattleLogText(text,options)].filter(Boolean):
         parseQuickLogText(text,options);
       if(mode==='detail'&&parsed.length){
        const row=parsed[0],reads={};
        try{
         reads.kind=await readLabel(worker,bitmap,frames[i],detailFields.kind,'white');
         if(/모의\s*전/.test(reads.kind.text)){practiceCount++;continue;}
         const names=[];
         names.push(await readLabel(worker,bitmap,frames[i],detailFields.member));
         let name=parseBattleLogText(names[0].text,{...options,bosses:[],memberField:true});
         if(!name?.memberId&&!state.cancel){
          names.push(await readLabel(worker,bitmap,frames[i],detailFields.member,'black'));
          name=parseBattleLogText(names.at(-1).text,{...options,bosses:[],memberField:true});
         }
         if(!name?.memberId&&!state.cancel){
          names.push(await readLabel(worker,bitmap,frames[i],{x:.32,y:.35,w:.28,h:.34}));
          name=parseBattleLogText(names.at(-1).text,{...options,bosses:[],memberField:true});
         }
         const readings=names.map(read=>({...read,text:cleanOcrName(read.text)})).filter(read=>read.text).sort((a,b)=>b.confidence-a.confidence);
         const recognized=readings.find(read=>reliableOcrNickname(read.text));
         row.bossVisual=portraitFingerprint(bitmap,frames[i]);
         row.ocrName=recognized?.text||'';
         row.ocrRawName=recognized?'':(readings[0]?.text||'').slice(0,80);
         const confirmed=recognized?parseBattleLogText(recognized.text,{...options,bosses:[],memberField:true}):null;
         row.memberId=recognized?(confirmed?.memberId||state.nameMatches[row.ocrName]||''):'';
         row.memberName=row.memberId?(members().find(m=>m.id===row.memberId)?.name||''):'';
         reads.member=names.map(r=>r.text).join(' / ');
         reads.damage=await readLabel(worker,bitmap,frames[i],detailFields.damage);
         const damage=parseBattleLogText('입힌 데미지 '+reads.damage.text,{roster:[],bosses:[]});
         if(damage?.damage)row.damage=damage.damage;
         if(!row.gameAt){
          reads.date=await readLabel(worker,bitmap,frames[i],detailFields.date,'raw','0123456789/: .-');
          row.gameAt=parseBattleLogText(reads.date.text,{roster:[],bosses:[]})?.gameAt||'';
         }
         const bossReads=[],lengths=[...new Set(month().bosses.map(b=>cleanOcrName(b.name).replace(/\s/g,'').length))].sort((a,b)=>a-b);
         const whitelist=month().bosses.map(b=>b.name).join(' ');
         let boss=null;
         for(const length of lengths){
          if(state.cancel)break;
          const box={x:.04,y:.75,w:Math.min(.25,length*.0195+.005),h:.19};
          bossReads.push(await readLabel(worker,bitmap,frames[i],box));
          boss=matchBossReadings(bossReads,month().bosses);
          if(boss?.score===1)break;
          bossReads.push(await readLabel(worker,bitmap,frames[i],box,'white',whitelist));
          boss=matchBossReadings(bossReads,month().bosses);
          if(boss?.score===1)break;
         }
         if(boss){row.bossId=boss.id;row.bossReadScore=boss.score;}
         reads.boss=bossReads.map(r=>r.text).filter(Boolean).join(' / ');
         row.rawText+='\n\n개별 영역 인식\n클랜원: '+(reads.member||'미인식')+'\n보스: '+(reads.boss||'미인식')+(boss?' → '+boss.name:'')+'\n피해량: '+reads.damage.text+'\n전투 유형: '+reads.kind.text+(reads.date?'\n일시: '+reads.date.text:'');
        }finally{await worker.setParameters({tessedit_pageseg_mode:'3',tessedit_char_whitelist:''});}
       }
       if(state.cancel||getApp().active!==contextMonth){state.cancel=true;break;}
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
  }catch(error){state.errors.push('이미지 인식 실패: '+(error?.message||String(error)));}
  finally{
   if(worker)await worker.terminate().catch(()=>{});
   const stopped=state.cancel||run!==jobId;
   const reason=state.cancelReason||'화면 변경 또는 사용자 중단';
   const completed=state.completed,total=state.total,count=state.rows.length,errorCount=state.errors.length;
   state.processing=false;state.cancel=false;state.cancelReason='';
   for(const row of state.rows)if(!row.bossId){const inferred=matchBossPortrait(row.bossVisual,state.rows);if(inferred){row.bossId=inferred;row.rawText+='\n보스: 같은 분석 내 일치하는 보스 초상화로 확인';}}
   updateRows(true);
   if(stopped){state.progress='OCR 중단: '+reason+' · 이미지는 보관되어 있습니다. 다시 분석해 주세요.';}
   else if(errorCount){state.progress='OCR 오류 '+errorCount+'건: '+state.errors[0]+' · 다시 시도해 주세요.';}
   else if(!completed){state.progress='이미지 분석이 시작되지 않았습니다. 다시 시도해 주세요.';}
   else if(!count){state.progress=completed+'/'+total+'장 분석 완료 · 인식 0건 · 스크린샷 형식과 인식 영역을 확인하세요.';}
   else{state.progress=completed+'/'+total+'장 분석 완료 · '+count+'건 인식'+(practiceCount?' · 모의전 '+practiceCount+'건 제외':'')+' · 결과를 확인한 뒤 등록하세요.';}
   render();
  }
 }
 function updateRows(selectNew=false){
  const checked=detectDuplicateRows(state.rows.map(x=>({...x,day:selectedDay()})),month().events);
  state.rows=checked.map(r=>{
    const ok=score(r).length===0;
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
  // Convert legacy per-row day assignments to boundaries before enabling boundary-based replay.
  if(!copy.dayBreaks.length&&copy.events.length){
   let previousDay=1,previousSeq=0;
   for(const row of [...copy.events].sort((a,b)=>a.seq-b.seq)){
    const rowDay=Number(row.day)||1;
    if(rowDay>previousDay){
     copy.dayBreaks.push({afterSeq:previousSeq,nextDay:rowDay});
     previousDay=rowDay;
    }
    previousSeq=Number(row.seq)||previousSeq;
   }
  }
  const maxSeq=Math.max(0,...copy.events.map(e=>Number(e.seq)||0));
  const existingBoundary=copy.dayBreaks.find(b=>Number(b.afterSeq)===maxSeq);
  if(existingBoundary&&Number(existingBoundary.nextDay)!==day){notify('이미 설정된 일차 변경 기준과 다릅니다. 일차를 확인하세요.');return;}
  if(!existingBoundary&&(day>lastDay||(maxSeq===0&&day!==1))){
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
 function mount(page){if(page!=='battle-import'&&state.processing){state.cancelReason='이미지 등록 화면을 벗어났습니다.';state.cancel=true;}}
 document.addEventListener('change',event=>{
  if(!event.target.closest('.bli-shell'))return;
  const element=event.target;
  if(element.dataset?.bliNameMap){
   const name=element.dataset.bliNameMap;
   if(!reliableOcrNickname(name))return;
   state.nameMatches[name]=element.value;
   for(const row of state.rows)if(row.ocrName===name){row.memberId=element.value;row.selected=!!element.value;}
   updateRows(true);render();return;
  }
  if(element.id==='bli-mode'){if(state.processing)return;state.mode=element.value;state.cropIndex=0;render();return;}
  if(element.id==='bli-crop-index'){state.cropIndex=Number(element.value);render();return;}
  if(element.dataset?.bliCropField){if(state.processing)return;const value=Number(element.value);if(!Number.isFinite(value))return;currentFrame()[element.dataset.bliCropField]=value/100;constrainFrame(currentFrame());render();return;}
  if(element.id==='bli-files'){
   picked=Array.from(element.files||[]).slice(0,60);
   if(Array.from(element.files||[]).length>60||picked.some(f=>f.size>25*1024*1024||!/^image\/(png|jpeg|webp)$/.test(f.type))){
    picked=[];notify('최대 60장, 장당 25MB 이하의 PNG·JPG·WebP만 선택하세요.');return;
   }
   clearPreview();if(picked[0])previewUrl=URL.createObjectURL(picked[0]);
   state.progress=picked.length+'장 선택됨 · 분석 시작을 누르세요.';
   const status=$('bli-progress');if(status)status.textContent=state.progress;render();
   return;
  }
  if(element.id==='bli-day'){setDay(element.value);updateRows();render();return;}
  const holder=element.closest('[data-bli-id]');if(!holder)return;
  const row=state.rows.find(x=>x.id===holder.dataset.bliId);
  if(!row)return;
  const field=element.dataset.bliField;if(!field)return;
  if(field==='selected'){row.selected=element.checked;render();return;}
  if(field==='carry'){row.carry=element.checked;return;}
  row[field]=field==='damage'?Number(String(element.value).replace(/[^\d]/g,''))||'':element.value;
  if(field==='memberId'&&row.ocrName){
   state.nameMatches[row.ocrName]=row.memberId;
   for(const other of state.rows)if(other.ocrName===row.ocrName){other.memberId=row.memberId;other.selected=true;}
  }
  updateRows();render();
 });
 document.addEventListener('input',event=>{
  if(event.target?.id==='bli-raw')state.raw=event.target.value;
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-bli],[data-bli-remove],[data-bli-duplicate],[data-bli-shift]');if(!button)return;
  if(!button.closest('.bli-shell'))return;
  event.preventDefault();
  switch(button.dataset.bli){
   case 'unlock':unlock?.();break;
   case 'remember-alias':{
    const alias=button.dataset.alias||'';
    if(!reliableOcrNickname(alias)){notify('불확실한 OCR 글자는 자동 기억할 수 없습니다. 정확한 닉네임을 직접 등록해 주세요.');break;}
    const linked=[...new Set(state.rows.filter(row=>row.ocrName===alias).map(row=>row.memberId))].filter(Boolean);
    if(linked.length!==1){notify('먼저 한 명의 클랜원을 선택하세요.');break;}
    if(!confirm('"'+alias+'"을(를) 정확한 인게임 닉네임으로 확인했나요? 다음 분석에서도 자동 연결됩니다.'))break;
    const result=saveNicknameAlias?.(linked[0],alias);
    if(result?.ok){notify('인게임 별칭을 기억했습니다.');render();}
    else notify(result?.error||'별칭 저장에 실패했습니다.');
    break;
   }
   case 'save-alias':{
    const alias=($('bli-alias-name')?.value||'').normalize('NFKC').trim();
    const memberId=$('bli-alias-member')?.value||'';
    if(!alias||!memberId){notify('정확한 닉네임과 연결할 클랜원을 입력해 주세요.');break;}
    if(!confirm('"'+alias+'"을(를) 선택한 클랜원의 인게임 닉네임으로 저장할까요?'))break;
    const result=saveNicknameAlias?.(memberId,alias);
    if(result?.ok){state.nameMatches[alias]=memberId;for(const row of state.rows)if(row.ocrName===alias)row.memberId=memberId;updateRows(true);notify('인게임 별칭을 저장했습니다.');render();}
    else notify(result?.error||'별칭 저장에 실패했습니다.');
    break;
   }
   case 'remove-alias':{
    if(!confirm('이 별칭의 자동 연결을 삭제할까요?'))break;
    const result=removeNicknameAlias?.(button.dataset.memberId,button.dataset.alias);
    if(result?.ok){notify('별칭을 삭제했습니다.');render();}
    else notify(result?.error||'별칭 삭제에 실패했습니다.');
    break;
   }
   case 'analyze':void analyze();break;
   case 'cancel':state.cancelReason='사용자가 분석 중단을 선택했습니다.';state.cancel=true;state.progress='현재 OCR 처리 후 중단합니다.';break;
   case 'reset-crop':if(state.processing)return;state.cropFrames={detail:structuredClone(detailFrames),quick:[structuredClone(quickFrame)]};render();break;
   case 'clear':if(state.processing)return;clearPreview();state.rows=[];state.nameMatches={};state.errors=[];picked=[];state.progress='미리보기를 비웠습니다.';render();break;
   case 'commit':commit();break;
   case 'parse-text':{
    const v=$('bli-raw')?.value||'';
    const options={roster:members(),bosses:month().bosses,source:'텍스트 입력'};
    const imported=state.mode==='quick'?parseQuickLogText(v,options):[parseBattleLogText(v,options)].filter(Boolean);
    for(const row of imported){row.selected=true;row.order=state.rows.length;state.rows.push(row);}
    state.raw='';updateRows(true);render();break;
   }
  }
  if(button.dataset.bliShift){
    if(state.processing)return;
    const ordered=sortBattleLogRows(state.rows),index=ordered.findIndex(r=>r.id===button.dataset.bliShift),next=index+Number(button.dataset.direction);
    if(index>=0&&next>=0&&next<ordered.length&&ordered[index].gameAt&&ordered[index].gameAt===ordered[next].gameAt){
      [ordered[index],ordered[next]]=[ordered[next],ordered[index]];ordered.forEach((r,i)=>r.order=i);render();
    }
  }
  if(button.dataset.bliRemove){state.rows=state.rows.filter(r=>r.id!==button.dataset.bliRemove);render();}
  if(button.dataset.bliDuplicate){
    const row=state.rows.find(r=>r.id===button.dataset.bliDuplicate);
    if(row&&confirm('이 기록은 기존 기록이나 다른 이미지의 기록과 동일해 보입니다. 실제로 별개의 공격이 맞나요?')){
      row.duplicateOverride=true;row.selected=true;updateRows();render();
    }
  }
 });
 document.addEventListener('toggle',event=>{if(event.target.matches?.('.bli-crop'))state.cropOpen=event.target.open;},true);
 document.addEventListener('pointerdown',event=>{
  const surface=event.target.closest?.('[data-bli-crop-surface]');if(!surface||state.processing)return;
  event.preventDefault();const rect=surface.getBoundingClientRect();
  drag={surface,rect,x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))};
  surface.setPointerCapture?.(event.pointerId);
 });
 document.addEventListener('pointermove',event=>{
  if(!drag)return;
  const x=Math.max(0,Math.min(1,(event.clientX-drag.rect.left)/drag.rect.width)),y=Math.max(0,Math.min(1,(event.clientY-drag.rect.top)/drag.rect.height));
  drag.frame=constrainFrame({x:Math.min(x,drag.x),y:Math.min(y,drag.y),w:Math.abs(x-drag.x),h:Math.abs(y-drag.y)});
  const box=drag.surface.querySelector('.bli-crop-box');if(box)Object.assign(box.style,{left:drag.frame.x*100+'%',top:drag.frame.y*100+'%',width:drag.frame.w*100+'%',height:drag.frame.h*100+'%'});
 });
 document.addEventListener('pointerup',()=>{if(!drag)return;if(drag.frame)Object.assign(currentFrame(),drag.frame);drag=null;render();});
 document.addEventListener('pointercancel',()=>{drag=null;});
 return {view,mount};
}
