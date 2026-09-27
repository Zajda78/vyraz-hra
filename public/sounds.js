// Zvuky hry — krátké efekty v public/sfx (balíčky Kenney.nl, licence CC0,
// převedené na WAV, aby hrály na každém telefonu). Přehrávají se přes
// Web Audio: mobil pustí zvuk až po prvním dotyku, proto se zvuky načtou
// a „odemknou" při prvním klepnutí kamkoli.
// Hlasitost hudby a zvuků (posuvníky v nastavení) se pamatuje v localStorage.

const SFX_NAMES = [
  'tap', 'vote', 'player-join', 'game-start', 'timer-tick', 'time-up', 'shutter',
  'round-results', 'win', 'coins', 'chest-open', 'chest-tick',
  'reveal-common', 'reveal-rare', 'reveal-epic', 'reveal-legendary',
];

// hlasitost jednotlivých zvuků (0–1) — časté a drobné zvuky jsou tišší
const SFX_VOLUME = {
  tap: 0.3, 'chest-tick': 0.3, 'timer-tick': 0.55, vote: 0.5, shutter: 0.6,
  'player-join': 0.5, coins: 0.6,
};

// Hudba v lobby — „Chill Night" (Pixabay, bez nutnosti uvádět autora).
const LOBBY_MUSIC_SRC = 'sfx/lobby-music.mp3';
const LOBBY_MUSIC_VOLUME = 0.5; // hlasitost při posuvníku na 100 %

// Hlasitost z posuvníků v nastavení (0–1). Výchozí: hudba 60 %, zvuky 100 %.
const VOLUME_DEFAULTS = { music: 0.6, sfx: 1 };

function getVolume(kind) {
  try {
    const v = JSON.parse(localStorage.getItem('vyraz_volume') || '{}')[kind];
    return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : VOLUME_DEFAULTS[kind];
  } catch { return VOLUME_DEFAULTS[kind]; }
}

function setVolume(kind, value) {
  let all = {};
  try { all = JSON.parse(localStorage.getItem('vyraz_volume') || '{}'); } catch { /* ignore */ }
  all[kind] = Math.max(0, Math.min(1, value));
  try { localStorage.setItem('vyraz_volume', JSON.stringify(all)); } catch { /* ignore */ }
  if (kind === 'music' && lobbyMusic) lobbyMusic.volume = musicVolume();
}

function musicVolume() {
  return LOBBY_MUSIC_VOLUME * getVolume('music');
}

let audioCtx = null;
const sfxBuffers = {};
let sfxLoading = null;

function ensureAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { return; }
  if (!sfxLoading) {
    sfxLoading = Promise.all(SFX_NAMES.map(async (name) => {
      try {
        const res = await fetch(`sfx/${name}.wav`);
        sfxBuffers[name] = await audioCtx.decodeAudioData(await res.arrayBuffer());
      } catch { /* zvuk chybí — prostě nehraje */ }
    }));
  }
}

// první dotyk kamkoli odemkne zvuk (capture = dřív než obsluha tlačítka)
['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, ensureAudio, { capture: true, passive: true }));

function playSfx(name, volume) {
  if (!audioCtx || !sfxBuffers[name]) return;
  try {
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    src.buffer = sfxBuffers[name];
    gain.gain.value = (volume ?? SFX_VOLUME[name] ?? 0.7) * getVolume('sfx');
    src.connect(gain).connect(audioCtx.destination);
    src.start();
  } catch { /* bez zvuku */ }
}

// Jemné cvaknutí u přepínačů a spodní lišty (ne u každého tlačítka — to by otravovalo).
document.addEventListener('click', (e) => {
  if (e.target.closest('.bottom-nav-btn, .option-chip, .pack-chip, .rules-tab')) playSfx('tap');
}, true);

// ---------------------------------------------------------------- hudba ---

let lobbyMusic = null;
let lobbyMusicMissing = false;

function playLobbyMusic() {
  if (lobbyMusicMissing || getVolume('music') === 0) return;
  if (!lobbyMusic) {
    lobbyMusic = new Audio(LOBBY_MUSIC_SRC);
    lobbyMusic.loop = true;
    lobbyMusic.volume = musicVolume();
    lobbyMusic.addEventListener('error', () => { lobbyMusicMissing = true; lobbyMusic = null; });
  }
  if (lobbyMusic.paused) lobbyMusic.play().catch(() => { /* prohlížeč zatím nedovolil přehrát */ });
}

function stopLobbyMusic() {
  if (lobbyMusic && !lobbyMusic.paused) lobbyMusic.pause();
}

// --------------------------------------------- posuvníky v nastavení ---

function volumeSlidersHtml() {
  const row = (kind, label, ico) => `
    <div class="volume-row">
      <div class="volume-label">${icon(ico)} <span>${label}</span><b id="vol-${kind}-val">${Math.round(getVolume(kind) * 100)}%</b></div>
      <input type="range" class="volume-slider" id="vol-${kind}" min="0" max="100" step="5" value="${Math.round(getVolume(kind) * 100)}">
    </div>`;
  return `<div class="volume-card">${row('music', 'Music', 'music')}${row('sfx', 'Sounds', 'sound')}</div>`;
}

// Při posouvání hudby hraje ukázka, u zvuků zazní krátký zvuk, ať je slyšet výsledek.
function wireVolumeSliders(root) {
  const paint = (el) => el.style.setProperty('--fill', `${el.value}%`);
  ['music', 'sfx'].forEach((kind) => {
    const el = root.querySelector(`#vol-${kind}`);
    if (!el) return;
    paint(el);
    el.oninput = () => {
      paint(el);
      setVolume(kind, el.value / 100);
      root.querySelector(`#vol-${kind}-val`).textContent = `${el.value}%`;
      if (kind === 'music') {
        ensureAudio();
        if (getVolume('music') > 0) playLobbyMusic(); else stopLobbyMusic();
      }
    };
    el.onchange = () => { if (kind === 'sfx') playSfx('reveal-common'); };
  });
}
