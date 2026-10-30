import {previewAikurumiTactic} from './aikurumi-tactic-review.mjs';
import {classifySourceTactic,OPERATION_LABELS} from './aikurumi-operation-types.mjs';
import {parseStage3CarryTime} from './aikurumi-stage3-carry.mjs';
import {selectPrimaryTacticSource} from './aikurumi-source-priority.mjs';

const positive=v=>v!==null&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
export const candidateKey=r=>[r.stage,r.boss,r.taskId,r.linkIndex??r.linkOrdinal,r.linkOrdinal].join(':');
export const isYouTube=value=>{try{return /^(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)$/.test(new URL(value).hostname);}catch{return false;}};
export const safeUrl=value=>{try{const u=new URL(value);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}};
export const damageLabel=v=>v===null||v===''||!Number.isFinite(Number(v))?'미표기':Number(v).toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:2})+'억';

// Damage belongs to a particular source link, not the maximum of its whole party.
export function sourceDamage(task,link){
 const direct=positive(link?.damage);
 if(direct)return {value:direct/10000,options:[direct/10000],basis:'선택한 택틱',ambiguous:false};
 const title=String(link?.name||'').split('\n')[0].normalize('NFKC');
 const values=[...title.matchAll(/(?<![\d:.])([1-9]\d{3,6}(?:\.\d+)?)(?![\d:.])/g)]
  .map(m=>Number(m[1])/10000);
 const options=[...new Set(values)];
 if(options.length)return {value:options.length===1?options[0]:null,options,basis:'선택한 택틱',ambiguous:options.length>1};
 const operation=classifySourceTactic(task,link).operation;
 const field={'full-auto':'autoDamage','semi-auto':'halfAutoDamage','easy-manual':'easyManualDamage',manual:'damage'}[operation];
 const raw=field&&positive(task?.[field]);
 return {value:raw?raw/10000:null,options:raw?[raw/10000]:[],basis:raw?'편성 참고값':'미표기',ambiguous:false};
}

export function extractTacticConditions(task,link,preview){
 const text=[preview?.notes,task?.remarks,task?.exRemarks,link?.name].filter(Boolean).join('\n').normalize('NFKC');
 const tp=text.match(/(?:初[动動]\s*)?TP\s*(?:Lv\.?|レベル)?\s*(\d+)(?:\s*[☆★星.\-]\s*(\d+))?(\s*\+)?/i);
 const fields=[];
 const push=(label,expression)=>{const m=text.match(expression);if(m)fields.push({label,value:m[1].trim()});};
 push('속성 레벨',/(?:属性等级|屬性等級|属性レベル)\s*[:：]?\s*([^\n]+)/);
 push('속성 스킬',/(?:属性技能强化|屬性技能強化|属性スキル強化)\s*[:：]?\s*([^\n]+)/);
 push('마스터 스킬',/(?:大师技能|大師技能|マスタースキル)\s*[:：]?\s*([^\n]+)/);
 push('캐릭터 레벨',/(?:^|\n)\s*(Lv\.?\s*\d+)\s*(?:\n|$)/i);
 const translate=value=>String(value).replace(/页目全|頁目全/g,'페이지 전체').replace(/个/g,'개')
  .replace(/物理造成伤害/g,'물리 피해').replace(/魔法造成伤害/g,'마법 피해')
  .replace(/暗\s*Lv/gi,'어둠 Lv').replace(/火\s*Lv/gi,'불 Lv').replace(/水\s*Lv/gi,'물 Lv')
  .replace(/风\s*Lv/gi,'바람 Lv').replace(/光\s*Lv/gi,'빛 Lv');
 return {tp:tp?tp[1]+(tp[2]?'.'+tp[2]:'')+(tp[3]?'+':''):'',
  fields:fields.map(f=>({...f,value:translate(f.value)})),notes:preview?.notes||'',
  ranks:preview?.originalLineup?.map(c=>c.rank)||[],
  fullSet:/(?:全員|全员|全部|全)\s*(?:SET|セット)/i.test(text)};
}

