// Ozdoby rámečků — jen epické a legendární rámečky mají kolem sebe malé
// animované ozdoby (hvězdičky, planetky, kapky lávy…), které přesahují
// přes okraj. Souřadnice: 0–100 = plocha rámečku, ozdoby můžou jít
// kousek ven (viewBox -12…112).

// 4cípá hvězdička se středem cx,cy a poloměrem r
function sparkle(cx, cy, r, fill, delay = 0) {
  const k = r * 0.28;
  return `<path class="fd-twinkle" style="animation-delay:${delay}s" fill="${fill}"
    d="M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r}Z"/>`;
}

const FRAME_DECOR = {
  // Zlato (epická) — zlaté hvězdičky v rozích
  'frame-gold': () => `
    ${sparkle(2, 6, 11, '#FDE68A', 0)}
    ${sparkle(98, 24, 7, '#FFFFFF', -0.8)}
    ${sparkle(94, 96, 12, '#FBBF24', -1.4)}
    ${sparkle(2, 74, 6, '#FEF3C7', -0.4)}`,

  // Plameny (epická) — plamínky šlehající z horní hrany
  'frame-fire': () => `
    <g class="fd-flicker">
      <path fill="#F97316" d="M14 4 C10 -4 16 -10 14 -16 C22 -8 24 -2 20 4 Z"/>
      <path fill="#FDE047" d="M15 4 C13 -1 16 -5 15 -8 C19 -3 19 1 18 4 Z"/>
    </g>
    <g class="fd-flicker" style="animation-delay:-0.3s">
      <path fill="#EF4444" d="M46 3 C40 -8 50 -14 47 -22 C58 -12 60 -3 54 3 Z"/>
      <path fill="#FDBA74" d="M48 3 C46 -3 50 -8 49 -12 C54 -6 55 -1 52 3 Z"/>
    </g>
    <g class="fd-flicker" style="animation-delay:-0.6s">
      <path fill="#F97316" d="M80 4 C76 -5 83 -10 81 -15 C89 -7 90 -1 86 4 Z"/>
      <path fill="#FDE047" d="M81 4 C80 0 82 -3 82 -6 C85 -2 85 1 84 4 Z"/>
    </g>`,

  // Láva (epická) — kapky lávy stékající z dolní hrany + bublina v rohu
  // okraj teče a žhne (animace .aura-lava v CSS), dole krátké kapky, nahoře praskající bublinky
  'frame-lava': () => `
    ${lavaDrip(24, 0, 7)}
    ${lavaDrip(58, -0.9, 5)}
    ${lavaDrip(86, -0.45, 8)}
    ${lavaDrip(-1, -1.3, 5, true)}
    <circle class="fd-pop" cx="20" cy="1" r="3.5" fill="#FDBA74"/>
    <circle class="fd-pop" style="animation-delay:-0.8s" cx="52" cy="0" r="2.6" fill="#FDE047"/>
    <circle class="fd-pop" style="animation-delay:-1.5s" cx="80" cy="1" r="3.2" fill="#FB923C"/>`,

  // Polární záře (epická) — barevné jiskřičky
  'frame-aurora': () => `
    ${sparkle(0, 20, 8, '#34D399', 0)}
    ${sparkle(98, 6, 7, '#22D3EE', -0.7)}
    ${sparkle(98, 88, 10, '#A78BFA', -1.3)}
    ${sparkle(14, 102, 6, '#F472B6', -0.4)}`,

  // Chrom (epická) — lesklý odlesk v rohu
  'frame-chrome': () => `
    ${sparkle(4, 4, 11, '#FFFFFF', 0)}
    ${sparkle(96, 96, 6, '#E2E8F0', -1.1)}
    <circle class="fd-twinkle" style="animation-delay:-0.5s" cx="18" cy="-3" r="1.8" fill="#FFFFFF"/>`,



};

// Sněhová vločka (6 ramen) se středem cx,cy
function snowflake(cx, cy, r, delay = 0) {
  const arms = [0, 60, 120].map((a) => {
    const rad = (a * Math.PI) / 180;
    const dx = Math.cos(rad) * r;
    const dy = Math.sin(rad) * r;
    return `M${cx - dx} ${cy - dy} L${cx + dx} ${cy + dy}`;
  }).join(' ');
  return `<g class="fd-spin" style="animation-delay:${delay}s"><path d="${arms}" stroke="#FFFFFF" stroke-width="${r * 0.28}" stroke-linecap="round" fill="none"/><circle cx="${cx}" cy="${cy}" r="${r * 0.28}" fill="#E0F2FE"/></g>`;
}

// Srdíčko se středem cx,cy velikosti s
function heart(cx, cy, s, fill, delay = 0) {
  return `<path class="fd-rise" style="animation-delay:${delay}s" fill="${fill}" d="M${cx} ${cy + s * 0.9} C${cx - s * 1.4} ${cy} ${cx - s * 0.9} ${cy - s * 1.1} ${cx} ${cy - s * 0.35} C${cx + s * 0.9} ${cy - s * 1.1} ${cx + s * 1.4} ${cy} ${cx} ${cy + s * 0.9} Z"/>`;
}

// Blesk se středem cx,cy velikosti s
function bolt(cx, cy, s, delay = 0) {
  return `<path class="fd-zap" style="animation-delay:${delay}s" fill="#FDE047" stroke="#CA8A04" stroke-width="0.8" stroke-linejoin="round"
    d="M${cx + s * 0.2} ${cy - s} L${cx - s * 0.55} ${cy + s * 0.1} L${cx - s * 0.05} ${cy + s * 0.1} L${cx - s * 0.25} ${cy + s} L${cx + s * 0.6} ${cy - s * 0.15} L${cx + s * 0.08} ${cy - s * 0.15} Z"/>`;
}

// Nota se středem hlavičky cx,cy
function note(cx, cy, s, fill, delay = 0) {
  return `<g class="fd-rise" style="animation-delay:${delay}s" fill="${fill}">
    <ellipse cx="${cx}" cy="${cy}" rx="${s * 0.55}" ry="${s * 0.4}" transform="rotate(-20 ${cx} ${cy})"/>
    <rect x="${cx + s * 0.4}" y="${cy - s * 1.6}" width="${s * 0.18}" height="${s * 1.6}"/>
    <path d="M${cx + s * 0.5} ${cy - s * 1.6} q${s * 0.8} ${s * 0.3} ${s * 0.6} ${s * 0.9} q-${s * 0.1} -${s * 0.45} -${s * 0.6} -${s * 0.5} z"/>
  </g>`;
}

Object.assign(FRAME_DECOR, {
  // Mráz (epická) — sněhové vločky, co se pomalu točí
  'frame-frost': () => `
    ${snowflake(0, 4, 9, 0)}
    ${snowflake(98, 20, 6, -2)}
    ${snowflake(94, 98, 10, -4)}
    ${snowflake(6, 80, 5, -1)}`,

  // Láska (epická) — srdíčka stoupající vzhůru
  'frame-love': () => `
    ${heart(98, 10, 8, '#F43F5E', 0)}
    ${heart(106, 34, 5, '#FDA4AF', -0.8)}
    ${heart(-2, 88, 7, '#FB7185', -1.5)}
    ${heart(8, 104, 4.5, '#FFE4E6', -0.4)}`,

  // Blesk (epická) — blesky, co probleskují
  'frame-electric': () => `
    ${bolt(98, 6, 12, 0)}
    ${bolt(2, 92, 10, -0.7)}
    ${sparkle(-4, 20, 4, '#FEF08A', -0.3)}
    ${sparkle(104, 80, 4, '#93C5FD', -1.1)}`,

  // Hudba (epická) — noty poletující kolem
  'frame-music': () => `
    ${note(98, 14, 9, '#FBBF24', 0)}
    ${note(-2, 94, 8, '#F472B6', -1)}
    ${note(8, 12, 6, '#C4B5FD', -1.8)}`,



});

// Ozdoba pro rámeček (item nebo id). Běžné a vzácné rámečky nemají nic.
// Lávová kapka: z okraje se natáhne, odtrhne se kulička a spadne dolů.
// x = místo na spodní hraně (side = na levém boku, kape podél něj), delay v s, s = velikost
function lavaDrip(x, delay, s, side = false) {
  const top = side ? 60 : 97;
  const cx = side ? -1.5 : x;
  const w = s * 0.55;
  return `<g style="animation-delay:${delay}s">
    <path class="lava-drip" style="animation-delay:${delay}s" fill="#F97316"
      d="M${cx - w} ${top} C${cx - w} ${top + s * 0.9} ${cx - w * 0.35} ${top + s * 1.5} ${cx} ${top + s * 1.6} C${cx + w * 0.35} ${top + s * 1.5} ${cx + w} ${top + s * 0.9} ${cx + w} ${top} Z"/>
    <path class="lava-drip" style="animation-delay:${delay}s" fill="#FDE047" opacity="0.75"
      d="M${cx - w * 0.35} ${top} C${cx - w * 0.35} ${top + s * 0.6} ${cx} ${top + s * 1.1} ${cx} ${top + s * 1.1} C${cx} ${top + s * 1.1} ${cx + w * 0.35} ${top + s * 0.6} ${cx + w * 0.35} ${top} Z"/>
    <circle class="lava-drop" style="animation-delay:${delay}s" cx="${cx}" cy="${top + s * 1.6}" r="${s * 0.42}" fill="#EF4444"/>
  </g>`;
}

// Rámečky s animovaným okrajem (vrstva přes okraj rámečku, uvnitř fotka zůstane)
// rámečky s vlastní barevnou září za sebou (CSS .halo-<id>)
const FRAME_HALO_IDS = new Set(['frame-sweets']);

const LG_BEVEL_IDS = new Set(['frame-rainbow', 'frame-galaxy', 'frame-diamond', 'frame-king', 'frame-phoenix', 'frame-sweets', 'frame-haunted', 'frame-vampire']);
const FRAME_AURA = { 'frame-fortune': 'fortune', 'frame-lava': 'lava' };

