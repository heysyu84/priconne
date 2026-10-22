import {findCharacter, normalizeCharacterName} from './character-portraits.mjs?v=20261022-ui14';

export function characterKey(name, catalog = []) {
  return normalizeCharacterName(findCharacter(catalog, name)?.name || name);
}

export function expectedDamage(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const number = Number(text.replace(/억\s*$/, '').trim());
  return Number.isFinite(number) && number > 0 ? number : null;
}

// Each team can borrow at most one unit. For every shared character, choose
// one team that uses its own copy; the remaining teams must borrow that unit.
// Searching all owners avoids the incorrect greedy result for overlap cycles.
export function assignSupports(parties) {
  if (parties.some(keys => keys.length !== 5 || keys.some(key => !key) || new Set(keys).size !== 5)) return null;
  const occurrences = new Map();
  parties.forEach((keys, team) => keys.forEach(key => {
    if (!occurrences.has(key)) occurrences.set(key, []);
    occurrences.get(key).push(team);
  }));
  const shared = [...occurrences].filter(([, teams]) => teams.length > 1)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const borrowCount = shared.reduce((sum, [, teams]) => sum + teams.length - 1, 0);
  if (borrowCount > parties.length) return null;
  const supports = Array(parties.length).fill(null);
  function visit(index) {
    if (index === shared.length) return supports.slice();
    const [key, teams] = shared[index];
    for (const owner of teams) {
      const borrowers = teams.filter(team => team !== owner);
      if (borrowers.some(team => supports[team] !== null)) continue;
      borrowers.forEach(team => { supports[team] = key; });
      const found = visit(index + 1);
      borrowers.forEach(team => { supports[team] = null; });
      if (found) return found;
    }
    return null;
  }
  const result = visit(0);
  return result ? {supports: result, borrowCount} : null;
}

const manualCount = combo => {
  const value = String(combo.manualCount ?? '').trim();
  return value && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : Infinity;
};
const comparePlans = (a, b) => b.totalDamage - a.totalDamage || a.borrowCount - b.borrowCount
  || (a.manualCount === b.manualCount ? 0 : a.manualCount < b.manualCount ? -1 : 1)
  || a.key.localeCompare(b.key);

// Keep the strongest feasible plan for each boss combination. All candidate
// parties remain eligible; no arbitrary top-N candidate cutoff hides a result.
export function planThreeAttacks(recommendations, catalog = [], options = {}) {
  const {bossIds, distinctBosses = true, limit = 5} = options;
  const allowedBosses = bossIds ? new Set(bossIds.map(Number)) : null;
  const parties = new Map();
  let skippedCount = 0;
  for (const [index, combo] of (recommendations || []).entries()) {
    if (Number(combo.stage) !== 4 || (allowedBosses && !allowedBosses.has(Number(combo.boss)))) continue;
    const damage = expectedDamage(combo.expectedDamage);
    const keys = (combo.characters || []).map(name => characterKey(name, catalog));
    if (damage === null || !Number.isInteger(Number(combo.boss)) || Number(combo.boss) < 1
      || keys.length !== 5 || keys.some(key => !key) || new Set(keys).size !== 5) { skippedCount++; continue; }
    const identity = Number(combo.boss) + ':' + [...keys].sort().join('\u0001');
    const candidate = {combo, keys, keySet: new Set(keys), damage, boss: Number(combo.boss),
      manualCount: manualCount(combo), id: String(combo.id || 'combo-' + index)};
    const previous = parties.get(identity);
    if (!previous || damage > previous.damage || (damage === previous.damage && candidate.manualCount < previous.manualCount)) parties.set(identity, candidate);
  }
  const candidates = [...parties.values()].sort((a, b) => b.damage - a.damage || a.id.localeCompare(b.id));
  const routes = new Map(), n = candidates.length, pairOK = new Uint8Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (distinctBosses && candidates[i].boss === candidates[j].boss) continue;
    if (candidates[i].keys.filter(key => candidates[j].keySet.has(key)).length <= 2) pairOK[i * n + j] = 1;
  }
  let cutoff = -Infinity;
  function keep(plan) {
    const previous = routes.get(plan.route);
    if (previous && comparePlans(plan, previous) >= 0) return;
    routes.set(plan.route, plan);
    const ranked = [...routes.values()].sort(comparePlans);
    if (ranked.length >= limit) cutoff = ranked[limit - 1].totalDamage;
  }
  for (let i = 0; i < n - 2; i++) {
    if (candidates[i].damage + candidates[i + 1].damage + candidates[i + 2].damage < cutoff - 1e-9) break;
    for (let j = i + 1; j < n - 1; j++) {
      if (!pairOK[i * n + j]) continue;
      if (candidates[i].damage + candidates[j].damage + candidates[j + 1].damage < cutoff - 1e-9) break;
      for (let k = j + 1; k < n; k++) {
        const totalDamage = Number((candidates[i].damage + candidates[j].damage + candidates[k].damage).toFixed(6));
        if (totalDamage < cutoff - 1e-9) break;
        if (!pairOK[i * n + k] || !pairOK[j * n + k]) continue;
        const ordered = [candidates[i], candidates[j], candidates[k]].sort((a, b) => a.boss - b.boss || a.id.localeCompare(b.id));
        const assignment = assignSupports(ordered.map(candidate => candidate.keys));
        if (!assignment) continue;
        const route = ordered.map(candidate => candidate.boss).join('-');
        keep({route, totalDamage, borrowCount: assignment.borrowCount,
          manualCount: ordered.reduce((sum, candidate) => sum + candidate.manualCount, 0),
          key: ordered.map(candidate => candidate.id).join('\u0001'),
          attacks: ordered.map((candidate, team) => ({combo: candidate.combo, keys: candidate.keys,
            expectedDamage: candidate.damage, supportKey: assignment.supports[team],
            supportIndex: assignment.supports[team] === null ? -1 : candidate.keys.indexOf(assignment.supports[team])}))});
      }
    }
  }
  return {plans: [...routes.values()].sort(comparePlans).slice(0, Math.max(0, limit)),
    candidateCount: candidates.length, skippedCount};
}