export function buildReviewItems(snapshot,youtube,{youtubeReady=true,now=Date.now()}={}){
 const fresh=!!youtube&&Number.isFinite(Date.parse(youtube.expiresAt))&&Date.parse(youtube.expiresAt)>now;
 const refs=new Map((fresh?youtube.references||[]:[]).map(r=>[candidateKey(r),r]));
 const items=[];
 for(const boss of snapshot.bosses||[])for(const task of boss.tasks||[]){
  const links=task.links?.length?task.links:[{index:0,name:'출처 미표기',remarks:''}];
  for(const [ordinal,link]of links.entries()){
   const key=candidateKey({stage:snapshot.stage,boss:boss.index,taskId:task.id,linkIndex:link.index,linkOrdinal:ordinal});
   const preview=previewAikurumiTactic(task,link,{unitMap:snapshot.characterData?.names,
    positionUnits:snapshot.characterData?.positionUnits,stage:snapshot.stage,bossSlot:boss.index,
    bossNames:snapshot.bosses.map(b=>b.unitName)});
   const linked=isYouTube(link.link),candidate=refs.get(key)||null;
   const policy=linked?selectPrimaryTacticSource(candidate,{youtubeReady:youtubeReady&&fresh,
    hasChineseTimeline:preview.rows.length>0,hasYouTubeLink:true}):
    {source:'aikurumi',chineseFallback:true,needsHumanCheck:true};
   const rows=policy.source==='aikurumi'?preview.rows:candidate?.rows||[];
   const type=classifySourceTactic(task,link),conditions=extractTacticConditions(task,link,preview);
   const carry=parseStage3CarryTime(link.name);
   const source=policy.source==='aikurumi'?'aikurumi':'youtube';
   const problems=[];
   if(!preview.matchedKoreanNames)problems.push('캐릭터 이름 확인');
   const automaticLineup=snapshot.stage===3&&type.operation==='full-auto';
   if(!automaticLineup&&linked&&!fresh)problems.push('유튜브 수집 자료 갱신 필요');
   else if(!automaticLineup&&linked&&!candidate)problems.push('유튜브 수집 결과 없음');
   else if(!automaticLineup&&source==='youtube'){
    if(candidate?.status==='needs-source-check')problems.push('영상 내 택틱 구간 확인');
    if(candidate?.status==='video-unavailable')problems.push('영상 조회 불가');
    if(candidate?.omittedRows)problems.push('번역되지 않은 조작 '+candidate.omittedRows+'행');
    if(candidate?.unresolvedRows)problems.push('조작·조건 확인 '+candidate.unresolvedRows+'행');
    if(candidate?.status==='video-timeline-only')problems.push('영상 화면의 TL · 설명란 본문 없음');
    if(candidate?.issues?.includes('unmapped-actors'))problems.push('행동 대상 확인');
   }
   if(!automaticLineup&&source==='aikurumi'&&(preview.warnings.length||preview.unmappedActors.length))problems.push('조작문 해석 확인');
   if(!automaticLineup&&!rows.length)problems.push('조작문 확인');
   const damage=sourceDamage(task,link);
   if(damage.ambiguous)problems.push('기대딜 선택');
   const conditionFields=candidate?.conditions?.fields?.length&&source==='youtube'?candidate.conditions.fields:conditions.fields;
   items.push({key,sourceKey:[snapshot.krMonth,key].join(':'),month:snapshot.krMonth,
    stage:Number(snapshot.stage)===3?3:4,sourceStage:snapshot.stage,boss:Number(boss.index),bossName:boss.unitName,
    task,link,ordinal,preview,candidate,policy,source,rows,operation:type.operation,operationLabel:OPERATION_LABELS[type.operation],
    carry:carry.seconds,carryDetail:carry,damage,conditions:{...conditions,fields:conditionFields,
     tp:source==='youtube'&&candidate?.conditions?.tp?candidate.conditions.tp:conditions.tp},
    party:preview.matchedKoreanNames||preview.originalLineup.map(c=>c.unitName),
    stars:preview.originalLineup.map(c=>c.stars),problems:[...new Set(problems)],
    creator:String(link.name||'').split('\n').find(line=>/油管|YouTube|youtube|情報会|WorryChefs/.test(line))
      ?.replace(/^(?:油管|YouTube|youtube|情報会)\s*/, '').trim()||'출처 미표기'});
  }
 }
 return items;
}

export function reviewDraft(item){
 return {party:[...item.party],stars:[...item.stars],damage:item.damage.value??'',hands:item.operation==='full-auto'?0:'',
  tp:item.conditions.tp,category:item.task.type===1&&item.stage===4?'carry':'main',support:-1,
  duration:90,requiredCarrySeconds:'',carry:item.stage===3?item.carry??'':'',
  note:item.conditions.fields.map(f=>f.label+': '+f.value).join('\n'),
  rows:item.rows.map(row=>({text:String(row.text||''),checked:[...(row.checked||Array(6).fill(false))],needsReview:row.needsReview===true})),
  source:item.source,confirmed:false,createMonth:false,edited:false};
}

// A full-auto party can be registered before its separate timeline is reviewed.
// Do not copy partially converted instructions or mark them as reviewed.
export function stage3LineupDraft(item,draft,{confirmed=false,createMonth=false}={}){
 if(item.stage!==3||item.operation!=='full-auto')throw Error('3단계 풀오토 조합만 등록할 수 있습니다.');
 return {...structuredClone(draft),lineupOnly:true,confirmed,createMonth,rows:[],hands:0};
}

