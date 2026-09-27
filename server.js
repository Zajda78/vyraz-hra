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

// ------------------------------------------------- Vývojářský režim ---
// Jen pro autora hry přes tajný odkaz ?dev=KLÍČ. Repozitář je veřejný,
// proto tu není klíč, ale jen jeho SHA-256 otisk (z otisku se klíč zjistit nedá).
const DEV_KEY_HASH = 'a83f8574e55c4995848d7edca809e9b130f8346f49232693dee3594c2708615c';
function isDevKey(key) {
  return typeof key === 'string' && key.length >= 16
    && crypto.createHash('sha256').update(key).digest('hex') === DEV_KEY_HASH;
}
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
// --- Snap Hunt --- čas na hledání a vyfocení (hostitel vybírá v lobby)
const HUNT_SECONDS_DEFAULT = 60;
const HUNT_SECONDS_MIN = 15;
const HUNT_SECONDS_MAX = 180;

// --- Impostor ---
const MIN_PLAYERS = 3; // všechny módy se hrají od 3 hráčů
const IMPOSTOR_VOTE_SECONDS = 30;
const IMPOSTOR_CIV_WIN_POINTS = 100; // každý z ostatních, když impostora odhalí
const IMPOSTOR_WIN_POINTS = 250; // impostor, když ho neodhalí

// --- Mince za hru ---
// Záměrně skromné, ať se pořád vyplatí kupovat balíčky mincí:
// truhla stojí 50–250 mincí, výhra celé hry dá 13, denní odměna 30.
const COINS_PARTICIPATION = 3; // za každou dohranou hru
const COINS_BY_PLACE = [10, 5, 3]; // 1.–3. místo (neplatí v Impostorovi)
const COINS_IMPOSTOR_CIV_WIN = 3; // každý z ostatních za odhalení impostora
const COINS_IMPOSTOR_WIN = 10; // impostor, když ho neodhalí

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
  'Your face when {name} owes you $20 and says "I\'ll pay you back next time"',
  'Your face when {name} eats the last food in your fridge',
  'Your face when {name} catches you singing alone in the car',
  'Your face when {name} says you look just like their ex',
  'Your face when you realise {name} is reading your texts over your shoulder',
  'Your face when {name} accidentally says "love you" to the cashier',
  'Your face when {name} munches chips loudly next to you in the cinema',
  'Your face when {name} admits they follow your Instagram from a fake account',
  'Your face when {name} wakes you up at 7am on Saturday to go jogging',
  'Your face when {name} tells you your favourite bar just closed',
  'Your face when {name} tags you in an embarrassing trip photo',
  'Your face when {name} gives you the exact gift you gave them last year',
  'Your face when {name} says "I\'ll pay" at the bar and has no wallet',
  'Your face when {name} loses a bet and has to obey you for 24 hours',
  'Your face when {name} shows you holiday photos from a trip you weren\'t invited to',
  'Your face when {name} offers to spot you at the gym and drops the weight',
  'Your face when {name} blows out the candles on the cake you baked',
  'Your face when {name} tells you your favourite team lost again',
  'Your face when {name} texts you at 3am and is clearly wide awake',
  'Your face when {name} admits they\'ve been calling you the wrong name for two years',
  'Your face when {name} waves at you in a shop and you have no idea who they are',
  'Your face when {name} says your favourite song is cringe',
  'Your face when {name} shows you they\'ve followed you since primary school',
  'Your face when {name} returns your book all crumpled',
  'Your face when {name} wins a quiz question you knew the answer to',
  'Your face when {name} tells you you\'ve had food in your teeth all night',
  'Your face when {name} admits they deleted the show you were halfway through',
  'Your face when {name} snaps a photo of you at your worst possible moment',
  'Your face when {name} says your perfume smells like their neighbour',
  'Your face when {name} opens your fridge and says "is that all?"',
  'Your face when {name} brings up your New Year\'s Eve fail you\'d forgotten',
  'Your face when {name} says their dog likes you more than them',
  'Your face when {name} admits your jokes were never funny',
];

// Kosmetika ze shopu (nasazený rámeček / barva jména). Server jen přeposílá
// id věcí ostatním hráčům — co id znamená, ví až klient.
function sanitizeLooks(raw) {
  const clean = (v) => (typeof v === 'string' && /^[a-z0-9-]{1,32}$/.test(v) ? v : null);
  if (!raw || typeof raw !== 'object') return { frame: null, name: null };
  return { frame: clean(raw.frame), name: clean(raw.name) };
}

// Profilová fotka — malý obrázek (data URL), který si hráč nastaví
// v úpravě profilu. Telefon ho zmenší; server hlídá jen typ a velikost.
const AVATAR_MAX_CHARS = 24000;
function sanitizeAvatar(raw) {
  const v = raw && raw.avatar;
  if (typeof v !== 'string' || v.length > AVATAR_MAX_CHARS) return null;
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : null;
}

// Vzhled, jak ho vidí ostatní: rámeček + barva jména + profilovka.
function publicLooks(obj) {
  return { ...(obj.looks || { frame: null, name: null }), avatar: obj.avatar || null };
}

// Dvojice zadání pro Impostora: ostatní dostanou jedno, impostor druhé.
// Schválně podobné, ať se impostor může schovat — ale ne stejné.
// Která polovina připadne komu, se losuje každé kolo.
const IMPOSTOR_PAIRS = [
  ['Your face when you bite into a lemon', 'Your face when you taste a hot chilli'],
  ['Your face when you win the lottery', 'Your face when you get the gift you wanted'],
  ['Your face when you see a spider', 'Your face when you hear a weird noise at night'],
  ['Your face when you smell stinky socks', 'Your face when you taste sour milk'],
  ['Pose like a supermodel on the runway', 'Pose like a bodybuilder on stage'],
  ['Your face when you realise you overslept', 'Your face when you realise you forgot your keys'],
  ['Your face when someone tickles you', 'Your face when you try not to laugh at a funeral'],
  ['Your face when you see a cute puppy', 'Your face when you see a cute baby'],
  ['Your face when you wait for test results', 'Your face when you wait for your crush to reply'],
  ['Pose like a superhero', 'Pose like an Olympic champion'],
  ['Your face when you watch a horror movie', 'Your face when you ride a rollercoaster'],
  ['Your face when you have a toothache', 'Your face when you have a headache'],
  ['Your face when you drop your phone', 'Your face when you miss the bus'],
  ['Your face when someone tells a bad joke', 'Your face when someone sings off-key'],
  ['Pose like a statue in a museum', 'Pose like a street mime'],
  ['Your face when you bump into your ex', 'Your face when you bump into your teacher on holiday'],
  ['Your face when you eat the best pizza of your life', 'Your face when you drink your first coffee in the morning'],
  ['Your face when you realise it\'s Monday', 'Your face when you realise you\'re out of food'],
  ['Your face when you\'re keeping a secret', 'Your face when you\'re planning a surprise'],
  ['Your face when you\'re trying to fall asleep', 'Your face when you\'re bored in a lecture'],
];

