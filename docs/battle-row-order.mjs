// The table is newest first. Preserve event IDs and all entered values while changing replay order.
export function planBattleRowMove(month,sourceId,targetId,after=false){
  if(sourceId===targetId)return null;
  const original=[...(month.events||[])].sort((a,b)=>Number(a.seq)-Number(b.seq));
  const source=original.find(e=>e.id===sourceId),target=original.find(e=>e.id===targetId);
  if(!source||!target)throw Error('공격 기록이 변경되었습니다. 표를 확인한 뒤 다시 이동하세요.');
  const descending=[...original].reverse(),from=descending.findIndex(e=>e.id===sourceId);
  descending.splice(from,1);
  const to=descending.findIndex(e=>e.id===targetId)+(after?1:0);descending.splice(to,0,source);
  const ordered=descending.reverse(),targetDay=Number(target.day)||1;
  const sameOrder=ordered.every((e,i)=>e.id===original[i].id);
  if(sameOrder&&Number(source.day)===targetDay)return null;
  const events=ordered.map((e,i)=>({...e,seq:i+1,day:e.id===sourceId?targetDay:e.day}));
  // Keep every other attack on its original day, including empty or skipped days.
  // replayMonth uses afterSeq boundaries rather than the stored event.day values.
  const dayBreaks=Array.isArray(month.dayBreaks)?month.dayBreaks.map(boundary=>({
    ...boundary,afterSeq:events.filter(e=>Number(e.day)<Number(boundary.nextDay)).at(-1)?.seq||0
  })):undefined;
  return {events,...(dayBreaks?{dayBreaks}:{}),day:targetDay,id:sourceId};
}

export function installBattleRowDragging({canEdit,getMonthKey,onMove,notify,doc=document}){
  const styleId='nyang-battle-row-drag-style';
  if(!doc.getElementById(styleId)){
    const style=doc.createElement('style');style.id=styleId;
    style.textContent=`.battle-sheet .row-tools{white-space:nowrap;padding-left:2px;padding-right:2px}.battle-sheet .row-tools>button{width:19px;min-width:19px;padding:2px;margin:0 1px}.battle-sheet .row-tools>.battle-row-handle{cursor:grab;color:#847192;font-size:17px;touch-action:none;user-select:none;letter-spacing:-3px;padding-right:5px}.battle-row-handle:active{cursor:grabbing}.battle-sheet tr.battle-drag-source{opacity:.45}.battle-sheet tr.battle-drop-before>td{box-shadow:inset 0 3px #9670b9}.battle-sheet tr.battle-drop-after>td{box-shadow:inset 0 -3px #9670b9}.battle-row-drag-hint{font-size:12px;color:#81738c;margin-top:4px}@media(max-width:800px){.battle-sheet .row-tools>button{width:16px;min-width:16px;margin:0 1px;padding:1px}.battle-sheet .row-tools>.battle-row-handle{font-size:15px}}`;
    doc.head.append(style);
  }
  let drag=null;
  const rowOf=target=>target?.closest?.('tr[data-battle-record]');
  const clearMarkers=()=>doc.querySelectorAll('.battle-drop-before,.battle-drop-after').forEach(row=>row.classList.remove('battle-drop-before','battle-drop-after'));
  const cancel=()=>{clearMarkers();doc.querySelectorAll('.battle-drag-source').forEach(row=>row.classList.remove('battle-drag-source'));drag=null;};
  const mark=(row,y)=>{
    clearMarkers();if(!row||row.dataset.battleRecord===drag?.id)return null;
    const rect=row.getBoundingClientRect(),after=y>=rect.top+rect.height/2;
    row.classList.add(after?'battle-drop-after':'battle-drop-before');
    return {id:row.dataset.battleRecord,after};
  };
  const finish=target=>{
    const saved=drag;cancel();
    if(!saved||!target||!canEdit()||saved.month!==getMonthKey())return;
    try{onMove(saved.id,target.id,target.after);}catch(error){notify(error.message||'공격 순서를 이동하지 못했습니다.');}
  };
  doc.addEventListener('dragstart',event=>{
    const handle=event.target.closest?.('[data-battle-drag]');if(!handle)return;
    if(!canEdit()){event.preventDefault();return;}
    cancel();drag={id:handle.dataset.battleDrag,month:getMonthKey(),pointer:false};
    rowOf(handle)?.classList.add('battle-drag-source');
    event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-nyang-battle-row',drag.id);
  });
  doc.addEventListener('dragover',event=>{
    if(!drag||drag.pointer)return;
    const row=rowOf(event.target);if(!row)return;
    event.preventDefault();event.dataTransfer.dropEffect='move';mark(row,event.clientY);
  });
  doc.addEventListener('drop',event=>{
    if(!drag||drag.pointer)return;
    const row=rowOf(event.target);event.preventDefault();finish(mark(row,event.clientY));
  });
  doc.addEventListener('dragend',cancel);
  doc.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&drag){cancel();return;}
    const handle=event.target.closest?.('[data-battle-drag]');
    if(!handle||!event.altKey||!['ArrowUp','ArrowDown'].includes(event.key)||!canEdit())return;
    event.preventDefault();event.stopPropagation();
    const rows=[...doc.querySelectorAll('tr[data-battle-record]')],index=rows.findIndex(r=>r.dataset.battleRecord===handle.dataset.battleDrag),up=event.key==='ArrowUp',target=rows[index+(up?-1:1)];
    if(target)try{onMove(handle.dataset.battleDrag,target.dataset.battleRecord,!up);}catch(error){notify(error.message);}
  },true);
  // Pointer capture keeps mouse, touch and pen dragging consistent on the dedicated handle.
  doc.addEventListener('pointerdown',event=>{
    const handle=event.target.closest?.('[data-battle-drag]');
    if(!handle||!canEdit())return;
    event.preventDefault();cancel();drag={id:handle.dataset.battleDrag,month:getMonthKey(),pointer:true,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,moving:false};
    handle.setPointerCapture?.(event.pointerId);
  });
  doc.addEventListener('pointermove',event=>{
    if(!drag?.pointer||drag.pointerId!==event.pointerId)return;
    if(!drag.moving&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<6)return;
    drag.moving=true;
    const handle=doc.querySelector('[data-battle-drag="'+CSS.escape(drag.id)+'"]');rowOf(handle)?.classList.add('battle-drag-source');
    drag.target=mark(rowOf(doc.elementFromPoint(event.clientX,event.clientY)),event.clientY);
    event.preventDefault();
  },{passive:false});
  doc.addEventListener('pointerup',event=>{if(drag?.pointer&&drag.pointerId===event.pointerId)finish(drag.moving?drag.target:null);});
  doc.addEventListener('pointercancel',cancel);
  return {cancel};
}
