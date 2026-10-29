import {classifySourceTactic} from './aikurumi-operation-types.mjs';
// Independent, read-only review states; a clean syntax check is not a
// verified tactic and must never be treated as automatic import approval.
export function reviewFlags(preview){
  const issues=Array.isArray(preview?.issues)?preview.issues:[];
  const warnings=Array.isArray(preview?.warnings)?preview.warnings:[];
  const unknown=Array.isArray(preview?.unmappedActors)?preview.unmappedActors:[];
  const hasTimeline=!!String(preview?.timeline||'').trim() && (preview?.rows?.length||0)>0;
  const missingParty=preview?.characterMatchSource!=='korean-unit-id';
  return {
    hasTimeline,
    notesOnly:!hasTimeline,
    noWarnings:hasTimeline&&!issues.length&&!warnings.length&&!unknown.length&&!missingParty,
    hasWarning:!!warnings.length,
    hasUnknown:!!unknown.length,
    missingParty,
    attention:!hasTimeline||!!issues.length||!!warnings.length||!!unknown.length||missingParty
  };
}
export function reviewSummary(items){
  const sum={total:0,timeline:0,notes:0,warning:0,unknown:0,clean:0};
  for(const item of items||[]){
    const f=reviewFlags(item.preview);
    sum.total++;
    if(f.hasTimeline)sum.timeline++;else sum.notes++;
    if(f.hasWarning)sum.warning++;
    if(f.hasUnknown)sum.unknown++;
    if(f.noWarnings)sum.clean++;
  }
  return sum;
}
export function filterReviewItems(items,{boss='all',mode='all',operation='all',query=''}={}){
  const q=String(query).trim().normalize('NFKC').toLocaleLowerCase('ko-KR');
  return (items||[]).filter(item=>{
    const p=item.preview,flags=reviewFlags(p);
    if(boss!=='all'&&String(item.boss.index)!==String(boss))return false;
    const source=classifySourceTactic(item.task,item.link);
    if(operation!=='all'&&!source.categories.includes(operation))return false;
    if(mode==='timeline'&&!flags.hasTimeline)return false;
    if(mode==='clean'&&!flags.noWarnings)return false;
    if(mode==='warning'&&!flags.hasWarning)return false;
    if(mode==='unknown'&&!flags.hasUnknown)return false;
    if(mode==='notes'&&!flags.notesOnly)return false;
    if(q){
      const searchable=[item.boss.unitName,item.task.id,item.link.name,item.link.remarks,
        ...(p.matchedKoreanNames||[]),...p.originalLineup.map(c=>c.unitName),...p.originalLineup.map(c=>c.prefabId)];
      return searchable.join(' ').normalize('NFKC').toLocaleLowerCase('ko-KR').includes(q);
    }
    return true;
  });
}
