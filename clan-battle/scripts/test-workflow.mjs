import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ensureRoster, upsertMember, syncRoster, matchMembers, parseDamage, memberLabel } from '../public/roster.mjs';
import { replayMonth } from '../public/engine.mjs';

const html = fs.readFileSync(new URL('../public/clan-shell.html', import.meta.url), 'utf8');
const seed = JSON.parse(html.match(/<script id="seed-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const app = structuredClone(seed);
const original = structuredClone(app.months['2026-09'].events);
const baseline = structuredClone(app.months['2026-09']); replayMonth(baseline);
assert.equal(original.length, 454);
assert.equal(ensureRoster(app, seed.rosterSeed), true);
assert.equal(app.roster.length, 22);
assert.equal(app.roster.filter(p => p.uid).length, 22);
assert.equal(new Set(app.roster.map(p => p.uid)).size, 22);
for (const month of Object.values(app.months)) replayMonth(month);
for (const source of original) {
  const migrated = app.months['2026-09'].events.find(e => e.id === source.id);
  for (const key of ['member', 'damage', 'actual', 'before', 'after', 'kill', 'stage', 'lap']) assert.equal(migrated[key], source[key], `${source.id}: ${key}`);
  for (const key of ['carryFrom', 'carryIndex', 'hitIndex']) assert.equal(migrated[key], baseline.events.find(e=>e.id===source.id)[key], `${source.id}: ${key}`);
  assert.equal(migrated.recordedName, source.member);
  assert.ok(migrated.memberId);
}
assert.equal(ensureRoster(app, seed.rosterSeed), false);

const first = app.roster[0];
const oldName = first.name, firstId = first.id;
const linked = Object.values(app.months).flatMap(m => m.events).filter(e => e.memberId === firstId);
assert.ok(linked.length);
const totalsBefore = linked.reduce((s, e) => s + e.actual, 0);
upsertMember(app, { ...first, name: '변경한이름', uid: '001234567890' }, '2026-10', 2);
assert.equal(first.id, firstId);
assert.equal(first.uid, '001234567890');
assert.ok(first.aliases.includes(oldName));
assert.ok(linked.every(e => e.member === '변경한이름' && e.recordedName === oldName));
assert.equal(linked.reduce((s, e) => s + e.actual, 0), totalsBefore);
assert.equal(app.months['2026-10'].membership[firstId].fromDay, 2);
assert.equal(matchMembers(app.roster, oldName)[0].id, firstId);
assert.equal(matchMembers(app.roster, 'ㅂㄱ')[0].id, firstId);
assert.equal(matchMembers(app.roster, '001234')[0].id, firstId);

const saved = JSON.stringify(app);
assert.throws(() => upsertMember(app, { name: '중복 UID', uid: first.uid, status: 'active' }, '2026-10', 1), /이미 등록된 UID/);
assert.equal(JSON.stringify(app), saved);
assert.throws(() => upsertMember(app, { ...first, status: 'left' }, '2026-10', 4, 2), /참가 일차/);
// Retirement/reactivation keeps the same account and all of its historical events.
upsertMember(app, { ...first, status: 'left', leftAt: '2026-10-21' }, '2026-10', 2, 3);
assert.equal(first.status, 'left');
assert.equal(app.months['2026-10'].membership[firstId].toDay, 3);
assert.equal(linked.length, Object.values(app.months).flatMap(m => m.events).filter(e => e.memberId === firstId).length);
upsertMember(app, { ...first, status: 'active' }, '2026-10', 2);
assert.equal(first.id, firstId);
assert.equal(first.leftAt, '');
assert.equal(app.months['2026-10'].membership[firstId].toDay, null);

while (app.roster.filter(p => p.status === 'active').length < 30) upsertMember(app, { name: `추가${app.roster.length}`, uid: `7777${app.roster.length}`, status: 'active' }, '2026-10', 1);
assert.equal(app.roster.filter(p => p.status === 'active').length, 30);
const full = JSON.stringify(app);
assert.throws(() => upsertMember(app, { name: '31번째', uid: '999999999999', status: 'active' }, '2026-10', 1), /최대 30명/);
assert.equal(JSON.stringify(app), full);
upsertMember(app, { name: '탈퇴 계정', uid: '777777777777', status: 'left' }, '2026-10', 1, 1);
const retired = app.roster.at(-1);
assert.throws(() => upsertMember(app, { ...retired, status: 'active' }, '2026-10', 1), /최대 30명/);
upsertMember(app, { ...first, memo: '30명일 때 기존 정보 수정 가능' }, '2026-10', 2);

for (const [input, result] of [['1,200,000', 1200000], ['1.2억', 120000000], ['3,500만', 35000000], [' 1.5 만 ', 15000], ['0', 0]]) assert.equal(parseDamage(input), result);
for (const input of ['', '-1', 'NaN', '1억2만', 'Infinity']) assert.ok(Number.isNaN(parseDamage(input)));

// Stable account IDs connect a carry attack even if its display name changed.
const sample = structuredClone(seed.months['2026-10']);
sample.options.autoContribution = false;
const hp = sample.bosses[0].hp[sample.options.startStage];
sample.events = [
  { id: 'kill', seq: 1, day: 1, memberId: firstId, member: oldName, boss: 1, damage: hp, carry: false },
  { id: 'carry', seq: 2, day: 1, memberId: firstId, member: first.name, boss: 1, damage: 100, carry: true },
];
replayMonth(sample);
assert.equal(sample.events[1].carryFrom, 'kill');
assert.equal(sample.events[1].carryIndex, 1);
// Duplicate nicknames are distinguished, and an existing deliberately empty UID stays empty.
const duplicate = { ...first, id: 'other', uid: '101010101010' };
assert.notEqual(memberLabel(first, [first, duplicate]), memberLabel(duplicate, [first, duplicate]));
first.uid = '';
ensureRoster(app, seed.rosterSeed); syncRoster(app);
assert.equal(first.uid, '');
console.log('PASS: 454 original attacks, UID migration, stable identities, roster limits, search, damage parsing, carry links');
