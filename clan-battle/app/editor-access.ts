import { env } from "cloudflare:workers";

const COOKIE = "nyang_editor";
const hex = (bytes: ArrayBuffer | Uint8Array) => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
const digest = async (value: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
async function hash(pin: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100000, hash: "SHA-256" }, key, 256));
}
export async function accessDB() {
  const db = env.DB!;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS editor_config (id TEXT PRIMARY KEY, salt TEXT NOT NULL, pin_hash TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS editor_sessions (token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS editor_attempts (id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL)"),
  ]);
  const row = await db.prepare("SELECT id FROM editor_config WHERE id='main'").first();
  if (!row) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    await db.prepare("INSERT OR IGNORE INTO editor_config(id,salt,pin_hash) VALUES('main',?,?)").bind(salt, await hash("1122", salt)).run();
  }
  return db;
}
export async function hasEditor(request: Request) {
  const token = (request.headers.get("cookie") || "").split(";").map(s => s.trim()).find(s => s.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const db = await accessDB();
  const session = await db.prepare("SELECT expires FROM editor_sessions WHERE token_hash=?").bind(await digest(token)).first<{ expires: number }>();
  return !!session && session.expires > Date.now();
}
export async function editorAction(request: Request) {
  const origin = request.headers.get("origin");
  const headers: Record<string,string> = { "cache-control": "no-store" };
  if (origin && origin !== new URL(request.url).origin) return Response.json({error:"허용되지 않은 요청입니다."},{status:403,headers});
  const db = await accessDB(), data = await request.json() as { action?: string; pin?: string; newPin?: string };
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const cookie = (token: string, age: number) => `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure}`;
  if (data.action === "lock") {
    const token = (request.headers.get("cookie") || "").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="))?.slice(COOKIE.length+1);
    if (token) await db.prepare("DELETE FROM editor_sessions WHERE token_hash=?").bind(await digest(token)).run();
    return Response.json({editor:false},{headers:{...headers,"set-cookie":cookie("",0)}});
  }
  const identity = request.headers.get("cf-connecting-ip") || request.headers.get("oai-authenticated-user-id") || "site";
  const attemptID = await digest(identity), now = Date.now();
  const attempt = await db.prepare("SELECT attempts,reset_at FROM editor_attempts WHERE id=?").bind(attemptID).first<{attempts:number;reset_at:number}>();
  if (attempt && attempt.reset_at > now && attempt.attempts >= 10) return Response.json({error:"입력이 여러 번 틀렸습니다. 5분 뒤 다시 시도하세요."},{status:429,headers});
  const config = await db.prepare("SELECT salt,pin_hash FROM editor_config WHERE id='main'").first<{salt:string;pin_hash:string}>();
  const actual = typeof data.pin === "string" && data.pin.length <= 80 ? await hash(data.pin,config!.salt) : "";
  let mismatch = actual.length ^ config!.pin_hash.length;
  for (let i=0;i<config!.pin_hash.length;i++) mismatch |= (actual.charCodeAt(i)||0)^config!.pin_hash.charCodeAt(i);
  if (mismatch) {
    await db.prepare("INSERT INTO editor_attempts(id,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN reset_at>? THEN attempts+1 ELSE 1 END,reset_at=CASE WHEN reset_at>? THEN reset_at ELSE ? END").bind(attemptID,now+300000,now,now,now+300000).run();
    return Response.json({error:"작성 비밀번호가 맞지 않습니다."},{status:403,headers});
  }
  if (data.action === "change") {
    if (!(await hasEditor(request))) return Response.json({error:"작성 잠금을 먼저 해제하세요."},{status:403,headers});
    if (typeof data.newPin!=="string" || data.newPin.length<4 || data.newPin.length>80) return Response.json({error:"새 비밀번호는 4~80자로 입력하세요."},{status:400,headers});
    const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
    await db.batch([db.prepare("UPDATE editor_config SET salt=?,pin_hash=? WHERE id='main'").bind(salt,await hash(data.newPin,salt)),db.prepare("DELETE FROM editor_sessions")]);
  }
  await db.batch([db.prepare("DELETE FROM editor_attempts WHERE id=?").bind(attemptID),db.prepare("DELETE FROM editor_sessions WHERE expires<?").bind(now)]);
  const token=hex(crypto.getRandomValues(new Uint8Array(32)));
  await db.prepare("INSERT INTO editor_sessions(token_hash,expires) VALUES(?,?)").bind(await digest(token),now+43200000).run();
  return Response.json({editor:true},{headers:{...headers,"set-cookie":cookie(token,43200)}});
}
