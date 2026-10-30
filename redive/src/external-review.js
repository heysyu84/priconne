// Lazy administrator workspace; registration follows the normal shared-state path.
let externalReviewController=null,externalReviewModule=null,externalReviewLoading=null;
subpageNames.tactics.review='외부 택틱';
function externalReviewContext(){
 const seasons={...data.seasons,[ui.month]:data};
 const months=[...new Set(externalReviewController?.items?.map(item=>item.month)||[])];
 const bossNames=Object.fromEntries(months.map(month=>[month,Object.fromEntries(
  (data.futureOverrides?.[month]?.bosses||FUTURE_REFERENCE.months[month]?.bosses||[]).map(b=>[b.slot,b.name]))]));
 return {canEdit:adminMode(),seasons,bossNames,characters:data.characters};
}
function externalReviewPage(){
 if(!adminMode())return '';
 if(typeof queueMicrotask==='function')queueMicrotask(mountExternalReview);
 return '<section id="external-tactic-review" aria-label="외부 택틱"><p class="no-rows">택틱을 불러오는 중…</p></section>';
}
async function mountExternalReview(){
 const root=document.getElementById('external-tactic-review');
 if(!root||!adminMode()||ui.section!=='tactics'||ui.tabs.tactics!=='review')return;
 try{
  externalReviewLoading??=Promise.all([import('./aikurumi-review-ui.mjs?v=20261030-set-sync02'),import('./aikurumi-review-model.mjs?v=20261030-set-sync02')]);
  const [uiModule,model]=await externalReviewLoading;externalReviewModule=model;
  if(!adminMode()||document.getElementById('external-tactic-review')!==root)return;
  externalReviewController??=uiModule.createExternalReview({getContext:externalReviewContext,
   onApply:applyExternalReviewedTactics,onOpen:openAppliedExternalTactic,renderPortrait:portraitHtml});
  externalReviewController.mount(root);
 }catch(error){root.innerHTML='<p class="no-rows">'+X(error.message||'외부 택틱을 불러오지 못했습니다.')+'</p>';externalReviewLoading=null;}
}
async function applyExternalReviewedTactics(entries){
 if(!adminMode()||!ensureEdit())throw Error('관리자 모드에서 적용할 수 있습니다.');
 if(!externalReviewModule||!Array.isArray(entries)||!entries.length||entries.length>5)throw Error('적용할 택틱을 확인해 주세요.');
 const frozen=structuredClone(entries),months=[...new Set(frozen.map(e=>e.item.month))];
 if(months.length!==1||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(months[0])||new Set(frozen.map(e=>e.item.sourceKey)).size!==frozen.length)throw Error('적용 월과 택틱을 확인해 주세요.');
 for(const {item,draft}of frozen){const errors=externalReviewModule.validateReviewDraft(item,draft);if(errors.length)throw Error(errors[0]);}
 flushGrid();
 if(syncState.started){
  if(syncState.inFlight)throw Error('진행 중인 저장이 끝난 뒤 다시 적용해 주세요.');
  await flushShared();
  if(syncState.pending||syncState.inFlight||!syncState.canEdit||['conflict','error','offline'].includes(syncState.status))throw Error('현재 변경 내용을 저장한 뒤 적용해 주세요.');
 }
 // Authorization and the target are checked again after the asynchronous save.
 if(!adminMode())throw Error('관리자 모드에서 적용할 수 있습니다.');
 const month=months[0],known=month===ui.month?data:data.seasons[month];
 if(!known&&!frozen.some(e=>e.draft.createMonth===true))throw Error(month.replace('-','.')+' 월을 먼저 만들어 주세요.');
 if(known?.result?.sealed)throw Error('확정된 월에는 택틱을 적용할 수 없습니다.');
 const prepared=frozen.map(({item,draft})=>{
  const existing=externalReviewModule.findImportedTactic(known,item);
  const tactic=externalReviewModule.buildReviewedTactic(item,draft,{id:existing?.id||uid()});
  return {item,tactic,existing};
 });
 checkpoint();snapshotSeason();
 let target=known;
 if(!target){
  target=structuredClone(data.seasons[ui.month]);
  target.logs=[];target.tactics=[];target.recommendations=[];target.dayClosures=[];
  target.notices={3:'',4:''};target.result={rank:null,sealed:false,winners:null};
  target.rules.startDate='';applyFutureLineupToSeason(target,month);data.seasons[month]=target;
 }
 for(const {item,tactic,existing}of prepared){
  const list=item.stage===3?(target.recommendations??=[]):target.tactics;
  if(existing){const index=list.findIndex(t=>t.id===existing.id);list[index]={...existing,...tactic};
   if(tactic.externalSource.reviewScope==='lineup'&&existing.rows?.length){list[index].rows=existing.rows;list[index].text=existing.text;list[index].externalSource={...tactic.externalSource,reviewScope:existing.externalSource?.reviewScope||'timeline',reviewedAt:existing.externalSource?.reviewedAt,lineupReviewedAt:tactic.externalSource.reviewedAt};}
  }
  else list.push(tactic);
 }
 persist();
 if(syncState.started){
  await flushShared();
  if(syncState.pending||syncState.inFlight||syncState.status!=='saved')throw Error('변경 내용은 이 기기에 보관했습니다. 연결 상태를 확인한 뒤 저장을 다시 시도해 주세요.');
 }
 const updated=prepared.filter(p=>p.existing).length;
 return {message:month.replace('-','.')+' · '+prepared.length+'개 '+(updated===prepared.length?'업데이트 완료':'적용 완료')};
}
function openAppliedExternalTactic({month,stage,id}){
 if(!adminMode())return;
 if(month!==ui.month&&!activateSeason(month))return;
 ui.selectedTactic=id;ui.boss=0;ext.stage=stage;ext.comboDetails??={};
 if(stage===3){ext.openComboId=null;ext.comboDetails={};ui.tabs.tactics='combos';nav('tactics','combos');}
 else{const tactic=data.tactics.find(t=>t.id===id);ext.workGroup=tactic?.category||'main';nav('tactics','workspace');}
}


