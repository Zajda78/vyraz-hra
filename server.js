// "Výraz" — prototyp párty hry: padne věta, všichni se vyfotí s reakcí,
// fotky se odhalí najednou a hlasuje se, čí výraz sedí nejlíp.
// Jednoduchý Node server: statický frontend + WebSocket pro živý stav lobby.
// Stav je jen v paměti procesu (žádná databáze) — restart serveru = konec her.

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const SUBMIT_SECONDS = 30;
const VOTE_SECONDS = 20;
const RESULTS_AUTO_ADVANCE_SECONDS = 15;
const DRAW_SECONDS_DEFAULT = 20;
const DRAW_SECONDS_MIN = 5;
const DRAW_SECONDS_MAX = 120;
const CAPTION_SECONDS_DEFAULT = 40;
const CAPTION_SECONDS_MIN = 10;
const CAPTION_SECONDS_MAX = 180;
const CAPTION_WIN_POINTS = 100;

// Bodování podle pořadí v kole — 1. místo dostane nejvíc, další míň, ale
// nikdo nejde na nulu úplně (kromě "Nestihl to"). Plynulý sestupný žebříček,
// funguje pro libovolný počet hráčů (max v lobby je 10).
const POINTS_BY_RANK = [100, 80, 64, 51, 41, 33, 26, 21, 17, 13];

function pointsForRank(rank) {
  const idx = Math.min(rank - 1, POINTS_BY_RANK.length - 1);
  return POINTS_BY_RANK[idx];
}

// Prompty s dosazeným jménem náhodného hráče z lobby ({name} se nahradí).
const NAME_PROMPTS = [
  'Výraz, když ti {name} dluží 500 Kč a řekne "vrátím příště"',
  'Tvůj výraz, když ti {name} sní poslední jídlo z lednice',
  'Jak se tváříš, když tě {name} přistihne zpívat samotného v autě',
  'Výraz, když ti {name} řekne, že vypadáš jako jeho bývalá',
  'Tvář, když zjistíš, že ti {name} čte zprávy přes rameno',
  'Výraz, když ti {name} v obchodě omylem řekne "miluju tě"',
  'Tvůj výraz, když {name} vedle tebe v kině hlučně žere brambůrky',
  'Výraz, když ti {name} přizná, že sleduje tvůj Instagram pod cizím účtem',
  'Tvář, když tě {name} v sobotu v 7 ráno vzbudí s nápadem jít běhat',
  'Výraz, když ti {name} řekne, že tvoje oblíbená hospoda zavřela',
  'Tvůj výraz, když tě {name} označí na trapné fotce z výletu',
  'Výraz, když ti {name} dá stejný dárek, co jsi mu dal loni ty',
  'Tvář, když ti {name} v hospodě řekne "platím" a nemá peněženku',
  'Výraz, když {name} prohraje sázku a musí tě poslouchat 24 hodin',
  'Tvůj výraz, když ti {name} ukáže fotky z dovolené, kam tě nepozval',
  'Tvář, když ti {name} v posilovně nabídne spotování a upustí činku',
  'Výraz, když {name} sfoukne svíčky na dortu, co jsi pekl ty',
  'Tvůj výraz, když ti {name} řekne, že tvůj oblíbený tým zase prohrál',
  'Výraz, když ti {name} napíše zprávu ve 3 ráno a evidentně je vzhůru',
  'Tvář, když ti {name} přizná, že ti dva roky říkal špatné jméno',
  'Výraz, když na tebe {name} v obchodě zamává a ty nevíš, kdo to je',
  'Tvůj výraz, když ti {name} řekne, že tvoje oblíbená písnička je trapná',
  'Výraz, když ti {name} ukáže, že tě sledoval už na základce',
  'Tvář, když ti {name} vrátí půjčenou knihu celou zmuchlanou',
  'Výraz, když {name} v kvízu vyhraje otázku, na kterou jsi znal odpověď ty',
  'Tvůj výraz, když ti {name} řekne, že máš něco na zubech už celý večer',
  'Výraz, když ti {name} přizná, že smazal tvůj rozkoukaný seriál',
  'Tvář, když tě {name} vyfotí přesně v momentě nejhoršího výrazu',
  'Výraz, když ti {name} řekne, že tvůj parfém zná od souseda',
  'Tvůj výraz, když {name} otevře tvoji lednici a řekne "to je všechno?"',
  'Výraz, když ti {name} připomene trapas ze silvestra, na který jsi zapomněl',
  'Tvář, když ti {name} řekne, že jeho pes tě má radši než jeho',
  'Výraz, když ti {name} přizná, že tvůj vtip nikdy nebyl vtipný',
];

