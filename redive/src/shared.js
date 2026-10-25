// Clan records are shared on the server. Only display preferences and unsent
// drafts belong to this browser. The previous local-only store is left intact.
const SYNC_PREFS='redive-ui-preferences-v1',SYNC_CACHE='redive-shared-cache-v1',SYNC_DRAFT='redive-shared-draft-v1';
const syncState={started:false,ready:false,canEdit:false,authenticated:false,revision:0,baseline:'',pending:'',inFlight:false,status:'loading',error:'',timer:null,polling:false,updatedAt:null,remote:null};
const writerActions=new Set(['add-log','edit-log','delete-log','confirm-delete-log','add-member','edit-member','add-tactic','edit-tactic','hide-tactic','duplicate-tactic','delete-tactic','confirm-delete-tactic','v2-new-month','v2-edit-grid','v2-member-status','v2-add-character','v2-edit-character','v2-import-images','v2-carry-import','v2-add-row','v2-delete-row','v2-row-undo','v2-row-redo','v2-grid-undo','v2-grid-redo','v2-restore-tactic','v2-close-day','v2-reopen-day','v2-undo','v2-notice','v2-history-rank','v2-confirm-restore','v2-confirm-import','v2-reset-confirm']);
for(const action of ['new-tactic','v2-import-carry','v2-save-converted','v2-log-up','v2-log-down','v2-factor','v2-confirm-season','v2-seal-season','v2-commit-batch','v2-commit-carry','v2-commit-paste','v2-confirm-close-day','v2-delete-portrait','v2-reset-all'])writerActions.add(action);
const browserSettings=completeSettings,browserSettingsDisplay=settingsDisplay,browserSettingsData=settingsData,browserSettingsAccess=settingsAccess;
completeSettings=()=>{
  if(!syncState.started)return browserSettings();
  const tabs=syncState.canEdit?[['display','화면'],['rules','월별 보스·규칙'],['data','월·백업'],['access','공유·권한'],['links','자료 링크']]:[['display','화면'],['access','공유·권한']];
  if(!tabs.some(([key])=>key===ext.settingsPage))ext.settingsPage='display';
  return `<div class="settings-navigation">${tabs.map(([key,name])=>`<button class="${ext.settingsPage===key?'active':''}" data-action="v2-settings-page" data-value="${key}">${name}</button>`).join('')}</div>`+({display:settingsDisplay,rules:settingsRules,data:settingsData,access:settingsAccess,links:settingsLinks}[ext.settingsPage]||settingsDisplay)();
};
settingsDisplay=()=>{
  const html=browserSettingsDisplay();if(!syncState.started)return html;
  return html.replace(/<label class="setting-row"><h3>작성 허용<\/h3>.*?<\/label>/,'');
};
settingsAccess=()=>{
  if(!syncState.started)return browserSettingsAccess();
  const updated=syncState.updatedAt?new Date(syncState.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'연결 중';
  return `<section class="settings-sheet"><div class="setting-row"><h3>자료 저장</h3><span>공용 저장소</span></div><div class="setting-row"><h3>마지막 저장</h3><span>${X(updated)}</span></div><div class="setting-row"><h3>내 권한</h3><span>${syncState.canEdit?'관리자':'열람 전용'}</span></div>${syncState.canEdit?`<div class="setting-row"><h3>작성 상태</h3>${simpleButton(data.settings.editable?'열람으로 전환':'편집 시작','v2-lock')}</div>`:!syncState.authenticated?`<div class="setting-row"><h3>관리자</h3><a class="button" href="${X(sharedSignIn())}" target="_top">로그인</a></div>`:''}<p class="field-help">기록·택틱은 함께 공유합니다. 화면 설정은 이 기기에만 적용합니다.</p></section>`;
};
settingsData=()=>{
  if(!syncState.started)return browserSettingsData();
  return `<section class="settings-sheet"><div class="sheet-heading"><h2>월별 관리</h2>${simpleButton('다음 달 만들기','v2-new-month','','primary')}</div>${rowTable(['월','기록','택틱','열기'],Object.keys(data.seasons).sort().reverse().map(key=>{const s=key===ui.month?data:data.seasons[key];return `<tr><td>${key.replace('-','.')}</td><td class="right">${s.logs.length}건</td><td class="right">${s.tactics.filter(t=>!t.deletedAt).length}개</td><td>${simpleButton('열기','v2-switch-month',key,'quiet')}</td></tr>`;}))}<div class="setting-row"><div><h3>전체 백업</h3><p>모든 월의 기록·택틱·설정·클랜원</p></div>${simpleButton('JSON 저장','export-json')}</div><div class="setting-row"><div><h3>선택한 월 백업</h3><p>${ui.month.replace('-','.')}</p></div>${simpleButton('JSON 저장','v2-export-month')}</div>${data.settings.editable?'<div class="setting-row"><h3>백업 복원</h3><input type="file" accept=".json" data-input="v2-restore" aria-label="백업 JSON 선택"></div>':''}${legacyDocument()?`<div class="setting-row"><div><h3>이전 브라우저 자료</h3><p>공용 저장 전, 이 기기에만 저장한 자료</p></div>${simpleButton('확인','shared-legacy')}</div>`:''}</section>`;
};
function readBrowser(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
function writeBrowser(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
function sharedDocument(){
  snapshotSeason();
  return {schema:1,members:data.members,characters:data.characters,history:data.history||[],awards:data.awards||[],communityLinks:data.communityLinks,seasons:data.seasons,activeMonth:Object.keys(data.seasons).sort().at(-1),importedSource:data.importedSource,siteCopy:data.siteCopy||{},futureOverrides:data.futureOverrides||{},referenceVersion:data.referenceVersion};
}
function sharedText(){return JSON.stringify(sharedDocument());}
function sharedSignIn(){return '/signin-with-chatgpt?return_to='+encodeURIComponent('/'+location.hash);}
function sharedWriterControl(){
  if(!syncState.started)return `<button class="header-write" data-action="v2-lock">${data.settings.editable?'작성 중':'열람'}</button>`;
  if(!syncState.authenticated)return `<a class="header-write" href="${X(sharedSignIn())}" target="_top">관리자 로그인</a>`;
  if(!syncState.canEdit)return '<span class="header-write viewer-label">열람</span>';
  return `<button class="header-write" data-action="v2-lock" data-sync-control>${data.settings.editable?'편집 중':'열람'}</button>`;
}
function sharedFeedback(){
  if(!syncState.started)return '';
  return '<div id="shared-status" class="shared-status" role="status" aria-live="polite"></div>';
}
function refreshSharedStatus(){
  const status=document.getElementById('shared-status'),button=document.querySelector('[data-sync-control]');
  if(button){button.dataset.status=syncState.status;button.title=syncState.status==='saved'?'공용 자료에 저장됨':syncState.error||'공용 자료 '+(syncState.status==='saving'?'저장 중':'연결됨');button.textContent=syncState.inFlight?'저장 중':data.settings.editable?'편집 중':'열람';}
  if(!status)return;
  const failing=['offline','conflict','error'].includes(syncState.status),draft=syncState.canEdit&&readBrowser(SYNC_DRAFT);
  status.hidden=!failing&&!draft;
  status.innerHTML=failing?`<span>${X(syncState.error||'최신 자료에 연결하지 못했습니다.')}</span><button data-action="shared-retry">다시 연결</button>${syncState.pending?'<button data-action="shared-review">내 변경 확인</button>':''}`:draft?'<span>이 기기에 저장하지 못한 변경이 있습니다.</span><button data-action="shared-review">확인</button>':'';
}
function applySharedDocument(document,{initial=false}={}){
  const month=document.seasons[ui.month]?ui.month:document.activeMonth;
  for(const key of ['members','characters','history','awards','communityLinks','seasons','importedSource','siteCopy','futureOverrides','referenceVersion'])data[key]=document[key]===undefined?undefined:structuredClone(document[key]);
  ui.month=month;data.activeMonth=month;data.pinHash=null;
  for(const key of SEASON_KEYS)data[key]=structuredClone(data.seasons[month][key]);
  applyGameScope();recalculateSeason();snapshotSeason();
  ui.day=Math.min(initial?(Math.max(1,...data.logs.map(e=>e.day))):ui.day,data.rules.days);
  if(!data.members.some(m=>m.id===ui.profile))ui.profile=data.members[0]?.id||'__clan__';
  if(!data.tactics.some(t=>t.id===ui.selectedTactic))ui.selectedTactic=data.tactics.find(t=>!t.hidden&&!t.deletedAt)?.id;
  ui.picks=ui.picks.filter(id=>data.tactics.some(t=>t.id===id&&!t.hidden&&!t.deletedAt));
  ext.bossDraft=null;ext.rowUndo=[];ext.rowRedo=[];
  data.settings.editable=!!(syncState.canEdit&&data.settings.editable);
  syncState.baseline=sharedText();
  writeBrowser(SYNC_CACHE,{document,revision:syncState.revision,updatedAt:syncState.updatedAt});
}
function persistShared(){
  writeBrowser(SYNC_PREFS,{theme:data.settings.theme,large:data.settings.large,compact:data.settings.compact,defaultDay:data.settings.defaultDay});
  if(!syncState.ready||!syncState.canEdit||!data.settings.editable)return;
  const text=sharedText();
  if(text===syncState.baseline&&!syncState.inFlight){if(syncState.pending){try{localStorage.removeItem(SYNC_DRAFT);}catch{}}syncState.pending='';refreshSharedStatus();return;}
  syncState.pending=text;
  writeBrowser(SYNC_DRAFT,{document:JSON.parse(text),revision:syncState.revision,savedAt:new Date().toISOString()});
  if(!['conflict','error'].includes(syncState.status))syncState.status='pending';
  clearTimeout(syncState.timer);syncState.timer=setTimeout(flushShared,450);
  refreshSharedStatus();
}
async function stateRequest(url,options={}){
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,signal:AbortSignal.timeout(20000)});
  let body;try{body=await response.json();}catch{throw Object.assign(new Error(response.status===401?'관리자 로그인이 필요합니다.':'서버 응답을 확인하지 못했습니다.'),{status:response.status});}
  if(!response.ok)throw Object.assign(new Error(body.error||'저장에 실패했습니다.'),{status:response.status,body});
  return body;
}
async function flushShared(){
  if(!syncState.pending||syncState.inFlight||!syncState.ready||!syncState.canEdit||['conflict','error'].includes(syncState.status))return;
  const sent=syncState.pending,revision=syncState.revision;
  syncState.inFlight=true;syncState.status='saving';syncState.error='';refreshSharedStatus();
  try {
    const result=await stateRequest('/api/state',{method:'PUT',headers:{'Content-Type':'application/json','X-Redive-Request':'1'},body:JSON.stringify({revision,document:JSON.parse(sent)})});
    syncState.revision=result.revision;syncState.updatedAt=result.updatedAt;syncState.baseline=sent;syncState.status='saved';
    writeBrowser(SYNC_CACHE,{document:JSON.parse(sent),revision:result.revision,updatedAt:result.updatedAt});
    if(syncState.pending===sent){syncState.pending='';try{localStorage.removeItem(SYNC_DRAFT);}catch{}}
    else writeBrowser(SYNC_DRAFT,{document:JSON.parse(syncState.pending),revision:result.revision,savedAt:new Date().toISOString()});
  } catch(error) {
    syncState.error=error.message||'연결이 끊겼습니다. 변경 내용은 이 기기에 보관됩니다.';
    syncState.status=error.status===409?'conflict':[400,413].includes(error.status)?'error':'offline';
    if([401,403].includes(error.status)){syncState.canEdit=false;data.settings.editable=false;ext.workEditing=false;render();}
  } finally {syncState.inFlight=false;refreshSharedStatus();}
  if(syncState.pending&&syncState.status==='saved')syncState.timer=setTimeout(flushShared,100);
}
async function pollShared({force=false}={}){
  if(syncState.polling||syncState.inFlight||(!force&&document.hidden))return;
  syncState.polling=true;
  try {
    const result=await stateRequest('/api/state'+(syncState.ready&&!force?'?since='+syncState.revision:''));
    const roleChanged=syncState.canEdit!==result.canEdit||syncState.authenticated!==result.authenticated;
    syncState.canEdit=!!result.canEdit;syncState.authenticated=!!result.authenticated;
    if(!syncState.canEdit){data.settings.editable=false;ext.workEditing=false;}
    if(result.document){
      if(syncState.pending&&result.revision!==syncState.revision){syncState.status='conflict';syncState.remote=result;syncState.error='다른 창에서 먼저 저장한 변경이 있습니다. 내 변경을 보관한 뒤 최신 자료를 확인하세요.';}
      else if(syncState.pending){syncState.status='pending';syncState.error='';}
      else if(force||!syncState.ready||!(drawer.open||ext.workEditing||document.activeElement?.matches('input,textarea,select'))){
        syncState.revision=result.revision;syncState.updatedAt=result.updatedAt;applySharedDocument(result.document,{initial:!syncState.ready});syncState.ready=true;syncState.status='saved';syncState.error='';render();
      }
    }else if(!syncState.pending&&syncState.status==='offline'){syncState.status='saved';syncState.error='';}
    if(roleChanged)render();
  }catch(error){syncState.status='offline';syncState.error=syncState.ready?'연결이 끊겼습니다. 마지막으로 받은 자료를 표시합니다.':'최신 자료에 연결하지 못했습니다. 다시 연결해 주세요.';}
  finally{syncState.polling=false;refreshSharedStatus();}
}
function showSharedDraft(){
  const draft=readBrowser(SYNC_DRAFT);if(!draft)return;
  const current=draft.document.seasons[draft.document.activeMonth];
  openDrawer('저장하지 못한 변경',`<p>${X(draft.document.activeMonth.replace('-','.'))} · 공격 ${current.logs.length}건 · 택틱 ${current.tactics.length}개</p><p>${X(syncState.error||'이 기기에 보관한 변경입니다.')}</p>`,simpleButton('내 변경 JSON 저장','shared-export-draft')+simpleButton('최신 자료 불러오기','shared-load-latest')+(syncState.canEdit&&draft.revision===syncState.revision?simpleButton('저장 다시 시도','shared-restore-draft','','primary'):''));
}
function sharedBackup(document){
  return {version:1,...document,schema:2,settings:{theme:'light',large:false,compact:false,editable:false,defaultDay:2},pinHash:null,...document.seasons[document.activeMonth]};
}
function legacyDocument(){
  const old=readBrowser(KEY);if(old?.schema!==2||!old.seasons)return null;
  const seasons=structuredClone(old.seasons);
  if(old.activeMonth&&seasons[old.activeMonth])for(const key of SEASON_KEYS)if(old[key]!==undefined)seasons[old.activeMonth][key]=structuredClone(old[key]);
  for(const season of Object.values(seasons)){season.rules.levels=season.rules.levels.filter(l=>l.stage<=4);for(const t of season.tactics)t.stage=4;}
  return {schema:1,members:old.members,characters:old.characters,communityLinks:old.communityLinks||[],seasons,activeMonth:Object.keys(seasons).sort().at(-1),importedSource:old.importedSource};
}
function showLegacyReview(){
  if(!ensureEdit())return;const doc=legacyDocument();if(!doc)return;
  openDrawer('이전 브라우저 자료',`<p>이 기기의 이전 시제품에만 저장했던 자료입니다. 적용하면 공용 자료가 아래 내용으로 바뀝니다.</p>${rowTable(['월','공격','택틱'],Object.entries(doc.seasons).map(([month,s])=>`<tr><td>${X(month.replace('-','.'))}</td><td class="right">${s.logs.length}건</td><td class="right">${s.tactics.length}개</td></tr>`))}`,simpleButton('JSON 저장','shared-export-legacy')+simpleButton('공용 자료에 적용','shared-apply-legacy','','primary'));
}
function initializeSharedSync(){
  syncState.started=true;data.settings.editable=false;
  const prefs=readBrowser(SYNC_PREFS);if(prefs)Object.assign(data.settings,{theme:prefs.theme||'light',large:!!prefs.large,compact:!!prefs.compact,defaultDay:Number(prefs.defaultDay)||2});
  const baseRender=render;render=()=>{baseRender();refreshSharedStatus();};
  const cached=readBrowser(SYNC_CACHE);if(cached?.document){syncState.revision=cached.revision;syncState.updatedAt=cached.updatedAt;applySharedDocument(cached.document,{initial:true});}
  ensureEdit=()=>{if(syncState.ready&&syncState.canEdit&&data.settings.editable&&!['conflict','error'].includes(syncState.status))return true;toast(!syncState.ready?'공용 자료를 불러온 뒤 수정할 수 있습니다.':!syncState.canEdit?'관리자 로그인 후 수정할 수 있습니다.':syncState.status==='conflict'?'다른 창의 변경을 먼저 확인하세요.':'상단에서 편집을 켜세요.');return false;};
  render();pollShared({force:true});
  setInterval(()=>pollShared(),2500);
  window.addEventListener('online',async()=>{await pollShared();if(syncState.pending&&syncState.status!=='conflict')flushShared();});
  window.addEventListener('focus',()=>pollShared());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollShared();});
  window.addEventListener('beforeunload',event=>{flushGrid();if(syncState.pending||syncState.inFlight){event.preventDefault();event.returnValue='';}});
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled||!button.dataset.action.startsWith('shared-'))return;
  event.preventDefault();event.stopImmediatePropagation();const action=button.dataset.action;
  if(action==='shared-review')showSharedDraft();
  if(action==='shared-retry'){await pollShared({force:true});if(syncState.canEdit&&syncState.pending&&syncState.status!=='conflict'){syncState.status='pending';await flushShared();}}
  if(action==='shared-export-draft'){const draft=readBrowser(SYNC_DRAFT);if(draft)downloadFile(JSON.stringify(sharedBackup(draft.document),null,2),'클랜전_미저장_변경.json','application/json');}
  if(action==='shared-load-latest'){syncState.pending='';syncState.status='loading';closeDrawer();await pollShared({force:true});}
  if(action==='shared-restore-draft'){
    const draft=readBrowser(SYNC_DRAFT);if(!syncState.canEdit||!draft||draft.revision!==syncState.revision)return;
    const baseline=syncState.baseline;applySharedDocument(draft.document);syncState.baseline=baseline;syncState.status='pending';data.settings.editable=true;persist();closeDrawer();render();await flushShared();
  }
  if(action==='shared-legacy')showLegacyReview();
  if(action==='shared-export-legacy'){const doc=legacyDocument();if(doc)downloadFile(JSON.stringify(sharedBackup(doc),null,2),'클랜전_이전_브라우저_자료.json','application/json');}
  if(action==='shared-apply-legacy'){
    if(!ensureEdit())return;const doc=legacyDocument();if(!doc)return;
    const baseline=syncState.baseline;applySharedDocument(doc);syncState.baseline=baseline;persist();closeDrawer();render();await flushShared();
  }
},true);