let importedDangoCheckRevision=null,importedDangoCheckBusy=false,importedDangoAssets=null;
async function synchronizeImportedDangoSets(){
 if(!syncState.started||!syncState.ready||syncState.pending||syncState.inFlight
   ||ext.workEditing||importedDangoCheckBusy||importedDangoCheckRevision===syncState.revision)return;
 const revision=syncState.revision;importedDangoCheckBusy=true;
 try{
  importedDangoAssets??=Promise.all([
   import('./aikurumi-dango-repair.mjs?v=20261030-dango03'),
   ...['aikurumi-snapshot-stage3.json','aikurumi-snapshot.json','aikurumi-youtube-candidates.json'].map(async name=>{
    const response=await fetch(new URL('./'+name,import.meta.url),{cache:'no-store'});
    if(!response.ok)throw Error('당고 검수 자료를 불러오지 못했습니다.');return response.json();
   })
  ]).catch(error=>{importedDangoAssets=null;throw error;});
  const [module,stage3,stage4,youtube]=await importedDangoAssets;
  if(revision!==syncState.revision||syncState.inFlight||syncState.pending||ext.workEditing)return;
  // Only identical historical generated rows are corrected. User-edited rows remain untouched.
  const {repaired}=module.repairImportedDangoTactics(data.seasons,[stage3,stage4],youtube);
  importedDangoCheckRevision=revision;
  if(repaired){
   const current=data.seasons[ui.month];
   if(current){data.tactics=structuredClone(current.tactics);data.recommendations=structuredClone(current.recommendations||[]);}
   if(syncState.canEdit&&data.settings.editable)persist();
   render();
  }
 }catch(error){console.warn('당고 SET 복구 건너뜀:',error?.message||error);}
 finally{importedDangoCheckBusy=false;}
}
const previousDangoRenderComplete=afterOperationalRender;
afterOperationalRender=()=>{
 previousDangoRenderComplete();
 if(syncState.started&&syncState.ready&&importedDangoCheckRevision!==syncState.revision)
  queueMicrotask(synchronizeImportedDangoSets);
};
