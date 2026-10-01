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
      'name-pink', 'name-peach', 'name-coral', 'name-sunset', 'name-candy', 'name-aurora', 'name-rainbow',
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
      'frame-sky', 'frame-cocoa', 'frame-jungle', 'frame-ninja', 'frame-robot', 'frame-dino',
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

// Kreslená (cartoon) truhla: tlustý tmavý obrys ve stejném odstínu, ploché
// barvy, jeden cel-shade pruh a obarvený (ne bílý) odlesk — stejný styl jako
// kolo štěstí. Každá truhla je rozdělená na spodek (base) a víko (lid), ať
// víko při otevření může odskočit. Obrys = tmavý konec barvy těla (c.line).

// pásek (kování / stuha) — plochá barva + obrys + cel-shade
function chestBand(c, x, y, w, h) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.trim[0]}" stroke-width="2.5"/>
    <rect x="${x + w * 0.6}" y="${y + 1.2}" width="${w * 0.4 - 1.2}" height="${h - 2.4}" fill="${c.trim[1]}" opacity="0.5" stroke="none"/>`;
}

// spodek truhly: tělo, cel-shade u dna, tmavý otvor pod víkem
function chestBody(c, rx = 9) {
  return `<rect x="14" y="44" width="92" height="50" rx="${rx}" fill="${c.body[0]}"/>
    <path d="M14 78 H106 V85 Q106 94 97 94 H23 Q14 94 14 85 Z" fill="${c.body[1]}" opacity="0.55" stroke="none"/>
    <rect x="14" y="44" width="92" height="50" rx="${rx}" fill="none"/>
    <rect x="21" y="42" width="78" height="10" rx="4" fill="${c.body[1]}" stroke="none"/>
    <path d="M22 60 V70" stroke="${c.trim[0]}" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round"/>`;
}

