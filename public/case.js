// Truhly s kosmetikou + otevírací animace ve stylu CS:GO (pás věcí se
// roztočí a zpomalí na výhře pod středovou značkou).
// Výhra se vylosuje a uloží HNED po zaplacení — animace je jen divadlo,
// takže zavřením appky uprostřed se nic neztratí.

// Každá truhla: co v ní může padnout (items — skin může být i ve více
// truhlách, v každé jsou všechny 4 vzácnosti), šance na vzácnosti (odds,
// v procentech, součet 100) a barvy obrázku. isNew = štítek NEW v shopu.
// exclusive = časově omezená truhla: její skiny nepadají nikde jinde (ani
// z Daily Chest) a po endsAt (místní čas telefonu) truhla ze shopu zmizí.
const CASES = [
  // Sady ze Snapfam exportu (specs.csv). Šance podle README: Common 60 / Rare 28 / Epic 10 / Legendary 2 %.
  // Skiny jsou exkluzivní pro svou truhlu; Mythic z truhel nepadá nikdy. NEW štítek jen u Winter (hlavní truhla nahoře).
  {
    id: 'winter',
    name: 'Winter Chest',
    price: 120,
    isNew: true,
    exclusive: true,
    items: [
      'frame-snowball', 'frame-mitten', 'frame-cocoa', 'frame-candy-cane', 'frame-fairy-lights', 'frame-gift-wrap', 'frame-snow-globe',
      'name-snowy', 'name-cranberry', 'name-minty', 'name-gingerbread', 'name-frosted', 'name-aurora', 'name-santa',
    ],
    odds: { common: 60, rare: 28, epic: 10, legendary: 2 },
    colors: { body: ['#D8343F', '#8E1C28'], lid: ['#E6F4FF', '#7FA8D8'], trim: ['#7FA8D8', '#4A7BB0'] },
    glow: 'rgba(111,184,240,0.45)',
  },
  {
    id: 'cosmos',
    name: 'Cosmos Chest',
    price: 120,
    exclusive: true,
    items: [
      'frame-moon-grey', 'frame-nebula-blue', 'frame-stardust', 'frame-saturn', 'frame-rocket', 'frame-alien', 'frame-black-hole',
      'name-moon', 'name-comet', 'name-nebula', 'name-mars', 'name-supernova', 'name-galaxy-far', 'name-cosmic',
    ],
    odds: { common: 60, rare: 28, epic: 10, legendary: 2 },
    colors: { body: ['#2A1F7A', '#160E4A'], lid: ['#5B3FD0', '#2A1F7A'], trim: ['#8FB0FF', '#4A6FE8'] },
    glow: 'rgba(143,176,255,0.45)',
  },
  {
    id: 'street',
    name: 'Street Chest',
    price: 120,
    exclusive: true,
    items: [
      'frame-asphalt', 'frame-spray-red', 'frame-sticker-bomb', 'frame-sneaker', 'frame-graffiti', 'frame-neon-sign', 'frame-boombox',
      'name-concrete', 'name-spray', 'name-tag', 'name-highlighter', 'name-fresh-kicks', 'name-wildstyle', 'name-gold-chain',
    ],
    odds: { common: 60, rare: 28, epic: 10, legendary: 2 },
    colors: { body: ['#2C2C38', '#1A1A24'], lid: ['#FF4FD8', '#B0189A'], trim: ['#2BE0C8', '#FF8FE6'] },
    glow: 'rgba(255,143,230,0.45)',
  },
  {
    id: 'dragon',
    name: 'Dragon Chest',
    price: 150,
    firstFree: true, // první otevření na zařízení zdarma (data.freeOpened v obchodě), pak už za mince
    exclusive: true, // trvalá truhla (bez endsAt), ale její skiny nepadají nikde jinde
    // dračí / fantasy sada — tyhle skiny jsou exkluzivní pro tuhle truhlu
    items: [
      'frame-dragonscale', 'frame-castle', 'frame-enchanted', 'frame-knight', 'frame-wizard', 'frame-crystal', 'frame-dragon',
      'name-dragonscale', 'name-knight', 'name-elven', 'name-ember', 'name-arcane', 'name-crystal', 'name-dragon',
    ],
    odds: { common: 48, rare: 30, epic: 17, legendary: 5 },
    colors: { body: ['#7F1D1D', '#3B0A0A'], lid: ['#DC2626', '#991B1B'], trim: ['#FBBF24', '#B45309'] },
    glow: 'rgba(239,68,68,0.45)',
  },
  {
    id: 'spooky',
    name: 'Spooky Chest',
    price: 110,
    isNew: true,
    exclusive: true,
    endsAt: new Date(2026, 10, 1), // 1. 11. 2026 00:00 — dostupná celý Halloween
    // jen halloweenská sada — tyhle skiny jsou exkluzivní pro tuhle truhlu
    items: [
      'frame-pumpkin', 'frame-moss', 'frame-bone', 'frame-bat', 'frame-slime', 'frame-blood',
      'frame-ghost', 'frame-witch', 'frame-spider', 'frame-haunted', 'frame-vampire',
      'name-pumpkin', 'name-bone', 'name-slime', 'name-bat', 'name-ghost', 'name-witch',
      'name-haunted', 'name-vampire',
    ],
    odds: { common: 48, rare: 32, epic: 16, legendary: 4 },
    colors: { body: ['#3B1D5E', '#140A24'], lid: ['#FB923C', '#C2410C'], trim: ['#D9F99D', '#65A30D'] },
    glow: 'rgba(249,115,22,0.45)',
  },
  {
    id: 'party',
    name: 'Party Chest',
    price: 65,
    // barevný párty mix rámečků i jmen
    items: [
      'frame-sunset', 'frame-grape', 'frame-sand', 'frame-neon', 'frame-candy', 'frame-aurora', 'frame-music', 'frame-sweets',
      'frame-lemon', 'frame-berry', 'frame-arcade', 'frame-pizza', 'frame-disco', 'frame-spacecat',
      'name-pink', 'name-peach', 'name-coral', 'name-sunset', 'name-candy', 'name-rainbow',
      'name-lemon', 'name-arcade', 'name-pizza', 'name-disco', 'name-spacecat',
    ],
    odds: { common: 57, rare: 28, epic: 13, legendary: 2 },
    colors: { body: ['#8B3CF0', '#4C1D95'], lid: ['#A78BFA', '#7C3AED'], trim: ['#FDE68A', '#D97706'] },
    glow: 'rgba(240,180,41,0.35)',
  },
  {
    id: 'frames',
    name: 'Frame Chest',
    price: 85,
    // živly: led, les, oceán, jed, oheň, láva, mráz, blesk, vesmír
    items: [
      'frame-ice', 'frame-forest', 'frame-mint', 'frame-slate', 'frame-night', 'frame-ocean', 'frame-toxic', 'frame-deepsea',
      'frame-fire', 'frame-lava', 'frame-frost', 'frame-electric', 'frame-galaxy', 'frame-phoenix',
      'frame-sky', 'frame-jungle', 'frame-ninja', 'frame-robot', 'frame-dino',
    ],
    odds: { common: 52, rare: 30, epic: 15, legendary: 3 },
    colors: { body: ['#0EA5E9', '#0C4A6E'], lid: ['#7DD3FC', '#0284C7'], trim: ['#E0F2FE', '#94A3B8'] },
    glow: 'rgba(56,189,248,0.35)',
  },
  {
    id: 'names',
    name: 'Name Chest',
    price: 45,
    // barvy jmen ve stejných živlech jako Truhla rámečků
    items: [
      'name-violet', 'name-mint', 'name-sky', 'name-lime', 'name-gold', 'name-ice', 'name-toxic', 'name-deepsea',
      'name-fire', 'name-frost', 'name-electric', 'name-galaxy', 'name-phoenix',
      'name-blueberry', 'name-cocoa', 'name-jungle', 'name-robot', 'name-spacecat',
    ],
    odds: { common: 61, rare: 26, epic: 11, legendary: 2 },
    colors: { body: ['#10B981', '#065F46'], lid: ['#6EE7B7', '#059669'], trim: ['#FDE68A', '#D97706'] },
    glow: 'rgba(52,211,153,0.35)',
  },
  {
    id: 'legend',
    name: 'Legendary Chest',
    price: 220,
    // nejprestižnější kousky
    items: [
      'frame-rose', 'frame-sakura', 'frame-mango', 'frame-gold', 'frame-chrome', 'frame-love', 'frame-rainbow', 'frame-diamond', 'frame-king',
      'name-sand', 'name-sakura', 'name-mango', 'name-chrome', 'name-love', 'name-diamond', 'name-king',
      'frame-disco', 'frame-ninja', 'frame-spacecat', 'frame-dino', 'name-disco',
    ],
    odds: { common: 15, rare: 44, epic: 33, legendary: 8 },
    colors: { body: ['#1F1235', '#0B0616'], lid: ['#3B2463', '#1F1235'], trim: ['#FDE68A', '#F59E0B'] },
    glow: 'rgba(245,158,11,0.55)',
  },
];
// (Daily Chest nahradilo kolo štěstí — wheel.js)

