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
  {
    id: 'spooky',
    name: 'Spooky Chest',
    price: 125,
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
    price: 75,
    // barevný párty mix rámečků i jmen
    items: [
      'frame-sunset', 'frame-grape', 'frame-sand', 'frame-neon', 'frame-candy', 'frame-aurora', 'frame-music', 'frame-sweets',
      'name-pink', 'name-peach', 'name-coral', 'name-sunset', 'name-candy', 'name-aurora', 'name-rainbow',
    ],
    odds: { common: 57, rare: 28, epic: 13, legendary: 2 },
    colors: { body: ['#8B3CF0', '#4C1D95'], lid: ['#A78BFA', '#7C3AED'], trim: ['#FDE68A', '#D97706'] },
    glow: 'rgba(240,180,41,0.35)',
  },
  {
    id: 'frames',
    name: 'Frame Chest',
    price: 100,
    // živly: led, les, oceán, jed, oheň, láva, mráz, blesk, vesmír
    items: [
      'frame-ice', 'frame-forest', 'frame-mint', 'frame-slate', 'frame-night', 'frame-ocean', 'frame-toxic', 'frame-deepsea',
      'frame-fire', 'frame-lava', 'frame-frost', 'frame-electric', 'frame-galaxy', 'frame-phoenix',
    ],
    odds: { common: 52, rare: 30, epic: 15, legendary: 3 },
    colors: { body: ['#0EA5E9', '#0C4A6E'], lid: ['#7DD3FC', '#0284C7'], trim: ['#E0F2FE', '#94A3B8'] },
    glow: 'rgba(56,189,248,0.35)',
  },
  {
    id: 'names',
    name: 'Name Chest',
    price: 50,
    // barvy jmen ve stejných živlech jako Truhla rámečků
    items: [
      'name-violet', 'name-mint', 'name-sky', 'name-lime', 'name-gold', 'name-ice', 'name-toxic', 'name-deepsea',
      'name-fire', 'name-frost', 'name-electric', 'name-galaxy', 'name-phoenix',
    ],
    odds: { common: 61, rare: 26, epic: 11, legendary: 2 },
    colors: { body: ['#10B981', '#065F46'], lid: ['#6EE7B7', '#059669'], trim: ['#FDE68A', '#D97706'] },
    glow: 'rgba(52,211,153,0.35)',
  },
  {
    id: 'legend',
    name: 'Legendary Chest',
    price: 250,
    // nejprestižnější kousky
    items: [
      'frame-rose', 'frame-sakura', 'frame-mango', 'frame-gold', 'frame-chrome', 'frame-love', 'frame-rainbow', 'frame-diamond', 'frame-king',
      'name-sand', 'name-sakura', 'name-mango', 'name-chrome', 'name-love', 'name-diamond', 'name-king',
    ],
    odds: { common: 15, rare: 44, epic: 33, legendary: 8 },
    colors: { body: ['#1F1235', '#0B0616'], lid: ['#3B2463', '#1F1235'], trim: ['#FDE68A', '#F59E0B'] },
    glow: 'rgba(245,158,11,0.55)',
  },
];
// (Daily Chest nahradilo kolo štěstí — wheel.js)

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
  if (days >= 2) return `${days} days left`;
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m left` : `${mins}m left`;
}

function casePool(caseDef) {
  if (!caseDef.items) return ALL_ITEMS.filter((item) => !EXCLUSIVE_ITEMS.has(item.id));
  return ALL_ITEMS.filter((item) => caseDef.items.includes(item.id));
}

// Kontrola při vývoji: každý skin musí být aspoň v jedné truhle (může
// být i ve více, ale exkluzivní skiny jen ve své truhle), žádné neznámé id
// a v každé truhle všechny 4 vzácnosti.
(() => {
  const counts = {};
  for (const c of CASES) for (const id of c.items || []) counts[id] = (counts[id] || 0) + 1;
  const missing = ALL_ITEMS.filter((i) => !counts[i.id] && !i.wheelOnly).map((i) => i.id);
  const unknown = Object.keys(counts).filter((id) => !ALL_ITEMS.some((i) => i.id === id));
  const noRarity = CASES.filter((c) => c.items).flatMap((c) => RARITY_ORDER
    .filter((r) => !casePool(c).some((i) => i.rarity === r)).map((r) => `${c.id}:${r}`));
  const leaked = [...EXCLUSIVE_ITEMS].filter((id) => counts[id] > 1);
  if (missing.length || unknown.length || noRarity.length || leaked.length) {
    console.warn('Chests: missing', missing, 'unknown', unknown, 'rarity missing', noRarity, 'exclusive elsewhere', leaked);
  }
})();

// Obrázek truhly obarvený podle truhly (id gradientů musí být unikátní,
// jinak by si SVG na jedné stránce navzájem přepisovaly barvy).
// Každá truhla má i vlastní tvar a ozdoby (CHEST_STYLES podle id truhly),
// ať se od sebe liší na první pohled, nejen barvou.

// Zámek s hvězdou — výchozí zámek truhly
function chestStarLock(k) {
  return `<rect x="48" y="34" width="24" height="24" rx="5" fill="url(#${k}-trim)" stroke="#000" stroke-opacity="0.3" stroke-width="1.5"/>
    <path d="M60 40.5 L62 45 L67 45.5 L63.3 48.7 L64.4 53.5 L60 51 L55.6 53.5 L56.7 48.7 L53 45.5 L58 45 Z" fill="#000" fill-opacity="0.45"/>`;
}

const CHEST_STYLES = {
  // Party — klasická truhla s mašlí nahoře a konfetami kolem
  party: (k) => `
    <rect x="14" y="40" width="92" height="52" rx="8" fill="url(#${k}-body)"/>
    <path d="M10 30 Q10 20 20 20 H100 Q110 20 110 30 V42 H10 Z" fill="url(#${k}-lid)"/>
    <rect x="10" y="40" width="100" height="6" fill="#000" opacity="0.25"/>
    <rect x="26" y="20" width="8" height="72" fill="url(#${k}-trim)"/>
    <rect x="86" y="20" width="8" height="72" fill="url(#${k}-trim)"/>
    ${chestStarLock(k)}
    <rect x="14" y="21" width="92" height="3" rx="1.5" fill="#fff" opacity="0.35"/>
    <path d="M60 20 C52 8 40 10 44 18 C46 22 54 21 60 20 Z" fill="#F472B6" stroke="#9D174D" stroke-width="1"/>
    <path d="M60 20 C68 8 80 10 76 18 C74 22 66 21 60 20 Z" fill="#F472B6" stroke="#9D174D" stroke-width="1"/>
    <circle cx="60" cy="19" r="3.4" fill="#EC4899" stroke="#9D174D" stroke-width="1"/>
    <rect x="12" y="8" width="5" height="2.6" rx="1.2" fill="#34D399" transform="rotate(-30 14 9)"/>
    <rect x="100" y="6" width="5" height="2.6" rx="1.2" fill="#FBBF24" transform="rotate(35 102 7)"/>
    <circle cx="24" cy="12" r="2" fill="#60A5FA"/>
    <circle cx="96" cy="15" r="1.8" fill="#F472B6"/>
    <rect x="4" y="52" width="4.5" height="2.4" rx="1.2" fill="#F472B6" transform="rotate(60 6 53)"/>
    <rect x="111" y="58" width="4.5" height="2.4" rx="1.2" fill="#34D399" transform="rotate(-40 113 59)"/>`,

  // Frame — kovová bedna: rovné víko, rohová kování a nýty
  frames: (k) => `
    <rect x="12" y="40" width="96" height="52" rx="4" fill="url(#${k}-body)"/>
    <rect x="9" y="22" width="102" height="20" rx="4" fill="url(#${k}-lid)"/>
    <rect x="9" y="40" width="102" height="5" fill="#000" opacity="0.28"/>
    <rect x="12" y="23" width="96" height="2.6" rx="1.3" fill="#fff" opacity="0.4"/>
    <g fill="url(#${k}-trim)" stroke="#000" stroke-opacity="0.25" stroke-width="1">
      <path d="M12 58 V44 H26 V49 H17 V58 Z"/>
      <path d="M108 58 V44 H94 V49 H103 V58 Z"/>
      <path d="M12 76 V91 H26 V86 H17 V76 Z"/>
      <path d="M108 76 V91 H94 V86 H103 V76 Z"/>
    </g>
    <g fill="#fff" fill-opacity="0.75">
      <circle cx="16" cy="31" r="1.8"/><circle cx="104" cy="31" r="1.8"/>
      <circle cx="21" cy="47" r="1.4"/><circle cx="99" cy="47" r="1.4"/>
      <circle cx="21" cy="88" r="1.4"/><circle cx="99" cy="88" r="1.4"/>
    </g>
    <rect x="47" y="33" width="26" height="26" rx="4" fill="url(#${k}-trim)" stroke="#000" stroke-opacity="0.3" stroke-width="1.5"/>
    <rect x="52.5" y="38.5" width="15" height="15" rx="3.5" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="2.4"/>
    <circle cx="60" cy="46" r="2.6" fill="#000" fill-opacity="0.45"/>`,

  // Name — dřevěná truhla s prkny a písmenem na zámku
  names: (k) => `
    <rect x="14" y="40" width="92" height="52" rx="7" fill="url(#${k}-body)"/>
    <path d="M14 58 H106 M14 75 H106" stroke="#000" stroke-opacity="0.22" stroke-width="1.6"/>
    <path d="M10 30 Q10 20 20 20 H100 Q110 20 110 30 V42 H10 Z" fill="url(#${k}-lid)"/>
    <path d="M10 31 H110" stroke="#000" stroke-opacity="0.18" stroke-width="1.4"/>
    <rect x="10" y="40" width="100" height="6" fill="#000" opacity="0.25"/>
    <rect x="14" y="21" width="92" height="3" rx="1.5" fill="#fff" opacity="0.35"/>
    <g fill="url(#${k}-trim)">
      <rect x="18" y="20" width="7" height="72" rx="1"/>
      <rect x="95" y="20" width="7" height="72" rx="1"/>
    </g>
    <path d="M48 34 H72 V52 L60 60 L48 52 Z" fill="url(#${k}-trim)" stroke="#000" stroke-opacity="0.3" stroke-width="1.5" stroke-linejoin="round"/>
    <text x="60" y="51" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="800" font-size="14" fill="#000" fill-opacity="0.5">A</text>`,

  // Legendary — vysoké klenuté víko, zlaté rohy, drahokam a korunka
  legend: (k) => `
    <rect x="12" y="44" width="96" height="50" rx="7" fill="url(#${k}-body)"/>
    <path d="M8 46 V34 Q8 12 60 10 Q112 12 112 34 V46 Z" fill="url(#${k}-lid)"/>
    <path d="M8 44 H112" stroke="url(#${k}-trim)" stroke-width="3"/>
    <rect x="8" y="45.5" width="104" height="5" fill="#000" opacity="0.3"/>
    <path d="M20 18 Q60 8 100 18" stroke="#fff" stroke-opacity="0.3" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <g fill="url(#${k}-trim)" stroke="#000" stroke-opacity="0.25" stroke-width="1">
      <rect x="24" y="12" width="7" height="82" rx="2"/>
      <rect x="89" y="12" width="7" height="82" rx="2"/>
      <path d="M12 94 V78 L24 94 Z"/><path d="M108 94 V78 L96 94 Z"/>
      <path d="M8 34 V46 H18 Z"/><path d="M112 34 V46 H102 Z"/>
    </g>
    <path d="M60 32 L72 44 L60 60 L48 44 Z" fill="#A855F7" stroke="url(#${k}-trim)" stroke-width="3" stroke-linejoin="round"/>
    <path d="M60 32 L66 44 L60 60 L54 44 Z" fill="#E9D5FF" fill-opacity="0.55"/>
    <path d="M48 44 H72" stroke="#fff" stroke-opacity="0.5" stroke-width="1"/>
    <path d="M44 10 L48 0 L54 6 L60 -3 L66 6 L72 0 L76 10 Z" fill="url(#${k}-trim)" stroke="#92400E" stroke-width="1.2" stroke-linejoin="round"/>
    <circle cx="60" cy="4" r="1.8" fill="#EF4444"/>`,

  // Spooky — dýňový zámek, sliz stékající z víka a prasklina
  spooky: (k) => `
    <rect x="14" y="40" width="92" height="52" rx="8" fill="url(#${k}-body)"/>
    <path d="M10 30 Q10 20 20 20 H100 Q110 20 110 30 V42 H10 Z" fill="url(#${k}-lid)"/>
    <path d="M78 20 L74 28 L80 32 L76 41" stroke="#000" stroke-opacity="0.35" stroke-width="1.4" fill="none" stroke-linejoin="round"/>
    <rect x="10" y="40" width="100" height="6" fill="#000" opacity="0.25"/>
    <rect x="26" y="20" width="8" height="72" fill="url(#${k}-trim)"/>
    <rect x="86" y="20" width="8" height="72" fill="url(#${k}-trim)"/>
    <path d="M10 42 H110 V46 Q106 46 105 52 Q104 57 101 52 Q100 46 92 46 H44 Q40 46 39 55 Q38 60 35 55 Q34 46 28 46 H18 Q15 46 14 50 Q13 53 11 49 Z" fill="#84CC16"/>
    <rect x="14" y="21" width="92" height="3" rx="1.5" fill="#fff" opacity="0.3"/>
    <ellipse cx="60" cy="47" rx="13" ry="11.5" fill="#F97316" stroke="#7C2D12" stroke-width="1.4"/>
    <path d="M60 36 q2 -5 5 -5" stroke="#4D7C0F" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <path d="M53 45 l3 -5 l3 5 Z M61 45 l3 -5 l3 5 Z" fill="#FDE047"/>
    <path d="M52 49 q8 7 16 0 l-3 2.4 l-2.5 -1.6 l-2.5 2 l-2.5 -2 l-2.5 1.6 Z" fill="#FDE047"/>`,

  // Daily — dárková krabice s mašlí (zdarma za reklamu)
  daily: (k) => `
    <rect x="16" y="42" width="88" height="50" rx="6" fill="url(#${k}-body)"/>
    <rect x="11" y="28" width="98" height="16" rx="5" fill="url(#${k}-lid)"/>
    <rect x="11" y="42" width="98" height="5" fill="#000" opacity="0.22"/>
    <rect x="14" y="29" width="92" height="2.6" rx="1.3" fill="#fff" opacity="0.4"/>
    <rect x="54" y="28" width="12" height="64" fill="url(#${k}-trim)"/>
    <path d="M60 28 C50 12 34 14 40 24 C43 29 52 28 60 28 Z" fill="url(#${k}-trim)" stroke="#000" stroke-opacity="0.2" stroke-width="1"/>
    <path d="M60 28 C70 12 86 14 80 24 C77 29 68 28 60 28 Z" fill="url(#${k}-trim)" stroke="#000" stroke-opacity="0.2" stroke-width="1"/>
    <circle cx="60" cy="27" r="4" fill="url(#${k}-trim)" stroke="#000" stroke-opacity="0.25" stroke-width="1"/>`,
};

function caseSvg(caseDef) {
  const k = `case-${caseDef.id}`;
  const { body, lid, trim } = caseDef.colors;
  const draw = CHEST_STYLES[caseDef.id] || CHEST_STYLES.party;
  // Truhla (.case-chest) a stín pod ní (.case-shadow) jsou zvlášť, ať se
  // můžou animovat proti sobě — truhla nahoru, stín se zmenší a zeslábne.
  // viewBox začíná nad nulou, aby se vešly ozdoby nad víkem (mašle, koruna).
  return `<svg viewBox="0 -6 120 118" aria-hidden="true">
    <defs>
      <linearGradient id="${k}-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${body[0]}"/><stop offset="1" stop-color="${body[1]}"/></linearGradient>
      <linearGradient id="${k}-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lid[0]}"/><stop offset="1" stop-color="${lid[1]}"/></linearGradient>
      <linearGradient id="${k}-trim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${trim[0]}"/><stop offset="1" stop-color="${trim[1]}"/></linearGradient>
      <radialGradient id="${k}-shadow"><stop offset="0" stop-color="#000" stop-opacity="0.6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse class="case-shadow" cx="60" cy="104" rx="50" ry="7" fill="url(#${k}-shadow)"/>
    <g class="case-chest">${draw(k)}</g>
  </svg>`;
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

// ------------------------------------------------ co může padnout ---

function showCaseContents(caseId) {
  const caseDef = caseById(caseId);
  const data = shopLoad();

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
          ${owned ? `<span class="drop-owned">${icon('check')}</span>` : ''}
        </div>`;
    }).join('');

  const modal = openModal(`
    <div class="x-close-row"><button class="x-close" id="contents-close" aria-label="Close">${icon('close')}</button></div>
    <div class="case-contents-head" style="--case-glow:${caseDef.glow}">
      <div class="case-art small">${caseSvg(caseDef)}</div>
      <h2>${caseDef.name}</h2>
    </div>
    <div class="odds-row">${oddsHtml}</div>
    <div class="drop-grid">${dropsHtml}</div>
    <button class="case-open-btn wide" id="contents-open">Open ${COIN_SVG}<span class="num">${caseDef.price}</span></button>
  `);
  const openBtn = modal.querySelector('#contents-open');
  if (openBtn) {
    openBtn.onclick = () => {
      closeModal();
      openCase(caseId);
    };
  }
  modal.querySelector('#contents-close').onclick = closeModal;
}

