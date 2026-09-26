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
  'frame-lava': () => `
    <g class="fd-drip">
      <path fill="#EF4444" d="M18 96 C18 104 22 110 26 110 C30 110 32 104 30 96 Z"/>
      <circle cx="25" cy="104" r="2.2" fill="#FDE047" opacity="0.8"/>
    </g>
    <g class="fd-drip" style="animation-delay:-1.2s">
      <path fill="#F97316" d="M58 96 C58 101 60 105 63 105 C66 105 67 101 66 96 Z"/>
    </g>
    <g class="fd-drip" style="animation-delay:-0.6s">
      <path fill="#DC2626" d="M82 96 C81 106 85 113 89 113 C93 113 95 106 93 96 Z"/>
      <circle cx="88" cy="106" r="2.4" fill="#FACC15" opacity="0.85"/>
    </g>
    <circle class="fd-bubble" cx="-2" cy="10" r="6" fill="#F97316"/>
    <circle class="fd-bubble" style="animation-delay:-1s" cx="6" cy="-4" r="3.5" fill="#FACC15"/>`,

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

// Ozdoba pro rámeček (item nebo id). Běžné a vzácné rámečky nemají nic.
function frameDecorHtml(frame) {
  if (!frame) return '';
  const make = FRAME_DECOR[typeof frame === 'string' ? frame : frame.id];
  if (!make) return '';
  return `<div class="frame-decor" aria-hidden="true"><svg viewBox="-12 -12 124 124">${make()}</svg></div>`;
}
