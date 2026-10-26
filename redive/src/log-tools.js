function logPositionContext(id=null,anchorId=null,side='before'){
  const ordered=[...data.logs].sort((a,b)=>a.seq-b.seq);
  let index=ordered.length;
  if(id)index=ordered.findIndex(row=>row.id===id);
  else if(anchorId){index=ordered.findIndex(row=>row.id===anchorId);if(side==='after')index++;}
  if(index<0)throw Error('기준 기록을 찾지 못했습니다.');
  const month=structuredClone(engineMonth());month.events=structuredClone(ordered.slice(0,index));
  engineReplay(month);
  return {bosses:engineProgress(month),logs:month.events,index};
}
function entryLogContext(fd){
  const id=String(fd.get('logId')||''),anchor=String(fd.get('insertAnchor')||'');
  if(id||anchor)return logPositionContext(id,anchor,String(fd.get('insertSide')||'before'));
  return {bosses:data.bosses,logs:data.logs};
}
attackEntryState=fd=>{
  const old=data.logs.find(row=>row.id===String(fd.get('logId')||'')),context=entryLogContext(fd),boss=context.bosses.find(b=>b.id===Number(fd.get('boss')))||context.bosses[0];
  const stage=boss.stage,automatic=[2,3].includes(stage)&&fd.has('autoDamage');
  return {boss,old,stage,automatic,damage:automatic?Number(data.bossSettings.find(b=>b.id===boss.id).hp[stage]):numberValue(fd.get('damage'))*Number(fd.get('unit')||100000000)};
};
const originalEntryItems=entryItems;
entryItems=(kind,picker)=>{
  const inline=picker?.closest?.('tr[data-inline-log]');
  if(kind==='member'){if(inline)return data.members.filter(m=>memberSeasonActive(m,Number(inline.dataset.day))||m.id===picker.dataset.selected).map(m=>({value:m.id,label:m.name,member:m}));return originalEntryItems(kind,picker);}
  const form=picker?.closest?.('form[data-form="v2-log"]');
  let bosses=data.bosses;
  if(form)bosses=entryLogContext(new FormData(form)).bosses;
  else if(inline){const draft=ext.inlineLogDraft;bosses=inline.dataset.inlineLog==='draft'&&draft?logPositionContext(null,draft.anchor,draft.insertSide).bosses:logPositionContext(inline.dataset.inlineLog).bosses;}
  return bosses.map(b=>({value:String(b.id),label:b.id+' · '+b.name,disabled:b.locked&&picker?.dataset.allowLocked!=='1'}));
};
const originalLogEntry=openCompleteLog;
openCompleteLog=(id=null,bossId=null)=>{
  const insertion=ext.logInsertion,anchor=insertion?data.logs.find(row=>row.id===insertion.id):null;
  const context=id||anchor?logPositionContext(id,anchor?.id,insertion?.side):null;
  const previousBosses=data.bosses,previousDay=ui.day;
  if(context)data.bosses=context.bosses;
  if(anchor)ui.day=anchor.day;
  const selectedBoss=!id&&context?.bosses.find(b=>b.id===Number(bossId))?.locked?context.bosses.find(b=>!b.locked)?.id:bossId;
  try{originalLogEntry(id,selectedBoss);}finally{data.bosses=previousBosses;ui.day=previousDay;}
  const form=drawer.querySelector('form[data-form="v2-log"]');if(!form)return;
  if(anchor){
    form.insertAdjacentHTML('afterbegin',`<input type="hidden" name="insertAnchor" value="${X(anchor.id)}"><input type="hidden" name="insertSide" value="${insertion.side}"><p class="insert-log-note">${anchor.seq}번 기록 ${insertion.side==='before'?'앞':'뒤'}에 추가</p>`);
    const day=form.querySelector('[name=day]');if(day){day.value=String(anchor.day);if(day.tagName==='SELECT'){day.disabled=true;form.insertAdjacentHTML('afterbegin',`<input type="hidden" name="day" value="${anchor.day}">`);}}
  }
  completeLogPreview();
};
function chronologicalLogSide(side){return ext.logOrder==='asc'?side:side==='before'?'after':'before';}
function openInsertedLog(id,side){
  if(!ensureEdit())return;const anchor=data.logs.find(row=>row.id===id);if(!anchor)return;
  if(data.dayClosures.some(boundary=>boundary.day===anchor.day)){toast('마감을 취소한 뒤 추가하세요.');return;}
  const insertSide=chronologicalLogSide(side),context=logPositionContext(null,id,insertSide),boss=context.bosses.find(b=>b.id===anchor.boss&&!b.locked)||context.bosses.find(b=>!b.locked);
  ext.inlineLogDraft={anchor:id,side,insertSide,month:ui.month,day:anchor.day,memberId:anchor.memberId,boss:boss?.id||anchor.boss,damage:'',bonus:'0',carry:false};
  render();document.querySelector('[data-inline-log="draft"] [data-entry-search="member"]')?.focus();
}
completeLogPreview=()=>{
  const form=drawer.querySelector('form[data-form="v2-log"]');if(!form)return;
  syncAttackEntry(form);if(!form.querySelector('[name=boss]')?.value){document.getElementById('log-preview').textContent='';return;}
  const fd=new FormData(form),state=attackEntryState(fd),before=state.boss.hp,damage=state.damage||0,actual=Math.min(damage,before);
  document.getElementById('log-boss-preview').innerHTML=`<span>${state.stage}단계 ${state.boss.lap}회차</span><strong class="numeric">HP ${nf(before)}</strong>`;
  const estimate=damage>before?engineEstimate({hp:before,second:damage,seconds:90}):null;
  document.getElementById('log-preview').innerHTML=`<dl class="preview-values"><div><dt>실제 피해량</dt><dd>${nf(actual)}</dd></div><div><dt>공격 후 HP</dt><dd>${nf(Math.max(0,before-damage))}</dd></div>${estimate?.seconds?`<div><dt>예상 이월</dt><dd>${estimate.seconds}초</dd></div>`:''}</dl>`;
};
saveCompleteLog=form=>{
  if(!ensureEdit())return false;
  const fd=typeof form?.get==='function'&&typeof form?.has==='function'?form:new FormData(form),id=String(fd.get('logId')||''),old=data.logs.find(row=>row.id===id),entry=attackEntryState(fd);
  const memberId=String(fd.get('memberId')||''),boss=Number(fd.get('boss')),day=Number(fd.get('day')),carry=fd.has('usesCarry'),bonus=numberValue(fd.get('bonus')||0),damage=entry.damage;
  if(!Number.isSafeInteger(damage)||damage<=0){toast('피해량은 1 단위의 양의 정수로 입력하세요.');return false;}
  if(!Number.isSafeInteger(bonus)){toast('가산점은 양수 또는 음수의 정수로 입력하세요.');return false;}
  if(!data.members.some(member=>member.id===memberId)||!data.bossSettings.some(b=>b.id===boss)){toast('클랜원과 보스를 선택하세요.');return false;}
  if(!Number.isInteger(day)||day<1||day>data.rules.days||!memberSeasonActive(currentMember(memberId),day)){toast('참가 일차를 확인하세요.');return false;}
  if(data.dayClosures.some(boundary=>boundary.day===day)){toast('마감을 취소한 뒤 수정하세요.');return false;}
  if(!old&&entry.boss.locked){toast(entry.boss.lockedReason);return false;}
  const daily=data.logs.filter(row=>row.day===day&&row.memberId===memberId&&row.id!==id);
  if(!old&&!carry&&daily.filter(row=>!row.carry).length>=data.rules.daily){toast('기본 타수를 모두 사용했습니다.');return false;}
  const prefix=entryLogContext(fd).logs.filter(row=>row.day===day&&row.memberId===memberId&&row.id!==id);
  if(!old&&carry&&!prefix.some(row=>row.kill&&!row.carry&&!prefix.some(other=>other.carryFrom===row.id))){toast('사용할 이월이 없습니다.');return false;}
  const remaining=String(fd.get('remaining')||''),seconds=remaining?timeToSec(remaining):NaN;
  if(remaining&&!(seconds>=0&&seconds<=90)){toast('남은 시간을 확인하세요.');return false;}
  const value={memberId,boss,day,damage,damageMode:entry.automatic?'max':'manual',carry,usesCarry:carry,note:String(fd.get('note')||''),bonus:bonus/10000,gameAt:String(fd.get('gameAt')||''),carrySeconds:Number.isFinite(seconds)?Math.min(90,seconds+20):old?.carrySeconds||0};
  const record={...(old||{}),id:old?.id||uid(),...value};
  let next;
  try{next=old?data.logs.map(row=>row.id===id?record:row):logOrder.insertRecord(data.logs,record,String(fd.get('insertAnchor')||'')||null,String(fd.get('insertSide')||'after'));}catch(error){toast(error.message);return false;}
  checkpoint();if(old){Object.assign(old,value);next=data.logs;}data.logs=next;data.dayClosures=logOrder.refreshClosures(data.dayClosures,next);recalculateSeason();
  const saved=data.logs.find(row=>row.id===record.id);
  if(!old){ext.entryMember=memberId;ext.entryBoss=boss;ext.entryCarry=saved.kill&&!saved.carry&&!data.logs.some(row=>row.carryFrom===saved.id);ext.entryFeedback=currentMember(memberId).name+' · '+boss+'넴 '+nf(saved.damage)+' 등록';}
  persist();if(drawer.open)closeDrawer();ext.logInsertion=null;if(!old)ext.inlineLogDraft=null;render();
  if(!old){const input=document.getElementById('quick-damage');if(input&&!input.readOnly)input.focus();}
  toast(old?'기록 수정':'기록 등록',true);return true;
};
function moveLogRecord(id,anchorId,side){
  if(!ensureEdit())return false;
  const source=data.logs.find(row=>row.id===id);if(!source)return false;
  if(data.dayClosures.some(boundary=>boundary.day===source.day)){toast('마감을 취소한 뒤 이동하세요.');return false;}
  let next;try{next=logOrder.moveRecord(data.logs,id,anchorId,side);}catch(error){toast(error.message);return false;}
  checkpoint();data.logs=next;data.dayClosures=logOrder.refreshClosures(data.dayClosures,next);recalculateSeason();persist();render();toast('기록 순서 변경',true);return true;
}
function inlineLogFields(values){return {get:key=>values[key]??null,has:key=>Object.hasOwn(values,key)};}
function updateInlineLog(id,field,value){
  if(!ensureEdit())return false;
  if(!['memberId','boss','damage','bonus','carry'].includes(field))return false;
  const current=data.logs.find(row=>row.id===id);if(!current){toast('공격 기록을 찾지 못했습니다.');return false;}
  const canonical=field==='carry'?(value===true||value==='carry'):['damage','bonus','boss'].includes(field)?numberValue(value):String(value);
  const prior=field==='bonus'?Math.round((current.bonus||0)*10000):field==='carry'?!!current.carry:current[field];
  if(canonical===prior)return true;
  const values={logId:id,memberId:current.memberId,boss:current.boss,damage:current.damage,bonus:Math.round((current.bonus||0)*10000),day:current.day,unit:1,note:current.note||'',gameAt:current.gameAt||''};
  if(current.carry)values.usesCarry='on';
  if(current.damageMode==='max'&&field!=='damage')values.autoDamage='on';
  if(field==='carry'){if(canonical)values.usesCarry='on';else delete values.usesCarry;}
  else values[field]=value;
  return saveCompleteLog(inlineLogFields(values));
}
function commitInlineLogDraft(){
  const draft=ext.inlineLogDraft;if(!draft||draft.month!==ui.month)return false;
  return saveCompleteLog(inlineLogFields({memberId:draft.memberId,boss:draft.boss,damage:draft.damage,bonus:draft.bonus,day:draft.day,unit:1,note:'',gameAt:'',insertAnchor:draft.anchor,insertSide:draft.insertSide,...(draft.carry?{usesCarry:'on'}:{})}));
}
function inlineLogId(e,field,mobile){return `inline-log-${mobile?'m':'w'}-${e.inlineDraft?'draft':e.id}-${field}`;}
function inlineLogPicker(e,field,mobile){
  const kind=field==='memberId'?'member':'boss';
  return `<div class="inline-log-${kind}">${entrySearch(kind,inlineLogId(e,field,mobile),field,e[field],true).replace('type="search"',`type="search" data-inline-log-field="${field}" aria-label="${e.inlineDraft?'새':e.seq+'번'} 기록 ${kind==='member'?'클랜원':'보스'}"`)}</div>`;
}
function inlineLogNumber(e,field,mobile){
  const value=field==='bonus'?(e.inlineDraft?e.bonus:Math.round((e.bonus||0)*10000)):e.damage;
  return `<input class="inline-log-number ${field==='bonus'?'inline-log-bonus':''}" id="${inlineLogId(e,field,mobile)}" data-inline-log-field="${field}" type="text" inputmode="${field==='bonus'?'decimal':'numeric'}" value="${X(typeof value==='number'?nf(value):value)}" aria-label="${e.inlineDraft?'새':e.seq+'번'} 기록 ${field==='bonus'?'가산점':'피해량'}" autocomplete="off">`;
}
function inlineLogType(e,mobile){return `<select class="inline-log-type" id="${inlineLogId(e,'carry',mobile)}" data-inline-log-field="carry" aria-label="${e.inlineDraft?'새':e.seq+'번'} 기록 이월 사용"><option value="normal" ${!e.carry?'selected':''}>${!e.carry&&e.role==='초월'?'초월':!e.carry&&e.kill?'격파':'일반'}</option><option value="carry" ${e.carry?'selected':''}>${e.carry&&e.kill?'관통':'이월타'}</option></select>`;}
function visibleLogMoveTarget(id,direction){
  const rows=getFilteredCompleteLogs(),index=rows.findIndex(row=>row.id===id),source=rows[index],target=rows[index+(direction==='up'?-1:1)];
  return source&&target&&source.day===target.day?target:null;
}
function moveVisibleLog(id,direction){
  const source=data.logs.find(row=>row.id===id),target=visibleLogMoveTarget(id,direction);
  if(!source||!target)return false;
  return moveLogRecord(id,target.id,target.seq<source.seq?'before':'after');
}
function logManagement(e){
  if(e.inlineDraft)return `<div class="log-manage-actions">${simpleButton('등록','inline-log-add','','primary')}${simpleButton('취소','inline-log-cancel')}</div>`;
  const closed=data.dayClosures.some(boundary=>boundary.day===e.day),disabled=closed?'disabled':'';
  return `<div class="log-manage-actions"><button type="button" class="log-drag-handle" draggable="${!closed}" data-drag-log="${e.id}" title="이 손잡이를 끌어 순서 이동" aria-label="${e.seq}번 기록 끌어서 이동" ${disabled}>⠿</button><button type="button" class="button quiet" data-action="u-move-log" data-id="${e.id}" data-direction="up" aria-label="${e.seq}번 기록 위로 이동" ${closed||!visibleLogMoveTarget(e.id,'up')?'disabled':''}>↑</button><button type="button" class="button quiet" data-action="u-move-log" data-id="${e.id}" data-direction="down" aria-label="${e.seq}번 기록 아래로 이동" ${closed||!visibleLogMoveTarget(e.id,'down')?'disabled':''}>↓</button>${simpleButton('삭제','entry-delete-log',e.id,'danger quiet')}<button type="button" class="button quiet" data-action="u-insert-log" data-id="${e.id}" data-side="before" aria-label="${e.seq}번 기록 앞에 추가" ${disabled}>+위</button><button type="button" class="button quiet" data-action="u-insert-log" data-id="${e.id}" data-side="after" aria-label="${e.seq}번 기록 뒤에 추가" ${disabled}>+아래</button></div>`;
}
function logDetailCells(e,editing,mobile=false){
  const cls=mobile?'mobile-log-extra':'extra-cell',bonus=nf(Math.round((e.bonus||0)*10000));
  return `<td class="right numeric ${cls} actual-damage">${e.inlineDraft?'—':nf(e.actual)}</td><td class="right numeric ${cls}">${editing?inlineLogNumber(e,'bonus',mobile):bonus}</td>${[points(e.contribution),nf(Math.round(e.game)),nf(e.before),nf(e.after)].map(value=>`<td class="right numeric ${cls}">${e.inlineDraft?'—':value}</td>`).join('')}`;
}
function completeLogRow(e,{editing,details,mini,mobile}){
  const writable=editing&&!data.dayClosures.some(boundary=>boundary.day===e.day),context=e.inlineDraft?logPositionContext(null,e.anchor,e.insertSide).bosses.find(b=>b.id===Number(e.boss)):null;
  const label=e.role==='초월'?'초월':e.kill?(e.carry?'관통':'격파'):e.carry?'이월타':'일반';
  return `<tr ${e.inlineDraft?'class="log-inline-draft"':`data-log-id="${e.id}"`} data-day="${e.day}"${editing?` data-inline-log="${e.inlineDraft?'draft':e.id}"`:''}>${mini?'':`<td class="progress-cell">${e.inlineDraft?'<span>새 기록</span>':ext.sequence?`<small class="mobile-seq" title="기록 순번">#${e.seq}</small>`:''}<span>${e.day}일차</span><small>${context?.stage??e.stage}단계 ${context?.lap??e.lap}회차</small></td>`}<td>${writable?inlineLogPicker(e,'boss',mobile):`<span class="boss-tag" style="${bossStyle(e.boss)}">${e.boss}넴</span>`}</td><td class="${mobile?'mobile-log-member':''}">${writable?inlineLogPicker(e,'memberId',mobile):memberLink(currentMember(e.memberId))}</td><td class="right numeric ${mobile?'mobile-log-damage':''}">${writable?inlineLogNumber(e,'damage',mobile):`<strong>${nf(e.damage)}</strong>`}${mini?`<small>${e.day}일차 · ${e.stage}단계 ${e.lap}회차</small>`:''}</td><td>${writable?inlineLogType(e,mobile):`<span class="type-tag ${e.kill?'kill':e.carry?'carry':''}">${label}</span>`}</td>${details?logDetailCells(e,writable,mobile):''}${editing?`<td class="log-manage ${mobile?'mobile-log-actions':''}">${logManagement(e)}</td>`:''}</tr>`;
}
completeLogTable=(logs,mini=false)=>{
  const editing=!mini&&adminMode(),details=!mini&&ext.details;
  const headers=[...(!mini?['일차·회차']:[]),'보스','클랜원','기록 피해량','유형',...(details?['실제 피해량','가산점','기여도','인게임','이전 HP','남은 HP']:[]),...(editing?['관리']:[])];
  const rows=[...logs],draft=ext.inlineLogDraft;
  if(editing&&draft?.month===ui.month){const at=rows.findIndex(e=>e.id===draft.anchor);if(at>=0)rows.splice(at+(draft.side==='after'?1:0),0,{...draft,inlineDraft:true});}
  const wide=rowTable(headers,rows.map(e=>completeLogRow(e,{editing,details,mini,mobile:false})),`battle-table ${details?'expanded':''} ${mini?'small-log':''} ${editing?'inline-editable':''}`);
  const mobile=!mini?`<div class="battle-mobile-only">${rowTable(headers,rows.map(e=>completeLogRow(e,{editing,details,mini,mobile:true})),`battle-mobile-table ${details?'mobile-detail':''} ${editing?'can-edit inline-editable':''}`)}</div>`:'';
  return `<div class="battle-wide-table">${wide}</div>`+mobile;
};
for(const action of ['inline-log-add'])writerActions.add(action);
const chooseEntryBeforeInline=chooseEntry;
chooseEntry=(input,value)=>{
  const row=input.closest('tr[data-inline-log]'),id=row?.dataset.inlineLog,field=input.dataset.inlineLogField;
  if(!chooseEntryBeforeInline(input,value))return false;
  if(!id||!field)return true;
  if(id==='draft'){if(ext.inlineLogDraft)ext.inlineLogDraft[field]=value;}
  else if(!updateInlineLog(id,field,value))return false;
  const next=inlineLogId({id,inlineDraft:id==='draft'},field==='memberId'?'boss':'damage',input.id.startsWith('inline-log-m-'));
  setTimeout(()=>document.getElementById(next)?.focus(),0);return true;
};
const showEntryResultsBeforeInline=showEntryResults;
showEntryResults=(input,all=false)=>{
  showEntryResultsBeforeInline(input,all);if(!input.dataset.inlineLogField)return;
  const box=input.closest('.search-picker').querySelector('[role=listbox]'),rect=input.getBoundingClientRect();
  Object.assign(box.style,{position:'fixed',left:Math.max(8,Math.min(rect.left,window.innerWidth-248))+'px',top:Math.max(8,Math.min(rect.bottom+4,window.innerHeight-248))+'px',width:'240px',right:'auto',maxHeight:'240px'});
};
document.addEventListener('input',event=>{
  const input=event.target,row=input.closest?.('tr[data-inline-log]'),field=input.dataset.inlineLogField;
  if(row?.dataset.inlineLog==='draft'&&field&&!input.dataset.entrySearch&&ext.inlineLogDraft)ext.inlineLogDraft[field]=field==='carry'?input.value==='carry':input.value;
});
document.addEventListener('change',event=>{
  const input=event.target,row=input.closest?.('tr[data-inline-log]'),field=input.dataset.inlineLogField;if(!row||!field)return;
  if(input.dataset.entrySearch)return;
  if(row.dataset.inlineLog==='draft'){if(ext.inlineLogDraft)ext.inlineLogDraft[field]=field==='carry'?input.value==='carry':input.value;return;}
  if(field==='carry'){const id=input.id;if(!updateInlineLog(row.dataset.inlineLog,field,input.value))input.setAttribute('aria-invalid','true');else setTimeout(()=>document.getElementById(id)?.focus(),0);}
});
document.addEventListener('focusout',event=>{
  const input=event.target,row=input.closest?.('tr[data-inline-log]'),field=input.dataset.inlineLogField;
  if(!row||!field||!input.isConnected)return;
  const nextId=event.relatedTarget?.id;
  if(input.dataset.entrySearch){
    if(input.closest('.search-picker').contains(event.relatedTarget))return;
    if(!resolveEntry(input)){input.setCustomValidity('검색 결과에서 선택하세요.');input.reportValidity();return;}
  }else if(row.dataset.inlineLog!=='draft'&&field!=='carry'){
    if(!updateInlineLog(row.dataset.inlineLog,field,input.value)){input.setAttribute('aria-invalid','true');return;}
  }
  if(nextId?.startsWith('inline-log-'))setTimeout(()=>document.getElementById(nextId)?.focus(),0);
});
document.addEventListener('keydown',event=>{
  const input=event.target;if(!input.dataset.inlineLogField||input.dataset.entrySearch)return;
  if(event.key==='Enter'){event.preventDefault();input.blur();setTimeout(()=>document.getElementById(input.id)?.focus(),0);}
  if(event.key==='Escape'){const row=input.closest('tr[data-inline-log]');if(row?.dataset.inlineLog==='draft'){ext.inlineLogDraft=null;render();}else render();}
});
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action="inline-log-add"],[data-action="inline-log-cancel"]');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(button.dataset.action==='inline-log-add'){
    for(const input of button.closest('tr').querySelectorAll('[data-entry-search]'))if(!resolveEntry(input)){input.setCustomValidity('검색 결과에서 선택하세요.');input.reportValidity();input.focus();return;}
    commitInlineLogDraft();
  }else{ext.inlineLogDraft=null;render();}
},true);
const closeBeforeInsertionCleanup=closeDrawer;
closeDrawer=()=>{ext.logInsertion=null;closeBeforeInsertionCleanup();};
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action="u-move-log"]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();
  moveVisibleLog(button.dataset.id,button.dataset.direction);
},true);
function clearLogDropMarks(){for(const row of document.querySelectorAll?.('.log-drop-before,.log-drop-after,.log-dragging')||[])row.classList.remove('log-drop-before','log-drop-after','log-dragging');}
document.addEventListener('dragstart',event=>{
  const handle=event.target.closest('[data-drag-log]');if(!handle||!adminMode())return;
  ext.draggedLog=handle.dataset.dragLog;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',ext.draggedLog);handle.closest('tr')?.classList.add('log-dragging');
});
document.addEventListener('dragover',event=>{
  const row=event.target.closest('tr[data-log-id]');if(!row||!ext.draggedLog||!adminMode())return;
  event.preventDefault();event.dataTransfer.dropEffect='move';const rect=row.getBoundingClientRect(),side=event.clientY<rect.top+rect.height/2?'before':'after';
  for(const other of document.querySelectorAll('.log-drop-before,.log-drop-after'))other.classList.remove('log-drop-before','log-drop-after');row.classList.add('log-drop-'+side);ext.logDrop={id:row.dataset.logId,side};
});
document.addEventListener('drop',event=>{
  const row=event.target.closest('tr[data-log-id]');if(!row||!ext.draggedLog)return;
  event.preventDefault();const id=ext.draggedLog,side=chronologicalLogSide(ext.logDrop?.id===row.dataset.logId?ext.logDrop.side:'before');ext.draggedLog=null;ext.logDrop=null;clearLogDropMarks();if(id!==row.dataset.logId)moveLogRecord(id,row.dataset.logId,side);
});
document.addEventListener('dragend',()=>{ext.draggedLog=null;ext.logDrop=null;clearLogDropMarks();});

