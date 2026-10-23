import { env } from "cloudflare:workers";
import { bossProgress, replayMonth } from "../../../public/engine.mjs";
import { memberLabel } from "../../../public/roster.mjs";
import { allowedOrigin, apiJSON, preflight } from "../../api-access";

type StateRow = { revision:number; payload:string };
type Entry = {month?:unknown;clientId?:unknown;memberId?:unknown;boss?:unknown;day?:unknown;damage?:unknown;damageMode?:unknown;carry?:unknown;bonus?:unknown;memo?:unknown};

// Anonymous submissions may APPEND a current-month attack, never update other records.
export async function POST(request:Request){
  if(!allowedOrigin(request))return apiJSON(request,{error:"허용되지 않은 요청입니다."},{status:403});
  let data:Entry;
  try{
    const raw=await request.text();
    if(raw.length>2048)return apiJSON(request,{error:"입력 데이터가 너무 깁니다."},{status:413});
    data=JSON.parse(raw);
  }catch{return apiJSON(request,{error:"입력 내용을 확인하세요."},{status:400});}
  if(!data||typeof data!=="object")return apiJSON(request,{error:"입력 데이터가 올바르지 않습니다."},{status:400});
  const {month,memberId,clientId}=data;
  const boss=Number(data.boss),day=Number(data.day),damage=Number(data.damage),bonus=Number(data.bonus);
  if(typeof month!=="string"||!/^[0-9]{4}-[0-9]{2}$/.test(month)||
    typeof memberId!=="string"||memberId.length>100||
    typeof clientId!=="string"||!/^[a-zA-Z0-9_-]{8,80}$/.test(clientId)||
    !Number.isSafeInteger(boss)||boss<1||boss>5||
    !Number.isSafeInteger(day)||day<1||day>10||
    !Number.isSafeInteger(damage)||damage<0||
    !Number.isSafeInteger(bonus)||Math.abs(bonus)>1_000_000||
    !["manual","max"].includes(String(data.damageMode))||
    typeof data.carry!=="boolean"||typeof data.memo!=="string"||data.memo.length>240)
    return apiJSON(request,{error:"입력값을 확인하세요. 피해량은 1 단위 정수여야 합니다."},{status:400});

  const db=env.DB!;
  const ip=request.headers.get("cf-connecting-ip");
  if(ip){
    try{
      await db.prepare("CREATE TABLE IF NOT EXISTS clan_battle_submission_limits(id TEXT PRIMARY KEY, count INTEGER NOT NULL)").run();
      const keyBytes=new TextEncoder().encode(ip+":"+Math.floor(Date.now()/300000));
      const key=[...new Uint8Array(await crypto.subtle.digest("SHA-256",keyBytes))].map(v=>v.toString(16).padStart(2,"0")).join("");
      await db.prepare("INSERT INTO clan_battle_submission_limits(id,count) VALUES(?,1) ON CONFLICT(id) DO UPDATE SET count=count+1").bind(key).run();
      const result=await db.prepare("SELECT count FROM clan_battle_submission_limits WHERE id=?").bind(key).first<{count:number}>();
      if(Number(result?.count||0)>30)return apiJSON(request,{error:"등록이 많습니다. 잠시 후 다시 시도해 주세요."},{status:429});
    }catch{return apiJSON(request,{error:"입력 요청을 처리할 수 없습니다."},{status:503});}
  }
  for(let i=0;i<6;i++){
    let row:StateRow|null;
    try{row=await db.prepare("SELECT revision,payload FROM clan_state WHERE id='main'").first<StateRow>()}
    catch{return apiJSON(request,{error:"클랜 기록을 불러오지 못했습니다."},{status:503})}
    if(!row)return apiJSON(request,{error:"클랜 데이터가 준비되지 않았습니다."},{status:503});
    let state:any;
    try{state=JSON.parse(row.payload)}catch{return apiJSON(request,{error:"기록 데이터를 읽지 못했습니다."},{status:503})}
    const active=Object.keys(state.months||{}).sort().at(-1);
    if(month!==active)return apiJSON(request,{error:"현재 클랜전에만 입력할 수 있습니다. 새로고침해 주세요."},{status:409});
    const record=state.months[active!];
    if(!record||!Array.isArray(record.events)||!Array.isArray(record.bosses))return apiJSON(request,{error:"클랜전 설정을 확인할 수 없습니다."},{status:503});
    const duplicate=record.events.find((v:any)=>v.publicSubmissionId===clientId);
    if(duplicate)return apiJSON(request,{revision:row.revision,data:state,recordId:duplicate.id,duplicate:true});
    const person=state.roster?.find((v:any)=>v.id===memberId);
    const currentDay=Math.min(Number(record.options?.days||5),Math.max(1,...record.events.map((e:any)=>Number(e.day)||1),...(record.dayBreaks||[]).map((e:any)=>Number(e.nextDay)||1)));
    if(!person||!record.memberIds?.includes(memberId))return apiJSON(request,{error:"참가 클랜원을 선택하세요."},{status:400});
    const membership=record.membership?.[memberId]||{fromDay:1,toDay:null};
    if(currentDay<Number(membership.fromDay||1)||(membership.toDay!=null&&currentDay>Number(membership.toDay)))
      return apiJSON(request,{error:"선택한 클랜원은 현재 일차에 참가하지 않습니다."},{status:400});
    if(day!==currentDay)return apiJSON(request,{error:"입력 일차가 변경됐습니다. 새로고침 후 다시 등록해 주세요."},{status:409});
    let realDamage=damage;
    try{
      replayMonth(record);
      const progress=bossProgress(record).find((v:any)=>Number(v.id)===boss);
      if(!progress)return apiJSON(request,{error:"보스 번호를 확인하세요."},{status:400});
      if(data.damageMode==="max"){
        if(![2,3].includes(Number(progress.stage)))return apiJSON(request,{error:"4단계 피해량은 직접 입력해야 합니다."},{status:400});
        realDamage=Number(record.bosses.find((v:any)=>Number(v.id)===boss)?.hp?.[progress.stage]);
      }
      if(!Number.isSafeInteger(realDamage)||realDamage<0)throw Error("invalid damage");
    }catch{return apiJSON(request,{error:"보스 HP 또는 피해량을 확인하세요."},{status:400})}
    const sequence=Math.max(0,...record.events.map((e:any)=>Number(e.seq)||0))+1;
    const id=crypto.randomUUID();
    record.events.push({
      id,publicSubmissionId:clientId,seq:sequence,day:currentDay,boss,
      memberId,member:memberLabel(person,state.roster),recordedName:person.name,
      damage:realDamage,damageMode:data.damageMode,carry:data.carry,bonus,memo:data.memo.trim()
    });
    try{replayMonth(record)}catch{return apiJSON(request,{error:"공격 기록 검증에 실패했습니다."},{status:400})}
    const payload=JSON.stringify(state);
    if(payload.length>1_800_000)return apiJSON(request,{error:"기록 저장 용량을 초과했습니다."},{status:413});
    const now=new Date().toISOString(),revision=row.revision+1;
    try{
      const result=await db.prepare("UPDATE clan_state SET revision=?,payload=?,updated_at=? WHERE id='main' AND revision=?")
        .bind(revision,payload,now,row.revision).run();
      if(!result.meta.changes)continue;
      try{
        await db.batch([
          db.prepare("INSERT OR IGNORE INTO clan_revisions(revision,payload,created_at) VALUES(?,?,?)").bind(revision,payload,now),
          db.prepare("DELETE FROM clan_revisions WHERE revision NOT IN (SELECT revision FROM clan_revisions ORDER BY revision DESC LIMIT 20)")
        ]);
      }catch{/* Primary append has already committed; history is best effort. */}
      return apiJSON(request,{revision,data:state,recordId:id});
    }catch{return apiJSON(request,{error:"서버에 저장하지 못했습니다."},{status:503})}
  }
  return apiJSON(request,{error:"다른 이용자가 먼저 등록했습니다. 다시 시도해 주세요."},{status:409});
}
export function OPTIONS(request:Request){return preflight(request,["POST"])}
