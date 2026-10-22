import { assetUrl } from './site-paths.mjs?v=20261022-pages10';

export const normalizeCharacterName = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase('ko-KR');

export function findCharacter(catalog, name) {
  const key = normalizeCharacterName(name);
  if (!key) return null;
  return catalog.find(p => normalizeCharacterName(p.name) === key)
    || catalog.find(p => p.aliases?.some(alias => normalizeCharacterName(alias) === key)) || null;
}

// Use imported images as an extra visual layer; never mutate saved clan records.
export function withPortraitLibrary(catalog, library) {
  const entries = Array.isArray(library?.characters) ? library.characters : [];
  const byName = new Map(entries.map(p => [normalizeCharacterName(p.name), p]));
  const accounted = new Set();
  const combined = catalog.map(character => {
    const entry = [character.name, ...(character.aliases || [])]
      .map(name => byName.get(normalizeCharacterName(name))).find(Boolean);
    if (!entry) return character;
    accounted.add(normalizeCharacterName(entry.name));
    return {...character, sourcePortrait: entry.portrait || '', sourceByStar: entry.byStar || {}};
  });
  for (const entry of entries) {
    const key = normalizeCharacterName(entry.name);
    if (accounted.has(key) || combined.some(p => normalizeCharacterName(p.name) === key)) continue;
    combined.push({
      id: 'source-' + entry.name,
      name: entry.name,
      aliases: [],
      portrait: '',
      byStar: {},
      sourcePortrait: entry.portrait || '',
      sourceByStar: entry.byStar || {}
    });
    accounted.add(key);
  }
  return combined;
}

function safeImage(value) {
  if (typeof value !== 'string') return '';
  if (/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(value)) return value;
  if (/^\/images\/(?:characters|sheet-originals)\/[\w.-]+$/.test(value)) return value;
  if (/^\/source-library\/images\/(?:nostar\/)?[\w%.()가-힣ㄱ-ㅎㅏ-ㅣ -]+\.png$/i.test(value)
    && !value.includes('..') && !/%2f|%5c/i.test(value)) return value;
  return '';
}

export function characterPortrait(catalog, name, star, custom) {
  const character = findCharacter(catalog, name);
  const level = String(star ?? '').replace(/[★☆성\s]/g, '');
  const override = safeImage(custom);
  const direct = safeImage(character?.sourceByStar?.[level]);
  const base = safeImage(character?.sourcePortrait);
  const candidates = [...new Set([override, direct, base, character?.byStar?.[level], character?.portrait].map(safeImage).filter(Boolean))];
  const url = candidates[0] || '';
  const usesStarOverlay = !!base && /^[1-6]$/.test(level);
  const starOverlay = usesStarOverlay && /^[3-6]$/.test(level) ? assetUrl('/portrait-assets/stars/' + level + '.png') : '';
  const starText = usesStarOverlay && /^[12]$/.test(level) ? '★' + level : '';
  return {
    character,
    url: assetUrl(url),
    candidates,
    starOverlay,
    starText,
    sourceBase: base ? assetUrl(base) : '',
    showStarOverlay: !!(base && url === base && (starOverlay || starText))
  };
}

const escapeAttribute = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const portraitAttributes = portrait => 'data-character-portrait data-portrait-fallbacks="' +
  escapeAttribute(JSON.stringify(portrait.candidates.slice(1))) + '" data-portrait-star-base="' +
  escapeAttribute(portrait.sourceBase) + '"';

// Star-specific imported PNGs already contain their star and role badges,
// so add this mark only when falling back to a no-star portrait.
export function portraitStarOverlay(portrait) {
  if (!portrait?.starOverlay && !portrait?.starText) return '';
  const visibility = portrait.showStarOverlay ? '' : ' hidden';
  return portrait.starOverlay
    ? '<img class="source-star-overlay" data-portrait-star-overlay src="' +
        escapeAttribute(portrait.starOverlay) + '" alt="" aria-hidden="true"' + visibility + '>'
    : '<span class="source-star-overlay source-star-text" data-portrait-star-overlay aria-hidden="true"' +
        visibility + '>' + escapeAttribute(portrait.starText) + '</span>';
}

export function handlePortraitError(event) {
  const img = event.target;
  if (!img?.matches?.('img[data-character-portrait]')) return;
  let remaining;
  try { remaining = JSON.parse(img.dataset.portraitFallbacks || '[]'); } catch { remaining = []; }
  const next = remaining.findIndex(path => safeImage(path));
  if (next >= 0) {
    img.dataset.portraitFallbacks = JSON.stringify(remaining.slice(next + 1));
    img.src = assetUrl(remaining[next]);
    const marker = img.parentElement?.querySelector?.('[data-portrait-star-overlay]');
    if (marker) marker.hidden = img.src !== img.dataset.portraitStarBase;
  } else img.hidden = true;
}

export function installPortraitFallback(root = document) {
  root.addEventListener('error', handlePortraitError, true);
}