// Fortune — vrstvy navíc (vše barevné, bez bílé): paprsky, oběžná dráha mincí a čtyřlístků, plocha pro výbuchy
const CLOVER_SVG = '<svg viewBox="0 0 24 24"><g fill="#22C55E" stroke="#14532D" stroke-width="1">'
  + [0, 90, 180, 270].map((r) => `<ellipse cx="12" cy="6.5" rx="4.6" ry="5.6" transform="rotate(${r} 12 12)"/>`).join('')
  + '</g><circle cx="12" cy="12" r="2.2" fill="#86EFAC"/></svg>';
const FORTUNE_EXTRA = '<div class="fortune-rays" aria-hidden="true"></div>'
  + '<div class="fortune-orbit" aria-hidden="true">'
  + '<i class="fo-item fo-coin" style="animation-delay:0s"></i>'
  + `<i class="fo-item fo-clover" style="animation-delay:-2.25s">${CLOVER_SVG}</i>`
  + '<i class="fo-item fo-coin" style="animation-delay:-4.5s"></i>'
  + `<i class="fo-item fo-clover" style="animation-delay:-6.75s">${CLOVER_SVG}</i>`
  + '</div><div class="fortune-burst" aria-hidden="true"></div>';

function frameDecorHtml(frame) {
  if (!frame) return '';
  const id = typeof frame === 'string' ? frame : frame.id;
  const make = FRAME_DECOR[id];
  // lesk / efekt okraje podle vzácnosti (Fortune má vlastní duhovou animaci)
  const item = typeof frame === 'string' ? ALL_ITEMS.find((i) => i.id === frame) : frame;
  const auraKind = FRAME_AURA[id] || (item && item.rarity);
  // common rámeček = jedna plná barva, bez odlesku
  // legendary: každý rámeček má vlastní animovaný okraj (třída aura-<id>, CSS na konci style.css)
  const auraId = auraKind === 'legendary' ? ` aura-${id}` : '';
  const aura = (auraKind && auraKind !== 'common' ? `<div class="frame-aura aura-${auraKind}${auraId}" aria-hidden="true"></div>` : '')
    // legendary: tenká obrysová linka + zkosení (bevel) přes okraj, barvy podle rámečku (CSS .bv-<id>)
    + (auraId && LG_BEVEL_IDS.has(id) ? `<div class="frame-bevel bv-${id}" aria-hidden="true"></div>` : '');
  // Upír: kapky krve, které se tvoří na spodním okraji a padají (v % rozměrech rámečku)
  const drips = id === 'frame-vampire'
    ? '<div class="vamp-drips" aria-hidden="true"><i style="left:22%"></i><i style="left:52%;animation-delay:-1.9s"></i><i style="left:78%;animation-delay:-3.6s"></i></div>' : '';
  const rarity = item && item.rarity;
  // záře za rámečkem: mythic vždy, jinak jen rámečky s vlastní září (legendary zlatá záře zrušena)
  const hasHalo = rarity === 'mythic' || FRAME_HALO_IDS.has(id);
  const halo = hasHalo ? `<div class="frame-halo halo-${rarity} halo-${id}" aria-hidden="true"></div>` : '';
  // legendary: občasný průlet tématického předmětu (řídí ho scheduler níže)
  const fly = (rarity === 'legendary' || rarity === 'mythic') && FLYBY_ART[id] ? `<div class="frame-flyby" data-flyby="${id}" aria-hidden="true"></div>` : '';
  // Fortune: sluneční paprsky za rámečkem, oběžné mince/čtyřlístky a plocha pro jackpot výbuchy
  const fortune = id === 'frame-fortune' ? FORTUNE_EXTRA : '';
  if (!make) return halo + fortune + aura + drips + fly;
  return `${halo}${fortune}${aura}${drips}<div class="frame-decor" aria-hidden="true"><svg viewBox="-12 -12 124 124">${make()}</svg></div>${fly}`;
}

// ------------------------------------------------ Spooky (Spooky Chest) ---

// Duch se středem hlavy cx,cy velikosti s — kulatá hlava a vlnitý spodek
function ghost(cx, cy, s, delay = 0) {
  const h = s / 2;
  return `<g class="fd-float" style="animation-delay:${delay}s">
    <path fill="#FFFFFF" stroke="#C4B5FD" stroke-width="0.8" d="M${cx - s} ${cy + s * 1.1} V${cy} A${s} ${s} 0 0 1 ${cx + s} ${cy} V${cy + s * 1.1}
      l-${h} -${s * 0.35} l-${h} ${s * 0.35} l-${h} -${s * 0.35} l-${h} ${s * 0.35} Z"/>
    <ellipse cx="${cx - s * 0.35}" cy="${cy}" rx="${s * 0.16}" ry="${s * 0.24}" fill="#1E1B4B"/>
    <ellipse cx="${cx + s * 0.35}" cy="${cy}" rx="${s * 0.16}" ry="${s * 0.24}" fill="#1E1B4B"/>
  </g>`;
}

// Netopýr se středem cx,cy velikosti s — mává křídly
function bat(cx, cy, s, fill = '#1E1B4B', delay = 0) {
  const wing = (dir) => `M${cx + dir * s * 0.18} ${cy - s * 0.1} Q${cx + dir * s * 0.6} ${cy - s * 0.65} ${cx + dir * s * 1.25} ${cy - s * 0.4}
    Q${cx + dir * s * 1.0} ${cy - s * 0.1} ${cx + dir * s * 1.1} ${cy + s * 0.25} Q${cx + dir * s * 0.8} ${cy + s * 0.05} ${cx + dir * s * 0.6} ${cy + s * 0.3}
    Q${cx + dir * s * 0.45} ${cy + s * 0.05} ${cx + dir * s * 0.18} ${cy + s * 0.2} Z`;
  return `<g class="fd-flap" style="animation-delay:${delay}s" fill="${fill}" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="0.7" stroke-linejoin="round">
    <path d="${wing(1)}"/><path d="${wing(-1)}"/>
    <ellipse cx="${cx}" cy="${cy + s * 0.05}" rx="${s * 0.24}" ry="${s * 0.34}"/>
    <path d="M${cx - s * 0.2} ${cy - s * 0.2} l${s * 0.04} -${s * 0.3} l${s * 0.12} ${s * 0.18} Z M${cx + s * 0.2} ${cy - s * 0.2} l-${s * 0.04} -${s * 0.3} l-${s * 0.12} ${s * 0.18} Z"/>
    <circle cx="${cx - s * 0.09}" cy="${cy}" r="${s * 0.05}" fill="#FDE047"/><circle cx="${cx + s * 0.09}" cy="${cy}" r="${s * 0.05}" fill="#FDE047"/>
  </g>`;
}

// Dýně (jack-o'-lantern) se středem cx,cy poloměru r — oči a pusa svítí
function pumpkin(cx, cy, r, delay = 0) {
  return `<g class="fd-float" style="animation-delay:${delay}s">
    <path d="M${cx} ${cy - r * 0.85} q${r * 0.1} -${r * 0.45} ${r * 0.4} -${r * 0.5}" stroke="#4D7C0F" stroke-width="${r * 0.22}" stroke-linecap="round" fill="none"/>
    <ellipse cx="${cx - r * 0.45}" cy="${cy}" rx="${r * 0.6}" ry="${r * 0.85}" fill="#EA580C"/>
    <ellipse cx="${cx + r * 0.45}" cy="${cy}" rx="${r * 0.6}" ry="${r * 0.85}" fill="#EA580C"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r * 0.62}" ry="${r * 0.9}" fill="#F97316"/>
    <g class="fd-zap" style="animation-delay:${delay}s" fill="#FDE047">
      <path d="M${cx - r * 0.55} ${cy - r * 0.1} l${r * 0.2} -${r * 0.35} l${r * 0.2} ${r * 0.35} Z"/>
      <path d="M${cx + r * 0.15} ${cy - r * 0.1} l${r * 0.2} -${r * 0.35} l${r * 0.2} ${r * 0.35} Z"/>
      <path d="M${cx - r * 0.5} ${cy + r * 0.2} q${r * 0.5} ${r * 0.45} ${r} 0 l-${r * 0.2} ${r * 0.15} l-${r * 0.15} -${r * 0.1} l-${r * 0.15} ${r * 0.12} l-${r * 0.15} -${r * 0.12} l-${r * 0.15} ${r * 0.1} Z"/>
    </g>
  </g>`;
}

// Pavouk visící na vlákně z horní hrany v bodě x, tělo ve výšce y
function spider(x, y, s, delay = 0) {
  const legs = [-1, 1].map((d) => [0.2, 0, -0.25].map((k, i) => `M${x} ${y + k * s} q${d * s * 0.6} -${s * 0.35} ${d * s * (0.95 + i * 0.1)} ${s * (0.2 + i * 0.12)}`).join(' ')).join(' ');
  return `<g class="fd-dangle" style="animation-delay:${delay}s">
    <path d="M${x} -30 V${y - s * 0.4}" stroke="#E5E7EB" stroke-width="0.8"/>
    <path d="${legs}" stroke="#D1D5DB" stroke-width="${s * 0.1}" stroke-linecap="round" fill="none"/>
    <ellipse cx="${x}" cy="${y + s * 0.15}" rx="${s * 0.45}" ry="${s * 0.55}" fill="#374151" stroke="#E5E7EB" stroke-width="0.8"/>
    <circle cx="${x}" cy="${y - s * 0.35}" r="${s * 0.3}" fill="#4B5563" stroke="#E5E7EB" stroke-width="0.7"/>
    <circle cx="${x - s * 0.12}" cy="${y - s * 0.38}" r="${s * 0.07}" fill="#EF4444"/><circle cx="${x + s * 0.12}" cy="${y - s * 0.38}" r="${s * 0.07}" fill="#EF4444"/>
  </g>`;
}

