// Vývojářský režim — jen pro autora hry přes tajný odkaz ?dev=KLÍČ.
// Klíč ověří server (zná jen jeho otisk). V dev režimu: hodně mincí,
// všechno odemčené a zadarmo, v lobby tlačítko „Add bot“.
// Dev režim má vlastní uložený postup (vyraz_shop_dev), takže normální
// postup na stejném telefonu zůstane nedotčený. Vypnutí: ?dev=off

const DEV_COINS = 1000000;

(() => {
  try {
    const params = new URLSearchParams(location.search);
    const key = params.get('dev');
    if (key === null) return;
    if (key === 'off') {
      localStorage.removeItem('vyraz_dev_key');
      localStorage.removeItem('vyraz_dev_verified');
    } else {
      localStorage.setItem('vyraz_dev_key', key);
    }
    // klíč z adresy hned zmizí (ať nezůstane v historii ani na screenshotu)
    params.delete('dev');
    const qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  } catch { /* ignore */ }
})();

function devKey() {
  try { return localStorage.getItem('vyraz_dev_key'); } catch { return null; }
}

// Dev režim platí, až ho server potvrdí (pamatuje se i na příští spuštění).
function isDevMode() {
  try { return !!devKey() && localStorage.getItem('vyraz_dev_verified') === '1'; } catch { return false; }
}

function sendDevLogin() {
  const key = devKey();
  if (key) send({ type: 'dev_login', key });
}

function handleDevMessage(msg) {
  if (msg.type === 'dev_ok') {
    const was = isDevMode();
    try { localStorage.setItem('vyraz_dev_verified', '1'); } catch { /* ignore */ }
    if (!was) { showToast('Developer mode on'); if (!lastState) renderStartScreen(); }
    return true;
  }
  if (msg.type === 'dev_denied') {
    try { localStorage.removeItem('vyraz_dev_key'); localStorage.removeItem('vyraz_dev_verified'); } catch { /* ignore */ }
    if (!lastState) renderStartScreen();
    return true;
  }
  return false;
}

function devBadgeHtml() {
  return isDevMode() ? '<span class="dev-badge">DEV</span>' : '';
}

function addBotButtonHtml(state) {
  if (!isDevMode() || !state.isHost) return '';
  return `<button id="add-bot-btn" class="btn btn-ghost btn-block">${icon('plus')} Add bot</button>`;
}

function wireAddBot() {
  const btn = document.getElementById('add-bot-btn');
  if (btn) btn.onclick = () => send({ type: 'dev_add_bot' });
}
