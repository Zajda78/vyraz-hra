// Truhly s kosmetikou + otevírací animace ve stylu CS:GO (pás věcí se
// roztočí a zpomalí na výhře pod středovou značkou).
// Výhra se vylosuje a uloží HNED po zaplacení — animace je jen divadlo,
// takže zavřením appky uprostřed se nic neztratí.

// Každá truhla: co v ní může padnout (filter), šance na vzácnosti
// (odds, v procentech, součet 100) a barvy obrázku.
const CASES = [
  {
    id: 'party',
    name: 'Party truhla',
    price: 100,
    filter: () => true,
    odds: { common: 55, rare: 28, epic: 13, legendary: 4 },
    colors: { body: ['#8B3CF0', '#4C1D95'], lid: ['#A78BFA', '#7C3AED'], trim: ['#FDE68A', '#D97706'] },
    glow: 'rgba(240,180,41,0.35)',
  },
  {
    id: 'frames',
    name: 'Truhla rámečků',
    price: 150,
    filter: (item) => item.section === 'frame',
    odds: { common: 50, rare: 30, epic: 15, legendary: 5 },
    colors: { body: ['#0EA5E9', '#0C4A6E'], lid: ['#7DD3FC', '#0284C7'], trim: ['#E0F2FE', '#94A3B8'] },
    glow: 'rgba(56,189,248,0.35)',
  },
  {
    id: 'names',
    name: 'Truhla jmen',
    price: 80,
    filter: (item) => item.section === 'name',
    odds: { common: 60, rare: 26, epic: 11, legendary: 3 },
    colors: { body: ['#10B981', '#065F46'], lid: ['#6EE7B7', '#059669'], trim: ['#FDE68A', '#D97706'] },
    glow: 'rgba(52,211,153,0.35)',
  },
  {
    id: 'legend',
    name: 'Legendární truhla',
    price: 400,
    filter: () => true,
    odds: { common: 15, rare: 40, epic: 30, legendary: 15 },
    colors: { body: ['#1F1235', '#0B0616'], lid: ['#3B2463', '#1F1235'], trim: ['#FDE68A', '#F59E0B'] },
    glow: 'rgba(245,158,11,0.55)',
  },
];

function caseById(id) {
  return CASES.find((c) => c.id === id) || CASES[0];
}

function casePool(caseDef) {
  return ALL_ITEMS.filter(caseDef.filter);
}

// Obrázek truhly obarvený podle truhly (id gradientů musí být unikátní,
// jinak by si SVG na jedné stránce navzájem přepisovaly barvy).
function caseSvg(caseDef) {
  const k = `case-${caseDef.id}`;
  const { body, lid, trim } = caseDef.colors;
  // Truhla (.case-chest) a stín pod ní (.case-shadow) jsou zvlášť, ať se
  // můžou animovat proti sobě — truhla nahoru, stín se zmenší a zeslábne.
  return `<svg viewBox="0 0 120 112" aria-hidden="true">
    <defs>
      <linearGradient id="${k}-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${body[0]}"/><stop offset="1" stop-color="${body[1]}"/></linearGradient>
      <linearGradient id="${k}-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lid[0]}"/><stop offset="1" stop-color="${lid[1]}"/></linearGradient>
      <linearGradient id="${k}-trim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${trim[0]}"/><stop offset="1" stop-color="${trim[1]}"/></linearGradient>
      <radialGradient id="${k}-shadow"><stop offset="0" stop-color="#000" stop-opacity="0.6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse class="case-shadow" cx="60" cy="104" rx="50" ry="7" fill="url(#${k}-shadow)"/>
    <g class="case-chest">
    <rect x="14" y="40" width="92" height="52" rx="8" fill="url(#${k}-body)"/>
    <path d="M10 30 Q10 20 20 20 H100 Q110 20 110 30 V42 H10 Z" fill="url(#${k}-lid)"/>
    <rect x="10" y="40" width="100" height="6" fill="#000" opacity="0.25"/>
    <rect x="26" y="20" width="8" height="72" fill="url(#${k}-trim)"/>
    <rect x="86" y="20" width="8" height="72" fill="url(#${k}-trim)"/>
    <rect x="48" y="34" width="24" height="24" rx="5" fill="url(#${k}-trim)" stroke="#000" stroke-opacity="0.3" stroke-width="1.5"/>
    <path d="M60 40.5 L62 45 L67 45.5 L63.3 48.7 L64.4 53.5 L60 51 L55.6 53.5 L56.7 48.7 L53 45.5 L58 45 Z" fill="#000" fill-opacity="0.45"/>
    <rect x="14" y="21" width="92" height="3" rx="1.5" fill="#fff" opacity="0.35"/>
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
    <div class="x-close-row"><button class="x-close" id="contents-close" aria-label="Zavřít">${icon('close')}</button></div>
    <div class="case-contents-head" style="--case-glow:${caseDef.glow}">
      <div class="case-art small">${caseSvg(caseDef)}</div>
      <h2>${caseDef.name}</h2>
    </div>
    <div class="odds-row">${oddsHtml}</div>
    <div class="drop-grid">${dropsHtml}</div>
    <button class="case-open-btn wide" id="contents-open">Otevřít ${COIN_SVG}<span class="num">${caseDef.price}</span></button>
  `);
  modal.querySelector('#contents-open').onclick = () => { closeModal(); openCase(caseId); };
  modal.querySelector('#contents-close').onclick = closeModal;
}

