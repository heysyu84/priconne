export const MAX_ACTIVE = 30;
export const makeId = () => globalThis.crypto?.randomUUID?.() || `member-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clean = value => String(value ?? '').normalize('NFC').trim();
export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

export function memberLabel(member, roster) {
  if (!member) return '미등록';
  return roster.filter(p => p.name === member.name).length > 1 ? `${member.name} (${member.uid || member.id.slice(-5)})` : member.name;
}

export function syncRoster(app) {
  const people = new Map(app.roster.map(p => [p.id, p]));
  for (const month of Object.values(app.months)) {
    month.memberIds = [...new Set(month.memberIds || [])];
    month.members = month.memberIds.map(id => memberLabel(people.get(id), app.roster));
    for (const event of month.events) {
      const member = people.get(event.memberId);
      if (member) event.member = memberLabel(member, app.roster);
    }
  }
}

export function ensureRoster(app, seed = []) {
  let changed = !Array.isArray(app.roster) || Number(app.version || 0) < 2;
  const latest = Object.keys(app.months).sort().at(-1);
  const currentNames = new Set(app.months[latest]?.members || []);
  if (!Array.isArray(app.roster)) app.roster = [];
  const findName = name => app.roster.find(p => p.name === name || p.aliases?.includes(name));
  const getOrCreate = name => {
    name = clean(name);
    let person = findName(name);
    if (person) return person;
    const known = seed.find(p => p.name === name);
    person = { id: makeId(), name, uid: String(known?.uid || ''), status: currentNames.has(name) ? 'active' : 'left', joinedAt: '', leftAt: '', aliases: [], memo: '' };
    app.roster.push(person); changed = true;
    return person;
  };
  for (const [key, month] of Object.entries(app.months).sort()) {
    if (!Array.isArray(month.memberIds)) { month.memberIds = (month.members || []).map(n => getOrCreate(n).id); changed = true; }
    if (!month.membership) { month.membership = {}; changed = true; }
    for (const event of month.events) {
      if (!event.memberId) { event.memberId = getOrCreate(event.member || '미등록').id; changed = true; }
      if (event.recordedName === undefined) event.recordedName = event.member;
      if (!month.memberIds.includes(event.memberId)) month.memberIds.push(event.memberId);
    }
    for (const id of month.memberIds) if (!month.membership[id]) month.membership[id] = { fromDay: 1, toDay: null };
  }
  app.version = 2;
  syncRoster(app);
  return changed;
}

export function validateMember(app, record, id = null) {
  const name = clean(record.name), uid = clean(record.uid);
  if (!name) return '닉네임을 입력하세요.';
  if (uid && !/^\d+$/.test(uid)) return 'UID는 숫자로 입력하세요. 앞의 0도 그대로 보관합니다.';
  if (uid && app.roster.some(p => p.id !== id && p.uid === uid)) return '이미 등록된 UID입니다. 기존 클랜원의 정보를 수정하거나 복귀 처리해 주세요.';
  if (!uid && app.roster.some(p => p.id !== id && p.name === name)) return '같은 닉네임이 있습니다. UID를 입력해 구분해 주세요.';
  if (record.status !== 'left' && app.roster.filter(p => p.status === 'active' && p.id !== id).length >= MAX_ACTIVE) return '재적 클랜원은 최대 30명입니다. 탈퇴한 사람을 먼저 탈퇴 처리해 주세요.';
  return null;
}

export function upsertMember(app, record, monthKey, fromDay = 1, toDay = null) {
  const error = validateMember(app, record, record.id);
  if (error) throw Error(error);
  const month = app.months[monthKey];
  const existing = app.roster.find(p => p.id === record.id);
  const first = Number(fromDay);
  const last = record.status === 'left' ? Number(toDay ?? month.options.days ?? 5) : null;
  if (!Number.isInteger(first) || first < 1 || first > Number(month.options.days) || (last !== null && (!Number.isInteger(last) || last < first || last > Number(month.options.days)))) throw Error('참가 일차는 개최 기간 안에서 가입 일차부터 탈퇴 일차 순으로 입력하세요.');
  const person = existing || { id: makeId(), aliases: [] };
  const name = clean(record.name);
  if (existing && person.name !== name) person.aliases = [...new Set([...(person.aliases || []), person.name])];
  Object.assign(person, { name, uid: clean(record.uid), status: record.status === 'left' ? 'left' : 'active', joinedAt: clean(record.joinedAt), leftAt: record.status === 'left' ? clean(record.leftAt) : '', memo: clean(record.memo) });
  if (!existing) app.roster.push(person);
  month.membership ||= {};
  month.membership[person.id] = { fromDay: Number(fromDay), toDay: last };
  if (!month.memberIds.includes(person.id)) month.memberIds.push(person.id);
  syncRoster(app);
  return person;
}

const INITIALS = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
export function initials(text) {
  return [...clean(text)].map(c => { const n = c.charCodeAt(0) - 0xac00; return n >= 0 && n <= 11171 ? INITIALS[Math.floor(n / 588)] : c; }).join('');
}

// Match Korean names typed on an English two-beolsik keyboard without changing the entered text.
const KEY_INITIALS=['r','R','s','e','E','f','a','q','Q','t','T','d','w','W','c','z','x','v','g'];
const KEY_VOWELS=['k','o','i','O','j','p','u','P','h','hk','ho','hl','y','n','nj','np','nl','b','m','ml','l'];
const KEY_FINALS=['','r','R','rt','s','sw','sg','e','f','fr','fa','fq','ft','fx','fv','fg','a','q','qt','t','T','d','w','c','z','x','v','g'];
function keyboardKeys(text){
  return [...String(text??'').normalize('NFC')].map(char=>{
    const n=char.charCodeAt(0)-0xac00;
    if(n>=0&&n<=11171)return KEY_INITIALS[Math.floor(n/588)]+KEY_VOWELS[Math.floor(n%588/28)]+KEY_FINALS[n%28];
    const initial=INITIALS.indexOf(char);
    return initial>=0?KEY_INITIALS[initial]:char;
  }).join('').toLowerCase();
}

export function matchMembers(members, query) {
  const q = clean(query).toLowerCase();
  if (!q) return members;
  const rank = p => {
    const name = p.name.toLowerCase();
    if (name === q || p.uid === q) return 0;
    if (name.startsWith(q)) return 1;
    if (initials(name).startsWith(q)) return 2;
    if ([name, p.uid, initials(name), ...(p.aliases || [])].some(s => String(s).toLowerCase().includes(q))) return 3;
    if (/^[a-z0-9 _-]+$/i.test(q) && /[a-z]/i.test(q)) {
      const keys=keyboardKeys(p.name),initialKeys=keyboardKeys(initials(p.name));
      if(keys===q)return 4;
      if(keys.startsWith(q))return 5;
      if(initialKeys.startsWith(q))return 6;
      if([keys,initialKeys,...(p.aliases||[]).map(keyboardKeys)].some(s=>s.includes(q)))return 7;
    }
    return 99;
  };
  return members.map((p, i) => ({ p, rank: rank(p), i })).filter(x => x.rank < 99).sort((a, b) => a.rank - b.rank || a.i - b.i).map(x => x.p);
}

export function parseDamage(text) {
  const value=clean(text).replace(/[,\s]/g, '');
  if(value.length>80)return NaN;
  const m = value.match(/^(\d+(?:\.\d+)?)(만|억)?$/);
  if (!m) return NaN;
  const [whole,fraction='']=m[1].split('.');
  const numerator=BigInt(whole+fraction)*({'만':10000n,'억':100000000n}[m[2]]||1n);
  const denominator=10n**BigInt(fraction.length);
  if(numerator%denominator!==0n)return NaN;
  const result=numerator/denominator;
  return result<=BigInt(Number.MAX_SAFE_INTEGER)?Number(result):NaN;
}