// Má tahle truhla pro hráče první otevření zdarma? (jen jednou na zařízení)
function caseIsFree(caseDef, data = shopLoad()) {
  return !!caseDef.firstFree && !(data.freeOpened || []).includes(caseDef.id);
}

// Cena na tlačítku: „FREE“, nebo mince s cenou
function casePriceHtml(caseDef, data) {
  return caseIsFree(caseDef, data) ? '<span>Open free</span>' : `${COIN_SVG}<span class="num">${caseDef.price}</span>`;
}

function caseById(id) {
  return CASES.find((c) => c.id === id) || CASES[0];
}

// Skiny z exkluzivních (časově omezených) truhel — nepadají nikde jinde.
const EXCLUSIVE_ITEMS = new Set(CASES.filter((c) => c.exclusive).flatMap((c) => c.items));

function isCaseAvailable(caseDef) {
  return !caseDef.endsAt || Date.now() < caseDef.endsAt.getTime();
}

// Kolik zbývá do konce časově omezené truhly — "12 days left" / "5h 20m left".
function caseTimeLeft(caseDef) {
  const mins = Math.max(1, Math.round((caseDef.endsAt - Date.now()) / 60000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days >= 1) return `Ends in ${days}d ${hours}h`;
  return hours ? `Ends in ${hours}h ${mins % 60}m` : `Ends in ${mins}m`;
}

function casePool(caseDef) {
  if (!caseDef.items) return ALL_ITEMS.filter((item) => !EXCLUSIVE_ITEMS.has(item.id) && !item.promoOnly);
  return ALL_ITEMS.filter((item) => caseDef.items.includes(item.id));
}

// Kontrola při vývoji: každý skin musí být aspoň v jedné truhle (může
// být i ve více, ale exkluzivní skiny jen ve své truhle), žádné neznámé id
// a v každé truhle všechny 4 vzácnosti.
(() => {
  const counts = {};
  for (const c of CASES) for (const id of c.items || []) counts[id] = (counts[id] || 0) + 1;
  const missing = ALL_ITEMS.filter((i) => !counts[i.id] && !i.wheelOnly && !i.promoOnly).map((i) => i.id);
  const unknown = Object.keys(counts).filter((id) => !ALL_ITEMS.some((i) => i.id === id));
  const noRarity = CASES.filter((c) => c.items).flatMap((c) => RARITY_ORDER
    .filter((r) => !casePool(c).some((i) => i.rarity === r)).map((r) => `${c.id}:${r}`));
  const leaked = [...EXCLUSIVE_ITEMS].filter((id) => counts[id] > 1);
  // promoOnly skiny (dárkový odkaz) nesmí být v žádné truhle
  const promoInChest = ALL_ITEMS.filter((i) => i.promoOnly && counts[i.id]).map((i) => i.id);
  if (missing.length || unknown.length || noRarity.length || leaked.length || promoInChest.length) {
    console.warn('Chests: missing', missing, 'unknown', unknown, 'rarity missing', noRarity, 'exclusive elsewhere', leaked, 'promo in chest', promoInChest);
  }
})();

// Truhla ze Snapfam exportu (assets/chests/<složka>/<složka>-<stav>.svg, 10 stavů + vrstva inner-glow).
// Jeden <img> mění stavy (closed, bounce-1/2, shake-1/2/3, open-25/60/100, empty), vrstva inner-glow se po otevření
// rozsvítí. Stavy jsou hotové obrázky s odskočeným víkem, takže se animace dělá střídáním obrázků (chestPlay).
const CHEST_DIR = { dragon: 'dragon', spooky: 'spooky', party: 'party', frames: 'frame', names: 'name', legend: 'legendary', winter: 'winter', cosmos: 'cosmos', street: 'street' };
const CHEST_STATES = ['closed', 'bounce-1', 'bounce-2', 'shake-1', 'shake-2', 'shake-3', 'open-25', 'open-60', 'open-100', 'empty'];
const CHEST_SHAKE_SEQ = ['bounce-1', 'bounce-2', 'shake-1', 'shake-2', 'shake-3', 'closed'];

function chestDir(caseDef) { return CHEST_DIR[caseDef.id] || 'party'; }
function chestUrl(caseDef, state) { const d = chestDir(caseDef); return `assets/chests/${d}/${d}-${state}.svg`; }

// stáhne obrázky stavů předem (držíme je v paměti, ať se při střídání nic nezasekne)
const chestPreloaded = {};
function chestPreload(caseDef, states = CHEST_STATES) {
  states.forEach((st) => {
    const url = chestUrl(caseDef, st);
    if (!chestPreloaded[url]) { const im = new Image(); im.src = url; chestPreloaded[url] = im; }
  });
}

// crop = jen zavřená truhla (karty a okno nákupu); bez crop = celý obrázek i s místem nad truhlou pro víko
function caseSvg(caseDef, { crop = true } = {}) {
  return `<div class="chest-art ${crop ? 'is-crop' : ''}" data-chest="${caseDef.id}" aria-hidden="true">
    <img class="ch-img case-chest" src="${chestUrl(caseDef, 'closed')}" alt="" draggable="false">
    <img class="ch-glow" src="assets/chests/${chestDir(caseDef)}/${chestDir(caseDef)}-inner-glow.svg" alt="" draggable="false">
  </div>`;
}

// Přehraje stavy za sebou (každý stepMs). Předchozí přehrávání na stejné truhle se zruší.
// Vrací { stop } — po stop se truhla nechá, jak je. Když truhla zmizí z DOM, přestane se.
function chestPlay(art, caseDef, seq, stepMs, { loop = false, done } = {}) {
  if (!art) return { stop() {} };
  const img = art.querySelector('.ch-img');
  if (art._chestTimer) clearTimeout(art._chestTimer);
  let i = 0;
  let stopped = false;
  const step = () => {
    if (stopped || !art.isConnected) return;
    img.src = chestUrl(caseDef, seq[i]);
    i++;
    if (i >= seq.length) {
      if (loop) i = 0;
      else { art._chestTimer = setTimeout(() => { if (!stopped && done) done(); }, stepMs); return; }
    }
    art._chestTimer = setTimeout(step, stepMs);
  };
  step();
  return { stop() { stopped = true; clearTimeout(art._chestTimer); } };
}

// ťuknutí na truhlu: poskočí a zatřese se (stavy bounce / shake), pak zůstane zavřená
function chestTap(art, caseDef) {
  if (!art) return;
  chestPreload(caseDef, CHEST_SHAKE_SEQ);
  if (caseReducedMotion()) return;
  chestPlay(art, caseDef, CHEST_SHAKE_SEQ, 70);
}

function randomFloat() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

// Nejdřív se vylosuje vzácnost podle šancí truhly, pak rovnoměrně věc v ní.
function rollItem(caseDef) {
  const pool = casePool(caseDef);
  let r = randomFloat() * 100;
  let rarity = RARITY_ORDER[0];
  for (const key of RARITY_ORDER) {
    r -= caseDef.odds[key];
    if (r < 0) { rarity = key; break; }
  }
  const inRarity = pool.filter((i) => i.rarity === rarity);
  const from = inRarity.length ? inRarity : pool;
  return from[Math.floor(randomFloat() * from.length)];
}

// ------------------------------------------------ nákupní okno truhly (16b) ---
// Okno se otevře po ťuknutí na truhlu: popis, vzácnosti (slovem), zůstatek mincí a jedno velké tlačítko.
// "See drop odds" rozbalí šance a všechno, co v truhle může padnout.

function caseDescription(caseDef) {
  const sections = new Set(casePool(caseDef).map((i) => i.section));
  const what = sections.size > 1 ? 'One random photo frame or name color.' : sections.has('frame') ? 'One random photo frame.' : 'One random name color.';
  return `${what} Duplicates turn into coins.`;
}

function showCaseContents(caseId) {
  const caseDef = caseById(caseId);
  const data = shopLoad();
  const free = caseIsFree(caseDef, data);
  const dev = isDevMode();
  const afford = free || dev || data.coins >= caseDef.price;
  const after = dev ? data.coins : data.coins - caseDef.price;

  const chipsHtml = RARITY_ORDER.map((r) => `
    <span class="sf-chip rar-chip" style="--rc:${RARITIES[r].color}"><i></i>${RARITIES[r].label}</span>`).join('');

  const oddsHtml = RARITY_ORDER.map((r) => `
    <span class="odds-chip" style="--rc:${RARITIES[r].color}"><i></i>${RARITIES[r].label} ${caseDef.odds[r]} %</span>
  `).join('');

  const dropsHtml = casePool(caseDef)
    .slice()
    .sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity))
    .map((item) => {
      const owned = data.owned.includes(item.id);
      return `
        <div class="drop-item ${owned ? 'is-owned' : ''}" style="--rc:${RARITIES[item.rarity].color}">
          ${shopItemPreview(sectionOf(item), item)}
          <div class="drop-item-name">${item.name}</div>
          <div class="drop-item-rar">${RARITIES[item.rarity].label}</div>
          ${owned ? `<span class="drop-owned">${icon('check')}</span>` : ''}
        </div>`;
    }).join('');

  const modal = openModal(`
    <div class="x-close-row"><button class="x-close" id="contents-close" aria-label="Close">${icon('close')}</button></div>
    <div class="buy-sheet">
      <div class="buy-art" style="--case-glow:${caseDef.glow}">${caseSvg(caseDef)}</div>
      <h2 class="buy-title">${caseDef.name}</h2>
      <p class="buy-desc">${caseDescription(caseDef)}</p>
      <div class="buy-chips">${chipsHtml}</div>
      <button type="button" class="buy-odds-link" id="contents-odds-btn" aria-expanded="false" aria-controls="contents-odds">See drop odds</button>
      <div class="buy-odds" id="contents-odds" hidden>
        <div class="odds-row">${oddsHtml}</div>
        <p class="odds-dup">Duplicates give back coins: ${RARITY_ORDER.map((r) => `${RARITIES[r].label} ${RARITIES[r].refund}`).join(' · ')}</p>
        <div class="drop-grid">${dropsHtml}</div>
      </div>
      ${free ? '' : `<div class="buy-balance"><span>Your coins</span><span class="num"><b>${data.coins}</b> → <b class="${afford ? '' : 'is-short'}">${afford ? after : data.coins}</b></span></div>`}
      ${afford
        ? (free
          ? '<button class="btn btn-primary buy-cta" id="contents-open">Open free</button>'
          : `<button class="btn btn-gold buy-cta" id="contents-open">Open for ${COIN_SVG}<span class="num">${caseDef.price}</span></button>`)
        : `<button class="btn buy-cta" id="contents-open" disabled>Not enough coins</button>
           <button class="btn btn-ghost buy-more" id="contents-more">Get coins</button>`}
    </div>
  `);
  modal.querySelector('#contents-close').onclick = closeModal;
  chestPreload(caseDef, CHEST_SHAKE_SEQ);
  const buyArt = modal.querySelector('.buy-art');
  buyArt.onclick = () => chestTap(buyArt.querySelector('.chest-art'), caseDef);
  const oddsBtn = modal.querySelector('#contents-odds-btn');
  oddsBtn.onclick = () => {
    const box = modal.querySelector('#contents-odds');
    box.hidden = !box.hidden;
    oddsBtn.setAttribute('aria-expanded', String(!box.hidden));
    oddsBtn.textContent = box.hidden ? 'See drop odds' : 'Hide drop odds';
    if (!box.hidden) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  const openBtn = modal.querySelector('#contents-open');
  if (openBtn && !openBtn.disabled) {
    openBtn.onclick = () => {
      closeModal();
      openCase(caseId);
    };
  }
  const more = modal.querySelector('#contents-more');
  if (more) {
    more.onclick = () => {
      closeModal();
      shopTab = 'packs';
      if (mountedKey === 'shop') renderShopScreen();
    };
  }
}

