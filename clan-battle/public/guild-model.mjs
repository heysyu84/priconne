import { makeId, syncRoster } from './roster.mjs?v=20261022-ui14';
import { bossProgress } from './engine.mjs?v=20261024-boss-lap-lock01';
import {cleanHistoricalHistoryRow,historicalHall} from './clan-history.mjs?v=20261022-hall01';

export const BOSS_COLORS=['#f4cccc','#fff2cc','#d9ead3','#cfe2f3','#d9d2e9'];
export const BOSS_ACCENTS=['#ea9999','#ffe599','#b6d7a8','#a4c2f4','#b4a7d6'];
export const BOSS_INK=['#9d3a3a','#785c12','#3d6b32','#365f96','#64518c'];
export const monthOnly=v=>/^\d{4}-\d{2}/.test(String(v||''))?String(v).slice(0,7):'';
export const thisMonth=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}).slice(0,7);
const monthIndex=v=>Number(v.slice(0,4))*12+Number(v.slice(5,7))-1;
export function tenureMonths(person,asOf=thisMonth()){
  const intervals=(person.periods?.length?person.periods:[{joined:person.joinedAt,left:person.leftAt}]).filter(p=>monthOnly(p.joined));
  if(!intervals.length)return null;
  const spans=intervals.map(p=>[monthIndex(monthOnly(p.joined)),monthIndex(monthOnly(p.left)||asOf)]).filter(p=>p[1]>=p[0]).sort((a,b)=>a[0]-b[0]);
  let total=0,start=null,end=null;
  for(const [a,b] of spans){if(start===null){start=a;end=b;}else if(a<=end+1)end=Math.max(end,b);else{total+=end-start+1;start=a;end=b;}}
  return total+(start===null?0:end-start+1);
}
export function ensureDayBreaks(month){
  if(Array.isArray(month.dayBreaks))return false;
  month.dayBreaks=[];let previous=null;
  for(const e of [...month.events].sort((a,b)=>a.seq-b.seq)){if(previous&&Number(e.day)>Number(previous.day))month.dayBreaks.push({id:'source-break-'+e.id,afterSeq:previous.seq,nextDay:Number(e.day)});previous=e;}
  return true;
}
export function applySourceData(app,source){
  let changed=false;
  if(!Array.isArray(app.boosterCharacters)){
    app.boosterCharacters=[...(source.boosterCharacters||[])];changed=true;
  }
  if(!app.guildDataVersion){
    for(const record of source.roster){
      let p=app.roster.find(p=>record.uid&&p.uid===record.uid)||app.roster.find(p=>p.name===record.name||p.aliases?.includes(record.name));
      if(!p){p={id:'source-member-'+(record.uid||encodeURIComponent(record.name)),name:record.name,uid:record.uid,status:record.status,joinedAt:'',leftAt:'',aliases:[],memo:''};app.roster.push(p);}
      else if(p.name!==record.name)p.aliases=[...new Set([...(p.aliases||[]),record.name])];
      p.joinedAt=monthOnly(p.joinedAt)||record.joinedMonth;
      p.leftAt=p.status==='active'?'':monthOnly(p.leftAt)||record.leftMonth;
      p.periods||=[{joined:p.joinedAt,left:p.leftAt}];p.sourcePeriod=record.sourcePeriod;p.sourceRef=record.source;
    }
    app.clanHistory||=structuredClone(source.monthlyHistory);
    app.hallOfFame||=structuredClone(source.hallOfFame);
    app.guildDataVersion=1;changed=true;
  }
  if(app.historyAutomationVersion!==1){
    // One-time, field-scoped migration of historical rows. Never rewrite
    // historical ranking, winner, rank or already specified attendance values.
    app.clanHistory=(app.clanHistory||[]).map(cleanHistoricalHistoryRow);
    app.hallOfFame=historicalHall(app.clanHistory);
    app.historyAutomationVersion=1;
    changed=true;
  }
  for(const p of app.roster){p.joinedAt=monthOnly(p.joinedAt);p.leftAt=p.status==='active'?'':monthOnly(p.leftAt);p.periods||=[{joined:p.joinedAt,left:p.leftAt}];}
  for(const [key,month] of Object.entries(app.months)){
    changed=ensureDayBreaks(month)||changed;
    if(!month.guildDataVersion){month.recommendations||=structuredClone(source.recommendations?.[key]||[]);month.communityLinks||=structuredClone(source.communityLinks||[]);month.recommendationNotes||=structuredClone(key===source.source.month?source.recommendationNotes:[]);month.guildDataVersion=1;changed=true;}
    if(!month.comboNotices){
      month.comboNotices={tp:source.recommendationWarnings?.tp||'',stage3:source.recommendationWarnings?.stage3||''};changed=true;
    }
  }
  syncRoster(app);return changed;
}
export function dashboardDay(month,memberId,day){
  const events=month.events.filter(e=>e.memberId===memberId&&Number(e.day)===Number(day)).sort((a,b)=>a.seq-b.seq);
  const basics=events.filter(e=>!e.carry),carries=events.filter(e=>e.carry),used=new Set(carries.map(e=>e.carryFrom).filter(Boolean));
  return {used:basics.length,remaining:Math.max(0,Number(month.options.dailyAttacks||3)-basics.length),pending:basics.filter(e=>e.kill&&!used.has(e.id)).length,slots:basics.map(e=>({basic:e,carry:carries.find(c=>c.carryFrom===e.id)||null,pending:e.kill&&!used.has(e.id)})),orphan:carries.filter(e=>!e.carryFrom)};
}
// The 4th stage opens as soon as any boss enters it, even before the
// first stage-4 attack. Reuse the same replay-based progress as the boss tiles.
export function isStageFourUnlocked(month){
  if(!month?.bosses?.length)return false;
  return bossProgress(month).some(boss=>!boss.locked&&Number(boss.stage)>=4);
}
export function remainingAttacks(month){
  const days=Number(month.options.days||5);
  const progress=Math.max(1,...month.events.map(e=>Number(e.day)||1),...(month.dayBreaks||[]).map(b=>Number(b.nextDay)||1));
  const day=Math.min(days,progress),ended=progress>days;
  let normal=0,carry=0;
  if(!ended)for(const id of new Set([...(month.memberIds||[]),...month.events.map(e=>e.memberId).filter(Boolean)])){
    const membership=month.membership?.[id];
    if(membership&&(day<Number(membership.fromDay||1)||day>Number(membership.toDay??days)))continue;
    const usage=dashboardDay(month,id,day);
    normal+=usage.remaining;carry+=usage.pending;
  }
  return {day,normal,carry,ended};
}
export function bossTopStats(month,bossId){
  const all=month.events.filter(e=>Number(e.boss)===Number(bossId)&&e.stage===4&&e.damage>0);
  const samples=[...all].sort((a,b)=>b.damage-a.damage).slice(0,10);
  const mean=samples.length?samples.reduce((s,e)=>s+Math.floor(e.damage/10000),0)/samples.length*10000:null;
  return {samples,mean,corrected:mean===null?null:mean*Number(month.options.contributionFactor||.95)};
}
