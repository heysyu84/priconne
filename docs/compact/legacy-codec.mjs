import {pastedRows} from './compat/tactics-model.mjs';
// Both interfaces edit the existing clan API. Preserve fields owned by the
// original interface, and patch only fields actually changed by this one.
const clone=value=>structuredClone(value);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const group=t=>/이월/.test(t.group||t.source||'')?'carry':/타비/.test(t.group||t.source||'')?'tabi':'main';
const groupName=key=>key==='carry'?'이월 택틱':key==='tabi'?'타비비토':'택틱정리';
const normalize=value=>String(value||'').normalize('NFKC').replace(/\s+/g,'').toLowerCase();
const carrySeconds=t=>t.requiredCarrySeconds??(Number(String(t.note||'').match(/(?:필요\s*)?이월\s*시간\s*[:：]?\s*(\d+)\s*초/)?.[1])||null);
const carryNote=value=>String(value||'').replace(/(?:필요\s*)?이월\s*(?:시간)?\s*[:：]?\s*(?:\d+\s*분\s*)?\d+\s*초\s*(?:기준|필요)?/g,'').replace(/^[\s·|,;]+|[\s·|,;]+$/g,'').replace(/\s*·\s*·\s*/g,' · ').trim();
function tactic(t,reference={}){
 const party=clone(t.characters||t.party||reference.party||[]),rows=clone(t.rows??(t.text?pastedRows(t.text,[],party):reference.rows??[]));
 return {...clone(t),party,stars:Array.from(t.stars||reference.stars||[5,5,5,5,5]).map(Number),stage:t.stage===3?3:4,category:group(t),damage:finite(t.expectedDamage??t.damage),sourceExpectedDamage:t.expectedDamage??'',hands:t.manualCount===''?null:finite(t.manualCount??t.hands),tp:String(t.tp||''),duration:finite(t.duration??t.baseSeconds??reference.duration,90)||90,requiredCarrySeconds:carrySeconds(t)??reference.requiredCarrySeconds??null,support:finite(t.supportIndex??t.support,-1),title:party.join(' '),hidden:!!t.hidden,deletedAt:t.trashedAt||null,video:t.video||t.tacticUrl||'',links:clone(t.links||[]),note:group(t)==='carry'?carryNote(t.note):t.note||'',rows,text:rows.map(r=>r.text).join('\n')||t.text||''};
}
const eventFields=e=>({id:e.id,seq:e.seq,day:e.day,boss:e.boss,memberId:e.memberId,damage:e.damage,carry:!!(e.usesCarry??e.carry),bonus:finite(e.bonus),memo:e.note??e.memo??'',gameAt:e.gameAt||''});
function season(month,key,root,reference){
 const saved=root.redive?.seasons?.[key]||{},base=reference.seasons?.[key]||{},options=month.options||{},days=finite(options.days,5),ids=month.memberIds||[];
 const rules={...clone(base.rules||{}),days,daily:finite(options.dailyAttacks,3),startStage:finite(options.startStage,2),levels:[1,2,3,4].map(stage=>({stage,count:stage===4?9999:finite(month.levels?.find(l=>l.stage===stage)?.count)})),autoContribution:options.autoContribution!==false,preserveContributionCoefficients:options.preserveContributionCoefficients===true,factor:finite(options.contributionFactor,.95),samples:finite(options.contributionSamples,10),baseline:finite(options.contributionBaseline,30000000),minimumForAverage:finite(options.minimumForAverage,57000000),startDate:options.startDate||'',stage3Mode:options.stage3Mode||saved.stage3Mode||'auto',carryVisible:options.showCarryTactics!==false,battleSeconds:90,carryBonusSeconds:20,carryMaxSeconds:90};
 const memberships=Object.fromEntries([...new Set([...ids,...Object.keys(month.membership||{})])].map(id=>{const p=month.membership?.[id];return [id,{from:p?.fromDay||1,to:p?.toDay??days}];}));
 const sourceTactics=new Map((base.tactics||[]).map(t=>[t.id,t]));
 const tactics=(month.tactics||[]).map(t=>tactic(t,sourceTactics.get(t.id)));
 const recommendations=(month.recommendations||[]).map(t=>({...tactic({...t,group:'택틱정리',rows:t.rows||[{id:t.id+'-body',text:t.tactic||'',checked:[false,false,false,false,false,false]}]}),category:'recommendation',stage:Number(t.stage)||3,hands:null,recommendationOnly:true,requiredSeconds:t.requiredSeconds??null,remainingSeconds:t.remainingSeconds??null}));
 const history=root.clanHistory?.find(h=>h.month===key),historical=history&&key<Object.keys(root.months).sort().at(-1);
 const winners=historical?Object.fromEntries(['game','contribution','damage'].map(metric=>[metric,(history.winners?.[metric]||[]).filter(Boolean).map(name=>({id:root.roster?.find(p=>p.name===name)?.id||name,name,value:0}))])):null;
 const fingerprint=(month.events||[]).map(e=>`${e.id}:${e.damage}:${e.boss}:${e.memberId}:${e.bonus||0}`).join('|');
 return {logs:(month.events||[]).map(e=>({...clone(e),usesCarry:!!e.carry,note:e.memo||'',gameAt:e.gameAt||''})),tactics,recommendations,rules,bossSettings:clone(month.bosses),memberships,dayClosures:(month.dayBreaks||[]).map(b=>({...clone(b),day:b.nextDay-1,count:(month.events||[]).filter(e=>e.seq<=b.afterSeq).length,at:b.at||''})),notices:{3:month.comboNotices?.stage3||(month.recommendationNotes||[]).join('\n'),4:month.comboNotices?.tp||''},result:{rank:saved.result?.rank??history?.clanRank??null,sealed:saved.result?.sealed??!!historical,confirmedAt:saved.result?.confirmedAt||null,winners:saved.result?.winners||winners,fingerprint:saved.result?.fingerprint||fingerprint}};
}
export function decodeLegacy(root,archives={},reference={}){
 const months={...archives,...root.months},activeMonth=Object.keys(root.months).sort().at(-1),meta=root.redive||{};
 const members=(root.roster||[]).map(p=>({...clone(p),status:p.status==='active'?'active':'graduated',joined:p.joinedAt||'',left:p.leftAt||'',note:p.memo||'',periods:(p.periods||[]).map(v=>({from:v.joined||'',to:v.left||null}))}));
 const boosters=new Set((root.boosterCharacters||[]).map(normalize));
 const characters=clone(meta.characters||reference.characters||[]).map(c=>({...c,booster:[c.name,...(c.aliases||[])].some(name=>boosters.has(normalize(name)))}));
 return {schema:1,members,characters,history:clone(root.clanHistory||[]),awards:clone(root.hallOfFame||[]),communityLinks:clone(months[activeMonth]?.communityLinks||reference.communityLinks||[]),siteCopy:clone(meta.siteCopy||{}),futureOverrides:clone(meta.futureOverrides||{}),referenceVersion:reference.referenceVersion,seasons:Object.fromEntries(Object.entries(months).map(([key,m])=>[key,season(m,key,root,reference)])),activeMonth,importedSource:{key:'live-shared-clan-api',month:activeMonth,readOnlySnapshot:false}};
}
function updateTactic(t,old,previous){
 const out=clone(old||{id:t.id,editorVersion:1}),fresh=!old;
 const set=(key,target,value)=>{if(fresh||!same(t[key],previous[key]))out[target]=value;};
 set('boss','boss',t.boss);set('party','characters',clone(t.party));set('stars','stars',t.stars.map(String));
 if(fresh||t.category!==previous.category){out.group=groupName(t.category);out.source=out.group;}
 if(fresh||t.damage!==previous.damage){out.expectedDamage=String(t.damage);if('expectedDamageSort' in out)out.expectedDamageSort=t.damage;}
 set('hands','manualCount',t.hands===null?'':String(t.hands));set('tp','tp',t.tp);set('video','video',t.video);set('links','links',clone(t.links||[]));set('hidden','hidden',!!t.hidden);set('deletedAt','trashedAt',t.deletedAt||null);set('duration','baseSeconds',t.duration||90);set('requiredCarrySeconds','requiredCarrySeconds',t.requiredCarrySeconds??null);set('support','supportIndex',t.support??-1);
 if(fresh||t.note!==previous.note||t.requiredCarrySeconds!==previous.requiredCarrySeconds||t.category!==previous.category){const note=t.category==='carry'?carryNote(t.note):t.note;out.note=t.category==='carry'&&t.requiredCarrySeconds?`필요 이월시간: ${t.requiredCarrySeconds}초${note?' · '+note:''}`:note;}
 if(fresh||!same(t.rows,previous.rows)||t.text!==previous.text){const prior=new Map((old?.rows||[]).map(r=>[r.id,r]));out.rows=(t.rows??pastedRows(t.text||'',[],t.party)).map(r=>({...clone(prior.get(r.id)||{}),...clone(r),manualChecks:true}));}
 if(fresh||t.title!==previous.title)out.title=t.title;
 return out;
}
export function encodeLegacy(document,root,archives={},reference={}){
 const baseline=decodeLegacy(root,archives,reference),next=clone(root),all={...archives,...root.months},meta=clone(root.redive||{}),changedArchives=[];
 if(!same(document.members,baseline.members)){
  const prior=new Map(root.roster.map(p=>[p.id,p])),beforeMembers=new Map(baseline.members.map(p=>[p.id,p]));next.roster=document.members.map(m=>same(m,beforeMembers.get(m.id))?clone(prior.get(m.id)):{...clone(prior.get(m.id)||{}),id:m.id,name:m.name,uid:m.uid||'',status:m.status==='active'?'active':'left',joinedAt:m.joined||'',leftAt:m.left||'',memo:m.note||'',aliases:clone(m.aliases||[]),periods:(m.periods||[]).map(p=>({joined:p.from,left:p.to||''}))});
 }
 for(const key of ['characters','siteCopy','futureOverrides'])if(!same(document[key]||{},baseline[key]||{}))meta[key]=clone(document[key]);
 for(const [key,target]of [['history','clanHistory'],['awards','hallOfFame']])if(document[key]&&!same(document[key],baseline[key]))next[target]=clone(document[key]);
 const boosterList=new Set(root.boosterCharacters||[]);
 for(const c of document.characters||[]){const before=baseline.characters.find(p=>p.id===c.id);if(before&&before.booster===c.booster)continue;const aliases=new Set([c.name,...(c.aliases||[])].map(normalize));for(const name of boosterList)if(aliases.has(normalize(name)))boosterList.delete(name);if(c.booster)boosterList.add(c.name);}
 if(!same([...boosterList],root.boosterCharacters||[]))next.boosterCharacters=[...boosterList];
 const months={};
 for(const [key,s]of Object.entries(document.seasons)){
  const before=baseline.seasons[key],old=all[key],m=clone(old||{month:key,tactics:[],events:[],members:[],memberIds:[],membership:{},options:{},levels:[],bosses:[],recommendations:[]});
  if(!before||!same(s.logs.map(eventFields),before.logs.map(eventFields))){const prior=new Map((old?.events||[]).map(e=>[e.id,e]));m.events=s.logs.map(e=>{const values=eventFields(e),p=prior.get(e.id);if(p&&same(values,eventFields({...p,note:p.memo||''})))return clone(p);return {...clone(p||{}),...clone(e),...values,member:document.members.find(p=>p.id===e.memberId)?.name||e.member||'',recordedName:p?.recordedName||document.members.find(p=>p.id===e.memberId)?.name||'',carry:values.carry,memo:values.memo};});}
  if(!before||!same(s.tactics,before.tactics)){const prior=new Map((old?.tactics||[]).map(t=>[t.id,t])),canonical=new Map((before?.tactics||[]).map(t=>[t.id,t]));m.tactics=s.tactics.map(t=>updateTactic(t,prior.get(t.id),canonical.get(t.id)||{}));const ids=new Set(s.tactics.map(t=>t.id));m.purgedTactics=[...new Set([...(old?.purgedTactics||[]),...(old?.tactics||[]).filter(t=>!ids.has(t.id)).map(t=>t.id)])];}
  if(!before||!same(s.bossSettings,before.bossSettings))m.bosses=clone(s.bossSettings);
  if(!before||!same(s.memberships,before.memberships)){m.membership=Object.fromEntries(Object.entries(s.memberships).map(([id,p])=>[id,{fromDay:p.from,toDay:p.to>=s.rules.days?null:p.to}]));m.memberIds=Object.keys(s.memberships);m.members=m.memberIds.map(id=>document.members.find(p=>p.id===id)?.name||id);}
  if(!before||!same(s.dayClosures,before.dayClosures))m.dayBreaks=s.dayClosures.map(c=>({...clone((old?.dayBreaks||[]).find(b=>b.id===c.id||b.nextDay===c.day+1)||{}),...(c.at?{at:c.at}:{}),afterSeq:c.afterSeq??Math.max(0,...s.logs.filter(e=>e.day<=c.day).map(e=>e.seq)),nextDay:c.day+1}));
  const optionMap={days:'days',daily:'dailyAttacks',startStage:'startStage',autoContribution:'autoContribution',preserveContributionCoefficients:'preserveContributionCoefficients',factor:'contributionFactor',samples:'contributionSamples',baseline:'contributionBaseline',minimumForAverage:'minimumForAverage',startDate:'startDate',stage3Mode:'stage3Mode',carryVisible:'showCarryTactics'};
  for(const [name,target]of Object.entries(optionMap))if(!before||!same(s.rules[name],before.rules[name]))m.options[target]=s.rules[name];
  if(!before||!same(s.rules.levels,before.rules.levels)){let lap=1;m.levels=s.rules.levels.map(l=>{const level={...l,start:lap,end:lap+l.count-1};lap+=l.count;return level;});}
  if(!before||!same(s.notices,before.notices))m.comboNotices={...m.comboNotices,stage3:s.notices[3]||'',tp:s.notices[4]||''};
  if(!before||!same(s.recommendations,before.recommendations))m.recommendations=s.recommendations.map(t=>({...clone(t),characters:clone(t.party),stars:t.stars.map(String),expectedDamage:t.sourceExpectedDamage===''?'':String(t.damage),tactic:t.text||''}));
  if(!same(document.communityLinks,baseline.communityLinks)&&key===document.activeMonth)m.communityLinks=clone(document.communityLinks);
  if(!before||!same(s.result,before.result)){meta.seasons??={};meta.seasons[key]={...meta.seasons[key],result:clone(s.result)};if(s.result.rank!==before?.result.rank){next.clanHistory??=[];const h=next.clanHistory.find(h=>h.month===key);if(h)h.clanRank=s.result.rank;else next.clanHistory.push({month:key,clanRank:s.result.rank,winners:{damage:[],contribution:[],game:[]}});}}
  if(key===baseline.activeMonth||!old||!same(m,old)){months[key]=m;if(key!==baseline.activeMonth&&old&&!same(m,old))changedArchives.push(key);}
 }
 next.months={...clone(root.months),...months};next.active=Object.keys(next.months).sort().at(-1);
 if(Object.keys(meta).length)next.redive=meta;
 return {data:next,archiveMode:'v1',...(changedArchives.length?{restoreArchives:true}:{})};
}
