import { contribution } from './engine.mjs?v=20261022-ui14';

export function summarizeArchive(month, roster = [], result = {}) {
  // Historical sheets already contain finalized leaderboards. Their exact
  // contribution and in-game totals take precedence over later rule changes.
  if (Array.isArray(month.sourceRankings) && month.sourceRankings.length) {
    const rows = month.sourceRankings.map(p => ({
      id: 'archive:' + p.name,
      name: p.name,
      damage: Number(p.damage) || 0,
      contribution: Number(p.contribution) || 0,
      game: Number(p.game) || 0,
    }));
    return {
      rows,
      damage: (month.events || []).reduce((sum, e) => sum + (Number(e.actual) || 0), 0),
      game: rows.reduce((sum, p) => sum + p.game, 0),
      clanRank: Number(result.clanRank) > 0 ? Number(result.clanRank) : null,
      memberCount: Number(result.memberCount) > 0 ? Number(result.memberCount) : rows.length,
    };
  }
  const people = new Map(), names = new Map();
  const add = (id, name) => {
    const key = id || 'name:' + name;
    if (!people.has(key)) people.set(key, { id: key, name: name || '—', damage: 0, contribution: 0, game: 0 });
    if (name) names.set(name, key);
    return people.get(key);
  };
  const ids = month.memberIds || [], members = month.members || [];
  for (let i = 0; i < Math.max(ids.length, members.length); i++) {
    add(ids[i], members[i] || roster.find(p => p.id === ids[i])?.name);
  }
  for (const event of month.events || []) {
    const name = event.member || roster.find(p => p.id === event.memberId)?.name || '—';
    const person = people.get(event.memberId) || people.get(names.get(name)) || add(event.memberId, name);
    const damage = Number(event.actual ?? event.damage ?? 0);
    person.damage += damage;
    person.contribution += contribution(event, month);
    person.game += damage * Number(month.bosses?.find(b => Number(b.id) === Number(event.boss))?.game?.[event.stage] || 0);
  }
  const rows = [...people.values()];
  return {
    rows,
    damage: rows.reduce((sum, p) => sum + p.damage, 0),
    game: rows.reduce((sum, p) => sum + p.game, 0),
    clanRank: Number(result.clanRank) > 0 ? Number(result.clanRank) : null,
    memberCount: Number(result.memberCount) > 0 ? Number(result.memberCount) : rows.length,
  };
}

export function sortArchiveRankings(rows, metric = 'contribution') {
  const key = ['damage', 'contribution', 'game'].includes(metric) ? metric : 'contribution';
  return [...rows].sort((a, b) => {
    const av = Number.isFinite(a[key]) ? a[key] : -Infinity;
    const bv = Number.isFinite(b[key]) ? b[key] : -Infinity;
    return (av === bv ? 0 : bv - av) || b.damage - a.damage || a.name.localeCompare(b.name, 'ko');
  });
}
