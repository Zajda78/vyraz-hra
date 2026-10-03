// Přidání přítele přes QR kód: můj QR (SVG), otevření odkazu ?friend=KÓD a skener kamerou.
// Generátor QR je vendor/qrcode.js (MIT), záložní dekodér vendor/jsQR.js (Apache-2.0, načte se líně).

const FRIEND_QR_RE = /^[A-Z2-9]{6}$/;

function friendLinkFor(code) { return `${location.origin}/?friend=${code}`; }

// Vykreslí QR jako ostré SVG (tmavé moduly na bílé, s tichou zónou 4 modulů).
function friendQrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount(), q = 4, size = n + q * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (qr.isDark(r, c)) d += `M${c + q} ${r + q}h1v1h-1z`;
  }
  return `<svg class="qr-svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code">
    <rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

// Z naskenovaného textu (URL s ?friend= nebo holý kód) vytáhne platný kód, jinak null.
function friendCodeFromText(text) {
  const s = String(text || '').trim();
  let code = s;
  try { code = new URL(s).searchParams.get('friend') || ''; } catch { /* není URL */ }
  code = code.toUpperCase().trim();
  return FRIEND_QR_RE.test(code) ? code : null;
}

// ------------------------------------------------------------- můj QR ---
function showMyQrModal() {
  const code = getFriendCode();
  const name = getSavedName() || 'Player';
  const link = friendLinkFor(code);
  const modal = openModal(`
    <div class="x-close-row"><button class="x-close" id="qr-close" aria-label="Close">${icon('close')}</button></div>
    <div class="qr-modal">
      <h2>My QR code</h2>
      <div class="qr-card">${friendQrSvg(link)}</div>
      <div class="qr-name">${escapeHtml(name)}</div>
      <div class="my-code qr-code-text">${code}</div>
      <button class="btn btn-primary btn-block" id="qr-share">Share</button>
    </div>`);
  modal.querySelector('#qr-close').onclick = closeModal;
  modal.querySelector('#qr-share').onclick = async () => {
    const text = `Add me on face-it! My friend code: ${code}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'face-it', text, url: link }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(link); showToast('Link copied'); } catch { showToast(link); }
  };
}

// ------------------------------------------------ potvrzení přidání ---
function showAddFriendConfirm(code) {
  const modal = openModal(`
    <div class="x-close-row"><button class="x-close" id="af-close" aria-label="Close">${icon('close')}</button></div>
    <div class="qr-modal">
      <h2>Add friend?</h2>
      <div class="my-code qr-code-text">${code}</div>
      <button class="btn btn-primary btn-block" id="af-send">Send friend request</button>
    </div>`);
  modal.querySelector('#af-close').onclick = closeModal;
  modal.querySelector('#af-send').onclick = () => {
    closeModal();
    sendFriendRequest(code);
    showToast('Friend request sent!');
    homeTab = 'friends';
    renderStartScreen();
  };
}

// Společná kontrola kódu (vlastní / už přítel / nový).
function offerAddFriend(code) {
  if (code === getFriendCode()) return showToast('That\'s your own QR code.');
  if (isFriend(code)) return showToast('You\'re already friends.');
  showAddFriendConfirm(code);
}

// Odkaz ?friend=KÓD — parametr se vždy hned odstraní z adresy.
function handleFriendLink() {
  let raw = null;
  try {
    const params = new URLSearchParams(location.search);
    if (!params.has('friend')) return;
    raw = params.get('friend');
    params.delete('friend');
    const qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  } catch { return; }
  const code = String(raw || '').toUpperCase().trim();
  if (!FRIEND_QR_RE.test(code)) return;
  if (typeof lastState !== 'undefined' && lastState) return; // uprostřed hry nic nevyskakuje
  withName(() => offerAddFriend(code)); // bez jména se nejdřív zeptá na jméno
}
window.addEventListener('load', () => setTimeout(handleFriendLink, 50));

// ------------------------------------------------------------ skener ---
let qrJsLoading = null;
function loadJsQr() {
  if (window.jsQR) return Promise.resolve();
  if (!qrJsLoading) qrJsLoading = new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'vendor/jsQR.js'; s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });
  return qrJsLoading;
}

function showScanQrModal() {
  const modal = openModal(`
    <div class="x-close-row"><button class="x-close" id="sc-close" aria-label="Close">${icon('close')}</button></div>
    <div class="qr-modal">
      <h2>Scan QR</h2>
      <div class="scan-box"><video id="scan-video" playsinline muted autoplay></video><div class="scan-frame"></div></div>
      <div class="scan-error" id="scan-error" hidden>Couldn't access the camera.</div>
    </div>`);
  const video = modal.querySelector('#scan-video');
  let stream = null, stopped = false, timer = null;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  };
  modal.querySelector('#sc-close').onclick = () => { stop(); closeModal(); };
  const fail = () => {
    stop();
    modal.querySelector('.scan-box').hidden = true;
    modal.querySelector('#scan-error').hidden = false;
  };
  const found = (text) => {
    const code = friendCodeFromText(text);
    if (!code) return false;
    stop(); closeModal(); offerAddFriend(code);
    return true;
  };

  (async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (stopped || !document.body.contains(video)) return stop();
      video.srcObject = stream;
      await video.play().catch(() => {});
      let detector = null;
      if ('BarcodeDetector' in window) { try { detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch { detector = null; } }
      if (!detector) await loadJsQr();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const tick = async () => {
        // modal zmizel (jiná obrazovka / klepnutí vedle) → vypnout kameru
        if (stopped) return;
        if (!document.body.contains(video)) return stop();
        try {
          if (video.videoWidth) {
            if (detector) {
              const res = await detector.detect(video);
              for (const r of res) if (found(r.rawValue)) return;
            } else {
              const w = Math.min(video.videoWidth, 480), h = Math.round(w * video.videoHeight / video.videoWidth);
              canvas.width = w; canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              const r = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
              if (r && found(r.data)) return;
            }
          }
        } catch { /* snímek se nepovedl, zkusí se další */ }
        timer = setTimeout(tick, 125); // ~8 fps
      };
      tick();
    } catch { fail(); }
  })();
}
