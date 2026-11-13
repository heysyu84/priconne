export const MEMBER_REFERENCE_VERSION = '20261108-member-reference01';

const UIDS = {
  SyN: '236721957548',
  VoiDive: '113821923458',
  VoDive: '113821923458',
  Nera: '716721947178',
};

// Correct only the explicitly identified members; battle IDs and numbers stay intact.
export function correctMemberReferences(data) {
  if (!data || data.memberReferenceVersion === MEMBER_REFERENCE_VERSION) return false;
  let changed = false;
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value)) {
      if (value.name === '50091') {
        value.name = '50091(상현)';
        changed = true;
      }
      if (Object.hasOwn(value, 'uid') && UIDS[value.name] && String(value.uid) !== UIDS[value.name]) {
        value.uid = UIDS[value.name];
        changed = true;
      }
      if (String(value.uid) === '627721945958') {
        for (const key of ['leftAt', 'left', 'leftMonth']) {
          if (typeof value[key] === 'string' && value[key].startsWith('2025-05')) {
            value[key] = value[key].replace('2025-05', '2025-06');
            changed = true;
          }
        }
        if (value.sourceMonths === 31 && value.leftMonth === '2025-06') {
          value.sourceMonths = 32;
          changed = true;
        }
        for (const period of value.periods || []) {
          for (const key of ['left', 'to']) {
            if (period[key] === '2025-05') {
              period[key] = '2025-06';
              changed = true;
            }
          }
        }
        if (typeof value.sourcePeriod === 'string' && value.sourcePeriod.includes('2025.05')) {
          value.sourcePeriod = value.sourcePeriod.replace('2025.05', '2025.06');
          changed = true;
        }
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (child === '50091' && ['name', 'member', 'recordedName'].includes(key)) {
        value[key] = '50091(상현)';
        changed = true;
      } else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(data);
  if (changed) data.memberReferenceVersion = MEMBER_REFERENCE_VERSION;
  return changed;
}

// Preserve the preceding revision and retry when an editor writes concurrently.
export async function readCorrectedClanState(db) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await db.prepare('SELECT revision, payload, updated_at FROM clan_state WHERE id = ?').bind('main').first();
    if (!row) return { row: null, data: null };
    const data = JSON.parse(row.payload);
    if (!correctMemberReferences(data)) return { row, data };
    const revision = row.revision + 1;
    const payload = JSON.stringify(data);
    const updated_at = new Date().toISOString();
    const result = await db.batch([
      db.prepare('INSERT OR IGNORE INTO clan_revisions (revision, payload, created_at) SELECT revision, payload, updated_at FROM clan_state WHERE id = ? AND revision = ?').bind('main', row.revision),
      db.prepare('UPDATE clan_state SET revision = ?, payload = ?, updated_at = ? WHERE id = ? AND revision = ?').bind(revision, payload, updated_at, 'main', row.revision),
    ]);
    if (result[1].meta.changes) return { row: { revision, payload, updated_at }, data };
  }
  const row = await db.prepare('SELECT revision, payload, updated_at FROM clan_state WHERE id = ?').bind('main').first();
  return { row, data: row ? JSON.parse(row.payload) : null };
}
