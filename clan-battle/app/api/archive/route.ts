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
    // A single month request fetches only that one row, even after years of
    // archives. Full scans are reserved for explicit all-month JSON backup.
    const row=await env.DB!.prepare("SELECT payload FROM clan_state WHERE id = ?").bind("main").first<{payload:string}>();
    const legacy=row?JSON.parse(row.payload):null;
    const latest=Object.keys(legacy?.months||{}).sort().at(-1);
    if(key){
      const saved=await env.DB!.prepare("SELECT payload FROM clan_archive_months WHERE month = ?").bind(key).first<Pick<ArchiveRow,"payload">>();
      const data=saved?JSON.parse(saved.payload):(key!==latest?legacy?.months?.[key]:null);
      return data?Response.json({month:key,data},{headers}):Response.json({error:"해당 월의 보관 기록이 없습니다."},{status:404,headers});
    }
    if(all){
      const result=await env.DB!.prepare("SELECT month,payload FROM clan_archive_months").all<ArchiveRow>();
      const months:Record<string,unknown>={};
      for(const r of result.results||[])months[r.month]=JSON.parse(r.payload);
      for(const [month,data] of Object.entries(legacy?.months||{}))if(month!==latest&&!(month in months))months[month]=data;
      return Response.json({months},{headers});
    }
    const result=await env.DB!.prepare("SELECT month FROM clan_archive_months ORDER BY month DESC").all<Pick<ArchiveRow,"month">>();
    const months=[...new Set([...(result.results||[]).map(r=>r.month),...Object.keys(legacy?.months||{}).filter(m=>m!==latest)])].sort().reverse();
    return Response.json({months},{headers});
  }catch{
    return Response.json({error:"과거 기록을 불러오지 못했습니다. 서버의 아카이브 DB 마이그레이션을 확인해 주세요."},{status:503,headers});
  }
}
export function OPTIONS(request:Request){return preflight(request,["GET"])}
