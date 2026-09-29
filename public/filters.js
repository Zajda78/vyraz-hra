// Obličejové filtry (styl Snapchat) — používá je jen mód Filter Frenzy, který
// kolu vnutí jeden filtr. MediaPipe Face Landmarker se stahuje líně při otevření
// kamery v tom módu. Vše se kreslí vektorově na canvas.
// Klasický skript (sdílí globální scope s app.js), MediaPipe se načítá přes dynamic import().

const MP_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MP_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const FACE_FILTERS = [
  { id: 'dog', label: 'Dog' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'crown', label: 'Crown' },
  { id: 'clown', label: 'Clown' },
  { id: 'devil', label: 'Devil' },
];

// náhledové ikonky do dlaždic (viewBox 40x40)
const FILTER_ICONS = {
  dog: '<ellipse cx="9" cy="17" rx="6" ry="11" fill="#8B5A2B" transform="rotate(15 9 17)"/><ellipse cx="31" cy="17" rx="6" ry="11" fill="#8B5A2B" transform="rotate(-15 31 17)"/><circle cx="20" cy="23" r="10" fill="#f3d9b8"/><ellipse cx="20" cy="24" rx="4.5" ry="3.3" fill="#2b1b17"/><path d="M17.5 30h5v3.5a2.5 2.5 0 0 1-5 0z" fill="#ff6b8a"/>',
  glasses: '<rect x="3" y="12" width="15" height="12" rx="5" fill="#1b1030"/><rect x="22" y="12" width="15" height="12" rx="5" fill="#1b1030"/><path d="M18 16h4" stroke="#1b1030" stroke-width="2.5"/><path d="M6 15l5 0M25 15l5 0" stroke="#7df9ff" stroke-width="2" stroke-linecap="round"/>',
  crown: '<path d="M6 30V13l8 8 6-12 6 12 8-8v17z" fill="#ffc933" stroke="#c98a00" stroke-width="2" stroke-linejoin="round"/><circle cx="20" cy="25" r="2.6" fill="#ff3d6e"/><circle cx="11" cy="25" r="2" fill="#39c0ff"/><circle cx="29" cy="25" r="2" fill="#39e08a"/>',
  clown: '<circle cx="9" cy="24" r="5" fill="#ff8fb3"/><circle cx="31" cy="24" r="5" fill="#ff8fb3"/><circle cx="20" cy="21" r="8" fill="#ff2d2d"/><circle cx="17.5" cy="18.5" r="2.2" fill="#fff" opacity=".7"/>',
  devil: '<path d="M8 28C6 18 8 10 15 6c-1 6 0 12 4 22z" fill="#e5252a"/><path d="M32 28c2-10 0-18-7-22 1 6 0 12-4 22z" fill="#e5252a"/><circle cx="20" cy="30" r="5" fill="#ffb199" opacity=".0"/>',
};

let faceFilterId = 'none'; // aktivní filtr (jen ve Filter Frenzy, jinak 'none')

let faceLandmarker = null;
let faceLandmarkerPromise = null;
let faceRaf = 0;
let faceLastVideoTime = -1;
let faceTimestamp = 0;

// ---------------------------------------------------------------- načítání ---

function loadFaceLandmarker() {
  if (faceLandmarker) return Promise.resolve(faceLandmarker);
  if (faceLandmarkerPromise) return faceLandmarkerPromise;
  faceLandmarkerPromise = (async () => {
    const mod = await import(`${MP_BASE}/vision_bundle.mjs`);
    const fileset = await mod.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
    const make = (delegate) => mod.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MP_MODEL, delegate },
      runningMode: 'VIDEO',
      numFaces: 4,
    });
    try { faceLandmarker = await make('GPU'); }
    catch (e) { faceLandmarker = await make('CPU'); }
    return faceLandmarker;
  })().catch((err) => {
    faceLandmarkerPromise = null; // příště zkusit znovu
    throw err;
  });
  return faceLandmarkerPromise;
}

// ------------------------------------------------------------------- UI ---

// Odznak s názvem filtru nad kamerou.
function faceFilterBadgeHtml(id) {
  const f = FACE_FILTERS.find((x) => x.id === id);
  if (!f) return '';
  return `<span class="ff-badge"><svg viewBox="0 0 40 40" width="20" height="20" aria-hidden="true">${FILTER_ICONS[id]}</svg>${f.label}</span>`;
}