// Pavučina v rohu — vlákna z rohu cx,cy (vpravo dole) a oblouky mezi nimi.
// Celá se vejde do viewBoxu, ať není uříznutá.
function cornerWeb(cx, cy) {
  const dirs = [[0, -1], [-0.5, -0.87], [-0.87, -0.5], [-1, 0]];
  const threads = dirs.map(([dx, dy]) => `M${cx} ${cy} L${cx + dx * 28} ${cy + dy * 28}`).join(' ');
  const rings = [9, 17, 25].map((r) => {
    const pts = dirs.map(([dx, dy]) => [cx + dx * r, cy + dy * r]);
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      // oblouk mezi vlákny se lehce prohne dovnitř k rohu
      const mx = (pts[i - 1][0] + pts[i][0]) / 2 + (cx - (pts[i - 1][0] + pts[i][0]) / 2) * 0.15;
      const my = (pts[i - 1][1] + pts[i][1]) / 2 + (cy - (pts[i - 1][1] + pts[i][1]) / 2) * 0.15;
      d += ` Q${mx} ${my} ${pts[i][0]} ${pts[i][1]}`;
    }
    return d;
  }).join(' ');
  return `<path d="${threads} ${rings}" stroke="#E5E7EB" stroke-opacity="0.85" stroke-width="0.8" fill="none" stroke-linecap="round"/>`;
}

Object.assign(FRAME_DECOR, {
  // Duch (epická) — dva duchové poletují kolem rohů
  'frame-ghost': () => `
    ${ghost(98, 4, 10, 0)}
    ${ghost(0, 86, 7, -1.6)}
    ${sparkle(-4, 20, 4, '#E9D5FF', -0.6)}`,

  // Čarodějnice (epická) — klobouk na rohu a zelené jiskry
  'frame-witch': () => `
    <g class="fd-float">
      <path d="M2 2 L16 -24 L22 -20 L26 4 Z" fill="#2E1065" stroke="#86EFAC" stroke-width="0.8" stroke-linejoin="round"/>
      <rect x="4" y="-4" width="21" height="4" rx="1" fill="#22C55E"/>
      <ellipse cx="14" cy="3" rx="19" ry="4" fill="#3B0764"/>
    </g>
    ${sparkle(98, 10, 8, '#86EFAC', -0.5)}
    ${sparkle(104, 70, 5, '#C084FC', -1.2)}
    ${sparkle(6, 100, 6, '#86EFAC', -1.8)}`,

  // Pavouk (epická) — pavouk visí na vlákně a pavučina v rohu
  'frame-spider': () => `
    ${cornerWeb(106, 106)}
    ${spider(80, 16, 13, 0)}
    ${sparkle(-4, 30, 4, '#E5E7EB', -0.8)}`,


});

// Fortune (legendární, jen z kola štěstí) — čtyřlístek, mince a třpytky
function clover(cx, cy, s, delay = 0) {
  const leaf = (rot) => `<ellipse cx="${cx}" cy="${cy - s * 0.55}" rx="${s * 0.42}" ry="${s * 0.55}" transform="rotate(${rot} ${cx} ${cy})"/>`;
  return `<g class="fd-float" style="animation-delay:${delay}s" fill="#22C55E" stroke="#14532D" stroke-width="0.8">
    ${[0, 90, 180, 270].map(leaf).join('')}
    <circle cx="${cx}" cy="${cy}" r="${s * 0.22}" fill="#86EFAC"/>
    <path d="M${cx} ${cy} q${s * 0.4} ${s * 0.7} ${s * 0.9} ${s * 0.9}" stroke="#14532D" stroke-width="1.4" fill="none"/>
  </g>`;
}

Object.assign(FRAME_DECOR, {
  'frame-fortune': () => `
    <g class="fd-orbit">
      ${sparkle(50, -8, 6, '#FF3D7F', 0)}
      ${sparkle(108, 50, 5, '#FDE047', -0.6)}
      ${sparkle(50, 108, 6, '#F9A8D4', -1.2)}
      ${sparkle(-8, 50, 5, '#86EFAC', -1.8)}
    </g>
    <g class="fd-orbit rev">
      <circle cx="94" cy="8" r="1.8" fill="#22D3EE"/><circle cx="6" cy="92" r="1.8" fill="#FDE047"/>
      <circle cx="96" cy="94" r="1.4" fill="#C4B5FD"/><circle cx="4" cy="6" r="1.4" fill="#86EFAC"/>
    </g>
    ${sparkle(-4, 24, 7, '#FDE047', -0.3)}`,
});


// ======================= Legendary — přepracované ozdoby =======================
// Plochá ručně "dělaná" kresba: každý tvar má tenký tmavý obrys v odstínu své barvy, stín a světlo jsou
// vrstvy (bez id-gradientů, takže fungují i ve skrytých SVG). Světla jsou vždy barevná, žádný bílý záblesk.
// Animace jen transform/opacity (třídy fd-bob, fd-gem, fd-lick, fd-ember, fd-fog, fd-sprinkle… viz style.css).

// Mráček: obrys, stínová spodní vrstva, světlá vrstva, lehký odlesk; volitelně duha nad ním
function lgCloudShapes(cx, cy, s) {
  return `<circle cx="${cx - 0.75 * s}" cy="${cy + 0.1 * s}" r="${0.42 * s}"/><circle cx="${cx - 0.2 * s}" cy="${cy - 0.2 * s}" r="${0.62 * s}"/>`
    + `<circle cx="${cx + 0.5 * s}" cy="${cy}" r="${0.5 * s}"/><circle cx="${cx + 1.0 * s}" cy="${cy + 0.18 * s}" r="${0.34 * s}"/>`
    + `<rect x="${cx - 1.1 * s}" y="${cy + 0.1 * s}" width="${2.44 * s}" height="${0.42 * s}" rx="${0.21 * s}"/>`;
}
function lgCloud(cx, cy, s, delay = 0, rainbow = false) {
  const arcs = rainbow ? ['#F87171', '#FBBF24', '#34D399', '#60A5FA'].map((c, i) => {
    const r = s * (1.75 - i * 0.22);
    return `<path d="M${cx - r} ${cy + 0.3 * s} A${r} ${r} 0 0 1 ${cx + r} ${cy + 0.3 * s}" stroke="${c}" stroke-width="${s * 0.2}" fill="none" stroke-linecap="round"/>`;
  }).join('') : '';
  return `<g class="fd-bob" style="animation-delay:${delay}s">${arcs}
    <g fill="#8B5CF6" stroke="#8B5CF6" stroke-width="1.4" stroke-linejoin="round">${lgCloudShapes(cx, cy, s)}</g>
    <g fill="#C4B5FD">${lgCloudShapes(cx, cy, s)}</g>
    <g fill="#F5F3FF">${lgCloudShapes(cx, cy - 0.09 * s, s)}</g>
    <ellipse cx="${cx - 0.4 * s}" cy="${cy - 0.5 * s}" rx="${0.3 * s}" ry="${0.11 * s}" fill="#FBCFE8" opacity="0.85" transform="rotate(-25 ${cx - 0.4 * s} ${cy - 0.5 * s})"/>
  </g>`;
}

// Planeta se stínem, pásem a volitelným dvojitým prstencem (zadní půlka za planetou, přední před ní)
function lgPlanet(cx, cy, r, c, rot = 0, delay = 0, ring = true) {
  const rx = r * 1.75, ry = r * 0.42;
  const back = `M${cx - rx} ${cy} A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`;
  const front = `M${cx - rx} ${cy} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy}`;
  const ringG = (d, o) => `<g transform="rotate(${rot} ${cx} ${cy})" opacity="${o}"><path d="${d}" stroke="${c.ring}" stroke-width="${r * 0.22}" fill="none"/><path d="${d}" stroke="${c.ring2}" stroke-width="${r * 0.07}" fill="none"/></g>`;
  return `<g class="fd-bob" style="animation-delay:${delay}s">
    ${ring ? ringG(back, 0.7) : ''}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${c.dark}" stroke="${c.line}" stroke-width="0.8"/>
    <circle cx="${cx - 0.14 * r}" cy="${cy - 0.14 * r}" r="${r * 0.8}" fill="${c.base}"/>
    <path d="M${cx - 0.85 * r} ${cy + 0.18 * r} Q${cx} ${cy + 0.5 * r} ${cx + 0.85 * r} ${cy + 0.05 * r}" stroke="${c.band}" stroke-width="${r * 0.16}" fill="none" opacity="0.45" stroke-linecap="round"/>
    <ellipse cx="${cx - 0.4 * r}" cy="${cy - 0.45 * r}" rx="${r * 0.28}" ry="${r * 0.14}" fill="${c.light}" opacity="0.6" transform="rotate(-35 ${cx - 0.4 * r} ${cy - 0.45 * r})"/>
    ${ring ? ringG(front, 1) : ''}
  </g>`;
}

// Briliantový kámen (korunka + spodek s fasetami), paleta p
function lgGem(cx, cy, s, p, delay = 0) {
  const L = cx - s, R = cx + s, T = cy - 0.85 * s, M = cy - 0.3 * s, B = cy + 0.9 * s, tl = cx - 0.5 * s, tr = cx + 0.5 * s, a = cx - 0.3 * s, b = cx + 0.3 * s;
  const f = (pts, fill) => `<path d="M${pts.join(' L')} Z" fill="${fill}"/>`;
  return `<g class="fd-gem" style="animation-delay:${delay}s" stroke="${p.line}" stroke-width="0.6" stroke-opacity="0.75" stroke-linejoin="round">
    ${f([`${L} ${M}`, `${tl} ${T}`, `${tr} ${T}`, `${R} ${M}`], p.crown)}
    ${f([`${L} ${M}`, `${tl} ${T}`, `${a} ${M}`], p.crownD)}
    ${f([`${tl} ${T}`, `${tr} ${T}`, `${cx} ${M}`], p.crownL)}
    ${f([`${tr} ${T}`, `${R} ${M}`, `${b} ${M}`], p.crownD)}
    ${f([`${L} ${M}`, `${R} ${M}`, `${cx} ${B}`], p.pav)}
    ${f([`${L} ${M}`, `${a} ${M}`, `${cx} ${B}`], p.pavD)}
    ${f([`${b} ${M}`, `${R} ${M}`, `${cx} ${B}`], p.pavL)}
  </g>`;
}

