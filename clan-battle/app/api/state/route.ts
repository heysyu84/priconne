import { env } from "cloudflare:workers";
import { validateBattleNumbers } from "../../../public/engine.mjs";
import { hasEditor } from "../../editor-access";

import { allowedOrigin, apiHeaders, preflight } from "../../api-access";
type StateRow = { revision: number; payload: string; updated_at: string };

export async function GET(request: Request) {
  const headers = apiHeaders(request);
  if (!allowedOrigin(request)) return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403, headers });
  try {
    const since = new URL(request.url).searchParams.get("since");
    if(since !== null && /^\d+$/.test(since)){
      const known = await env.DB!.prepare("SELECT revision FROM clan_state WHERE id = ?").bind("main").first<Pick<StateRow, "revision">>();
      const knownRevision = known?.revision ?? 0;
      if(knownRevision === Number(since))return Response.json({ revision:knownRevision, changed:false }, { headers });
    }
    const row = await env.DB!.prepare("SELECT revision, payload, updated_at FROM clan_state WHERE id = ?").bind("main").first<StateRow>();
    return Response.json({ revision: row?.revision ?? 0, data: row ? JSON.parse(row.payload) : null, updatedAt: row?.updated_at ?? null }, { headers });
  } catch {
    return Response.json({ error: "저장된 데이터를 불러오지 못했습니다. 잠시 후 다시 연결해 주세요." }, { status: 503, headers });
  }
}

export async function PUT(request: Request) {
  const headers = apiHeaders(request);
  if (!allowedOrigin(request)) return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403, headers });
  try {
    if (request.headers.get("x-nyang-client") !== "4") return Response.json({ error: "입력 화면이 업데이트되었습니다. 필요한 경우 JSON 백업 후 페이지를 새로고침해 주세요.", conflict: true }, { status: 409, headers });
    if (!(await hasEditor(request))) return Response.json({ error: "작성 비밀번호로 잠금을 해제해야 수정할 수 있습니다." }, {status:403,headers});
    const text = await request.text();
    if (text.length > 1_800_000) return Response.json({ error: "데이터 크기가 저장 한도를 넘었습니다. 먼저 JSON 백업을 저장해 주세요." }, { status: 413, headers });
    const body = JSON.parse(text);
    if (!Number.isSafeInteger(body.revision) || body.revision < 0 || !body.data?.months || !body.data.months[body.data.active]) return Response.json({ error: "저장 데이터 형식이 올바르지 않습니다." }, { status: 400, headers });
    try { for (const month of Object.values(body.data.months)) validateBattleNumbers(month); }
    catch (error) { return Response.json({ error: error instanceof RangeError ? error.message : "월별 보스 HP와 공격 기록 형식을 확인하세요." }, { status: 400, headers }); }
    const roster = body.data.roster;
    if (!Array.isArray(roster) || roster.filter((p: { status: string }) => p.status === "active").length > 30) return Response.json({ error: "재적 클랜원은 최대 30명입니다." }, { status: 400, headers });
    const ids = new Set<string>(), uids = new Set<string>();
    for (const p of roster) {
      if (typeof p.id !== "string" || !p.id || ids.has(p.id) || typeof p.name !== "string" || !p.name.trim() || typeof p.uid !== "string" || (p.uid && (!/^\d+$/.test(p.uid) || uids.has(p.uid))) || !["active", "left"].includes(p.status)) return Response.json({ error: "클랜원 이름·UID·상태를 확인하세요. 중복 UID는 등록할 수 없습니다." }, { status: 400, headers });
      ids.add(p.id); if (p.uid) uids.add(p.uid);
    }
    const payload = JSON.stringify(body.data);
    const revision = body.revision + 1;
    const now = new Date().toISOString();
    const write = body.revision === 0
      ? env.DB!.prepare("INSERT INTO clan_state (id, revision, payload, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING").bind("main", revision, payload, now)
      : env.DB!.prepare("UPDATE clan_state SET revision = ?, payload = ?, updated_at = ? WHERE id = ? AND revision = ?").bind(revision, payload, now, "main", body.revision);
    const result = await env.DB!.batch([
      write,
      env.DB!.prepare("INSERT OR IGNORE INTO clan_revisions (revision, payload, created_at) SELECT revision, payload, updated_at FROM clan_state WHERE id = ? AND revision = ?").bind("main", revision),
      env.DB!.prepare("DELETE FROM clan_revisions WHERE revision NOT IN (SELECT revision FROM clan_revisions ORDER BY revision DESC LIMIT 20)"),
    ]);
    if (!result[0].meta.changes) return Response.json({ error: "다른 창이나 기기에서 먼저 수정했습니다. 백업을 내려받은 뒤 최신 데이터를 불러와 주세요.", conflict: true }, { status: 409, headers });
    return Response.json({ revision, updatedAt: now }, { headers });
  } catch {
    return Response.json({ error: "서버에 저장하지 못했습니다. 현재 창을 유지하고 다시 저장해 주세요." }, { status: 503, headers });
  }
}

export function OPTIONS(request: Request) { return preflight(request, ["GET", "PUT"]); }
