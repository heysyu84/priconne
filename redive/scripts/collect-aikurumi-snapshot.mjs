// Manual, branch-isolated snapshot collector for the external tactic review lab.
// Usage: node redive/scripts/collect-aikurumi-snapshot.mjs 2025-10 6
// This script never connects to the Nyang clan database or live tactic storage.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const month=process.argv[2]||'2025-10';
const stage=Number(process.argv[3]||6);
if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(month)||![1,2,3,4,5,6].includes(stage))
  throw Error('Use a valid JP YYYY-MM and stage 1-6');
const origin='https://aikurumi.cn/api';
function headers(){
 const d=String(Date.now()),l=Math.random()*d.length;
 const t=createHash('sha1').update(d.substr(l)+'123456').digest('hex');
 return {d,l:String(l),t,'Accept':'application/json','Content-Type':'application/json','User-Agent':'NyangClanTacticReview/0.1'};
}
async function request(route,body){
 const response=await fetch(origin+route,{method:body?'POST':'GET',headers:headers(),
   body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(22000)});
 if(!response.ok)throw Error(route+' HTTP '+response.status);
 const json=await response.json();
 if(json.code!==200||!Array.isArray(json.data))throw Error('Invalid external API response at '+route);
 return json.data;
}
const periods=await request('/pcr/clanBattleList?server=jp');
const period=periods.find(p=>{
 const match=String(p.startTime||'').match(/^(\d{4})[/-](\d{1,2})/);
 return match&&match[1]+'-'+match[2].padStart(2,'0')===month;
});
if(!period)throw Error('No published JP battle for '+month);
const bosses=await request('/pcr/gvgTask',{server:'jp',clanBattleId:Number(period.clanBattleId),stage});
if(bosses.length!==5)throw Error('Expected five bosses; received '+bosses.length);
const safe=v=>typeof v==='string'?v.slice(0,20000):'';
const snapshot={
 source:'aikurumi.cn',readOnly:true,
 jpMonth:month,krMonth:(()=>{const [y,m]=month.split('-').map(Number);const n=y*12+(m-1)+13;return Math.floor(n/12)+'-'+String(n%12+1).padStart(2,'0')})(),
 stage,clanBattleId:Number(period.clanBattleId),collectedAt:new Date().toISOString(),
 bosses:bosses.map(b=>({index:Number(b.index),prefabId:Number(b.prefabId),unitName:safe(b.unitName),
  tasks:(b.tasks||[]).map(t=>({
   id:t.id,stage:Number(t.stage),type:Number(t.type),canAuto:t.canAuto,
   damage:t.damage,autoDamage:t.autoDamage,halfAutoDamage:t.halfAutoDamage,easyManualDamage:t.easyManualDamage,
   remarks:safe(t.remarks),exRemarks:safe(t.exRemarks),
   charas:(t.charas||[]).map(c=>({prefabId:Number(c.prefabId),unitName:safe(c.unitName),
      currentRarity:c.currentRarity??c.rarity,rank:c.rank})),
   links:(t.links||[]).map((l,index)=>({index:Number.isInteger(Number(l.index))?Number(l.index):index,
     name:safe(l.name),link:safe(l.link),remarks:safe(l.remarks),damage:l.damage,type:l.type}))
  }))
 }))
};
const unitMap=JSON.parse(await fs.readFile(new URL('../data/character-unit-map.json',import.meta.url),'utf8'));
const positionUnits=JSON.parse(await fs.readFile(new URL('../data/character-positions.json',import.meta.url),'utf8')).units;
const usedIds=new Set(snapshot.bosses.flatMap(b=>b.tasks.flatMap(t=>t.charas.map(c=>c.prefabId))));
snapshot.characterData={
 names:Object.fromEntries([...usedIds].filter(id=>unitMap[String(id)]).map(id=>[id,unitMap[String(id)]])),
 positionUnits:positionUnits.filter(u=>usedIds.has(u.unitId))
};
const total=snapshot.bosses.reduce((sum,b)=>sum+b.tasks.length,0);
if(!total||total>1000)throw Error('Unreasonable tactic count '+total);
await fs.writeFile(new URL('../public/aikurumi-snapshot.json',import.meta.url),
  JSON.stringify(snapshot,null,2)+'\n','utf8');
console.log('Snapshot prepared',JSON.stringify({jpMonth:month,krMonth:snapshot.krMonth,
 stage,bosses:snapshot.bosses.length,tactics:total,links:snapshot.bosses.reduce((n,b)=>n+b.tasks.reduce((x,t)=>x+t.links.length,0),0)}));
