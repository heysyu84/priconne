import {applyRecordUpdates} from './record-updates.mjs';
const MAX_BYTES = 1_900_000;
const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const json = (value,status=200) => new Response(JSON.stringify(value),{status,headers});
const object = value => value && typeof value==='object' && !Array.isArray(value);

export function validateDocument(doc) {
  if(!object(doc)||doc.schema!==1||!Array.isArray(doc.members)||doc.members.length>1000||!Array.isArray(doc.characters)||doc.characters.length>2000||!Array.isArray(doc.communityLinks)||doc.communityLinks.length>100||!object(doc.seasons))return false;
  if(doc.siteCopy!==undefined&&(!object(doc.siteCopy)||Object.keys(doc.siteCopy).length>5000||Object.entries(doc.siteCopy).some(([key,value])=>key.length>3000||typeof value!=='string'||value.length>3000)))return false;
  if(doc.futureOverrides!==undefined&&(!object(doc.futureOverrides)||Object.keys(doc.futureOverrides).length>120))return false;
  if(doc.history!==undefined&&(!Array.isArray(doc.history)||doc.history.length>1200))return false;
  if(doc.awards!==undefined&&(!Array.isArray(doc.awards)||doc.awards.length>1000))return false;
  for(const [month,lineup]of Object.entries(doc.futureOverrides||{})){
    if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)||!object(lineup)||!Array.isArray(lineup.bosses)||lineup.bosses.length!==5||new Set(lineup.bosses.map(b=>b.slot)).size!==5)return false;
    if(lineup.bosses.some(b=>![1,2,3,4,5].includes(b.slot)||typeof b.name!=='string'||!b.name.trim()||b.name.length>100||b.portrait&&!/^(https?:\/\/|\.?\/?assets\/)/i.test(b.portrait)))return false;
  }
  const months=Object.keys(doc.seasons);
  if(!months.length||months.length>120||!months.includes(doc.activeMonth)||months.some(key=>!/^20\d{2}-(0[1-9]|1[0-2])$/.test(key)))return false;
  if(doc.members.some(m=>!object(m)||typeof m.id!=='string'||typeof m.name!=='string'||m.name.length>100))return false;
  if(new Set(doc.members.map(m=>m.id)).size!==doc.members.length)return false;
  if(doc.characters.some(c=>!object(c)||typeof c.id!=='string'||typeof c.name!=='string'||!Array.isArray(c.aliases)))return false;
  if(doc.communityLinks.some(link=>!object(link)||typeof link.label!=='string'||!/^https?:\/\//i.test(link.url)))return false;
  for(const s of Object.values(doc.seasons)) {
    if(!object(s)||!Array.isArray(s.logs)||s.logs.length>100000||!Array.isArray(s.tactics)||s.tactics.length>2000||!Array.isArray(s.recommendations)||s.recommendations.length>2000||!Array.isArray(s.bossSettings)||s.bossSettings.length!==5||!object(s.rules)||!object(s.memberships)||!object(s.result)||!object(s.notices)||!Array.isArray(s.dayClosures))return false;
    const r=s.rules;
    if(!Number.isInteger(r.days)||r.days<1||r.days>7||!Number.isInteger(r.daily)||r.daily<1||r.daily>5||![1,2,3,4].includes(r.startStage)||!Array.isArray(r.levels)||r.levels.some(l=>![1,2,3,4].includes(l.stage)||!Number.isInteger(l.count)||l.count<0)||!r.levels.some(l=>l.stage===4&&l.count>0))return false;
    if(new Set(s.bossSettings.map(b=>b.id)).size!==5||s.bossSettings.some(b=>![1,2,3,4,5].includes(b.id)||typeof b.name!=='string'||!object(b.hp)||[1,2,3,4].some(stage=>!Number.isSafeInteger(b.hp[stage])||b.hp[stage]<1)))return false;
    if(new Set(s.logs.map(e=>e.id)).size!==s.logs.length||s.logs.some(e=>!object(e)||typeof e.id!=='string'||typeof e.memberId!=='string'||![1,2,3,4,5].includes(e.boss)||!Number.isInteger(e.day)||e.day<1||e.day>r.days||!Number.isSafeInteger(e.damage)||e.damage<1))return false;
    if(s.tactics.some(t=>!object(t)||typeof t.id!=='string'||t.stage!==4||!Array.isArray(t.party)||t.party.length!==5||!Array.isArray(t.stars)||t.stars.length!==5||typeof t.text!=='string'||(t.rows!==null&&t.rows!==undefined&&(!Array.isArray(t.rows)||t.rows.some(row=>typeof row.text!=='string'||!Array.isArray(row.checked)||row.checked.length!==6||row.checked.some(v=>typeof v!=='boolean'))))))return false;
    if(s.tactics.some(t=>t.requiredCarrySeconds!==undefined&&t.requiredCarrySeconds!==null&&(!Number.isInteger(t.requiredCarrySeconds)||t.requiredCarrySeconds<1||t.requiredCarrySeconds>90)))return false;
  }
  return true;
}

export async function identity(request,env) {
  const userId=request.headers.get('oai-authenticated-user-id');
  if(!userId)return {authenticated:false,canEdit:false,userId:null};
  let admin=await env.DB.prepare('SELECT user_id FROM clan_admins WHERE user_id = ?').bind(userId).first();
  const email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  const bootstrap=env.CLAN_ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if(!admin&&bootstrap&&email===bootstrap) {
    // Only the configured owner can bind, and only while the admin table is empty.
    await env.DB.prepare('INSERT OR IGNORE INTO clan_admins (user_id, created_at) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM clan_admins)').bind(userId,new Date().toISOString()).run();
    admin=await env.DB.prepare('SELECT user_id FROM clan_admins WHERE user_id = ?').bind(userId).first();
  }
  return {authenticated:true,canEdit:!!admin,userId};
}

async function seedOnce(db,initial) {
  const current=await db.prepare('SELECT revision,document FROM clan_state WHERE id = ?').bind('clan').first();
  if(current){
    const previous=JSON.parse(current.document);
    if(initial.referenceVersion&&previous.referenceVersion!==initial.referenceVersion){
      const updated=applyRecordUpdates(previous,initial);
      const ids=new Set(previous.members.map(m=>m.id));
      const document=JSON.stringify({...updated,members:[...previous.members,...initial.members.filter(m=>!ids.has(m.id))],referenceVersion:initial.referenceVersion,siteCopy:previous.siteCopy||{},futureOverrides:previous.futureOverrides||{}}),at=new Date().toISOString(),mutation=crypto.randomUUID();
      await db.batch([
        db.prepare('UPDATE clan_state SET revision = revision + 1, document = ?, updated_at = ?, mutation_id = ? WHERE id = ? AND revision = ?').bind(document,at,mutation,'clan',current.revision),
        db.prepare('INSERT INTO clan_revisions (revision,document,updated_at,updated_by) SELECT revision,document,updated_at,updated_by FROM clan_state WHERE id = ? AND mutation_id = ?').bind('clan',mutation),
      ]);
    }
    return;
  }
  const {recordUpdates,...seed}=initial;
  const at=new Date().toISOString(),doc=JSON.stringify(applyRecordUpdates(seed,initial));
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO clan_state (id,revision,document,updated_at,updated_by,mutation_id) VALUES (?,1,?,?,NULL,?)').bind('clan',doc,at,'initial-october'),
    db.prepare('INSERT OR IGNORE INTO clan_revisions (revision,document,updated_at,updated_by) SELECT revision,document,updated_at,updated_by FROM clan_state WHERE id = ?').bind('clan'),
  ]);
}

