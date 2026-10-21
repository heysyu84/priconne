import { assetUrl } from './site-paths.mjs?v=20261022-pages10';
export const normalizeCharacterName = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase('ko-KR');

export function findCharacter(catalog, name) {
  const key = normalizeCharacterName(name);
  if (!key) return null;
  return catalog.find(p => normalizeCharacterName(p.name) === key)
    || catalog.find(p => p.aliases?.some(alias => normalizeCharacterName(alias) === key)) || null;
}

function safeImage(value) {
  return typeof value === 'string' && (/^\/images\/(?:characters|sheet-originals)\/[\w.-]+$/.test(value)
    || /^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(value)) ? value : '';
}

export function characterPortrait(catalog, name, star, custom) {
  const character = findCharacter(catalog, name);
  const level = String(star ?? '').replace(/[★☆성\s]/g, '');
  const candidates = [...new Set([custom, character?.byStar?.[level], character?.portrait].map(safeImage).filter(Boolean))];
  return { character, url: assetUrl(candidates[0] || ''), candidates };
}

const escapeAttribute = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const portraitAttributes = portrait => `data-character-portrait data-portrait-fallbacks="${escapeAttribute(JSON.stringify(portrait.candidates.slice(1)))}"`;

export function handlePortraitError(event) {
  const img = event.target;
  if (!img?.matches?.('img[data-character-portrait]')) return;
  let remaining;
  try { remaining = JSON.parse(img.dataset.portraitFallbacks || '[]'); } catch { remaining = []; }
  const next = remaining.findIndex(path => safeImage(path));
  if (next >= 0) {
    img.dataset.portraitFallbacks = JSON.stringify(remaining.slice(next + 1));
    img.src = assetUrl(remaining[next]);
  } else img.hidden = true;
}

export function installPortraitFallback(root = document) {
  root.addEventListener('error', handlePortraitError, true);
}
