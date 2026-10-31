import {env} from "cloudflare:workers";
import {allowedOrigin, apiJSON, preflight} from "../../api-access";

// Keep active browsers counted across 60-second heartbeats with network/scheduling jitter.
export const PRESENCE_TTL_MS = 150_000;

async function countOnline(now: number) {
  const row = await env.DB!.prepare("SELECT COUNT(*) AS online FROM clan_presence WHERE last_seen > ?")
    .bind(now - PRESENCE_TTL_MS).first<{online: number}>();
  return Number(row?.online || 0);
}

export async function GET(request: Request) {
  if (!allowedOrigin(request)) return apiJSON(request, {error:"허용되지 않은 요청입니다."}, {status:403});
  try { return apiJSON(request, {online:await countOnline(Date.now())}); }
  catch { return apiJSON(request, {error:"접속 인원을 확인하지 못했습니다."}, {status:503}); }
}

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return apiJSON(request, {error:"허용되지 않은 요청입니다."}, {status:403});
  if (Number(request.headers.get("content-length") || 0) > 256) return apiJSON(request, {error:"요청이 너무 큽니다."}, {status:413});
  let browserId: unknown;
  try {
    const text = await request.text();
    if (text.length > 256) return apiJSON(request, {error:"요청이 너무 큽니다."}, {status:413});
    browserId = JSON.parse(text).browserId;
  } catch { return apiJSON(request, {error:"접속 요청을 확인하세요."}, {status:400}); }
  if (typeof browserId !== "string" || !/^[a-f0-9]{32}$/.test(browserId)) return apiJSON(request, {error:"접속 요청을 확인하세요."}, {status:400});
  try {
    const now = Date.now();
    await env.DB!.batch([
      env.DB!.prepare("INSERT INTO clan_presence (browser_id,last_seen) VALUES (?,?) ON CONFLICT(browser_id) DO UPDATE SET last_seen=excluded.last_seen").bind(browserId, now),
      env.DB!.prepare("DELETE FROM clan_presence WHERE last_seen <= ?").bind(now - PRESENCE_TTL_MS),
    ]);
    return apiJSON(request, {online:await countOnline(now)});
  } catch { return apiJSON(request, {error:"접속 인원을 확인하지 못했습니다."}, {status:503}); }
}

export function OPTIONS(request: Request) { return preflight(request, ["GET", "POST"]); }
