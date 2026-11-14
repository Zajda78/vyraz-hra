// SNAPFAM v2 — sdílené helpery pro herní obrazovky (lobby, foťák, hlasování, výsledky).
// Načítá se před app.js; funkce jsou globální. Styly jsou v sf-game.css.

// ---------- hlavička kola: štítek + volitelně tlačítko "odejít" + název/zadání + kruhový odpočet ----------
const SF_RING_LEN = 201.06; // 2π·32
const sfRingTotals = {};    // deadlineAt -> celková délka odpočtu (s), ať kruh po překreslení nezačne znovu plný

function sfRingHtml(small) {
  return `<div class="sf-ring${small ? ' sm' : ''}" id="timer-el" role="timer" aria-label="Time left">
    <svg viewBox="0 0 76 76" aria-hidden="true"><circle class="sf-ring-bg" cx="38" cy="38" r="32"/><circle class="sf-ring-fg" cx="38" cy="38" r="32" stroke-dasharray="${SF_RING_LEN}" stroke-dashoffset="0" transform="rotate(-90 38 38)"/></svg>
    <span class="sf-ring-num">--</span>
  </div>`;
}

// o.pill: text štítku; o.title: html názvu/zadání; o.ring: 'big' | 'small' | false; o.exit: false vypne tlačítko odejít
function sfHeadHtml(state, o = {}) {
  const exit = o.exit === false || !(state && state.phase && state.phase !== 'lobby') ? ''
    : `<button class="sf-exit" data-exit-game aria-label="Leave game">${icon('logout')}</button>`;
  const pack = (typeof promptPackBadge === 'function' && o.pack !== false) ? promptPackBadge(state) : '';
  return `<div class="sf-head">
    <div class="sf-head-top"><span class="sf-pill">${o.pill}</span>${pack}${exit}</div>
    <div class="sf-head-main">
      <div class="sf-head-title ${o.small ? 'is-small' : ''}">${o.title || ''}</div>
      ${o.ring === false ? '' : sfRingHtml(o.ring === 'small')}
    </div>
  </div>`;
}

function sfRoundPill(state, suffix = '') {
  return `Round ${state.round} / ${state.totalRounds}${suffix ? ` — ${suffix}` : ''}`;
}

// volá ticker v app.js každých 250 ms
function sfTickRing(el, deadlineAt, remaining) {
  const ms = Math.max(0, deadlineAt - Date.now());
  if (!sfRingTotals[deadlineAt]) sfRingTotals[deadlineAt] = Math.max(1, ms / 1000);
  const frac = Math.min(1, ms / (sfRingTotals[deadlineAt] * 1000));
  const fg = el.querySelector('.sf-ring-fg');
  if (fg) fg.style.strokeDashoffset = String(SF_RING_LEN * (1 - frac));
  const num = el.querySelector('.sf-ring-num');
  if (num && num.textContent !== String(remaining)) num.textContent = String(remaining);
  el.classList.toggle('low', remaining <= 5);
  el.setAttribute('aria-label', `${remaining} seconds left`);
}

// ---------- počítadlo "3/4" + tečky hráčů (čekání, hlasování, focení) ----------
function sfSetCount(done, total) {
  document.querySelectorAll('.sf-count-num').forEach((e) => { e.textContent = `${done}/${total}`; });
  document.querySelectorAll('.sf-pips').forEach((p) => {
    if (p.children.length !== total) p.innerHTML = '<i></i>'.repeat(Math.min(total, 24));
    [...p.children].forEach((c, i) => c.classList.toggle('on', i < done));
  });
}

// karta "Waiting for others 3/4" dole na čekacích obrazovkách
function sfWaitCardHtml(label = 'Waiting for others') {
  return `<div class="sf-wait-card">
    <div class="sf-wait-row">
      <span class="sf-wait-label"><span>${label}</span><span class="sf-dots" aria-hidden="true"><i></i><i></i><i></i></span></span>
      <b class="sf-count-num num">–</b>
    </div>
    <div class="sf-pips" aria-hidden="true"></div>
  </div>`;
}

