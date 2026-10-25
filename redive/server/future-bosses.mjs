import {identity,isSameOriginWrite} from './shared-store.mjs';
import initial from '../data/future-bosses.json' with {type:'json'};
import catalog from '../data/bosses.json' with {type:'json'};

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export function addBossMonths(month,delta){const [year,value]=month.split('-').map(Number),index=year*12+value-1+delta;return Math.floor(index/12)+'-'+String(index%12+1).padStart(2,'0');}
function sourceMonth(value){const match=String(value).match(/^(\d{4})[-/](\d{1,2})/);if(match)return match[1]+'-'+match[2].padStart(2,'0');const n=Number(value);if(!Number.isFinite(n)||n<1e9)return null;return new Date(n<1e12?n*1000:n).toISOString().slice(0,7);}
const normal=value=>String(value||'').normalize('NFKC').replace(/[\s·・･()（）\-ー_]/g,'').toLowerCase();
async function upstream(path,body){
  const d=String(Date.now()),l=Math.random()*d.length,bytes=await crypto.subtle.digest('SHA-1',new TextEncoder().encode(d.substr(l)+'123456')),t=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
  const response=await fetch('https://aikurumi.cn/api'+path,{method:body?'POST':'GET',headers:{d,l:String(l),t,Accept:'application/json','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(6500)});
  if(!response.ok)throw new Error('자료 서버 응답 '+response.status);const result=await response.json();if(result.code!==200||!Array.isArray(result.data))throw new Error('보스 자료 형식을 확인하지 못했습니다.');return result.data;
}
export function normalizeFutureLineup(raw,month,id,known){
  const rows=[...raw].sort((a,b)=>Number(a.index)-Number(b.index));
  if(rows.length!==5||new Set(rows.map(b=>Number(b.prefabId))).size!==5||rows.some(b=>!Number.isInteger(Number(b.prefabId))||!b.unitName))return null;
  return {jpMonth:month,krMonth:addBossMonths(month,13),clanBattleId:id,bosses:rows.map((boss,i)=>{const mapped=known.ids.get(String(boss.prefabId))||known.names.get(normal(boss.unitName));return {slot:i+1,prefabId:Number(boss.prefabId),sourceName:String(boss.unitName),name:mapped?.name||String(boss.unitName),referenceKey:mapped?.referenceKey||null,portrait:mapped?.portrait||null,status:mapped?'verified':'unmatched'};})};
}
export function futureKnown(previous=initial){
  const ids=new Map(),names=new Map();for(const month of Object.values(previous.months))for(const boss of month.bosses)if(boss.status==='verified')ids.set(String(boss.prefabId),boss);
  for(const [name,record]of Object.entries(catalog.catalog||{}))for(const alias of [name,record.japaneseName,...(record.aliases||[])])if(alias)names.set(normal(alias),{name,referenceKey:record.referenceKey,portrait:record.portrait||record.assetSource||null});return {ids,names};
}
async function refreshed(previous){
  const periods=await upstream('/pcr/clanBattleList?server=jp'),now=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}).slice(0,7),known=futureKnown(previous);
  const cycles=periods.map(p=>({month:sourceMonth(p.startTime),id:Number(p.clanBattleId)})).filter(p=>p.month&&Number.isSafeInteger(p.id)&&addBossMonths(p.month,13)>=now).sort((a,b)=>b.month.localeCompare(a.month));
  const missing=cycles.filter(p=>previous.months[addBossMonths(p.month,13)]?.clanBattleId!==p.id).slice(0,4),months={...previous.months};
  const results=await Promise.allSettled(missing.map(async cycle=>{const raw=await upstream('/pcr/gvgTask',{server:'jp',stage:4,clanBattleId:cycle.id});return normalizeFutureLineup(raw,cycle.month,cycle.id,known);}));
  let changed=false;for(const result of results)if(result.status==='fulfilled'&&result.value){months[result.value.krMonth]=result.value;changed=true;}
  return {...previous,source:'aikurumi.cn (JP)',offsetMonths:13,months,checkedAt:new Date().toISOString(),updatedAt:changed?new Date().toISOString():previous.updatedAt,refreshError:results.some(r=>r.status==='rejected')?'일부 신규 월을 확인하지 못했습니다. 기존 자료를 유지합니다.':''};
}
export async function handleFutureBosses(request,env){
  if(!env.DB)return json(initial);
  const force=request.method==='POST';if(force){if(!isSameOriginWrite(request))return json({error:'허용되지 않은 요청입니다.'},403);const user=await identity(request,env);if(!user.canEdit)return json({error:'관리자 로그인 후 갱신할 수 있습니다.'},user.authenticated?403:401);}
  const db=env.DB,now=Date.now();
  await db.prepare('INSERT OR IGNORE INTO future_boss_cache (id,document,refresh_after,lease_until) VALUES (?,?,0,0)').bind('jp-13',JSON.stringify(initial)).run();
  const row=await db.prepare('SELECT document,refresh_after,lease_until FROM future_boss_cache WHERE id = ?').bind('jp-13').first();let value=JSON.parse(row.document);
  if(force||row.refresh_after<=now){
    const lease=await db.prepare('UPDATE future_boss_cache SET lease_until = ? WHERE id = ? AND lease_until < ?').bind(now+25000,'jp-13',now).run();
    if(lease.meta.changes){
      let retry=86400000;try{value=await refreshed(value);}catch(error){retry=3600000;value={...value,checkedAt:new Date().toISOString(),refreshError:'새 자료를 확인하지 못해 마지막 확인 자료를 표시합니다.'};}
      await db.prepare('UPDATE future_boss_cache SET document = ?, refresh_after = ?, lease_until = 0 WHERE id = ?').bind(JSON.stringify(value),now+retry,'jp-13').run();
    }
  }
  return json(value);
}
