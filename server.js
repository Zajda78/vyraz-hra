// "Výraz" — prototyp párty hry: padne věta, všichni se vyfotí s reakcí,
// fotky se odhalí najednou a hlasuje se, čí výraz sedí nejlíp.
// Jednoduchý Node server: statický frontend + WebSocket pro živý stav lobby.
// Stav je jen v paměti procesu (žádná databáze) — restart serveru = konec her.

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');
const PROMPTS_I18N = require('./prompts-i18n'); // otázky v češtině a španělštině
const LANGS = ['en', 'cs', 'es'];

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
const COPY_SECONDS_DEFAULT = 20; // Copycat — čas na napodobení obličeje
const PEEK_SECONDS_DEFAULT = 3; // Copycat — tolik vteřin je vidět originál (nastavuje hostitel)
const PEEK_SECONDS_OPTIONS = [2, 3, 5, 8, 10];
const COPY_WIN_POINTS = 100;
// --- Snap Hunt --- čas na hledání a vyfocení (hostitel vybírá v lobby)
const HUNT_SECONDS_DEFAULT = 60;
const HUNT_SECONDS_MIN = 15;
const HUNT_SECONDS_MAX = 180;

// --- Impostor ---
const MIN_PLAYERS = 3; // většina módů se hraje od 3 hráčů
const MIN_PLAYERS_TWINS = 6; // Twins — od 6 hráčů (aspoň 3 dvojice), přání uživatele
const TWINS_VOTE_SECONDS = 30;
function minPlayersFor(mode) { return mode === 'twins' ? MIN_PLAYERS_TWINS : MIN_PLAYERS; }
const IMPOSTOR_VOTE_SECONDS = 30;
const IMPOSTOR_CIV_WIN_POINTS = 100; // každý z ostatních, když impostora odhalí
const IMPOSTOR_WIN_POINTS = 250; // maximum pro impostora (nikdo ho neuhodl); s každým hlasem klesá

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
  'Your face when {name} replies "ok." to your long message',
  'Your face when {name} spoils the ending of your favourite series',
  'Your face when {name} leaves you on read for 3 days',
  'Your face when {name} posts the ugly photo of you instead of the good one',
  'Your face when {name} laughs at your joke 10 minutes later',
  'Your face when {name} says "I\'m 5 minutes away" and hasn\'t left home yet',
  'Your face when {name} changes your phone language to Chinese',
  'Your face when {name} explains a meme you already understood',
  'Your face when {name} sends you a 7-minute voice message',
  'Your face when {name} borrows your charger and "forgets" to return it',
  'Your face when {name} starts the video call with the camera pointing up their nose',
  'Your face when {name} orders pineapple pizza for everyone',
  'Your face when {name} reveals your childhood nickname',
  'Your face when {name} beats your high score on your own phone',
  'Your face when {name} says "trust me, I know a shortcut"',
  'Your face when {name} sits on your freshly made sandwich',
  'Your face when {name} calls instead of texting',
  'Your face when {name} dances at a wedding like nobody is watching — but everyone is',
  'Your face when {name} uses your toothbrush "just once"',
  'Your face when {name} tells you the milk you just drank expired last month',
  'Your face when {name} puts you on speaker without telling you',
  'Your face when {name} brings their new partner to game night',
  'Your face when {name} wins rock-paper-scissors 10 times in a row',
  'Your face when {name} gives you a haircut "like a pro"',
  'Your face when {name} reads your horoscope out loud and it\'s scarily accurate',
  'Your face when {name} says they\'ve never seen your favourite film',
  'Your face when {name} replies to the group chat with just "?"',
  'Your face when {name} challenges you to eat a spoon of mustard',
  'Your face when {name} starts singing and everyone joins in except you',
  'Your face when {name} tells you your fly has been open all day',
  'Your face when {name} says "we should do this every week"',
  'Your face when {name} gets lost in a shopping centre',
  'Your face when {name} puts salt in your coffee instead of sugar',
  'Your face when {name} shows up to the party in the exact same outfit as you',
  'Your face when {name} tells everyone you cried at a cartoon',
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

// Počet vlastněných skinů (sbírka) — jen nezáporné celé číslo, jinak 0.
function sanitizeOwnedCount(raw) {
  const n = raw && raw.ownedCount;
  return Number.isInteger(n) && n >= 0 && n <= 1000 ? n : 0;
}

