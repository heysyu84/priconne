import { editorAction, hasEditor } from "../../editor-access";
export async function GET(request:Request) { return Response.json({editor:await hasEditor(request)},{headers:{"cache-control":"no-store"}}); }
export async function POST(request:Request) { try{return await editorAction(request);}catch{return Response.json({error:"작성 권한을 확인하지 못했습니다."},{status:503});} }
