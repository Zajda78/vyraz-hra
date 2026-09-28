// Kolo štěstí — nahrazuje Daily Chest. Jednou denně zatočení zdarma za
// zhlédnutí reklamy (daily.js). Padají mince, vstupenky a dvě věci, které
// nejdou získat nikde jinde: rámeček Fortune a barva jména Jackpot.
// Výhra se vylosuje a uloží HNED — točení kola je jen divadlo, takže
// zavřením appky uprostřed se nic neztratí (stejně jako u truhel).

// Políčka kola v pořadí po směru hodinových ručiček od vrchu.
// chance = šance v procentech (součet 100). Všechna políčka jsou na kole
// stejně velká — šance určuje losování, ne velikost políčka.
const WHEEL_PRIZES = [
  { id: 'coins15', type: 'coins', amount: 15, chance: 31.5, color: '#6D28D9' },
  { id: 'ticket', type: 'ticket', chance: 20, color: '#D97706' },
  { id: 'coins30', type: 'coins', amount: 30, chance: 22, color: '#2563EB' },
  { id: 'name', type: 'item', itemId: 'name-jackpot', chance: 4, color: '#059669' },
  { id: 'coins60', type: 'coins', amount: 60, chance: 14, color: '#BE185D' },
  { id: 'coins300', type: 'coins', amount: 300, chance: 2, color: '#EA580C', jackpot: true },
  { id: 'coins120', type: 'coins', amount: 120, chance: 6, color: '#0E7490' },
  { id: 'frame', type: 'item', itemId: 'frame-fortune', chance: 0.5, color: '#A16207' }, // Mythic — mega vzácné
];
const WHEEL_TICKET_COINS = 75; // kdo má Party Pack, dostane místo vstupenky mince (= cena vstupenky)
const WHEEL_SPIN_MS = 5200;
const WHEEL_SEG = 360 / WHEEL_PRIZES.length;

function wheelItem(prize) {
  return prize.itemId ? ALL_ITEMS.find((i) => i.id === prize.itemId) : null;
}

function prizeName(prize) {
  if (prize.type === 'coins') return `${prize.amount} coins`;
  if (prize.type === 'ticket') return 'Game Ticket';
  return wheelItem(prize).name;
}

// ------------------------------------------------------------ vzhled ---

// Obsah jednoho políčka (kreslí se nahoře a pak se celé políčko otočí na místo).
function wheelSlotArt(prize) {
  if (prize.type === 'coins') {
    return `${coinArt(0, -104, 13)}
      <text y="-72" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="800" font-size="17" fill="#fff">${prize.amount}</text>`;
  }
  if (prize.type === 'ticket') {
    return `<g transform="translate(0 -100) rotate(-12)">
        <path d="M-17 -10h34a4 4 0 0 1 0 8a4 4 0 0 0 0 4a4 4 0 0 1 0 8h-34a4 4 0 0 1 0-8a4 4 0 0 0 0-4a4 4 0 0 1 0-8z" fill="#FDE68A" stroke="#92400E" stroke-width="1.5"/>
        <path d="M6 -9v18" stroke="#92400E" stroke-width="1.4" stroke-dasharray="2 2"/>
      </g>
      <text y="-72" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="800" font-size="11" fill="#fff">TICKET</text>`;
  }
  const item = wheelItem(prize);
  if (item.section === 'frame') {
    return `<rect x="-15" y="-119" width="30" height="30" rx="8" fill="url(#wheel-fortune)"/>
      <rect x="-10" y="-114" width="20" height="20" rx="5" fill="#1F1235"/>
      ${sparkleArt(15, -120, 5)}
      <text y="-72" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="800" font-size="11" fill="#fff">FRAME</text>`;
  }
  return `<text y="-96" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="800" font-size="22" fill="url(#wheel-jackpot)" stroke="#064E3B" stroke-width="0.6">Aa</text>
    <text y="-72" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="800" font-size="11" fill="#fff">NAME</text>`;
}