export function isSameOriginWrite(request) {
  return request.headers.get('Origin')===new URL(request.url).origin && request.headers.get('X-Redive-Request')==='1' && /^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||'');
}

export async function handleSharedState(request,env,initial) {
  try {
    if(!env.DB)return json({error:'저장 서버를 준비하고 있습니다.'},503);
    if(!['GET','PUT'].includes(request.method))return json({error:'지원하지 않는 요청입니다.'},405);
    if(request.method==='PUT'&&!isSameOriginWrite(request))return json({error:'허용되지 않은 저장 요청입니다.'},403);
    const user=await identity(request,env);
    if(request.method==='PUT'&&!user.canEdit)return json({error:'관리자 로그인 후 수정할 수 있습니다.'},user.authenticated?403:401);
    await seedOnce(env.DB,initial);
    if(request.method==='GET') {
      const meta=await env.DB.prepare('SELECT revision,updated_at FROM clan_state WHERE id = ?').bind('clan').first();
      const result={revision:meta.revision,updatedAt:meta.updated_at,canEdit:user.canEdit,authenticated:user.authenticated};
      if(new URL(request.url).searchParams.get('since')!==String(meta.revision)) {
        const row=await env.DB.prepare('SELECT revision,updated_at,document FROM clan_state WHERE id = ?').bind('clan').first();
        Object.assign(result,{revision:row.revision,updatedAt:row.updated_at,document:JSON.parse(row.document)});
      }
      return json(result);
    }
    const length=Number(request.headers.get('Content-Length')||0);
    if(length>MAX_BYTES)return json({error:'저장할 자료가 너무 큽니다. 등록한 이미지 크기를 줄여 주세요.'},413);
    const raw=await request.text();
    if(new TextEncoder().encode(raw).length>MAX_BYTES)return json({error:'저장할 자료가 너무 큽니다. 등록한 이미지 크기를 줄여 주세요.'},413);
    let body;try{body=JSON.parse(raw);}catch{return json({error:'저장할 자료 형식을 확인해 주세요.'},400);}
    if(!Number.isSafeInteger(body.revision)||body.revision<1||!validateDocument(body.document))return json({error:'기록·택틱·월별 설정 형식을 확인해 주세요.'},400);
    // Keep the public document free of browser preferences and authentication data.
    const {schema,members,characters,communityLinks,seasons,activeMonth,importedSource}=body.document;
    const existing=await env.DB.prepare('SELECT document FROM clan_state WHERE id = ?').bind('clan').first(),previous=JSON.parse(existing.document);
    const ids=new Set(members.map(m=>m.id)),completeMembers=[...members,...initial.members.filter(m=>!ids.has(m.id))];
    const siteCopy=body.document.siteCopy??previous.siteCopy??{},futureOverrides=body.document.futureOverrides??previous.futureOverrides??{},referenceVersion=initial.referenceVersion||body.document.referenceVersion||previous.referenceVersion;
    const history=body.document.history??previous.history??initial.history??[],awards=body.document.awards??previous.awards??initial.awards??[];
    const document=JSON.stringify({schema,members:completeMembers,characters,history,awards,communityLinks,seasons,activeMonth,importedSource,siteCopy,futureOverrides,referenceVersion});
    const at=new Date().toISOString(),mutation=crypto.randomUUID();
    const results=await env.DB.batch([
      env.DB.prepare('UPDATE clan_state SET revision = revision + 1, document = ?, updated_at = ?, updated_by = ?, mutation_id = ? WHERE id = ? AND revision = ?').bind(document,at,user.userId,mutation,'clan',body.revision),
      env.DB.prepare('INSERT INTO clan_revisions (revision,document,updated_at,updated_by) SELECT revision,document,updated_at,updated_by FROM clan_state WHERE id = ? AND mutation_id = ?').bind('clan',mutation),
    ]);
    if(!results[0].meta?.changes) {
      const meta=await env.DB.prepare('SELECT revision,updated_at FROM clan_state WHERE id = ?').bind('clan').first();
      return json({error:'다른 창에서 먼저 저장한 변경이 있습니다. 최신 자료를 확인해 주세요.',revision:meta.revision,updatedAt:meta.updated_at},409);
    }
    // Retain the fifty most recent complete versions, independently of browser storage.
    try{await env.DB.prepare('DELETE FROM clan_revisions WHERE revision < ?').bind(Math.max(1,body.revision-48)).run();}catch{console.error('Revision cleanup deferred');}
    return json({revision:body.revision+1,updatedAt:at,canEdit:true,authenticated:true});
  } catch(error) {
    console.error('Shared clan store failed',error instanceof Error?error.message:'unknown');
    return json({error:'서버에 연결하지 못했습니다. 변경 내용은 이 기기에 보관됩니다.'},503);
  }
}
