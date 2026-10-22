/**
 * Monthly clan-battle result snapshots and historical awards.
 * The original 2019-07..2026-09 records are intentionally immutable here.
 * No database mutation occurs until an authorized editor confirms closing a month.
 */
import {summarizeArchive, sortArchiveRankings} from './archive-summary.mjs?v=20261022-import01';

export const AUTOMATIC_HISTORY_FROM='2026-10';
export const HISTORY_METRICS=['damage','contribution','game'];

export function monthlyBattleSummary(month,roster=[]){
  if(!month||!Array.isArray(month.events))throw Error('월별 배틀로그가 없습니다.');
  const {rows,memberCount}=summarizeArchive(month,roster);
  const hasEvents=month.events.length>0;
  const winners=Object.fromEntries(HISTORY_METRICS.map(metric=>[
    metric,hasEvents?sortArchiveRankings(rows.filter(p=>Number(p[metric])>0),metric).slice(0,2).map(p=>p.name):[]
  ]));
  // Fingerprint totals, log count, winner names and participant count. A corrected
  // battle changes the pending-confirmation indicator, not the finalized snapshot.
  const source=JSON.stringify({
    rows:[...rows].map(p=>[p.id,p.name,p.damage,p.contribution,p.game])
      .sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),
    events:[...month.events].map(e=>[e.id,e.day,e.memberId,e.member,e.boss,e.stage,e.damage,e.actual,e.kill,e.carry,e.carryFrom,e.sourceGame,e.sourceContribution]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),memberCount,winners
  });
  let checksum=2166136261;
  for(let i=0;i<source.length;i++)checksum=Math.imul(checksum^source.charCodeAt(i),16777619);
  return {
    month:month.month,
    memberCount:Number(memberCount)||0,
    winners,
    eventCount:month.events.length,
    signature:(checksum>>>0).toString(16).padStart(8,'0')
  };
}
export function confirmMonthlyResult(previous,summary,when=new Date().toISOString()){
  if(!summary?.month||!summary.eventCount)throw Error('마감할 배틀로그가 없습니다.');
  if(summary.month<AUTOMATIC_HISTORY_FROM)throw Error('기존 과거 기록은 자동으로 덮어쓰지 않습니다.');
  if(previous?.month&&previous.month!==summary.month)throw Error('다른 월의 결과를 덮어쓸 수 없습니다.');
  if(previous&&!previous.autoFinalizedAt&&!previous.pendingResult)throw Error('기존 수동 기록은 자동으로 덮어쓰지 않습니다.');
  return {
    ...(previous||{}),month:summary.month,memberCount:summary.memberCount,
    winners:Object.fromEntries(HISTORY_METRICS.map(k=>[k,[...(summary.winners[k]||[])]])),
    autoFinalizedAt:when,autoFirstFinalizedAt:previous?.autoFirstFinalizedAt||when,
    autoEventCount:summary.eventCount,autoResultSignature:summary.signature,
    pendingResult:false,
    clanRank:previous?.clanRank??null,notes:previous?.notes||'',archiveUrl:previous?.archiveUrl||''
  };
}
export function resultNeedsReconfirm(saved,summary){
  return !!saved?.autoFinalizedAt && saved.autoResultSignature!==summary.signature;
}
export function historicalHall(history=[]){
  const map=new Map();
  for(const result of history){
    // Never award unconfirmed monthly leaders, even when a draft has names.
    if(result.month>=AUTOMATIC_HISTORY_FROM&&!result.autoFinalizedAt)continue;
    for(const metric of HISTORY_METRICS){
      for(const [rank,name] of (result.winners?.[metric]||[]).slice(0,2).entries()){
        if(typeof name!=='string'||!name.trim()||/기록|유실|동면|기 록/.test(name))continue;
        if(!map.has(name))map.set(name,{name,damage:[0,0],contribution:[0,0],game:[0,0],total:0});
        const person=map.get(name);
        person[metric][rank]++;
        person.total++;
      }
    }
  }
  return [...map.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'ko'));
}

export function cleanHistoricalHistoryRow(row){
  if(!row||row.month>=AUTOMATIC_HISTORY_FROM)return row;
  const clean=value=>String(value||'')
    .replace(/\d+\s*인\s*클전|\d+\s*인/g,'')
    .replace(/\(\s*\)/g,'')
    .replace(/\s*[,，]\s*/g, ', ')
    .replace(/^\s*[,，]\s*|\s*[,，]\s*$/g,'')
    .replace(/\s{2,}/g,' ')
    .trim();
  return {
    ...row,
    memberCount:row.memberCount===null||row.memberCount===undefined||row.memberCount===''?30:row.memberCount,
    notes:row.month==='2023-06'?'+ 쿨링(노루)':clean(row.notes),
    ...(row.mergedNotes!==undefined?{mergedNotes:clean(row.mergedNotes)}:{}),
    ...(row.memberCountNote!==undefined?{memberCountNote:''}:{})
  };
}