// Kódy přátel, které si telefon drží — jen platné kódy, max 200.
function sanitizeFriendCodes(raw) {
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.slice(0, 200).map((c) => String(c).toUpperCase()).filter((c) => /^[A-Z2-9]{6}$/.test(c)));
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
  ['Your face when the Wi-Fi goes down', 'Your face when your phone dies at 1%'],
  ['Pose like a rock star', 'Pose like an opera singer'],
  ['Your face when you step in something wet with socks on', 'Your face when you step on a Lego brick'],
  ['Your face when you smell fresh bread', 'Your face when you smell fresh coffee'],
  ['Pose like a secret agent', 'Pose like a detective'],
  ['Your face when you open a surprise bill', 'Your face when you check your bank account'],
  ['Your face on a plane during turbulence', 'Your face on a boat in big waves'],
  ['Your face when you hear your favourite song', 'Your face when you hear your ringtone in public'],
  ['Pose like a zombie', 'Pose like a vampire'],
  ['Your face when you jump into cold water', 'Your face when you walk out into freezing wind'],
  ['Your face when you pretend to understand', 'Your face when you pretend to listen'],
  ['Your face when the waiter brings the wrong food', 'Your face when your food takes an hour'],
  ['Pose like a yoga teacher', 'Pose like a karate master'],
  ['Your face when you see your old school photo', 'Your face when you hear your own voice recording'],
  ['Your face when you win an argument', 'Your face when you win a race'],
  ['Your face when you taste something delicious', 'Your face when you taste something expensive'],
  ['Pose like a pop star on stage', 'Pose like a DJ at a festival'],
  ['Your face when you get a surprise party', 'Your face when you get a surprise visit'],
  ['Your face when you hear a mosquito at night', 'Your face when you hear an alarm at night'],
  ['Pose like a fashion influencer', 'Pose like a fitness influencer'],
  ['Your face when you find money in your jeans', 'Your face when you find chocolate in your bag'],
  ['Your face when your food is too hot', 'Your face when your drink is too cold'],
  ['Your face when you forget someone\'s name', 'Your face when you forget why you walked into a room'],
  ['Pose like a cowboy', 'Pose like a pirate'],
  ['Your face when you see the price of a concert ticket', 'Your face when you see the price of a coffee at the airport'],
  ['Your face when you hear good news', 'Your face when you hear gossip'],
  ['Your face when you are stuck in traffic', 'Your face when you are stuck in a lift'],
  ['Pose like a news reporter', 'Pose like a weather presenter'],
  ['Your face when you smell smoke', 'Your face when you smell gas'],
  ['Your face when you win at cards', 'Your face when you win at chess'],
  ['Your face when your ice cream falls on the ground', 'Your face when your pizza falls face down'],
  ['Pose like a tired parent', 'Pose like a tired teacher'],
  ['Your face when you see a snake', 'Your face when you see a rat'],
  ['Your face when you get a massage', 'Your face when you get into a hot bath'],
  ['Your face when you hear a baby crying on a plane', 'Your face when someone kicks your seat on a plane'],
  ['Pose like a movie villain', 'Pose like an evil scientist'],
  ['Your face when your phone autocorrects something rude', 'Your face when you send a message to the wrong group'],
  ['Your face when you finally sit down after a long day', 'Your face when you finally take your shoes off'],
  ['Your face when you are about to sneeze', 'Your face when you are about to yawn'],
  ['Pose like a tourist taking a selfie', 'Pose like a paparazzi photographer'],
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
  'Your face when {name} reads your "about me" from your dating app out loud',
  'Your face when {name} asks your crush if they\'re single — for you',
  'Your face when {name} finds your old love poems',
  'Your face when {name} says your ex looked happier with you',
  'Your face when {name} spots you on a date from across the restaurant',
  'Your face when {name} replies to your ex\'s story with fire emojis',
  'Your face when {name} shows everyone your most-used emoji',
  'Your face when {name} says you blush every time a certain someone walks in',
  'Your face when {name} plays your breakup song at the party',
  'Your face when {name} sets you up on a blind date with their cousin',
  'Your face when {name} asks "so what are you two?"',
  'Your face when {name} does an impression of your flirting',
  'Your face when {name} finds out who your phone wallpaper is',
  'Your face when {name} says your last relationship was "a phase"',
  'Your face when {name} starts a rumour that you have a secret admirer',
  'Your face when {name} shows the group your "typing…" that lasted 20 minutes',
  'Your face when {name} asks your date how much they earn',
  'Your face when {name} catches you rehearsing a breakup speech',
  'Your face when {name} leaves a kiss mark on your cheek in front of everyone',
  'Your face when {name} says your crush asked about you',
  'Your face when {name} rates everyone\'s exes out loud',
  'Your face when {name} dares you to call your ex on speaker',
  'Your face when {name} finds a hickey joke in your notes app',
  'Your face when {name} tells your date your real age',
  'Your face when {name} says you\'d be a cute couple — with them',
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
  ['Your face when your date shows up late', 'Your face when your date shows up with their mum'],
  ['Your "I saw that message" face', 'Your "I\'m ignoring you" face'],
  ['Pose like a romantic movie poster', 'Pose like a perfume advert'],
  ['Your face when someone flirts with your partner', 'Your face when someone flirts with you in front of your partner'],
  ['Your face when you get a "u up?" text', 'Your face when you get a "who is this?" text'],
  ['Your face when your crush compliments your outfit', 'Your face when your crush compliments your friend'],
  ['Your face at your ex\'s wedding', 'Your face at your best friend\'s wedding'],
  ['Your face when you\'re about to kiss', 'Your face when you\'re about to sneeze'],
  ['Pose like you\'re proposing', 'Pose like you just got proposed to'],
  ['Your face when your crush says "haha"', 'Your face when your crush says "lol"'],
  ['Your face when you get ghosted', 'Your face when you get friend-zoned'],
  ['Your face when someone steals your seat next to your crush', 'Your face when someone steals your dance partner'],
  ['Your seductive face', 'Your "I just smelled something" face'],
  ['Your face when your parents walk in on your date', 'Your face when your siblings walk in on your date'],
  ['Your face when you realise your date is your friend\'s ex', 'Your face when you realise your date is your teacher\'s kid'],
  ['Your face when your crush sits next to you', 'Your face when your crush touches your hand'],
  ['Your face when you see your ex with someone new', 'Your face when your ex likes your photo'],
  ['Your "I\'m single" face', 'Your "it\'s complicated" face'],
  ['Pose like a romance novel cover', 'Pose like a soap opera star'],
  ['Your face when someone asks for your number', 'Your face when someone asks for your Instagram'],
  ['Your face when your date is really good-looking', 'Your face when your date looks nothing like their photos'],
  ['Your face when you hear your crush is single', 'Your face when you hear your crush is taken'],
  ['Your face during a slow dance', 'Your face during an awkward hug'],
  ['Pose like you\'re on a honeymoon', 'Pose like you\'re on a first date'],
  ['Your face when someone says you\'re their type', 'Your face when someone says you remind them of their mum'],
  ['Your face when you read a flirty text', 'Your face when you write a flirty text'],
  ['Your face when you get caught sending a heart emoji', 'Your face when you get caught deleting a message'],
  ['Your "you look good tonight" face', 'Your "I have a boyfriend/girlfriend" face'],
  ['Your face when your partner forgets your anniversary', 'Your face when your partner forgets your birthday'],
  ['Pose like a bride', 'Pose like a groom'],
  ['Your face when your ex asks to get back together', 'Your face when your ex asks for their stuff back'],
  ['Your face when you meet your partner\'s parents', 'Your face when you meet your partner\'s ex'],
  ['Your face when someone flirts with you at work', 'Your face when someone flirts with you at the gym'],
  ['Your face when you swipe right', 'Your face when you swipe left'],
  ['Pose like a lovesick teenager', 'Pose like a heartbroken poet'],
  ['Your face when you get a rose', 'Your face when you get chocolates'],
  ['Your face when your crush laughs at your joke', 'Your face when your crush ignores your joke'],
  ['Your face at 3am texting your crush', 'Your face at 3am eating in the kitchen'],
  ['Your face when your friends leave you alone with your crush', 'Your face when your friends embarrass you in front of your crush'],
  ['Your face when someone says "you\'re cute"', 'Your face when someone says "you\'re funny"'],
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
  'Your face when {name} says we\'re having pancakes for breakfast',
  'Your face when {name} does a magic trick that goes wrong',
  'Your face when {name} says the cat is sitting on your homework',
  'Your face when {name} builds the tallest block tower ever',
  'Your face when {name} says we\'re going to the beach',
  'Your face when {name} puts ketchup on everything',
  'Your face when {name} wakes you up with a trumpet',
  'Your face when {name} wins hide and seek again',
  'Your face when {name} says the goldfish can talk',
  'Your face when {name} makes the funniest noise ever',
  'Your face when {name} gives you a big bear hug',
  'Your face when {name} says there\'s a monster under the bed',
  'Your face when {name} eats a whole lemon',
  'Your face when {name} brings home a huge watermelon',
  'Your face when {name} dresses up as a dinosaur',
  'Your face when {name} says you can stay up late tonight',
  'Your face when {name} tries to whistle and can\'t',
  'Your face when {name} finds a treasure map',
  'Your face when {name} says the car is out of petrol',
  'Your face when {name} makes a snowman that looks like you',
  'Your face when {name} says it\'s pizza night',
  'Your face when {name} falls asleep during the film',
  'Your face when {name} jumps in a muddy puddle',
  'Your face when {name} says there\'s a surprise in the garden',
  'Your face when {name} shows you a baby photo of themselves',
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
  ['Pose like a lion', 'Pose like a tiger'],
  ['Your face when you blow up a balloon', 'Your face when a balloon pops'],
  ['Pose like an astronaut', 'Pose like an alien'],
  ['Your face when you smell a stinky fart', 'Your face when you smell rotten eggs'],
  ['Pose like a frog', 'Pose like a bunny'],
  ['Your face when you win a medal', 'Your face when you win a trophy'],
  ['Your face when you see a shark', 'Your face when you see a crocodile'],
  ['Pose like a princess', 'Pose like a queen'],
  ['Your face when you eat a marshmallow', 'Your face when you eat candy floss'],
  ['Your face when you go down a big slide', 'Your face when you go on a swing really high'],
  ['Pose like a snowman', 'Pose like a scarecrow'],
  ['Your face when a bee flies near you', 'Your face when a fly lands on your nose'],
  ['Pose like a firefighter', 'Pose like a police officer'],
  ['Your face when you get a hug from grandma', 'Your face when grandma pinches your cheek'],
  ['Your face when you lose a tooth', 'Your face when you find a coin under your pillow'],
  ['Pose like an elephant', 'Pose like a giraffe'],
  ['Your face when you eat a lollipop', 'Your face when you eat popcorn'],
  ['Pose like a mermaid', 'Pose like a fairy'],
  ['Your face when you see a clown', 'Your face when you see a magician'],
  ['Your face when you open a present', 'Your face when you blow out birthday candles'],
  ['Pose like a knight', 'Pose like a ninja'],
  ['Your face when you smell flowers', 'Your face when you smell a cake in the oven'],
  ['Your face when you are scared of the dark', 'Your face when you hear a creaky door'],
  ['Pose like a teddy bear', 'Pose like a panda'],
  ['Your face when you see a butterfly', 'Your face when you see a ladybird'],
  ['Your face when you drink lemonade', 'Your face when you drink hot chocolate'],
  ['Pose like a race car driver', 'Pose like a pilot'],
  ['Your face when you jump on a trampoline', 'Your face when you ride a bike downhill'],
  ['Your face when someone says "boo!"', 'Your face when a jack-in-the-box pops out'],
  ['Pose like a sleepy owl', 'Pose like a busy bee'],
  ['Your face when you eat spaghetti', 'Your face when you eat soup'],
  ['Your face when you build a sandcastle', 'Your face when a wave knocks down your sandcastle'],
  ['Pose like a scary witch', 'Pose like a friendly ghost'],
  ['Your face when you find a puppy', 'Your face when you find a kitten'],
  ['Your face when you have to wait in a long line', 'Your face when you have to sit still'],
  ['Pose like a mummy', 'Pose like a skeleton'],
  ['Your face when you taste medicine', 'Your face when you taste toothpaste'],
  ['Your face when you catch a fish', 'Your face when you catch a ball'],
  ['Pose like a kangaroo', 'Pose like a flamingo'],
  ['Your face when you see Santa', 'Your face when you see the Easter bunny'],
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
  'Your face when {name} says the teacher is collecting homework today',
  'Your face when {name} gets the answer right by pure luck',
  'Your face when {name} spills paint on your art project',
  'Your face when {name} sneezes in the middle of the exam',
  'Your face when {name} asks the teacher for more homework',
  'Your face when {name} says there\'s a new student and it\'s your cousin',
  'Your face when {name} gets caught passing a note',
  'Your face when {name} starts laughing at the class photo',
  'Your face when {name} says the holiday starts tomorrow',
  'Your face when {name} eats your snack while you\'re at the board',
  'Your face when {name} breaks the classroom chair',
  'Your face when {name} gets 100% and brags about it',
  'Your face when {name} says the teacher saw you copying',
  'Your face when {name} brings a frog to biology class',
  'Your face when {name} is the teacher\'s favourite again',
  'Your face when {name} forgets the words in the school play',
  'Your face when {name} says the exam has 40 questions',
  'Your face when {name} wins at dodgeball by themselves',
  'Your face when {name} writes on the board with a squeaky marker',
  'Your face when {name} says you\'re in the same group for the project',
  'Your face when {name} gets their name called on the loudspeaker',
  'Your face when {name} says the teacher is coming back early',
  'Your face when {name} asks what the homework was — for the 5th time',
  'Your face when {name} brings cake for their birthday',
  'Your face when {name} explains maths better than the teacher',
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
  ['Your face when you solve a hard maths problem', 'Your face when you finish a long essay'],
  ['Pose like a scientist', 'Pose like an inventor'],
  ['Your face when the teacher is late', 'Your face when the teacher is absent'],
  ['Your face during a spelling test', 'Your face during a vocabulary test'],
  ['Pose like a school mascot', 'Pose like a cheerleader'],
  ['Your face when you get picked last in PE', 'Your face when you miss the ball in PE'],
  ['Your face when you open your school locker', 'Your face when you open your lunchbox'],
  ['Pose like a librarian', 'Pose like a school cook'],
  ['Your face when you raise your hand and forget the answer', 'Your face when you answer and everyone laughs'],
  ['Your face during a fire drill', 'Your face during a school assembly'],
  ['Your face when you see a pop quiz', 'Your face when you see a group project'],
  ['Pose like a sleepy student on Monday', 'Pose like a happy student on Friday'],
  ['Your face when the bus leaves without you', 'Your face when you miss the school trip'],
  ['Your face when you get a gold star', 'Your face when you get a sticker'],
  ['Pose like you\'re giving a speech', 'Pose like you\'re accepting an award'],
  ['Your face when you get your test back', 'Your face when you get your homework back'],
  ['Pose like a football coach', 'Pose like a referee'],
  ['Your face in a music lesson', 'Your face in an art lesson'],
  ['Your face when the teacher says "open your books"', 'Your face when the teacher says "take out a piece of paper"'],
  ['Pose like a student who didn\'t study', 'Pose like a student who studied all night'],
  ['Your face when the canteen serves fish', 'Your face when the canteen serves soup'],
  ['Your face when you hear the school bell on Friday', 'Your face when you hear the school bell on Monday'],
  ['Pose like a robot in a science fair', 'Pose like a volcano in a science fair'],
  ['Your face when your pen runs out in the exam', 'Your face when your calculator dies in the exam'],
  ['Your face when you have to read out loud', 'Your face when you have to sing in front of the class'],
  ['Pose like a head teacher giving a speech', 'Pose like a coach giving a pep talk'],
  ['Your face when you see your crush in the corridor', 'Your face when you see your teacher in the supermarket'],
  ['Your face in a chemistry lesson', 'Your face in a physics lesson'],
  ['Your face when the whole class gets detention', 'Your face when the whole class gets extra homework'],
  ['Pose like the fastest runner at sports day', 'Pose like the slowest runner at sports day'],
  ['Your face when you forget your PE kit', 'Your face when you forget your pencil case'],
  ['Your face when the teacher reads your essay out loud', 'Your face when the teacher shows your drawing to everyone'],
  ['Pose like a student taking a class photo', 'Pose like a student hiding a phone'],
  ['Your face when the test is easy', 'Your face when the test is impossible'],
  ['Your face when you see snow on a school day', 'Your face when you see sun on a school day'],
  ['Pose like a teacher catching someone cheating', 'Pose like a teacher who lost their glasses'],
  ['Your face at the school disco', 'Your face at the school concert'],
  ['Your face when your friend is absent', 'Your face when your desk partner changes'],
  ['Your face when you get the answer after the bell', 'Your face when you remember the answer after the test'],
  ['Pose like a famous author', 'Pose like a famous painter'],
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
  'Something yellow',
  'Something smaller than your thumb',
  'Something that opens and closes',
  'Something with a logo on it',
  'Something fluffy',
  'Something that has wheels',
  'Something see-through',
  'Something with polka dots or a pattern',
  'Something that looks like a letter of the alphabet',
  'The tallest thing you can reach',
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
  'A spice or herb',
  'The oldest thing in the bathroom',
  'A shoe that isn\'t yours',
  'Something with a battery',
  'A towel',
  'The weirdest ornament or decoration',
  'Something in a jar',
  'A board game or puzzle',
  'A hairbrush or comb',
  'Something that ticks or beeps',
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
  'A calculator',
  'A sticky note',
  'The longest pencil you can find',
  'A paper clip or staple',
  'A poster on the wall',
  'Something with the school logo',
  'A highlighter',
  'The messiest desk',
  'A pair of scissors',
  'A word in another language',
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
  'A pine cone or a seed',
  'A street lamp',
  'A bike',
  'Something red outside',
  'A stick that looks like a wand',
  'A door with a cool colour',
  'An insect (don\'t touch it!)',
  'Graffiti or street art',
  'Something made of wood',
  'The biggest stone you can see',
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
  'Someone doing a thumbs up',
  'The funniest face in the room',
  'An empty plate',
  'Someone wearing glasses',
  'A human pyramid (safely!)',
  'Something glowing',
  'The best dressed person',
  'Someone pretending to be asleep',
  'A hat (or something used as a hat)',
  'A group hug',
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
  'Something sour',
  'A nut or seed',
  'Something from another country',
  'Something frozen',
  'A food that\'s green',
  'Something in a can',
  'The biggest piece of food you can find',
  'Something salty',
  'A food that starts with P',
  'Something you had as a kid',
];

