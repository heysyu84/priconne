import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AUTOMATIC_HISTORY_FROM, monthlyBattleSummary,confirmMonthlyResult,
  resultNeedsReconfirm,historicalHall,cleanHistoricalHistoryRow
} from '../public/clan-history.mjs';
import {applySourceData} from '../public/guild-model.mjs';

const source=JSON.parse(fs.readFileSync(new URL('../public/guild-source.json',import.meta.url),'utf8'));
assert.equal(source.monthlyHistory.length,87,'retain 87 historical months');
assert.ok(source.monthlyHistory.every(x=>x.memberCount>=1&&x.memberCount<=30),'no missing historical member count');
assert.equal(source.monthlyHistory.find(x=>x.month==='2023-06').notes,'+ 쿨링(노루)');
assert.equal(source.monthlyHistory.find(x=>x.month==='2023-06').memberCount,25,'2023-06 retains separate participant count');
assert.ok(source.monthlyHistory.every(x=>!/\d+\s*인\s*클전/.test(x.notes||'')),'no duplicate participation phrases');
assert.equal(cleanHistoricalHistoryRow({month:'2021-02',notes:'30인 클전',memberCount:null}).memberCount,30);
assert.equal(cleanHistoricalHistoryRow({month:'2023-06',notes:'25인 + 쿨링(노루) 클전',memberCount:25}).notes,'+ 쿨링(노루)');

const hall=historicalHall(source.monthlyHistory);
assert.equal(hall.length,source.hallOfFame.length,'retains historic hall membership');
for(const item of source.hallOfFame){
 const row=hall.find(x=>x.name===item.name);
 assert.deepEqual([row?.damage,row?.contribution,row?.game,row?.total],
   [item.damage,item.contribution,item.game,item.total],
   'historical awards unchanged for '+item.name);
}

const current={
 month:'2026-10',
 options:{days:5},
 memberIds:['m1','m2'],
 members:['하나','둘'],
 bosses:[{id:1,game:{4:2},contribution:{4:1}}],
 events:[
   {id:'e1',memberId:'m1',member:'하나',day:5,stage:4,boss:1,actual:100,damage:100},
   {id:'e2',memberId:'m2',member:'둘',day:5,stage:4,boss:1,actual:90,damage:90}
 ]
};
const first=monthlyBattleSummary(current);
assert.equal(first.month,AUTOMATIC_HISTORY_FROM);
assert.equal(first.memberCount,2);
assert.deepEqual(first.winners.damage,['하나','둘']);
assert.deepEqual(first.winners.game,['하나','둘']);
assert.deepEqual(first.winners.contribution,['하나','둘']);
assert.equal(first.eventCount,2);
const draft={month:'2026-10',winners:first.winners,pendingResult:true};
assert.equal(historicalHall([...source.monthlyHistory,draft]).length,hall.length,
 'unconfirmed awards must be excluded');
const confirmed=confirmMonthlyResult(draft,first,'2026-10-31T14:00:00Z');
assert.equal(confirmed.autoResultSignature,first.signature);
assert.equal(confirmed.pendingResult,false);
assert.deepEqual(confirmed.winners.damage,['하나','둘']);
assert.equal(resultNeedsReconfirm(confirmed,first),false);
const awarded=historicalHall([...source.monthlyHistory,confirmed]);
assert.equal(awarded.find(x=>x.name==='하나').damage[0]-(hall.find(x=>x.name==='하나')?.damage[0]||0),1);

current.events[0].actual=50;
const corrected=monthlyBattleSummary(current);
assert.equal(resultNeedsReconfirm(confirmed,corrected),true);
assert.deepEqual(corrected.winners.damage,['둘','하나']);
const reconfirmed=confirmMonthlyResult(confirmed,corrected,'2026-11-01T01:00:00Z');
assert.equal(reconfirmed.autoFirstFinalizedAt,confirmed.autoFirstFinalizedAt);
assert.equal(resultNeedsReconfirm(reconfirmed,corrected),false);
assert.deepEqual(reconfirmed.winners.damage,['둘','하나']);
assert.deepEqual(source.monthlyHistory.at(-1).winners,
  source.monthlyHistory.find(x=>x.month==='2026-09').winners,'no changes to original historical awards');
assert.throws(()=>confirmMonthlyResult({month:'2026-10',winners:{}},corrected),/수동 기록/);
assert.throws(()=>confirmMonthlyResult(null,{...corrected,month:'2026-09'}),/기존 과거 기록/);
assert.throws(()=>confirmMonthlyResult(null,{...corrected,eventCount:0}),/배틀로그/);

const legacy={
 guildDataVersion:1,roster:[],months:{},clanHistory:source.monthlyHistory.map(x=>({
   ...x,memberCount:x.month==='2019-07'?null:x.memberCount,
   notes:x.month==='2023-06'?'25인 + 쿨링(노루) 클전':x.notes
 }))};
const firstMigration=applySourceData(legacy,source);
assert.equal(firstMigration,true);
assert.equal(legacy.clanHistory.find(x=>x.month==='2019-07').memberCount,30);
assert.equal(legacy.clanHistory.find(x=>x.month==='2023-06').notes,'+ 쿨링(노루)');
assert.equal(legacy.clanHistory.find(x=>x.month==='2026-09').clanRank,21);
assert.equal(legacy.historyAutomationVersion,1);
assert.equal(applySourceData(legacy,source),false,'subsequent reads do not rewrite historical rows');
console.log('PASS: 87 legacy months protected; missing membership filled; duplicate notes cleaned; correct provisional, finalized and reconfirmed awards.');