// víko: kopule, cel-shade pruh dole, tmavší lem a barevný odlesk nahoře
function chestLid(c, top = 17, lip = true) {
  const mid = top + 16;
  return `<path d="M9 47 V${mid} Q9 ${top} 26 ${top} H94 Q111 ${top} 111 ${mid} V47 Z" fill="${c.lid[0]}"/>
    <path d="M9 38 H111 V47 H9 Z" fill="${c.lid[1]}" opacity="0.55" stroke="none"/>
    <path d="M9 47 V${mid} Q9 ${top} 26 ${top} H94 Q111 ${top} 111 ${mid} V47 Z" fill="none"/>
    ${lip ? `<rect x="7" y="43" width="106" height="7" rx="3.5" fill="${c.lid[1]}"/>` : ''}
    <path d="M20 ${top + 9} Q22 ${top + 4} 32 ${top + 4} H50" stroke="${c.trim[0]}" stroke-opacity="0.65" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
}

// kulatý zámek s hvězdou (na těle truhly)
function chestStarLock(c, cy = 62) {
  return `<circle cx="60" cy="${cy}" r="11.5" fill="${c.trim[0]}" stroke-width="2.6"/>
    <path d="M60 ${cy - 6.5} L62.3 ${cy - 1.8} L67.4 ${cy - 1.2} L63.6 ${cy + 2.2} L64.6 ${cy + 7} L60 ${cy + 4.6} L55.4 ${cy + 7} L56.4 ${cy + 2.2} L52.6 ${cy - 1.2} L57.7 ${cy - 1.8} Z" fill="${c.body[1]}" stroke="none" opacity="0.7"/>`;
}

// Každý styl vrací { base, lid } (SVG řetězce bez obalu).
const CHEST_STYLES = {
  // Party — fialová truhla se zlatou stuhou, mašlí a konfetami
  party: (k, c) => ({
    base: `${chestBody(c)}
      ${chestBand(c, 25, 44, 11, 50)}${chestBand(c, 84, 44, 11, 50)}
      ${chestStarLock(c)}`,
    lid: `${chestLid(c)}
      ${chestBand(c, 25, 17, 11, 32)}${chestBand(c, 84, 17, 11, 32)}
      <path d="M60 18 C50 2 34 4 40 14 C43 20 52 19 60 18 Z" fill="#F472B6" stroke="#9D174D" stroke-width="2.4"/>
      <path d="M60 18 C70 2 86 4 80 14 C77 20 68 19 60 18 Z" fill="#F472B6" stroke="#9D174D" stroke-width="2.4"/>
      <path d="M45 8 Q49 5 53 10" stroke="#FBCFE8" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="60" cy="18" r="5" fill="#EC4899" stroke="#9D174D" stroke-width="2.4"/>
      <g stroke="none"><rect x="13" y="24" width="6" height="3" rx="1.5" fill="#34D399" transform="rotate(-30 16 25)"/>
      <rect x="99" y="26" width="6" height="3" rx="1.5" fill="#FBBF24" transform="rotate(35 102 27)"/>
      <circle cx="46" cy="30" r="2.2" fill="#60A5FA"/><circle cx="76" cy="28" r="2" fill="#F472B6"/><circle cx="68" cy="36" r="1.8" fill="#34D399"/></g>`,
  }),

  // Frame — kovová bedna: rovné víko, rohová kování a nýty
  frames: (k, c) => ({
    base: `${chestBody(c, 6)}
      ${chestBand(c, 14, 62, 92, 9)}
      <g fill="${c.trim[0]}" stroke-width="2.2"><path d="M14 52 V44 H28 V49 H19 V52 Z"/><path d="M106 52 V44 H92 V49 H101 V52 Z"/>
      <path d="M14 82 V94 H28 V89 H19 V82 Z"/><path d="M106 82 V94 H92 V89 H101 V82 Z"/></g>
      <rect x="47" y="55" width="26" height="24" rx="5" fill="${c.trim[0]}" stroke-width="2.6"/>
      <path d="M53 55 V50 Q53 44 60 44 Q67 44 67 50 V55" fill="none" stroke-width="3"/>
      <circle cx="60" cy="65" r="3.2" fill="${c.body[1]}" stroke="none"/><rect x="58.6" y="66" width="2.8" height="7" rx="1.2" fill="${c.body[1]}" stroke="none"/>`,
    lid: `<path d="M9 47 V28 Q9 20 17 20 H103 Q111 20 111 28 V47 Z" fill="${c.lid[0]}"/>
      <path d="M9 38 H111 V47 H9 Z" fill="${c.lid[1]}" opacity="0.55" stroke="none"/>
      <path d="M9 47 V28 Q9 20 17 20 H103 Q111 20 111 28 V47 Z" fill="none"/>
      <rect x="7" y="43" width="106" height="7" rx="3.5" fill="${c.lid[1]}"/>
      ${chestBand(c, 22, 20, 12, 27)}${chestBand(c, 86, 20, 12, 27)}
      <path d="M40 26 H70" stroke="${c.trim[0]}" stroke-opacity="0.65" stroke-width="3.4" stroke-linecap="round"/>
      <g fill="${c.trim[1]}" stroke="${c.body[1]}" stroke-width="1.6"><circle cx="16" cy="30" r="2.4"/><circle cx="104" cy="30" r="2.4"/><circle cx="60" cy="33" r="2.4"/></g>`,
  }),

  // Name — dřevěná truhla s prkny, zlatými pásy a štítem s písmenem A
  names: (k, c) => ({
    base: `${chestBody(c)}
      <path d="M14 61 H106 M14 77 H106" stroke-opacity="0.55" stroke-width="2"/>
      ${chestBand(c, 19, 44, 9, 50)}${chestBand(c, 92, 44, 9, 50)}
      <path d="M46 50 H74 V66 Q74 76 60 82 Q46 76 46 66 Z" fill="${c.trim[0]}" stroke-width="2.6"/>
      <path d="M60 50 H74 V66 Q74 76 60 82 Z" fill="${c.trim[1]}" opacity="0.45" stroke="none"/>
      <text x="60" y="71" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="800" font-size="17" fill="${c.body[1]}" stroke="none">A</text>`,
    lid: `${chestLid(c)}
      <path d="M9 31 H111" stroke-opacity="0.45" stroke-width="2"/>
      ${chestBand(c, 19, 17, 9, 32)}${chestBand(c, 92, 17, 9, 32)}`,
  }),

  // Legendary — vysoké klenuté víko, zlaté kování, drahokam a koruna
  legend: (k, c) => ({
    base: `${chestBody(c)}
      <g fill="${c.trim[0]}" stroke-width="2.4"><path d="M14 94 V76 L32 94 Z"/><path d="M106 94 V76 L88 94 Z"/></g>
      ${chestBand(c, 21, 44, 9, 50)}${chestBand(c, 90, 44, 9, 50)}
      ${chestStarLock(c, 66)}`,
    lid: `<path d="M9 47 V34 Q9 10 60 8 Q111 10 111 34 V47 Z" fill="${c.lid[0]}"/>
      <path d="M9 38 H111 V47 H9 Z" fill="${c.lid[1]}" opacity="0.6" stroke="none"/>
      <path d="M9 47 V34 Q9 10 60 8 Q111 10 111 34 V47 Z" fill="none"/>
      <rect x="7" y="43" width="106" height="7" rx="3.5" fill="${c.trim[0]}"/>
      <path d="M20 22 Q28 14 46 13" stroke="${c.trim[0]}" stroke-opacity="0.7" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      ${chestBand(c, 21, 12, 9, 35)}${chestBand(c, 90, 12, 9, 35)}
      <path d="M60 20 L74 33 L60 48 L46 33 Z" fill="#A855F7" stroke="${c.trim[0]}" stroke-width="3.2"/>
      <path d="M60 20 L74 33 L60 33 Z" fill="#7E22CE" opacity="0.6" stroke="none"/>
      <path d="M52 28 L57 24" stroke="#E9D5FF" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M42 10 L44 -3 L52 4 L60 -7 L68 4 L76 -3 L78 10 Z" fill="${c.trim[0]}" stroke="#92400E" stroke-width="2.4"/>
      <path d="M44 6 H76" stroke="#92400E" stroke-width="2.4"/>
      <circle cx="60" cy="1" r="2.2" fill="#EF4444" stroke="none"/><circle cx="46" cy="0" r="1.6" fill="#38BDF8" stroke="none"/><circle cx="74" cy="0" r="1.6" fill="#34D399" stroke="none"/>`,
  }),

  // Spooky — dýňový zámek, sliz stékající z víka a prasklina
  spooky: (k, c) => ({
    base: `${chestBody(c)}
      <path d="M14 61 H106 M14 77 H106" stroke-opacity="0.5" stroke-width="2"/>
      ${chestBand(c, 25, 44, 9, 50)}${chestBand(c, 86, 44, 9, 50)}
      <ellipse cx="60" cy="64" rx="14" ry="12.5" fill="#F97316" stroke="#7C2D12" stroke-width="2.6"/>
      <path d="M52 54 Q47 64 52 74 M68 54 Q73 64 68 74" stroke="#C2410C" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M60 52 q1 -7 7 -7" stroke="#4D7C0F" stroke-width="3.4" stroke-linecap="round" fill="none"/>
      <path d="M52.5 62 l3.5 -6 l3.5 6 Z M60.5 62 l3.5 -6 l3.5 6 Z" fill="#FDE047" stroke="#7C2D12" stroke-width="1.4"/>
      <path d="M52 66 q8 8 16 0 l-3 3 l-2.5 -2 l-2.5 2.4 l-2.5 -2.4 l-2.5 2 Z" fill="#FDE047" stroke="#7C2D12" stroke-width="1.4"/>`,
    lid: `${chestLid(c)}
      ${chestBand(c, 25, 17, 9, 32)}${chestBand(c, 86, 17, 9, 32)}
      <path d="M72 18 L68 27 L74 31 L70 41" stroke-opacity="0.6" stroke-width="2.4" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M8 47 H112 V52 Q108 52 107 60 Q106 65 103 60 Q102 52 94 52 H46 Q42 52 41 63 Q40 69 37 63 Q36 52 30 52 H18 Q15 52 14 57 Q13 61 11 56 Z" fill="#84CC16" stroke="#3F6212" stroke-width="2.4"/>
      <path d="M16 49 H40" stroke="#BEF264" stroke-width="2.4" stroke-linecap="round" stroke-opacity="0.8"/>`,
  }),

  // Daily — dárková krabice s mašlí (zdarma za reklamu)
  daily: (k, c) => ({
    base: `<rect x="16" y="46" width="88" height="48" rx="7" fill="${c.body[0]}"/>
      <path d="M16 78 H104 V87 Q104 94 97 94 H23 Q16 94 16 87 Z" fill="${c.body[1]}" opacity="0.55" stroke="none"/>
      <rect x="16" y="46" width="88" height="48" rx="7" fill="none"/>
      ${chestBand(c, 52, 46, 16, 48)}`,
    lid: `<rect x="10" y="28" width="100" height="20" rx="6" fill="${c.lid[0]}"/>
      <path d="M10 41 H110 V42 Q110 48 104 48 H16 Q10 48 10 42 Z" fill="${c.lid[1]}" opacity="0.55" stroke="none"/>
      <rect x="10" y="28" width="100" height="20" rx="6" fill="none"/>
      ${chestBand(c, 52, 28, 16, 20)}
      <path d="M60 27 C48 8 30 11 38 22 C42 28 52 27 60 27 Z" fill="${c.trim[0]}" stroke-width="2.4"/>
      <path d="M60 27 C72 8 90 11 82 22 C78 28 68 27 60 27 Z" fill="${c.trim[0]}" stroke-width="2.4"/>
      <circle cx="60" cy="26" r="5" fill="${c.trim[1]}" stroke-width="2.4"/>`,
  }),
};

function caseSvg(caseDef) {
  const k = `case-${caseDef.id}`;
  const c = caseDef.colors;
  const line = c.body[1];
  const draw = (CHEST_STYLES[caseDef.id] || CHEST_STYLES.party)(k, c);
  // Truhla (.case-chest) a stín pod ní (.case-shadow) jsou zvlášť, ať se
  // můžou animovat proti sobě. Víko (.chest-lid) a spodek (.chest-base) se
  // hýbou zvlášť při otevření; .chest-glow/.chest-beam je barevné světlo
  // z truhly (barva zlatého kování, nikdy bílá). viewBox začíná nad nulou,
  // aby se vešly ozdoby nad víkem (mašle, koruna).
  return `<svg viewBox="0 -8 120 124" aria-hidden="true">
    <defs>
      <radialGradient id="${k}-shadow"><stop offset="0" stop-color="${line}" stop-opacity="0.55"/><stop offset="1" stop-color="${line}" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse class="case-shadow" cx="60" cy="104" rx="50" ry="7" fill="url(#${k}-shadow)"/>
    <g class="case-chest">
      <g class="chest-base" stroke="${line}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${draw.base}</g>
      <path class="chest-beam" d="M24 47 L96 47 L120 -60 L0 -60 Z" fill="${c.trim[0]}"/>
      <ellipse class="chest-glow" cx="60" cy="47" rx="38" ry="7" fill="${c.trim[0]}"/>
      <g class="chest-lid" stroke="${line}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${draw.lid}</g>
    </g>
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
  return `
    <div class="strip-card ${extraClass}" style="--rc:${RARITIES[item.rarity].color}">
      ${shopItemPreview(sectionOf(item), item)}
      <div class="strip-card-name">${item.name}</div>
    </div>`;
}