const PROMPT_ARRAY_NAMES = new Map([
  [NAME_PROMPTS, 'NAME_PROMPTS'], [IMPOSTOR_PAIRS, 'IMPOSTOR_PAIRS'],
  [SPICY_NAME_PROMPTS, 'SPICY_NAME_PROMPTS'], [SPICY_IMPOSTOR_PAIRS, 'SPICY_IMPOSTOR_PAIRS'],
  [FAMILY_NAME_PROMPTS, 'FAMILY_NAME_PROMPTS'], [FAMILY_IMPOSTOR_PAIRS, 'FAMILY_IMPOSTOR_PAIRS'],
  [SCHOOL_NAME_PROMPTS, 'SCHOOL_NAME_PROMPTS'], [SCHOOL_IMPOSTOR_PAIRS, 'SCHOOL_IMPOSTOR_PAIRS'],
  [HUNT_PROMPTS, 'HUNT_PROMPTS'], [HUNT_HOME_PROMPTS, 'HUNT_HOME_PROMPTS'], [HUNT_SCHOOL_PROMPTS, 'HUNT_SCHOOL_PROMPTS'],
  [HUNT_OUTDOORS_PROMPTS, 'HUNT_OUTDOORS_PROMPTS'], [HUNT_PARTY_PROMPTS, 'HUNT_PARTY_PROMPTS'], [HUNT_FOOD_PROMPTS, 'HUNT_FOOD_PROMPTS'],
]);

