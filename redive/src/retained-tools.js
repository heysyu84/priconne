// Retain the useful original workflows inside the new navigation.
const simplePastedRows=pasteRows;
pasteRows=(text,t)=>/^(?:[01oOxX⭕❌]\t){5}[01oOxX⭕❌]\t/m.test(text)?simplePastedRows(text,t):legacyTools.pastedRows(text,[],t.party,data.characters);
tacticRows=t=>{if(!t.rows)t.rows=pasteRows(t.text,t);return t.rows;};
subpageNames.overview.logs='배틀로그';
fullOverview=()=>{
  if(ext.importMode&&adminMode())return batchImportPage();
  const tab=ui.tabs.overview,name=tab==='members'?'대시보드':tab==='logs'?'배틀로그':'클랜전';
  const action=tab==='logs'?simpleButton('이미지 등록','v2-import-images'):'';
  const heading=titleBar(name,action)+pageTabs([['bosses','상황판'],['members','대시보드'],['logs','배틀로그']]);
  if(tab==='members')return heading+operatingLine(false)+fullDashboard();
  if(tab==='logs')return heading+battleLogContent();
  return heading+operatingLine(true)+bossStrip()+`<details class="fold optional-stats"><summary>전투 통계</summary>${overviewCharts()}</details>`;
};
fullBattle=()=>{ui.section='overview';ui.tabs.overview='logs';return fullOverview();};

findPlans=()=>{
  const rows=data.tactics.filter(t=>!t.hidden&&!t.deletedAt&&t.stage===4&&t.category!=='carry').map(t=>({...t,characters:t.party,expectedDamage:t.damage,manualCount:t.hands}));
  const catalog=data.characters.map(c=>({...c,name:String(c.unitId||c.name),aliases:[c.name,...(c.aliases||[])]}));
  const result=legacyTools.planThreeAttacks(rows,catalog,{distinctBosses:true,limit:12});
  ext.foundPlans=result.plans.map(plan=>({ids:plan.attacks.map(a=>a.combo.id),damage:plan.totalDamage,supports:Object.fromEntries(plan.attacks.map(a=>[a.combo.id,a.supportIndex])),borrowCount:plan.borrowCount}));
};
function applyFoundPlan(index){const plan=ext.foundPlans?.[index];if(!plan)return;ui.picks=[...plan.ids];ext.selectedSupports={...plan.supports};ext.onlyPicks=true;render();}
const rawSelectedParties=selectedParties;
selectedParties=()=>rawSelectedParties().map(t=>({...t,support:ext.selectedSupports?.[t.id]??t.support}));
const rawVisibleTactics=visibleTactics;
visibleTactics=()=>rawVisibleTactics().map(t=>ui.picks.includes(t.id)&&ext.selectedSupports?.[t.id]!==undefined?{...t,support:ext.selectedSupports[t.id]}:t);
recommendationDistribution=()=>{
  if(!ext.distributionOpen)return '';
  const plans=ext.foundPlans||[];
  return `<section class="distribution-panel" aria-label="추천 분배">${plans.length?rowTable(['추천 조합 · 대여','합계 기대딜',''],plans.slice(0,5).map((p,i)=>`<tr><td>${p.ids.map(id=>{const t=tacticById(id),support=p.supports?.[id]??-1;return `<span class="distribution-team"><span class="distribution-boss" style="${bossStyle(t.boss)}">${t.boss}넴</span><small>${support>=0?X(t.party[support]):'대여 자유'}</small></span>`;}).join('')}</td><td class="right numeric"><strong>${expectedDamageValue(p.damage)}</strong></td><td class="right">${simpleButton('선택','v2-use-plan',String(i),'quiet')}</td></tr>`),'distribution-table'):'<p class="no-rows">겹치지 않는 3타 조합이 없습니다.</p>'}</section>`;
};

