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

// Hudba: v celé hře hraje hlavní skladba („Chill Night", Pixabay), v lobby
// vlastní skladba sfx/lobby-music.mp3. Dokud lobby skladba chybí, hraje
// v lobby dál ta hlavní. Mezi skladbami se plynule přejde.
const MUSIC_TRACKS = { main: 'sfx/main-music.mp3', lobby: 'sfx/lobby-music.mp3' };
const MUSIC_VOLUME = 0.5; // hlasitost při posuvníku na 100 %

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
  if (kind === 'music') {
    if (getVolume('music') === 0) stopMusic();
    else if (playingTrack && musicPlayers[playingTrack]) musicPlayers[playingTrack].volume = musicVolume();
    else playMusic(wantedTrack);
  }
}

function musicVolume() {
  return MUSIC_VOLUME * getVolume('music');
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
['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => {
  ensureAudio();
  if (!playingTrack) playMusic(wantedTrack);
}, { capture: true, passive: true }));

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

const musicPlayers = {}; // skladba -> <audio>
const musicMissing = {}; // skladby, které na serveru nejsou
let wantedTrack = 'main'; // co má podle obrazovky hrát
let playingTrack = null; // co opravdu hraje

function musicPlayer(track) {
  if (musicMissing[track]) return null;
  if (!musicPlayers[track]) {
    const a = new Audio(MUSIC_TRACKS[track]);
    a.loop = true;
    a.volume = 0;
    a.addEventListener('error', () => {
      musicMissing[track] = true;
      delete musicPlayers[track];
      if (playingTrack === track) playingTrack = null;
      playMusic(wantedTrack); // chybí lobby skladba → hraje hlavní
    });
    musicPlayers[track] = a;
  }
  return musicPlayers[track];
}

// plynulé zesílení / ztlumení
function fadeMusic(a, to, ms, done) {
  clearInterval(a._fade);
  const from = a.volume;
  const steps = Math.max(1, Math.round(ms / 40));
  let i = 0;
  a._fade = setInterval(() => {
    i += 1;
    a.volume = Math.max(0, Math.min(1, from + ((to - from) * i) / steps));
    if (i >= steps) { clearInterval(a._fade); if (done) done(); }
  }, 40);
}

function playMusic(track = 'main') {
  wantedTrack = track;
  if (getVolume('music') === 0) return;
  const real = musicMissing[track] ? 'main' : track;
  const next = musicPlayer(real);
  if (!next) return;
  if (playingTrack === real && !next.paused) return; // už hraje správná skladba
  const prev = playingTrack && playingTrack !== real ? musicPlayers[playingTrack] : null;
  playingTrack = real;
  next.play()
    .then(() => fadeMusic(next, musicVolume(), 700))
    .catch(() => { if (playingTrack === real) playingTrack = null; }); // bez dotyku prohlížeč nepustí
  if (prev) fadeMusic(prev, 0, 500, () => prev.pause());
}

function stopMusic() {
  Object.values(musicPlayers).forEach((a) => { clearInterval(a._fade); a.pause(); });
  playingTrack = null;
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
        if (getVolume('music') > 0) playMusic(wantedTrack); else stopMusic();
      }
    };
    el.onchange = () => { if (kind === 'sfx') playSfx('reveal-common'); };
  });
}