const HUNT_PACKS = {
  anywhere: HUNT_PROMPTS,
  home: HUNT_HOME_PROMPTS,
  school: HUNT_SCHOOL_PROMPTS,
  outdoors: HUNT_OUTDOORS_PROMPTS,
  party: HUNT_PARTY_PROMPTS,
  food: HUNT_FOOD_PROMPTS,
};

// Přeložená verze pole otázek podle jazyka lobby (jazyk hostitele).
// Když překlad chybí nebo nesedí počet vět, zůstane angličtina.
function localize(arr, lang) {
  if (lang === 'en') return arr;
  const name = PROMPT_ARRAY_NAMES.get(arr);
  const t = name && PROMPTS_I18N[lang] && PROMPTS_I18N[lang][name];
  return t && t.length === arr.length ? t : arr;
}

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

// Přátelé jsou vzájemní, když si každý z nich drží kód toho druhého
// (telefony kódy posílají v "hello" a "friends_status"). Jen vzájemní
// přátelé dostanou profilovku a sbírku — ostatní vidí jen rámeček a jméno.
function areMutualFriends(a, b) {
  return !!(a && b && users.get(a)?.friends?.has(b) && users.get(b)?.friends?.has(a));
}

function friendStatus(code, requester) {
  const u = users.get(code);
  const mutual = !!u && areMutualFriends(code, requester);
  // profil přítele: poslední známý vzhled + profilovka + sbírka (i když je offline)
  const profile = mutual ? { looks: publicLooks(u), ownedCount: u.ownedCount || 0 } : null;
  if (!u || u.sockets.size === 0) return profile ? { code, online: false, profile } : { code, online: false };
  const lobby = u.lobbyCode ? lobbies.get(u.lobbyCode) : null;
  const looks = publicLooks(u);
  if (!mutual) looks.avatar = null;
  return {
    code,
    online: true,
    name: u.name,
    looks,
    ...(profile ? { profile } : {}),
    lobby: lobby
      ? { code: lobby.code, mode: lobby.mode, phase: lobby.phase, count: lobby.players.size, joinable: lobby.phase === 'lobby' && lobby.players.size < 10 }
      : null,
  };
}