// Korunka s červeným sametem, kuličkami na hrotech a drahokamy v obruči
function lgCrown() {
  const jewel = (x, y, r, c, d, h) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${d}" stroke-width="0.7"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.32}" r="${r * 0.3}" fill="${h}" opacity="0.85"/>`;
  return `<g class="fd-bob">
    <path d="M33 -6 Q50 -17 67 -6 L67 -3 L33 -3 Z" fill="#B91C1C" stroke="#7F1D1D" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M29 -3 L31 -21 L41 -11 L50 -26 L59 -11 L69 -21 L71 -3 Z" fill="#FBBF24" stroke="#92400E" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M50 -26 L59 -11 L69 -21 L71 -3 L50 -3 Z" fill="#D97706" opacity="0.42"/>
    <path d="M32.5 -6 L33.3 -17 L40.5 -10" stroke="#FDE68A" stroke-width="1" fill="none" opacity="0.9" stroke-linecap="round" stroke-linejoin="round"/>
    <g fill="#FDE68A" stroke="#92400E" stroke-width="0.8"><circle cx="31" cy="-22.5" r="2"/><circle cx="50" cy="-27.8" r="2.5"/><circle cx="69" cy="-22.5" r="2"/></g>
    <rect x="28" y="-5" width="44" height="6.5" rx="2" fill="#F59E0B" stroke="#92400E" stroke-width="1.1"/>
    <rect x="29.6" y="-4.3" width="40.8" height="1.5" rx="0.75" fill="#FDE68A" opacity="0.7"/>
    ${jewel(50, -1.8, 2.3, '#EF4444', '#7F1D1D', '#FECACA')}
    ${jewel(39.5, -1.8, 1.7, '#3B82F6', '#1E3A8A', '#BFDBFE')}
    ${jewel(60.5, -1.8, 1.7, '#22C55E', '#14532D', '#BBF7D0')}
  </g>`;
}

// Plamen ze tří jazyků (vnější / střední / jádro), y = základna, w = šířka, h = výška, lean = náklon špičky
function lgFlame(x, y, w, h, lean, delay = 0) {
  const tongue = (x0, hw, th, ln, fill) => `<path fill="${fill}" d="M${x0 - hw} ${y} C${x0 - hw} ${y - th * 0.45} ${x0 - hw * 0.3 + ln * 0.3} ${y - th * 0.6} ${x0 + ln} ${y - th} C${x0 + hw * 0.3 + ln * 0.2} ${y - th * 0.55} ${x0 + hw} ${y - th * 0.4} ${x0 + hw} ${y} Z"/>`;
  const layers = [[1, '#DC2626'], [0.7, '#F97316'], [0.4, '#FDE047']];
  const set = [[-0.85 * w, 0.6, lean * 0.6], [0.85 * w, 0.72, lean * 1.2], [0, 1, lean]];
  return `<g class="fd-lick" style="animation-delay:${delay}s">${set.map(([dx, sc, ln]) => layers.map(([k, fill]) => tongue(x + dx, w * (0.35 + 0.3 * sc) * k, h * sc * k, ln * k, fill)).join('')).join('')}</g>`;
}

// Donut shora: těsto, růžová poleva, barevný posyp a tónovaný odlesk
function lgDonut(cx, cy, r, delay = 0) {
  const m = 0.72 * r, pt = (ang, rad) => [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad];
  const cols = ['#FDE047', '#7DD3FC', '#86EFAC', '#FFF0F6', '#A78BFA', '#FDE047'];
  const sp = cols.map((c, i) => { const a = i * 1.05 + 0.4, [x, y] = pt(a, m), dx = -Math.sin(a) * 0.1 * r, dy = Math.cos(a) * 0.1 * r; return `<path d="M${(x - dx).toFixed(1)} ${(y - dy).toFixed(1)} L${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)}" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>`; }).join('');
  const [hx1, hy1] = pt(3.5, m), [hx2, hy2] = pt(4.35, m);
  return `<g class="fd-bob" style="animation-delay:${delay}s">
    <circle cx="${cx}" cy="${cy}" r="${m}" fill="none" stroke="#9A3412" stroke-width="${0.6 * r + 1.4}"/>
    <circle cx="${cx}" cy="${cy}" r="${m}" fill="none" stroke="#E9A15B" stroke-width="${0.6 * r}"/>
    <circle cx="${cx}" cy="${cy}" r="${m}" fill="none" stroke="#FF5FA2" stroke-width="${0.46 * r}"/>
    <circle cx="${cx}" cy="${cy}" r="${m - 0.25 * r}" fill="none" stroke="#D97706" stroke-width="0.7" opacity="0.8"/>
    <path d="M${hx1.toFixed(1)} ${hy1.toFixed(1)} A${m} ${m} 0 0 1 ${hx2.toFixed(1)} ${hy2.toFixed(1)}" stroke="#FFB3D4" stroke-width="${0.12 * r}" fill="none" stroke-linecap="round" opacity="0.8"/>
    ${sp}
  </g>`;
}

// Lízátko se spirálou (kotouč pomalu rotuje, odlesk stojí), stopka za ním
function lgLolly(cx, cy, r, delay = 0) {
  const spiral = (off) => { let d = ''; for (let i = 0; i <= 36; i++) { const t = i / 36, a = t * 4 * Math.PI + off, rad = r * 0.86 * t; d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rad).toFixed(1)} ${(cy + Math.sin(a) * rad).toFixed(1)} `; } return d; };
  return `<g class="fd-bob" style="animation-delay:${delay}s">
    <path d="M${cx - 0.5 * r} ${cy + 0.6 * r} L${cx - 1.4 * r} ${cy + 1.6 * r}" stroke="#BE185D" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M${cx - 0.5 * r} ${cy + 0.6 * r} L${cx - 1.4 * r} ${cy + 1.6 * r}" stroke="#FFF1E6" stroke-width="2.1" stroke-linecap="round"/>
    <g class="fd-spin" style="animation-duration:18s">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#FF5FA2" stroke="#BE185D" stroke-width="0.8"/>
      <path d="${spiral(0)}" stroke="#FFF0F6" stroke-width="${r * 0.2}" fill="none" stroke-linecap="round"/>
      <path d="${spiral(Math.PI)}" stroke="#7DD3FC" stroke-width="${r * 0.2}" fill="none" stroke-linecap="round"/>
    </g>
    <path d="M${cx - 0.75 * r} ${cy - 0.3 * r} A${0.8 * r} ${0.8 * r} 0 0 1 ${cx - 0.2 * r} ${cy - 0.78 * r}" stroke="#FFD1E5" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.85"/>
  </g>`;
}

// Zabalený bonbon s překroucenými konci a pruhy
function lgBonbon(cx, cy, delay = 0) {
  return `<g class="fd-bob" style="animation-delay:${delay}s" stroke="#6D28D9" stroke-width="0.7" stroke-linejoin="round">
    <path d="M${cx - 12} ${cy - 4.5} L${cx - 6} ${cy} L${cx - 12} ${cy + 4.5} Z" fill="#FDE047" stroke="#B45309"/>
    <path d="M${cx + 12} ${cy - 4.5} L${cx + 6} ${cy} L${cx + 12} ${cy + 4.5} Z" fill="#FDE047" stroke="#B45309"/>
    <ellipse cx="${cx}" cy="${cy}" rx="7" ry="5.4" fill="#A78BFA"/>
    <path d="M${cx - 3.6} ${cy - 4.8} q2.2 4.8 0 9.6 M${cx + 1.6} ${cy - 5.2} q2.2 5.2 0 10.4" stroke="#DDD6FE" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <ellipse cx="${cx - 2.5}" cy="${cy - 2.6}" rx="2" ry="0.9" fill="#C4B5FD" stroke="none" transform="rotate(-20 ${cx - 2.5} ${cy - 2.6})"/>
  </g>`;
}

