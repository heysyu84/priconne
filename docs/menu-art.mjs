// Only the current page's lightweight header asset is requested.
// Full-body studies and reserves are intentionally outside this map.
export const MENU_ART = Object.freeze({
  overview: { file: 'pecorine', name: '페코린느', overhang: 6 },
  dashboard: { file: 'kokkoro-guide', name: '콧코로(嚮導幼君)', overhang: 11 },
  battle: { file: 'kyaru-transfer', name: '캬루(편입생)', overhang: 11 },
  tactics: { file: 'kyoka-gothic', name: '쿄우카(고딕)', overhang: 6 },
  combos: { file: 'riri-summer', name: '리리(서머)', overhang: 14 },
  members: { file: 'houou', name: '호우오우', overhang: 12 },
  profile: { file: 'vampy-summer', name: '밤피(서머)', overhang: 9 },
  db: { file: 'aglaia', name: '아그라이아', overhang: 9 },
});

export function menuArtMarkup(page) {
  const art = MENU_ART[page];
  if (!art) return '';
  return `<figure class="menu-mascot" data-menu-art="${art.file}" style="--art-overhang:${art.overhang}%" aria-hidden="true"><img src="./images/menu-sd/headers/${art.file}.webp" alt="" width="576" height="384" decoding="async" draggable="false"></figure>`;
}
