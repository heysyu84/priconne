// The GitHub/Cloudflare frontend uses the original production API and password.
// The private Sites preview keeps its existing storage until explicitly migrated.
const pagesApiOrigin=document.querySelector?.('meta[name="nyang-legacy-api-origin"]')?.content;
if(pagesApiOrigin){
 let productionClient;
 const localInitializer=initializeCompletePrototype,loadedPage=renderPage;
 initializeCompletePrototype=()=>{localInitializer();data.settings.editable=false;render();};
 renderPage=()=>{
  const cached=readBrowser(SYNC_CACHE)?.document?.importedSource?.key==='live-shared-clan-api';
  if(!syncState.ready&&!cached)return `<section class="shared-loading"><h1>${syncState.status==='offline'?'공용 자료에 연결하지 못했습니다.':'기록 불러오는 중'}</h1>${syncState.status==='offline'?'<button class="button" data-action="legacy-retry">다시 연결</button>':''}</section>`;
  return loadedPage();
 };
 const siteInitializeShared=initializeSharedSync;
 initializeSharedSync=async()=>{
  try{
   const {createLegacySharedClient}=await import('./legacy-shared-client.mjs');
   let storage;try{storage=sessionStorage;}catch{}
   productionClient=createLegacySharedClient({apiOrigin:pagesApiOrigin,pageOrigin:location.origin,storage,fetcher:(...args)=>fetch(...args),reference:sharedDocument(),selectedMonth:()=>ui.month});
   stateRequest=(path,options)=>productionClient.request(path,options);
   siteInitializeShared();
  }catch(error){data.settings.editable=false;syncState.error=error.message;syncState.status='offline';render();toast('공용 서버에 연결하지 못했습니다. 새로고침해 주세요.');}
 };
 sharedWriterControl=()=>`<button class="header-write" data-action="legacy-editor" data-sync-control ${syncState.ready?'':'disabled'}>${data.settings.editable?'편집 중':'열람'}</button>`;
 importedSourceLabel=()=>'';
 settingsAccess=()=>`<section class="settings-sheet"><div class="setting-row"><h3>자료 저장</h3><span>기존버전과 공유</span></div><div class="setting-row"><h3>작성 상태</h3><button class="button" data-action="legacy-editor">${data.settings.editable?'편집 잠금':'비밀번호로 편집'}</button></div><p class="field-help">택틱과 배틀로그는 양쪽 화면에 함께 반영됩니다.</p></section>`;
 loadFutureCatalog=async()=>{
  if(ext.futureLoading)return;ext.futureLoading=true;
  try{const response=await fetch(new URL('./future-bosses.json',location.href),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('보스 자료를 불러오지 못했습니다.');const catalog=await response.json();if(!catalog.months)throw Error('보스 자료 형식을 확인하세요.');ext.futureCatalog=catalog;ext.futureLoaded=true;ext.futureError='';}
  catch(error){ext.futureLoaded=true;ext.futureError=error.message;}finally{ext.futureLoading=false;if(ui.section==='clan')render();}
 };
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action="legacy-editor"],[data-action="legacy-retry"]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();
  if(button.dataset.action==='legacy-retry'){if(productionClient)await pollShared({force:true});else await initializeSharedSync();return;}
  if(!syncState.ready){toast('공용 자료를 불러오는 중입니다.');return;}
  if(data.settings.editable){flushGrid();await flushShared();if(syncState.pending||syncState.inFlight){toast('저장을 마친 뒤 잠글 수 있습니다.');return;}await productionClient.lock();syncState.canEdit=false;data.settings.editable=false;ext.workEditing=false;render();return;}
  openDrawer('편집 잠금 해제','<div class="field"><label for="production-editor-pin">작성 비밀번호</label><input id="production-editor-pin" name="pin" type="password" autocomplete="current-password" required autofocus><small class="legacy-auth-error danger" role="alert"></small></div>','<button type="button" class="button" data-action="close-drawer">취소</button><button type="submit" class="button primary">편집 시작</button>','',false,'legacy-editor');
 },true);
 document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-form="legacy-editor"]');if(!form)return;event.preventDefault();event.stopImmediatePropagation();const button=form.querySelector('[type=submit]');button.disabled=true;
  try{const pin=String(new FormData(form).get('pin'));await productionClient.login(pin);syncState.canEdit=true;closeDrawer();await pollShared({force:true});data.settings.editable=true;render();}
  catch(error){form.querySelector('.legacy-auth-error').textContent=error.message;}finally{button.disabled=false;}
 },true);
}