// Posypka padající kolem (kapsle); rotace je na vnější g, aby ji animace nepřepsala
function lgSprinkle(x, y, rot, c, delay) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><path class="fd-sprinkle" style="animation-delay:${delay}s" d="M-2 0 L2 0" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/></g>`;
}

// Netopýr: křídla s vlnitým okrajem (máchají), tělo s ušima, očima a (volitelně) tesáky
function lgBat(cx, cy, s, fill, edge, eye, delay = 0, fangs = false) {
  const wing = (d) => `M${cx + d * 0.15 * s} ${cy - 0.05 * s} C${cx + d * 0.5 * s} ${cy - 0.75 * s} ${cx + d * 1.1 * s} ${cy - 0.7 * s} ${cx + d * 1.4 * s} ${cy - 0.3 * s}`
    + ` Q${cx + d * 1.2 * s} ${cy - 0.05 * s} ${cx + d * 1.25 * s} ${cy + 0.28 * s} Q${cx + d * 0.95 * s} ${cy + 0.05 * s} ${cx + d * 0.8 * s} ${cy + 0.32 * s}`
    + ` Q${cx + d * 0.6 * s} ${cy + 0.05 * s} ${cx + d * 0.4 * s} ${cy + 0.28 * s} Q${cx + d * 0.3 * s} ${cy + 0.12 * s} ${cx + d * 0.15 * s} ${cy + 0.25 * s} Z`;
  return `<g class="fd-float" style="animation-delay:${delay}s" fill="${fill}" stroke="${edge}" stroke-width="0.6" stroke-linejoin="round">
    <g class="fd-flap2" style="animation-delay:${delay}s"><path d="${wing(1)}"/><path d="${wing(-1)}"/></g>
    <ellipse cx="${cx}" cy="${cy + 0.05 * s}" rx="${0.22 * s}" ry="${0.32 * s}"/>
    <path d="M${cx - 0.17 * s} ${cy - 0.22 * s} L${cx - 0.2 * s} ${cy - 0.52 * s} L${cx - 0.03 * s} ${cy - 0.3 * s} Z M${cx + 0.17 * s} ${cy - 0.22 * s} L${cx + 0.2 * s} ${cy - 0.52 * s} L${cx + 0.03 * s} ${cy - 0.3 * s} Z"/>
    <circle cx="${cx - 0.08 * s}" cy="${cy - 0.05 * s}" r="${0.05 * s}" fill="${eye}" stroke="none"/><circle cx="${cx + 0.08 * s}" cy="${cy - 0.05 * s}" r="${0.05 * s}" fill="${eye}" stroke="none"/>
    ${fangs ? `<path d="M${cx - 0.07 * s} ${cy + 0.1 * s} l0 ${0.11 * s} l${0.04 * s} -${0.11 * s} Z M${cx + 0.07 * s} ${cy + 0.1 * s} l0 ${0.11 * s} l-${0.04 * s} -${0.11 * s} Z" fill="#FEF3C7" stroke="none"/>` : ''}
  </g>`;
}

// Duch: průsvitné tělo s vnitřním stínem, zářící oči, vlnitý spodek
function lgGhost(cx, cy, s, delay = 0) {
  const d = `M${cx - s} ${cy + 1.15 * s} V${cy} A${s} ${s} 0 0 1 ${cx + s} ${cy} V${cy + 1.15 * s} Q${cx + 0.67 * s} ${cy + 0.85 * s} ${cx + 0.33 * s} ${cy + 1.15 * s} Q${cx} ${cy + 0.85 * s} ${cx - 0.33 * s} ${cy + 1.15 * s} Q${cx - 0.67 * s} ${cy + 0.85 * s} ${cx - s} ${cy + 1.15 * s} Z`;
  return `<g class="fd-bob" style="animation-delay:${delay}s">
    <path d="${d}" fill="#C4B5FD" stroke="#7C3AED" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="${d}" fill="#EDE9FE" transform="translate(${cx - 0.05 * s} ${cy - 0.05 * s}) scale(0.92) translate(${-cx} ${-cy})"/>
    <ellipse cx="${cx - 0.36 * s}" cy="${cy}" rx="${0.15 * s}" ry="${0.23 * s}" fill="#1E1B4B"/><ellipse cx="${cx + 0.36 * s}" cy="${cy}" rx="${0.15 * s}" ry="${0.23 * s}" fill="#1E1B4B"/>
    <circle cx="${cx - 0.4 * s}" cy="${cy - 0.08 * s}" r="${0.05 * s}" fill="#86EFAC"/><circle cx="${cx + 0.32 * s}" cy="${cy - 0.08 * s}" r="${0.05 * s}" fill="#86EFAC"/>
    <ellipse cx="${cx}" cy="${cy + 0.42 * s}" rx="${0.12 * s}" ry="${0.16 * s}" fill="#4C1D95" opacity="0.8"/>
  </g>`;
}

// Dýně se žebry, stopkou a svítícím obličejem
function lgPumpkin(cx, cy, r, delay = 0) {
  const e = (dx, rx, fill) => `<ellipse cx="${cx + dx * r}" cy="${cy}" rx="${rx * r}" ry="${0.85 * r}" fill="${fill}"/>`;
  return `<g class="fd-bob" style="animation-delay:${delay}s">
    <path d="M${cx} ${cy - 0.8 * r} q${0.05 * r} -${0.45 * r} ${0.45 * r} -${0.55 * r}" stroke="#14532D" stroke-width="${0.3 * r}" stroke-linecap="round" fill="none"/>
    <path d="M${cx} ${cy - 0.8 * r} q${0.05 * r} -${0.45 * r} ${0.45 * r} -${0.55 * r}" stroke="#65A30D" stroke-width="${0.16 * r}" stroke-linecap="round" fill="none"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${1.12 * r}" ry="${0.9 * r}" fill="#9A3412"/>
    ${e(-0.6, 0.55, '#C2410C')}${e(0.6, 0.55, '#C2410C')}${e(-0.3, 0.55, '#EA580C')}${e(0.3, 0.55, '#EA580C')}${e(0, 0.5, '#F97316')}
    <path d="M${cx - 0.75 * r} ${cy - 0.45 * r} Q${cx - 0.55 * r} ${cy - 0.7 * r} ${cx - 0.25 * r} ${cy - 0.72 * r}" stroke="#FDBA74" stroke-width="${0.12 * r}" fill="none" stroke-linecap="round" opacity="0.6"/>
    <g class="fd-glow" style="animation-delay:${delay}s" fill="#FDE047">
      <path d="M${cx - 0.55 * r} ${cy - 0.05 * r} l${0.2 * r} -${0.35 * r} l${0.2 * r} ${0.35 * r} Z"/>
      <path d="M${cx + 0.15 * r} ${cy - 0.05 * r} l${0.2 * r} -${0.35 * r} l${0.2 * r} ${0.35 * r} Z"/>
      <path d="M${cx - 0.5 * r} ${cy + 0.22 * r} q${0.5 * r} ${0.42 * r} ${r} 0 l-${0.2 * r} ${0.14 * r} l-${0.15 * r} -${0.1 * r} l-${0.15 * r} ${0.12 * r} l-${0.15 * r} -${0.12 * r} l-${0.15 * r} ${0.1 * r} Z"/>
    </g>
  </g>`;
}

// Chuchvalec mlhy: tři překrývající se elipsy, pomalu pluje do stran a mění průsvitnost
function lgFog(cx, cy, s, c, delay = 0) {
  return `<g class="fd-fog" style="animation-delay:${delay}s" fill="${c}"><ellipse cx="${cx - 0.7 * s}" cy="${cy + 0.1 * s}" rx="${0.9 * s}" ry="${0.45 * s}"/><ellipse cx="${cx}" cy="${cy - 0.1 * s}" rx="${1.1 * s}" ry="${0.55 * s}"/><ellipse cx="${cx + 0.8 * s}" cy="${cy + 0.12 * s}" rx="${0.8 * s}" ry="${0.4 * s}"/></g>`;
}

// Měsíc s krátery
function lgMoon(cx, cy, r, delay = 0) {
  return `<g class="fd-bob" style="animation-delay:${delay}s">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#FCD34D" stroke="#B45309" stroke-width="0.8"/>
    <circle cx="${cx - 0.12 * r}" cy="${cy - 0.12 * r}" r="${0.82 * r}" fill="#FEF3C7"/>
    <ellipse cx="${cx - 0.35 * r}" cy="${cy - 0.2 * r}" rx="${0.22 * r}" ry="${0.2 * r}" fill="#FDE68A"/><ellipse cx="${cx + 0.25 * r}" cy="${cy + 0.3 * r}" rx="${0.28 * r}" ry="${0.25 * r}" fill="#FDE68A"/>
    <circle cx="${cx + 0.3 * r}" cy="${cy - 0.35 * r}" r="${0.12 * r}" fill="#FCD34D"/>
  </g>`;
}

// Kapka krve se světlým odleskem
function lgDrip(x, w, h, c, delay = 0) {
  return `<g class="fd-drip" style="animation-delay:${delay}s">
    <path fill="${c}" stroke="#7F1D1D" stroke-width="0.6" stroke-linejoin="round" d="M${x - w} 96 C${x - w} ${96 + h * 0.5} ${x - w * 0.5} ${96 + h} ${x} ${96 + h} C${x + w * 0.5} ${96 + h} ${x + w} ${96 + h * 0.5} ${x + w} 96 Z"/>
    <path d="M${x - w * 0.45} 98 Q${x - w * 0.55} ${96 + h * 0.5} ${x - w * 0.2} ${96 + h * 0.75}" stroke="#F87171" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.85"/>
  </g>`;
}

const LG_GEM_CYAN = { crown: '#67E8F9', crownL: '#A5F3FC', crownD: '#22D3EE', pav: '#0891B2', pavD: '#155E75', pavL: '#6366F1', line: '#0E7490' };
const LG_GEM_VIOLET = { crown: '#C4B5FD', crownL: '#E9D5FF', crownD: '#A78BFA', pav: '#7C3AED', pavD: '#4C1D95', pavL: '#D946EF', line: '#5B21B6' };
const LG_GEM_PINK = { crown: '#F9A8D4', crownL: '#FBCFE8', crownD: '#F472B6', pav: '#DB2777', pavD: '#831843', pavL: '#A855F7', line: '#9D174D' };
const LG_GEM_RUBY = { crown: '#F87171', crownL: '#FCA5A5', crownD: '#DC2626', pav: '#B91C1C', pavD: '#7F1D1D', pavL: '#E11D48', line: '#7F1D1D' };

// ---- Redesign 3 legendárních rámečků v kresleném stylu hry: Fénix, Král, Duha ----
// Společné rysy (jako mince / truhly / korunka): tlusté kulaté tvary, tmavší obrys stejného odstínu,
// plná barva + jeden stín dole + jedna tónovaná skvrna odlesku (statická), sytě veselé barvy.

// Kreslená elipsa: obrys + tmavší spodek (stín) + světlejší horní část posunutá nahoru
function ctEll(cx, cy, rx, ry, light, dark, line, sw = 1.6) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${dark}" stroke="${line}" stroke-width="${sw}"/>
    <ellipse cx="${cx}" cy="${cy - ry * 0.2}" rx="${rx * 0.86}" ry="${ry * 0.7}" fill="${light}"/>`;
}

