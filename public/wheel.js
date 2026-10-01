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
  { id: 'frame', type: 'item', itemId: 'frame-fortune', chance: 0.5, color: '#312E81' }, // Mythic — mega vzácné
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
// Cartoon styl: tlustý obrys ve stejném odstínu, plochá výplň, jeden cel-shade a světlá skvrna.

// Smíchá barvu s černou (k<0) nebo bílou (k>0) — pro obrys a odlesk ve stejném odstínu.
function wheelMix(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const t = k < 0 ? 0 : 255;
    return Math.round(c + (t - c) * Math.abs(k));
  });
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

// Mince s tmavým obrysem.
function wheelCoin(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r + 1.6}" fill="#92400E"/>${coinArt(cx, cy, r)}`;
}

// Hromádky mincí rostou s hodnotou.
const WHEEL_PILES = {
  15: [[0, -98, 14]],
  30: [[-10, -96, 12], [10, -100, 12]],
  60: [[-12, -92, 11], [12, -92, 11], [0, -106, 11]],
  120: [[-15, -88, 9.5], [0, -88, 9.5], [15, -88, 9.5], [-7, -102, 9.5], [7, -102, 9.5]],
  300: [[-18, -85, 9], [0, -85, 9], [18, -85, 9], [-9, -98, 9], [9, -98, 9], [0, -111, 9]],
};

const WHEEL_LABEL = 'font-family="Unbounded, sans-serif" font-weight="800" text-anchor="middle" stroke-linejoin="round" paint-order="stroke"';

// Obsah jednoho políčka (kreslí se nahoře a pak se celé políčko otočí na místo).
function wheelSlotArt(prize) {
  const dark = wheelMix(prize.color, -0.6);
  // popisek se přeloží hned tady a písmo se zmenší podle délky slova,
  // ať dlouhá slova (např. „RÁMEČEK“) nepřetékají do sousedních políček
  const label = (txt, size, fill = '#fff') => {
    const t = String(typeof tr === 'function' && typeof getLang === 'function' ? tr(String(txt), getLang()) : txt).toUpperCase();
    const fit = Math.min(size, 44 / (t.length * 0.74));
    return `<text y="-66" ${WHEEL_LABEL} data-no-i18n font-size="${fit.toFixed(1)}" fill="${fill}" stroke="${dark}" stroke-width="${fit < 10 ? 3 : 4}">${t}</text>`;
  };
  if (prize.type === 'coins') {
    const pile = WHEEL_PILES[prize.amount].map(([x, y, r]) => wheelCoin(x, y, r)).join('');
    const stars = prize.jackpot
      ? `${sparkleArt(-26, -112, 7, '#FDE047')}${sparkleArt(26, -112, 7, '#FDE047')}${sparkleArt(0, -124, 5, '#FDE047')}`
      : '';
    return `${stars}${pile}${label(prize.amount, prize.jackpot ? 20 : 17, prize.jackpot ? '#FDE047' : '#fff')}`;
  }
  if (prize.type === 'ticket') {
    return `<g transform="translate(0 -96) rotate(-12)">
        <path d="M-19 -11h38a4.5 4.5 0 0 1 0 9a4.5 4.5 0 0 0 0 4.5a4.5 4.5 0 0 1 0 9h-38a4.5 4.5 0 0 1 0-9a4.5 4.5 0 0 0 0-4.5a4.5 4.5 0 0 1 0-9z" fill="#FDE68A" stroke="#92400E" stroke-width="3" stroke-linejoin="round"/>
        <path d="M-19 -11h38a4.5 4.5 0 0 1 3 1.5h-44a4.5 4.5 0 0 1 3-1.5z" fill="#FEF3C7"/>
        <path d="M7 -8v16" stroke="#B45309" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="2.5 3"/>
        ${sparkleArt(-7, 0, 5, '#D97706')}
      </g>${label('TICKET', 11)}`;
  }
  const item = wheelItem(prize);
  if (item.section === 'frame') {
    // mýtický rámeček Fortune — prestižní políčko: točící se duhový kroužek,
    // pulzující ikona a barevné blikající hvězdičky (žádné bílé záblesky)
    return `<g class="wf-ring"><circle cx="0" cy="-101" r="25" fill="none" stroke="url(#wheel-fortune)" stroke-width="3" stroke-dasharray="7 5" stroke-linecap="round"/></g>
      <g class="wf-icon">
        <rect x="-17" y="-118" width="34" height="34" rx="9" fill="#451A03"/>
        <rect x="-15" y="-116" width="30" height="30" rx="8" fill="url(#wheel-fortune)"/>
        <rect x="-9" y="-110" width="18" height="18" rx="5" fill="#2E1065"/>
        <path d="M-13 -112q4 -3 9 -3" stroke="#FEF9C3" stroke-opacity="0.7" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      </g>
      <g class="wf-tw" style="animation-delay:0s">${sparkleArt(19, -121, 6, '#FDE047')}</g>
      <g class="wf-tw" style="animation-delay:-0.6s">${sparkleArt(-20, -114, 5, '#F472B6')}</g>
      <g class="wf-tw" style="animation-delay:-1.2s">${sparkleArt(14, -82, 4.5, '#22D3EE')}</g>
      ${label('FRAME', 11)}`;
  }
  return `<text y="-90" ${WHEEL_LABEL} font-size="27" fill="url(#wheel-jackpot)" stroke="#064E3B" stroke-width="5">Aa</text>${label('NAME', 11)}`;
}