// ----------------------------------------------------------- zvuky ---
// (soubory v sfx/, přehrává playSfx ze sounds.js)

function revealSound(rarity, duplicate) {
  playSfx(`reveal-${rarity}`);
  if (duplicate) setTimeout(() => playSfx('coins'), 500); // vrácené mince za duplikát
}

// ------------------------------------------------------- otevírání ---

const STRIP_CARD = 112;
const STRIP_GAP = 8;
const STRIP_STEP = STRIP_CARD + STRIP_GAP;
const STRIP_LENGTH = 60;
const STRIP_WIN_INDEX = 52;
const SPIN_MS = 6500;

function stripCardHtml(item, extraClass = '') {
  return `
    <div class="strip-card ${extraClass}" style="--rc:${RARITIES[item.rarity].color}">
      ${shopItemPreview(sectionOf(item), item)}
      <div class="strip-card-name">${item.name}</div>
    </div>`;
}

function openCase(caseId, { free = false } = {}) {
  const caseDef = caseById(caseId);
  if (!isCaseAvailable(caseDef)) return showToast('This chest is no longer available.');
  const d = shopLoad();
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
  playSfx('chest-open');
  closeCaseOverlay();
  const strip = Array.from({ length: STRIP_LENGTH }, (_, i) => (i === STRIP_WIN_INDEX ? won : rollItem(caseDef)));

  const overlay = document.createElement('div');
  overlay.id = 'case-overlay';
  overlay.className = 'case-overlay';
  overlay.innerHTML = `
    <button class="x-close case-x" id="reveal-close" aria-label="Close" hidden>${icon('close')}</button>
    <div class="case-stage">
      <h2 class="case-title">${caseDef.name}</h2>
      <div class="strip-window" id="strip-window">
        <div class="strip-marker"></div>
        <div class="strip" id="strip">${strip.map((item, i) => stripCardHtml(item, i === STRIP_WIN_INDEX ? 'is-win' : '')).join('')}</div>
      </div>
      <div class="case-reveal" id="case-reveal"></div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('no-scroll');

  const win = document.getElementById('strip-window');
  const stripEl = document.getElementById('strip');
  const windowWidth = win.clientWidth;
  // náhodný posun v rámci výherní karty, ať to nekončí pokaždé přesně na středu
  const jitter = (randomFloat() - 0.5) * STRIP_CARD * 0.8;
  const target = STRIP_WIN_INDEX * STRIP_STEP + STRIP_CARD / 2 - windowWidth / 2 + jitter;

  const start = performance.now();
  let lastTick = -1;
  const ease = (t) => 1 - Math.pow(1 - t, 4);

  function frame(now) {
    const t = Math.min(1, (now - start) / SPIN_MS);
    const x = target * ease(t);
    stripEl.style.transform = `translateX(${-x}px)`;
    // cvaknutí pokaždé, když pod značkou projede další karta
    const under = Math.floor((x + windowWidth / 2) / STRIP_STEP);
    if (under !== lastTick) {
      if (lastTick !== -1) playSfx('chest-tick');
      lastTick = under;
    }
    if (t < 1) requestAnimationFrame(frame);
    else setTimeout(() => showReveal(caseDef, won, duplicate, refund), 450);
  }
  requestAnimationFrame(frame);
}

function showReveal(caseDef, won, duplicate, refund) {
  const overlay = document.getElementById('case-overlay');
  if (!overlay) return;
  overlay.querySelector('.strip-card.is-win').classList.add('highlight');
  revealSound(won.rarity, duplicate);

  const rarity = RARITIES[won.rarity];
  const coins = shopLoad().coins;
  const reveal = document.getElementById('case-reveal');
  reveal.style.setProperty('--rc', rarity.color);
  reveal.innerHTML = `
    <div class="reveal-card">
      <div class="reveal-rays"></div>
      <div class="reveal-rarity">${rarity.label}</div>
      <div class="reveal-preview">${shopItemPreview(sectionOf(won), won)}</div>
      <div class="reveal-name">${won.name}</div>
      <div class="reveal-kind">${sectionOf(won).title}</div>
      ${duplicate
        ? `<div class="reveal-dup">Duplicate — you get ${COIN_SVG}<span class="num">+${refund}</span></div>`
        : `<div class="reveal-new">New!</div>`}
    </div>
    <div class="reveal-actions">
      ${duplicate ? '' : `<button class="btn btn-primary btn-block" id="reveal-equip">Equip</button>`}
      <button class="btn ${duplicate ? 'btn-primary' : 'btn-ghost'} btn-block" id="reveal-again" ${coins < caseDef.price ? 'disabled' : ''}>
        Open another ${COIN_SVG}<span class="num">${caseDef.price}</span>
      </button>
    </div>`;
  reveal.classList.add('show');
  document.getElementById('reveal-close').hidden = false;

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
  document.getElementById('reveal-close').onclick = () => {
    closeCaseOverlay();
    renderShopScreen();
  };
}

function closeCaseOverlay() {
  const el = document.getElementById('case-overlay');
  if (el) el.remove();
  document.body.classList.remove('no-scroll');
}
