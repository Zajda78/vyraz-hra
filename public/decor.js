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

  // Duha (legendární) — obláčky a jiskřičky
  'frame-rainbow': () => `
    <g class="fd-float" fill="#FFFFFF">
      <circle cx="-2" cy="96" r="7"/><circle cx="7" cy="92" r="9"/><circle cx="17" cy="97" r="6.5"/>
      <rect x="-2" y="96" width="19" height="7" rx="3.5"/>
    </g>
    <g class="fd-float" style="animation-delay:-2s" fill="#FFFFFF">
      <circle cx="86" cy="4" r="5.5"/><circle cx="94" cy="0" r="7"/><circle cx="102" cy="5" r="5"/>
      <rect x="86" y="4" width="16" height="5.5" rx="2.7"/>
    </g>
    ${sparkle(2, 18, 5, '#FDE68A', -0.6)}
    ${sparkle(98, 70, 6, '#F9A8D4', -1.2)}`,

  // Galaxie (legendární) — planetky a hvězdy kolem
  'frame-galaxy': () => `
    <g class="fd-float">
      <circle cx="96" cy="6" r="10" fill="#8B5CF6"/>
      <circle cx="93" cy="3" r="3" fill="#C4B5FD" opacity="0.7"/>
      <ellipse cx="96" cy="6" rx="17" ry="4.5" fill="none" stroke="#F9A8D4" stroke-width="2.2" transform="rotate(-20 96 6)"/>
    </g>
    <g class="fd-float" style="animation-delay:-1.8s">
      <circle cx="2" cy="94" r="7.5" fill="#22D3EE"/>
      <circle cx="0" cy="92" r="2.4" fill="#A5F3FC" opacity="0.8"/>
    </g>
    <g class="fd-float" style="animation-delay:-3s">
      <circle cx="-3" cy="18" r="3.6" fill="#EC4899"/>
    </g>
    <circle class="fd-twinkle" cx="60" cy="-5" r="1.8" fill="#FFFFFF"/>
    <circle class="fd-twinkle" style="animation-delay:-1s" cx="104" cy="60" r="1.6" fill="#FFFFFF"/>
    <circle class="fd-twinkle" style="animation-delay:-1.6s" cx="40" cy="105" r="1.4" fill="#FFFFFF"/>
    ${sparkle(76, 104, 4, '#FFFFFF', -0.5)}`,

  // Diamant (legendární) — víc a větší třpytky
  'frame-diamond': () => `
    ${sparkle(0, 2, 13, '#FFFFFF', 0)}
    ${sparkle(98, 12, 9, '#E0F2FE', -0.5)}
    ${sparkle(100, 94, 14, '#FFFFFF', -1)}
    ${sparkle(4, 88, 8, '#F5D0FE', -1.5)}
    ${sparkle(52, -6, 6, '#A5F3FC', -0.8)}
    ${sparkle(48, 106, 5, '#FFFFFF', -1.8)}
    ${sparkle(106, 52, 5, '#E9D5FF', -0.3)}
    ${sparkle(-6, 46, 4, '#FFFFFF', -1.2)}`,
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

  // Král (legendární) — koruna nahoře a drahokamy v rozích
  'frame-king': () => `
    <g class="fd-float">
      <path d="M30 -4 L36 -18 L45 -8 L50 -22 L55 -8 L64 -18 L70 -4 Z" fill="#FBBF24" stroke="#92400E" stroke-width="1.4" stroke-linejoin="round"/>
      <rect x="30" y="-5" width="40" height="5" rx="1.5" fill="#F59E0B" stroke="#92400E" stroke-width="1.2"/>
      <circle cx="50" cy="-12" r="2.4" fill="#EF4444"/>
      <circle cx="39" cy="-9" r="1.8" fill="#3B82F6"/>
      <circle cx="61" cy="-9" r="1.8" fill="#22C55E"/>
    </g>
    <path class="fd-twinkle" d="M-2 92 l5 -6 l5 6 l-5 6 z" fill="#A78BFA" stroke="#fff" stroke-width="0.8"/>
    <path class="fd-twinkle" style="animation-delay:-1s" d="M96 92 l5 -6 l5 6 l-5 6 z" fill="#F472B6" stroke="#fff" stroke-width="0.8"/>
    ${sparkle(104, 40, 5, '#FDE68A', -0.5)}
    ${sparkle(-4, 40, 5, '#FDE68A', -1.4)}`,

  // Fénix (legendární) — plameny zdola a jiskry letící nahoru
  'frame-phoenix': () => `
    <g class="fd-flicker">
      <path fill="#F97316" d="M-2 100 C-8 88 0 80 -2 70 C8 80 10 92 6 100 Z"/>
      <path fill="#FDE047" d="M0 100 C-2 93 2 88 1 84 C6 90 6 96 4 100 Z"/>
    </g>
    <g class="fd-flicker" style="animation-delay:-0.4s">
      <path fill="#EF4444" d="M94 100 C88 86 98 78 96 66 C108 78 110 92 104 100 Z"/>
      <path fill="#FDE047" d="M97 100 C95 92 99 86 98 81 C104 88 104 95 102 100 Z"/>
    </g>
    <circle class="fd-spark" cx="20" cy="-2" r="2.2" fill="#FDE047"/>
    <circle class="fd-spark" style="animation-delay:-0.7s" cx="60" cy="-6" r="1.8" fill="#FB923C"/>
    <circle class="fd-spark" style="animation-delay:-1.4s" cx="84" cy="-2" r="2" fill="#FEF3C7"/>
    ${sparkle(50, 106, 5, '#FDE047', -0.9)}`,

  // Sladkosti (legendární) — lízátko, bonbon a posypka
  // Sladkosti (legendární) — donut s polevou a posypem, lízátko a zabalený bonbon
  'frame-sweets': () => `
    <g class="fd-float">
      <circle cx="96" cy="4" r="9" fill="none" stroke="#E9A15B" stroke-width="9"/>
      <circle cx="96" cy="4" r="9" fill="none" stroke="#FF5FA2" stroke-width="6.5"/>
      <path d="M89 -1 a9 9 0 0 1 9 -5" stroke="#FFC2DA" stroke-width="2" fill="none" stroke-linecap="round"/>
      <g stroke-width="1.5" stroke-linecap="round">
        <path d="M91 7l2 -1" stroke="#FDE047"/><path d="M99 11l1 -2" stroke="#7DD3FC"/><path d="M103 3l1 2" stroke="#86EFAC"/>
        <path d="M100 -3l2 1" stroke="#FFFFFF"/><path d="M92 -3l1 2" stroke="#7DD3FC"/><path d="M104 -1l-1 -2" stroke="#FDE047"/>
      </g>
    </g>
    <g class="fd-float" style="animation-delay:-1.4s">
      <path d="M2 100 L-6 112" stroke="#FFF7ED" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="4" cy="94" r="10" fill="#FF5FA2"/>
      <circle cx="4" cy="94" r="7.2" fill="#FFF0F6"/>
      <circle cx="4" cy="94" r="4.6" fill="#7DD3FC"/>
      <circle cx="4" cy="94" r="2.1" fill="#FFF0F6"/>
      <path d="M-2 89 a8 8 0 0 1 7 -3" stroke="#FFFFFF" stroke-opacity="0.7" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    </g>
    <g class="fd-float" style="animation-delay:-2.6s">
      <path d="M-11 34 l5 4 -5 4z" fill="#FDE047"/>
      <path d="M9 34 l-5 4 5 4z" fill="#FDE047"/>
      <ellipse cx="-1" cy="38" rx="6.5" ry="5" fill="#A78BFA"/>
      <path d="M-4 34 q2 4 0 8 M1 34 q2 4 0 8" stroke="#EDE9FE" stroke-width="1.3" fill="none"/>
    </g>`,
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