// ----------------------------------------------------------- zvuky ---
// (soubory v sfx/, přehrává playSfx ze sounds.js)

function revealSound(rarity, duplicate) {
  playSfx(rarity === 'legendary' ? 'impact' : `reveal-${rarity}`); // legendary = hluboká rána (+ třpyt níže)
  if (rarity === 'legendary') setTimeout(() => playSfx('sparkle'), 200); // k hluboké ráně se přidá třpyt
  if (duplicate) setTimeout(() => playSfx('coins'), 500); // vrácené mince za duplikát
}

// ------------------------------------------------------- otevírání ---

const STRIP_CARD = 98;
const STRIP_GAP = 10;
const STRIP_STEP = STRIP_CARD + STRIP_GAP;
const STRIP_LENGTH = 48;
const STRIP_WIN_INDEX = 40;
const SPIN_MS = 4500; // style sheet: 4,5 s, cubic-bezier(.1,.7,.1,1)

// Oslava podle vzácnosti — vždy barevná (žádná bílá), počet částic je omezený
// kvůli telefonům. rays = velké otáčivé paprsky za kartou, coins = zlatý déšť.
const CASE_FX = {
  common:    { n: 10, cols: ['#60A5FA', '#93C5FD', '#3B82F6'], coinEvery: 0, rays: false, coins: 0 },
  rare:      { n: 24, cols: ['#A855F7', '#C084FC', '#7C3AED', '#F472B6'], coinEvery: 0, rays: false, coins: 0 },
  epic:      { n: 36, cols: ['#EC4899', '#F472B6', '#A855F7', '#FB923C'], coinEvery: 0, rays: true, coins: 0 },
  legendary: { n: 46, cols: ['#F0B429', '#FDE047', '#FB923C', '#F59E0B', '#EF4444'], coinEvery: 4, rays: true, coins: 14 },
  mythic:    { n: 50, cols: ['#FF3D7F', '#FDE047', '#22D3EE', '#A855F7', '#22C55E'], coinEvery: 5, rays: true, coins: 10 },
};

const caseReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Barevný prsk konfet (využívá styly .wheel-confetti z kola štěstí).
// x/y = střed prsknutí v px vůči overlayi.
function caseBurst(overlay, cols, n, big, x, y, coinEvery = 0) {
  if (caseReducedMotion() || !overlay.isConnected) return;
  const box = document.createElement('div');
  box.className = 'wheel-confetti case-fx';
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
  let html = '';
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const dist = (big ? 110 : 70) + Math.random() * (big ? 120 : 60);
    const coin = coinEvery && i % coinEvery === 0;
    html += `<i class="${coin ? 'wc-coin' : 'wc-bit'}" style="--dx:${(Math.cos(ang) * dist).toFixed(0)}px;--dy:${(Math.sin(ang) * dist - 30).toFixed(0)}px;--rot:${Math.round(Math.random() * 540 - 270)}deg;--c:${cols[i % cols.length]};animation-delay:${(Math.random() * 0.12).toFixed(2)}s"></i>`;
  }
  box.innerHTML = html;
  overlay.appendChild(box);
  setTimeout(() => box.remove(), 2200);
}

// Zlatý déšť mincí shora (legendary / mythic) — jen transform + opacity.
function caseCoinRain(overlay, n) {
  if (caseReducedMotion() || !overlay.isConnected) return;
  const box = document.createElement('div');
  box.className = 'case-rain';
  let html = '';
  for (let i = 0; i < n; i++) {
    html += `<i style="left:${(4 + (i / n) * 92 + Math.random() * 5).toFixed(1)}%;animation-delay:${(Math.random() * 0.9).toFixed(2)}s;animation-duration:${(1.4 + Math.random() * 0.8).toFixed(2)}s;--rot:${Math.round(Math.random() * 360)}deg"></i>`;
  }
  box.innerHTML = html;
  overlay.appendChild(box);
  setTimeout(() => box.remove(), 3200);
}