// Sada „Spicy“ — pikantnější, trapnější otázky o randění a vztazích.
// Schválně bez explicitního obsahu (kvůli věkovému hodnocení v obchodech).
const SPICY_NAME_PROMPTS = [
  'Your face when {name} slides into your DMs at 2am',
  'Your face when {name} says they\'ve had a crush on you for years',
  'Your face when {name} reads your last text out loud to everyone',
  'Your face when {name} shows your ex your new Instagram',
  'Your face when {name} walks in on you practising flirting in the mirror',
  'Your face when {name} rates your dating profile 3/10',
  'Your face when {name} tells everyone who you texted last night',
  'Your face when {name} finds your secret playlist of love songs',
  'Your face when {name} matches with your ex on a dating app',
  'Your face when {name} asks your parents about your love life at dinner',
  'Your face when {name} says your kissing face looks like a fish',
  'Your face when {name} screenshots your flirty story reply',
  'Your face when {name} brings up your most embarrassing night out',
  'Your face when {name} reads your diary from when you were 14',
  'Your face when {name} saw you on a date last weekend',
  'Your face when {name} dares you to text your crush "I miss you"',
  'Your face when {name} reveals you still have your ex\'s hoodie',
  'Your face when {name} catches you stalking your ex\'s new partner',
  'Your face when {name} sends a voice note of you singing to the group chat',
  'Your face when {name} says your pick-up line is the worst they\'ve heard',
  'Your face when {name} scrolls through your search history',
  'Your face when {name} tells the whole party your worst date story',
  'Your face when {name} walks in while you\'re taking your 50th selfie',
  'Your face when {name} reveals your secret celebrity crush',
  'Your face when {name} says you talk about someone in your sleep',
  'Your face when {name} forwards your love letter to the group chat',
  'Your face when {name} asks who your first kiss was — in front of them',
  'Your face when {name} likes a 3-year-old photo of your crush from your phone',
  'Your face when {name} says your ex is now dating their cousin',
  'Your face when {name} tells your crush you practised asking them out',
];

const SPICY_IMPOSTOR_PAIRS = [
  ['Your face when your crush texts you back', 'Your face when your ex texts you back'],
  ['Your flirting face', 'Your "I\'m totally innocent" face'],
  ['Your face after a perfect first kiss', 'Your face after a terrible first date'],
  ['Pose like your dating app profile photo', 'Pose like your LinkedIn profile photo'],
  ['Your face when someone winks at you', 'Your face when someone blows you a kiss'],
  ['Your face when you get caught checking someone out', 'Your face when you get caught lying'],
  ['Your face the morning after a wild party', 'Your face after pulling an all-nighter'],
  ['Your face when you spot your crush at the party', 'Your face when you spot your ex at the party'],
  ['Your face when your mum finds your dating app', 'Your face when your mum reads your texts'],
  ['Pose like a Valentine\'s Day card', 'Pose like a wedding photo'],
  ['Your face when someone says "we need to talk"', 'Your face when someone says "I have a secret"'],
  ['Your face when you accidentally like an old photo', 'Your face when you text the wrong person'],
  ['Your face when you get a love letter', 'Your face when you get a breakup text'],
  ['Your "come here" face', 'Your "don\'t you dare" face'],
  ['Your face when someone asks how many exes you have', 'Your face when someone asks your age'],
  ['Pose like you\'re on a romantic dinner date', 'Pose like you\'re at a job interview'],
  ['Your face when your date orders for you', 'Your face when your date splits the bill to the cent'],
  ['Your most attractive face', 'Your sleepiest face'],
  ['Your face when your crush says "you\'re like a sibling to me"', 'Your face when your crush says "let\'s just be friends"'],
  ['Your face when you text "I love you" by accident', 'Your face when you reply "k" by accident'],
];

// Sada „Family“ — otázky vhodné pro celou rodinu i děti.
const FAMILY_NAME_PROMPTS = [
  'Your face when {name} says there\'s broccoli for dinner',
  'Your face when {name} eats the last cookie',
  'Your face when {name} says it\'s bedtime',
  'Your face when {name} gives you a surprise present',
  'Your face when {name} tells a really bad dad joke',
  'Your face when {name} steps on a LEGO brick',
  'Your face when {name} says the ice cream truck is here',
  'Your face when {name} beats you at a board game',
  'Your face when {name} does a silly dance',
  'Your face when {name} says homework is cancelled',
  'Your face when {name} finds a spider in the bath',
  'Your face when {name} sneezes really loudly',
  'Your face when {name} says we\'re going to the zoo',
  'Your face when {name} burns the toast',
  'Your face when {name} tickles you',
  'Your face when {name} spills juice on the sofa',
  'Your face when {name} says the dog ate your sandwich',
  'Your face when {name} wins every round of Monopoly',
  'Your face when {name} makes you try a super sour sweet',
  'Your face when {name} says there\'s no Wi-Fi on holiday',
  'Your face when {name} starts a pillow fight',
  'Your face when {name} reads a scary story at bedtime',
  'Your face when {name} sings in the car — really loudly',
  'Your face when {name} hides your favourite toy',
  'Your face when {name} says it\'s snowing outside',
  'Your face when {name} gives you the biggest slice of cake',
  'Your face when {name} forgets your name for a second',
  'Your face when {name} brings home a new puppy',
  'Your face when {name} says you have to clean your room',
  'Your face when {name} pulls a funny face at dinner',
];

const FAMILY_IMPOSTOR_PAIRS = [
  ['Your face when you eat a lemon', 'Your face when you eat a pickle'],
  ['Pose like a dinosaur', 'Pose like a monkey'],
  ['Your face when you get a present', 'Your face when you win a game'],
  ['Pose like a superhero', 'Pose like a wizard'],
  ['Your face when you see a ghost', 'Your face when you see a monster'],
  ['Your face when you smell pizza', 'Your face when you smell cookies'],
  ['Pose like a cat', 'Pose like a dog'],
  ['Your face when you\'re super sleepy', 'Your face when you\'re super bored'],
  ['Your face when it starts raining', 'Your face when it starts snowing'],
  ['Pose like a statue', 'Pose like a robot'],
  ['Your face when you eat ice cream', 'Your face when you eat chocolate'],
  ['Your face when you hear thunder', 'Your face when you hear a loud bang'],
  ['Pose like a ballerina', 'Pose like a footballer'],
  ['Your face when you lose your shoe', 'Your face when you lose your homework'],
  ['Your face when you see a rainbow', 'Your face when you see fireworks'],
  ['Pose like a pirate', 'Pose like a king'],
  ['Your face when you taste something spicy', 'Your face when you taste something sour'],
  ['Your face on your birthday', 'Your face on the first day of holidays'],
  ['Pose like a chicken', 'Pose like a penguin'],
  ['Your face when you\'re really hungry', 'Your face when you\'re really full'],
];