// Chunky zlatý ukazatel (jako u kola) — shora i zdola, při cvaknutí poskočí.
const STRIP_POINTER_SVG = `<svg viewBox="0 0 44 56" aria-hidden="true">
  <path d="M6 4 H38 Q42 4 40 9 L26 46 Q22 54 18 46 L4 9 Q2 4 6 4 Z" fill="#F0B429" stroke="#7C2D12" stroke-width="4" stroke-linejoin="round"/>
  <path d="M22 4 H38 Q42 4 40 9 L26 46 Q24 50 22 50 Z" fill="#D97706" opacity="0.55"/>
  <path d="M10 9 L16 9 L22 24" stroke="#FDE68A" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.8"/>
  <circle cx="22" cy="17" r="3.4" fill="#FB923C" stroke="#7C2D12" stroke-width="2"/>
</svg>`;

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
  const reduced = caseReducedMotion();

  const overlay = document.createElement('div');
  overlay.id = 'case-overlay';
  overlay.className = 'case-overlay chest-overlay';
  overlay.innerHTML = `
    <button class="x-close case-x" id="reveal-close" aria-label="Close" hidden>${icon('close')}</button>
    <div class="case-stage">
      <h2 class="case-title">${caseDef.name}</h2>
      <div class="chest-stage" id="chest-stage">
        <div class="chest-rays"></div>
        ${caseSvg(caseDef)}
      </div>
      <div class="strip-window" id="strip-window" hidden>
        <div class="strip-marker"><i class="strip-line"></i><span class="strip-pointer top">${STRIP_POINTER_SVG}</span><span class="strip-pointer bottom">${STRIP_POINTER_SVG}</span></div>
        <div class="strip" id="strip">${strip.map((item, i) => stripCardHtml(item, i === STRIP_WIN_INDEX ? 'is-win' : '')).join('')}</div>
      </div>
      <div class="case-reveal" id="case-reveal"></div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('no-scroll');

  const chestStage = overlay.querySelector('#chest-stage');
  const alive = () => overlay.isConnected;
  let spinStarted = false;

  // --- 2) pás s věcmi: roztočí se a zpomalí na výhře pod ukazatelem
  function startSpin() {
    if (spinStarted || !alive()) return;
    spinStarted = true;
    chestStage.hidden = true;
    const win = overlay.querySelector('#strip-window');
    win.hidden = false;
    if (!reduced) win.classList.add('enter');
    const stripEl = overlay.querySelector('#strip');
    const pointers = overlay.querySelectorAll('.strip-pointer');
    const windowWidth = win.clientWidth;
    // náhodný posun v rámci výherní karty, ať to nekončí pokaždé přesně na středu
    const jitter = (randomFloat() - 0.5) * STRIP_CARD * 0.7;
    const target = STRIP_WIN_INDEX * STRIP_STEP + STRIP_CARD / 2 - windowWidth / 2 + jitter;

    if (reduced) {
      // bez animace: rovnou na výhře a výsledek
      stripEl.style.transform = `translateX(${-target}px)`;
      setTimeout(() => showReveal(caseDef, won, duplicate, refund), 250);
      return;
    }

    // plynulé zpomalení s lehkým přejetím za cíl a zpětným usazením
    const OVER = 16; // px přejetí
    const MAIN = 0.9; // podíl času na hlavní dojezd
    const easeOut = (t) => 1 - Math.pow(1 - t, 4);
    const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const posAt = (t) => (t < MAIN
      ? (target + OVER) * easeOut(t / MAIN)
      : target + OVER * (1 - easeInOut((t - MAIN) / (1 - MAIN))));

    const start = performance.now();
    let lastTick = -1;
    let lastBump = 0;
    function frame(now) {
      if (!alive()) return;
      const t = Math.min(1, (now - start) / SPIN_MS);
      const x = posAt(t);
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
               { transform: 'translateX(-50%) rotate(-16deg) scale(1.1,0.9)', offset: 0.35 },
               { transform: 'translateX(-50%) rotate(5deg) scale(0.97,1.05)', offset: 0.7 },
               { transform: 'translateX(-50%) rotate(0deg) scale(1)' }],
              { duration: 170, easing: 'ease-out' }));
          }
        }
        lastTick = under;
      }
      if (t < 1) requestAnimationFrame(frame);
      else setTimeout(() => showReveal(caseDef, won, duplicate, refund), 450);
    }
    requestAnimationFrame(frame);
  }

  if (reduced) { startSpin(); return; }

  // --- 1) truhla: nakrčení + vrtění (čím dál silnější), pak víko vyskočí
  const sched = (fn, ms) => setTimeout(() => { if (alive()) fn(); }, ms);
  chestStage.classList.add('windup');
  sched(() => playSfx('chest-tick'), 350);
  sched(() => playSfx('chest-tick'), 750);
  sched(() => playSfx('chest-tick'), 1050);
  sched(() => {
    chestStage.classList.remove('windup');
    chestStage.classList.add('pop');
    // barevné světlo a konfety v barvách truhly (zlatá/trim), žádná bílá
    const r = chestStage.getBoundingClientRect();
    const o = overlay.getBoundingClientRect();
    const trim = caseDef.colors.trim;
    caseBurst(overlay, [trim[0], trim[1], '#F472B6', '#60A5FA', '#34D399', '#FB923C'], 26, true,
      r.left - o.left + r.width / 2, r.top - o.top + r.height * 0.38, 4);
  }, 1300);
  sched(() => chestStage.classList.add('leave'), 2150);
  sched(startSpin, 2500);
  // ťuknutí přeskočí úvod
  chestStage.onclick = startSpin;
}

function showReveal(caseDef, won, duplicate, refund) {
  const overlay = document.getElementById('case-overlay');
  if (!overlay) return;
  overlay.querySelector('.strip-card.is-win').classList.add('highlight');
  revealSound(won.rarity, duplicate);

  const rarity = RARITIES[won.rarity];
  const fx = CASE_FX[won.rarity] || CASE_FX.common;
  const coins = shopLoad().coins;
  const reveal = document.getElementById('case-reveal');
  reveal.style.setProperty('--rc', rarity.color);
  reveal.innerHTML = `
    <div class="reveal-card rar-${won.rarity} ${won.rarity === 'mythic' ? 'is-mythic' : ''}">
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