function wheelSvg() {
  const r = 140;
  const pt = (deg, rad) => {
    const a = (deg * Math.PI) / 180;
    return `${(Math.sin(a) * rad).toFixed(2)} ${(-Math.cos(a) * rad).toFixed(2)}`;
  };
  const slices = WHEEL_PRIZES.map((p, i) => {
    const a0 = i * WHEEL_SEG - WHEEL_SEG / 2;
    const a1 = a0 + WHEEL_SEG;
    return `<g>
      <path d="M0 0 L${pt(a0, r)} A${r} ${r} 0 0 1 ${pt(a1, r)} Z" fill="${p.color}" stroke="#1F1235" stroke-width="2"/>
      <path d="M0 0 L${pt(a0, r)} A${r} ${r} 0 0 1 ${pt(a1, r)} Z" fill="url(#wheel-shade)"/>
      <g transform="rotate(${i * WHEEL_SEG})">${wheelSlotArt(p)}</g>
    </g>`;
  }).join('');
  const bulbs = Array.from({ length: 16 }, (_, i) => {
    const a = (i * 360) / 16;
    return `<circle cx="${pt(a, 147).split(' ')[0]}" cy="${pt(a, 147).split(' ')[1]}" r="3.6" class="wheel-bulb ${i % 2 ? 'b2' : ''}"/>`;
  }).join('');
  return `<svg class="wheel-svg" viewBox="-160 -160 320 320" aria-hidden="true">
    <defs>
      <radialGradient id="wheel-shade"><stop offset="0.35" stop-color="#fff" stop-opacity="0.12"/><stop offset="1" stop-color="#000" stop-opacity="0.25"/></radialGradient>
      <linearGradient id="wheel-fortune" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FDE047"/><stop offset="0.5" stop-color="#22C55E"/><stop offset="1" stop-color="#A855F7"/></linearGradient>
      <linearGradient id="wheel-jackpot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FDE047"/><stop offset="0.5" stop-color="#4ADE80"/><stop offset="1" stop-color="#FDE047"/></linearGradient>
    </defs>
    <circle r="156" fill="#FBBF24"/>
    <circle r="151" fill="#1F1235"/>
    <g class="wheel-rotor">${slices}</g>
    ${bulbs}
    <circle r="22" fill="#FBBF24" stroke="#92400E" stroke-width="2"/>
    <circle r="15" fill="#FDE68A"/>
    ${sparkleArt(0, 0, 9, '#B45309')}
  </svg>`;
}

// --------------------------------------------------------- losování ---

function rollWheelPrize() {
  let r = randomFloat() * 100;
  for (let i = 0; i < WHEEL_PRIZES.length; i++) {
    r -= WHEEL_PRIZES[i].chance;
    if (r < 0) return i;
  }
  return 0;
}

// Připíše výhru a vrátí popis toho, co hráč dostal.
function applyWheelPrize(prize) {
  const d = shopLoad();
  const result = { prize, coins: 0, duplicate: false, ticketAsCoins: false };
  if (prize.type === 'coins') {
    result.coins = prize.amount;
  } else if (prize.type === 'ticket') {
    if (ownsPartyPack()) {
      result.ticketAsCoins = true; // vstupenka by byla k ničemu — dostane mince
      result.coins = WHEEL_TICKET_COINS;
    } else {
      d.tickets = d.tickets || {};
      d.tickets.any = (d.tickets.any || 0) + 1;
    }
  } else {
    const item = wheelItem(prize);
    if (d.owned.includes(item.id)) {
      result.duplicate = true;
      result.coins = RARITIES[item.rarity].refund;
    } else {
      d.owned.push(item.id);
    }
  }
  d.coins += result.coins;
  shopSave(d);
  return result;
}

// ------------------------------------------------------------ točení ---

