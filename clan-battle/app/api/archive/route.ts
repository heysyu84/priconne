import { env } from "cloudflare:workers";
import { allowedOrigin, apiHeaders, preflight } from "../../api-access";

type ArchiveRow = { month:string; payload:string; updated_at:string };

// Archive data is read-only to viewers. Mutation occurs atomically through
// the revision-checked /api/state transaction, never through this route.
export async function GET(request:Request){
  const headers=apiHeaders(request);
  if(!allowedOrigin(request))return Response.json({error:"허용되지 않은 요청입니다."},{status:403,headers});
  const url=new URL(request.url),key=url.searchParams.get("month"),all=url.searchParams.get("all")==="1";
  if(key && !/^\d{4}-\d{2}$/.test(key))return Response.json({error:"월 형식이 올바르지 않습니다."},{status:400,headers});
  try{
    const result=await env.DB!.prepare("SELECT month, payload, updated_at FROM clan_archive_months ORDER BY month DESC").all<ArchiveRow>();
    const months:Record<string,unknown>={};
    for(const r of result.results||[])months[r.month]=JSON.parse(r.payload);
    // During the safe migration period old months remain in clan_state until
    // the first successful version-checked save completes.
    const row=await env.DB!.prepare("SELECT payload FROM clan_state WHERE id = ?").bind("main").first<{payload:string}>();
    const legacy=row ? JSON.parse(row.payload) : null;
    const latest=Object.keys(legacy?.months||{}).sort().at(-1);
    for(const [month,data] of Object.entries(legacy?.months||{})){
      if(month!==latest && !(month in months))months[month]=data;
    }
    if(all)return Response.json({months},{headers});
    if(key)return key in months?Response.json({month:key,data:months[key]},{headers}):Response.json({error:"해당 월의 보관 기록이 없습니다."},{status:404,headers});
    return Response.json({months:Object.keys(months).sort().reverse()},{headers});
  }catch{
    return Response.json({error:"과거 기록을 불러오지 못했습니다. 서버의 아카이브 DB 마이그레이션을 확인해 주세요."},{status:503,headers});
  }
}
export function OPTIONS(request:Request){return preflight(request,["GET"])}
