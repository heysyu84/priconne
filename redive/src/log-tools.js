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
  if(kind==='member')return originalEntryItems(kind,picker);
  const form=picker?.closest?.('form[data-form="v2-log"]');
  let bosses=data.bosses;
  if(form)bosses=entryLogContext(new FormData(form)).bosses;
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
function openInsertedLog(id,side){
  if(!ensureEdit())return;const anchor=data.logs.find(row=>row.id===id);if(!anchor)return;
  if(data.dayClosures.some(boundary=>boundary.day===anchor.day)){toast('마감을 취소한 뒤 추가하세요.');return;}
  ext.logInsertion={id,side:side==='after'?'after':'before'};
  openLog(null,anchor.boss);
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
  const fd=new FormData(form),id=String(fd.get('logId')||''),old=data.logs.find(row=>row.id===id),entry=attackEntryState(fd);
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
  persist();if(drawer.open)closeDrawer();ext.logInsertion=null;render();
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
completeLogTable=(logs,mini=false)=>{
  const editing=!mini&&adminMode(),details=!mini&&ext.details;
  const headers=[...(!mini?['일차·회차']:[]),'보스','클랜원','기록 피해량','유형',...(details?['실제 피해량','이전 HP','남은 HP','가산점','기여도','인게임']:[]),...(editing&&details?['관리']:[])];
  const rows=logs.map(e=>`<tr data-log-id="${e.id}" data-day="${e.day}">${!mini?`<td class="progress-cell">${editing?`<button type="button" class="log-drag-handle" draggable="true" data-drag-log="${e.id}" title="드래그로 순서 이동" aria-label="${e.seq}번 기록 순서 이동">⠿</button>`:''}${!mini&&ext.sequence?`<small class="mobile-seq" title="기록 순번">#${e.seq}</small>`:''}<span>${e.day}일차</span><small>${e.stage}단계 ${e.lap}회차</small></td>`:''}<td><span class="boss-tag" style="${bossStyle(e.boss)}">${e.boss}넴</span></td><td>${memberLink(currentMember(e.memberId))}</td><td class="right numeric">${editing?`<button class="damage-edit" data-action="edit-log" data-id="${e.id}">${nf(e.damage)}</button>`:`<span>${nf(e.damage)}</span>`}${mini?`<small>${e.day}일차 · ${e.stage}단계 ${e.lap}회차</small>`:''}</td><td><span class="type-tag ${e.kill?'kill':e.carry?'carry':''}">${e.role==='초월'?'초월':e.kill?(e.carry?'관통':'격파'):e.carry?'이월타':'일반'}</span></td>${details?`<td class="right numeric actual-damage">${nf(e.actual)}</td>`:''}${details?`<td class="right numeric extra-cell">${nf(e.before)}</td><td class="right numeric extra-cell">${nf(e.after)}</td><td class="right numeric extra-cell">${editing?`<button class="damage-edit" data-action="edit-log" data-id="${e.id}">${nf(Math.round((e.bonus||0)*10000))}</button>`:nf(Math.round((e.bonus||0)*10000))}</td><td class="right numeric extra-cell">${points(e.contribution)}</td><td class="right numeric extra-cell">${nf(Math.round(e.game))}</td>`:''}${editing&&details?`<td class="log-manage">${simpleButton('수정','edit-log',e.id,'quiet')}${simpleButton('삭제','entry-delete-log',e.id,'danger quiet')}<button class="button quiet log-insert" data-action="u-insert-log" data-id="${e.id}" data-side="before" title="이 기록 앞에 추가" aria-label="${e.seq}번 기록 앞에 추가">+위</button><button class="button quiet log-insert" data-action="u-insert-log" data-id="${e.id}" data-side="after" title="이 기록 뒤에 추가" aria-label="${e.seq}번 기록 뒤에 추가">+아래</button>${details?`<button class="button quiet" data-action="u-move-log" data-id="${e.id}" data-direction="up" aria-label="기록 위로 이동">↑</button><button class="button quiet" data-action="u-move-log" data-id="${e.id}" data-direction="down" aria-label="기록 아래로 이동">↓</button>`:''}</td>`:''}</tr>`);
  // One mobile table for both modes. Only the extra detail columns change.
  // "순번" is displayed inside the progress cell to avoid wasting a full column.
  const mobileRows=logs.map(e=>`<tr data-log-id="${e.id}" data-day="${e.day}">
    <td class="progress-cell">${!mini&&ext.sequence?`<small class="mobile-seq" title="기록 순번">#${e.seq}</small>`:''}<span>${e.day}일차</span><small>${e.stage}단계 ${e.lap}회차</small></td>
    <td><span class="boss-tag" style="${bossStyle(e.boss)}">${e.boss}넴</span></td>
    <td class="mobile-log-member">${memberLink(currentMember(e.memberId))}</td>
    <td class="mobile-log-damage numeric"><strong>${nf(e.damage)}</strong></td>
    <td><span class="type-tag ${e.kill?'kill':e.carry?'carry':''}">${e.role==='초월'?'초월':e.kill?(e.carry?'관통':'격파'):e.carry?'이월타':'일반'}</span></td>
    ${details?`<td class="right numeric mobile-log-extra">${nf(e.actual)}</td><td class="right numeric mobile-log-extra">${nf(e.before)}</td><td class="right numeric mobile-log-extra">${nf(e.after)}</td><td class="right numeric mobile-log-extra">${editing?`<button class="damage-edit" data-action="edit-log" data-id="${e.id}">${nf(Math.round((e.bonus||0)*10000))}</button>`:nf(Math.round((e.bonus||0)*10000))}</td><td class="right numeric mobile-log-extra">${points(e.contribution)}</td><td class="right numeric mobile-log-extra">${nf(Math.round(e.game))}</td>`:''}
    ${editing&&details?`<td class="mobile-log-actions">${simpleButton('수정','edit-log',e.id,'quiet')}${simpleButton('삭제','entry-delete-log',e.id,'danger quiet')}</td>`:''}
  </tr>`);
  const wide=`<div class="battle-wide-table">${rowTable(headers,rows,`battle-table ${details?'expanded':''} ${mini?'small-log':''}`)}</div>`;
  const mobile=!mini?`<div class="battle-mobile-only">${rowTable(['일차·회차','보스','클랜원','기록 피해량','유형',...(details?['실제 피해량','이전 HP','남은 HP','가산점','기여도','인게임']:[]),...(editing&&details?['관리']:[])],mobileRows,`battle-mobile-table ${details?'mobile-detail':''} ${editing?'can-edit':''}`)}</div>`:'';
  return wide+mobile;
};
const closeBeforeInsertionCleanup=closeDrawer;
closeDrawer=()=>{ext.logInsertion=null;closeBeforeInsertionCleanup();};
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action="u-move-log"]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();
  const rows=[...data.logs].sort((a,b)=>a.seq-b.seq),index=rows.findIndex(row=>row.id===button.dataset.id),direction=button.dataset.direction==='up'?-1:1,target=rows[index+direction];if(target)moveLogRecord(button.dataset.id,target.id,direction<0?'before':'after');
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
  event.preventDefault();const id=ext.draggedLog,side=ext.logDrop?.id===row.dataset.logId?ext.logDrop.side:'before';ext.draggedLog=null;ext.logDrop=null;clearLogDropMarks();if(id!==row.dataset.logId)moveLogRecord(id,row.dataset.logId,side);
});
document.addEventListener('dragend',()=>{ext.draggedLog=null;ext.logDrop=null;clearLogDropMarks();});