function openWheel() {
  closeCaseOverlay();
  const index = rollWheelPrize();
  const result = applyWheelPrize(WHEEL_PRIZES[index]);

  const overlay = document.createElement('div');
  overlay.id = 'case-overlay';
  overlay.className = 'case-overlay wheel-overlay';
  overlay.innerHTML = `
    <button class="x-close case-x" id="reveal-close" aria-label="Close" hidden>${icon('close')}</button>
    <div class="case-stage">
      <h2 class="case-title">Lucky Wheel</h2>
      <div class="wheel-wrap">
        <div class="wheel-pointer"></div>
        ${wheelSvg()}
      </div>
      <div class="case-reveal" id="case-reveal"></div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('no-scroll');
  playSfx('chest-open');

  // cíl: střed vylosovaného políčka nahoře pod šipkou + pár celých otáček
  // a malá náhodná odchylka, ať to nekončí pokaždé přesně uprostřed
  const jitter = (randomFloat() - 0.5) * WHEEL_SEG * 0.6;
  const target = 360 * 6 + (360 - index * WHEEL_SEG) + jitter;
  const rotor = overlay.querySelector('.wheel-rotor');
  const ease = (t) => 1 - Math.pow(1 - t, 4);
  const start = performance.now();
  let lastSlot = -1;

  function frame(now) {
    const t = Math.min(1, (now - start) / WHEEL_SPIN_MS);
    const angle = target * ease(t);
    rotor.setAttribute('transform', `rotate(${angle.toFixed(2)})`);
    // cvaknutí pokaždé, když pod šipkou projede další políčko
    const slot = Math.floor((angle + WHEEL_SEG / 2) / WHEEL_SEG);
    if (slot !== lastSlot) {
      if (lastSlot !== -1) playSfx('chest-tick');
      lastSlot = slot;
    }
    if (t < 1) requestAnimationFrame(frame);
    else setTimeout(() => showWheelReveal(result), 400);
  }
  requestAnimationFrame(frame);
}

function showWheelReveal(result) {
  const overlay = document.getElementById('case-overlay');
  if (!overlay) return;
  const { prize } = result;
  const item = wheelItem(prize);

  let label = 'Coins';
  let color = '#FBBF24';
  let preview = `<svg class="wheel-reveal-art" viewBox="0 0 64 56">${prize.amount >= 120 ? COIN_PACK_ART.pile.replace(/<\/?svg[^>]*>/g, '') : coinArt(32, 29, 17)}</svg>`;
  let sound = prize.jackpot ? 'reveal-legendary' : 'coins';
  if (prize.type === 'ticket') {
    label = 'Ticket';
    color = '#F59E0B';
    preview = `<div class="wheel-reveal-ticket">${icon('ticket')}</div>`;
    sound = 'reveal-rare';
  }
  if (item) {
    label = RARITIES[item.rarity].label;
    color = RARITIES[item.rarity].color;
    preview = shopItemPreview(sectionOf(item), item);
    sound = item.rarity === 'mythic' ? 'reveal-legendary' : `reveal-${item.rarity}`;
    if (item.rarity === 'mythic' && !result.duplicate) setTimeout(() => playSfx('win'), 900); // fanfára navíc
  }
  if (prize.jackpot) label = 'Jackpot!';
  playSfx(sound);
  if (result.coins && (item || prize.type === 'ticket')) setTimeout(() => playSfx('coins'), 500);

  const extra = result.duplicate
    ? `<div class="reveal-dup">Already yours — you get ${COIN_SVG}<span class="num">+${result.coins}</span></div>`
    : result.ticketAsCoins
      ? `<div class="reveal-dup">You own the Party Pack — you get ${COIN_SVG}<span class="num">+${result.coins}</span></div>`
      : prize.type === 'ticket'
        ? '<div class="reveal-new">1 free game of any Party Pack mode</div>'
        : item ? '<div class="reveal-new">New! Only from the Lucky Wheel</div>' : '';

  const reveal = document.getElementById('case-reveal');
  reveal.style.setProperty('--rc', color);
  reveal.innerHTML = `
    <div class="reveal-card ${item && item.rarity === 'mythic' ? 'is-mythic' : ''}">
      <div class="reveal-rays"></div>
      <div class="reveal-rarity">${label}</div>
      <div class="reveal-preview">${preview}</div>
      <div class="reveal-name">${prizeName(prize)}</div>
      ${extra}
    </div>
    <div class="reveal-actions">
      ${item && !result.duplicate ? '<button class="btn btn-primary btn-block" id="reveal-equip">Equip</button>' : ''}
      ${canSpinWheel()
        ? `<button class="btn btn-ghost btn-block" id="wheel-again">Spin again</button>`
        : `<div class="daily-wait wide">${icon('timer')} Next spin in ${timeUntilReset()}</div>`}
    </div>`;
  reveal.classList.add('show');
  overlay.querySelector('.wheel-wrap').classList.add('done');
  document.getElementById('reveal-close').hidden = false;

  const equip = document.getElementById('reveal-equip');
  if (equip) {
    equip.onclick = () => {
      const d = shopLoad();
      d.equipped[item.section] = item.id;
      shopSave(d);
      showToast(`Equipped: ${item.name}`);
      closeCaseOverlay();
      renderShopScreen();
    };
  }
  const again = document.getElementById('wheel-again');
  if (again) again.onclick = () => { closeCaseOverlay(); startWheelSpin(); };
  document.getElementById('reveal-close').onclick = () => {
    closeCaseOverlay();
    renderShopScreen();
  };
}

// ------------------------------------------------ okno se šancemi ---

function showWheelOdds() {
  const rows = WHEEL_PRIZES.slice().sort((a, b) => a.chance - b.chance).map((p) => {
    const item = wheelItem(p);
    const art = item
      ? shopItemPreview(sectionOf(item), item)
      : p.type === 'ticket'
        ? `<div class="wheel-odds-ticket">${icon('ticket')}</div>`
        : `<div class="wheel-odds-coin">${COIN_SVG}</div>`;
    return `
      <div class="wheel-odds-row" style="--rc:${p.color}">
        <div class="wheel-odds-art">${art}</div>
        <div class="wheel-odds-name">${prizeName(p)}${item ? '<span>Wheel only</span>' : ''}</div>
        <div class="wheel-odds-chance">${String(p.chance).replace('.', ',')} %</div>
      </div>`;
  }).join('');
  const modal = openModal(`
    <div class="x-close-row"><button class="x-close" id="wheel-odds-close" aria-label="Close">${icon('close')}</button></div>
    <div class="wheel-odds-head">
      <div class="wheel-mini">${wheelSvg()}</div>
      <h2>Lucky Wheel</h2>
    </div>
    <div class="wheel-odds-list">${rows}</div>
    ${canSpinWheel()
      ? `<button class="case-open-btn wide" id="wheel-odds-spin">${icon('play')} Watch ad to spin</button>`
      : `<div class="daily-wait wide">${icon('timer')} Next spin in ${timeUntilReset()}</div>`}
  `);
  modal.querySelector('#wheel-odds-close').onclick = closeModal;
  const spin = modal.querySelector('#wheel-odds-spin');
  if (spin) spin.onclick = () => { closeModal(); startWheelSpin(); };
}