function code() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return out;
}

function id() {
  return crypto.randomBytes(8).toString('hex');
}

/** @type {Map<string, Lobby>} */
const lobbies = new Map();

function newLobby(hostId) {
  return {
    hostId,
    mode: 'classic', // classic | draw | caption — nastaví se při create_lobby, dál se nemění
    phase: 'lobby', // lobby | submitting | drawing | voting | subject_photo | captioning | judging | results | gameover
    totalRounds: 6,
    drawEnabled: false,
    drawSeconds: DRAW_SECONDS_DEFAULT,
    round: 0,
    prompt: null,
    usedPrompts: new Set(),
    players: new Map(), // id -> { id, name, score, ws, connected }
    submissions: new Map(), // id -> { photoDataUrl, missed }
    votes: new Map(), // voterId -> targetId
    drawDone: new Set(), // hráči, kteří dokreslili (nebo neměli co)
    cardOrder: [], // shuffled player ids for this round's reveal
    // --- Main character (mode: 'caption') ---
    captionSeconds: CAPTION_SECONDS_DEFAULT, // jediná fáze s časovým limitem — psaní popisků
    subjectOrder: [], // pořadí hráčů, kdo bude objekt fotky, zamíchané při startu hry
    subjectIndex: -1,
    subjectId: null,
    subjectPhoto: null, // { photoDataUrl } | null
    captions: new Map(), // playerId -> text
    captionOrder: [], // zamíchané pořadí id autorů pro anonymní zobrazení při výběru
    deadlineAt: null,
    timer: null,
    lastRoundResult: null,
  };
}

