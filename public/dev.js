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
  document.querySelectorAll('[data-rename-bot]').forEach((b) => {
    b.onclick = () => showRenameBotModal(b.dataset.renameBot, b.dataset.name);
  });
}

// Tužka u bota v lobby (jen vývojář, který je hostitel).
function renameBotButtonHtml(state, p) {
  if (!isDevMode() || !state.isHost || !p.isBot) return '';
  return `<button class="rename-bot-btn" data-rename-bot="${p.id}" data-name="${escapeHtml(p.name)}" aria-label="Rename bot">${icon('pencil')}</button>`;
}

function showRenameBotModal(botId, currentName) {
  const modal = openModal(`
    <div class="x-close-row"><button class="x-close" id="rename-bot-close" aria-label="Close">${icon('close')}</button></div>
    <h2>Rename bot</h2>
    <div class="field"><input id="rename-bot-input" maxlength="20" value="${escapeHtml(currentName)}" placeholder="Bot name"></div>
    <button class="btn btn-primary btn-block" id="rename-bot-save">Save name</button>
  `);
  const input = modal.querySelector('#rename-bot-input');
  const save = () => {
    const name = input.value.trim();
    if (!name) return showToast('Please enter a name.');
    send({ type: 'dev_rename_bot', playerId: botId, name });
    closeModal();
  };
  modal.querySelector('#rename-bot-save').onclick = save;
  modal.querySelector('#rename-bot-close').onclick = closeModal;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  input.focus();
  input.select();
}