// Fénix: plamínek na horním okraji (kořen y=3, špička nahoře), uvnitř žlutý plamínek
function phFlamePath(x, h, w) {
  return `M${x - w} 3 C${x - w} ${3 - h * 0.45} ${x - w * 0.3} ${3 - h * 0.6} ${x + w * 0.15} ${3 - h} C${x + w * 0.3} ${3 - h * 0.6} ${x + w} ${3 - h * 0.45} ${x + w} 3Z`;
}
function phFlame(x, h, w, delay) {
  return `<g class="fd-lick" style="animation-delay:${delay}s">
    <path d="${phFlamePath(x, h, w)}" fill="#F97316" stroke="#9A3412" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="${phFlamePath(x, h * 0.6, w * 0.5)}" fill="#FDE047"/></g>`;
}
// křídlo (kořen v 3,44, vějíř tří kulatých per směrem doleva); pravé se zrcadlí v dekoru
function phWing() {
  const f = (a, l, d, ln) => `<g transform="rotate(${a})">${ctEll(-7.4, 0, 7.8, 5.4, l, d, ln)}</g>`;
  return `<g transform="translate(3 44)">
    ${f(40, '#F97316', '#DC2626', '#7F1D1D')}${f(-40, '#F97316', '#DC2626', '#7F1D1D')}
    ${f(0, '#FB923C', '#EA580C', '#9A3412')}
    ${ctEll(-2.2, 0, 4.6, 4.6, '#FDE047', '#FBBF24', '#B45309', 1.4)}</g>`;
}
// ocasní pírko (kulatá kapka) visící z dolního středu, kořen v 50,93
function phTail(a, ry, delay) {
  return `<g transform="translate(50 93) rotate(${a})"><g class="ph-sway" style="animation-delay:${delay}s">
    ${ctEll(0, ry, 4.3, ry, '#F97316', '#DC2626', '#7F1D1D')}
    <circle cx="0" cy="${ry * 1.45}" r="1.7" fill="#FDE047"/></g></g>`;
}
// roztomilý pták: kulatá hlava, velké oči, zobák a chocholka (sedí na horním okraji)
function phBird() {
  return `<g class="fd-bob">
    <ellipse cx="50" cy="-9.4" rx="2.1" ry="2.7" fill="#FBBF24" stroke="#B45309" stroke-width="1.2"/>
    <ellipse cx="45.8" cy="-8.2" rx="2" ry="2.6" fill="#DC2626" stroke="#7F1D1D" stroke-width="1.2" transform="rotate(-35 45.8 -8.2)"/>
    <ellipse cx="54.2" cy="-8.2" rx="2" ry="2.6" fill="#DC2626" stroke="#7F1D1D" stroke-width="1.2" transform="rotate(35 54.2 -8.2)"/>
    <circle cx="50" cy="-1.5" r="8.6" fill="#DC2626" stroke="#7F1D1D" stroke-width="1.8"/>
    <circle cx="50" cy="-2.7" r="7.4" fill="#F97316"/>
    <ellipse cx="45" cy="-7" rx="2.6" ry="1.3" fill="#FDBA74" transform="rotate(-28 45 -7)"/>
    <circle cx="45.8" cy="-3.6" r="2.9" fill="#FFF" stroke="#7F1D1D" stroke-width="0.9"/>
    <circle cx="54.2" cy="-3.6" r="2.9" fill="#FFF" stroke="#7F1D1D" stroke-width="0.9"/>
    <circle cx="46.2" cy="-3.2" r="1.5" fill="#1F1235"/><circle cx="53.8" cy="-3.2" r="1.5" fill="#1F1235"/>
    <circle cx="46.7" cy="-3.8" r="0.5" fill="#FFF"/><circle cx="54.3" cy="-3.8" r="0.5" fill="#FFF"/>
    <path d="M47.4 0.4 Q50 -0.6 52.6 0.4 Q52.2 4 50 5 Q47.8 4 47.4 0.4Z" fill="#FBBF24" stroke="#B45309" stroke-width="1.2" stroke-linejoin="round"/></g>`;
}
// jiskra s obrysem
function phSpark(cx, cy, r, delay) {
  return `<g stroke="#EA580C" stroke-width="0.9" stroke-linejoin="round">${sparkle(cx, cy, r, '#FDE047', delay)}</g>`;
}

// Král: velký kulatý drahokam v zlatém lůžku (tmavý spodek, světlejší horní část, tónovaná skvrna)
function kgGem(cx, cy, dark, light, line, tint, delay) {
  return `<g class="fd-gem" style="animation-delay:${delay}s">
    <circle cx="${cx}" cy="${cy}" r="6.6" fill="#FBBF24" stroke="#92400E" stroke-width="1.7"/>
    <circle cx="${cx}" cy="${cy}" r="4.5" fill="${dark}" stroke="${line}" stroke-width="1.2"/>
    <circle cx="${cx - 0.4}" cy="${cy - 0.7}" r="3.4" fill="${light}"/>
    <ellipse cx="${cx - 1.4}" cy="${cy - 1.8}" rx="1.4" ry="0.8" fill="${tint}" transform="rotate(-35 ${cx - 1.4} ${cy - 1.8})"/></g>`;
}
// Král: tlustá kulatá korunka (hroty s kuličkami, pás s kameny), mírně nakloněná a houpavá
function kgCrown() {
  const body = 'M35 3 L34 -6.5 L41.5 -1.5 L50 -8.5 L58.5 -1.5 L66 -6.5 L65 3Z';
  const ball = (x, y, r, c, l) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${l}" stroke-width="1.2"/>`;
  return `<g transform="rotate(-7 50 0) translate(50 3) scale(1.14) translate(-50 -3)"><g class="fd-bob">
    <path d="${body}" fill="#FCD34D" stroke="#92400E" stroke-width="1.8" stroke-linejoin="round"/>
    <ellipse cx="41" cy="-3.4" rx="2.2" ry="1" fill="#FEF08A" transform="rotate(-35 41 -3.4)"/>
    <rect x="34.2" y="-1" width="31.6" height="4.6" rx="1.8" fill="#F59E0B" stroke="#92400E" stroke-width="1.6"/>
    ${ball(42, 1.3, 1.25, '#EF4444', '#991B1B')}${ball(50, 1.3, 1.6, '#3B82F6', '#1E3A8A')}${ball(58, 1.3, 1.25, '#22C55E', '#166534')}
    ${ball(34, -6.5, 1.9, '#EF4444', '#991B1B')}${ball(50, -8.5, 2.2, '#3B82F6', '#1E3A8A')}${ball(66, -6.5, 1.9, '#22C55E', '#166534')}
  </g></g>`;
}
// Král: červená stuha (banner) dole uprostřed se zlatým knoflíkem
function kgRibbon() {
  return `<g class="fd-bob" style="animation-delay:-1.4s">
    <path d="M40 98.5 L31 98.5 L34.5 103 L31 107.5 L40 105.5Z" fill="#B91C1C" stroke="#7F1D1D" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M60 98.5 L69 98.5 L65.5 103 L69 107.5 L60 105.5Z" fill="#B91C1C" stroke="#7F1D1D" stroke-width="1.5" stroke-linejoin="round"/>
    <rect x="38" y="97" width="24" height="8.6" rx="2.6" fill="#DC2626" stroke="#7F1D1D" stroke-width="1.6"/>
    <rect x="39.2" y="101.6" width="21.6" height="2.8" rx="1.2" fill="#B91C1C"/>
    <ellipse cx="43.5" cy="99.3" rx="3" ry="0.8" fill="#FCA5A5"/>
    <circle cx="50" cy="101.3" r="2.5" fill="#FBBF24" stroke="#92400E" stroke-width="1"/></g>`;
}

// Duha: nadýchaný obrysový mráček (obrys, stín dole, světlá horní část, odlesk) — houpe se jako gumový
function rbCloud(cx, cy, s, delay = 0) {
  return `<g class="rb-squash" style="animation-delay:${delay}s">
    <g fill="#7C3AED" stroke="#7C3AED" stroke-width="3.2" stroke-linejoin="round">${lgCloudShapes(cx, cy, s)}</g>
    <g fill="#C4B5FD">${lgCloudShapes(cx, cy, s)}</g>
    <g fill="#F5F3FF">${lgCloudShapes(cx, cy - 0.14 * s, s * 0.9)}</g>
    <ellipse cx="${cx - 0.4 * s}" cy="${cy - 0.5 * s}" rx="${0.34 * s}" ry="${0.13 * s}" fill="#FFFFFF" transform="rotate(-20 ${cx - 0.4 * s} ${cy - 0.5 * s})"/></g>`;
}
// Duha: tlustý oblouk ze čtyř pásů s jedním tmavším obrysem kolem všech
function rbArc() {
  const arc = (rx, ry) => `M${50 - rx} 0 A${rx} ${ry} 0 0 1 ${50 + rx} 0`;
  const cols = ['#F87171', '#FBBF24', '#4ADE80', '#60A5FA'];
  return `<path d="${arc(27.8, 6.2)}" stroke="#7C3AED" stroke-width="14.4" fill="none" stroke-linejoin="round"/>`
    + cols.map((c, i) => `<path d="${arc(32.2 - i * 2.8, 9 - i * 2.3)}" stroke="${c}" stroke-width="2.9" fill="none"/>`).join('');
}
// Duha: hvězda s obrysem (kulaté rohy) a srdíčko s obrysem; poskakují
function rbStar(cx, cy, r, fill, line, delay) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.5 : r;
    return `${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`;
  }).join(' ');
  return `<g class="rb-pop" style="animation-delay:${delay}s"><polygon points="${pts}" fill="${fill}" stroke="${line}" stroke-width="1.6" stroke-linejoin="round"/>
    <ellipse cx="${cx - r * 0.25}" cy="${cy - r * 0.3}" rx="${r * 0.22}" ry="${r * 0.13}" fill="#FEF9C3" transform="rotate(-30 ${cx} ${cy})"/></g>`;
}
function rbHeart(cx, cy, s, fill, line, delay) {
  return `<g class="rb-pop" style="animation-delay:${delay}s"><path fill="${fill}" stroke="${line}" stroke-width="1.6" stroke-linejoin="round"
    d="M${cx} ${cy + s * 0.95} C${cx - s * 1.7} ${cy - s * 0.2} ${cx - s * 0.7} ${cy - s * 1.15} ${cx} ${cy - s * 0.35} C${cx + s * 0.7} ${cy - s * 1.15} ${cx + s * 1.7} ${cy - s * 0.2} ${cx} ${cy + s * 0.95}Z"/>
    <ellipse cx="${cx - s * 0.6}" cy="${cy - s * 0.4}" rx="${s * 0.3}" ry="${s * 0.18}" fill="#FBCFE8" transform="rotate(-30 ${cx - s * 0.6} ${cy - s * 0.4})"/></g>`;
}

