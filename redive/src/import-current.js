function applyImportedSnapshot(){
  if(data.importedSource?.key===MONTH_IMPORT.key)return;
  const imported=structuredClone(MONTH_IMPORT),season=imported.season;
  data.members=imported.members;data.characters=imported.characters;data.seasons={[imported.month]:season};data.activeMonth=imported.month;
  data.communityLinks=imported.communityLinks;data.pinHash=null;
  data.importedSource={...imported.provenance,key:imported.key};
  data.settings.defaultDay=imported.day;data.settings.days=season.rules.days;data.settings.daily=season.rules.daily;
  ui.month=imported.month;ui.day=imported.day;ui.picks=[];ui.profile='__clan__';ui.carry=season.rules.battleSeconds||90;
  for(const key of SEASON_KEYS)data[key]=structuredClone(season[key]);
  ui.selectedTactic=data.tactics.find(t=>!t.hidden&&!t.deletedAt&&t.category==='main')?.id;
  ext.stage=4;recalculateSeason();
}
function tacticById(id){return data.tactics.find(t=>t.id===id)||(data.recommendations||[]).find(t=>t.id===id);}
function tacticDamage(t){
  if(t.sourceExpectedDamage!==''&&t.sourceExpectedDamage!==undefined&&Number(t.sourceExpectedDamage)===Number(t.damage))return X(t.sourceExpectedDamage);
  return Number(t.damage||0).toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:4});
}
function tacticHands(t){return t.hands===null||t.hands===undefined?'—':t.hands;}
function tacticDamageLabel(t){return t.recommendationOnly&&t.sourceExpectedDamage===''?'—':tacticDamage(t)+'억';}
function importedSourceLabel(){
  if(!data.importedSource)return '<span class="sample-label" title="예시 데이터 · 이 브라우저에 저장">예시</span>';
  if(data.importedSource.month!==ui.month)return '<span class="sample-label">로컬 자료</span>';
  const at=new Date(data.importedSource.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  return `<span class="sample-label imported-label" title="기존 사이트에서 가져온 10월 자료입니다. 이후 변경은 이 사이트의 공용 저장소에 저장됩니다.">10월 자료 <span>${at} 기준</span></span>`;
}