function pickPrompt(lobby) {
  const remaining = NAME_PROMPTS.filter((t) => !lobby.usedPrompts.has(t));
  const pool = remaining.length ? remaining : NAME_PROMPTS;
  const chosen = pool[crypto.randomInt(pool.length)];

  lobby.usedPrompts.add(chosen);
  if (lobby.usedPrompts.size >= NAME_PROMPTS.length) lobby.usedPrompts.clear();

  const players = connectedPlayers(lobby);
  const target = players[crypto.randomInt(players.length)];
  return chosen.replace('{name}', target.name);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function connectedPlayers(lobby) {
  return [...lobby.players.values()].filter((p) => p.connected);
}

function clearTimer(lobby) {
  if (lobby.timer) {
    clearTimeout(lobby.timer);
    lobby.timer = null;
  }
}

function startRound(lobby) {
  if (lobby.mode === 'caption') return startCaptionRound(lobby);
  clearTimer(lobby);
  lobby.round += 1;
  lobby.prompt = pickPrompt(lobby);
  lobby.submissions.clear();
  lobby.votes.clear();
  lobby.drawDone = new Set();
  lobby.cardOrder = [];
  lobby.lastRoundResult = null;
  lobby.phase = 'submitting';
  lobby.deadlineAt = Date.now() + SUBMIT_SECONDS * 1000;
  lobby.timer = setTimeout(() => afterSubmitting(lobby), SUBMIT_SECONDS * 1000);
  broadcast(lobby);
}

// ---------------------------------------------------------- Main character ---

// Najde dalšího hráče v rotaci, co je připojený (odpojené přeskočí).
function pickNextSubject(lobby) {
  const order = lobby.subjectOrder;
  if (!order.length) return null;
  for (let i = 1; i <= order.length; i++) {
    const idx = (lobby.subjectIndex + i) % order.length;
    const pid = order[idx];
    const player = lobby.players.get(pid);
    if (player && player.connected) {
      lobby.subjectIndex = idx;
      return pid;
    }
  }
  return null;
}

function startCaptionRound(lobby) {
  clearTimer(lobby);
  lobby.round += 1;
  lobby.prompt = null;
  lobby.subjectPhoto = null;
  lobby.captions = new Map();
  lobby.captionOrder = [];
  lobby.lastRoundResult = null;

  const subjectId = pickNextSubject(lobby);
  lobby.subjectId = subjectId;
  if (!subjectId) return; // nikdo připojený — hra se pozastaví, dokud se někdo nevrátí

  // Čas na fotku je neomezený — čeká se, dokud objekt fotku neodešle.
  lobby.phase = 'subject_photo';
  lobby.deadlineAt = null;
  broadcast(lobby);
}

function afterSubjectPhoto(lobby) {
  if (lobby.phase !== 'subject_photo') return;
  clearTimer(lobby);
  if (!lobby.subjectPhoto) return; // bez timeoutu — dokud fotka nedorazí, není co dělat
  beginCaptioning(lobby);
}

function beginCaptioning(lobby) {
  lobby.phase = 'captioning';
  lobby.deadlineAt = Date.now() + lobby.captionSeconds * 1000;
  lobby.timer = setTimeout(() => afterCaptioning(lobby), lobby.captionSeconds * 1000);
  broadcast(lobby);
}

function maybeAdvanceFromCaptioning(lobby) {
  if (lobby.phase !== 'captioning') return;
  const eligible = connectedPlayers(lobby).filter((p) => p.id !== lobby.subjectId);
  if (eligible.length > 0 && eligible.every((p) => lobby.captions.has(p.id))) {
    afterCaptioning(lobby);
  }
}

function afterCaptioning(lobby) {
  if (lobby.phase !== 'captioning') return;
  clearTimer(lobby);
  if (lobby.captions.size === 0) {
    finishCaptionRound(lobby, { noCaptions: true });
    return;
  }
  // Čas na výběr vítěze je neomezený — čeká se, dokud objekt fotky nevybere.
  lobby.captionOrder = shuffle([...lobby.captions.keys()]);
  lobby.phase = 'judging';
  lobby.deadlineAt = null;
  broadcast(lobby);
}

function finishCaptionRound(lobby, { winnerId = null, skipped = false, noCaptions = false } = {}) {
  clearTimer(lobby);

  if (winnerId) {
    const winner = lobby.players.get(winnerId);
    if (winner) winner.score += CAPTION_WIN_POINTS;
  }

  const captionsList = [...lobby.captions.entries()].map(([pid, text]) => {
    const player = lobby.players.get(pid);
    return { id: pid, name: player ? player.name : '???', text, isWinner: pid === winnerId };
  });

  const subjectPlayer = lobby.players.get(lobby.subjectId);
  lobby.lastRoundResult = {
    kind: 'caption',
    round: lobby.round,
    subjectId: lobby.subjectId,
    subjectName: subjectPlayer ? subjectPlayer.name : '???',
    photoDataUrl: lobby.subjectPhoto ? lobby.subjectPhoto.photoDataUrl : null,
    captions: captionsList,
    winnerId,
    points: winnerId ? CAPTION_WIN_POINTS : 0,
    skipped,
    noCaptions,
  };

  lobby.phase = 'results';
  lobby.deadlineAt = Date.now() + RESULTS_AUTO_ADVANCE_SECONDS * 1000;
  lobby.timer = setTimeout(() => advanceAfterResults(lobby), RESULTS_AUTO_ADVANCE_SECONDS * 1000);
  broadcast(lobby);
}

function maybeAdvanceFromSubmitting(lobby) {
  const active = connectedPlayers(lobby);
  if (active.length > 0 && active.every((p) => lobby.submissions.has(p.id))) {
    afterSubmitting(lobby);
  }
}

// Doba na focení vypršela (nebo poslali fotku úplně všichni) — chybějící
// fotky se dorovnají na "nestihl to" a pokračuje se buď kreslením, nebo
// rovnou hlasováním.
function afterSubmitting(lobby) {
  if (lobby.phase !== 'submitting') return;
  clearTimer(lobby);
  const active = connectedPlayers(lobby);
  for (const p of active) {
    if (!lobby.submissions.has(p.id)) {
      lobby.submissions.set(p.id, { photoDataUrl: null, missed: true });
    }
  }
  if (lobby.drawEnabled) {
    beginDrawing(lobby);
  } else {
    beginVoting(lobby);
  }
}

function beginDrawing(lobby) {
  lobby.phase = 'drawing';
  lobby.drawDone = new Set();
  // kdo nemá fotku, nemá co dokreslovat — rovnou ho označíme jako hotového
  for (const p of connectedPlayers(lobby)) {
    if (lobby.submissions.get(p.id)?.missed) lobby.drawDone.add(p.id);
  }
  lobby.deadlineAt = Date.now() + lobby.drawSeconds * 1000;
  lobby.timer = setTimeout(() => beginVoting(lobby), lobby.drawSeconds * 1000);
  broadcast(lobby);
  maybeAdvanceFromDrawing(lobby);
}

function maybeAdvanceFromDrawing(lobby) {
  if (lobby.phase !== 'drawing') return;
  const active = connectedPlayers(lobby);
  if (active.length > 0 && active.every((p) => lobby.drawDone.has(p.id))) {
    beginVoting(lobby);
  }
}

function beginVoting(lobby) {
  if (lobby.phase !== 'submitting' && lobby.phase !== 'drawing') return;
  clearTimer(lobby);
  const active = connectedPlayers(lobby);
  lobby.cardOrder = shuffle(active.map((p) => p.id));
  lobby.phase = 'voting';
  lobby.deadlineAt = Date.now() + VOTE_SECONDS * 1000;
  lobby.timer = setTimeout(() => finishVoting(lobby), VOTE_SECONDS * 1000);
  broadcast(lobby);
}

function votableCardCount(lobby) {
  return lobby.cardOrder.filter((pid) => !lobby.submissions.get(pid)?.missed).length;
}

function maybeAdvanceFromVoting(lobby) {
  const active = connectedPlayers(lobby);
  const votable = votableCardCount(lobby);
  if (votable === 0) return finishVoting(lobby);
  // hráč je "eligible" jen pokud pro něj existuje aspoň jedna volitelná cizí karta
  const eligibleVoters = active.filter((p) =>
    lobby.cardOrder.some((pid) => pid !== p.id && !lobby.submissions.get(pid)?.missed),
  );
  if (eligibleVoters.length > 0 && eligibleVoters.every((p) => lobby.votes.has(p.id))) {
    finishVoting(lobby);
  }
}

function finishVoting(lobby) {
  if (lobby.phase !== 'voting') return;
  clearTimer(lobby);

  const tally = new Map();
  for (const targetId of lobby.votes.values()) {
    tally.set(targetId, (tally.get(targetId) || 0) + 1);
  }

  // Seřaď hráče s fotkou podle hlasů a rozdej "husté" pořadí (shodné počty
  // hlasů = shodné místo), kdo fotku nestihl, body nedostává.
  const withPhoto = lobby.cardOrder.filter((pid) => !lobby.submissions.get(pid)?.missed);
  const sorted = withPhoto
    .map((pid) => ({ pid, votes: tally.get(pid) || 0 }))
    .sort((a, b) => b.votes - a.votes);

  const rankByPid = new Map();
  let rank = 0;
  let lastVotes = null;
  for (const entry of sorted) {
    if (entry.votes !== lastVotes) {
      rank += 1;
      lastVotes = entry.votes;
    }
    rankByPid.set(entry.pid, rank);
  }

  for (const [pid, rnk] of rankByPid) {
    const player = lobby.players.get(pid);
    if (player) player.score += pointsForRank(rnk);
  }

  const cards = lobby.cardOrder
    .map((pid) => {
      const player = lobby.players.get(pid);
      const sub = lobby.submissions.get(pid);
      const rnk = rankByPid.has(pid) ? rankByPid.get(pid) : null;
      return {
        id: pid,
        name: player ? player.name : '???',
        photoDataUrl: sub?.missed ? null : sub?.photoDataUrl || null,
        missed: !!sub?.missed,
        votes: tally.get(pid) || 0,
        rank: rnk,
        points: rnk != null ? pointsForRank(rnk) : 0,
        isWinner: rnk === 1,
      };
    })
    .sort((a, b) => {
      if (a.missed !== b.missed) return a.missed ? 1 : -1;
      return (a.rank ?? 999) - (b.rank ?? 999);
    });

  lobby.lastRoundResult = {
    round: lobby.round,
    prompt: lobby.prompt,
    cards,
  };

  lobby.phase = 'results';
  lobby.deadlineAt = Date.now() + RESULTS_AUTO_ADVANCE_SECONDS * 1000;
  lobby.timer = setTimeout(() => advanceAfterResults(lobby), RESULTS_AUTO_ADVANCE_SECONDS * 1000);
  broadcast(lobby);
}

function advanceAfterResults(lobby) {
  if (lobby.phase !== 'results') return;
  clearTimer(lobby);
  if (lobby.round >= lobby.totalRounds) {
    // Hra skončila — fotky z posledního kola už nikde nejsou potřeba (zobrazené
    // skóre a pódium je jen z čísel), takže je hned uvolníme z paměti.
    lobby.submissions.clear();
    lobby.votes.clear();
    lobby.cardOrder = [];
    lobby.subjectPhoto = null;
    lobby.captions = new Map();
    lobby.captionOrder = [];
    lobby.lastRoundResult = null;
    lobby.phase = 'gameover';
    lobby.deadlineAt = null;
    broadcast(lobby);
  } else {
    startRound(lobby);
  }
}

function publicState(lobby, viewerId) {
  const players = [...lobby.players.values()]
    .sort((a, b) => b.score - a.score)
    .map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      connected: p.connected,
      isHost: p.id === lobby.hostId,
      isYou: p.id === viewerId,
    }));

  const base = {
    type: 'state',
    code: lobby.code,
    mode: lobby.mode,
    phase: lobby.phase,
    round: lobby.round,
    totalRounds: lobby.totalRounds,
    drawEnabled: lobby.drawEnabled,
    drawSeconds: lobby.drawSeconds,
    captionSeconds: lobby.captionSeconds,
    prompt: lobby.prompt,
    players,
    youId: viewerId,
    isHost: viewerId === lobby.hostId,
    deadlineAt: lobby.deadlineAt,
  };

  if (lobby.phase === 'submitting') {
    base.submittedCount = lobby.submissions.size;
    base.activeCount = connectedPlayers(lobby).length;
    base.youSubmitted = lobby.submissions.has(viewerId);
  }

  if (lobby.phase === 'drawing') {
    const mySub = lobby.submissions.get(viewerId);
    base.yourPhotoDataUrl = mySub && !mySub.missed ? mySub.photoDataUrl : null;
    base.youMissed = !!mySub?.missed;
    base.doneCount = lobby.drawDone.size;
    base.activeCount = connectedPlayers(lobby).length;
    base.youDone = lobby.drawDone.has(viewerId);
  }

  if (lobby.phase === 'voting') {
    base.cards = lobby.cardOrder.map((pid) => {
      const sub = lobby.submissions.get(pid);
      return {
        id: pid,
        missed: !!sub?.missed,
        photoDataUrl: sub?.missed ? null : sub?.photoDataUrl || null,
        isOwn: pid === viewerId,
      };
    });
    base.votedCount = lobby.votes.size;
    base.activeCount = connectedPlayers(lobby).length;
    base.youVoted = lobby.votes.has(viewerId);
  }

  if (lobby.phase === 'subject_photo') {
    base.subjectId = lobby.subjectId;
    base.subjectName = lobby.players.get(lobby.subjectId)?.name || '???';
    base.isSubject = viewerId === lobby.subjectId;
  }

  if (lobby.phase === 'captioning') {
    base.subjectId = lobby.subjectId;
    base.subjectName = lobby.players.get(lobby.subjectId)?.name || '???';
    base.isSubject = viewerId === lobby.subjectId;
    base.subjectPhotoDataUrl = lobby.subjectPhoto ? lobby.subjectPhoto.photoDataUrl : null;
    base.captionedCount = lobby.captions.size;
    base.captionEligibleCount = connectedPlayers(lobby).filter((p) => p.id !== lobby.subjectId).length;
    base.youCaptioned = lobby.captions.has(viewerId);
  }

  if (lobby.phase === 'judging') {
    base.subjectId = lobby.subjectId;
    base.subjectName = lobby.players.get(lobby.subjectId)?.name || '???';
    base.isSubject = viewerId === lobby.subjectId;
    base.subjectPhotoDataUrl = lobby.subjectPhoto ? lobby.subjectPhoto.photoDataUrl : null;
    base.captionCards = lobby.captionOrder.map((pid) => ({ id: pid, text: lobby.captions.get(pid) }));
  }

  if (lobby.phase === 'results') {
    base.result = lobby.lastRoundResult;
  }

  if (lobby.phase === 'gameover') {
    const top = players.length ? players[0].score : 0;
    base.winners = players.filter((p) => p.score === top).map((p) => p.name);
  }

  return base;
}