Object.assign(FRAME_DECOR, {
  // Duha — kreslená duha: tlustý oblouk přes horní okraj mezi dvěma gumovými mráčky, obrysové hvězdy a srdíčka
  'frame-rainbow': () => `
    ${rbArc()}
    ${rbCloud(15, -1, 6, 0)}
    ${rbCloud(77, -1, 6, -1.4)}
    ${rbStar(-4, 44, 5.2, '#FACC15', '#CA8A04', -0.3)}
    ${rbHeart(105, 34, 3.4, '#F472B6', '#BE185D', -1)}
    ${rbStar(106, 78, 4.8, '#FACC15', '#CA8A04', -1.7)}
    ${rbHeart(-5, 84, 3.2, '#A78BFA', '#5B21B6', -0.7)}`,

  // Galaxie — planeta s prstencem a obíhajícím měsícem, malé planetky, oběžný hvězdný prach
  'frame-galaxy': () => `
    ${lgPlanet(96, 6, 9, { base: '#8B5CF6', dark: '#4C1D95', line: '#2E1065', light: '#DDD6FE', band: '#F0ABFC', ring: '#F9A8D4', ring2: '#C084FC' }, -20, 0)}
    <g class="fd-revolve" style="transform-origin:96px 6px;animation-duration:14s"><circle cx="116" cy="6" r="1.7" fill="#22D3EE" stroke="#0E7490" stroke-width="0.5"/></g>
    ${lgPlanet(2, 94, 6.5, { base: '#22D3EE', dark: '#155E75', line: '#0E7490', light: '#A5F3FC', band: '#0E7490', ring: '', ring2: '' }, 0, -1.8, false)}
    ${lgPlanet(-3, 18, 3.6, { base: '#EC4899', dark: '#831843', line: '#500724', light: '#FBCFE8', band: '#9D174D', ring: '', ring2: '' }, 0, -3, false)}
    <g class="fd-dust" style="animation-duration:46s">
      <circle cx="110" cy="50" r="1.1" fill="#A5F3FC"/><circle cx="50" cy="-10" r="0.9" fill="#F9A8D4"/><circle cx="-10" cy="56" r="1" fill="#C4B5FD"/><circle cx="64" cy="110" r="0.8" fill="#67E8F9"/>
    </g>
    <g class="fd-dust rev" style="animation-duration:70s">
      <circle cx="104" cy="82" r="0.8" fill="#F0ABFC"/><circle cx="22" cy="-6" r="1" fill="#A5F3FC"/><circle cx="-6" cy="30" r="0.8" fill="#F9A8D4"/>
    </g>
    ${sparkle(60, -5, 3.4, '#A5F3FC', 0)}
    ${sparkle(106, 58, 3, '#F9A8D4', -1)}
    ${sparkle(40, 105, 2.8, '#C4B5FD', -1.6)}`,

  // Diamant — tři broušené kameny v rozích a barevné jiskřičky
  'frame-diamond': () => `
    ${lgGem(97, 4, 9, LG_GEM_CYAN, 0)}
    ${lgGem(3, 93, 6.2, LG_GEM_VIOLET, -1.6)}
    ${lgGem(101, 92, 3.6, LG_GEM_PINK, -3)}
    ${sparkle(0, 4, 8, '#A5F3FC', 0)}
    ${sparkle(46, -7, 5, '#E9D5FF', -0.8)}
    ${sparkle(52, 107, 5.5, '#A5F3FC', -1.5)}
    ${sparkle(106, 50, 4.6, '#F5D0FE', -0.3)}
    ${sparkle(-6, 56, 4, '#BAE6FD', -1.1)}`,

  // Král — kreslený král: zlatý kroužek s nýty, tlustá korunka nahoře, velké drahokamy v rozích a stuha dole
  'frame-king': () => `
    <rect x="3" y="3" width="94" height="94" rx="20" fill="none" stroke="#92400E" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0 7.4"/>
    <rect x="3" y="2.6" width="94" height="94" rx="20" fill="none" stroke="#FEF08A" stroke-width="1.1" stroke-linecap="round" stroke-dasharray="0 7.4"/>
    ${kgGem(7, 7, '#DC2626', '#F87171', '#7F1D1D', '#FECACA', 0)}
    ${kgGem(93, 7, '#2563EB', '#60A5FA', '#1E3A8A', '#BFDBFE', -0.9)}
    ${kgGem(93, 93, '#16A34A', '#4ADE80', '#14532D', '#BBF7D0', -1.8)}
    ${kgGem(7, 93, '#7C3AED', '#A78BFA', '#4C1D95', '#DDD6FE', -2.7)}
    ${kgCrown()}
    ${kgRibbon()}`,

  // Fénix — kreslený ohnivý pták: plamínky po horním okraji, pták nahoře, poskakující křídla, ocasní pírka a jiskry
  'frame-phoenix': () => `
    ${phTail(32, 8.2, -0.8)}${phTail(-32, 8.2, -1.6)}${phTail(0, 9, 0)}
    <g class="ph-wing ph-wl">${phWing()}</g>
    <g class="ph-wing ph-wr"><g transform="translate(100 0) scale(-1 1)">${phWing()}</g></g>
    ${phFlame(13, 9, 4.3, 0)}${phFlame(28, 7.5, 3.8, -0.7)}${phFlame(72, 7.5, 3.8, -1.3)}${phFlame(87, 9, 4.3, -0.4)}
    ${phBird()}
    ${phSpark(-6, 18, 3.6, 0)}${phSpark(106, 14, 3.2, -0.9)}${phSpark(108, 70, 3.4, -1.5)}${phSpark(14, 107, 3, -0.4)}`,

  // Sladkosti — donut, lízátko se spirálou, zabalený bonbon a padající posypka
  'frame-sweets': () => `
    ${lgDonut(96, 4, 10.5, 0)}
    ${lgLolly(5, 93, 9.5, -1.4)}
    ${lgBonbon(-1, 38, -2.6)}
    ${lgSprinkle(24, 106, 25, '#7DD3FC', 0)}
    ${lgSprinkle(62, -7, -30, '#FDE047', -1.3)}
    ${lgSprinkle(106, 34, 60, '#FF5FA2', -2.2)}
    ${lgSprinkle(76, 107, -15, '#86EFAC', -3)}`,

  // Strašidelný dům — dýně, duch, netopýři a plující mlha
  'frame-haunted': () => `
    ${lgFog(22, 106, 9, '#C4B5FD', 0)}
    ${lgFog(76, 108, 8, '#86EFAC', -4)}
    ${lgFog(-6, 60, 6, '#C4B5FD', -7)}
    ${lgPumpkin(96, 95, 11, 0)}
    ${lgGhost(2, 6, 8.5, -1.2)}
    ${lgBat(84, -5, 12, '#2E1065', '#A78BFA', '#86EFAC', 0)}
    ${lgBat(104, 24, 7, '#3B0764', '#C084FC', '#86EFAC', -0.3)}
    ${lgBat(-5, 62, 7, '#2E1065', '#A78BFA', '#86EFAC', -0.6)}
    ${sparkle(50, 106, 4, '#FDBA74', -0.9)}`,

  // Upír — úplněk, netopýři s tesáky a kapky krve
  'frame-vampire': () => `
    ${lgMoon(98, 4, 11, 0)}
    ${lgBat(84, 12, 11, '#7F1D1D', '#F87171', '#FDE68A', 0, true)}
    ${lgBat(24, -5, 9, '#991B1B', '#FCA5A5', '#FDE68A', -0.4, true)}
    ${lgBat(-4, 46, 7, '#7F1D1D', '#F87171', '#FDE68A', -0.8, true)}
    ${lgDrip(28, 3.2, 12, '#DC2626', 0)}
    ${lgDrip(66, 2.8, 9, '#B91C1C', -0.9)}
    ${sparkle(106, 60, 4, '#FCA5A5', -1.3)}`,
});