// Sada „School“ — škola, učitelé, testy, spolužáci.
const SCHOOL_NAME_PROMPTS = [
  'Your face when {name} asks to copy your homework',
  'Your face when {name} gets called to the board',
  'Your face when {name} says there\'s a surprise test today',
  'Your face when {name} falls asleep in class',
  'Your face when {name} gets a better grade than you',
  'Your face when {name} calls the teacher "Mum"',
  'Your face when {name} says the teacher is off sick',
  'Your face when {name} forgot the group project was due today',
  'Your face when {name} whispers the wrong answer to you',
  'Your face when {name} trips in the school hallway',
  'Your face when {name} gets caught using their phone in class',
  'Your face when {name} sits next to you in the exam',
  'Your face when {name} says the school trip is cancelled',
  'Your face when {name} asks a question 5 seconds before the bell',
  'Your face when {name} brings the smelliest lunch',
  'Your face when {name} says the teacher just saw your note',
  'Your face when {name} gets picked first in PE',
  'Your face when {name} has to present first',
  'Your face when {name} reminds the teacher about homework',
  'Your face when {name} says school starts tomorrow',
  'Your face when {name} passes the test without studying',
  'Your face when {name} says there\'s pizza in the canteen',
  'Your face when {name} laughs during a serious lesson',
  'Your face when {name} gets a detention',
  'Your face when {name} shows up in the same outfit as the teacher',
  'Your face when {name} says the exam is today, not tomorrow',
  'Your face when {name} gets their report card',
  'Your face when {name} does a speech with zero preparation',
  'Your face when {name} says the fire alarm is a real one',
  'Your face when {name} wins the school talent show',
];

const SCHOOL_IMPOSTOR_PAIRS = [
  ['Your face when you get an A', 'Your face when you get an F'],
  ['Your face during a maths test', 'Your face during a history test'],
  ['Pose like a strict teacher', 'Pose like a school principal'],
  ['Your face when the bell rings', 'Your face when the fire alarm rings'],
  ['Your face when you forget your homework', 'Your face when you forget your lunch'],
  ['Your face in the class photo', 'Your face in your passport photo'],
  ['Your face on the first day of school', 'Your face on the last day of school'],
  ['Pose like the class clown', 'Pose like the class nerd'],
  ['Your face when the teacher calls your name', 'Your face when your parents call your name'],
  ['Your face during PE', 'Your face after running a lap'],
  ['Your face when you eat school lunch', 'Your face when you eat hospital food'],
  ['Pose like you know the answer', 'Pose like you\'re hiding from the teacher'],
  ['Your face when you see the exam questions', 'Your face when you see your exam grade'],
  ['Your face in a boring lesson', 'Your face in a long meeting'],
  ['Pose like a science experiment went wrong', 'Pose like a chemistry explosion'],
  ['Your face when homework is cancelled', 'Your face when school is cancelled'],
  ['Your face when you copy someone\'s homework', 'Your face when someone copies your homework'],
  ['Pose like a student on a school trip', 'Pose like a tourist'],
  ['Your face at a parent-teacher meeting', 'Your face at the dentist'],
  ['Your face when you fall asleep in class', 'Your face when you wake up late for school'],
];

// Mód Snap Hunt — zadání, co mají všichni najít a vyfotit (bez jména hráče,
// bez sad otázek). Hráči můžou fotit zadním foťákem.
const HUNT_PROMPTS = [
  'Something blue',
  'The weirdest thing in your bag or pocket',
  'Your shoes right now',
  'Something older than you',
  'The messiest spot near you',
  'Something round',
  'The coolest thing in the room',
  'Something that makes a noise',
  'Your favourite snack',
  'Something with a face on it (that isn\'t a person)',
  'A tiny thing that looks huge up close',
  'Something that smells amazing',
  'The ugliest thing you can find',
  'Something soft',
  'Something with a number on it',
  'The sky right now',
  'Something that starts with the letter B',
  'Your drink right now',
  'Something shiny',
  'Something that could be a hat',
  'The most random object around you',
  'Something green',
  'A plant (real or fake)',
  'Something you\'d save in a fire',
  'Something that doesn\'t belong where it is',
  'A cable or a charger',
  'Something with stripes',
  'The oldest thing in your wallet or bag',
  'Something that looks like an animal',
  'The best view you can find in 60 seconds',
  'Something red',
  'A spoon, fork or anything you eat with',
  'Something heart-shaped',
  'A book, magazine or anything with words',
  'Your hand doing a cool pose',
  'Something that looks expensive',
  'Something that looks cheap but isn\'t',
  'A light source',
  'Something that\'s a pair',
  'The strangest texture near you',
];

// Žánry Snap Huntu — hostitel vybírá v lobby, co se bude hledat.
// Všechny jsou součástí módu (žádný extra nákup).
const HUNT_HOME_PROMPTS = [
  'The weirdest thing in your fridge',
  'Your pillow',
  'Something in your house that\'s older than you',
  'The most useless thing you own',
  'Your toothbrush',
  'A remote control',
  'Something that shouldn\'t be on the floor',
  'The best mug in the house',
  'Something that belongs to someone else',
  'Your favourite blanket or hoodie',
  'A plant or something green indoors',
  'The messiest drawer you can find',
  'Something with a plug',
  'A photo or picture on the wall',
  'Your comfiest spot at home',
  'Something that makes you laugh',
  'A pair of socks',
  'The biggest spoon you can find',
  'Something you forgot you had',
  'A key',
];

const HUNT_SCHOOL_PROMPTS = [
  'Your pencil case',
  'The most chewed pen you can find',
  'A ruler',
  'Your school bag',
  'The best doodle in your notebook',
  'Something the teacher would confiscate',
  'The clock on the wall',
  'Something with a formula on it',
  'A textbook page with a picture',
  'Your lunch or snack',
  'A rubber or eraser',
  'The weirdest thing in your locker or desk',
  'A water bottle',
  'Something from the science lab',
  'A map or globe',
  'A piece of chalk or a marker',
  'The ugliest handwriting you can find',
  'Your timetable',
  'Something that starts with the first letter of your name',
  'The window view from your classroom',
];

const HUNT_OUTDOORS_PROMPTS = [
  'The coolest leaf you can find',
  'A bird (or anything with wings)',
  'The sky right now',
  'A flower',
  'Something that looks like a face',
  'A funny sign',
  'The tallest thing you can see',
  'A car of your favourite colour',
  'A rock with character',
  'Your shadow',
  'Something wet',
  'A dog (or any animal)',
  'The best tree around',
  'Something someone lost',
  'A puddle, pond or any water',
  'A bench',
  'The most colourful thing outside',
  'Something that moves in the wind',
  'A cloud that looks like something',
  'Your shoes on the ground',
];