// ----------------------------------------------------------- zvuky ---

let caseAudio = null;
function caseSound(freq, duration, type = 'square', volume = 0.04) {
  try {
    if (!caseAudio) caseAudio = new (window.AudioContext || window.webkitAudioContext)();
    const osc = caseAudio.createOscillator();
    const gain = caseAudio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, caseAudio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, caseAudio.currentTime + duration);
    osc.connect(gain).connect(caseAudio.destination);
    osc.start();
    osc.stop(caseAudio.currentTime + duration);
  } catch { /* bez zvuku */ }
}

function revealSound(rarity) {
  const notes = { common: [523], rare: [523, 659], epic: [523, 659, 784], legendary: [523, 659, 784, 1047] }[rarity];
  notes.forEach((f, i) => setTimeout(() => caseSound(f, 0.35, 'triangle', 0.08), i * 110));
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

function openCase(caseId) {
  const caseDef = caseById(caseId);
  const d = shopLoad();
  if (d.coins < caseDef.price) return showToast('Nemáš dost mincí.');

  d.coins -= caseDef.price;
  const won = rollItem(caseDef);
  const duplicate = d.owned.includes(won.id);
  const refund = duplicate ? RARITIES[won.rarity].refund : 0;
  if (duplicate) d.coins += refund;
  else d.owned.push(won.id);
  shopSave(d);

  showCaseOverlay(caseDef, won, duplicate, refund);
}

function showCaseOverlay(caseDef, won, duplicate, refund) {
  closeCaseOverlay();
  const strip = Array.from({ length: STRIP_LENGTH }, (_, i) => (i === STRIP_WIN_INDEX ? won : rollItem(caseDef)));

  const overlay = document.createElement('div');
  overlay.id = 'case-overlay';
  overlay.className = 'case-overlay';
  overlay.innerHTML = `
    <button class="x-close case-x" id="reveal-close" aria-label="Zavřít" hidden>${icon('close')}</button>
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
      if (lastTick !== -1) caseSound(1400, 0.03);
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
  revealSound(won.rarity);

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
        ? `<div class="reveal-dup">Už máš — duplikát za ${COIN_SVG}<span class="num">+${refund}</span></div>`
        : `<div class="reveal-new">Nové!</div>`}
    </div>
    <div class="reveal-actions">
      ${duplicate ? '' : `<button class="btn btn-primary btn-block" id="reveal-equip">Nasadit</button>`}
      <button class="btn ${duplicate ? 'btn-primary' : 'btn-ghost'} btn-block" id="reveal-again" ${coins < caseDef.price ? 'disabled' : ''}>
        Otevřít další ${COIN_SVG}<span class="num">${caseDef.price}</span>
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
      showToast(`Nasazeno: ${won.name}`);
      closeCaseOverlay();
      renderShopScreen();
    };
  }
  document.getElementById('reveal-again').onclick = () => {
    closeCaseOverlay();
    renderShopScreen();
    openCase(caseDef.id);
  };
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
