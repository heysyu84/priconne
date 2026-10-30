// Read-only bridge from an Aikurumi task/link into the Nyang tactic editor format.
// The operator must separately approve registration; this module never writes site data.
import {splitAikurumiTimeline} from './aikurumi-tactic-preprocess.mjs';
import {convertForeignTactic} from './tactic-parser.mjs';
import {resolveAikurumiParty} from './aikurumi-character-matcher.mjs';

const string=value=>String(value??'').trim();
const positive=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
export function previewAikurumiTactic(task, link, options={}){
  const sourceText=String(link?.remarks??'');
  const source=splitAikurumiTimeline(sourceText);
  const rawCharacters=Array.isArray(task?.charas)?task.charas:[];
  const hasFive=rawCharacters.length===5&&rawCharacters.every(c=>positive(c?.prefabId)&&string(c?.unitName));
  const resolved=options.unitMap?resolveAikurumiParty(rawCharacters,options.unitMap,
    options.positionUnits||[],options.extraAliases||{}):null;
  const submittedNames=Array.isArray(options.koreanNames)?options.koreanNames.map(string):[];
  const idMatches=!!resolved?.complete;
  const manualMatches=submittedNames.length===5&&submittedNames.every(Boolean)&&new Set(submittedNames).size===5
    &&(!resolved||submittedNames.every((name,index)=>name===resolved.koreanNames[index]));
  const namesMatched=idMatches||manualMatches;
  const displayNames=idMatches?resolved.koreanNames:manualMatches?submittedNames:rawCharacters.map(c=>string(c?.unitName));
  const userAliases=Array.isArray(options.sourceAliases)?options.sourceAliases:[];
  const sourceAliases=resolved?.foreignNames?.map((list,index)=>[list,userAliases[index]].filter(Boolean).join('|'))||userAliases;
  const parsed=source.hasAction&&hasFive
    ?convertForeignTactic(source.timeline,displayNames,sourceAliases,options.bossNames||[],options.characterNames||[])
    :{rows:[],warnings:[],unmappedActors:[],text:''};
  const issues=[];
  if(!hasFive)issues.push({code:'incomplete-lineup',message:'원본 캐릭터 5명 또는 ID가 누락됨'});
  if(resolved?.issues?.length)issues.push(...resolved.issues);
  if(!namesMatched)issues.push({code:'unmatched-korean-names',message:'한국어 캐릭터명이 아직 검증되지 않음'});
  if(!source.hasAction)issues.push({code:'no-action-timeline',message:'원문에 변환 가능한 조작 타임라인 없음'});
  // Timing ranges like "1:17-16" do not mean an exact 1:17 trigger.
  // Preserve the original range and require human confirmation rather than
  // silently claiming the converted timestamp is exact.
  const ambiguousTimes=[...sourceText.matchAll(/(?:^|\n)\s*[☆⭐★✩]?\s*(\d{1,2}:[0-5]\d\s*[-~～]\s*(?:(?:\d{1,2}:)?[0-5]\d))(?=\s|$)/g)]
    .map(match=>match[1]);
  if(ambiguousTimes.length)issues.push({code:'time-range',message:'조작 시간 범위 확인: '+[...new Set(ambiguousTimes)].join(', ')});
  if(parsed.warnings?.length)issues.push({code:'unparsed-instructions',message:'변환되지 않은 원문 또는 조건이 있음'});
  if(parsed.unmappedActors?.length)issues.push({code:'unmapped-actors',message:'행동 대상의 캐릭터 매칭이 필요함'});
  return {
    source:'aikurumi.cn',sourceTaskId:task?.id??null,sourceLinkIndex:link?.index??null,
    sourceUrl:string(link?.link),sourceTitle:string(link?.name),
    bossSlot:options.bossSlot??null,stage:options.stage??null,
    sourceText,notes:source.notes,originalLineup:rawCharacters.map(c=>({
      prefabId:positive(c?.prefabId),unitName:string(c?.unitName),
      stars:Number.isInteger(Number(c?.currentRarity))?Number(c.currentRarity):null,
      rank:Number.isInteger(Number(c?.rank))?Number(c.rank):null
    })),
    matchedKoreanNames:namesMatched?displayNames:null,
    characterMatchSource:idMatches?'korean-unit-id':manualMatches?'provided-review':'unresolved',
    characterMatches:resolved?.rows||null,
    damageRaw:{manual:positive(task?.damage),auto:positive(task?.autoDamage),
      halfAuto:positive(task?.halfAutoDamage),easyManual:positive(task?.easyManualDamage)},
    isCarryCandidate:Number(task?.type)===1,
    timeline:source.timeline,rows:parsed.rows,warnings:parsed.warnings,
    unmappedActors:parsed.unmappedActors,issues,
    status:!hasFive?'invalid':!source.hasAction?'notes-only':'needs-review',
    registrationAllowed:false
  };
}
