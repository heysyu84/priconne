// Text is replaced as text, never as HTML. Navigation and calculation keys stay fixed.
const copyRegistry=new Set(['클랜전','배틀로그','택틱','기록·통계','클랜 DB','상황판','대시보드','추천 조합','택틱 작업실','이월 계산','외부 택틱','택틱 변환기','월간 순위','개인 이력','과거 기록','과거 이력','명예의 전당','클랜원','역대 클랜원','기여도','캐릭터·초상화','설정','피해량','미래 보스']);
const sourceTextNodes=new WeakMap(),sourceAttributes=new WeakMap();
function copyFor(text){return Object.hasOwn(data.siteCopy||{},text)?data.siteCopy[text]:text;}
const originalToast=toast;
toast=(message,undo=false)=>{if(copyCatalogValue(String(message)))copyRegistry.add(String(message));return originalToast(copyFor(String(message)),undo);};
function copyCatalogValue(value){
  if(!value||value.length>3000||!/[가-힣A-Za-z]/.test(value))return false;
  if(/^\d+(?:[.,]\d+)*\s*(?:억|만|명|개|건|위|개월|타|초|%|행)(?:\s|$)/.test(value))return false;
  if(/^\d{4}[.-]\d|^\d+행\s|3타 선택$|^↳|^· 기대딜\s*[\d,]|^\d+넴.*\d+억/.test(value))return false;
  return true;
}
function copyEligible(node){
  const parent=node.parentElement,source=node.nodeValue?.trim();if(!parent||!copyCatalogValue(source))return false;
  if(parent.closest('script,style,textarea,pre,code,.numeric,.unit,.member-link,.raid-name,.instruction-cell,.tactic-note,.work-item strong,[data-copy-editor],#toast'))return false;
  if(data.members.some(m=>m.name===source)||data.characters.some(c=>c.name===source)||data.bossSettings.some(b=>b.name===source))return false;
  return true;
}
function applySiteCopy(root){
  if(!document.createTreeWalker||!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while(node=walker.nextNode()){
    if(!copyEligible(node)&&!sourceTextNodes.has(node))continue;
    const original=sourceTextNodes.get(node)||node.nodeValue.trim();sourceTextNodes.set(node,original);copyRegistry.add(original);
    const value=copyFor(original),next=node.nodeValue.replace(node.nodeValue.trim(),value);if(node.nodeValue!==next)node.nodeValue=next;
    if(node.parentElement)node.parentElement.classList.toggle('copy-pick-target',!!ext.copyPickMode);
  }
  for(const element of root.querySelectorAll('[placeholder],[title],[aria-label],[alt],[data-label]')){
    if(element.closest('[data-copy-editor]'))continue;let originals=sourceAttributes.get(element);if(!originals){originals={};sourceAttributes.set(element,originals);}
    for(const attr of ['placeholder','title','aria-label','alt','data-label']){
      const value=element.getAttribute(attr);if(!copyCatalogValue(value))continue;
      originals[attr]??=value;copyRegistry.add(originals[attr]);const target=attr==='data-label'?'data-display-label':attr,replacement=copyFor(originals[attr]);if(element.getAttribute(target)!==replacement)element.setAttribute(target,replacement);
    }
  }
  let control=document.getElementById('copy-pick-control');
  if(ext.copyPickMode){if(!control){control=document.createElement('button');control.id='copy-pick-control';control.dataset.action='copy-pick-stop';document.body.append(control);}if(control.textContent!=='문구 선택 중 · 끝내기')control.textContent='문구 선택 중 · 끝내기';}
  else control?.remove();
}
function collectCopyCatalog(){
  if(!document.createElement)return;
  const savedUi={...ui,tabs:{...ui.tabs},picks:[...ui.picks]},savedExt={...ext};
  for(const [section,tabs]of Object.entries({overview:['bosses','members','logs'],tactics:['combos','workspace','tools','external','converter','trash'],records:['ranking','profile','archive','history','hall'],clan:['members','alumni','rates','characters']}))for(const tab of tabs){
    try{ui.section=section;if(tab)ui.tabs[section]=tab;const template=document.createElement('template');template.innerHTML=renderPage();applySiteCopy(template.content);}catch{}
  }
  Object.assign(ui,savedUi);ui.tabs=savedUi.tabs;Object.assign(ext,savedExt);
}
function settingsCopy(){
  if(!ext.copyCatalogReady){collectCopyCatalog();ext.copyCatalogReady=true;}
  const query=String(ext.copyQuery||'').trim(),entries=[...new Set([...copyRegistry,...Object.keys(data.siteCopy||{})])].filter(key=>!query||key.includes(query)||copyFor(key).includes(query)).sort((a,b)=>a.localeCompare(b,'ko'));
  return `<section class="settings-sheet copy-editor" data-copy-editor><div class="sheet-heading"><h2>메뉴·문구</h2>${simpleButton('화면에서 문구 선택','copy-pick-start','','primary')}</div><div class="toolbar"><input id="copy-query" class="search-input" placeholder="원문·현재 문구 검색" data-input="copy-query" value="${X(ext.copyQuery||'')}"><span>${entries.length}개</span></div><p class="field-help">수정한 문구는 모든 방문자에게 적용됩니다. 기록·캐릭터명은 각 편집 화면에서 수정합니다.</p><div class="copy-entries">${entries.map(key=>`<div class="copy-entry"><div><span>${X(key)}</span>${copyFor(key)!==key?`<strong>${X(copyFor(key))}</strong>`:''}</div><button class="button quiet" data-action="copy-edit" data-key="${X(key)}">수정</button></div>`).join('')}</div></section>`;
}
function openCopyEditor(key){
  if(!ensureEdit())return;ext.copyEditingKey=key;
  openDrawer('문구 수정',`<div data-copy-editor><div class="field"><label>원문</label><p class="copy-original">${X(key)}</p></div><div class="field"><label for="copy-replacement">표시할 문구</label><textarea id="copy-replacement" name="replacement" rows="3">${X(copyFor(key))}</textarea></div></div>`,simpleButton('원문으로 복원','copy-reset')+'<button class="button primary" type="submit">저장</button>','',false,'ops-copy-edit');
}
function handleCopyPick(event){
  if(!ext.copyPickMode||event.target.closest('#copy-pick-control,[data-copy-editor],#drawer'))return false;
  const walker=document.createTreeWalker(event.target,NodeFilter.SHOW_TEXT);let node,key;
  while(node=walker.nextNode()){if(sourceTextNodes.has(node)){key=sourceTextNodes.get(node);break;}if(copyEligible(node)){key=node.nodeValue.trim();break;}}
  if(!key)return false;event.preventDefault();event.stopImmediatePropagation();ui.drawerTrigger=event.target;openCopyEditor(key);return true;
}

function localFuturePortrait(boss){return FUTURE_ASSETS[boss.referenceKey]||boss.portrait||'';}
function selectedFutureLineup(month){return data.futureOverrides?.[month]||(ext.futureCatalog||FUTURE_REFERENCE).months[month]||null;}
function applyFutureLineupToSeason(season,month){
  const lineup=selectedFutureLineup(month);if(season.logs.length||!lineup||lineup.bosses.length!==5||lineup.bosses.some(b=>!['verified','manual'].includes(b.status)||!b.name))return false;
  for(const boss of season.bossSettings){const source=lineup.bosses.find(b=>b.slot===boss.id);boss.name=source.name;boss.portraitUrl=localFuturePortrait(source);boss.portraitKey='future';}return true;
}
async function loadFutureCatalog(force=false){
  if(ext.futureLoading)return;ext.futureLoading=true;
  try{const response=await fetch('/api/future-bosses',{method:force?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:force?{'Content-Type':'application/json','X-Redive-Request':'1'}:undefined,body:force?'{}':undefined,signal:AbortSignal.timeout(22000)});const result=await response.json();if(!response.ok)throw new Error(result.error||'자료를 확인하지 못했습니다.');ext.futureCatalog=result;ext.futureError='';}
  catch(error){ext.futureError=error.message;}finally{ext.futureLoading=false;ext.futureLoaded=true;if(ui.section==='clan'&&(ui.tabs.clan==='future'||ui.tabs.clan==='settings'&&ext.settingsPage==='future')&&!document.activeElement?.closest('form[data-form="ops-future"]'))render();}
}
function futureBossSettings(){
  if(typeof fetch==='function'&&!ext.futureLoaded&&!ext.futureLoading)loadFutureCatalog();
  const catalog=ext.futureCatalog||FUTURE_REFERENCE,months=[...new Set([...Object.keys(catalog.months),...Object.keys(data.futureOverrides||{})])].sort();
  ext.futureMonth=months.includes(ext.futureMonth)?ext.futureMonth:months.find(m=>m>ui.month)||months[0];const month=ext.futureMonth,lineup=selectedFutureLineup(month);
  const edited=!!data.futureOverrides?.[month],stamp=catalog.checkedAt||catalog.updatedAt;
  return `<section class="settings-sheet future-settings"><div class="sheet-heading"><h2>미래 보스</h2>${data.settings.editable?simpleButton(ext.futureLoading?'확인 중':'새 자료 확인','future-refresh') :''}</div><div class="future-month-row"><label for="future-month">한국 서버</label><select id="future-month" data-input="future-month">${months.map(key=>`<option value="${key}" ${month===key?'selected':''}>${key.replace('-','.')}</option>`).join('')}</select><span>일본 ${lineup?.jpMonth?.replace('-','.')||'—'} + 13개월</span></div><div class="table-tools"><span>${stamp?'확인 '+new Date(stamp).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):''}</span><span>${edited?'관리자 수정 적용':lineup?.bosses.every(b=>b.status==='verified')?'편성 확인됨':'일부 이름 확인 필요'}</span></div>${ext.futureError||catalog.refreshError?`<p class="field-help danger">${X(ext.futureError||catalog.refreshError)}</p>`:''}${lineup?`<form data-form="ops-future"><input type="hidden" name="month" value="${month}"><div class="future-boss-grid">${lineup.bosses.map(b=>`<div class="future-boss-row" style="${bossStyle(b.slot)}"><span class="future-boss-portrait"><img src="${X(localFuturePortrait(b))}" alt="${X(b.name)}" width="64" height="64"><strong>${b.slot}넴</strong></span><div class="field"><label for="future-name-${b.slot}">보스 이름</label><input id="future-name-${b.slot}" name="name-${b.slot}" value="${X(b.name)}" required ${data.settings.editable?'':'readonly'}><small>${X(b.sourceName||'')}</small></div>${data.settings.editable?`<details><summary>그림 주소</summary><input name="portrait-${b.slot}" aria-label="${b.slot}넴 그림 주소" value="${X(localFuturePortrait(b))}"></details>`:''}</div>`).join('')}</div>${data.settings.editable?`<div class="toolbar"><button class="button primary" type="submit">편성 저장</button>${edited?simpleButton('자동 자료로 복원','future-reset'):''}${!data.seasons[month]?simpleButton('이 월 만들기','future-create'):data.seasons[month].logs.length===0?simpleButton('빈 월에 구성 적용','future-apply'):''}</div>`:''}</form>`:''}<p class="field-help">새 월을 만들면 확인된 보스 구성을 자동으로 적용합니다. HP·배율은 월별 보스·규칙에서 설정합니다.</p></section>`;
}
completeSettings=()=>{
  const admin=!syncState.started||syncState.canEdit;
  const tabs=admin?[['display','화면'],['rules','월별 보스·규칙'],['future','미래 보스'],['copy','메뉴·문구'],['data','월·백업'],['access','공유·권한'],['links','자료 링크']]:[['display','화면'],['future','미래 보스'],['access','공유·권한']];
  if(!tabs.some(([key])=>key===ext.settingsPage))ext.settingsPage='display';
  return `<div class="settings-navigation">${tabs.map(([key,name])=>`<button class="${ext.settingsPage===key?'active':''}" data-action="v2-settings-page" data-value="${key}">${name}</button>`).join('')}</div>`+({display:settingsDisplay,rules:settingsRules,future:futureBossSettings,copy:settingsCopy,data:settingsData,access:settingsAccess,links:settingsLinks}[ext.settingsPage]||settingsDisplay)();
};
fullClan=()=>titleBar(ui.tabs.clan==='settings'?'설정':'클랜 DB')+pageTabs([['members','클랜원'],['alumni','역대 클랜원'],['rates','기여도'],['future','미래 보스'],['characters','캐릭터·초상화'],['settings','설정']])+({members:()=>completeRoster(false),alumni:()=>completeRoster(true),rates:completeRates,future:futureBossSettings,characters:characterLibrary,settings:completeSettings}[ui.tabs.clan]||(()=>completeRoster(false)))();
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const action=button.dataset.action;if(!/^(copy-|future-)/.test(action))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(action==='copy-edit')openCopyEditor(button.dataset.key);
  if(action==='copy-pick-start'){if(!ensureEdit())return;ext.copyPickMode=true;applySiteCopy(app);}
  if(action==='copy-pick-stop'){ext.copyPickMode=false;applySiteCopy(app);}
  if(action==='copy-reset'){if(!ensureEdit())return;delete data.siteCopy[ext.copyEditingKey];persist();closeDrawer();render();}
  if(action==='future-refresh'){if(!ensureEdit())return;await loadFutureCatalog(true);}
  if(action==='future-reset'){if(!ensureEdit())return;delete data.futureOverrides[ext.futureMonth];persist();render();}
  if(action==='future-create'){if(!ensureEdit())return;openNewMonth();const field=document.getElementById('new-month-key');if(field)field.value=ext.futureMonth;}
  if(action==='future-apply'){if(!ensureEdit())return;const season=data.seasons[ext.futureMonth];if(season&&applyFutureLineupToSeason(season,ext.futureMonth)){if(ext.futureMonth===ui.month)for(const key of SEASON_KEYS)data[key]=structuredClone(season[key]);recalculateSeason();persist();render();}}
},true);
document.addEventListener('submit',event=>{
  const form=event.target.closest('form[data-form]');if(!form||!['ops-copy-edit','ops-future'].includes(form.dataset.form))return;
  event.preventDefault();event.stopImmediatePropagation();if(!ensureEdit())return;const fd=new FormData(form);
  if(form.dataset.form==='ops-copy-edit'){data.siteCopy[ext.copyEditingKey]=String(fd.get('replacement'));persist();closeDrawer();render();}
  else {const month=String(fd.get('month')),lineup=structuredClone(selectedFutureLineup(month));for(const boss of lineup.bosses){boss.name=String(fd.get('name-'+boss.slot)).trim();boss.portrait=String(fd.get('portrait-'+boss.slot)||localFuturePortrait(boss));boss.status='manual';boss.referenceKey=null;}data.futureOverrides[month]=lineup;persist();render();}
},true);
document.addEventListener('input',event=>{if(event.target.dataset.input==='copy-query'){ext.copyQuery=event.target.value;refreshSearch('copy-query',()=>{});}});
document.addEventListener('change',event=>{if(event.target.dataset.input==='future-month'){ext.futureMonth=event.target.value;render();}});
if(typeof MutationObserver!=='undefined'){
  let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;applySiteCopy(app);if(drawer.open)applySiteCopy(drawer);});}).observe(document.body,{childList:true,characterData:true,subtree:true});
}