function newLobby(hostId) {
  return {
    hostId,
    mode: 'classic', // classic | draw | caption | impostor | hunt | copycat | twins — nastaví se při create_lobby, dál se nemění
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
    joinRequests: new Map(), // id žádosti -> { id, name, looks, avatar, accept(), reject(msg) } — čekají na schválení hostitelem
    invited: new Set(), // kódy přátel, které hostitel pozval — ti se připojí bez schvalování
    lang: 'en', // jazyk otázek = jazyk hostitele (en | cs | es)
    huntPack: 'anywhere', // Snap Hunt — žánr (anywhere | home | school | outdoors | party | food)
    // --- Main character (mode: 'caption') ---
    copySeconds: COPY_SECONDS_DEFAULT, // Copycat — čas na kopírování obličeje (pevný)
    peekSeconds: PEEK_SECONDS_DEFAULT, // Copycat — jak dlouho je vidět fotka originálu
    groups: [], // Twins — [{ id: 'A', memberIds: [...] }] pro aktuální kolo
    lastPairKeys: new Set(), // Twins — dvojice z minulého kola (snaha neopakovat)
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
  const prompts = localize(lobby.mode === 'hunt' ? HUNT_PACKS[lobby.huntPack] : PROMPT_PACKS[lobby.promptPack].prompts, lobby.lang);
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
  if (lobby.mode === 'copycat') return startCopyRound(lobby);
  if (lobby.mode === 'twins') lobby.groups = makeTwinGroups(lobby);
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

  const pairs = localize(PROMPT_PACKS[lobby.promptPack].pairs, lobby.lang);
  const key = (i) => `${lobby.promptPack}:${i}`;
  const remaining = pairs.map((_, i) => i).filter((i) => !lobby.usedPairs.has(key(i)));
  const pool = remaining.length ? remaining : pairs.map((_, i) => i);
  const pairIndex = pool[crypto.randomInt(pool.length)];
  lobby.usedPairs.add(key(pairIndex));
  if (pairs.every((_, i) => lobby.usedPairs.has(key(i)))) lobby.usedPairs.clear();
  // Impostor dostane VŽDY úplně jinou, náhodnou otázku z jiné dvojice — nikdy „dvojče“
  // skoro stejné otázky (uživatel chce zadání opravdu náhodná a zamotaná).
  lobby.civilPrompt = pairs[pairIndex][crypto.randomInt(2)];
  const otherIndex = pairs.length > 1
    ? (pairIndex + 1 + crypto.randomInt(pairs.length - 1)) % pairs.length
    : pairIndex;
  lobby.impostorPrompt = pairs[otherIndex][crypto.randomInt(2)];
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
  // Body impostora: čím víc hráčů ho uhodlo, tím míň. Hlasy impostora samotného se nepočítají.
  const correctVotes = [...lobby.votes.entries()].filter(([voter, target]) => voter !== lobby.impostorId && target === lobby.impostorId).length;
  const eligibleVoters = Math.max(correctVotes, connectedPlayers(lobby).filter((p) => p.id !== lobby.impostorId).length);
  const impostorPoints = eligibleVoters > 0
    ? Math.round(IMPOSTOR_WIN_POINTS * (1 - correctVotes / eligibleVoters))
    : IMPOSTOR_WIN_POINTS;

  for (const p of lobby.players.values()) {
    if (caught && p.id !== lobby.impostorId) {
      p.score += IMPOSTOR_CIV_WIN_POINTS;
      p.coinsEarned = (p.coinsEarned || 0) + COINS_IMPOSTOR_CIV_WIN;
    }
    if (p.id === lobby.impostorId) p.score += impostorPoints;
    if (!caught && p.id === lobby.impostorId) {
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
    impostorPoints,
    correctVotes,
    eligibleVoters,
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

// ------------------------------------------------------------- Twins ---
// Hráči se každé kolo náhodně rozdělí na dvojice (u lichého počtu jedna trojice).
// Všichni fotí stejné zadání a snaží se vypadat jako spoluhráč ze skupiny; potom
// se hlasuje pro nejsynchronnější SKUPINU (ne vlastní). Fotky jsou v lobby.submissions.

function twinKey(ids) { return [...ids].sort().join('|'); }

function makeTwinGroups(lobby) {
  const ids = connectedPlayers(lobby).map((p) => p.id);
  let best = null;
  let bestRepeats = Infinity;
  for (let attempt = 0; attempt < 40 && bestRepeats > 0; attempt++) {
    const order = shuffle(ids);
    const groups = [];
    let i = 0;
    while (i < order.length) {
      const size = order.length - i === 3 ? 3 : 2; // zbyde-li 3, vznikne trojice
      groups.push(order.slice(i, i + size));
      i += size;
    }
    const repeats = groups.filter((g) => lobby.lastPairKeys.has(twinKey(g))).length;
    if (repeats < bestRepeats) { best = groups; bestRepeats = repeats; }
  }
  lobby.lastPairKeys = new Set(best.map(twinKey));
  return best.map((memberIds, idx) => ({ id: String.fromCharCode(65 + idx), memberIds }));
}

function twinGroupOf(lobby, pid) {
  return lobby.groups.find((g) => g.memberIds.includes(pid)) || null;
}

function twinGroupPhoto(lobby, g) {
  return g.memberIds.map((pid) => {
    const sub = lobby.submissions.get(pid);
    const player = lobby.players.get(pid);
    return { id: pid, name: player ? player.name : '???', missed: !sub || !!sub.missed, photoDataUrl: !sub || sub.missed ? null : sub.photoDataUrl };
  });
}

// skupina je volitelná, jen když aspoň jeden její člen poslal fotku
function twinGroupVotable(lobby, g) {
  return g.memberIds.some((pid) => lobby.submissions.get(pid) && !lobby.submissions.get(pid).missed);
}

function beginTwinsVoting(lobby) {
  clearTimer(lobby);
  lobby.votes.clear();
  lobby.phase = 'twins_voting';
  lobby.deadlineAt = Date.now() + TWINS_VOTE_SECONDS * 1000;
  lobby.timer = setTimeout(() => finishTwinsVoting(lobby), TWINS_VOTE_SECONDS * 1000);
  broadcast(lobby);
  maybeAdvanceFromTwinsVoting(lobby);
}

function maybeAdvanceFromTwinsVoting(lobby) {
  if (lobby.phase !== 'twins_voting') return;
  const votable = lobby.groups.filter((g) => twinGroupVotable(lobby, g));
  const eligible = connectedPlayers(lobby).filter((p) => {
    const own = twinGroupOf(lobby, p.id);
    return votable.some((g) => g !== own);
  });
  if (eligible.length === 0 || eligible.every((p) => lobby.votes.has(p.id))) finishTwinsVoting(lobby);
}

function finishTwinsVoting(lobby) {
  if (lobby.phase !== 'twins_voting') return;
  clearTimer(lobby);
  const tally = new Map();
  for (const gid of lobby.votes.values()) tally.set(gid, (tally.get(gid) || 0) + 1);

  // husté pořadí skupin: shodné hlasy = shodné místo = shodné body
  const votable = lobby.groups.filter((g) => twinGroupVotable(lobby, g));
  const sorted = votable.map((g) => ({ g, votes: tally.get(g.id) || 0 })).sort((a, b) => b.votes - a.votes);
  const rankById = new Map();
  let rank = 0;
  let lastVotes = null;
  for (const e of sorted) {
    if (e.votes !== lastVotes) { rank += 1; lastVotes = e.votes; }
    rankById.set(e.g.id, rank);
  }
  for (const g of votable) {
    const pts = pointsForRank(rankById.get(g.id));
    for (const pid of g.memberIds) {
      const player = lobby.players.get(pid);
      if (player) player.score += pts;
    }
  }
  const groups = lobby.groups.map((g, idx) => {
    const rnk = rankById.has(g.id) ? rankById.get(g.id) : null;
    return {
      id: g.id,
      index: idx,
      members: twinGroupPhoto(lobby, g),
      votes: tally.get(g.id) || 0,
      rank: rnk,
      points: rnk != null ? pointsForRank(rnk) : 0,
      isWinner: rnk === 1,
    };
  }).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

  lobby.lastRoundResult = { kind: 'twins', round: lobby.round, prompt: lobby.prompt, groups };
  lobby.phase = 'results';
  lobby.deadlineAt = Date.now() + RESULTS_AUTO_ADVANCE_SECONDS * 1000;
  lobby.timer = setTimeout(() => advanceAfterResults(lobby), RESULTS_AUTO_ADVANCE_SECONDS * 1000);
  broadcast(lobby);
}

// ---------------------------------------------------------- Copycat ---
// Originál (subjectId) vyfotí grimasu, ostatní ji 3 s vidí a pak ji zkopírují
// bez pohledu na originál. Kopie se ukládají do lobby.submissions, zamíchané
// pořadí do lobby.captionOrder, originál do lobby.subjectPhoto.

function startCopyRound(lobby) {
  clearTimer(lobby);
  lobby.round += 1;
  lobby.prompt = null;
  lobby.subjectPhoto = null;
  lobby.submissions.clear();
  lobby.captionOrder = [];
  lobby.lastRoundResult = null;

  const subjectId = pickNextSubject(lobby);
  lobby.subjectId = subjectId;
  if (!subjectId) return; // nikdo připojený — hra se pozastaví

  // Čas na fotku originálu je neomezený.
  lobby.phase = 'copy_original';
  lobby.deadlineAt = null;
  broadcast(lobby);
}

function afterCopyOriginal(lobby) {
  if (lobby.phase !== 'copy_original' || !lobby.subjectPhoto) return;
  clearTimer(lobby);
  lobby.phase = 'copy_peek';
  lobby.deadlineAt = Date.now() + lobby.peekSeconds * 1000;
  lobby.timer = setTimeout(() => beginCopying(lobby), lobby.peekSeconds * 1000);
  broadcast(lobby);
}

function beginCopying(lobby) {
  if (lobby.phase !== 'copy_peek') return;
  clearTimer(lobby);
  lobby.phase = 'copy_copying';
  lobby.deadlineAt = Date.now() + lobby.copySeconds * 1000;
  lobby.timer = setTimeout(() => afterCopying(lobby), lobby.copySeconds * 1000);
  broadcast(lobby);
}

function maybeAdvanceFromCopying(lobby) {
  if (lobby.phase !== 'copy_copying') return;
  const eligible = connectedPlayers(lobby).filter((p) => p.id !== lobby.subjectId);
  if (eligible.length > 0 && eligible.every((p) => lobby.submissions.has(p.id))) afterCopying(lobby);
}

function afterCopying(lobby) {
  if (lobby.phase !== 'copy_copying') return;
  clearTimer(lobby);
  for (const p of connectedPlayers(lobby)) {
    if (p.id !== lobby.subjectId && !lobby.submissions.has(p.id)) {
      lobby.submissions.set(p.id, { photoDataUrl: null, missed: true });
    }
  }
  const real = [...lobby.submissions.entries()].filter(([, sub]) => !sub.missed).map(([pid]) => pid);
  if (real.length === 0) {
    finishCopyRound(lobby, {});
    return;
  }
  lobby.captionOrder = shuffle(real);
  lobby.phase = 'copy_pick';
  lobby.deadlineAt = null;
  broadcast(lobby);
}

function finishCopyRound(lobby, { winnerId = null, skipped = false } = {}) {
  clearTimer(lobby);
  if (winnerId) {
    const winner = lobby.players.get(winnerId);
    if (winner) winner.score += COPY_WIN_POINTS;
  }
  const copies = [...lobby.submissions.entries()].map(([pid, sub]) => {
    const player = lobby.players.get(pid);
    return {
      id: pid,
      name: player ? player.name : '???',
      photoDataUrl: sub.missed ? null : sub.photoDataUrl,
      missed: !!sub.missed,
      isWinner: pid === winnerId,
    };
  });
  const subjectPlayer = lobby.players.get(lobby.subjectId);
  lobby.lastRoundResult = {
    kind: 'copycat',
    round: lobby.round,
    subjectId: lobby.subjectId,
    subjectName: subjectPlayer ? subjectPlayer.name : '???',
    photoDataUrl: lobby.subjectPhoto ? lobby.subjectPhoto.photoDataUrl : null,
    copies,
    winnerId,
    points: winnerId ? COPY_WIN_POINTS : 0,
    skipped,
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
  } else if (lobby.mode === 'twins') {
    beginTwinsVoting(lobby);
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
    lobby.groups = [];
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
  // usedPrompts / usedPairs se schválně NEmažou — v další hře stejné lobby
  // nepřijdou znovu ty samé otázky (sady se vyprázdní samy, až se vystřídají všechny)
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
  lobby.groups = [];
  lobby.lastPairKeys = new Set();
  lobby.lastRoundResult = null;
  lobby.deadlineAt = null;
  lobby.impostorId = null;
  lobby.lastImpostorId = null;
  lobby.civilPrompt = null;
  lobby.impostorPrompt = null;
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
      isBot: !!p.isBot,
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
    copySeconds: lobby.copySeconds,
    peekSeconds: lobby.peekSeconds,
    huntSeconds: lobby.huntSeconds,
    huntPack: lobby.huntPack,
    promptPack: lobby.promptPack,
    prompt: promptFor(lobby, viewerId),
    // impostor o své roli neví při focení — dozví se ji při hlasování (jen on sám) a ve výsledcích
    isImpostor: lobby.mode === 'impostor' && (lobby.phase === 'results' || lobby.phase === 'impostor_voting') && viewerId === lobby.impostorId,
    players,
    youId: viewerId,
    isHost: viewerId === lobby.hostId,
    deadlineAt: lobby.deadlineAt,
  };

  // žádosti o připojení vidí jen hostitel
  if (viewerId === lobby.hostId && lobby.phase === 'lobby') {
    base.joinRequests = [...lobby.joinRequests.values()].map((r) => ({
      id: r.id, name: r.name, looks: { ...r.looks, avatar: r.avatar },
    }));
  }

  if (lobby.phase === 'submitting') {
    base.submittedCount = lobby.submissions.size;
    base.activeCount = connectedPlayers(lobby).length;
    base.youSubmitted = lobby.submissions.has(viewerId);
  }

  if (lobby.mode === 'twins' && (lobby.phase === 'submitting' || lobby.phase === 'twins_voting')) {
    const mine = twinGroupOf(lobby, viewerId);
    base.myGroup = mine ? { id: mine.id, index: lobby.groups.indexOf(mine) } : null;
    base.twins = mine ? mine.memberIds.filter((pid) => pid !== viewerId).map((pid) => ({ id: pid, name: lobby.players.get(pid)?.name || '???' })) : [];
    if (lobby.phase === 'twins_voting') {
      base.twinGroups = lobby.groups.map((g, i) => ({
        id: g.id,
        index: i,
        isOwn: g === mine,
        votable: twinGroupVotable(lobby, g),
        members: twinGroupPhoto(lobby, g),
      }));
      base.votedCount = lobby.votes.size;
      base.activeCount = connectedPlayers(lobby).length;
      base.youVoted = lobby.votes.has(viewerId);
      base.yourVote = lobby.votes.get(viewerId) || null;
    }
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
    // zadání obou stran vidí jen impostor
    if (viewerId === lobby.impostorId) {
      base.civilPrompt = lobby.civilPrompt;
      base.impostorPrompt = lobby.impostorPrompt;
    }
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

  if (lobby.mode === 'copycat' && lobby.phase.startsWith('copy_')) {
    const isSubject = viewerId === lobby.subjectId;
    base.subjectId = lobby.subjectId;
    base.subjectName = lobby.players.get(lobby.subjectId)?.name || '???';
    base.isSubject = isSubject;
    // originál se neposílá při kopírování; v peeku jen ostatním, v pick všem
    if (lobby.phase === 'copy_pick' || (lobby.phase === 'copy_peek' && !isSubject)) {
      base.subjectPhotoDataUrl = lobby.subjectPhoto ? lobby.subjectPhoto.photoDataUrl : null;
    }
    if (lobby.phase === 'copy_copying') {
      base.submittedCount = lobby.submissions.size;
      base.activeCount = connectedPlayers(lobby).filter((p) => p.id !== lobby.subjectId).length;
      base.youSubmitted = lobby.submissions.has(viewerId);
    }
    if (lobby.phase === 'copy_pick') {
      base.copyCards = lobby.captionOrder.map((pid) => ({ id: pid, photoDataUrl: lobby.submissions.get(pid)?.photoDataUrl || null }));
    }
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
  let pendingJoin = null; // { lobby, id } — čekám, až mě hostitel pustí dovnitř
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
      isBot: msg.botKey === BOT_JOIN_KEY, // bot z vývojářského režimu (jde přejmenovat)
    });
    setPresenceLobby(lobby.code);
    broadcast(lobby);
    return null;
  }

  // Žádost o připojení: hostitel ji musí schválit. Bez schvalování se
  // připojí jen boti a přátelé, které hostitel sám pozval.
  function requestJoin(target, msg) {
    if (!target) return 'No lobby with that code.';
    if (target === lobby && playerId) return null;
    if (target.phase !== 'lobby') return 'The game has already started.';
    if (target.players.size >= 10) return 'The lobby is full (max 10 players).';
    if (msg.botKey === BOT_JOIN_KEY || (me && target.invited.has(me))) return joinLobby(target, msg);
    cancelPendingJoin();
    const reqId = id();
    const name = (msg.name || 'Player').slice(0, 20);
    target.joinRequests.set(reqId, {
      id: reqId,
      name,
      looks: sanitizeLooks(msg.looks),
      avatar: sanitizeAvatar(msg.looks),
      accept: () => {
        pendingJoin = null;
        const err = joinLobby(target, msg);
        if (err) ws.send(JSON.stringify({ type: 'join_denied', message: err }));
      },
      reject: (message) => {
        pendingJoin = null;
        ws.send(JSON.stringify({ type: 'join_denied', message }));
      },
    });
    pendingJoin = { lobby: target, id: reqId };
    const host = target.players.get(target.hostId);
    ws.send(JSON.stringify({ type: 'join_pending', code: target.code, hostName: host ? host.name : '' }));
    broadcast(target);
    return null;
  }

  function cancelPendingJoin() {
    if (!pendingJoin) return;
    const { lobby: target, id: reqId } = pendingJoin;
    pendingJoin = null;
    if (target.joinRequests.delete(reqId)) broadcast(target);
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
    if (leaving && current.mode === 'copycat' && current.subjectId === playerId
        && (current.phase === 'copy_original' || current.phase === 'copy_pick')) {
      finishCopyRound(current, { skipped: true });
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
      if (current.phase === 'twins_voting') maybeAdvanceFromTwinsVoting(current);
      if (current.phase === 'captioning') maybeAdvanceFromCaptioning(current);
      if (current.phase === 'copy_copying') maybeAdvanceFromCopying(current);
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

    // hráč, kterého hostitel vyhodil, už v lobby není — zapomenout ji (ať se může znovu přihlásit)
    if (lobby && playerId && !lobby.players.has(playerId)) { lobby = null; playerId = null; }

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

    if (msg.type === 'dev_rename_bot') {
      if (!isDev || !lobby || playerId !== lobby.hostId) return;
      const bot = lobby.players.get(msg.playerId);
      const name = String(msg.name || '').trim().slice(0, 20);
      if (!bot || !bot.isBot || !name) return;
      bot.name = name;
      broadcast(lobby);
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
      u.ownedCount = sanitizeOwnedCount(msg.looks);
      if (Array.isArray(msg.friends)) u.friends = sanitizeFriendCodes(msg.friends);
      else if (!u.friends) u.friends = new Set();
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
      const mine = me && users.get(me);
      if (mine) mine.friends = sanitizeFriendCodes(codes); // dotaz zároveň říká, koho mám v přátelích
      ws.send(JSON.stringify({ type: 'friends_status', friends: codes.map((c) => friendStatus(String(c).toUpperCase(), me)) }));
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
      const err = requestJoin(lobbies.get(target.lobbyCode), msg);
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
      lobby.mode = ['draw', 'caption', 'impostor', 'hunt', 'copycat', 'twins'].includes(msg.mode) ? msg.mode : 'classic';
      lobby.lang = LANGS.includes(msg.lang) ? msg.lang : 'en';
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

    if (msg.type === 'cancel_join') {
      cancelPendingJoin();
      return;
    }

    if (msg.type === 'join_lobby') {
      const err = requestJoin(lobbies.get((msg.code || '').toUpperCase()), msg);
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
      if (lobby.phase === 'copy_copying') maybeAdvanceFromCopying(lobby);
      if (lobby.phase === 'impostor_voting') maybeAdvanceFromImpostorVoting(lobby);
      return;
    }

    if (!lobby || !playerId) return;

    // hostitel pustí / nepustí čekajícího hráče dovnitř
    if ((msg.type === 'approve_join' || msg.type === 'deny_join') && playerId === lobby.hostId) {
      const req = lobby.joinRequests.get(msg.id);
      if (!req) return;
      lobby.joinRequests.delete(msg.id);
      if (msg.type === 'deny_join') req.reject('The host didn\'t let you in.');
      else if (lobby.phase !== 'lobby') req.reject('The game has already started.');
      else if (lobby.players.size >= 10) req.reject('The lobby is full (max 10 players).');
      else req.accept();
      broadcast(lobby);
      return;
    }

    // hostitel vyhodí hráče z lobby (jen před začátkem hry)
    if (msg.type === 'kick_player' && playerId === lobby.hostId && lobby.phase === 'lobby' && msg.playerId !== playerId) {
      const p = lobby.players.get(msg.playerId);
      if (!p) return;
      lobby.players.delete(msg.playerId);
      if (p.ws && p.ws.readyState === WebSocket.OPEN) p.ws.send(JSON.stringify({ type: 'kicked', code: lobby.code }));
      if (p.friendCode) {
        lobby.invited.delete(p.friendCode);
        const u = users.get(p.friendCode);
        if (u && u.lobbyCode === lobby.code) u.lobbyCode = null;
      }
      broadcast(lobby);
      return;
    }

    if (msg.type === 'invite_friend' && me) {
      const to = String(msg.code || '').toUpperCase();
      const u = users.get(me);
      if (FRIEND_CODE_RE.test(to)) lobby.invited.add(to);
      const ok = sendToUser(to, {
        type: 'invite',
        from: { code: me, name: u.name, looks: publicLooks(u) },
        lobbyCode: lobby.code,
        mode: lobby.mode,
      });
      if (!ok) sendError(ws, 'Your friend isn\'t online right now.');
      return;
    }

    // hostitel přepnul jazyk → další otázky v novém jazyce
    if (msg.type === 'set_lang' && playerId === lobby.hostId && LANGS.includes(msg.lang)) {
      lobby.lang = msg.lang;
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

    if (msg.type === 'set_prompt_pack' && playerId === lobby.hostId && lobby.phase === 'lobby' && lobby.mode !== 'caption' && lobby.mode !== 'hunt' && lobby.mode !== 'copycat') {
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

    if (msg.type === 'set_copy_settings' && playerId === lobby.hostId && lobby.phase === 'lobby' && lobby.mode === 'copycat') {
      const sec = Number(msg.seconds);
      if (PEEK_SECONDS_OPTIONS.includes(sec)) lobby.peekSeconds = sec; // hostitel volí, jak dlouho je vidět originál
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
      const minPlayers = minPlayersFor(lobby.mode);
      if (connectedPlayers(lobby).length < minPlayers) {
        return sendError(ws, `You need at least ${minPlayers} players.`);
      }
      // kdo ještě čekal na schválení, už se nepřipojí
      for (const req of lobby.joinRequests.values()) req.reject('The game has already started.');
      lobby.joinRequests.clear();
      lobby.gameId = id();
      for (const p of lobby.players.values()) {
        p.coinsEarned = 0;
        p.reward = null;
      }
      if (lobby.mode === 'caption' || lobby.mode === 'copycat') {
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

    if (msg.type === 'submit_photo' && lobby.phase === 'copy_original' && playerId === lobby.subjectId) {
      if (typeof msg.photoDataUrl === 'string' && msg.photoDataUrl.startsWith('data:image/')) {
        lobby.subjectPhoto = { photoDataUrl: msg.photoDataUrl };
        afterCopyOriginal(lobby);
      }
      return;
    }

    if (msg.type === 'submit_photo' && lobby.phase === 'copy_copying' && playerId !== lobby.subjectId) {
      if (typeof msg.photoDataUrl === 'string' && msg.photoDataUrl.startsWith('data:image/')) {
        if (lobby.submissions.has(playerId)) return;
        lobby.submissions.set(playerId, { photoDataUrl: msg.photoDataUrl, missed: false });
        broadcast(lobby);
        maybeAdvanceFromCopying(lobby);
      }
      return;
    }

    if (msg.type === 'pick_copy' && lobby.phase === 'copy_pick' && playerId === lobby.subjectId) {
      if (!lobby.captionOrder.includes(msg.authorId)) return;
      finishCopyRound(lobby, { winnerId: msg.authorId });
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

    if (msg.type === 'cast_vote' && lobby.phase === 'twins_voting') {
      const g = lobby.groups.find((x) => x.id === msg.targetId);
      const mine = twinGroupOf(lobby, playerId);
      if (!g || !mine) return;
      if (g === mine) return sendError(ws, "You can't vote for your own group.");
      if (!twinGroupVotable(lobby, g)) return sendError(ws, "You can't vote for that card.");
      lobby.votes.set(playerId, g.id);
      broadcast(lobby);
      maybeAdvanceFromTwinsVoting(lobby);
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
    cancelPendingJoin(); // zavřené spojení = zrušená žádost o připojení
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
// Boti se připojují bez schválení hostitelem — prokážou se tímhle klíčem,
// který existuje jen v paměti serveru (při každém startu jiný).
const BOT_JOIN_KEY = crypto.randomBytes(16).toString('hex');
// Bot je obyčejný hráč připojený přes WebSocket k tomuhle serveru — hraje
// podle stejných pravidel jako lidi. Fotí jen smajlíka, hlasuje náhodně.

const BOT_NAMES = ['Bot Bob', 'Bot Anna', 'Bot Max', 'Bot Lily', 'Bot Tom', 'Bot Zoe', 'Bot Leo', 'Bot Mia', 'Bot Sam'];
const BOT_CAPTIONS = [
  'When the WiFi password is wrong again', 'Me pretending to understand', 'POV: you just woke up',
  'That face when the pizza arrives', 'Main character energy', 'Plot twist incoming',
  'Trying to look cool, failing', 'Monday morning mood', 'Instant regret', 'When they say "one more game"',
];
const BOT_COLORS = ['#8B5CF6', '#22D3EE', '#F472B6', '#34D399', '#FB923C', '#60A5FA'];

// Skiny pro boty: id rámečků a barev jmen se vytáhnou přímo z public/shop.js
// (ať se nové skiny přidají samy) — server ten skript nespouští, jen čte text.
function loadBotSkins() {
  const skins = { frame: [], name: [] };
  try {
    const src = require('fs').readFileSync(path.join(__dirname, 'public', 'shop.js'), 'utf8');
    for (const m of src.matchAll(/id:\s*'((frame|name)-[a-z0-9-]{1,26})'/g)) {
      if (!skins[m[2]].includes(m[1])) skins[m[2]].push(m[1]);
    }
  } catch { /* bez shop.js boti prostě nemají skiny */ }
  return skins;
}
const BOT_SKINS = loadBotSkins();
// ~15 % botů nemá rámeček / barvu jména, ať to působí přirozeně
function botLooks() {
  const pick = (list) => (list.length && crypto.randomInt(100) >= 15 ? list[crypto.randomInt(list.length)] : null);
  return sanitizeLooks({ frame: pick(BOT_SKINS.frame), name: pick(BOT_SKINS.name) });
}

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

  bws.on('open', () => out({ type: 'join_lobby', code, name, looks: botLooks(), botKey: BOT_JOIN_KEY }));
  bws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    if (m.type === 'error' || m.type === 'kicked') return bws.close();
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
    if (m.phase === 'copy_original' && m.isSubject) later(`corig-${r}`, () => out({ type: 'submit_photo', photoDataUrl: botPhoto() }));
    if (m.phase === 'copy_copying' && !m.isSubject && !m.youSubmitted) later(`ccopy-${r}`, () => out({ type: 'submit_photo', photoDataUrl: botPhoto() }));
    if (m.phase === 'copy_pick' && m.isSubject && m.copyCards?.length) {
      later(`cpick-${r}`, () => out({ type: 'pick_copy', authorId: m.copyCards[crypto.randomInt(m.copyCards.length)].id }));
    }
    if (m.phase === 'drawing' && !m.youDone) later(`draw-${r}`, () => out({ type: 'finish_drawing' }));
    if (m.phase === 'twins_voting' && !m.youVoted) {
      const options = (m.twinGroups || []).filter((g) => !g.isOwn && g.votable);
      if (options.length) later(`tvote-${r}`, () => out({ type: 'cast_vote', targetId: options[crypto.randomInt(options.length)].id }));
    }
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
