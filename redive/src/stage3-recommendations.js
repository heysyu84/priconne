// Stage 3 parties belong to one month and have their own recoverable deletion.
function stage3RecommendationRecords(season=data){
 return [...(season.recommendations||[]),...(season.tactics||[])].filter(t=>t.stage===3);
}
function stage3RecommendationActions(){
 if(!adminMode())return '';
 const records=stage3RecommendationRecords(),active=records.filter(t=>!t.deletedAt).length,deleted=records.filter(t=>t.deletedAt).length;
 return (active?simpleButton('초기화','stage3-reset','','quiet danger'):'')+(deleted?simpleButton('삭제함 '+deleted,'stage3-trash','','quiet'):'');
}
function stage3RecommendationTrash(){
 const records=stage3RecommendationRecords().filter(t=>t.deletedAt).sort((a,b)=>a.boss-b.boss);
 openDrawer(ui.month.replace('-','.')+' · 3단계 조합 삭제함',rowTable(['보스','편성','복원'],records.map(t=>`<tr><td>${t.boss}넴</td><td>${X(t.party.join(' · '))}</td><td>${simpleButton('복원','stage3-restore',t.id)}</td></tr>`)),simpleButton('닫기','close-drawer'),' ',true);
}
for(const action of ['stage3-reset','stage3-reset-confirm','stage3-delete','stage3-delete-confirm','stage3-trash','stage3-restore'])writerActions.add(action);
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]'),action=button?.dataset.action;
 if(!action?.startsWith('stage3-')||!writerActions.has(action))return;
 event.preventDefault();event.stopImmediatePropagation();
 if(!adminMode()||!ensureEdit())return;
 if(data.result?.sealed){toast('확정된 월의 조합은 변경할 수 없습니다.');return;}
 const id=button.dataset.id,records=stage3RecommendationRecords();
 if(action==='stage3-trash'){stage3RecommendationTrash();return;}
 if(action==='stage3-reset'){
  const count=records.filter(t=>!t.deletedAt).length;if(!count)return;
  openDrawer(ui.month.replace('-','.')+' · 3단계 조합 초기화',`<p>이 월의 3단계 추천조합 ${count}개를 삭제함으로 이동합니다. 삭제함에서 복원할 수 있습니다.</p>`,simpleButton('취소','close-drawer')+simpleButton('3단계 조합 초기화','stage3-reset-confirm',ui.month,'danger'));return;
 }
 const target=records.find(t=>t.id===id);
 if(action==='stage3-delete'){
  if(!target||target.deletedAt)return;
  openDrawer('3단계 조합 삭제',`<p>${target.boss}넴 · ${X(target.party.join(' · '))}</p><p>삭제함에서 복원할 수 있습니다.</p>`,simpleButton('취소','close-drawer')+simpleButton('삭제','stage3-delete-confirm',id,'danger'),ui.month);return;
 }
 if(action==='stage3-reset-confirm'){
  if(id!==ui.month){toast('선택한 월이 바뀌었습니다. 목록에서 다시 초기화해 주세요.');return;}
  checkpoint();const now=Date.now();for(const t of records)if(!t.deletedAt)t.deletedAt=now;
 }else if(action==='stage3-delete-confirm'){
  if(!target||target.deletedAt)return;checkpoint();for(const t of records)if(t.id===id)t.deletedAt=Date.now();
 }else if(action==='stage3-restore'){
  if(!target?.deletedAt)return;checkpoint();for(const t of records)if(t.id===id)t.deletedAt=null;
 }else return;
 ext.openComboId=null;persist();closeDrawer();render();toast(action==='stage3-restore'?'3단계 조합 복원':'3단계 조합을 삭제함으로 이동',true);
},true);