function wheelSvg() {
  const r = 128;
  const pt = (deg, rad) => {
    const a = (deg * Math.PI) / 180;
    return [(Math.sin(a) * rad).toFixed(2), (-Math.cos(a) * rad).toFixed(2)];
  };
  const wedge = (a0, a1, rad) => `M0 0 L${pt(a0, rad).join(' ')} A${rad} ${rad} 0 0 1 ${pt(a1, rad).join(' ')} Z`;
  const slices = WHEEL_PRIZES.map((p, i) => {
    const a0 = i * WHEEL_SEG - WHEEL_SEG / 2;
    const mid = a0 + WHEEL_SEG / 2;
    const a1 = a0 + WHEEL_SEG;
    const [hx, hy] = pt(mid - 9, 112);
    return `<g>
      <path d="${wedge(a0, a1, r)}" fill="${p.color}"/>
      ${p.id === 'frame' ? `<path class="wf-glow" d="${wedge(a0, a1, r)}" fill="url(#wheel-fortune)"/>` : ''}
      <path d="${wedge(mid, a1, r)}" fill="#000" fill-opacity="0.15"/>
      <ellipse cx="${hx}" cy="${hy}" rx="13" ry="5" fill="${wheelMix(p.color, 0.4)}" fill-opacity="0.55" transform="rotate(${mid - 9} ${hx} ${hy})"/>
      <path d="${wedge(a0, a1, r)}" fill="none" stroke="${wheelMix(p.color, -0.65)}" stroke-width="3" stroke-linejoin="round"/>
      <g transform="rotate(${i * WHEEL_SEG})">${wheelSlotArt(p)}</g>
    </g>`;
  }).join('');
  // žárovky: pomalu se rozsvěcují za sebou dokola (teplé barvy, žádné bílé záblesky)
  const bulbs = Array.from({ length: 16 }, (_, i) => {
    const [x, y] = pt((i * 360) / 16, 145);
    return `<circle cx="${x}" cy="${y}" r="4.6" class="wheel-bulb" style="animation-delay:${(-i * 0.1).toFixed(1)}s"/>`;
  }).join('');
  const hubStar = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? 6 : 13;
    return `${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`;
  }).join(' ');
  return `<svg class="wheel-svg" viewBox="-165 -165 330 330" aria-hidden="true">
    <defs>
      <linearGradient id="wheel-fortune" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FDE047"/><stop offset="0.35" stop-color="#22C55E"/><stop offset="0.7" stop-color="#A855F7"/><stop offset="1" stop-color="#FB7185"/></linearGradient>
      <linearGradient id="wheel-jackpot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FDE047"/><stop offset="0.5" stop-color="#4ADE80"/><stop offset="1" stop-color="#FDE047"/></linearGradient>
    </defs>
    <circle r="160" fill="#7C2D12"/>
    <circle r="156" fill="#F59E0B"/>
    <path d="M-150 -40A156 156 0 0 1 -40 -150" stroke="#FDE047" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.7"/>
    <circle r="133" fill="#92400E"/>
    <circle r="131" fill="#B45309"/>
    <g class="wheel-rotor">${slices}</g>
    ${bulbs}
    <circle r="27" fill="#7C2D12"/>
    <circle r="24" fill="#F59E0B"/>
    <path d="M-20 4A20 20 0 0 1 4 -20" stroke="#FDE047" stroke-width="4" stroke-linecap="round" fill="none"/>
    <circle r="18" fill="#FBBF24" stroke="#B45309" stroke-width="2.5"/>
    <polygon points="${hubStar}" fill="#B45309" stroke="#7C2D12" stroke-width="2" stroke-linejoin="round"/>
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
        <div class="wheel-pointer"><svg viewBox="0 0 44 56" aria-hidden="true"><path d="M22 54L5 24a19 19 0 1 1 34 0z" fill="#7C2D12"/><path d="M22 49L9 25a15 15 0 1 1 26 0z" fill="#EF4444"/><path d="M22 49L35 25a15 15 0 0 0-13-18z" fill="#B91C1C" opacity="0.5"/><circle cx="22" cy="20" r="6.5" fill="#FBBF24" stroke="#7C2D12" stroke-width="2.5"/><path d="M12 14q3-6 9-7" stroke="#FCA5A5" stroke-width="3" stroke-linecap="round" fill="none"/></svg></div>
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
  const svg = overlay.querySelector('.wheel-svg');
  const pointer = overlay.querySelector('.wheel-pointer');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // reduced motion: žádné točení, rovnou výsledek
  if (reduce) {
    rotor.setAttribute('transform', `rotate(${(target % 360).toFixed(2)})`);
    setTimeout(() => showWheelReveal(result), 250);
    return;
  }

  // fáze: nátah (kolo se kousek vrátí a stlačí) → točení s doznívaním → přeskočení a usazení
  const WIND = 380, SETTLE = 420, OVER = 5, BACK = -12;
  const main = WHEEL_SPIN_MS;
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);
  const start = performance.now();
  let lastSlot = 0;

  // šipka cvakne (odskočí) pokaždé, když pod ní projede políčko
  function tickPointer() {
    if (pointer.animate) {
      pointer.animate(
        [{ transform: 'translateX(-50%) rotate(-24deg)' }, { transform: 'translateX(-50%) rotate(5deg)', offset: 0.6 }, { transform: 'translateX(-50%) rotate(0)' }],
        { duration: 160, easing: 'ease-out' }
      );
    }
  }

  function frame(now) {
    const el = now - start;
    let angle, sx = 1, sy = 1;
    if (el < WIND) {
      const k = Math.sin((el / WIND) * Math.PI / 2);
      angle = BACK * k;
      sx = 1 + 0.035 * k; sy = 1 - 0.04 * k; // stlačení při nátahu
    } else if (el < WIND + main) {
      const t = (el - WIND) / main;
      angle = BACK + (target + OVER - BACK) * easeOut(t);
      const pop = Math.max(0, 1 - (el - WIND) / 260); // odpružení po startu
      sx = 1 - 0.035 * pop; sy = 1 + 0.04 * pop;
    } else {
      const t = Math.min(1, (el - WIND - main) / SETTLE);
      angle = target + OVER * (1 - easeOut(t)); // malý přesah a usazení zpět
    }
    rotor.setAttribute('transform', `rotate(${angle.toFixed(2)})`);
    svg.style.transform = sx === 1 && sy === 1 ? '' : `scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
    const slot = Math.floor((angle + WHEEL_SEG / 2) / WHEEL_SEG);
    if (slot !== lastSlot) {
      if (el > WIND) { playSfx('chest-tick'); tickPointer(); }
      lastSlot = slot;
    }
    if (el < WIND + main + SETTLE) requestAnimationFrame(frame);
    else {
      svg.style.transform = '';
      setTimeout(() => showWheelReveal(result), 400);
    }
  }
  requestAnimationFrame(frame);
}