const logContentWithoutWarnings=battleLogContent;
battleLogContent=()=>{
  const warnings=data.replayWarnings||[];
  return (warnings.length?`<div class="log-warning-summary"><button class="button" data-action="r-log-warnings" aria-pressed="${!!ext.warningOnly}">확인할 기록 ${new Set(warnings.map(w=>w.id)).size}건${ext.warningOnly?' · 전체 보기':''}</button><span>이월 연결·기본 타수를 확인하세요.</span></div>`:'')+logContentWithoutWarnings();
};
const logsWithoutWarningFilter=getFilteredCompleteLogs;
getFilteredCompleteLogs=()=>{const rows=logsWithoutWarningFilter();if(!ext.warningOnly)return rows;const ids=new Set((data.replayWarnings||[]).map(w=>w.id));return rows.filter(row=>ids.has(row.id));};
const logTableWithoutWarnings=completeLogTable;
completeLogTable=(logs,mini=false)=>{
  const warnings=new Map();for(const warning of data.replayWarnings||[])warnings.set(warning.id,[...(warnings.get(warning.id)||[]),warning.message]);
  return logTableWithoutWarnings(logs,mini).replace(/<tr data-log-id="([^"]+)"[\s\S]*?<\/tr>/g,(row,id)=>{
    const messages=warnings.get(id);if(!messages)return row;
    return row.replace('<tr ','<tr class="log-warning-row" ').replace('</td>',`<span class="log-warning-badge" title="${X(messages.join(' · '))}">확인</span></td>`);
  });
};
const tableExportWithoutLogTab=exportCurrentTable;
exportCurrentTable=()=>{
  if(ui.section==='overview'&&ui.tabs.overview==='logs'){
    downloadCsv([['일차','회차','보스','클랜원','기록 피해량','유형','실제 피해량','가산점','기여도','인게임'],...getFilteredCompleteLogs().map(e=>[e.day,e.lap,e.boss,currentMember(e.memberId).name,e.damage,e.role||logTypeLabel(e.type),e.actual,Math.round((e.bonus||0)*10000),e.contribution,e.game])],`배틀로그_${ui.month}_${ext.allDays?'전체':ui.day+'일차'}.csv`);return;
  }
  tableExportWithoutLogTab();
};

function loadExternalDraft(){
  if(ext.externalDraftLoaded)return;ext.externalDraftLoaded=true;
  try{const saved=JSON.parse(localStorage.getItem('nyang-external-tactic-carry:v1')||'null');if(saved){ext.externalText=saved.source||'';ext.externalBase=timeToSec(saved.original)||90;ext.externalSeconds=timeToSec(saved.carry)||90;}}catch{}
}
const externalWithoutDraft=completeExternal;
completeExternal=()=>{loadExternalDraft();return externalWithoutDraft();};
updateExternal=()=>{
  const source=document.getElementById('external-text'),output=document.getElementById('external-output');if(!source||!output)return;
  const original=document.getElementById('external-base').value,carry=document.getElementById('external-carry').value;
  ext.externalText=source.value;ext.externalBase=timeToSec(original);ext.externalSeconds=timeToSec(carry);
  try{localStorage.setItem('nyang-external-tactic-carry:v1',JSON.stringify({source:source.value,original,carry}));}catch{}
  try{const result=legacyTools.shiftExternalTacticTimes(source.value,ext.externalBase,ext.externalSeconds);output.textContent=result.text;output.removeAttribute('aria-invalid');}
  catch(error){output.textContent=error.message;output.setAttribute('aria-invalid','true');}
};

