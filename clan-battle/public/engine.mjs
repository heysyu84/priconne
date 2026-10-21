export function phaseForLap(lap, month) {
  return month.levels.find(l => l.count > 0 && lap >= l.start && lap <= l.end)?.stage ?? month.options.startStage ?? 2;
}

export function contribution(event, month) {
  if (!(event.actual > 0)) return Number(event.bonus || 0) * 10000;
  const multiplier = month.bosses.find(b => b.id === event.boss)?.contribution?.[event.stage];
  if (multiplier === null || multiplier === undefined || !Number.isFinite(Number(multiplier))) return NaN;
  // Stage 2/3 source coefficients already include half a hit and the 5% bonus.
  return event.actual * Number(multiplier) + Number(event.bonus || 0) * 10000;
}

export function validateBattleNumbers(month) {
  const activeStages=new Set([phaseForLap(1,month),...month.levels.filter(l=>l.count>0).map(l=>l.stage)]);
  for(const boss of month.bosses){
    for(const [stage,hp] of Object.entries(boss.hp))if(!Number.isSafeInteger(Number(hp))||Number(hp)<0)throw new RangeError(`${boss.id}넴 ${stage}단계 HP는 1 HP 단위의 정수로 입력하세요.`);
    for(const stage of activeStages)if(!(Number(boss.hp[stage])>0))throw new RangeError(`${boss.id}넴 ${stage}단계 최대 HP를 입력하세요.`);
  }
  for(const e of month.events)if(!Number.isSafeInteger(Number(e.damage))||Number(e.damage)<0)throw new RangeError(`#${e.seq} 피해량은 1 단위의 정수로 입력하세요.`);
}

export function replayMonth(month) {
  validateBattleNumbers(month);
  const bossState = new Map(month.bosses.map(b => [b.id, { lap: 1, hp: Number(b.hp[phaseForLap(1, month)]) }]));
  const people = new Map();
  const warnings = [];
  month.events.sort((a, b) => a.seq - b.seq);
  if(Array.isArray(month.dayBreaks))for(const e of month.events){e.day=1;for(const boundary of [...month.dayBreaks].sort((a,b)=>a.afterSeq-b.afterSeq))if(e.seq>boundary.afterSeq)e.day=boundary.nextDay;}
  for (const e of month.events) {
    const boss = month.bosses.find(b => b.id === Number(e.boss));
    const status = bossState.get(Number(e.boss));
    if (!boss || !status) { warnings.push({ id: e.id, message: "보스 설정을 확인하세요." }); continue; }
    if (status.hp === 0) { status.lap++; status.hp = Number(boss.hp[phaseForLap(status.lap, month)]); }
    e.stage = phaseForLap(status.lap, month);
    e.lap = status.lap;
    e.before = status.hp;
    if(e.damageMode==='max'&&[2,3].includes(e.stage))e.damage=Number(boss.hp[e.stage]);
    e.damage = Number(e.damage);
    e.actual = Math.min(e.damage, status.hp);
    e.after = Math.max(0, status.hp - e.damage);
    e.kill = status.hp > 0 && e.after === 0;
    status.hp = e.after;
    const key = `${e.day}:${e.memberId || e.member}`;
    if (!people.has(key)) people.set(key, { shots: 0, carries: [] });
    const person = people.get(key);
    e.killIndex = -1;
    e.carryIndex = -1;
    if (e.carry) {
      e.hitIndex = 0;
      const source = person.carries.shift();
      e.carryIndex = source?.hitIndex ?? 0;
      e.carryFrom = source?.id ?? null;
      if (!source) warnings.push({ id: e.id, message: "연결할 일반 공격의 격파 기록이 없습니다." });
      const original=month.events.find(row=>row.id===e.carryFrom);
      e.role=original&&[2,3].includes(original.stage)&&e.stage===4?'초월':e.kill?'관통':'이월타';
      if(original)original.role=e.role==='초월'?'초월 준비':e.role==='관통'?'관통 시작':'이월 생성';
    } else {
      e.role=e.kill?'이월 생성':'일반';
      e.hitIndex = ++person.shots;
      if (e.kill) { e.killIndex = e.hitIndex; person.carries.push({ id: e.id, hitIndex: e.hitIndex }); }
      if (person.shots > Number(month.options.dailyAttacks || 3)) warnings.push({ id: e.id, message: "일일 기본 타수를 초과했습니다." });
    }
  }
  if (month.options.autoContribution) {
    const n = Number(month.options.contributionSamples || 10);
    const factor = Number(month.options.contributionFactor || 0.95);
    const base = Number(month.options.contributionBaseline || 30000000);
    for (const b of month.bosses) {
      const values = month.events.filter(e => e.boss === b.id && e.stage === 4 && e.damage > 0).map(e => Math.floor(e.damage / 10000)).sort((a, b) => b - a).slice(0, n);
      b.contributionSampleCount = values.length;
      const mean=values.length?values.reduce((s,x)=>s+x,0)/values.length*10000:0;
      b.contribution[4]=mean>0?base/(mean*factor):null;
    }
  }
  return warnings;
}

export function bossProgress(month) {
  return month.bosses.map(boss=>{
    const records=month.events.filter(e=>Number(e.boss)===boss.id).sort((a,b)=>a.seq-b.seq);
    const last=records.at(-1);let lap=last?.lap||1,stage=last?.stage||phaseForLap(lap,month),hp=Number(last?.after??boss.hp[stage]);
    if(last&&last.after===0){lap++;stage=phaseForLap(lap,month);hp=Number(boss.hp[stage]);}
    return {...boss,lap,stage,hp,max:Number(boss.hp[stage]),count:records.length};
  });
}

export function estimateCarry({ hp, first = 0, second, seconds = 90, base = 90, bonus = 20, cap = 90 }) {
  if (![hp, first, second, seconds, base, bonus, cap].every(Number.isSafeInteger) || hp <= 0 || first < 0 || second <= 0 || seconds <= 0 || base<=0 || bonus<0 || cap<=0) return { error: "HP·피해량은 1 단위 정수로, 전투시간은 초 단위로 입력하세요." };
  const remaining = hp - first;
  if (remaining <= 0) return { error: "선통만으로 격파됩니다. 후통의 이월 계산 대상이 아닙니다." };
  if (second < remaining) return { error: "두 공격의 피해량이 부족해 격파되지 않습니다." };
  const numerator=(BigInt(base)+BigInt(bonus))*BigInt(second)-BigInt(seconds)*BigInt(remaining),denominator=BigInt(second);
  const raw=Number(numerator>=0n?(numerator+denominator-1n)/denominator:numerator/denominator);
  return { seconds: raw <= bonus ? 0 : Math.min(cap, raw) };
}

export function shiftTimeline(text, remaining, base = 90) {
  const delta = base - remaining;
  return String(text).split("\n").map(line => line.replace(/\b(\d{1,2}):(\d{2})\b/g, (full, m, s) => {
    const original = Number(m) * 60 + Number(s);
    if (original > 130) return full;
    const time = original - delta;
    return time > 0 ? `${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}` : "—";
  })).join("\n");
}