// Velké barevné paprsky za kartou výhry (epic+).
function caseRays(overlay, rarityKey) {
  const ray = document.createElement('div');
  ray.className = `case-bigrays rays-${rarityKey}`;
  overlay.insertBefore(ray, overlay.firstChild);
}

function stripCardHtml(item, extraClass = '') {
  const frame = item.section === 'frame';
  return `
    <div class="strip-card ${extraClass}" style="--rc:${RARITIES[item.rarity].color}">
      ${frame ? shopItemPreview(sectionOf(item), item) : `<span class="strip-aa" style="${nameStyleFor(item)}">Aa</span>`}
      <div class="strip-card-name">${RARITIES[item.rarity].label}</div>
    </div>`;
}

// Ukazatel (žlutý trojúhelník) — shora i zdola, při cvaknutí poskočí.
const STRIP_POINTER_SVG = `<svg viewBox="0 0 28 22" aria-hidden="true"><path d="M2 2h24L14 20z" fill="#FFD23F" stroke="#A37A00" stroke-width="3" stroke-linejoin="round"/></svg>`;

// cubic-bezier(x1, y1, x2, y2) jako funkce času (0–1) → pokrok (0–1); stejná křivka jako v CSS
function cubicBezierEase(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t;
  const Y = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (X(mid) < x) lo = mid; else hi = mid;
    }
    return Y((lo + hi) / 2);
  };
}
const ROULETTE_EASE = cubicBezierEase(0.1, 0.7, 0.1, 1);