const HUNT_PARTY_PROMPTS = [
  'The best drink at this party',
  'Someone\'s most dramatic pose',
  'The snack that\'s disappearing fastest',
  'A group of 3 people doing the same pose',
  'The most sparkly thing here',
  'Someone mid-laugh',
  'The best outfit in the room',
  'Something that shouldn\'t be at a party',
  'A cup with a name on it',
  'The coolest shoes here',
  'The DJ, speaker or whoever controls the music',
  'The best dance move',
  'A balloon, candle or any decoration',
  'Two people high-fiving',
  'The messiest table',
  'The host of the party',
  'Someone\'s phone lock screen (with permission!)',
  'The best hair in the room',
  'A selfie with 3 people',
  'Something that\'s pink',
];

const HUNT_FOOD_PROMPTS = [
  'The weirdest snack you can find',
  'Something sweet',
  'Something spicy',
  'A fruit',
  'A vegetable',
  'The most colourful food near you',
  'Something with cheese',
  'Your favourite cereal or breakfast',
  'A food that looks like a face',
  'Something crunchy',
  'The oldest thing in the fridge',
  'A sauce or ketchup',
  'Something you\'d never eat',
  'Chocolate',
  'Bread in any form',
  'A drink that isn\'t water',
  'The fanciest-looking food around',
  'Something round and edible',
  'A snack with a funny name',
  'Your dream meal (or a picture of it)',
];

const HUNT_PACKS = {
  anywhere: HUNT_PROMPTS,
  home: HUNT_HOME_PROMPTS,
  school: HUNT_SCHOOL_PROMPTS,
  outdoors: HUNT_OUTDOORS_PROMPTS,
  party: HUNT_PARTY_PROMPTS,
  food: HUNT_FOOD_PROMPTS,
};

// Sady otázek, ze kterých hostitel vybírá v lobby (Main Character žádné nemá).
// Spicy, Family a School jsou placené (Question Packs) — hlídá to zatím jen klient.
const PROMPT_PACKS = {
  classic: { prompts: NAME_PROMPTS, pairs: IMPOSTOR_PAIRS },
  spicy: { prompts: SPICY_NAME_PROMPTS, pairs: SPICY_IMPOSTOR_PAIRS },
  family: { prompts: FAMILY_NAME_PROMPTS, pairs: FAMILY_IMPOSTOR_PAIRS },
  school: { prompts: SCHOOL_NAME_PROMPTS, pairs: SCHOOL_IMPOSTOR_PAIRS },
};

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

// ------------------------------------------------------------------ PŘÁTELÉ ---
// Každý hráč má trvalý 6místný kód přítele (vygeneruje si ho telefon).
// Server drží jen kdo je zrovna online a v jaké lobby. Seznam přátel si
// drží každý telefon sám; žádosti pro hráče, co zrovna nejsou online,
// čekají v paměti serveru (restart serveru je smaže).
const FRIEND_CODE_RE = /^[A-Z2-9]{6}$/;

/** @type {Map<string, { code, name, looks, sockets: Set<WebSocket>, lobbyCode: string|null }>} */
const users = new Map();
/** @type {Map<string, object[]>} kód → zprávy, které čekají, až se hráč připojí */
const pendingForUser = new Map();

function isOnline(code) {
  const u = users.get(code);
  return !!u && u.sockets.size > 0;
}

// Pošle zprávu na všechna zařízení hráče; když není online, uloží ji na později.
function sendToUser(code, msg, { queue = false } = {}) {
  const u = users.get(code);
  let sent = false;
  if (u) {
    for (const sock of u.sockets) {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify(msg));
        sent = true;
      }
    }
  }
  if (!sent && queue) {
    const list = pendingForUser.get(code) || [];
    // stejná žádost od stejného hráče se nehromadí
    const dupe = list.find((m) => m.type === msg.type && m.from?.code === msg.from?.code);
    if (!dupe) list.push(msg);
    pendingForUser.set(code, list.slice(-30));
  }
  return sent;
}

function friendStatus(code) {
  const u = users.get(code);
  if (!u || u.sockets.size === 0) return { code, online: false };
  const lobby = u.lobbyCode ? lobbies.get(u.lobbyCode) : null;
  return {
    code,
    online: true,
    name: u.name,
    looks: publicLooks(u),
    lobby: lobby
      ? { code: lobby.code, mode: lobby.mode, phase: lobby.phase, count: lobby.players.size, joinable: lobby.phase === 'lobby' && lobby.players.size < 10 }
      : null,
  };
}

function newLobby(hostId) {
  return {
    hostId,
    mode: 'classic', // classic | draw | caption | impostor | hunt — nastaví se při create_lobby, dál se nemění
    phase: 'lobby', // lobby | submitting | drawing | voting | impostor_voting | subject_photo | captioning | judging | results | gameover
    totalRounds: 5,
    drawEnabled: false,
    drawSeconds: DRAW_SECONDS_DEFAULT,
    round: 0,
    prompt: null,
    usedPrompts: new Set(),
    promptPack: 'classic', // classic | spicy | family | school — sada otázek (Reaction, Doodle, Impostor)
    players: new Map(), // id -> { id, name, score, ws, connected }
    submissions: new Map(), // id -> { photoDataUrl, missed }
    votes: new Map(), // voterId -> targetId
    drawDone: new Set(), // hráči, kteří dokreslili (nebo neměli co)
    cardOrder: [], // shuffled player ids for this round's reveal
    huntSeconds: HUNT_SECONDS_DEFAULT, // Snap Hunt — čas na hledání a vyfocení
    huntPack: 'anywhere', // Snap Hunt — žánr (anywhere | home | school | outdoors | party | food)
    // --- Main character (mode: 'caption') ---
    captionSeconds: CAPTION_SECONDS_DEFAULT, // jediná fáze s časovým limitem — psaní popisků
    subjectOrder: [], // pořadí hráčů, kdo bude objekt fotky, zamíchané při startu hry
    subjectIndex: -1,
    subjectId: null,
    subjectPhoto: null, // { photoDataUrl } | null
    captions: new Map(), // playerId -> text
    captionOrder: [], // zamíchané pořadí id autorů pro anonymní zobrazení při výběru
    // --- Impostor (mode: 'impostor') ---
    impostorId: null,
    lastImpostorId: null,
    civilPrompt: null,
    impostorPrompt: null,
    usedPairs: new Set(),
    gameId: null, // nové id pro každou hru — klient podle něj připíše mince jen jednou
    deadlineAt: null,
    timer: null,
    lastRoundResult: null,
  };
}