// Přidá overlay canvas a odznak do kamerové obrazovky a zapne vnucený filtr
// (volat po startu kamery, jen ve Filter Frenzy). Když se MediaPipe nenačte,
// jde dál normálně fotit — jen jeden toast.
async function faceFiltersMount(forcedId) {
  const wrap = document.querySelector('.camera-wrap');
  const video = document.getElementById('cam-video');
  if (!wrap || !video || !FACE_FILTERS.some((f) => f.id === forcedId)) return; // kamera nedostupná / bez filtru
  faceFilterId = forcedId;
  if (!wrap.querySelector('.filter-canvas')) {
    const cv = document.createElement('canvas');
    cv.className = 'filter-canvas';
    video.insertAdjacentElement('afterend', cv);
  }
  if (!wrap.querySelector('.ff-badge')) wrap.insertAdjacentHTML('beforeend', faceFilterBadgeHtml(forcedId));
  if (faceLandmarker) { faceFiltersRefresh(); return; }
  try {
    await loadFaceLandmarker();
  } catch (err) {
    faceFilterId = 'none';
    if (typeof showToast === 'function') showToast("Filters aren't available on this device.");
    return;
  }
  if (!video.isConnected) return; // mezitím se obrazovka změnila
  faceFiltersRefresh();
}

// Podle aktuální kamery (rear/selfie) a filtru zobrazí/skryje řadu a spustí/zastaví smyčku.
function faceFiltersRefresh() {
  const video = document.getElementById('cam-video');
  if (!video) { faceFiltersStop(); return; }
  const rear = video.classList.contains('rear');
  const cv = document.querySelector('.filter-canvas');
  if (cv) cv.classList.toggle('rear', rear);
  if (!rear && faceFilterId !== 'none' && faceLandmarker) {
    if (!faceRaf) faceRaf = requestAnimationFrame(faceFilterTick);
  } else {
    faceFiltersStop();
    if (cv) { const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); }
  }
}

function faceFiltersStop() {
  if (faceRaf) cancelAnimationFrame(faceRaf);
  faceRaf = 0;
  faceLastVideoTime = -1;
}

// ----------------------------------------------------------------- smyčka ---

function faceFilterTick() {
  faceRaf = 0;
  const video = document.getElementById('cam-video');
  const cv = document.querySelector('.filter-canvas');
  if (!video || !cv || !video.isConnected || faceFilterId === 'none' || !faceLandmarker) return;
  faceRaf = requestAnimationFrame(faceFilterTick);
  if (video.classList.contains('rear')) return;
  const W = video.videoWidth, H = video.videoHeight;
  if (!W || !H || video.readyState < 2) return;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  if (video.currentTime === faceLastVideoTime) return; // nový snímek nepřišel
  faceLastVideoTime = video.currentTime;
  faceTimestamp = Math.max(faceTimestamp + 1, performance.now());
  let res;
  try { res = faceLandmarker.detectForVideo(video, faceTimestamp); }
  catch (e) { return; }
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  if (res && res.faceLandmarks) {
    for (const lm of res.faceLandmarks) drawFaceFilter(ctx, lm, W, H, faceFilterId);
  }
}

// Do fotky: nakreslí overlay se STEJNÝM výřezem (a stejnou transformací ctx) jako video.
function faceFiltersDrawInto(ctx, sx, sy, side, size) {
  const cv = document.querySelector('.filter-canvas');
  if (!cv || faceFilterId === 'none' || !cv.width) return;
  const video = document.getElementById('cam-video');
  if (video && video.classList.contains('rear')) return;
  ctx.drawImage(cv, sx, sy, side, side, 0, 0, size, size);
}

// ------------------------------------------------------------- kreslení ---

function ffRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Kreslí se v lokálních souřadnicích obličeje: počátek = střed mezi očima,
// osa x po linii očí (sklon = roll hlavy), vzdálenost očí = 100 jednotek.
function drawFaceFilter(ctx, lm, W, H, id) {
  const P = (i) => ({ x: lm[i].x * W, y: lm[i].y * H });
  const e1 = P(33), e2 = P(263); // vnější koutky očí
  const mid = { x: (e1.x + e2.x) / 2, y: (e1.y + e2.y) / 2 };
  const d = Math.hypot(e2.x - e1.x, e2.y - e1.y);
  if (!d) return;
  const a = Math.atan2(e2.y - e1.y, e2.x - e1.x);
  const k = d / 100;
  const cos = Math.cos(a), sin = Math.sin(a);
  const loc = (p) => {
    const dx = p.x - mid.x, dy = p.y - mid.y;
    return { x: (dx * cos + dy * sin) / k, y: (-dx * sin + dy * cos) / k };
  };
  const fy = loc(P(10)).y;          // čelo (záporné)
  const nose = loc(P(1));
  const lipU = loc(P(13)), lipL = loc(P(14));
  const mouthOpen = (lipL.y - lipU.y) > 9;

  ctx.save();
  ctx.translate(mid.x, mid.y);
  ctx.rotate(a);
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (id === 'dog') {
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * 78, fy + 30);
      ctx.scale(s, 1);
      ctx.rotate(-0.3);
      ctx.fillStyle = '#8a5a2b'; ctx.strokeStyle = '#5b3717'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(0, 24, 27, 52, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f2a1a8';
      ctx.beginPath(); ctx.ellipse(1, 20, 13, 34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // tlapka-nos
    ctx.fillStyle = '#20141a';
    ctx.beginPath();
    ctx.moveTo(nose.x - 20, nose.y - 10);
    ctx.quadraticCurveTo(nose.x, nose.y - 18, nose.x + 20, nose.y - 10);
    ctx.quadraticCurveTo(nose.x + 16, nose.y + 12, nose.x, nose.y + 14);
    ctx.quadraticCurveTo(nose.x - 16, nose.y + 12, nose.x - 20, nose.y - 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.ellipse(nose.x - 7, nose.y - 7, 6, 3, -0.3, 0, Math.PI * 2); ctx.fill();
    if (mouthOpen) {
      const ty = lipL.y - 4, tl = Math.min(70, 26 + (lipL.y - lipU.y) * 1.2);
      ctx.fillStyle = '#ff5c86'; ctx.strokeStyle = '#c93a63'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lipL.x - 20, ty);
      ctx.lineTo(lipL.x - 20, ty + tl - 16);
      ctx.quadraticCurveTo(lipL.x - 20, ty + tl, lipL.x, ty + tl);
      ctx.quadraticCurveTo(lipL.x + 20, ty + tl, lipL.x + 20, ty + tl - 16);
      ctx.lineTo(lipL.x + 20, ty);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lipL.x, ty + 4); ctx.lineTo(lipL.x, ty + tl - 10); ctx.stroke();
    }
  } else if (id === 'glasses') {
    for (const s of [-1, 1]) {
      const cx = s * 50;
      const g = ctx.createLinearGradient(0, -30, 0, 30);
      g.addColorStop(0, '#3b2a6b'); g.addColorStop(0.5, '#150c2c'); g.addColorStop(1, '#2a1a55');
      ffRoundRect(ctx, cx - 44, -28, 88, 58, 22);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#0b0618'; ctx.lineWidth = 6; ctx.stroke();
      // odlesky
      ctx.strokeStyle = 'rgba(125,249,255,.75)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(cx - 28, -12); ctx.lineTo(cx - 12, -20); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 20, 2); ctx.lineTo(cx - 10, -3); ctx.stroke();
      // stranice
      ctx.strokeStyle = '#0b0618'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(s * 93, -14); ctx.lineTo(s * 128, -10); ctx.stroke();
    }
    ctx.strokeStyle = '#0b0618'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-8, -10); ctx.quadraticCurveTo(0, -18, 8, -10); ctx.stroke();
  } else if (id === 'crown') {
    const by = fy + 12, w = 64;
    const g = ctx.createLinearGradient(0, by - 70, 0, by);
    g.addColorStop(0, '#ffe680'); g.addColorStop(1, '#f2a900');
    ctx.fillStyle = g; ctx.strokeStyle = '#b87400'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-w, by);
    ctx.lineTo(-w - 4, by - 58);
    ctx.lineTo(-32, by - 30);
    ctx.lineTo(0, by - 76);
    ctx.lineTo(32, by - 30);
    ctx.lineTo(w + 4, by - 58);
    ctx.lineTo(w, by);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // spodní pás
    ctx.fillStyle = '#e59a00';
    ffRoundRect(ctx, -w, by - 14, w * 2, 16, 6); ctx.fill(); ctx.stroke();
    // kuličky na špičkách
    ctx.fillStyle = '#fff3b0';
    for (const p of [[-w - 4, by - 60], [0, by - 78], [w + 4, by - 60]]) {
      ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // drahokamy
    const gems = [[0, by - 40, '#ff3d6e'], [-38, by - 6, '#39c0ff'], [38, by - 6, '#39e08a'], [0, by - 6, '#ffffff']];
    for (const [gx, gy, col] of gems) {
      ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(gx, gy - 8); ctx.lineTo(gx + 7, gy); ctx.lineTo(gx, gy + 8); ctx.lineTo(gx - 7, gy);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  } else if (id === 'clown') {
    for (const s of [-1, 1]) {
      const c = loc(P(s < 0 ? 205 : 425));
      ctx.fillStyle = 'rgba(255,90,140,.55)';
      ctx.beginPath(); ctx.arc(c.x, c.y, 24, 0, Math.PI * 2); ctx.fill();
    }
    const g = ctx.createRadialGradient(nose.x - 6, nose.y - 8, 2, nose.x, nose.y, 24);
    g.addColorStop(0, '#ff7a7a'); g.addColorStop(1, '#d80f1c');
    ctx.fillStyle = g; ctx.strokeStyle = '#8f0912'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(nose.x, nose.y, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath(); ctx.ellipse(nose.x - 8, nose.y - 9, 6, 4, -0.6, 0, Math.PI * 2); ctx.fill();
  } else if (id === 'devil') {
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * 52, fy + 22);
      ctx.scale(s, 1);
      const g = ctx.createLinearGradient(0, 0, 0, -66);
      g.addColorStop(0, '#b3001b'); g.addColorStop(1, '#ff4d4d');
      ctx.fillStyle = g; ctx.strokeStyle = '#6e0010'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-15, 4);
      ctx.quadraticCurveTo(-12, -40, 20, -66);
      ctx.quadraticCurveTo(14, -30, 16, 4);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}