// Barevný prsk konfet a mincí (žádná bílá); vzácné výhry dostanou víc.
function wheelConfetti(card, big) {
  const colors = ['#F43F5E', '#FBBF24', '#22C55E', '#3B82F6', '#A855F7', '#FB923C'];
  const n = big ? 44 : 22;
  const box = document.createElement('div');
  box.className = 'wheel-confetti';
  let html = '';
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const dist = (big ? 120 : 85) + Math.random() * (big ? 110 : 70);
    const coin = i % 4 === 0;
    html += `<i class="${coin ? 'wc-coin' : 'wc-bit'}" style="--dx:${(Math.cos(ang) * dist).toFixed(0)}px;--dy:${(Math.sin(ang) * dist - 30).toFixed(0)}px;--rot:${Math.round(Math.random() * 540 - 270)}deg;--c:${colors[i % colors.length]};animation-delay:${(Math.random() * 0.12).toFixed(2)}s"></i>`;
  }
  box.innerHTML = html;
  card.appendChild(box);
  setTimeout(() => box.remove(), 2200);
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
  const rare = prize.jackpot || (item && (item.rarity === 'mythic' || prize.id === 'name'));
  reveal.querySelector('.reveal-preview').classList.add('wheel-pop');
  if (!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    wheelConfetti(reveal.querySelector('.reveal-card'), rare);
  }
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
