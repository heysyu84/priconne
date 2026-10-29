// Solve 5-stage-3-boss deck allocation from original prefab IDs, never
// from translated names. A character used by one boss cannot be reused.
// Read-only: no registration, site data writes, or fabricated substitute units.
import {classifySourceTactic,sourceDamage} from './aikurumi-operation-types.mjs';
import {parseStage3CarryTime} from './aikurumi-stage3-carry.mjs';

export function findNonOverlappingStage3(snapshot,{operation='full-auto',limit=5}={}){
  if(Number(snapshot?.stage)!==3||!Array.isArray(snapshot?.bosses)||snapshot.bosses.length!==5)
    return {status:'invalid-stage',solutions:[],eligiblePerBoss:[]};
  const permitted=['full-auto','semi-auto','easy-manual','manual','all'];
  if(!permitted.includes(operation))throw Error('Unsupported operation filter');
  const bosses=snapshot.bosses.toSorted((a,b)=>Number(a.index)-Number(b.index));
  const groups=bosses.map(b=>{
    const candidates=[];
    for(const task of b.tasks||[]){
      const ids=(task.charas||[]).map(c=>Number(c.prefabId));
      if(ids.length!==5||new Set(ids).size!==5||ids.some(id=>!Number.isSafeInteger(id)||id<=0))continue;
      if(Number(task.type)===1)continue; // carry tactics not interchangeable with initial hits
      const links=task.links?.length?task.links:[null];
      const eligible=links.map(link=>({link,kind:classifySourceTactic(task,link),
        carry:parseStage3CarryTime(link?.name)}))
        .filter(row=>operation==='all'?row.kind.operation!=='unknown':row.kind.operation===operation);
      if(!eligible.length)continue;
      // Per-source carry time is significant even for two links sharing
      // the same five-character team and the same recorded damage.
      eligible.sort((x,y)=>sourceDamage(task,y.kind.operation,y.link)-sourceDamage(task,x.kind.operation,x.link)
        ||Number(y.carry.seconds!==null)-Number(x.carry.seconds!==null)
        ||(y.carry.seconds??-1)-(x.carry.seconds??-1));
      const best=eligible[0];
      candidates.push({
        boss:Number(b.index),bossName:String(b.unitName??''),
        taskId:task.id,
        characterIds:ids,
        characterNames:(task.charas||[]).map(c=>snapshot.characterData?.names?.[String(c.prefabId)]?.[0]||String(c.unitName||'')),
        operation:best.kind.operation,
        score:sourceDamage(task,best.kind.operation,best.link),
        carry:best.carry,
        carrySeconds:best.carry.seconds,
        sourceLink:best.link?.link||'',
        sourceTitle:best.link?.name||'',
        sourceLinkIndex:best.link?.index??null
      });
    }
    candidates.sort((a,b)=>b.score-a.score||
      Number(b.carrySeconds!==null)-Number(a.carrySeconds!==null)||
      (b.carrySeconds??-1)-(a.carrySeconds??-1)||Number(a.taskId)-Number(b.taskId));
    return {boss:Number(b.index),candidates};
  });
  const eligiblePerBoss=groups.map(g=>({boss:g.boss,count:g.candidates.length}));
  if(groups.some(g=>!g.candidates.length))
    return {status:'missing-boss',solutions:[],eligiblePerBoss};
  const sortedGroups=groups.toSorted((a,b)=>a.candidates.length-b.candidates.length);
  const remainingMax=Array.from({length:6},()=>0);
  for(let i=4;i>=0;i--)remainingMax[i]=remainingMax[i+1]+sortedGroups[i].candidates[0].score;
  const results=[],used=new Set(),chosen=[];
  let inspected=0;
  const maxResults=Math.max(1,Math.min(20,Math.floor(Number(limit)||5)));
  function visit(depth,score){
    if(depth===5){
      const selection=chosen.toSorted((a,b)=>a.boss-b.boss);
      const knownCarry=selection.filter(row=>row.carrySeconds!==null);
      const entry={totalDamage:score,lineup:selection,uniqueCharacters:25,
        totalCarrySeconds:knownCarry.reduce((sum,row)=>sum+row.carrySeconds,0),
        knownCarryCount:knownCarry.length,
        unknownCarryCount:5-knownCarry.length};
      results.push(entry);
      results.sort((a,b)=>b.totalDamage-a.totalDamage||
        b.knownCarryCount-a.knownCarryCount||
        b.totalCarrySeconds-a.totalCarrySeconds||
        a.lineup.map(x=>x.taskId).join(',').localeCompare(b.lineup.map(x=>x.taskId).join(',')));
      if(results.length>maxResults)results.length=maxResults;
      return;
    }
    if(results.length>=maxResults&&score+remainingMax[depth]<results.at(-1).totalDamage)return;
    for(const option of sortedGroups[depth].candidates){
      inspected++;
      if(results.length>=maxResults&&score+option.score+remainingMax[depth+1]<results.at(-1).totalDamage)break;
      if(option.characterIds.some(id=>used.has(id)))continue;
      option.characterIds.forEach(id=>used.add(id));
      chosen.push(option);
      visit(depth+1,score+option.score);
      chosen.pop();
      option.characterIds.forEach(id=>used.delete(id));
    }
  }
  visit(0,0);
  return {status:results.length?'solved':'no-zero-overlap',solutions:results,
    eligiblePerBoss,inspected,operation};
}
