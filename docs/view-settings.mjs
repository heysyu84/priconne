import { findCharacter, normalizeCharacterName } from './character-portraits.mjs?v=20261023-image-cleanup01';

export const CLAN_PROFILE = '__clan__';
export function isBoosterCharacter(app, name, catalog = []) {
  const character = findCharacter(catalog, name);
  const names = new Set([name, character?.name, ...(character?.aliases || [])].filter(Boolean).map(normalizeCharacterName));
  return (app.boosterCharacters || []).some(value => {
    if (names.has(normalizeCharacterName(value))) return true;
    const booster = findCharacter(catalog, value);
    return !!character && !!booster && normalizeCharacterName(character.name) === normalizeCharacterName(booster.name);
  });
}
export function formatExpectedDamage(value) {
  if (value === null || value === undefined || String(value).trim() === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : String(value);
}
export function sequenceVisible() {
  try { return localStorage.getItem('nyang-show-sequence') === '1'; } catch { return false; }
}
export function setSequenceVisible(value) {
  try { localStorage.setItem('nyang-show-sequence', value ? '1' : '0'); } catch {}
}
export function comboNoticeHidden(month) {
  try { return localStorage.getItem('nyang-combo-notice:' + month) === 'hidden'; } catch { return false; }
}
export function setComboNoticeHidden(month, value) {
  try { localStorage.setItem('nyang-combo-notice:' + month, value ? 'hidden' : 'visible'); } catch {}
}

export function sourceLinkKind(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return 'empty';
    const host = url.hostname.toLowerCase();
    const videoHosts = ['youtube.com','youtu.be','youtube-nocookie.com','vimeo.com','nicovideo.jp','nico.ms','bilibili.com','twitch.tv'];
    return videoHosts.some(h => host === h || host.endsWith('.' + h)) || /\.(mp4|webm|mov)(?:$|[?#])/i.test(url.href) ? 'video' : 'site';
  } catch { return 'empty'; }
}
export function sourceLinkBox(value) {
  const kind = sourceLinkKind(value);
  if (kind === 'empty') return '<span class="source-link-box is-empty" aria-label="링크 미등록" title="링크 미등록"></span>';
  const href = new URL(value).href.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label = kind === 'video' ? '원본 영상 열기' : '원본 사이트 열기';
  const icon = kind === 'video'
    ? '<svg viewBox="0 0 24 18" aria-hidden="true"><path d="M9 4.5 17 9l-8 4.5z" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 24 18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="2" width="18" height="14" rx="2"/><path d="M3 6h18M6 4h1m2 0h1m-4 5h12m-12 3h8"/></svg>';
  return `<a class="source-link-box is-${kind}" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}">${icon}</a>`;
}
