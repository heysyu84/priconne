import { isBoosterCharacter, formatExpectedDamage, sourceLinkBox } from './view-settings.mjs?v=20261023-image-cleanup01';
import { characterPortrait, portraitAttributes, portraitStarOverlay, normalizeCharacterName, findCharacter } from './character-portraits.mjs?v=20261023-image-cleanup01';
import { makeId, parseDamage } from './roster.mjs?v=20261022-ui14';
import { GROUPS, groupOf, titleFor, compareTactics, newRow, checkedSix, commandState, recalculateTacticRows, replaceTacticRowText, pastedRows, richLine, parseClock, clock, escapeHtml as X } from './tactics-model.mjs?v=20261023-foreign01';
import { shiftTimeline } from './engine.mjs?v=20261022-ui14';
import { parseTacticTransfer, validTacticLineup, hasTacticSlots, resolveTacticSlots } from './tactic-transfer.mjs?v=20261023-slots01';

export function createTacticWorkspace(api) {
  const { getApp, getMonth, persist, render, notify, navigate, section, copyText, catalog = [] } = api;
  const state={month:null,group:'택틱정리',boss:'all',selected:null,remaining:null,trash:false,restore:null,undo:[],rememberedAt:0,more:false};
  const $=selector=>document.querySelector(selector);
  const month=()=>getMonth(), base=()=>Number(month().options.battleSeconds||90);
  const all=()=>month().tactics;
  const current=()=>all().find(t=>t.id===state.selected&&!t.trashedAt);
  const visible=()=>all().filter(t=>!t.trashedAt&&groupOf(t)===state.group&&(state.boss==='all'||String(t.boss||'none')===state.boss)).sort(compareTactics);
  const canEdit=()=>api.canEdit?.()??true;
  const viewing=()=>state.remaining!==null;
  const readOnly=()=>viewing()||!canEdit();
  const personalKey=()=>`nyang-personal-carry:${getApp().active}:${state.selected}`;
  function loadPersonal(){if(state.personalId===personalKey())return;state.personalId=personalKey();try{const saved=localStorage.getItem(personalKey()),n=Number(saved);state.remaining=saved!==null&&n>=0&&n<=Number(month().options.carryMaxSeconds||base())&&n!==base()?n:null;}catch{state.remaining=null;}}
  function setPersonal(n){state.remaining=n===base()?null:n;state.personalId=personalKey();try{if(state.remaining===null)localStorage.removeItem(personalKey());else localStorage.setItem(personalKey(),String(state.remaining));}catch{}}
  const validURL=u=>{try{const v=new URL(u);return ['https:','http:'].includes(v.protocol)?v.href:'';}catch{return '';}};
  const imageData=(t,i)=>characterPortrait(catalog,t.characters[i],t.stars[i],t.customPortraits?.[i]);
  const imageUrl=(t,i)=>imageData(t,i).url;
  function prepare(){
    if(state.month!==getApp().active){state.month=getApp().active;state.selected=null;state.boss='all';state.remaining=null;state.trash=false;state.undo=[];}
    if(!visible().some(t=>t.id===state.selected))state.selected=visible()[0]?.id||null;loadPersonal();
  }
  function remember(force=false){
    if(!force&&state.rememberedEl===document.activeElement&&Date.now()-state.rememberedAt<1200)return;
    state.undo.push({month:getApp().active,tactics:JSON.stringify(all()),selected:state.selected});
    if(state.undo.length>20)state.undo.shift();state.rememberedAt=Date.now();state.rememberedEl=document.activeElement;
  }
  function save(){const t=current();if(t)t.title=titleFor(t);persist();$('#tw-title')&&( $('#tw-title').innerHTML=t?editorTitle(t):'');document.querySelectorAll('[data-tw="undo"]').forEach(b=>b.disabled=!state.undo.length);const card=$('.tw-card[data-tw-id="'+CSS.escape(t?.id||'')+'"] .tw-card-title');if(card){card.textContent=t.title;const small=card.parentNode.querySelector('small');if(small)small.textContent=t.rows.length+'행'+(!t.rows.length?' · 작성 전':'')+(t.note?' · '+t.note:'');}}
  function redraw(focus=null){state.restore=focus;render();}
  function undo(){if(!canEdit())return;const el=document.activeElement,row=el?.closest('[data-tw-row]'),index=current()?.rows.findIndex(r=>r.id===row?.dataset.twRow)??-1,meta=el?.id;const snapshot=state.undo.pop();if(!snapshot||snapshot.month!==getApp().active)return notify('취소할 택틱 변경이 없습니다.');month().tactics=JSON.parse(snapshot.tactics);state.selected=snapshot.selected;state.remaining=null;state.rememberedAt=0;persist();redraw(row?{row:current()?.rows[Math.max(0,index)]?.id||'draft'}:meta?{meta}:null);notify('택틱 변경을 취소했습니다.');}
  function library(){
    const groups=new Map();for(const t of visible()){const key=t.boss||'none';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);}
    return `<aside class="panel tw-library"><div class="panel-head"><h2>${X(state.group)} <span class="pill">${visible().length}개</span></h2>${canEdit()?'<button type="button" class="btn sm" data-tw="new" aria-label="현재 탭에 새 택틱">＋</button>':''}</div><div id="tw-library-list">${libraryCards(groups)}</div></aside>`;
  }
  function libraryCards(groups=null){
    if(!groups){groups=new Map();for(const t of visible()){const key=t.boss||'none';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);}}
    return [...groups.entries()].sort(([a],[b])=>(a==='none'?9:Number(a))-(b==='none'?9:Number(b))).map(([boss,items])=>`<div class="tw-boss-label" data-boss-color="${boss}">${boss==='none'?'보스 미분류':`${boss}넴 · ${X(month().bosses.find(b=>b.id===Number(boss))?.name||'')}`}</div>${items.map(t=>`<button type="button" data-boss-color="${boss}" class="tw-card ${t.id===state.selected?'active':''}" data-tw="select" data-tw-id="${X(t.id)}"><span class="tw-card-title">${X(t.title)}</span><small>${t.rows.length}행${!t.rows.length?' · 작성 전':''}${t.note?' · '+X(t.note):''}</small></button>`).join('')}`).join('')||'<div class="empty">해당 택틱이 없습니다.<br>새 택틱을 만들어 바로 입력하세요.</div>';
  }
  function portrait(t,i){const data=imageData(t,i),url=data.url;return `<label class="tw-portrait-upload" title="${canEdit()?'클릭해 초상화 지정':X(t.characters[i]||'캐릭터')+' 초상화'}"><span class="tw-portrait star-${t.stars[i]||'unknown'}"><span class="tw-initial">${X(t.characters[i]?.slice(0,1)||'?')}</span>${url?`<img src="${X(url)}" alt="${X(t.characters[i]||'캐릭터')} 초상화" data-portrait-image="${i}" ${portraitAttributes(data)}>${portraitStarOverlay(data)}`:''}</span><input type="file" accept="image/png,image/jpeg,image/webp" data-tw-portrait="${i}" hidden><small>초상화 지정</small></label>`;}
  function configuration(t){
    return `<div class="tw-config"><div class="tw-meta"><div class="field"><label for="tw-boss">보스</label><select id="tw-boss" data-tw-meta="boss"><option value="">미분류</option>${month().bosses.map(b=>`<option value="${b.id}" ${t.boss===b.id?'selected':''}>${b.id}넴 · ${X(b.name)}</option>`).join('')}</select></div><div class="field"><label for="tw-expected">기대딜</label><input id="tw-expected" data-tw-meta="expectedDamage" value="${X(t.expectedDamage)}" placeholder="원문 수치 / 3.1억"></div><div class="field"><label for="tw-group">분류 탭</label><select id="tw-group" data-tw-meta="group">${GROUPS.map(g=>`<option ${groupOf(t)===g?'selected':''}>${g}</option>`).join('')}</select></div></div>
      <div class="tw-characters">${t.characters.map((c,i)=>`<div class="tw-character-slot">${portrait(t,i)}<div><label for="tw-char-${i}">캐릭터 ${i+1}</label><input id="tw-char-${i}" class="${isBoosterCharacter(getApp(),c,catalog)?'is-booster':''}" role="combobox" aria-autocomplete="list" aria-expanded="false" data-tw-char="${i}" value="${X(c)}" placeholder="캐릭터 이름" autocomplete="off"><select aria-label="캐릭터 ${i+1} 성급" data-tw-star="${i}"><option value="">성급 미확인</option>${[1,2,3,4,5,6].map(s=>`<option value="${s}" ${String(t.stars[i])===String(s)?'selected':''}>★ ${s}</option>`).join('')}</select></div></div>`).join('')}</div>
      <datalist id="tw-character-names">${catalog.map(p=>`<option value="${X(p.name)}">${X((p.aliases||[]).join(' · '))}</option>`).join('')}</datalist>
      <details class="tw-more" ${state.more?'open':''}><summary>메모 · 영상 · 빠른 편성 입력</summary><div class="tw-meta-more"><div class="field"><label for="tw-lineup">캐릭터 5명 한 번에 입력</label><input id="tw-lineup" value="${X(t.characters.join(', '))}" placeholder="쉼표로 5명 구분 · Enter 적용"></div><div class="field"><label for="tw-stars">성급 한 번에 입력</label><input id="tw-stars" maxlength="5" inputmode="numeric" value="${X(t.stars.join(''))}" placeholder="예: 55565 · Enter 적용"></div><div class="field"><label for="tw-note">메모 · 스펙 조건</label><input id="tw-note" data-tw-meta="note" value="${X(t.note||'')}"></div><div class="field"><label for="tw-video">영상 주소</label><input id="tw-video" data-tw-meta="video" type="url" value="${X(t.video||'')}" placeholder="https://..."></div></div></details></div>`;
  }
  function rowHtml(row,index,t,blank=false){
    const text=viewing()?shiftTimeline(row.text,state.remaining,base()):row.text;
    const expired=viewing()&&/\d+:\d{2}/.test(row.text)&&!text.match(/\d+:\d{2}/);
    return `<tr data-tw-row="${X(row.id)}" class="${blank?'tw-blank ':''}${expired?'tw-expired':''}">${checkedSix(row.checked).map((checked,i)=>`<td class="tw-check-cell ${i===5?'tw-auto-cell':''}"><input type="checkbox" data-tw-check="${i}" aria-label="${blank?'새 행':(index+1)+'행'} ${i===5?'AUTO':X(t.characters[i]||'캐릭터 '+(i+1))} SET" ${checked?'checked':''} ${readOnly()?'disabled':''}></td>`).join('')}<td class="tw-text-cell"><div role="textbox" aria-multiline="true" aria-label="${blank?'새 택틱 행':(index+1)+'행 택틱'}" data-tw-text="${X(row.id)}" ${readOnly()?'tabindex="0" aria-readonly="true"':'contenteditable="true" spellcheck="false"'} data-placeholder="${blank?'여기에 바로 입력 · Enter로 다음 행 · 여러 행 붙여넣기':''}">${richLine(row,t.characters,catalog,state.remaining,base())}</div></td><td class="tw-row-tools">${!readOnly()&&!blank?`<button type="button" data-tw="row-delete" data-row="${X(row.id)}" aria-label="${index+1}행 삭제" title="행 삭제 (Ctrl Shift K)">×</button>`:''}</td></tr>`;
  }
  function checkPortrait(t,i){const data=imageData(t,i),url=data.url;return url?`<span class="tw-check-art"><img class="tw-check-portrait" ${portraitAttributes(data)} src="${X(url)}" alt="${X(t.characters[i]||'캐릭터')}" title="${X(t.characters[i]||'캐릭터')}">${portraitStarOverlay(data)}</span>`:'<span class="tw-check-portrait missing">?</span>';}
  function grid(t){
    return `<div class="tw-grid-scroll"><table class="tw-grid" aria-label="택틱 작성 표"><colgroup>${Array(6).fill('<col class="tw-col-check">').join('')}<col><col class="tw-col-tools"></colgroup><thead><tr>${t.characters.map((c,i)=>`<th title="${X(c)}">${checkPortrait(t,i)}</th>`).join('')}<th class="tw-auto-heading" title="AUTO">A</th><th>조작 · 시간${viewing()?' <span class="pill blue">이월 적용 중</span>':canEdit()?' <span class="tw-edit-hint">바로 입력 가능</span>':''}</th><th></th></tr></thead><tbody id="tw-rows">${t.rows.map((r,i)=>rowHtml(r,i,t)).join('')}${readOnly()?'':rowHtml(newRow(t.rows.at(-1)?.checked||[]),t.rows.length,t,true).replace(/data-tw-row="[^"]+"/, 'data-tw-row="draft"').replace(/data-tw-text="[^"]+"/, 'data-tw-text="draft"')}</tbody></table></div>`;
  }
  function carryControls(t){
    return `<div class="tw-carry-controls"><div class="tw-carry-entry"><div class="field"><label for="tw-carry">이월 받은 시간</label><input id="tw-carry" inputmode="numeric" value="${clock(state.remaining??base())}" placeholder="1:01 / 61"></div><button type="button" class="btn sm primary" data-tw="carry">이월 적용 <kbd>Enter</kbd></button></div><button type="button" class="btn sm" data-tw="original" title="원본 ${clock(base())}로 초기화" aria-label="원본 ${clock(base())}로 초기화" ${viewing()?'':'disabled'}>초기화</button><span class="tw-carry-state">${viewing()?`이월 적용 중 · ${state.remaining}초 · 나에게만 표시`:`이월 설정은 이 브라우저에만 저장`}</span></div>`;
  }
  function editor(t){
    if(!t)return `<section class="panel tw-work" data-editor-build="20261022-pages10"><div class="empty">선택한 보스에 택틱이 없습니다.${canEdit()?'<br><button type="button" class="btn primary" data-tw="new">새 택틱 작성</button>':''}</div></section>`;
    return `<section class="panel tw-work" data-editor-build="20261022-pages10">${bossHeader(t)}<div class="panel-head tw-editor-head"><h2 id="tw-title">${editorTitle(t)}</h2><div class="btnbar">${canEdit()?'<button type="button" class="btn sm" data-tw="duplicate">복제</button><button type="button" class="btn sm danger" data-tw="delete">택틱 삭제</button>':''}</div></div><fieldset class="tw-config-fieldset" ${canEdit()?'':'disabled'}>${configuration(t)}</fieldset>${tacticLinks(t)}${viewing()?'<div class="tw-preview-note">개인 화면에만 이월 결과를 적용했습니다. ‘초기화’ 버튼으로 원본 풀택틱을 볼 수 있습니다.</div>':canEdit()?'<div class="tw-key-help"><kbd>Enter</kbd> 다음 행 생성 · <kbd>Shift Enter</kbd> 셀 안 줄바꿈 · <kbd>Ctrl ↑↓</kbd> 행 이동 · <kbd>Alt ↑↓</kbd> 순서 변경 · <kbd>Ctrl Shift K</kbd> 행 삭제 · 여러 행/시트 SET 6칸 붙여넣기</div>':''}${grid(t)}<div class="tw-bottom">${canEdit()?'<span>빨강 ON/SET · 파랑 OFF · 초록 한번만</span>':''}<div class="btnbar">${canEdit()?`<button type="button" class="btn sm" data-tw="restate" ${readOnly()?'disabled':''}>문장으로 SET 다시 계산</button>`:''}<button type="button" class="btn sm" data-tw="copy">현재 택틱 복사</button><button type="button" class="btn sm" data-tw="copy-set">SET 포함 복사</button></div></div></section>`;
  }
  function bossHeader(t){const b=api.bossStatus?.().find(b=>b.id===t.boss);if(!b)return '';const image=api.bossPortrait?.(b.id);return `<div class="tw-boss-banner" data-boss-color="${t.boss}">${image?`<img src="${X(image)}" alt="${X(b.name)} 보스">`:''}<div><span>BOSS ${String(b.id).padStart(2,'0')} · ${b.stage}단계 ${b.lap}회차</span><strong>${X(b.name)}</strong></div><div class="tw-boss-hp"><span>남은 HP</span><strong>${Number(b.hp).toLocaleString('ko-KR')}</strong></div></div>`;}
  function trashView(){return `<section class="panel"><div class="panel-head"><h2>삭제한 택틱</h2><button type="button" class="btn sm" data-tw="close-trash">작성으로 돌아가기</button></div><p class="muted small">삭제한 택틱의 본문과 SET 상태를 보관합니다. 복원하면 원래 분류로 돌아갑니다.</p><div class="tw-trash-list">${all().filter(t=>t.trashedAt).map(t=>`<div><div><strong>${X(t.title)}</strong><small>${X(groupOf(t))} · ${t.rows.length}행</small></div><button type="button" class="btn sm" data-tw="restore" data-tw-id="${X(t.id)}" aria-label="${X(t.title)} 복원">복원</button><button type="button" class="btn sm danger" data-tw="purge" data-tw-id="${X(t.id)}">완전 삭제</button></div>`).join('')||'<div class="empty">삭제한 택틱이 없습니다.</div>'}</div></section>`;}
  function view(isCalculator=false){prepare();const t=current();return section(isCalculator?'이월 · 원본 택틱':'택틱 작업실',isCalculator?'원본의 색상과 SET을 유지하며 이월 시간을 바로 적용합니다.':'한 화면에서 작성·정리·이월 적용까지. 입력한 내용은 자동 저장됩니다.',canEdit()?`<button type="button" class="btn" data-tw="undo" ${state.undo.length?'':'disabled'}>실행 취소</button><button type="button" class="btn" data-tw="trash">삭제함 ${all().filter(t=>t.trashedAt).length}</button><button type="button" class="btn primary" data-tw="new">＋ 새 택틱</button>`:'')
    +`<div class="tw-navigation tw-navigation-grid"><div class="tw-group-tabs" role="tablist" aria-label="택틱 분류">${GROUPS.map(group=>`<button type="button" role="tab" aria-selected="${state.group===group}" data-tw="group" data-value="${group}">${group}<span>${all().filter(t=>!t.trashedAt&&groupOf(t)===group).length}</span></button>`).join('')}<button type="button" class="tw-estimate-toggle" data-tw="toggle-estimate">◷ 이월 계산기</button></div>${carryControls(t)}<div class="tw-boss-tabs" role="tablist" aria-label="보스별 택틱">${[['all','전체'],...month().bosses.map(b=>[String(b.id),`${b.id}넴`]),['none','미분류']].map(([value,label])=>`<button type="button" role="tab" aria-selected="${state.boss===value}" data-tw="boss-filter" data-value="${value}" data-boss-color="${value}">${label}</button>`).join('')}</div>${communityLinks()}</div>`
    +(state.estimate?estimator():'')+(state.trash?trashView():`<div class="tw-layout">${library()}${editor(t)}</div>`);
  }
  function choose(id){state.personalId=null;state.selected=id;state.remaining=null;state.trash=false;redraw();}
  function create(){remember(true);const t={id:makeId(),boss:state.boss!=='all'&&state.boss!=='none'?Number(state.boss):1,group:state.group,source:state.group,characters:Array(5).fill(''),stars:Array(5).fill('5'),expectedDamage:'',note:'',video:'',type:'세미오토',rows:[],editorVersion:1};t.title=titleFor(t);all().unshift(t);state.boss='all';state.selected=t.id;state.remaining=null;state.trash=false;persist();redraw({meta:'tw-char-0'});}
  function redrawRows(focusId=null){const t=current();if(!t||!$('#tw-rows'))return;$('#tw-rows').innerHTML=t.rows.map((r,i)=>rowHtml(r,i,t)).join('')+(readOnly()?'':rowHtml({...newRow(t.rows.at(-1)?.checked||[]),id:'draft'},t.rows.length,t,true));if(focusId)focusRow(focusId);}
  function focusRow(id){const input=$(`[data-tw-text="${CSS.escape(id)}"]`);if(!input)return;input.focus();const range=document.createRange();range.selectNodeContents(input);range.collapse(false);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);input.scrollIntoView({block:'nearest'});}
  function rowFor(el,materialize=true){const tr=el.closest('[data-tw-row]'),t=current();if(!tr||!t)return null;let r=t.rows.find(r=>r.id===tr.dataset.twRow);if(!r&&materialize){if(tr.dataset.twRow!=='draft'||!tr.isConnected)return null;r=newRow(t.rows.at(-1)?.checked||[]);t.rows.push(r);tr.dataset.twRow=r.id;tr.querySelector('[data-tw-text]').dataset.twText=r.id;tr.querySelector('[data-tw-text]').setAttribute('aria-label',t.rows.length+'행 택틱');tr.querySelectorAll('[data-tw-check]').forEach((c,i)=>c.setAttribute('aria-label',t.rows.length+'행 '+(i===5?'AUTO':t.characters[i]||'캐릭터 '+(i+1))+' SET'));tr.classList.remove('tw-blank');$('#tw-rows').insertAdjacentHTML('beforeend',rowHtml({...newRow(r.checked),id:'draft'},t.rows.length,t,true));}return r;}
  function readText(el){return el.innerText.replace(/\r/g,'').replace(/\n$/,'');}
  function recalcAuto(start=0){const t=current();recalculateTacticRows(t.rows,t.characters,catalog,start);for(let i=start;i<t.rows.length;i++)updateChecks(t.rows[i]);}
  function updateChecks(row){const tr=$(`[data-tw-row="${CSS.escape(row.id)}"]`);tr?.querySelectorAll('[data-tw-check]').forEach((el,i)=>el.checked=!!row.checked[i]);}
  function editText(el){if(readOnly())return;const text=readText(el),existing=rowFor(el,false);if(existing?.text===text||(!existing&&!text.trim()))return;remember();const row=existing||rowFor(el);if(!row)return;replaceTacticRowText(row,text);recalcAuto(current().rows.indexOf(row));save();}
  function insertAfter(el){if(!canEdit())return;const t=current();remember(true);const row=rowFor(el);const index=t.rows.indexOf(row);const next=t.rows[index+1];if(next&&!next.text){focusRow(next.id);return;}const fresh=newRow(row.checked);t.rows.splice(index+1,0,fresh);save();redrawRows(fresh.id);}
  function deleteRow(id){if(!canEdit())return;const t=current(),index=t.rows.findIndex(r=>r.id===id);if(index<0)return;remember(true);t.rows.splice(index,1);save();redrawRows(t.rows[Math.min(index,t.rows.length-1)]?.id||'draft');}
  function applyCarry(){const seconds=parseClock($('#tw-carry')?.value,Number(month().options.carryMaxSeconds||base()));if(!Number.isFinite(seconds))return notify(`이월 시간을 0~${month().options.carryMaxSeconds||base()}초 또는 1:01 형식으로 입력하세요.`);setPersonal(seconds);redraw();}
  function applyLineup(){const t=current(),chars=$('#tw-lineup').value.split(/[,，]/).map(c=>c.trim()).filter(Boolean);if(chars.length!==5)return notify('캐릭터 5명을 쉼표로 구분하세요.');remember(true);t.characters=chars;recalcAuto(0);save();redraw({meta:'tw-stars'});}
  function applyStars(){const text=$('#tw-stars').value;if(!/^[1-6]{5}$/.test(text))return notify('1~6 사이 성급 5개를 입력하세요. 예: 55565');remember(true);current().stars=[...text];save();redraw({meta:'tw-expected'});}
  function pasteColors(html,rows){
    if(!html)return;
    const doc=new DOMParser().parseFromString(html,'text/html');const cells=[...doc.querySelectorAll('tr')].map(tr=>[...tr.querySelectorAll('td')].at(-1)).filter(Boolean);
    if(!cells.length&&rows.length===1)cells.push(doc.body);
    for(let i=0;i<rows.length;i++){
      const cell=cells[i];if(!cell||cell.textContent.replace(/\u00a0/g,' ').trim()!==rows[i].text.trim())continue;
      const runs=[];const walk=(node,color=null)=>{if(node.nodeType===3){runs.push({text:node.textContent,color});return;}const c=node.style?.color||node.getAttribute?.('color')||color;for(const child of node.childNodes)walk(child,c);};walk(cell);
      if(runs.some(r=>r.color)&&runs.map(r=>r.text).join('')===rows[i].text)rows[i].runs=runs;
    }
  }
  function paste(event){
   const el=event.target.closest('[data-tw-text]');
   if(!el||readOnly())return;
   const text=event.clipboardData?.getData('text/plain');
   if(!text)return;
   event.preventDefault();
   const t=current();if(!t)return;
   let transfer=null;
   try{transfer=parseTacticTransfer(text);}
   catch(error){notify(error.message||'복사한 택틱 정보를 확인하세요.');return;}
   let lineup=null;
   let body=transfer?.text||text;
   const slotPaste=transfer?.mode==='slots'||(!transfer&&hasTacticSlots(body));
   if(slotPaste){
     // Slot names are replaced with the CURRENT tactic's characters.
     // Existing lineup, portraits, star ratings, and 6-column checks remain intact.
     if(!validTacticLineup(t.characters)){
       notify('캐릭터 1~5를 치환하려면 택틱 작업실에서 캐릭터 5명의 이름을 먼저 지정해 주세요.');
       return;
     }
     try{body=resolveTacticSlots(body,t.characters);}
     catch(error){notify(error.message);return;}
   }else if(transfer){
     // Explicit names can update the lineup after user confirmation.
     lineup=transfer.characters.map(name=>findCharacter(catalog,name)?.name||null);
     if(lineup.some(name=>!name)){
       notify('사이트 캐릭터 DB에서 확인되지 않는 이름: '+transfer.characters.filter((name,i)=>!lineup[i]).join(', ')+' · 변환기의 한국어 이름을 확인하세요.');
       return;
     }
     const changed=lineup.some((name,i)=>normalizeCharacterName(t.characters[i])!==normalizeCharacterName(name));
     const existing=t.characters.some(name=>String(name||'').trim());
     if(changed&&existing&&!confirm(
       '현재 택틱의 캐릭터 편성이 변환 결과와 다릅니다.\\n현재: '+t.characters.map(x=>x||'미선택').join(', ')+
       '\\n변환: '+lineup.join(', ')+
       '\\n\\n기존 편성을 변경하고 붙여넣을까요? (취소하면 아무것도 변경하지 않습니다.)'
     ))return;
   }
   const row=rowFor(el,false);
   const index=row?t.rows.indexOf(row):t.rows.length;
   const previous=t.rows[index-1]?.checked||[];
   const rows=pastedRows(body,previous,lineup||t.characters,catalog);
   if(!rows.length)return;
   remember(true);
   if(lineup){
     if(t.customPortraits)t.customPortraits=t.customPortraits.map((value,i)=>normalizeCharacterName(t.characters[i])===normalizeCharacterName(lineup[i])?value:'');
     t.characters=[...lineup];
   }
   if(row)t.rows.splice(index,1,...rows);
   else t.rows.push(...rows);
   if(!transfer)pasteColors(event.clipboardData.getData('text/html'),rows);
   save();
   if(transfer)redraw({row:rows.at(-1).id});
   else redrawRows(rows.at(-1).id);
   notify(slotPaste?`${rows.length}행을 기존 캐릭터 1~5번 이름으로 치환했습니다. 편성 및 SET 상태는 유지됩니다.`:transfer?`${rows.length}행과 캐릭터 5명·초상화·SET 상태를 가져왔습니다.`:`${rows.length}행을 붙여넣었습니다.`);
 }
  async function uploadPortrait(el){if(!canEdit())return;
    const file=el.files?.[0];if(!file||!/^image\/(png|jpeg|webp)$/.test(file.type))return notify('PNG·JPG·WebP 이미지를 선택하세요.');
    if(file.size>10_000_000)return notify('10MB 이하 이미지를 선택하세요.');
    const id=state.selected,index=Number(el.dataset.twPortrait),url=URL.createObjectURL(file);
    try{const image=new Image();image.src=url;await image.decode();if(id!==state.selected)return;const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;canvas.getContext('2d').drawImage(image,0,0,96,96);remember(true);current().customPortraits||=Array(5).fill('');current().customPortraits[index]=canvas.toDataURL('image/webp',.9);save();redraw();notify('이 택틱의 초상화를 저장했습니다.');}catch{notify('이미지를 읽을 수 없습니다.');}finally{URL.revokeObjectURL(url);}
  }
  function mutateMeta(el){if(!canEdit())return;const t=current();if(!t)return;remember();if(el.dataset.twMeta){const key=el.dataset.twMeta;t[key]=key==='boss'?(Number(el.value)||null):el.value.trim();}if(el.dataset.twChar!==undefined){const i=Number(el.dataset.twChar);t.characters[i]=el.value.trim();if(t.customPortraits)t.customPortraits[i]='';}if(el.dataset.twStar!==undefined)t.stars[Number(el.dataset.twStar)]=el.value;save();if(el.dataset.twMeta==='expectedDamage'&&$('#tw-library-list'))$('#tw-library-list').innerHTML=libraryCards();}
  function refreshPortrait(i){const t=current(),slot=$('#tw-char-'+i)?.closest('.tw-character-slot');if(!t||!slot)return;slot.querySelector('[data-tw-char]')?.classList.toggle('is-booster',isBoosterCharacter(getApp(),t.characters[i],catalog));const data=imageData(t,i),url=data.url;slot.querySelector('.tw-portrait').innerHTML=`<span class="tw-initial">${X(t.characters[i]?.slice(0,1)||'?')}</span>${url?`<img src="${X(url)}" alt="${X(t.characters[i])} 초상화" ${portraitAttributes(data)}>${portraitStarOverlay(data)}`:''}`;}
  function refreshLabels(){const t=current();if(!t)return;document.querySelectorAll('.tw-grid th').forEach((th,i)=>{if(i>=0&&i<5){th.innerHTML=checkPortrait(t,i);th.title=t.characters[i]||'';}});document.querySelectorAll('[data-tw-row]').forEach((tr,index)=>tr.querySelectorAll('[data-tw-check]').forEach((c,i)=>c.setAttribute('aria-label',(tr.dataset.twRow==='draft'?'새 행':(index+1)+'행')+' '+(i===5?'AUTO':t.characters[i]||'캐릭터 '+(i+1))+' SET')));const before=t.rows.map(r=>r.checked.join(','));recalcAuto(0);if(t.rows.some((r,i)=>r.checked.join(',')!==before[i]))save();}
  function editorTitle(t){
    const boss=t.boss?t.boss+'넴':'보스 미분류';
    const members=t.characters.map(name=>`<span class="tw-title-character">${X(name||'미선택')}</span>`).join('');
    const stars=t.stars.map(star=>star||'?').join('');
    const video=validURL(t.video),link=validURL(t.tacticUrl),links=[...new Set([video,link].filter(Boolean))];
    return `<span class="tw-title-lineup"><span class="tw-title-boss">${X(boss)}</span>${members}<span class="tw-title-stars">${X(stars)}</span></span><span class="tw-source-summary"><small>기대딜</small><strong>${X(formatExpectedDamage(t.expectedDamage))}</strong><span class="source-link-group">${links.length?links.map(sourceLinkBox).join(''):sourceLinkBox('')}</span></span>`;
  }
  function tacticLinks(t){return canEdit()?'<div class="tw-links"><button class="btn sm" type="button" data-tw="link-edit">영상·사이트 링크 수정</button></div>':'';}
  function communityLinks(){const links=month().communityLinks||[];return `<div class="community-links" aria-label="커뮤니티 자료 링크">${links.map(l=>`<span>${validURL(l.url)?`<a class="btn sm" href="${X(validURL(l.url))}" target="_blank" rel="noopener noreferrer">↗ ${X(l.label)}</a>`:`<span class="btn sm missing-link">${X(l.label)}</span>`}${canEdit()?`<button type="button" class="textbutton" data-tw="community-edit" data-id="${X(l.id)}" aria-label="${X(l.label)} 링크 수정">✎</button><button type="button" class="textbutton" data-tw="community-delete" data-id="${X(l.id)}" aria-label="${X(l.label)} 링크 삭제">×</button>`:''}</span>`).join('')}${canEdit()?'<button class="btn sm" type="button" data-tw="community-add">＋ 커뮤니티 링크</button>':''}</div>`;}
  function editLinks(){const t=current();if(!t)return;api.openForm?.('영상 · 택틱 링크',[{name:'video',label:'영상 URL',value:t.video||'',type:'url'},{name:'tacticUrl',label:'택틱 URL',value:t.tacticUrl||'',type:'url'}],values=>{for(const key of ['video','tacticUrl'])if(values[key]&&!validURL(values[key]))throw Error('http 또는 https 주소를 입력하세요.');remember(true);Object.assign(t,values);save();redraw();});}
  function editCommunity(id){const existing=(month().communityLinks||[]).find(l=>l.id===id);api.openForm?.('커뮤니티 자료 링크',[{name:'label',label:'링크 이름',value:existing?.label||'',required:true},{name:'url',label:'URL',value:existing?.url||'',type:'url',required:true}],values=>{if(!validURL(values.url))throw Error('http 또는 https 주소를 입력하세요.');month().communityLinks||=[];if(existing)Object.assign(existing,{label:values.label,url:validURL(values.url)});else month().communityLinks.push({id:makeId(),label:values.label,url:validURL(values.url)});persist();redraw();});}
  let charPicker=null;
  function closeCharacters(){document.querySelector('#tw-character-picker')?.remove();charPicker?.input?.setAttribute('aria-expanded','false');charPicker=null;}
  function showCharacters(input){if(!canEdit())return;const q=normalizeCharacterName(input.value);closeCharacters();if(!q)return;const matches=catalog.filter(p=>[p.name,...(p.aliases||[])].some(n=>normalizeCharacterName(n).includes(q))).sort((a,b)=>Number(normalizeCharacterName(b.name).startsWith(q))-Number(normalizeCharacterName(a.name).startsWith(q)));if(!matches.length)return;charPicker={input,matches,index:0};drawCharacters();}
  function drawCharacters(){if(!charPicker)return;const {input,matches,index}=charPicker;let box=document.querySelector('#tw-character-picker');if(!box){box=document.createElement('div');box.id='tw-character-picker';box.className='character-picker';box.setAttribute('role','listbox');document.body.append(box);}const r=input.getBoundingClientRect();box.style.left=Math.min(r.left,window.innerWidth-260)+'px';box.style.top=(r.bottom+4)+'px';box.innerHTML=matches.slice(0,30).map((p,i)=>`<button type="button" role="option" aria-selected="${i===index}" data-character-choice="${i}">${p.portrait?`<img src="${X(p.portrait)}" ${portraitAttributes(characterPortrait(catalog,p.name))} alt="">`:''}<strong>${X(p.name)}</strong><small>${X((p.aliases||[]).join(' · '))}</small></button>`).join('');input.setAttribute('aria-expanded','true');}
  function chooseCharacter(index=charPicker?.index){if(!charPicker)return;const {input,matches}=charPicker,p=matches[index];if(!p)return;const i=Number(input.dataset.twChar);input.value=p.name;mutateMeta(input);closeCharacters();refreshPortrait(i);refreshLabels();document.querySelector('#tw-char-'+(i+1))?.focus();}
  document.addEventListener('pointerdown',event=>{if(event.target.closest('[data-character-choice]'))event.preventDefault();});
  document.addEventListener('click',event=>{const choice=event.target.closest('[data-character-choice]');if(choice)chooseCharacter(Number(choice.dataset.characterChoice));else if(charPicker&&event.target!==charPicker.input)closeCharacters();});
  document.addEventListener('compositionend',event=>{if(event.target.dataset.twChar!==undefined)showCharacters(event.target);});
  function mount(page){closeCharacters();if(!['tactics','calculator'].includes(page))return;const restore=state.restore;state.restore=null;if(restore?.meta)$('#'+restore.meta)?.focus();else if(restore?.row)focusRow(restore.row);}
  function beforeNavigate(){const el=document.activeElement;if(el?.matches('[data-tw-text]')&&!viewing())editText(el);return true;}
  document.addEventListener('input',event=>{
    const el=event.target;if(el.matches('[data-tw-text]')){if(!event.isComposing)editText(el);return;}
    if(el.dataset.twMeta||el.dataset.twChar!==undefined){if(!canEdit())return;mutateMeta(el);if(el.dataset.twChar!==undefined&&!event.isComposing)showCharacters(el);}
  });
  document.addEventListener('compositionend',event=>{if(event.target.matches('[data-tw-text]'))editText(event.target);});
  document.addEventListener('focusout',event=>{
    const el=event.target,t=current();if(el.matches('[data-tw-text]')&&t&&!viewing()){editText(el);const r=rowFor(el,false);if(r)el.innerHTML=richLine(r,t.characters,catalog);}
    if(el.dataset.twChar!==undefined){refreshPortrait(Number(el.dataset.twChar));refreshLabels();}
  });
  document.addEventListener('change',event=>{
    const el=event.target;
    if(el.dataset.twCheck!==undefined){if(readOnly())return;remember(true);const r=rowFor(el);r.checked[Number(el.dataset.twCheck)]=el.checked;r.manualChecks=true;recalcAuto(current().rows.indexOf(r)+1);save();}
    if(el.dataset.twStar!==undefined){mutateMeta(el);refreshPortrait(Number(el.dataset.twStar));}
    if(el.dataset.twMeta&&el.tagName==='SELECT'){mutateMeta(el);if(el.dataset.twMeta==='group'){state.group=current().group;state.boss='all';}if(el.dataset.twMeta==='boss')state.boss='all';redraw({meta:el.id});}
    if(el.dataset.twPortrait!==undefined)uploadPortrait(el);
  });
  document.addEventListener('paste',paste);
  document.addEventListener('toggle',event=>{if(event.target.matches('.tw-more'))state.more=event.target.open;},true);
  document.addEventListener('click',event=>{
    const b=event.target.closest('[data-tw]');if(!b)return;event.preventDefault();const t=current();if(['new','undo','delete','restore','duplicate','row-delete','restate','purge','link-edit','community-add','community-edit','community-delete'].includes(b.dataset.tw)&&!canEdit()){api.unlock?.();return;}
    switch(b.dataset.tw){
      case 'toggle-estimate':state.estimate=!state.estimate;redraw();break;
      case 'link-edit':editLinks();break;
      case 'community-add':editCommunity();break;
      case 'community-edit':editCommunity(b.dataset.id);break;
      case 'community-delete':if(confirm('이 링크를 삭제할까요?')){month().communityLinks=month().communityLinks.filter(l=>l.id!==b.dataset.id);persist();redraw();}break;
      case 'purge':{const id=b.dataset.twId,v=all().find(x=>x.id===id&&x.trashedAt);if(v&&confirm('이 택틱을 완전히 삭제할까요? 삭제함에서 복원할 수 없습니다.')){month().tactics=all().filter(x=>x.id!==id);month().purgedTactics=[...new Set([...(month().purgedTactics||[]),id])];state.undo=[];persist();redraw();notify('택틱을 완전히 삭제했습니다.');}break;}
      case 'select':choose(b.dataset.twId);break;
      case 'group':state.personalId=null;state.group=b.dataset.value;state.remaining=null;state.trash=false;redraw();break;
      case 'boss-filter':state.personalId=null;state.boss=b.dataset.value;state.remaining=null;state.trash=false;redraw();break;
      case 'new':create();break;
      case 'undo':undo();break;
      case 'trash':state.trash=true;redraw();break;
      case 'close-trash':state.trash=false;redraw();break;
      case 'delete':if(t){remember(true);t.trashedAt=new Date().toISOString();persist();state.selected=null;redraw();notify('삭제함으로 옮겼습니다. 삭제함에서 복원할 수 있습니다.');}break;
      case 'restore':{const restored=all().find(t=>t.id===b.dataset.twId);if(restored){remember(true);delete restored.trashedAt;state.group=groupOf(restored);state.boss='all';state.selected=restored.id;state.trash=false;persist();redraw();notify('택틱을 복원했습니다.');}break;}
      case 'duplicate':if(t){remember(true);const clone=structuredClone(t);clone.id=makeId();clone.rows.forEach(r=>r.id=makeId());clone.note=(clone.note?clone.note+' · ':'')+'복제본';all().unshift(clone);state.selected=clone.id;persist();redraw();}break;
      case 'carry':applyCarry();break;
      case 'original':setPersonal(base());redraw();break;
      case 'row-delete':deleteRow(b.dataset.row);break;
      case 'restate':if(t){remember(true);let previous=[];for(const row of t.rows){row.checked=commandState(row.text,previous,t.characters,catalog);row.manualChecks=false;previous=row.checked;}save();redrawRows();notify('문장으로 SET을 계산했습니다. 조건·한번만 지시는 원문과 함께 확인하세요.');}break;
      case 'copy':if(t)copyText(t.rows.map(r=>viewing()?shiftTimeline(r.text,state.remaining,base()):r.text).join('\n'));break;
      case 'copy-set':if(t)copyText(t.rows.map(r=>r.checked.map(c=>c?'TRUE':'FALSE').join('\t')+'\t'+(viewing()?shiftTimeline(r.text,state.remaining,base()):r.text)).join('\n'));break;
    }
  });
  document.addEventListener('keydown',event=>{
    if(event.isComposing||event.keyCode===229)return;const el=event.target,t=current();
    if(el.dataset.twChar!==undefined&&charPicker&&['Enter','ArrowDown','ArrowUp','Escape'].includes(event.key)){event.preventDefault();if(event.key==='Escape'){closeCharacters();return;}if(event.key==='Enter'){chooseCharacter();return;}charPicker.index=Math.max(0,Math.min(charPicker.matches.length-1,charPicker.index+(event.key==='ArrowDown'?1:-1)));drawCharacters();return;}
    if(!$('#tw-title')&&!el.closest('.tw-navigation'))return;
    const typing=el.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(el.tagName);
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!event.shiftKey){event.preventDefault();undo();return;}
    if(el.id==='tw-carry'&&event.key==='Enter'){event.preventDefault();applyCarry();return;}
    if(el.id==='tw-lineup'&&event.key==='Enter'){event.preventDefault();applyLineup();return;}
    if(el.id==='tw-stars'&&event.key==='Enter'){event.preventDefault();applyStars();return;}
    if(el.getAttribute('role')==='tab'&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const tabs=[...el.parentNode.querySelectorAll('[role="tab"]')],index=tabs.indexOf(el),next=tabs[(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];const type=next.dataset.tw;state[type==='group'?'group':'boss']=next.dataset.value;state.remaining=null;redraw();$(`[data-tw="${type}"][data-value="${CSS.escape(next.dataset.value)}"]`)?.focus();return;}
    if(!el.matches('[data-tw-text]')||!t||readOnly())return;
    if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();editText(el);insertAfter(el);return;}
    if(event.shiftKey&&(event.key==='Delete'||((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'))){event.preventDefault();const r=rowFor(el,false);if(r)deleteRow(r.id);return;}
    if(['ArrowUp','ArrowDown'].includes(event.key)&&(event.ctrlKey||event.altKey)){
      event.preventDefault();editText(el);const row=rowFor(el),index=t.rows.indexOf(row),next=index+(event.key==='ArrowDown'?1:-1);
      if(event.altKey&&next>=0&&next<t.rows.length){remember(true);[t.rows[index],t.rows[next]]=[t.rows[next],t.rows[index]];recalcAuto(Math.min(index,next));save();redrawRows(row.id);}
      else if(event.ctrlKey)focusRow(t.rows[next]?.id||'draft');
    }
  });
  function estimator(){return `<section class="panel section-spacer tw-estimator"><h2>선통 · 후통 예상 이월 계산</h2><p class="small muted">HP·피해량은 1 단위 정수 또는 만·억 표기로 입력하세요. 전투시간·이월 보정은 선택 월의 설정을 따릅니다.</p><div class="tw-estimate-fields">${[['tw-hp','보스 남은 HP',String(api.bossStatus?.().find(b=>b.id===current()?.boss)?.hp||1)],['tw-first','선통 예상 피해량','0'],['tw-second','후통 예상 피해량','300000000'],['tw-seconds','후통 전투시간 (초)',String(base())]].map(([id,label,value])=>`<div class="field"><label for="${id}">${label}</label><input id="${id}" inputmode="decimal" value="${value}"></div>`).join('')}</div><div class="form-actions"><button type="button" class="btn primary" data-tw="estimate">계산 후 위 택틱에 적용</button><span class="mathvalue" id="tw-estimate-result"></span></div></section>`;}
  document.addEventListener('click',event=>{const b=event.target.closest('[data-tw]');if(!b)return;if(b.dataset.tw==='open-tactic'){navigate('tactics');$('#tw-carry')?.focus();}if(b.dataset.tw==='estimate'){const num=id=>id==='tw-seconds'?Number($('#'+id).value):parseDamage($('#'+id).value),result=api.estimateCarry({hp:num('tw-hp'),first:num('tw-first'),second:num('tw-second'),seconds:num('tw-seconds'),base:base(),bonus:Number(month().options.carryBonusSeconds??20),cap:Number(month().options.carryMaxSeconds||90)});$('#tw-estimate-result').textContent=result.error||result.seconds+'초';if(!result.error){setPersonal(result.seconds);redraw();notify(`계산한 ${result.seconds}초를 택틱에 적용했습니다.`);}}});
  return {view,calculator:view,mount,beforeNavigate,openBoss:id=>{prepare();state.boss=String(id);state.remaining=null;state.trash=false;state.selected=visible()[0]?.id||null;},hasDraft:()=>{const el=document.activeElement;return !!(el?.matches('[data-tw-text]')&&rowFor(el,false)?.text!==readText(el)&&readText(el));}};
}
