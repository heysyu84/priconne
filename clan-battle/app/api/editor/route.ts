import { editorAction, hasEditor } from "../../editor-access";
import { allowedOrigin, apiJSON, preflight } from "../../api-access";
export async function GET(request:Request) { if(!allowedOrigin(request))return apiJSON(request,{error:"허용되지 않은 요청입니다."},{status:403});return apiJSON(request,{editor:await hasEditor(request)}); }
export async function POST(request:Request) { try{return await editorAction(request);}catch{return apiJSON(request,{error:"작성 권한을 확인하지 못했습니다."},{status:503});} }
export function OPTIONS(request:Request) { return preflight(request,["GET","POST"]); }
