// Search-first attack entry, keyboard shortcuts and explicit record deletion.
function entryItems(kind,picker){
 if(kind==='member')return data.members.filter(m=>memberSeasonActive(m)||m.id===picker?.dataset.selected).map(m=>({value:m.id,label:m.name,member:m}));
 return data.bosses.map(b=>({value:String(b.id),label:b.id+' · '+b.name,disabled:b.locked&&picker?.dataset.allowLocked!=='1'}));
}
function entryMatches(kind,query,picker){
 const term=String(query||'').trim().toLowerCase().replace(/\s/g,'');
 return entryItems(kind,picker).filter(item=>!term||(kind==='member'?matchName(item.member,term):[item.label,chosung(item.label)].some(text=>text.toLowerCase().replace(/\s/g,'').includes(term))));
}
function entrySearch(kind,id,name,value,allowLocked=false){
 const picker={dataset:{selected:String(value||''),allowLocked:allowLocked?'1':'0'}},selected=entryItems(kind,picker).find(item=>String(item.value)===String(value));
 return `<div class="search-picker" data-picker="${kind}" data-selected="${X(value||'')}" data-allow-locked="${allowLocked?'1':'0'}"><input type="hidden" name="${name}" value="${X(value||'')}"><input id="${id}" type="search" data-entry-search="${kind}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-results" autocomplete="off" spellcheck="false" required placeholder="${kind==='member'?'이름 · 초성 검색':'번호 · 보스명 검색'}" value="${X(selected?.label||'')}"><div id="${id}-results" class="search-picker-results" role="listbox" aria-label="${kind==='member'?'클랜원':'보스'} 검색 결과" hidden></div></div>`;
}
function showEntryResults(input,all=false){
 const picker=input.closest('.search-picker'),box=picker.querySelector('[role=listbox]'),items=entryMatches(input.dataset.entrySearch,all?'':input.value,picker);
 const first=items.find(item=>!item.disabled&&item.label===input.value)?.value??items.find(item=>!item.disabled)?.value;
 box.innerHTML=items.length?items.map((item,index)=>`<button type="button" tabindex="-1" role="option" id="${input.id}-option-${index}" class="entry-picker-option ${item.value===first?'active':''}" aria-selected="${item.value===first}" aria-disabled="${!!item.disabled}" data-action="entry-option" data-value="${X(item.value)}">${X(item.label)}${item.disabled?'<small>대기</small>':''}</button>`).join(''):'<p class="no-rows">검색 결과 없음</p>';
 box.hidden=false;input.setAttribute('aria-expanded','true');const active=box.querySelector('[aria-selected=true]');if(active)input.setAttribute('aria-activedescendant',active.id);else input.removeAttribute('aria-activedescendant');
}
function closeEntryResults(input){
 const picker=input.closest('.search-picker');picker.querySelector('[role=listbox]').hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');
}
function chooseEntry(input,value){
 const picker=input.closest('.search-picker'),item=entryItems(input.dataset.entrySearch,picker).find(item=>String(item.value)===String(value));if(!item||item.disabled)return false;
 picker.querySelector('input[type=hidden]').value=item.value;picker.dataset.selected=item.value;input.value=item.label;input.setCustomValidity('');closeEntryResults(input);
 const form=input.form;if(input.dataset.entrySearch==='boss'&&form){if(form.dataset.form==='v2-log')completeLogPreview();else syncAttackEntry(form);}
 return true;
}
function resolveEntry(input){
 const picker=input.closest('.search-picker'),field=picker.querySelector('input[type=hidden]'),items=entryMatches(input.dataset.entrySearch,input.value,picker).filter(item=>!item.disabled);
 if(field.value&&items.some(item=>String(item.value)===field.value&&item.label===input.value))return true;
 const exact=items.filter(item=>item.label===input.value||String(item.value)===input.value.trim());
 if(exact.length===1)return chooseEntry(input,exact[0].value);
 return items.length===1?chooseEntry(input,items[0].value):false;
}
function focusCarryFromDamage(event){
 if(event.key!=='Tab'||event.shiftKey||event.altKey||event.ctrlKey||event.metaKey||event.target.name!=='damage')return false;
 const form=event.target.form;if(!['v2-quick-log','v2-log'].includes(form?.dataset.form))return false;
 const carry=form.querySelector('[name=usesCarry]');if(!carry)return false;
 event.preventDefault();carry.focus();return true;
}
function askDeleteLog(id){
 if(!ensureEdit())return;const log=data.logs.find(row=>row.id===id);if(!log){toast('공격 기록을 찾지 못했습니다.');return;}
 openDrawer('공격 기록 삭제',`<p>${X(currentMember(log.memberId).name)} · ${log.day}일차 · ${log.boss}넴</p><p class="numeric delete-log-damage">${nf(log.damage)}</p>`,simpleButton('취소','close-drawer')+simpleButton('삭제','entry-confirm-delete',id,'danger'));
}
writerActions.add('entry-delete-log');writerActions.add('entry-confirm-delete');
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]'),action=button?.dataset.action;
 if(action==='entry-option'){
  event.preventDefault();event.stopImmediatePropagation();const input=button.closest('.search-picker').querySelector('[data-entry-search]');
  if(chooseEntry(input,button.dataset.value)){const next=input.form?.querySelector(input.dataset.entrySearch==='member'?'[data-entry-search=boss]':'[name=damage]');next?.focus();}return;
 }
 if(action==='entry-delete-log'||action==='delete-log'||action==='entry-confirm-delete'){
  event.preventDefault();event.stopImmediatePropagation();if(action==='entry-confirm-delete')deleteCompleteLog(button.dataset.id);else askDeleteLog(button.dataset.id);return;
 }
 for(const input of document.querySelectorAll?.('[data-entry-search][aria-expanded=true]')||[])if(!input.closest('.search-picker').contains(event.target))closeEntryResults(input);
},true);
document.addEventListener('focusin',event=>{
 const input=event.target;if(!input.dataset.entrySearch)return;input.select();showEntryResults(input,true);
});
document.addEventListener('focusout',event=>{
 const input=event.target;if(input.dataset.entrySearch&&!input.closest('.search-picker').contains(event.relatedTarget))closeEntryResults(input);
});
document.addEventListener('input',event=>{
 const input=event.target;if(!input.dataset.entrySearch)return;input.closest('.search-picker').querySelector('input[type=hidden]').value='';input.setCustomValidity('');showEntryResults(input);
});
document.addEventListener('keydown',event=>{
 if(focusCarryFromDamage(event))return;
 const input=event.target;if(!input.dataset.entrySearch)return;const picker=input.closest('.search-picker'),box=picker.querySelector('[role=listbox]');
 if(event.key==='Escape'){closeEntryResults(input);return;}
 if(event.key==='Tab'){resolveEntry(input);closeEntryResults(input);return;}
 if(!['ArrowDown','ArrowUp','Enter'].includes(event.key))return;
 event.preventDefault();event.stopImmediatePropagation();if(box.hidden)showEntryResults(input);
 const options=[...box.querySelectorAll('[role=option]:not([aria-disabled=true])')];if(!options.length)return;
 const current=options.findIndex(option=>option.getAttribute('aria-selected')==='true');
 if(event.key==='Enter'){
  const selected=options[Math.max(0,current)];if(chooseEntry(input,selected.dataset.value))input.form?.querySelector(input.dataset.entrySearch==='member'?'[data-entry-search=boss]':'[name=damage]')?.focus();return;
 }
 const next=Math.max(0,Math.min(options.length-1,current+(event.key==='ArrowDown'?1:-1)));
 options.forEach((option,index)=>{option.classList.toggle('active',index===next);option.setAttribute('aria-selected',String(index===next));});input.setAttribute('aria-activedescendant',options[next].id);options[next].scrollIntoView({block:'nearest'});
},true);
document.addEventListener('submit',event=>{
 const form=event.target;if(!['v2-quick-log','v2-log'].includes(form.dataset.form))return;
 for(const input of form.querySelectorAll('[data-entry-search]'))if(!resolveEntry(input)){
  event.preventDefault();event.stopImmediatePropagation();input.setCustomValidity('검색 결과에서 '+(input.dataset.entrySearch==='member'?'클랜원':'보스')+'를 선택하세요.');input.reportValidity();input.focus();return;
 }
},true);
