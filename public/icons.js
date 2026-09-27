// Vlastní SVG ikonky místo emoji — vypadají stejně na každém telefonu.
// Obrysové ikony (stroke) dědí barvu textu přes currentColor, velikost
// přes CSS třídu .ico (výchozí 1em).

function lineIcon(inner, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

const ICON_PATHS = {
  gear: '<path d="M9.81 4.93L10.41 2.13L13.59 2.13L14.19 4.93L15.45 5.45L17.85 3.89L20.11 6.15L18.55 8.55L19.07 9.81L21.87 10.41L21.87 13.59L19.07 14.19L18.55 15.45L20.11 17.85L17.85 20.11L15.45 18.55L14.19 19.07L13.59 21.87L10.41 21.87L9.81 19.07L8.55 18.55L6.15 20.11L3.89 17.85L5.45 15.45L4.93 14.19L2.13 13.59L2.13 10.41L4.93 9.81L5.45 8.55L3.89 6.15L6.15 3.89L8.55 5.45Z"/><circle cx="12" cy="12" r="3.2"/>',
  pencil: '<path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  back: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  cameraOff: '<path d="M9.5 5H15l2 3h3a1 1 0 0 1 1 1v8.5"/><path d="M19 20H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h3.5"/><path d="M9.8 11.3a3.5 3.5 0 0 0 4.9 4.9"/><path d="M3 3l18 18"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.2"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.3 1.8"/><path d="M9.5 2.5h5"/><path d="M18.5 6.5l1.3-1.3"/>',
  rounds: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4.5h-4.5"/><path d="M12 8.5v3.5l2.5 1.5"/>',
  gamepad: '<path d="M7 7h10a5 5 0 0 1 4.9 6l-.8 4a2.6 2.6 0 0 1-4.5 1.2L14.5 16h-5l-2.1 2.2a2.6 2.6 0 0 1-4.5-1.2l-.8-4A5 5 0 0 1 7 7z"/><path d="M8 10.5v3M6.5 12h3"/><path d="M15.5 11h.01M17.5 13h.01" stroke-width="2.6"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
  noAds: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M8.5 14.5l1.5-5 1.5 5M9 13h2"/><path d="M14 9.5v5h1a2.5 2.5 0 0 0 0-5z"/><path d="M3 21L21 3"/>',
  backpack: '<path d="M6 10a6 6 0 0 1 12 0v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M9 4.5V4a3 3 0 0 1 6 0v.5"/><path d="M9 14h6v4H9z"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  spy: '<path d="M7 10l1.4-5a1 1 0 0 1 1.4-.6L12 5.6l2.2-1.2a1 1 0 0 1 1.4.6L17 10"/><path d="M3 10.5c5 2 13 2 18 0"/><path d="M6 15.5c3.5-2 8.5-2 12 0-1 3-3.5 3.3-6 1.6-2.5 1.7-5 1.4-6-1.6z"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3"/><circle cx="17" cy="9" r="2.6"/><path d="M16 13.8c2.6 0 4.4 1.6 5 4.7"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  ticket: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v2M14 11v2M14 16v2"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  logout: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4"/><path d="M6 12h10"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  sad: '<circle cx="12" cy="12" r="9"/><path d="M8.6 16.4c1.8-1.7 5-1.7 6.8 0"/><path d="M9 9.8h.01M15 9.8h.01" stroke-width="2.8"/>',
  brush: '<path d="M18.4 3.6a2.1 2.1 0 0 1 3 3L12.2 15.8l-3-3z"/><path d="M9.2 12.8c-2.6-.1-4.3 1.5-4.3 3.6 0 1.4-.7 2.4-1.9 3 1 .6 2.4 1 3.9 1 2.9 0 5.1-1.9 5.3-4.6"/>',
  chat: '<path d="M12 4c4.7 0 8.5 3 8.5 6.8s-3.8 6.7-8.5 6.7c-1 0-1.9-.1-2.8-.4L4.5 19.5l1.2-3.6C4.3 14.7 3.5 12.8 3.5 10.8 3.5 7 7.3 4 12 4z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" stroke-width="2.6"/>',
};

function icon(name, cls = '') {
  return lineIcon(ICON_PATHS[name] || '', cls);
}

// Velká stavová ikona (např. "Fotka odeslána") — ikonka v zářícím kruhu.
function bigIcon(name, tone = 'accent') {
  return `<div class="big-icon tone-${tone}">${icon(name)}</div>`;
}

// Plné bílé glyfy do barevných dlaždic módů na úvodní obrazovce.
const MODE_GLYPHS = {
  classic: `
    <path d="M2.5 4.2c2.8-1.2 6.2-1.2 9 0v6c0 3.1-2 5-4.5 5s-4.5-1.9-4.5-5z" fill="#fff" fill-opacity="0.62"/>
    <path d="M4.6 7.6h1.6M8.2 7.6h1.6" stroke="#3a1040" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M4.8 10.6c1.2 1.2 3.2 1.2 4.4 0" stroke="#3a1040" stroke-width="1.4" stroke-linecap="round" fill="none"/>
    <path d="M12.5 8.7c2.8-1.2 6.2-1.2 9 0v6c0 3.1-2 5-4.5 5s-4.5-1.9-4.5-5z" fill="#fff"/>
    <path d="M14.6 12.1l1.6.5M19.8 12.1l-1.6.5" stroke="#3a1040" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M14.8 16.6c1.2-1.2 3.2-1.2 4.4 0" stroke="#3a1040" stroke-width="1.4" stroke-linecap="round" fill="none"/>`,
  draw: `
    <path d="M18.3 2.9a2.2 2.2 0 0 1 3.1 3.1l-8.6 8.6-3.1-3.1z" fill="#fff"/>
    <path d="M9 12.2l3.1 3.1" stroke="#0f2436" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M8.7 12.6c-2.8-.1-4.6 1.6-4.6 3.8 0 1.5-.8 2.5-2 3.1 1.1.7 2.6 1.1 4.2 1.1 3.1 0 5.4-2 5.6-4.9z" fill="#fff" fill-opacity="0.85"/>`,
  impostor: `
    <path d="M7 10 L8.5 4.6 Q9 3.6 10 4.1 L12 5.3 L14 4.1 Q15 3.6 15.5 4.6 L17 10 Z" fill="#fff"/>
    <path d="M2.8 10.2 Q12 13.8 21.2 10.2 L21.2 11.6 Q12 15.6 2.8 11.6 Z" fill="#fff" fill-opacity="0.85"/>
    <path d="M5.5 15.8 Q12 12.8 18.5 15.8 Q17.6 20.2 14.2 19 L12 17.9 L9.8 19 Q6.4 20.2 5.5 15.8 Z" fill="#fff"/>
    <circle cx="9.2" cy="16.4" r="1.05" fill="#4c1030"/><circle cx="14.8" cy="16.4" r="1.05" fill="#4c1030"/>`,
  caption: `
    <path d="M12 3.5c5 0 9 3.2 9 7.2S17 18 12 18c-1 0-2-.1-3-.4L4 20l1.3-3.9C3.8 14.8 3 12.9 3 10.7 3 6.7 7 3.5 12 3.5z" fill="#fff"/>
    <circle cx="8.3" cy="10.8" r="1.3" fill="#7a2a3a"/><circle cx="12" cy="10.8" r="1.3" fill="#7a2a3a"/><circle cx="15.7" cy="10.8" r="1.3" fill="#7a2a3a"/>`,
};

// Plné bílé glyfy pro sady otázek (Classic / Spicy / Family / School) — stejný styl jako módy.
const PACK_GLYPHS = {
  classic: `
    <circle cx="12" cy="12" r="9" fill="#fff"/>
    <path d="M8.6 9.6h.01M15.4 9.6h.01" stroke="#4a1560" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M7.8 13.4c2.2 2.9 6.2 2.9 8.4 0" stroke="#4a1560" stroke-width="1.8" stroke-linecap="round" fill="none"/>`,
  spicy: `
    <path d="M7.4 8.6c2.4-1.3 5.2-.6 6.6 1.8l1.6 2.9c1.3 2.4 3.2 4.1 5.6 5.2-4 2.4-9.8 1.7-13.2-2.3C5.9 13.8 5.4 10.3 7.4 8.6z" fill="#fff"/>
    <path d="M6.2 9.8c.1-2 2-3.5 4.1-3.3 1.2.1 2.2.8 2.8 1.8" stroke="#fff" stroke-width="1.9" stroke-linecap="round" fill="none" stroke-opacity="0.8"/>
    <path d="M9.6 6.6c-.4-1.7.3-3.2 1.8-4.1" stroke="#fff" stroke-width="1.9" stroke-linecap="round" fill="none"/>
    <path d="M9.6 12.2c1 2.3 3 3.9 5.4 4.5" stroke="#7f1d1d" stroke-width="1.3" stroke-linecap="round" fill="none" stroke-opacity="0.4"/>`,
  family: `
    <circle cx="6.8" cy="5.8" r="2.5" fill="#fff" fill-opacity="0.8"/>
    <path d="M2.6 20v-5.3a4.2 4.2 0 0 1 8.4 0V20z" fill="#fff" fill-opacity="0.8"/>
    <circle cx="17.2" cy="5.8" r="2.5" fill="#fff" fill-opacity="0.8"/>
    <path d="M13 20v-5.3a4.2 4.2 0 0 1 8.4 0V20z" fill="#fff" fill-opacity="0.8"/>
    <circle cx="12" cy="11.6" r="2.1" fill="#fff" stroke="#0c4a6e" stroke-width="1.1"/>
    <path d="M8.9 20.5v-2.8a3.1 3.1 0 0 1 6.2 0v2.8z" fill="#fff" stroke="#0c4a6e" stroke-width="1.1"/>`,
  school: `
    <path d="M9.3 5V4.2a2.7 2.7 0 0 1 5.4 0V5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    <path d="M5 10.8a7 7 0 0 1 14 0v8.4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" fill="#fff"/>
    <path d="M5 11.6h14" stroke="#1e3a8a" stroke-width="1.3" stroke-opacity="0.45"/>
    <rect x="8.2" y="14.2" width="7.6" height="4.6" rx="1.4" fill="#1e3a8a" fill-opacity="0.3"/>
    <path d="M12 11.6v2.6" stroke="#1e3a8a" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.6"/>`,
};

function packGlyph(pack) {
  return `<svg class="pack-glyph" viewBox="0 0 24 24" fill="none" aria-hidden="true">${PACK_GLYPHS[pack] || ''}</svg>`;
}

function modeTile(mode) {
  return `<div class="mode-tile"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${MODE_GLYPHS[mode]}</svg></div>`;
}

// Zlatá korunka pro vítěze kola.
const CROWN_SVG = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M3 8l4.6 4.2L12 5l4.4 7.2L21 8l-1.8 10.5H4.8z" fill="#F0B429" stroke="#8a5a00" stroke-width="1.2" stroke-linejoin="round"/>
  <rect x="4.8" y="18.5" width="14.4" height="2" rx="0.6" fill="#F59E0B"/>
  <circle cx="12" cy="13.8" r="1.3" fill="#fff" fill-opacity="0.85"/></svg>`;

// Medaile na pódium — kovová barva podle místa, číslo uprostřed.
const MEDAL_COLORS = {
  1: ['#FDE68A', '#F0B429', '#9a6a00'],
  2: ['#F1F5F9', '#A8B3C4', '#5b6576'],
  3: ['#FBD5B0', '#D08A4E', '#7a4318'],
};
function medalSvg(place) {
  const [light, mid, dark] = MEDAL_COLORS[place];
  const gid = `medal-g-${place}`;
  return `<svg class="medal" viewBox="0 0 32 40" aria-hidden="true">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${mid}"/></linearGradient></defs>
    <path d="M8 2h6l4 12h-6z" fill="#7C3AED"/><path d="M24 2h-6l-4 12h6z" fill="#C026D3"/>
    <circle cx="16" cy="25" r="11" fill="url(#${gid})" stroke="${dark}" stroke-width="1.5"/>
    <circle cx="16" cy="25" r="7.5" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="1"/>
    <text x="16" y="29.2" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="800" font-size="11" fill="${dark}">${place}</text>
  </svg>`;
}

// Herní mince — zlatá s hvězdou.
const COIN_SVG = `<svg class="coin" viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="10" fill="#F59E0B"/>
  <circle cx="12" cy="11.2" r="9.2" fill="#FBBF24"/>
  <circle cx="12" cy="11.2" r="6.6" fill="none" stroke="#B45309" stroke-opacity="0.45" stroke-width="1.2"/>
  <path d="M12 7.2l1.2 2.5 2.7.3-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.3z" fill="#B45309" fill-opacity="0.8"/>
</svg>`;