function broadcast(lobby) {
  for (const p of lobby.players.values()) {
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify(publicState(lobby, p.id)));
    }
  }
}

function sendError(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'error', message }));
  }
}

// -------------------------------------------------------------------------

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  let lobby = null;
  let playerId = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'create_lobby') {
      const newCode = code();
      lobby = newLobby(null);
      lobby.code = newCode;
      lobby.mode = msg.mode === 'draw' ? 'draw' : msg.mode === 'caption' ? 'caption' : 'classic';
      lobby.drawEnabled = lobby.mode === 'draw';
      playerId = id();
      lobby.hostId = playerId;
      lobby.players.set(playerId, {
        id: playerId,
        name: (msg.name || 'Host').slice(0, 20),
        score: 0,
        ws,
        connected: true,
      });
      lobbies.set(newCode, lobby);
      broadcast(lobby);
      return;
    }

    if (msg.type === 'join_lobby') {
      const target = lobbies.get((msg.code || '').toUpperCase());
      if (!target) return sendError(ws, 'Lobby s tímhle kódem neexistuje.');
      if (target.phase !== 'lobby') return sendError(ws, 'Hra už začala, nejde se přidat.');
      if (target.players.size >= 10) return sendError(ws, 'Lobby je plná (max 10 hráčů).');
      lobby = target;
      playerId = id();
      lobby.players.set(playerId, {
        id: playerId,
        name: (msg.name || 'Hráč').slice(0, 20),
        score: 0,
        ws,
        connected: true,
      });
      broadcast(lobby);
      return;
    }

    if (!lobby || !playerId) return;

    if (msg.type === 'set_rounds' && playerId === lobby.hostId && lobby.phase === 'lobby') {
      const n = Math.max(3, Math.min(20, Number(msg.rounds) || 6));
      lobby.totalRounds = n;
      broadcast(lobby);
      return;
    }

    if (msg.type === 'set_draw_settings' && playerId === lobby.hostId && lobby.phase === 'lobby' && lobby.drawEnabled) {
      if (msg.seconds != null) {
        lobby.drawSeconds = Math.max(DRAW_SECONDS_MIN, Math.min(DRAW_SECONDS_MAX, Number(msg.seconds) || DRAW_SECONDS_DEFAULT));
      }
      broadcast(lobby);
      return;
    }

    if (msg.type === 'set_caption_settings' && playerId === lobby.hostId && lobby.phase === 'lobby' && lobby.mode === 'caption') {
      if (msg.seconds != null) {
        lobby.captionSeconds = Math.max(CAPTION_SECONDS_MIN, Math.min(CAPTION_SECONDS_MAX, Number(msg.seconds) || CAPTION_SECONDS_DEFAULT));
      }
      broadcast(lobby);
      return;
    }

    if (msg.type === 'start_game' && playerId === lobby.hostId && lobby.phase === 'lobby') {
      if (lobby.players.size < 2) return sendError(ws, 'Potřebuješ aspoň 2 hráče.');
      if (lobby.mode === 'caption') {
        lobby.subjectOrder = shuffle([...lobby.players.keys()]);
        lobby.subjectIndex = -1;
      }
      startRound(lobby);
      return;
    }

    if (msg.type === 'submit_photo' && (lobby.phase === 'submitting' || lobby.phase === 'drawing')) {
      if (typeof msg.photoDataUrl === 'string' && msg.photoDataUrl.startsWith('data:image/')) {
        if (lobby.phase === 'drawing' && lobby.submissions.get(playerId)?.missed) return;
        lobby.submissions.set(playerId, { photoDataUrl: msg.photoDataUrl, missed: false });
        broadcast(lobby);
        if (lobby.phase === 'submitting') maybeAdvanceFromSubmitting(lobby);
      }
      return;
    }

    if (msg.type === 'submit_photo' && lobby.phase === 'subject_photo' && playerId === lobby.subjectId) {
      if (typeof msg.photoDataUrl === 'string' && msg.photoDataUrl.startsWith('data:image/')) {
        lobby.subjectPhoto = { photoDataUrl: msg.photoDataUrl };
        broadcast(lobby);
        afterSubjectPhoto(lobby);
      }
      return;
    }

    if (msg.type === 'finish_drawing' && lobby.phase === 'drawing') {
      lobby.drawDone.add(playerId);
      broadcast(lobby);
      maybeAdvanceFromDrawing(lobby);
      return;
    }

    if (msg.type === 'submit_caption' && lobby.phase === 'captioning' && playerId !== lobby.subjectId) {
      const text = String(msg.text || '').trim().slice(0, 140);
      if (!text) return;
      lobby.captions.set(playerId, text);
      broadcast(lobby);
      maybeAdvanceFromCaptioning(lobby);
      return;
    }

    if (msg.type === 'pick_caption' && lobby.phase === 'judging' && playerId === lobby.subjectId) {
      const authorId = msg.authorId;
      if (!lobby.captions.has(authorId)) return;
      finishCaptionRound(lobby, { winnerId: authorId });
      return;
    }

    if (msg.type === 'cast_vote' && lobby.phase === 'voting') {
      const targetId = msg.targetId;
      if (targetId === playerId) return sendError(ws, 'Nemůžeš hlasovat sám pro sebe.');
      const targetSub = lobby.submissions.get(targetId);
      if (!targetSub || targetSub.missed) return sendError(ws, 'Tahle karta se nedá volit.');
      if (!lobby.cardOrder.includes(targetId)) return;
      lobby.votes.set(playerId, targetId);
      broadcast(lobby);
      maybeAdvanceFromVoting(lobby);
      return;
    }

    if (msg.type === 'next_round' && playerId === lobby.hostId && lobby.phase === 'results') {
      advanceAfterResults(lobby);
      return;
    }

    if (msg.type === 'play_again' && playerId === lobby.hostId && lobby.phase === 'gameover') {
      clearTimer(lobby);
      lobby.phase = 'lobby';
      lobby.round = 0;
      lobby.prompt = null;
      lobby.usedPrompts.clear();
      lobby.submissions.clear();
      lobby.votes.clear();
      lobby.drawDone = new Set();
      lobby.cardOrder = [];
      lobby.subjectOrder = [];
      lobby.subjectIndex = -1;
      lobby.subjectId = null;
      lobby.subjectPhoto = null;
      lobby.captions = new Map();
      lobby.captionOrder = [];
      lobby.lastRoundResult = null;
      lobby.deadlineAt = null;
      for (const p of lobby.players.values()) p.score = 0;
      broadcast(lobby);
      return;
    }
  });

  ws.on('close', () => {
    if (!lobby || !playerId) return;
    const p = lobby.players.get(playerId);
    if (p) p.connected = false;
    // lobby ve fázi čekání na hráče se po odpojení všech po chvíli sama uklidí
    if (connectedPlayers(lobby).length === 0) {
      clearTimer(lobby);
      setTimeout(() => {
        if (connectedPlayers(lobby).length === 0) lobbies.delete(lobby.code);
      }, 60_000);
    } else {
      if (lobby.phase === 'submitting') maybeAdvanceFromSubmitting(lobby);
      if (lobby.phase === 'drawing') maybeAdvanceFromDrawing(lobby);
      if (lobby.phase === 'voting') maybeAdvanceFromVoting(lobby);
      if (lobby.phase === 'captioning') maybeAdvanceFromCaptioning(lobby);
      broadcast(lobby);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Výraz běží na http://localhost:${PORT}`);
});