let imageImportController;
function imageImportMonth(){
  if(!ext.imageImportMonth||ext.imageImportMonthKey!==ui.month||ext.imageImportMonth.events!==data.logs){
    ext.imageImportMonthKey=ui.month;
    ext.imageImportMonth={...engineMonth(),memberIds:Object.keys(data.memberships),dayBreaks:data.dayClosures.map(c=>({afterSeq:c.afterSeq??Math.max(0,...data.logs.filter(e=>e.day<=c.day).map(e=>e.seq)),nextDay:c.day+1}))};
  }
  return ext.imageImportMonth;
}
function screenshotImporter(){
  if(imageImportController)return imageImportController;
  imageImportController=legacyTools.createBattleImageImport({
    getApp:()=>({active:ui.month,roster:data.members}),getMonth:imageImportMonth,
    canEdit:adminMode,unlock:()=>toggleWriter(),notify:message=>toast(message),render:()=>render(),
    navigate:()=>{ext.importMode=false;nav('overview','logs');},beforeCommit:()=>checkpoint(),
    replay:month=>engineReplay(month),
    persist:()=>{
      const month=imageImportMonth();data.logs=month.events.map(e=>({...e,usesCarry:!!e.carry,note:e.note??e.memo??''}));
      data.dayClosures=month.dayBreaks.map(boundary=>({...boundary,day:boundary.nextDay-1,count:data.logs.filter(e=>e.seq<=boundary.afterSeq).length,at:data.dayClosures.find(c=>c.day===boundary.nextDay-1)?.at||new Date().toISOString()}));
      recalculateSeason();persist();ext.imageImportMonth=null;
    }
  });
  return imageImportController;
}
batchImportPage=()=>screenshotImporter().view().replace(/\bclass="btn/g,'class="button').replace(/data-page="battle"/g,'data-action="r-image-back"').replace('← 배틀로그','배틀로그');
const afterRetainedRender=afterOperationalRender;
afterOperationalRender=()=>{afterRetainedRender();if(ext.importMode&&adminMode())screenshotImporter().mount();};

async function readCompatibleCarryFile(file){
  if(file.name.toLowerCase().endsWith('.xlsx')){
    try{
      const workbook=await legacyTools.readCarryWorkbook(await file.arrayBuffer());
      const converted=legacyTools.convertCarryWorkbook(workbook,{catalog:data.characters.map(c=>({...c,byStar:c.images||{}}))});
      if(!converted.tactics.length)throw Error(converted.errors.join(' · ')||'읽을 수 있는 택틱이 없습니다.');
      ext.carryImportWarnings=converted.errors;
      return converted.tactics.map(t=>({boss:t.boss,party:t.characters,stars:t.stars.map(Number),damage:Number(t.expectedDamage),hands:Number(t.manualCount||0),tp:t.tp,requiredCarrySeconds:t.carrySeconds||null,duration:90,note:t.note,video:t.video,text:legacyTools.carryTacticBody(t),rows:t.rows.map(row=>({id:uid(),text:row.text,checked:row.checked.map(Boolean),manualChecks:true})),warnings:t.warnings}));
    }catch(originalError){try{return parseCarrySheet(await xlsxRows(file));}catch{throw originalError;}}
  }
  return parseCarrySheet(parseDelimited(await file.text(),file.name.toLowerCase().endsWith('.tsv')?'\t':','));
}
function commitCompatibleCarry(){
  if(!ensureEdit())return;const rows=ext.carryImport||[];if(!rows.length){toast('가져올 표를 먼저 확인하세요.');return;}
  if(rows.some(t=>t.party.length!==5||new Set(t.party).size!==5)){toast('각 택틱의 캐릭터 5명을 확인하세요.');return;}
  checkpoint();
  for(const row of rows){const t={...structuredClone(row),id:uid(),party:[...row.party],stars:Array.from({length:5},(_,i)=>Number(row.stars[i])||defaultCharacterStars([row.party[i]])[0]),stage:4,category:'carry',title:row.party.join(' '),support:1,hidden:false,links:[],duration:Number.isFinite(row.duration)?row.duration:90,rows:row.rows?row.rows.map(r=>({...r,id:uid()})):null};t.requiredCarrySeconds=minimumCarry(t);t.note=displayTacticNote(t);data.tactics.push(t);ui.selectedTactic=t.id;}
  persist();closeDrawer();ext.workGroup='carry';nav('tactics','workspace');toast(rows.length+'개 이월 택틱 등록',true);
}
renderCarryPreview=()=>{
  const el=document.getElementById('carry-import-preview');if(!el)return;
  el.innerHTML=(ext.carryImportWarnings?.length?`<p class="field-help danger">${X(ext.carryImportWarnings.join(' · '))}</p>`:'')+rowTable(['보스','편성','기대딜','필요 이월'],(ext.carryImport||[]).map(t=>`<tr><td>${t.boss}넴</td><td>${X(t.party.join(' '))}${t.warnings?.length?`<small class="danger">${X(t.warnings.join(' · '))}</small>`:''}</td><td class="right">${expectedDamageValue(t.damage)}</td><td>${minimumCarry(t)??'—'}초</td></tr>`),'carry-import-preview');
};
async function prepareCompatibleBackup(input){
  const root=input?.data?.months&&Array.isArray(input.data.roster)?input.data:input?.months&&Array.isArray(input.roster)?input:null;
  if(!root)return input;
  const missing=(root.archivedMonths||[]).filter(month=>!root.months[month]);
  if(missing.length)throw Error('보관 월 '+missing.join(', ')+'이 빠져 있습니다. 모든 월이 포함된 백업을 선택하세요.');
  const {decodeLegacy}=await import('./legacy-codec.mjs');
  return sharedBackup(decodeLegacy(root,{},sharedDocument()));
}
function applyTransferMetadata(transfer,t){
  const names=transfer.characters.map(name=>data.characters.find(c=>c.name===name||(c.aliases||[]).includes(name))?.name);
  if(names.some(name=>!name)||new Set(names.map(name=>characterReference(name)?.unitId||name)).size!==5)throw Error('편성의 캐릭터 이름과 중복을 확인하세요.');
  t.party=names;t.stars=defaultCharacterStars(names);
  if(transfer.metadata){const m=transfer.metadata;Object.assign(t,{boss:m.boss,stars:m.stars.map(Number),category:'carry',damage:Number(m.expectedDamage),hands:Number(m.manualCount||0),tp:m.tp,note:m.note,video:m.video,duration:90});t.requiredCarrySeconds=minimumCarry(t);t.note=displayTacticNote(t);}
  t.title=t.party.join(' ');return t;
}
function parseCompatiblePaste(text,t){
  const transfer=legacyTools.parseTacticTransfer(text);if(!transfer)return {rows:pasteRows(text,t),tactic:t};
  const target=structuredClone(t);
  const body=transfer.mode==='slots'?legacyTools.resolveTacticSlots(transfer.text,t.party):(applyTransferMetadata(transfer,target),transfer.text);
  return {rows:pasteRows(body,target),tactic:target,transfer};
}
function commitPastedRows(){
  if(!ensureEdit())return;const current=activeTactic(),text=document.getElementById('paste-grid-source').value;
  try{
    const parsed=parseCompatiblePaste(text,current);if(!parsed.rows.length){toast('붙여넣을 본문이 없습니다.');return;}pasteSourceColors(ext.pasteSourceHtml,parsed.rows);ext.pasteSourceHtml='';
    if(parsed.transfer?.metadata){
      checkpoint();const tactic={...parsed.tactic,id:uid(),rows:parsed.rows,hidden:false,deletedAt:null};tactic.text=tactic.rows.map(row=>row.text).join('\n');data.tactics.push(tactic);ui.selectedTactic=tactic.id;ext.workGroup='carry';persist();closeDrawer();nav('tactics','workspace');toast('이월 택틱과 편성 가져오기',true);return;
    }
    rememberRows(current);if(parsed.transfer?.mode==='named'){checkpoint();current.party=parsed.tactic.party;current.stars=parsed.tactic.stars;}
    current.rows=document.getElementById('paste-grid-replace').checked?parsed.rows:[...tacticRows(current),...parsed.rows];saveGridText(current);closeDrawer();render();toast(parsed.rows.length+'행 적용');
  }catch(error){toast(error.message);}
}
function pasteSourceColors(html,rows){
  if(!html)return;const doc=new DOMParser().parseFromString(html,'text/html');const cells=[...doc.querySelectorAll('tr')].map(tr=>[...tr.querySelectorAll('td')].at(-1)).filter(Boolean);
  if(!cells.length&&rows.length===1)cells.push(doc.body);
  for(let i=0;i<rows.length;i++){
    const cell=cells[i];if(!cell||cell.textContent.replace(/\u00a0/g,' ').trim()!==rows[i].text.trim())continue;
    const runs=[];const walk=(node,color=null)=>{if(node.nodeType===3){runs.push({text:node.textContent,color});return;}const next=node.style?.color||node.getAttribute?.('color')||color;for(const child of node.childNodes)walk(child,next);};walk(cell);
    if(runs.some(run=>run.color)&&runs.map(run=>run.text).join('')===rows[i].text)rows[i].runs=runs;
  }
}
document.addEventListener('paste',event=>{
  const input=event.target,text=event.clipboardData?.getData('text/plain')||'';
  if(input.id==='paste-grid-source'){ext.pasteSourceHtml=event.clipboardData?.getData('text/html')||'';return;}
  if(input.dataset.input!=='v2-row-text'||!text)return;
  const html=event.clipboardData.getData('text/html');
  if(!text.startsWith('#NYANG_TACTIC_V1')&&!(html&&(text.includes('\n')||text.includes('\t'))))return;
  event.preventDefault();event.stopImmediatePropagation();if(!ensureEdit())return;
  const tactic=activeTactic();
  try{const parsed=parseCompatiblePaste(text,tactic);rememberRows(tactic);pasteSourceColors(html,parsed.rows);if(parsed.transfer?.metadata){checkpoint();const added={...parsed.tactic,id:uid(),rows:parsed.rows,hidden:false,deletedAt:null};added.text=added.rows.map(row=>row.text).join('\n');data.tactics.push(added);ui.selectedTactic=added.id;ext.workGroup='carry';persist();render();return;}if(parsed.transfer?.mode==='named'){tactic.party=parsed.tactic.party;tactic.stars=parsed.tactic.stars;}const index=tacticRows(tactic).findIndex(row=>row.id===input.dataset.row);tactic.rows.splice(index,1,...parsed.rows);saveGridText(tactic);render();}catch(error){toast(error.message);}
},true);
document.addEventListener('input',event=>{
  const field=event.target;if(field.dataset.input!=='v2-row-text'||!adminMode())return;
  const t=activeTactic(),index=tacticRows(t).findIndex(row=>row.id===field.dataset.row);if(index<0)return;
  legacyTools.replaceTacticRowText(t.rows[index],field.value);legacyTools.recalculateTacticRows(t.rows,t.party,data.characters,index);
  const table=field.closest('.set-grid');if(!table)return;
  for(const input of table.querySelectorAll('[data-input="v2-row-check"]')){const row=t.rows.find(r=>r.id===input.dataset.row);if(row)input.checked=!!row.checked[Number(input.dataset.column)];}
},true);
document.addEventListener('change',async event=>{
  if(event.target.dataset.input!=='v2-carry-sheet'||!event.target.files?.[0])return;
  event.preventDefault();event.stopImmediatePropagation();if(!ensureEdit())return;
  const input=event.target;input.disabled=true;
  try{ext.carryImport=await readCompatibleCarryFile(input.files[0]);renderCarryPreview();}catch(error){toast(error.message);}finally{input.disabled=false;}
},true);
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button||!button.dataset.action.startsWith('r-'))return;event.preventDefault();event.stopImmediatePropagation();
  if(button.dataset.action==='r-clear-plan'){clearRecommendedPlan();return;}
  if(button.dataset.action==='r-image-back'){ext.importMode=false;nav('overview','logs');}
  if(button.dataset.action==='r-log-warnings'){ext.warningOnly=!ext.warningOnly;ui.page=1;render();}
  if(button.dataset.action==='r-hud-boss'){nav('overview','logs');ui.boss=Number(button.dataset.id);render();}
},true);
document.addEventListener('keydown',event=>{
  if(!adminMode()||event.isComposing||event.altKey||event.metaKey)return;
  const target=event.target,form=target.closest?.('form[data-form="v2-quick-log"],form[data-form="v2-log"]');
  if(event.key===' '&&target.name==='damage'&&form){event.preventDefault();const carry=form.querySelector('[name=usesCarry]');if(carry){carry.checked=!carry.checked;form.dataset.form==='v2-log'?completeLogPreview():syncAttackEntry(form);}return;}
  if(event.ctrlKey&&event.key==='Enter'&&form){event.preventDefault();event.stopImmediatePropagation();form.requestSubmit();return;}
  if(event.key==='/'&&!event.ctrlKey&&!target.closest?.('input,textarea,select,[contenteditable="true"]')){event.preventDefault();if(ui.section!=='overview'||ui.tabs.overview!=='logs')nav('overview','logs');document.getElementById('quick-member')?.focus();}
},true);