function pickPrompt(lobby) {
  const prompts = lobby.mode === 'hunt' ? HUNT_PACKS[lobby.huntPack] : PROMPT_PACKS[lobby.promptPack].prompts;
  const remaining = prompts.filter((t) => !lobby.usedPrompts.has(t));
  const pool = remaining.length ? remaining : prompts;
  const chosen = pool[crypto.randomInt(pool.length)];

  lobby.usedPrompts.add(chosen);
  if (prompts.every((t) => lobby.usedPrompts.has(t))) lobby.usedPrompts.clear();

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
  if (lobby.mode === 'impostor') return startImpostorRound(lobby);
  clearTimer(lobby);
  lobby.round += 1;
  lobby.prompt = pickPrompt(lobby);
  lobby.submissions.clear();
  lobby.votes.clear();
  lobby.drawDone = new Set();
  lobby.cardOrder = [];
  lobby.lastRoundResult = null;
  lobby.phase = 'submitting';
  // Snap Hunt potřebuje víc času — věc se musí najít, ne jen udělat obličej
  const seconds = lobby.mode === 'hunt' ? lobby.huntSeconds : SUBMIT_SECONDS;
  lobby.deadlineAt = Date.now() + seconds * 1000;
  lobby.timer = setTimeout(() => afterSubmitting(lobby), seconds * 1000);
  broadcast(lobby);
}

// ---------------------------------------------------------------- Impostor ---

function startImpostorRound(lobby) {
  clearTimer(lobby);
  lobby.round += 1;

  const pairs = PROMPT_PACKS[lobby.promptPack].pairs;
  const key = (i) => `${lobby.promptPack}:${i}`;
  const remaining = pairs.map((_, i) => i).filter((i) => !lobby.usedPairs.has(key(i)));
  const pool = remaining.length ? remaining : pairs.map((_, i) => i);
  const pairIndex = pool[crypto.randomInt(pool.length)];
  lobby.usedPairs.add(key(pairIndex));
  if (pairs.every((_, i) => lobby.usedPairs.has(key(i)))) lobby.usedPairs.clear();
  const pair = crypto.randomInt(2) === 0 ? pairs[pairIndex] : [...pairs[pairIndex]].reverse();
  lobby.civilPrompt = pair[0];
  lobby.impostorPrompt = pair[1];
  lobby.prompt = null;

  // impostor = náhodný připojený hráč, pokud to jde, ne stejný jako minule
  const active = connectedPlayers(lobby);
  const candidates = active.length > 1 ? active.filter((p) => p.id !== lobby.lastImpostorId) : active;
  lobby.impostorId = candidates[crypto.randomInt(candidates.length)].id;
  lobby.lastImpostorId = lobby.impostorId;

  lobby.submissions.clear();
  lobby.votes.clear();
  lobby.cardOrder = [];
  lobby.lastRoundResult = null;
  lobby.phase = 'submitting';
  lobby.deadlineAt = Date.now() + SUBMIT_SECONDS * 1000;
  lobby.timer = setTimeout(() => afterSubmitting(lobby), SUBMIT_SECONDS * 1000);
  broadcast(lobby);
}

function promptFor(lobby, viewerId) {
  if (lobby.mode !== 'impostor') return lobby.prompt;
  return viewerId === lobby.impostorId ? lobby.impostorPrompt : lobby.civilPrompt;
}

function beginImpostorVoting(lobby) {
  clearTimer(lobby);
  lobby.cardOrder = shuffle(connectedPlayers(lobby).map((p) => p.id));
  lobby.votes.clear();
  lobby.phase = 'impostor_voting';
  lobby.deadlineAt = Date.now() + IMPOSTOR_VOTE_SECONDS * 1000;
  lobby.timer = setTimeout(() => finishImpostorVoting(lobby), IMPOSTOR_VOTE_SECONDS * 1000);
  broadcast(lobby);
}

function maybeAdvanceFromImpostorVoting(lobby) {
  if (lobby.phase !== 'impostor_voting') return;
  const active = connectedPlayers(lobby);
  if (active.length > 0 && active.every((p) => lobby.votes.has(p.id))) finishImpostorVoting(lobby);
}

function finishImpostorVoting(lobby) {
  if (lobby.phase !== 'impostor_voting') return;
  clearTimer(lobby);

  const tally = new Map();
  for (const targetId of lobby.votes.values()) tally.set(targetId, (tally.get(targetId) || 0) + 1);
  const impostorVotes = tally.get(lobby.impostorId) || 0;
  const maxOther = Math.max(0, ...[...tally.entries()].filter(([pid]) => pid !== lobby.impostorId).map(([, v]) => v));
  // Odhalený = má víc hlasů než kdokoli jiný. Remíza nebo nula hlasů = impostor unikl.
  const caught = impostorVotes > 0 && impostorVotes > maxOther;

  for (const p of lobby.players.values()) {
    if (caught && p.id !== lobby.impostorId) {
      p.score += IMPOSTOR_CIV_WIN_POINTS;
      p.coinsEarned = (p.coinsEarned || 0) + COINS_IMPOSTOR_CIV_WIN;
    }
    if (!caught && p.id === lobby.impostorId) {
      p.score += IMPOSTOR_WIN_POINTS;
      p.coinsEarned = (p.coinsEarned || 0) + COINS_IMPOSTOR_WIN;
    }
  }

  const impostor = lobby.players.get(lobby.impostorId);
  lobby.lastRoundResult = {
    kind: 'impostor',
    round: lobby.round,
    impostorId: lobby.impostorId,
    impostorName: impostor ? impostor.name : '???',
    civilPrompt: lobby.civilPrompt,
    impostorPrompt: lobby.impostorPrompt,
    caught,
    civPoints: IMPOSTOR_CIV_WIN_POINTS,
    impostorPoints: IMPOSTOR_WIN_POINTS,
    civCoins: COINS_IMPOSTOR_CIV_WIN,
    impostorCoins: COINS_IMPOSTOR_WIN,
    cards: lobby.cardOrder
      .map((pid) => {
        const player = lobby.players.get(pid);
        const sub = lobby.submissions.get(pid);
        return {
          id: pid,
          name: player ? player.name : '???',
          photoDataUrl: sub?.missed ? null : sub?.photoDataUrl || null,
          missed: !!sub?.missed,
          votes: tally.get(pid) || 0,
          isImpostor: pid === lobby.impostorId,
        };
      })
      .sort((a, b) => (b.isImpostor - a.isImpostor) || (b.votes - a.votes)),
  };

  lobby.phase = 'results';
  lobby.deadlineAt = Date.now() + RESULTS_AUTO_ADVANCE_SECONDS * 1000;
  lobby.timer = setTimeout(() => advanceAfterResults(lobby), RESULTS_AUTO_ADVANCE_SECONDS * 1000);
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
  if (lobby.mode === 'impostor') {
    beginImpostorVoting(lobby);
  } else if (lobby.drawEnabled) {
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
    awardGameCoins(lobby);
    lobby.phase = 'gameover';
    lobby.deadlineAt = null;
    broadcast(lobby);
  } else {
    startRound(lobby);
  }
}