const FRAME_AURA = { 'frame-fortune': 'fortune', 'frame-lava': 'lava' };

function frameDecorHtml(frame) {
  if (!frame) return '';
  const id = typeof frame === 'string' ? frame : frame.id;
  const make = FRAME_DECOR[id];
  // lesk / efekt okraje podle vzácnosti (Fortune má vlastní duhovou animaci)
  const item = typeof frame === 'string' ? ALL_ITEMS.find((i) => i.id === frame) : frame;
  const auraKind = FRAME_AURA[id] || (item && item.rarity);
  const aura = auraKind ? `<div class="frame-aura aura-${auraKind}" aria-hidden="true"></div>` : '';
  const rarity = item && item.rarity;
  // záře za rámečkem: mythic vždy, jinak jen rámečky s vlastní září (legendary zlatá záře zrušena)
  const hasHalo = rarity === 'mythic' || FRAME_HALO_IDS.has(id);
  const halo = hasHalo ? `<div class="frame-halo halo-${rarity} halo-${id}" aria-hidden="true"></div>` : '';
  if (!make) return halo + aura;
  return `${halo}${aura}<div class="frame-decor" aria-hidden="true"><svg viewBox="-12 -12 124 124">${make()}</svg></div>`;
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

  // Strašidelný dům (legendární) — dýně, duch a hejno netopýrů
  'frame-haunted': () => `
    ${pumpkin(96, 96, 12, 0)}
    ${ghost(2, 6, 9, -1.2)}
    ${bat(84, -4, 13, '#7C3AED', 0)}
    ${bat(104, 22, 8, '#A855F7', -0.3)}
    ${bat(-4, 64, 8, '#7C3AED', -0.6)}
    ${sparkle(50, 106, 5, '#FDBA74', -0.9)}`,

  // Upír (legendární) — netopýři nahoře, krvavé kapky dole a úplněk
  'frame-vampire': () => `
    <g class="fd-float">
      <circle cx="98" cy="4" r="11" fill="#FEF3C7"/>
      <circle cx="94" cy="1" r="2.2" fill="#FDE68A"/><circle cx="101" cy="8" r="1.6" fill="#FDE68A"/>
    </g>
    ${bat(84, 10, 12, '#991B1B', 0)}
    ${bat(24, -4, 10, '#B91C1C', -0.4)}
    ${bat(-4, 44, 8, '#7F1D1D', -0.8)}
    <g class="fd-drip">
      <path fill="#DC2626" d="M24 96 C24 104 27 109 30 109 C33 109 35 104 34 96 Z"/>
    </g>
    <g class="fd-drip" style="animation-delay:-0.9s">
      <path fill="#B91C1C" d="M62 96 C61 102 63 106 66 106 C69 106 70 102 69 96 Z"/>
    </g>
    ${sparkle(106, 60, 5, '#FCA5A5', -1.3)}`,
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
      ${sparkle(50, -8, 6, '#FFFFFF', 0)}
      ${sparkle(108, 50, 5, '#FDE047', -0.6)}
      ${sparkle(50, 108, 6, '#F9A8D4', -1.2)}
      ${sparkle(-8, 50, 5, '#86EFAC', -1.8)}
    </g>
    <g class="fd-orbit rev">
      <circle cx="94" cy="8" r="1.8" fill="#FFFFFF"/><circle cx="6" cy="92" r="1.8" fill="#FDE047"/>
      <circle cx="96" cy="94" r="1.4" fill="#C4B5FD"/><circle cx="4" cy="6" r="1.4" fill="#86EFAC"/>
    </g>
    ${clover(96, 6, 12, 0)}
    <g class="fd-rise" style="animation-delay:-0.6s">${coinArt(2, 94, 8.5)}</g>
    ${sparkle(-4, 24, 7, '#FDE047', -0.3)}`,
});