function openCase(caseId, { free = false } = {}) {
  const caseDef = caseById(caseId);
  if (!isCaseAvailable(caseDef)) return showToast('This chest is no longer available.');
  const d = shopLoad();
  if (!free && caseIsFree(caseDef, d)) {
    free = true;
    d.freeOpened = [...(d.freeOpened || []), caseDef.id];
  }
  if (!free && d.coins < caseDef.price) return showToast('Not enough coins.');

  if (!free && !isDevMode()) d.coins -= caseDef.price;
  const won = rollItem(caseDef);
  const duplicate = d.owned.includes(won.id);
  const refund = duplicate ? RARITIES[won.rarity].refund : 0;
  if (duplicate) d.coins += refund;
  else d.owned.push(won.id);
  shopSave(d);

  showCaseOverlay(caseDef, won, duplicate, refund);
}

function showCaseOverlay(caseDef, won, duplicate, refund) {
  playSfx('chest-open'); // cvaknutí zámku
  playSfx('chest-riser'); // narůstající napětí, než se pás zastaví
  closeCaseOverlay();
  const strip = Array.from({ length: STRIP_LENGTH }, (_, i) => (i === STRIP_WIN_INDEX ? won : rollItem(caseDef)));
  const reduced = caseReducedMotion();

  const overlay = document.createElement('div');
  overlay.id = 'case-overlay';
  overlay.className = 'case-overlay chest-overlay';
  overlay.innerHTML = `
    <button class="x-close case-x" id="reveal-close" aria-label="Close" hidden>${icon('close')}</button>
    <div class="case-stage">
      <div class="roul-head">
        <span class="roul-eyebrow">OPENING</span>
        <h2 class="case-title">${caseDef.name}</h2>
      </div>
      <div class="chest-stage ${reduced ? '' : 'shake'}" id="chest-stage">
        <div class="chest-rays"></div>
        ${caseSvg(caseDef, { crop: false })}
      </div>
      <div class="strip-window" id="strip-window">
        <div class="strip-marker"><i class="strip-line"></i><span class="strip-pointer top">${STRIP_POINTER_SVG}</span><span class="strip-pointer bottom">${STRIP_POINTER_SVG}</span></div>
        <div class="strip" id="strip">${strip.map((item, i) => stripCardHtml(item, i === STRIP_WIN_INDEX ? 'is-win' : '')).join('')}</div>
      </div>
      <button type="button" class="roul-skip" id="case-skip">Tap to skip</button>
      <div class="case-reveal" id="case-reveal"></div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('no-scroll');

  const chestStage = overlay.querySelector('#chest-stage');
  const chestArt = chestStage.querySelector('.chest-art');
  chestPreload(caseDef); // všech 10 stavů předem (otevření začne až za pár vteřin)
  let shakeLoop = null;
  if (!reduced) shakeLoop = chestPlay(chestArt, caseDef, ['shake-1', 'shake-2', 'shake-3', 'shake-2'], 110, { loop: true });
  const skipBtn = overlay.querySelector('#case-skip');
  const alive = () => overlay.isConnected;
  const win = overlay.querySelector('#strip-window');
  const stripEl = overlay.querySelector('#strip');
  const pointers = overlay.querySelectorAll('.strip-pointer');
  let done = false;
  let skipped = false;

  // pás zastaví pod ukazatelem, truhla otevře víko a po chvíli se ukáže výhra
  function finish() {
    if (done || !alive()) return;
    done = true;
    skipBtn.hidden = true;
    chestStage.classList.remove('shake');
    if (shakeLoop) shakeLoop.stop();
    if (!reduced) {
      chestStage.classList.add('pop');
      // víko se otevře po stavech 25 → 60 → 100 %, rozsvítí se inner-glow a truhla se vyprázdní
      chestPlay(chestArt, caseDef, ['open-25', 'open-60', 'open-100', 'open-100', 'empty'], 130);
      setTimeout(() => chestArt.classList.add('glow-on'), 140); // světlo svítí, dokud je víko nahoře
      setTimeout(() => chestArt.classList.remove('glow-on'), 540);
      const r = chestStage.getBoundingClientRect();
      const o = overlay.getBoundingClientRect();
      const col = caseDef.colors;
      caseBurst(overlay, [col.trim[0], col.lid[0], '#F472B6', '#60A5FA', '#34D399', '#FB923C'], 22, true,
        r.left - o.left + r.width / 2, r.top - o.top + r.height * 0.55, 4);
    } else {
      chestArt.querySelector('.ch-img').src = chestUrl(caseDef, 'open-100');
      chestArt.classList.add('glow-on');
    }
    setTimeout(() => { if (alive()) showReveal(caseDef, won, duplicate, refund); }, reduced ? 250 : 750);
  }

  const windowWidth = win.clientWidth;
  // náhodný posun v rámci výherní karty, ať to nekončí pokaždé přesně na středu
  const jitter = (randomFloat() - 0.5) * STRIP_CARD * 0.6;
  const target = STRIP_WIN_INDEX * STRIP_STEP + STRIP_CARD / 2 - windowWidth / 2 + jitter;

  skipBtn.onclick = () => {
    if (done || skipped) return;
    skipped = true;
    stripEl.style.transform = `translate3d(${-target}px,0,0)`;
    finish();
  };

  if (reduced) {
    // bez animace: rovnou na výhře a výsledek
    stripEl.style.transform = `translate3d(${-target}px,0,0)`;
    finish();
    return;
  }

  // 4,5 s, zpomalení cubic-bezier(.1,.7,.1,1), dojede přesně pod žlutou značku
  const start = performance.now() + 350; // krátká pauza, ať truhla chvíli zavrčí
  let lastTick = -1;
  let lastBump = 0;
  function frame(now) {
    if (!alive() || skipped) return;
    const t = Math.min(1, Math.max(0, (now - start) / SPIN_MS));
    const x = target * ROULETTE_EASE(t);
    stripEl.style.transform = `translate3d(${-x}px,0,0)`;
    // cvaknutí pokaždé, když pod ukazatelem projede další karta
    const under = Math.floor((x + windowWidth / 2) / STRIP_STEP);
    if (under !== lastTick) {
      if (lastTick !== -1) {
        playSfx('chest-tick');
        // ukazatel poskočí (při rychlém průjezdu max ~každých 45 ms)
        if (now - lastBump > 45) {
          lastBump = now;
          pointers.forEach((p) => p.animate(
            [{ transform: 'translateX(-50%) rotate(0deg) scale(1)' },
             { transform: 'translateX(-50%) rotate(-12deg) scale(1.1,0.9)', offset: 0.35 },
             { transform: 'translateX(-50%) rotate(4deg) scale(0.97,1.05)', offset: 0.7 },
             { transform: 'translateX(-50%) rotate(0deg) scale(1)' }],
            { duration: 170, easing: 'ease-out' }));
        }
      }
      lastTick = under;
    }
    if (t < 1) requestAnimationFrame(frame);
    else finish();
  }
  requestAnimationFrame(frame);
}

function showReveal(caseDef, won, duplicate, refund) {
  const overlay = document.getElementById('case-overlay');
  if (!overlay) return;
  overlay.classList.add('is-revealed');
  revealSound(won.rarity, duplicate);
  playSkinSfx(won.id); // kočka / dino / drak mají vlastní zvuk

  const rarity = RARITIES[won.rarity];
  const fx = CASE_FX[won.rarity] || CASE_FX.common;
  const coins = shopLoad().coins;
  const reveal = document.getElementById('case-reveal');
  reveal.style.setProperty('--rc', rarity.color);
  const kind = won.section === 'frame' ? 'Photo frame' : 'Name color';
  reveal.innerHTML = `
    ${duplicate ? '<span class="reveal-banner">Already in your collection</span>' : '<span class="reveal-new">NEW!</span>'}
    <div class="reveal-card rar-${won.rarity} ${won.rarity === 'mythic' ? 'is-mythic' : ''}">
      <div class="reveal-rays"></div>
      <div class="reveal-rarity"><i></i>${rarity.label}</div>
      <div class="reveal-preview">${shopItemPreview(sectionOf(won), won, true)}</div>
      <div class="reveal-title">
        <div class="reveal-name">${won.name}</div>
        <div class="reveal-kind">${kind}</div>
      </div>
      ${duplicate ? '<span class="reveal-x2" aria-hidden="true">×2</span>' : ''}
    </div>
    ${duplicate ? `<div class="reveal-dup">${COIN_SVG}<span class="reveal-dup-text"><b class="num">+${refund} coins</b><small>Duplicate turned into coins</small></span></div>` : ''}
    <div class="reveal-actions">
      ${duplicate
        ? '<button class="btn btn-primary btn-block reveal-main" id="reveal-collect">Collect</button>'
        : '<button class="btn btn-primary btn-block reveal-main" id="reveal-equip">Equip now</button>'}
      <button class="btn btn-ghost btn-block" id="reveal-again" ${coins < caseDef.price ? 'disabled' : ''}>
        Open another ${COIN_SVG}<span class="num">${caseDef.price}</span>
      </button>
      ${duplicate ? '' : '<button class="btn btn-ghost btn-block" id="reveal-back">Back to shop</button>'}
    </div>`;
  reveal.classList.add('show');
  document.getElementById('reveal-close').hidden = false;

  // oslava podle vzácnosti
  if (!caseReducedMotion()) {
    const card = reveal.querySelector('.reveal-card');
    const r = card.getBoundingClientRect();
    const o = overlay.getBoundingClientRect();
    caseBurst(overlay, fx.cols, fx.n, won.rarity !== 'common', r.left - o.left + r.width / 2, r.top - o.top + r.height * 0.4, fx.coinEvery);
    if (fx.rays) caseRays(overlay, won.rarity);
    if (fx.coins) caseCoinRain(overlay, fx.coins);
  }

  const equip = document.getElementById('reveal-equip');
  if (equip) {
    equip.onclick = () => {
      const d = shopLoad();
      d.equipped[won.section] = won.id;
      shopSave(d);
      showToast(`Equipped: ${won.name}`);
      closeCaseOverlay();
      renderShopScreen();
    };
  }
  const again = document.getElementById('reveal-again');
  if (again) {
    again.onclick = () => {
      closeCaseOverlay();
      renderShopScreen();
      openCase(caseDef.id);
    };
  }
  const closeAll = () => {
    closeCaseOverlay();
    renderShopScreen();
  };
  document.getElementById('reveal-close').onclick = closeAll;
  ['reveal-back', 'reveal-collect'].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.onclick = closeAll;
  });
}

function closeCaseOverlay() {
  const el = document.getElementById('case-overlay');
  if (el) el.remove();
  document.body.classList.remove('no-scroll');
}