// ------------------------------------------ Legendary: průlety předmětů ---
// Každý předmět je malé barevné SVG (bez bílých záblesků), míří doprava; doleva se jen zrcadlí.
const FLYBY_ART = {
  // kometa s fialovo-růžovým ohonem
  'frame-galaxy': { w: 48, h: 24, dir: true, svg: `<svg viewBox="0 0 48 24"><defs><linearGradient id="fbg1"><stop offset="0" stop-color="#EC4899" stop-opacity="0"/><stop offset="0.6" stop-color="#A78BFA"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs><path d="M0 12 L34 7 L34 17 Z" fill="url(#fbg1)"/><circle cx="37" cy="12" r="6.5" fill="#22D3EE"/><circle cx="35" cy="10" r="2" fill="#A5F3FC"/></svg>` },
  // zlatá hvězda s duhovou stopou
  'frame-rainbow': { w: 48, h: 24, dir: true, svg: `<svg viewBox="0 0 48 24"><rect x="0" y="6" width="34" height="2.6" rx="1.3" fill="#F87171"/><rect x="4" y="9" width="30" height="2.6" rx="1.3" fill="#FBBF24"/><rect x="2" y="12" width="32" height="2.6" rx="1.3" fill="#34D399"/><rect x="6" y="15" width="28" height="2.6" rx="1.3" fill="#60A5FA"/><path d="M38 3l2.6 6 6.4.5-4.9 4.2 1.6 6.3L38 16.6 32.3 20l1.6-6.3L29 9.5l6.4-.5z" fill="#FBBF24"/></svg>` },
  // otáčející se drahokam
  'frame-diamond': { w: 24, h: 24, spin: true, svg: `<svg viewBox="0 0 24 24"><path d="M12 2 L21 9 L12 22 L3 9 Z" fill="#22D3EE"/><path d="M3 9 H21 L12 22 Z" fill="#A855F7" opacity="0.75"/><path d="M12 2 L8 9 H16 Z" fill="#67E8F9"/></svg>` },
  // otáčející se zlatá mince
  'frame-king': { w: 24, h: 24, coin: true, svg: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#F59E0B"/><circle cx="12" cy="12" r="7.3" fill="none" stroke="#FDE68A" stroke-width="1.6"/><path d="M7.5 15.5 L8.5 9 L12 12.5 L15.5 9 L16.5 15.5 Z" fill="#B45309"/></svg>` },
  // ohnivý pták fénix — mávající plamenná křídla a dlouhý ohnivý ocas
  'frame-phoenix': { w: 56, h: 32, dir: true, flap: true, svg: `<svg viewBox="0 0 56 32"><defs><linearGradient id="fbp1" x1="0" x2="1"><stop offset="0" stop-color="#DC2626" stop-opacity="0"/><stop offset="0.5" stop-color="#EF4444"/><stop offset="1" stop-color="#F97316"/></linearGradient><linearGradient id="fbp2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FDE047"/><stop offset="0.6" stop-color="#F97316"/><stop offset="1" stop-color="#DC2626"/></linearGradient></defs><path d="M0 14 Q10 8 18 13 Q10 12 4 18 Q12 14 20 17 Q12 18 6 24 Q16 17 26 18 L30 15 Z" fill="url(#fbp1)"/><path class="fb-wing" d="M31 15 Q24 4 16 1 Q25 3 29 7 Q27 1 22 -2 Q32 2 36 12 Z" fill="url(#fbp2)"/><ellipse cx="35" cy="17" rx="8" ry="4.5" fill="#F97316"/><path class="fb-wing fb-wing2" d="M33 18 Q26 26 20 30 Q28 28 33 24 Q31 29 28 33 Q37 27 38 19 Z" fill="url(#fbp2)" opacity="0.9"/><circle cx="43" cy="14" r="4" fill="#FB923C"/><path d="M46.5 13.2 L51 14.4 L46.5 15.6 Z" fill="#FDE047"/><circle cx="44.2" cy="13.2" r="1" fill="#7F1D1D"/><path d="M41 10.5 Q42 6 45 5 Q43 8 43.6 10.2 Z" fill="#FDE047"/></svg>` },
  // Fortune: zlatá mince se šťastnou sedmičkou a duhovým ohonem
  'frame-fortune': { w: 52, h: 24, dir: true, svg: `<svg viewBox="0 0 52 24"><rect x="0" y="6" width="34" height="2.6" rx="1.3" fill="#FF3D7F"/><rect x="4" y="9" width="30" height="2.6" rx="1.3" fill="#FDE047"/><rect x="2" y="12" width="32" height="2.6" rx="1.3" fill="#22C55E"/><rect x="6" y="15" width="28" height="2.6" rx="1.3" fill="#A855F7"/><circle cx="40" cy="12" r="10.5" fill="#F59E0B"/><circle cx="40" cy="12" r="7.8" fill="#FDE047"/><path d="M36 8 H44.5 L39.5 17" fill="none" stroke="#B45309" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
  // lízátko
  'frame-sweets': { w: 24, h: 24, spin: true, svg: `<svg viewBox="0 0 24 24"><rect x="11" y="13" width="2.4" height="10" rx="1.2" fill="#7DD3FC"/><circle cx="12" cy="9" r="8" fill="#FF5FA2"/><path d="M12 9 m0 0 a2.5 2.5 0 1 1 2.5 2.5 a5 5 0 1 1 -5 -5" fill="none" stroke="#7DD3FC" stroke-width="2" stroke-linecap="round"/></svg>` },
  // fialový duch
  'frame-haunted': { w: 24, h: 24, svg: `<svg viewBox="0 0 24 24"><path d="M4 22 V11 a8 8 0 0 1 16 0 V22 l-3-2.5 -2.5 2.5 -2.5-2.5 -2.5 2.5 -2.5-2.5Z" fill="#A78BFA"/><circle cx="9" cy="11" r="1.8" fill="#1E1B4B"/><circle cx="15" cy="11" r="1.8" fill="#1E1B4B"/></svg>` },
  // netopýr s mávajícími křídly
  'frame-vampire': { w: 32, h: 20, flap: true, svg: `<svg viewBox="0 0 32 20"><path class="fb-wing" d="M16 6 Q10 0 0 3 Q4 7 3 12 Q8 9 11 14 Q13 10 16 13 Q19 10 21 14 Q24 9 29 12 Q28 7 32 3 Q22 0 16 6Z" fill="#DC2626"/><ellipse cx="16" cy="10" rx="3" ry="4.5" fill="#7F1D1D"/></svg>` },
};

const FLYBY_MAX = 4;        // nejvýš tolik průletů naráz
let flybyActive = 0;
const flybyNext = new WeakMap(); // element -> čas dalšího průletu (WeakMap = žádný únik při překreslení DOM)

function flybyReduced() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function flybySpawn(host) {
  const art = FLYBY_ART[host.dataset.flyby];
  if (!art) return;
  const obj = document.createElement('div');
  obj.className = 'fb-obj' + (art.spin ? ' fb-spin' : '') + (art.coin ? ' fb-coin' : '') + (art.flap ? ' fb-flap' : '');
  const wPct = art.w > art.h ? 34 : 24; // šířka v % kontejneru (kontejner je ~1.3× rámeček)
  // náhodný směr pod libovolným úhlem (zleva, shora, šikmo…), dráha nemusí jít přes střed
  const W = host.clientWidth || 100, H = host.clientHeight || 100;
  const ow = W * wPct / 100;
  const a = Math.random() * Math.PI * 2;
  const dx = Math.cos(a), dy = Math.sin(a);
  const R = Math.hypot(W, H) / 2 + ow;           // start i cíl kousek za okrajem
  const off = (Math.random() - 0.5) * 0.5 * Math.min(W, H); // posun dráhy do strany
  const px = -dy * off, py = dx * off;
  // směrové předměty (kometa, fénix…) se natočí po dráze, doleva letící se převrátí, ať nejsou vzhůru nohama
  const rot = art.dir ? `rotate(${a}rad)${dx < 0 ? ' scaleY(-1)' : ''}` : (dx < 0 ? 'scaleX(-1)' : '');
  obj.style.cssText = `width:${wPct}%; aspect-ratio:${art.w}/${art.h}; animation-duration:${(1 + Math.random() * 0.6).toFixed(2)}s;`
    + `--x0:${(px - dx * R).toFixed(1)}px; --y0:${(py - dy * R).toFixed(1)}px; --x1:${(px + dx * R).toFixed(1)}px; --y1:${(py + dy * R).toFixed(1)}px; --rot:${rot || 'none'};`;
  obj.innerHTML = art.svg;
  flybyActive++;
  let done = false;
  const end = () => { if (done) return; done = true; flybyActive--; obj.remove(); };
  obj.addEventListener('animationend', (e) => { if (e.target === obj) end(); });
  setTimeout(end, 2200); // pojistka, kdyby animationend nepřišel
  host.appendChild(obj);
}

function flybyTick() {
  if (document.hidden || flybyReduced()) return;
  const now = Date.now();
  const vh = window.innerHeight;
  document.querySelectorAll('.frame-flyby').forEach((host) => {
    if (flybyActive >= FLYBY_MAX) return;
    let t = flybyNext.get(host);
    if (t === undefined) { t = now + 500 + Math.random() * 5000; flybyNext.set(host, t); }
    if (now < t) return;
    flybyNext.set(host, now + 3000 + Math.random() * 4000); // další za ~3–7 s
    const r = host.getBoundingClientRect();
    if (r.width < 8 || r.bottom < 0 || r.top > vh) return; // neviditelné (skryté / mimo obrazovku)
    flybySpawn(host);
  });
}
setInterval(flybyTick, 700);

// ---------------------------------------------- Fortune: jackpot výbuchy ---
// Každých ~4–8 s vystřelí z rámečku fontána mincí, hvězd a konfet (barevné, padají s gravitací).
const BURST_MAX = 2;        // nejvýš tolik výbuchů naráz (šetří telefon)
const BURST_PARTS = 12;     // částic na výbuch
const BURST_COLORS = ['#FF3D7F', '#22D3EE', '#A855F7', '#22C55E', '#FDE047', '#F97316'];
let burstActive = 0;
const burstNext = new WeakMap();

function burstSpawn(host) {
  burstActive++;
  const frag = document.createDocumentFragment();
  const parts = [];
  for (let i = 0; i < BURST_PARTS; i++) {
    const kind = i % 3 === 0 ? 'coin' : i % 3 === 1 ? 'star' : 'conf';
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5; // převážně nahoru a do stran
    const wrap = document.createElement('i');
    wrap.className = 'fb-p';
    const up = 90 + Math.random() * 130;                 // výška výstřelu v násobcích velikosti částice (%)
    const dur = 1.1 + Math.random() * 0.5;
    wrap.style.cssText = `--ox:${(50 + Math.cos(a) * 30).toFixed(1)}%; --oy:${(50 + Math.sin(a) * 30 + 6).toFixed(1)}%;`
      + `--dx:${(Math.cos(a) * (140 + Math.random() * 120)).toFixed(0)}%; --up:${up.toFixed(0)}%; --fall:${(up + 150 + Math.random() * 120).toFixed(0)}%;`
      + `--dur:${dur.toFixed(2)}s; --rot:${((Math.random() - 0.5) * 720).toFixed(0)}deg;`;
    const c = BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)];
    const inner = document.createElement('b');
    inner.className = 'fb-' + kind;
    if (kind !== 'coin') inner.style.background = c;
    wrap.appendChild(inner);
    frag.appendChild(wrap);
    parts.push(wrap);
  }
  host.appendChild(frag);
  setTimeout(() => { parts.forEach((p) => p.remove()); burstActive--; }, 1900);
}

function burstTick() {
  if (document.hidden || flybyReduced()) return;
  const now = Date.now();
  const vh = window.innerHeight;
  document.querySelectorAll('.fortune-burst').forEach((host) => {
    if (burstActive >= BURST_MAX) return;
    let t = burstNext.get(host);
    if (t === undefined) { t = now + 800 + Math.random() * 5000; burstNext.set(host, t); }
    if (now < t) return;
    burstNext.set(host, now + 4000 + Math.random() * 4000);
    const r = host.getBoundingClientRect();
    if (r.width < 24 || r.bottom < 0 || r.top > vh) return; // maličké nebo mimo obrazovku
    burstSpawn(host);
  });
}
setInterval(burstTick, 900);