export function validateReviewDraft(item,draft){
 const errors=[];
 const lineupOnly=draft.lineupOnly===true;
 if(lineupOnly&&(item.stage!==3||item.operation!=='full-auto'))errors.push('3단계 풀오토 조합만 등록할 수 있습니다.');
 if(!draft.confirmed)errors.push('원본 영상·누락 구간과 조건을 확인해 주세요.');
 if(!Array.isArray(draft.party)||draft.party.length!==5||draft.party.some(n=>!String(n||'').trim())||new Set(draft.party).size!==5||!item.preview.matchedKoreanNames)
  errors.push('캐릭터 5명을 확인해 주세요.');
 if(!draft.stars?.every(s=>Number.isInteger(Number(s))&&Number(s)>=1&&Number(s)<=6))errors.push('성급을 확인해 주세요.');
 if(draft.damage!==''&&(!Number.isFinite(Number(draft.damage))||Number(draft.damage)<=0||Number(draft.damage)>1000))errors.push('기대딜은 억 단위의 양수로 입력해 주세요.');
 if(item.damage.ambiguous&&draft.damage==='')errors.push('이 택틱의 기대딜을 선택해 주세요.');
 if(draft.hands!==''&&(!Number.isInteger(Number(draft.hands))||Number(draft.hands)<0||Number(draft.hands)>200))errors.push('손컨 횟수를 확인해 주세요.');
 if(!['main','tabi','carry'].includes(draft.category))errors.push('택틱 분류를 확인해 주세요.');
 if(!Number.isInteger(Number(draft.support))||Number(draft.support)<-1||Number(draft.support)>4)errors.push('대여 캐릭터를 확인해 주세요.');
 if(typeof draft.tp!=='string'||draft.tp.length>40||String(draft.note||'').length>12000)errors.push('조건과 메모 길이를 확인해 주세요.');
 if(!Array.isArray(draft.rows)||!lineupOnly&&!draft.rows.length||draft.rows.length>250||draft.rows.some(r=>!r.text?.trim()||r.text.length>2000||r.checked?.length!==6||r.checked.some(v=>typeof v!=='boolean')))
  errors.push('조작문과 SET 상태를 확인해 주세요.');
 if(lineupOnly&&draft.rows?.length)errors.push('조합 등록에는 미검수 조작문을 포함할 수 없습니다.');
 if(draft.rows?.some(r=>/\[원문 확인:/.test(r.text)))errors.push('미해석 부분을 수정해 주세요.');
 if(draft.carry!==''&&(!Number.isInteger(Number(draft.carry))||Number(draft.carry)<0||Number(draft.carry)>90))errors.push('예상 이월은 0~90초로 입력해 주세요.');
 if(draft.category==='carry'&&(!Number.isInteger(Number(draft.requiredCarrySeconds))||Number(draft.requiredCarrySeconds)<1||Number(draft.requiredCarrySeconds)>90))errors.push('필요 이월은 1~90초로 입력해 주세요.');
 if(draft.source!==item.source)errors.push('기준 TL 출처를 확인해 주세요.');
 if(draft.source==='youtube'&&!isYouTube(item.link.link))errors.push('원본 영상 주소를 확인해 주세요.');
 return errors;
}

export function buildReviewedTactic(item,draft,{id,now=new Date().toISOString()}={}){
 const errors=validateReviewDraft(item,draft);if(errors.length)throw Error(errors[0]);
 const rows=draft.rows.map((r,i)=>({id:id+'-r'+i,text:r.text.trim(),checked:[...r.checked],manualChecks:true}));
 const externalSource={key:item.sourceKey,taskId:item.task.id,linkIndex:item.link.index??item.ordinal,
  linkOrdinal:item.ordinal,month:item.month,stage:item.stage,source:draft.source,
  url:safeUrl(item.link.link),reviewedAt:now,reviewScope:draft.lineupOnly?'lineup':'timeline',operation:item.operation};
 const carry=draft.carry===''?null:Number(draft.carry);
 return {id,stage:item.stage,boss:item.boss,party:[...draft.party],stars:draft.stars.map(Number),
  title:draft.party.join(' '),damage:draft.damage===''?0:Number(draft.damage),
  sourceExpectedDamage:draft.damage===''?'':String(draft.damage),hands:draft.hands===''?null:Number(draft.hands),
  tp:draft.tp.trim(),support:Number(draft.support),category:item.stage===3?'recommendation':draft.category,
  duration:90,requiredCarrySeconds:draft.category==='carry'?Number(draft.requiredCarrySeconds):null,
  requiredSeconds:item.stage===3&&carry===item.carry&&item.carryDetail.status==='remaining-plus-bonus'
   ?90-item.carryDetail.remainingSeconds:null,
  remainingSeconds:item.stage===3?carry:null,recommendationOnly:item.stage===3,
  hidden:false,deletedAt:null,video:safeUrl(item.link.link),links:[],note:String(draft.note||'').trim(),
  text:rows.map(r=>r.text).join('\n'),rows,externalSource};
}

export function findImportedTactic(season,item){
 const records=item.stage===3?season?.recommendations:season?.tactics;
 return (records||[]).find(t=>!t.deletedAt&&t.externalSource?.key===item.sourceKey)||null;
}
