import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=JSON.parse(fs.readFileSync(root+'data/2026-10-source.json','utf8'));
const monthKey='2026-10',month=source.data.months[monthKey];
const characterInfo=JSON.parse(fs.readFileSync(root+'data/2026-10-characters.json','utf8'));
const roster=new Map(source.data.roster.map(p=>[p.id,p]));
const ids=[...new Set([...month.memberIds,...month.events.map(e=>e.memberId)])];
const members=ids.map(id=>{
  const p=roster.get(id);if(!p)throw new Error('Missing current-month member: '+id);
  const joined=p.joinedAt||'',left=p.leftAt||'';
  return {id,name:p.name,uid:p.uid||'',status:p.status==='left'?'graduated':'active',joined,left,note:p.memo||'',aliases:p.aliases||[],periods:[{from:joined.slice(0,7)||null,to:left.slice(0,7)||null}]};
});
const numericDamage=value=>{const n=Number(String(value??'').replace(/[,\s]/g,''));return Number.isFinite(n)?n:0;};
const normalizeTactic=(t,recommendation=false)=>{
  const party=[...(t.characters||[])],rows=(t.rows||[{id:t.id+'-body',text:t.tactic||'',checked:Array(6).fill(false)}]).map(r=>({...r,checked:Array.from({length:6},(_,i)=>!!r.checked?.[i])}));
  return {...t,id:t.id,party,stars:(t.stars||[]).map(Number),stage:recommendation?Number(t.stage):4,category:recommendation?'recommendation':/이월/.test(t.group||t.source)?'carry':/타비/.test(t.group||t.source)?'tabi':'main',
    damage:numericDamage(t.expectedDamage),sourceExpectedDamage:String(t.expectedDamage??''),hands:t.manualCount===null||t.manualCount===undefined||t.manualCount===''?null:Number(t.manualCount),tp:String(t.tp||''),duration:Number(month.options.battleSeconds)||90,support:-1,
    title:t.title||party.join(' '),hidden:!!t.hidden,deletedAt:t.trashedAt||t.deletedAt||null,note:t.note||'',video:t.video||t.url||t.tacticUrl||'',links:t.tacticUrl&&t.tacticUrl!==t.video?[{label:'택틱 원문',url:t.tacticUrl}]:[],rows,text:rows.map(r=>r.text).join('\n'),recommendationOnly:recommendation};
};
const options=month.options;
const rules={days:Number(options.days)||5,daily:Number(options.dailyAttacks)||3,startStage:Number(options.startStage)||2,levels:month.levels.filter(l=>Number(l.stage)<=4).map(l=>({stage:Number(l.stage),count:Number(l.stage)===4?9999:Number(l.count)||0})),autoContribution:options.autoContribution!==false,factor:Number(options.contributionFactor)||.95,samples:Number(options.contributionSamples)||10,baseline:Number(options.contributionBaseline)||30000000,minimumForAverage:options.minimumForAverage,stage3Mode:'auto',carryVisible:true,startDate:options.startDate||'',battleSeconds:Number(options.battleSeconds)||90,carryBonusSeconds:Number(options.carryBonusSeconds)||20,carryMaxSeconds:Number(options.carryMaxSeconds)||90};
const season={
  rules,bossSettings:month.bosses.map(b=>({...b,portraitKey:'oct-'+b.id})),
  logs:month.events.map(e=>({...e,usesCarry:!!e.carry,type:e.kill?'kill':e.carry?'carry':'normal',note:e.memo||'',created:e.seq,gameAt:e.gameAt||''})),
  tactics:month.tactics.map(t=>normalizeTactic(t)),recommendations:month.recommendations.map(r=>normalizeTactic(r,true)),
  memberships:Object.fromEntries(ids.map(id=>{const p=month.membership[id]||{};return[id,{from:Number(p.fromDay)||1,to:p.toDay===null||p.toDay===undefined?rules.days:Number(p.toDay)}];})),
  dayClosures:month.dayBreaks.map(b=>({...b,day:Number(b.nextDay)-1,count:month.events.filter(e=>e.day===Number(b.nextDay)-1).length,at:b.at||'기존 사이트에서 마감'})),
  notices:{3:month.comboNotices?.stage3||'',4:month.comboNotices?.tp||''},result:{rank:null,sealed:false,confirmedAt:null,winners:null}
};
const day=Math.max(1,...month.events.map(e=>Number(e.day)),...month.dayBreaks.map(b=>Number(b.nextDay)));
const imported={key:monthKey+'-r'+source.revision,month:monthKey,day,members,season,characters:Object.values(characterInfo).map((c,i)=>({id:'oct-character-'+i,name:c.name,aliases:c.aliases,booster:source.data.boosterCharacters.includes(c.name)||source.data.boosterCharacters.includes(c.sourceName),images:{}})),communityLinks:month.communityLinks||[],provenance:{month:monthKey,revision:source.revision,updatedAt:source.updatedAt,sourceUrl:source.retrievedFrom,readOnlySnapshot:true}};
fs.writeFileSync(root+'src/imported-month.js','const MONTH_IMPORT='+JSON.stringify(imported)+';\n');
console.log(JSON.stringify({month:monthKey,revision:source.revision,members:members.length,logs:season.logs.length,tactics:season.tactics.length,recommendations:season.recommendations.length,characters:imported.characters.length,day}));