// ---------- obličej "Too slow!!" ----------
function sfSadFaceHtml(size = 120) {
  return `<svg class="sf-sad" width="${size}" height="${size}" viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="50" r="40" fill="#FFD23F" stroke="#8C6600" stroke-width="4"/><path d="M30 44q6 5 12 0M54 44q6 5 12 0" stroke="#3A2500" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M34 70q14-12 28 0" stroke="#3A2500" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M30 52q-3 9 1 12" stroke="#6FB7FF" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;
}
function sfMissedHtml() {
  return `<div class="missed sf-missed">${sfSadFaceHtml(72)}<span>Too slow!!</span></div>`;
}

// ---------- konfety (barvy značky + módu), 1,2 s ----------
function sfConfetti(host) {
  if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const mc = getComputedStyle(document.body).getPropertyValue('--mc').trim() || '#8B5CF6';
  const cols = ['#FFD23F', '#8B5CF6', mc, '#3FC46A', '#D946C8', '#FF8A3D'];
  const layer = document.createElement('div');
  layer.className = 'sf-confetti';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 34; i++) {
    const s = document.createElement('span');
    const w = 8 + Math.random() * 8;
    s.style.cssText = `left:${Math.random() * 100}%;width:${w}px;height:${Math.random() > 0.5 ? w : w * 1.6}px;background:${cols[i % cols.length]};`
      + `border-radius:${Math.random() > 0.5 ? '50%' : '3px'};animation-delay:${(Math.random() * 0.35).toFixed(2)}s;--dx:${Math.round((Math.random() - 0.5) * 120)}px;--rot:${Math.round(Math.random() * 540)}deg`;
    layer.appendChild(s);
  }
  host.appendChild(layer);
  setTimeout(() => layer.remove(), 1900);
}

// ---------- mince se nasčítají 600 ms ----------
function sfCountUp(el, to, ms = 600) {
  if (!el) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !to) { el.textContent = `+${to}`; return; }
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = `+${Math.round(to * (1 - Math.pow(1 - k, 3)))}`;
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- kopírování kódu lobby ----------
async function sfCopyCode(code) {
  let ok = false;
  try { await navigator.clipboard.writeText(code); ok = true; } catch { /* starší prohlížeč */ }
  showToast(ok ? 'Copied!' : `Code: ${code}`, ok ? 'good' : undefined);
}

// ---------- kamera (společná pro všechny módy, kde se fotí) ----------
function sfStageInner(state) {
  const snapped = state && state.activeCount != null
    ? `<span class="sf-chip-over sf-snapped" id="snap-count">${state.submittedCount || 0} of ${state.activeCount} snapped</span>` : '';
  return `<video id="cam-video" autoplay playsinline muted></video><div class="flash" id="flash-el"></div>
    <span class="sf-chip-over sf-live"><i></i><span>LIVE</span></span>${snapped}`;
}
function sfCameraHtml(state, flip) {
  return `<div class="camera-wrap sf-stage">${sfStageInner(state)}</div>
    <div class="sf-shutter-row">
      ${flip ? `<button id="flip-btn" class="flip-cam-btn" aria-label="Flip camera">${icon('flip')}</button>` : '<span class="sf-sp"></span>'}
      <button id="shutter-btn" class="shutter" title="Take photo" aria-label="Take photo"><span></span></button>
      <span class="sf-sp"></span>
    </div>`;
}
function sfPatchSnapped(state) {
  const el = document.getElementById('snap-count');
  if (el && state.activeCount != null) el.textContent = `${state.submittedCount || 0} of ${state.activeCount} snapped`;
}

// ---------- obrazovka "čeká se" (jedna hlavička + ilustrace + volitelně karta s počtem) ----------
function sfStatusHtml(state, o) {
  return `<div class="screen sf-g sf-status ${o.cls || ''}">
    ${sfHeadHtml(state, { pill: o.pill, title: o.title || '', ring: o.ring || false, small: true, pack: o.pack })}
    <div class="sf-status-mid">
      ${o.art || ''}
      <h2 class="sf-status-h">${o.h}</h2>
      ${o.sub ? `<p class="sf-status-sub">${o.sub}</p>` : ''}
    </div>
    ${o.card || ''}
  </div>`;
}

// ---------- tabulka pořadí + dolní lišta "Další kolo" ----------
function sfScoreboardHtml(state, title = 'Scoreboard') {
  return `<section class="sf-card sf-sb"><h2 class="sf-h3">${title}</h2><div class="scoreboard">${scoreboardRowsHtml(state.players)}</div></section>`;
}
function sfNextBarHtml(state) {
  return `<div class="sf-start-bar">${state.isHost
    ? `<button id="next-btn" class="btn btn-primary btn-block sf-start">${state.round >= state.totalRounds ? 'Show final results' : 'Next round'} ${icon('chevron')}</button>`
    : '<p class="sf-wait-host"><span class="sf-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>Waiting for the host to start the next round…</span></p>'}</div>`;
}
function sfWireNext() {
  const b = document.getElementById('next-btn');
  if (b) b.onclick = () => send({ type: 'next_round' });
}

// chybějící ikonky
if (typeof ICON_PATHS === 'object') {
  ICON_PATHS.send = ICON_PATHS.send || '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>';
  ICON_PATHS.undo = ICON_PATHS.undo || '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>';
}