// Spočítá mince za dohranou hru. Server jen řekne kolik — připíše si je
// klient (mince zatím žijí v telefonu), podle gameId jen jednou.
function awardGameCoins(lobby) {
  const sorted = [...lobby.players.values()].sort((a, b) => b.score - a.score);
  let place = 0;
  let lastScore = null;
  for (const p of sorted) {
    if (p.score !== lastScore) {
      place += 1;
      lastScore = p.score;
    }
    const placeCoins = lobby.mode === 'impostor' ? 0 : (COINS_BY_PLACE[place - 1] || 0);
    const roundCoins = p.coinsEarned || 0;
    p.reward = {
      gameId: lobby.gameId,
      participation: COINS_PARTICIPATION,
      place: placeCoins,
      rounds: roundCoins,
      total: COINS_PARTICIPATION + placeCoins + roundCoins,
    };
  }
}

// Vrátí lobby do čekání na start: vynuluje kola, skóre i rozehrané věci.
// Hráči, kteří mezitím odešli, se z lobby vyřadí.
function resetLobbyToWaiting(lobby) {
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
  lobby.impostorId = null;
  lobby.lastImpostorId = null;
  lobby.civilPrompt = null;
  lobby.impostorPrompt = null;
  lobby.usedPairs.clear();
  lobby.gameId = null;
  for (const [pid, p] of lobby.players) {
    if (!p.connected) {
      lobby.players.delete(pid);
      continue;
    }
    p.score = 0;
    p.coinsEarned = 0;
    p.reward = null;
  }
  if (!lobby.players.has(lobby.hostId)) {
    const next = connectedPlayers(lobby)[0];
    if (next) lobby.hostId = next.id;
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
      looks: publicLooks(p),
      friendCode: p.friendCode || null,
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
    huntSeconds: lobby.huntSeconds,
    huntPack: lobby.huntPack,
    promptPack: lobby.promptPack,
    prompt: promptFor(lobby, viewerId),
    // impostor o své roli neví — dozví se ji až ve výsledcích kola
    isImpostor: lobby.mode === 'impostor' && lobby.phase === 'results' && viewerId === lobby.impostorId,
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

  if (lobby.phase === 'impostor_voting') {
    base.cards = lobby.cardOrder.map((pid) => {
      const sub = lobby.submissions.get(pid);
      return {
        id: pid,
        name: lobby.players.get(pid)?.name || '???',
        missed: !!sub?.missed,
        photoDataUrl: sub?.missed ? null : sub?.photoDataUrl || null,
        isOwn: pid === viewerId,
      };
    });
    base.votedCount = lobby.votes.size;
    base.activeCount = connectedPlayers(lobby).length;
    base.youVoted = lobby.votes.has(viewerId);
    base.yourVote = lobby.votes.get(viewerId) || null;
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
    base.reward = lobby.players.get(viewerId)?.reward || null;
  }

  return base;
}

function broadcast(lobby) {
  for (const p of lobby.players.values()) {
    if (p.connected && p.ws && p.ws.readyState === WebSocket.OPEN) {
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

// Bezplatné hostingy (Render apod.) mívají proxy, co tiše zabije spojení bez
// provozu po ~minutě — v dlouhých fázích (psaní popisku, čekání na hlasy)
// se dlouho nic neposílá. Pravidelný ping tomu zabrání a zároveň nám řekne,
// které spojení je opravdu mrtvé (žádný pong), abychom ho mohli uklidit.
const HEARTBEAT_MS = 25_000;

wss.on('connection', (ws) => {
  let isDev = false; // vývojářský režim (ověřený tajný klíč)
  let lobby = null;
  let playerId = null;
  let me = null; // kód přítele tohohle zařízení (po zprávě "hello")

  function setPresenceLobby(code) {
    const u = me && users.get(me);
    if (u) u.lobbyCode = code;
  }

  // Přidá hráče do existující lobby (kódem nebo přes přítele).
  function joinLobby(target, msg) {
    if (!target) return 'No lobby with that code.';
    if (target === lobby && playerId) return null; // už v ní jsem
    if (target.phase !== 'lobby') return 'The game has already started.';
    if (target.players.size >= 10) return 'The lobby is full (max 10 players).';
    if (lobby && playerId) leaveLobby();
    lobby = target;
    playerId = id();
    lobby.players.set(playerId, {
      id: playerId,
      name: (msg.name || 'Player').slice(0, 20),
      looks: sanitizeLooks(msg.looks),
      avatar: sanitizeAvatar(msg.looks),
      friendCode: me,
      score: 0,
      ws,
      connected: true,
    });
    setPresenceLobby(lobby.code);
    broadcast(lobby);
    return null;
  }

  // Odchod z lobby — buď úmyslný (tlačítko zpět), nebo výpadek spojení.
  function detachFromLobby({ leaving }) {
    if (!lobby || !playerId) return;
    const current = lobby;
    const p = current.players.get(playerId);
    // Pokud mezitím hráč stihl obnovit spojení (rejoin) přes nový socket,
    // p.ws už na tenhle (zastaralý) socket neukazuje — nepřepisujeme pak
    // jeho čerstvé "connected: true" tímhle opožděným close eventem.
    if (p && p.ws === ws) {
      if (leaving && current.phase === 'lobby') current.players.delete(playerId);
      else p.connected = false;
      // kdo odešel úmyslně, už nemá dostávat stav téhle hry
      if (leaving) p.ws = null;
    }
    // odešel hostitel → hostitelem se stane další připojený hráč
    if (leaving && current.hostId === playerId) {
      const next = connectedPlayers(current)[0];
      if (next) current.hostId = next.id;
    }
    // Main character: odešel hráč, na kterého se zrovna čeká (fotka / výběr
    // popisku) → kolo se přeskočí, ať hra nezůstane viset
    if (leaving && current.mode === 'caption' && current.subjectId === playerId
        && (current.phase === 'subject_photo' || current.phase === 'judging')) {
      finishCaptionRound(current, { skipped: true });
    }
    if (me && users.get(me)?.lobbyCode === current.code) setPresenceLobby(null);
    lobby = null;
    playerId = null;

    // lobby ve fázi čekání na hráče se po odpojení všech po chvíli sama uklidí
    if (connectedPlayers(current).length === 0) {
      clearTimer(current);
      setTimeout(() => {
        if (connectedPlayers(current).length === 0) lobbies.delete(current.code);
      }, 60_000);
    } else {
      if (current.phase === 'submitting') maybeAdvanceFromSubmitting(current);
      if (current.phase === 'drawing') maybeAdvanceFromDrawing(current);
      if (current.phase === 'voting') maybeAdvanceFromVoting(current);
      if (current.phase === 'captioning') maybeAdvanceFromCaptioning(current);
      if (current.phase === 'impostor_voting') maybeAdvanceFromImpostorVoting(current);
      broadcast(current);
    }
  }

  function leaveLobby() {
    detachFromLobby({ leaving: true });
  }

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'dev_login') {
      isDev = isDevKey(msg.key);
      ws.send(JSON.stringify({ type: isDev ? 'dev_ok' : 'dev_denied' }));
      return;
    }

    if (msg.type === 'dev_add_bot') {
      if (!isDev || !lobby || playerId !== lobby.hostId || lobby.phase !== 'lobby') return;
      if (lobby.players.size >= 10) return sendError(ws, 'The lobby is full.');
      spawnBot(lobby.code, [...lobby.players.values()].map((p) => p.name));
      return;
    }

    if (msg.type === 'hello') {
      const code = String(msg.friendCode || '').toUpperCase();
      if (!FRIEND_CODE_RE.test(code)) return;
      if (me && me !== code) users.get(me)?.sockets.delete(ws);
      me = code;
      const u = users.get(code) || { code, sockets: new Set(), lobbyCode: null };
      u.name = String(msg.name || 'Player').slice(0, 20);
      u.looks = sanitizeLooks(msg.looks);
      u.avatar = sanitizeAvatar(msg.looks);
      u.sockets.add(ws);
      users.set(code, u);
      if (lobby) u.lobbyCode = lobby.code;
      // doručí žádosti / přijetí, které čekaly, než se hráč připojí
      const waiting = pendingForUser.get(code);
      if (waiting) {
        pendingForUser.delete(code);
        for (const m of waiting) ws.send(JSON.stringify(m));
      }
      return;
    }

    if (msg.type === 'friends_status') {
      const codes = Array.isArray(msg.codes) ? msg.codes.slice(0, 200) : [];
      ws.send(JSON.stringify({ type: 'friends_status', friends: codes.map((c) => friendStatus(String(c).toUpperCase())) }));
      return;
    }

    if (msg.type === 'friend_request' && me) {
      const to = String(msg.code || '').toUpperCase();
      if (!FRIEND_CODE_RE.test(to)) return sendError(ws, 'Friend codes have 6 characters.');
      if (to === me) return sendError(ws, 'You can\'t add yourself as a friend.');
      const u = users.get(me);
      sendToUser(to, { type: 'friend_request', from: { code: me, name: u.name, looks: publicLooks(u) } }, { queue: true });
      return;
    }

    if (msg.type === 'friend_accept' && me) {
      const to = String(msg.code || '').toUpperCase();
      if (!FRIEND_CODE_RE.test(to)) return;
      const u = users.get(me);
      sendToUser(to, { type: 'friend_accepted', from: { code: me, name: u.name, looks: publicLooks(u) } }, { queue: true });
      return;
    }

    if (msg.type === 'join_friend') {
      const target = users.get(String(msg.code || '').toUpperCase());
      if (!target || target.sockets.size === 0) return sendError(ws, 'Your friend isn\'t online right now.');
      if (!target.lobbyCode) return sendError(ws, 'Your friend isn\'t in a lobby right now.');
      const err = joinLobby(lobbies.get(target.lobbyCode), msg);
      if (err) sendError(ws, err);
      return;
    }

    if (msg.type === 'leave_lobby') {
      leaveLobby();
      return;
    }

    if (msg.type === 'create_lobby') {
      if (lobby && playerId) leaveLobby();
      const newCode = code();
      lobby = newLobby(null);
      lobby.code = newCode;
      lobby.mode = ['draw', 'caption', 'impostor', 'hunt'].includes(msg.mode) ? msg.mode : 'classic';
      lobby.drawEnabled = lobby.mode === 'draw';
      playerId = id();
      lobby.hostId = playerId;
      lobby.players.set(playerId, {
        id: playerId,
        name: (msg.name || 'Host').slice(0, 20),
        looks: sanitizeLooks(msg.looks),
        avatar: sanitizeAvatar(msg.looks),
        friendCode: me,
        score: 0,
        ws,
        connected: true,
      });
      lobbies.set(newCode, lobby);
      setPresenceLobby(newCode);
      broadcast(lobby);
      return;
    }

    if (msg.type === 'join_lobby') {
      const err = joinLobby(lobbies.get((msg.code || '').toUpperCase()), msg);
      if (err) sendError(ws, err);
      return;
    }

    if (msg.type === 'rejoin') {
      const target = lobbies.get((msg.code || '').toUpperCase());
      if (!target) return sendError(ws, 'That lobby no longer exists.');
      const existing = target.players.get(msg.playerId);
      if (!existing) return sendError(ws, 'Your spot in that lobby is gone.');
      lobby = target;
      playerId = msg.playerId;
      existing.ws = ws;
      existing.connected = true;
      if (msg.looks) {
        existing.looks = sanitizeLooks(msg.looks);
        existing.avatar = sanitizeAvatar(msg.looks);
      }
      if (me) existing.friendCode = me;
      setPresenceLobby(lobby.code);
      broadcast(lobby);
      // pokud se čekalo zrovna na tohohle hráče, zkus fázi posunout dál
      if (lobby.phase === 'submitting') maybeAdvanceFromSubmitting(lobby);
      if (lobby.phase === 'drawing') maybeAdvanceFromDrawing(lobby);
      if (lobby.phase === 'voting') maybeAdvanceFromVoting(lobby);
      if (lobby.phase === 'captioning') maybeAdvanceFromCaptioning(lobby);
      if (lobby.phase === 'impostor_voting') maybeAdvanceFromImpostorVoting(lobby);
      return;
    }

    if (!lobby || !playerId) return;

    if (msg.type === 'invite_friend' && me) {
      const to = String(msg.code || '').toUpperCase();
      const u = users.get(me);
      const ok = sendToUser(to, {
        type: 'invite',
        from: { code: me, name: u.name, looks: publicLooks(u) },
        lobbyCode: lobby.code,
        mode: lobby.mode,
      });
      if (!ok) sendError(ws, 'Your friend isn\'t online right now.');
      return;
    }

    if (msg.type === 'set_rounds' && playerId === lobby.hostId && lobby.phase === 'lobby') {
      const n = Math.max(3, Math.min(20, Number(msg.rounds) || 5));
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

    if (msg.type === 'set_prompt_pack' && playerId === lobby.hostId && lobby.phase === 'lobby' && lobby.mode !== 'caption' && lobby.mode !== 'hunt') {
      if (PROMPT_PACKS[msg.pack]) lobby.promptPack = msg.pack;
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

    if (msg.type === 'set_hunt_settings' && playerId === lobby.hostId && lobby.phase === 'lobby' && lobby.mode === 'hunt') {
      if (HUNT_PACKS[msg.pack]) lobby.huntPack = msg.pack;
      if (msg.seconds != null) {
        lobby.huntSeconds = Math.max(HUNT_SECONDS_MIN, Math.min(HUNT_SECONDS_MAX, Number(msg.seconds) || HUNT_SECONDS_DEFAULT));
      }
      broadcast(lobby);
      return;
    }

    if (msg.type === 'start_game' && playerId === lobby.hostId && lobby.phase === 'lobby') {
      if (connectedPlayers(lobby).length < MIN_PLAYERS) {
        return sendError(ws, `You need at least ${MIN_PLAYERS} players.`);
      }
      lobby.gameId = id();
      for (const p of lobby.players.values()) {
        p.coinsEarned = 0;
        p.reward = null;
      }
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
      if (targetId === playerId) return sendError(ws, 'You can\'t vote for yourself.');
      const targetSub = lobby.submissions.get(targetId);
      if (!targetSub || targetSub.missed) return sendError(ws, 'You can\'t vote for that card.');
      if (!lobby.cardOrder.includes(targetId)) return;
      lobby.votes.set(playerId, targetId);
      broadcast(lobby);
      maybeAdvanceFromVoting(lobby);
      return;
    }

    if (msg.type === 'cast_vote' && lobby.phase === 'impostor_voting') {
      const targetId = msg.targetId;
      if (targetId === playerId) return sendError(ws, 'You can\'t vote for yourself.');
      if (!lobby.cardOrder.includes(targetId)) return;
      lobby.votes.set(playerId, targetId);
      broadcast(lobby);
      maybeAdvanceFromImpostorVoting(lobby);
      return;
    }

    if (msg.type === 'next_round' && playerId === lobby.hostId && lobby.phase === 'results') {
      advanceAfterResults(lobby);
      return;
    }

    if (msg.type === 'play_again' && playerId === lobby.hostId && lobby.phase === 'gameover') {
      resetLobbyToWaiting(lobby);
      broadcast(lobby);
      return;
    }

    // Hostitel ukončí rozehranou hru — všichni se vrátí do lobby, mince
    // za nedohranou hru nikdo nedostane.
    if (msg.type === 'end_game' && playerId === lobby.hostId && lobby.phase !== 'lobby') {
      resetLobbyToWaiting(lobby);
      for (const p of connectedPlayers(lobby)) {
        if (p.id !== playerId && p.ws?.readyState === WebSocket.OPEN) {
          p.ws.send(JSON.stringify({ type: 'info', message: 'The host ended the game.' }));
        }
      }
      broadcast(lobby);
      return;
    }
  });

  ws.on('close', () => {
    if (me) users.get(me)?.sockets.delete(ws);
    detachFromLobby({ leaving: false });
  });
});

const heartbeatTimer = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_MS);

wss.on('close', () => clearInterval(heartbeatTimer));

// ------------------------------------------------------ Boti (dev) ---
// Bot je obyčejný hráč připojený přes WebSocket k tomuhle serveru — hraje
// podle stejných pravidel jako lidi. Fotí jen smajlíka, hlasuje náhodně.

const BOT_NAMES = ['Bot Bob', 'Bot Anna', 'Bot Max', 'Bot Lily', 'Bot Tom', 'Bot Zoe', 'Bot Leo', 'Bot Mia', 'Bot Sam'];
const BOT_CAPTIONS = [
  'When the WiFi password is wrong again', 'Me pretending to understand', 'POV: you just woke up',
  'That face when the pizza arrives', 'Main character energy', 'Plot twist incoming',
  'Trying to look cool, failing', 'Monday morning mood', 'Instant regret', 'When they say "one more game"',
];
const BOT_COLORS = ['#8B5CF6', '#22D3EE', '#F472B6', '#34D399', '#FB923C', '#60A5FA'];

function botPhoto() {
  const bg = BOT_COLORS[crypto.randomInt(BOT_COLORS.length)];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="${bg}"/><circle cx="120" cy="120" r="70" fill="#FDE047"/><circle cx="96" cy="104" r="9" fill="#1F1235"/><circle cx="144" cy="104" r="9" fill="#1F1235"/><path d="M88 138 Q120 168 152 138" stroke="#1F1235" stroke-width="9" fill="none" stroke-linecap="round"/></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

function spawnBot(code, takenNames) {
  const name = BOT_NAMES.find((n) => !takenNames.includes(n)) || `Bot ${crypto.randomInt(100)}`;
  const bws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  const done = new Set(); // co už bot v daném kole udělal (ať nic neposílá dvakrát)
  const later = (key, fn) => {
    if (done.has(key)) return;
    done.add(key);
    setTimeout(() => { if (bws.readyState === WebSocket.OPEN) fn(); }, 800 + crypto.randomInt(1500));
  };
  const out = (obj) => bws.send(JSON.stringify(obj));
  let hostGoneSince = null;

  bws.on('open', () => out({ type: 'join_lobby', code, name, looks: {} }));
  bws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    if (m.type === 'error') return bws.close();
    if (m.type !== 'state') return;
    const r = `${m.round}`;

    // když hostitel zmizí na víc než minutu, bot odejde taky
    const host = (m.players || []).find((p) => p.isHost);
    if (!host || !host.connected) {
      hostGoneSince = hostGoneSince || Date.now();
      if (Date.now() - hostGoneSince > 60000) return bws.close();
    } else hostGoneSince = null;

    if (m.phase === 'submitting' && !m.youSubmitted) later(`photo-${r}`, () => out({ type: 'submit_photo', photoDataUrl: botPhoto() }));
    if (m.phase === 'subject_photo' && m.isSubject) later(`subject-${r}`, () => out({ type: 'submit_photo', photoDataUrl: botPhoto() }));
    if (m.phase === 'drawing' && !m.youDone) later(`draw-${r}`, () => out({ type: 'finish_drawing' }));
    if ((m.phase === 'voting' || m.phase === 'impostor_voting') && !m.youVoted) {
      const options = (m.cards || []).filter((c) => !c.isOwn && !c.missed);
      if (options.length) later(`vote-${m.phase}-${r}`, () => out({ type: 'cast_vote', targetId: options[crypto.randomInt(options.length)].id }));
    }
    if (m.phase === 'captioning' && !m.isSubject && !m.youCaptioned) {
      later(`caption-${r}`, () => out({ type: 'submit_caption', text: BOT_CAPTIONS[crypto.randomInt(BOT_CAPTIONS.length)] }));
    }
    if (m.phase === 'judging' && m.isSubject && m.captionCards?.length) {
      later(`judge-${r}`, () => out({ type: 'pick_caption', authorId: m.captionCards[crypto.randomInt(m.captionCards.length)].id }));
    }
  });
  bws.on('error', () => { /* bot se prostě nepřipojí */ });
  setTimeout(() => bws.close(), 3 * 60 * 60 * 1000); // pojistka: nejdéle 3 hodiny
}

server.listen(PORT, () => {
  console.log(`face-it running on http://localhost:${PORT}`);
});
