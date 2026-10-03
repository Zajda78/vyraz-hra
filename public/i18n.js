// Jazyky aplikace — angličtina (výchozí text v kódu), čeština, španělština.
// Kód zůstává psaný anglicky; tenhle soubor po každém vykreslení projde texty
// na obrazovce a nahradí je podle slovníku (MutationObserver). Díky tomu se
// přeloží i hlášky, toasty a okna, aniž by se musel měnit každý řádek kódu.
// Jména hráčů, názvy módů a skinů a otázky ze serveru se nepřekládají tady
// (otázky překládá server podle jazyka hostitele).
// Nový text ve hře = přidat řádek do DICT (a případně PATTERNS) níže.

const LANGS = [
  { id: 'en', label: 'English' },
  { id: 'cs', label: 'Čeština' },
  { id: 'es', label: 'Español' },
];

function getLang() {
  try {
    const saved = localStorage.getItem('vyraz_lang');
    if (saved && LANGS.some((l) => l.id === saved)) return saved;
  } catch { /* ignore */ }
  // poprvé podle jazyka telefonu
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return ['cs', 'sk'].includes(nav) ? 'cs' : nav === 'es' ? 'es' : 'en';
}

// Czech plural: 1 hlas / 2–4 hlasy / 5+ hlasů
function csPlural(n, one, few, many) {
  n = Math.abs(Number(n));
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}
const esPlural = (n, one, many) => (Math.abs(Number(n)) === 1 ? one : many);

// ------------------------------------------------------------ slovník ---
// [angličtina, čeština, španělština]
const DICT_ROWS = [
  // QR přidání přátel (friendqr.js)
  ['My QR code', 'Můj QR kód', 'Mi código QR'],
  ['Scan QR', 'Skenovat QR', 'Escanear QR'],
  ['Share', 'Sdílet', 'Compartir'],
  ['Link copied', 'Odkaz zkopírován', 'Enlace copiado'],
  ['Add friend?', 'Přidat přítele?', '¿Añadir amigo?'],
  ['Send friend request', 'Poslat žádost o přátelství', 'Enviar solicitud de amistad'],
  ['Friend request sent!', 'Žádost o přátelství odeslána!', '¡Solicitud de amistad enviada!'],
  ['That\'s your own QR code.', 'To je tvůj vlastní QR kód.', 'Ese es tu propio código QR.'],
  ['Couldn\'t access the camera.', 'Nepodařilo se získat přístup ke kameře.', 'No se pudo acceder a la cámara.'],
  // obecné
  ['Connecting to the server…', 'Připojuji se k serveru…', 'Conectando con el servidor…'],
  ['Games', 'Hry', 'Juegos'],
  // dárkový odkaz (gift.js)
  ['Frame', 'Rámeček', 'Marco'],
  ['You got a gift!', 'Máš dárek!', '¡Tienes un regalo!'],
  ['You already claimed this gift.', 'Tento dárek už jsi vyzvedl.', 'Ya reclamaste este regalo.'],
  ["Gift links don't work in dev mode.", 'Dárkové odkazy ve vývojářském režimu nefungují.', 'Los enlaces de regalo no funcionan en modo desarrollador.'],
  ['Shop', 'Obchod', 'Tienda'],
  ['Friends', 'Přátelé', 'Amigos'],
  ['Settings', 'Nastavení', 'Ajustes'],
  ['Rules', 'Pravidla', 'Reglas'],
  ['Close', 'Zavřít', 'Cerrar'],
  ['Cancel', 'Zrušit', 'Cancelar'],
  ['Back', 'Zpět', 'Atrás'],
  ['Back to home', 'Zpět na úvod', 'Volver al inicio'],
  ['Continue', 'Pokračovat', 'Continuar'],
  ['Join a game', 'Připoj se ke hře', 'Únete a una partida'],
  ["What's your name?", 'Jak se jmenuješ?', '¿Cómo te llamas?'],
  ['e.g. Alex', 'např. Alex', 'p. ej. Alex'],
  ['Please enter a name.', 'Zadej prosím jméno.', 'Escribe un nombre.'],
  ['Enter', 'Potvrdit', 'Entrar'],
  ['FREE GAMES', 'HRY ZDARMA', 'JUEGOS GRATIS'],
  ['PARTY PACK', 'PARTY PACK', 'PARTY PACK'],
  ['React to the prompt — best face wins', 'Reaguj na zadání — vyhraje nejlepší výraz', 'Reacciona a la frase — gana la mejor cara'],
  ['One photo, everyone captions it', 'Jedna fotka, všichni k ní píšou popisek', 'Una foto, todos le ponen un pie'],
  ['Snap a selfie, doodle on it, vote', 'Vyfoť se, pokresli fotku, hlasuj', 'Hazte un selfie, dibuja encima y vota'],
  ['One player got a different prompt', 'Jeden hráč dostal jiné zadání', 'Un jugador recibió otra frase'],
  ['A task drops — like "something blue". Hunt it down, snap it and vote for the best shot.', 'Padne úkol — třeba „něco modrého“. Najdi to, vyfoť a hlasuj pro nejlepší fotku.', 'Aparece una misión, como «algo azul». Encuéntralo, hazle una foto y vota la mejor.'],
  ['NEW', 'NOVÉ', 'NUEVO'],
  ['Your name is', 'Jmenuješ se', 'Te llamas'],
  ['Set your name', 'Nastav si jméno', 'Ponte un nombre'],
  ['Open profile', 'Otevřít profil', 'Abrir perfil'],
  // odchod ze hry
  ['Leave the game?', 'Odejít ze hry?', '¿Salir de la partida?'],
  ['Leave game', 'Odejít ze hry', 'Salir de la partida'],
  ['End game for everyone', 'Ukončit hru pro všechny', 'Terminar la partida para todos'],
  ['Keep playing', 'Hrát dál', 'Seguir jugando'],
  // nastavení
  ['Allow camera access', 'Povolit kameru', 'Permitir la cámara'],
  ['Asking your browser for access…', 'Žádám prohlížeč o přístup…', 'Pidiendo acceso al navegador…'],
  ['Camera is allowed and working.', 'Kamera je povolená a funguje.', 'La cámara está permitida y funciona.'],
  ["Couldn't access the camera. Check the camera permission for this site in your phone settings.", 'Kamera nejde spustit. Zkontroluj oprávnění kamery pro tuhle stránku v nastavení telefonu.', 'No se pudo usar la cámara. Revisa el permiso de cámara de este sitio en los ajustes del móvil.'],
  ['Music', 'Hudba', 'Música'],
  ['Sounds', 'Zvuky', 'Sonidos'],
  ['Language', 'Jazyk', 'Idioma'],
  // pravidla
  ['How to play', 'Jak se hraje', 'Cómo se juega'],
  ['The host creates a lobby and shares the code with friends — you need at least 3 players.', 'Hostitel založí lobby a pošle kód kamarádům — potřebujete aspoň 3 hráče.', 'El anfitrión crea una sala y comparte el código con sus amigos; hacen falta al menos 3 jugadores.'],
  ['Each round a prompt drops about a random player in the lobby. The host picks the question pack — Classic, Spicy, Family or School.', 'Každé kolo padne zadání o náhodném hráči z lobby. Hostitel vybírá sadu otázek — Klasika, Pikantní, Rodina nebo Škola.', 'Cada ronda aparece una frase sobre un jugador al azar de la sala. El anfitrión elige el paquete de preguntas: Clásico, Picante, Familia o Escuela.'],
  ['Everyone has 30 seconds to snap their reaction.', 'Všichni mají 30 vteřin na vyfocení své reakce.', 'Todos tienen 30 segundos para fotografiar su reacción.'],
  ['Miss it and you get a sad face instead of a photo — "Too slow!!".', 'Kdo to nestihne, má místo fotky smutný obličej — „Too slow!!“.', 'Si no llegas, en vez de foto sale una cara triste: «¡Muy lento!».'],
  ['All photos are revealed at once and you vote for the best one — no voting for yourself.', 'Všechny fotky se odhalí najednou a hlasuje se pro nejlepší — pro sebe hlasovat nejde.', 'Todas las fotos se muestran a la vez y votáis la mejor; no puedes votarte a ti mismo.'],
  ['Points by ranking — 1st place gets 100 pts, the rest a little less. Same votes = same points.', 'Body podle pořadí — 1. místo dostane 100 bodů, ostatní o něco méně. Stejně hlasů = stejně bodů.', 'Puntos según el puesto: el 1.º recibe 100, el resto un poco menos. Mismos votos = mismos puntos.'],
  ['After the last round, whoever has the most points wins.', 'Po posledním kole vyhrává ten, kdo má nejvíc bodů.', 'Tras la última ronda gana quien tenga más puntos.'],
  ['Then you get a moment to doodle on your photo with your finger (the host sets how long).', 'Pak máš chvilku na dokreslení do fotky prstem (jak dlouho, určí hostitel).', 'Después tienes un momento para dibujar en tu foto con el dedo (el anfitrión decide cuánto).'],
  ['Each round a different player is the main character — everyone gets a turn.', 'Každé kolo je hlavní postavou jiný hráč — na každého dojde.', 'Cada ronda un jugador distinto es el protagonista; a todos les toca.'],
  ['The main character snaps a photo, with no time limit.', 'Hlavní postava se vyfotí, bez časového limitu.', 'El protagonista se hace una foto, sin límite de tiempo.'],
  ['Everyone else writes a funny caption for it (the host sets the time).', 'Ostatní k ní napíšou vtipný popisek (čas určí hostitel).', 'Los demás le escriben un pie de foto gracioso (el anfitrión decide el tiempo).'],
  ['The main character reads the captions anonymously and picks the best one.', 'Hlavní postava si popisky anonymně přečte a vybere nejlepší.', 'El protagonista lee los pies de foto de forma anónima y elige el mejor.'],
  ['The author of the winning caption gets 100 pts.', 'Autor vítězného popisku dostane 100 bodů.', 'El autor del pie ganador recibe 100 puntos.'],
  ['The host creates a lobby, shares the code — you need at least 3 players — and picks the question pack: Classic, Spicy, Family or School.', 'Hostitel založí lobby, pošle kód — potřebujete aspoň 3 hráče — a vybere sadu otázek: Klasika, Pikantní, Rodina nebo Škola.', 'El anfitrión crea una sala, comparte el código (hacen falta al menos 3 jugadores) y elige el paquete: Clásico, Picante, Familia o Escuela.'],
  ['Each round everyone gets the same photo prompt, except one random player — the impostor — who gets a completely different random one.', 'Každé kolo dostanou všichni stejné zadání, kromě jednoho náhodného hráče — impostora — který dostane úplně jiné, náhodné.', 'Cada ronda todos reciben la misma frase, excepto un jugador al azar — el impostor — que recibe otra totalmente distinta y al azar.'],
  ['Everyone has 30 seconds to snap a photo.', 'Všichni mají 30 vteřin na vyfocení.', 'Todos tienen 30 segundos para hacer la foto.'],
  ['Each round a task drops — like "something blue" or "the weirdest thing in your bag". The host picks what to hunt: Anywhere, Home, School, Outdoors, Party or Food.', 'Každé kolo padne úkol — třeba „něco modrého“ nebo „nejdivnější věc v tašce“. Hostitel vybere, co se hledá: Kdekoli, Doma, Škola, Venku, Párty nebo Jídlo.', 'Cada ronda aparece una misión, como «algo azul» o «lo más raro de tu bolso». El anfitrión elige qué buscar: Donde sea, Casa, Escuela, Al aire libre, Fiesta o Comida.'],
  ['Everyone hunts it down and snaps a photo before time runs out (the host sets how long). The back camera is on — tap the flip button for a selfie.', 'Všichni to najdou a vyfotí, než vyprší čas (jak dlouho, určí hostitel). Zapne se zadní foťák — pro selfie klepni na tlačítko otočení.', 'Todos lo buscan y le hacen una foto antes de que acabe el tiempo (el anfitrión decide cuánto). Se usa la cámara trasera; toca el botón de girar para un selfie.'],
  // lobby
  ['(you)', '(ty)', '(tú)'],
  ['Host', 'Hostitel', 'Anfitrión'],
  ['Add friend', 'Přidat přítele', 'Añadir amigo'],
  ['Remove from lobby', 'Vyhodit z lobby', 'Echar de la sala'],
  ['Question pack', 'Sada otázek', 'Paquete de preguntas'],
  ['Doodle time', 'Čas na kreslení', 'Tiempo para dibujar'],
  ['What to hunt', 'Co se hledá', 'Qué buscar'],
  ['Hunt time', 'Čas na hledání', 'Tiempo de búsqueda'],
  ['Caption time', 'Čas na popisky', 'Tiempo para escribir'],
  ['Rounds', 'Kola', 'Rondas'],
  ['Start game', 'Spustit hru', 'Empezar partida'],
  ['Invite friends', 'Pozvat přátele', 'Invitar amigos'],
  ['Add bot', 'Přidat bota', 'Añadir bot'],
  ['Classic', 'Klasika', 'Clásico'],
  ['Spicy', 'Pikantní', 'Picante'],
  ['Family', 'Rodina', 'Familia'],
  ['School', 'Škola', 'Escuela'],
  ['Anywhere', 'Kdekoli', 'Donde sea'],
  ['Home', 'Doma', 'Casa'],
  ['Outdoors', 'Venku', 'Afuera'],
  ['Party', 'Párty', 'Fiesta'],
  ['Food', 'Jídlo', 'Comida'],
  ['Waiting for the host', 'Čeká se na hostitele', 'Esperando al anfitrión'],
  ['The host has to let you in', 'Hostitel tě musí pustit dovnitř', 'El anfitrión tiene que dejarte entrar'],
  ['Let in', 'Pustit', 'Dejar entrar'],
  ['Decline', 'Odmítnout', 'Rechazar'],
  ['Remove', 'Odebrat', 'Quitar'],
  ['Remove from lobby', 'Vyhodit z lobby', 'Echar de la sala'],
  ['The host removed you from the lobby.', 'Hostitel tě vyhodil z lobby.', 'El anfitrión te ha echado de la sala.'],
  // focení a hra
  ['Flip camera', 'Otočit foťák', 'Girar cámara'],
  ['Take photo', 'Vyfotit', 'Hacer foto'],
  ["Couldn't access the camera.", 'Kamera nejde spustit.', 'No se pudo usar la cámara.'],
  ['Check your browser permissions.', 'Zkontroluj oprávnění prohlížeče.', 'Revisa los permisos del navegador.'],
  ['Photo sent!', 'Fotka odeslána!', '¡Foto enviada!'],
  ['Waiting for the others…', 'Čeká se na ostatní…', 'Esperando a los demás…'],
  ["You're the main character! Snap yourself — everyone else will caption what's going on.", 'Jsi hlavní postava! Vyfoť se — ostatní napíšou, co se na fotce děje.', '¡Eres el protagonista! Hazte una foto y los demás escribirán qué está pasando.'],
  ['Everyone is captioning your photo…', 'Všichni píšou popisky k tvé fotce…', 'Todos están escribiendo sobre tu foto…'],
  ['Caption sent!', 'Popisek odeslán!', '¡Pie de foto enviado!'],
  ['e.g. Just watched the bus leave without him…', 'např. Právě mu ujel autobus…', 'p. ej. Acaba de ver cómo se le escapa el autobús…'],
  ['Send caption', 'Odeslat popisek', 'Enviar pie de foto'],
  ['Write a caption first.', 'Nejdřív napiš popisek.', 'Primero escribe un pie de foto.'],
  ['Pick the best caption for your photo.', 'Vyber nejlepší popisek ke své fotce.', 'Elige el mejor pie para tu foto.'],
  ['Nobody wrote a caption in time.', 'Nikdo nestihl napsat popisek.', 'Nadie escribió a tiempo.'],
  ['Clear', 'Smazat', 'Borrar'],
  ['Done', 'Hotovo', 'Listo'],
  ['Nothing to doodle this time', 'Tentokrát není do čeho kreslit', 'Esta vez no hay nada que dibujar'],
  ['Doodle done!', 'Dokresleno!', '¡Dibujo listo!'],
  ['Too slow!!', 'Moc pomalé!!', '¡¡Muy lento!!'],
  ["Yours – can't vote", 'Tvoje – nelze hlasovat', 'Tuya: no puedes votar'],
  ['Vote sent.', 'Hlas odeslán.', 'Voto enviado.'],
  ['Show final results', 'Ukázat konečné výsledky', 'Ver resultados finales'],
  ['Next round', 'Další kolo', 'Siguiente ronda'],
  ['Waiting for the host to start the next round…', 'Čeká se, až hostitel spustí další kolo…', 'Esperando a que el anfitrión empiece la siguiente ronda…'],
  ['Scoreboard', 'Pořadí', 'Clasificación'],
  ['Copy the face, best copy wins', 'Napodob obličej, vyhraje nejlepší kopie', 'Copia la cara, gana la mejor copia'],
  ['Find the thing, snap it, vote', 'Najdi věc, vyfoť ji, hlasuj', 'Encuentra la cosa, fotografíala, vota'],
  ['Copy time', 'Čas na kopírování', 'Tiempo para copiar'],
  ['Copy the face of', 'Napodob obličej hráče', 'Copia la cara de'],
  ['Memorise it!', 'Zapamatuj si to!', '¡Memorízala!'],
  ['is striking a pose…', 'se staví do pózy…', 'está posando…'],
  ['Strike a pose — the crazier, the better!', 'Postav se do pózy — čím bláznivější, tím lepší!', '¡Pon una pose: cuanto más loca, mejor!'],
  ['The others are memorising your face…', 'Ostatní si pamatují tvůj obličej…', 'Los demás están memorizando tu cara…'],
  ['Everyone is copying your face…', 'Všichni kopírují tvůj obličej…', 'Todos están copiando tu cara…'],
  ['Pick the best copy of your face.', 'Vyber nejlepší kopii svého obličeje.', 'Elige la mejor copia de tu cara.'],
  ['is picking the best copy…', 'vybírá nejlepší kopii…', 'está eligiendo la mejor copia…'],
  ['picked the best copy', 'vybral(a) nejlepší kopii', 'eligió la mejor copia'],
  ['Nobody sent a copy in time — no points.', 'Nikdo neposlal kopii včas — žádné body.', 'Nadie envió una copia a tiempo: sin puntos.'],
  ['Each round a different player is the original — everyone gets a turn.', 'Každé kolo je originálem jiný hráč — každý přijde na řadu.', 'Cada ronda un jugador distinto es el original: todos tienen su turno.'],
  ['The original snaps a selfie with a crazy face or pose, with no time limit.', 'Originál se vyfotí s bláznivým obličejem nebo pózou, bez časového limitu.', 'El original se hace un selfie con una cara o pose loca, sin límite de tiempo.'],
  ['Everyone else sees it for a few seconds to memorise it (the host sets how long).', 'Ostatní ho uvidí jen pár vteřin, aby si ho zapamatovali (jak dlouho, určí hostitel).', 'Los demás lo ven unos segundos para memorizarlo (el anfitrión decide cuánto).'],
  ['Then the photo disappears and you have 20 seconds to copy it from memory with your own selfie.', 'Pak fotka zmizí a ty máš 20 vteřin, abys ji z paměti napodobil(a) vlastním selfie.', 'Luego la foto desaparece y tienes 20 segundos para copiarla de memoria con tu selfie.'],
  ['The original picks the best copy anonymously — its author gets 100 pts.', 'Originál anonymně vybere nejlepší kopii — její autor dostane 100 bodů.', 'El original elige la mejor copia de forma anónima: su autor gana 100 puntos.'],
  ['Nobody wrote a caption in time — no points.', 'Nikdo nestihl napsat popisek — žádné body.', 'Nadie escribió a tiempo: sin puntos.'],
  ['For finishing', 'Za dohrání', 'Por terminar'],
  ['For your place', 'Za umístění', 'Por tu puesto'],
  ['For rounds won', 'Za vyhraná kola', 'Por rondas ganadas'],
  ['Play again', 'Hrát znovu', 'Jugar otra vez'],
  ['Main menu', 'Hlavní menu', 'Menú principal'],
  ['Waiting for the host to start a new game…', 'Čeká se, až hostitel spustí novou hru…', 'Esperando a que el anfitrión empiece otra partida…'],
  ['Final standings', 'Konečné pořadí', 'Clasificación final'],
  ['The host ended the game.', 'Hostitel ukončil hru.', 'El anfitrión terminó la partida.'],
  // impostor
  ['While taking the photo, nobody knows who the impostor is — not even the impostor!', 'Při focení nikdo neví, kdo je impostor — ani impostor sám!', 'Mientras se hace la foto, nadie sabe quién es el impostor, ¡ni siquiera él!'],
  ['When the photos appear, the impostor finds out and sees both prompts. Then you have 30 seconds to vote for who you think the impostor is.', 'Když se objeví fotky, impostor se to dozví a uvidí obě zadání. Pak máte 30 vteřin na hlasování, kdo je podle vás impostor.', 'Cuando aparecen las fotos, el impostor se entera y ve ambas consignas. Luego tenéis 30 segundos para votar quién creéis que es el impostor.'],
  ['The impostor gets points based on how many players guess them: nobody guesses → 250 pts, everybody guesses → 0 pts.', 'Impostor dostane body podle toho, kolik hráčů ho uhodne: nikdo → 250 bodů, všichni → 0 bodů.', 'El impostor recibe puntos según cuántos jugadores lo adivinan: nadie → 250 puntos, todos → 0 puntos.'],
  ['If the impostor gets the most votes, everyone else wins: +100 pts and +3 coins each.', 'Když impostor dostane nejvíc hlasů, vyhrávají ostatní: každý +100 bodů a +3 mince.', 'Si el impostor recibe más votos, ganan los demás: +100 puntos y +3 monedas cada uno.'],
  ['If they escape (a tie counts too), the impostor also gets +10 coins.', 'Když unikne (i remíza se počítá), impostor navíc dostane +10 mincí.', 'Si escapa (el empate también cuenta), el impostor también recibe +10 monedas.'],
  ["You're the impostor! Don't get caught.", 'Jsi impostor! Nenech se chytit.', '¡Eres el impostor! Que no te pillen.'],
  ['You had', 'Ty jsi měl(a)', 'Tú tenías'],
  ['Nobody guessed the impostor', 'Impostora nikdo neuhodl', 'Nadie adivinó al impostor'],
  ['You were caught… no points this time', 'Chytili tě… tentokrát bez bodů', 'Te pillaron… esta vez sin puntos'],
  ['Someone got a different prompt — could it be you?', 'Někdo dostal jiné zadání — nejsi to ty?', 'Alguien recibió otra frase… ¿serás tú?'],
  ['Vote sent (you can change it).', 'Hlas odeslán (můžeš ho změnit).', 'Voto enviado (puedes cambiarlo).'],
  ['Impostor caught!', 'Impostor chycen!', '¡Impostor atrapado!'],
  ['The impostor escaped!', 'Impostor unikl!', '¡El impostor escapó!'],
  ['Surprise — you were the impostor, and they caught you!', 'Překvapení — byl jsi impostor a chytili tě!', 'Sorpresa: eras el impostor ¡y te pillaron!'],
  ['Surprise — you were the impostor, and you got away!', 'Překvapení — byl jsi impostor a unikl jsi!', 'Sorpresa: eras el impostor ¡y te escapaste!'],
  ['You won this round', 'Tohle kolo jsi vyhrál', 'Has ganado esta ronda'],
  ['You lost this round', 'Tohle kolo jsi prohrál', 'Has perdido esta ronda'],
  ['IMPOSTOR', 'IMPOSTOR', 'IMPOSTOR'],
  ['Everyone had', 'Všichni měli', 'Todos tenían'],
  ['Impostor had', 'Impostor měl', 'El impostor tenía'],
  // obchod
  ['Free', 'Zdarma', 'Gratis'],
  ['Chests', 'Truhly', 'Cofres'],
  ['Packs', 'Balíčky', 'Packs'],
  ['COINS', 'MINCE', 'MONEDAS'],
  ['Coins', 'Mince', 'Monedas'],
  ['Inventory', 'Inventář', 'Inventario'],
  ['1 item', '1 věc', '1 objeto'],
  ["What's inside", 'Co je uvnitř', 'Qué contiene'],
  ["What's on the wheel", 'Co je na kole', 'Qué hay en la ruleta'],
  ['Popular', 'Oblíbené', 'Popular'],
  ['Best value', 'Nejvýhodnější', 'Mejor precio'],
  ['No ads', 'Bez reklam', 'Sin anuncios'],
  ['Forever', 'Navždy', 'Para siempre'],
  ["Payments aren't live yet — this is a prototype.", 'Platby zatím nefungují — tohle je prototyp.', 'Los pagos aún no funcionan: esto es un prototipo.'],
  ['Spooky Chest', 'Strašidelná truhla', 'Cofre terrorífico'],
  ['Party Chest', 'Párty truhla', 'Cofre de fiesta'],
  ['Frame Chest', 'Truhla rámečků', 'Cofre de marcos'],
  ['Name Chest', 'Truhla jmen', 'Cofre de nombres'],
  ['Legendary Chest', 'Legendární truhla', 'Cofre legendario'],
  ['Open', 'Otevřít', 'Abrir'],
  ['This chest is no longer available.', 'Tahle truhla už není k dispozici.', 'Este cofre ya no está disponible.'],
  ['Not enough coins.', 'Nemáš dost mincí.', 'No tienes suficientes monedas.'],
  ['New!', 'Nové!', '¡Nuevo!'],
  ['Equip', 'Nasadit', 'Equipar'],
  ['Equipped', 'Nasazeno', 'Equipado'],
  ['Default', 'Výchozí', 'Por defecto'],
  ['Back to shop', 'Zpět do obchodu', 'Volver a la tienda'],
  ['Photo frames', 'Rámečky fotek', 'Marcos de foto'],
  ['Name color', 'Barva jména', 'Color del nombre'],
  ['Common', 'Běžné', 'Común'],
  ['Rare', 'Vzácné', 'Raro'],
  ['Epic', 'Epické', 'Épico'],
  ['Legendary', 'Legendární', 'Legendario'],
  ['Mythic', 'Mýtické', 'Mítico'],
  ['Open a chest in the shop', 'Otevři truhlu v obchodě', 'Abre un cofre en la tienda'],
  // denní odměny a kolo
  ['Daily Coins', 'Denní mince', 'Monedas diarias'],
  ['Lucky Wheel', 'Kolo štěstí', 'Ruleta de la suerte'],
  ['Daily Ticket', 'Denní vstupenka', 'Entrada diaria'],
  ['1 free game of any Party Pack mode', '1 hra libovolného módu z Party Packu zdarma', '1 partida gratis de cualquier modo del Party Pack'],
  ['Claim', 'Vyzvednout', 'Reclamar'],
  ['Spin', 'Zatočit', 'Girar'],
  ['Watch ad', 'Pustit reklamu', 'Ver anuncio'],
  ['Watch ad to spin', 'Zatočit za reklamu', 'Ver anuncio para girar'],
  ['Free ticket! Play one game of any Party Pack mode', 'Vstupenka zdarma! Zahraj si jednu hru libovolného módu z Party Packu', '¡Entrada gratis! Juega una partida de cualquier modo del Party Pack'],
  ['Ad', 'Reklama', 'Anuncio'],
  ['Your ad here', 'Tady bude reklama', 'Tu anuncio aquí'],
  ['Claim reward', 'Vyzvednout odměnu', 'Reclamar premio'],
  ['Game Ticket', 'Vstupenka na hru', 'Entrada de juego'],
  ['Ticket', 'Vstupenka', 'Entrada'],
  ['TICKET', 'VSTUP', 'ENTRADA'],
  ['FRAME', 'RÁMEČEK', 'MARCO'],
  ['NAME', 'JMÉNO', 'NOMBRE'],
  ['Jackpot!', 'Jackpot!', '¡Premio gordo!'],
  ['New! Only from the Lucky Wheel', 'Nové! Jen z kola štěstí', '¡Nuevo! Solo en la ruleta'],
  ['Spin again', 'Zatočit znovu', 'Girar otra vez'],
  ['Wheel only', 'Jen z kola', 'Solo en la ruleta'],
  // nabídky
  ['Party Pack', 'Party Pack', 'Party Pack'],
  ['Question Packs', 'Sady otázek', 'Paquetes de preguntas'],
  ['FREE', 'ZDARMA', 'GRATIS'],
  ['PARTY', 'PARTY', 'PARTY'],
  ['PARTY PACK', 'PARTY PACK', 'PARTY PACK'],
  ['Owned', 'Vlastníš', 'Tuyo'],
  ['More new modes', 'Další nové módy', 'Más modos nuevos'],
  ['bonus coins', 'mincí navíc', 'monedas extra'],
  ['Modes unlocked forever', 'Módy odemčené navždy', 'Modos desbloqueados para siempre'],
  ['Everyone in your lobby plays free', 'Všichni v tvém lobby hrají zdarma', 'Todos en tu sala juegan gratis'],
  ['The original prompts', 'Původní otázky', 'Las preguntas originales'],
  ['Flirty, awkward & embarrassing', 'Flirt, trapasy a ostuda', 'Coqueteo, momentos incómodos y vergüenza'],
  ['Fun for all ages', 'Zábava pro všechny věkové kategorie', 'Diversión para todas las edades'],
  ['Teachers, tests & classmates', 'Učitelé, písemky a spolužáci', 'Profes, exámenes y compañeros'],
  ['New questions for Reaction, Doodle & Impostor', 'Nové otázky pro Reaction, Doodle a Impostor', 'Preguntas nuevas para Reaction, Doodle e Impostor'],
  ['Play once', 'Zahrát jednou', 'Jugar una vez'],
  ['or forever', 'nebo navždy', 'o para siempre'],
  // přátelé
  ['Player', 'Hráč', 'Jugador'],
  ['Friend codes have 6 characters.', 'Kód přítele má 6 znaků.', 'Los códigos de amigo tienen 6 caracteres.'],
  ["You can't add yourself as a friend.", 'Sám sebe si do přátel přidat nemůžeš.', 'No puedes añadirte a ti mismo.'],
  ["You're already friends.", 'Už jste přátelé.', 'Ya sois amigos.'],
  ['Friend request sent', 'Žádost o přátelství odeslána', 'Solicitud de amistad enviada'],
  ['Offline', 'Offline', 'Desconectado'],
  ['View profile', 'Zobrazit profil', 'Ver perfil'],
  ['Photo frame', 'Rámeček fotky', 'Marco de foto'],
  ['SKINS', 'SKINY', 'SKINS'],
  ['skins', 'skinů', 'skins'],
  ['Online', 'Online', 'En línea'],
  ['Join', 'Připojit', 'Unirse'],
  ['Remove friend', 'Odebrat přítele', 'Eliminar amigo'],
  ['Accept', 'Přijmout', 'Aceptar'],
  ['FRIEND REQUESTS', 'ŽÁDOSTI O PŘÁTELSTVÍ', 'SOLICITUDES DE AMISTAD'],
  ['PENDING', 'ČEKÁ', 'PENDIENTE'],
  ['Friend code', 'Kód přítele', 'Código de amigo'],
  ['Your friend code', 'Tvůj kód přítele', 'Tu código de amigo'],
  ['Copy', 'Kopírovat', 'Copiar'],
  ['Add', 'Přidat', 'Añadir'],
  ['FRIENDS', 'PŘÁTELÉ', 'AMIGOS'],
  ['Code copied', 'Kód zkopírován', 'Código copiado'],
  ['No friends yet. Send a friend your code, or add them from a lobby.', 'Zatím nemáš přátele. Pošli kamarádovi svůj kód nebo si ho přidej z lobby.', 'Aún no tienes amigos. Envía tu código a un amigo o añádelo desde una sala.'],
  ['No more friends to invite.', 'Už nemáš koho pozvat.', 'No quedan amigos por invitar.'],
  ['Invited', 'Pozván', 'Invitado'],
  ['Invite', 'Pozvat', 'Invitar'],
  // profil
  ['Profile', 'Profil', 'Perfil'],
  ['Collection', 'Sbírka', 'Colección'],
  ['Photo shown for', 'Fotka se ukáže na', 'La foto se ve durante'],
  ['Photo of', 'Fotka hráče', 'Foto de'],
  ['Edit look', 'Upravit vzhled', 'Editar aspecto'],
  ['Edit profile', 'Upravit profil', 'Editar perfil'],
  ['Change photo', 'Změnit fotku', 'Cambiar foto'],
  ['Add photo', 'Přidat fotku', 'Añadir foto'],
  ['Your name', 'Tvoje jméno', 'Tu nombre'],
  ['Selfie', 'Selfie', 'Selfie'],
  ['Save name', 'Uložit jméno', 'Guardar nombre'],
  ['Profile photo updated', 'Profilová fotka změněna', 'Foto de perfil actualizada'],
  ["Couldn't load that image.", 'Obrázek se nepodařilo načíst.', 'No se pudo cargar la imagen.'],
  ['No name', 'Bez jména', 'Sin nombre'],
  ['Name', 'Jméno', 'Nombre'],
  // hlášky serveru
  ['No lobby with that code.', 'Lobby s tímhle kódem neexistuje.', 'No hay ninguna sala con ese código.'],
  ['The game has already started.', 'Hra už začala.', 'La partida ya ha empezado.'],
  ['The lobby is full (max 10 players).', 'Lobby je plné (max. 10 hráčů).', 'La sala está llena (máx. 10 jugadores).'],
  ['The lobby is full.', 'Lobby je plné.', 'La sala está llena.'],
  ["Your friend isn't online right now.", 'Tvůj přítel teď není online.', 'Tu amigo no está conectado ahora.'],
  ["Your friend isn't in a lobby right now.", 'Tvůj přítel teď není v žádném lobby.', 'Tu amigo no está en ninguna sala ahora.'],
  ['That lobby no longer exists.', 'Tohle lobby už neexistuje.', 'Esa sala ya no existe.'],
  ['Your spot in that lobby is gone.', 'Tvoje místo v tom lobby už není.', 'Tu sitio en esa sala ya no existe.'],
  ["The host didn't let you in.", 'Hostitel tě nepustil dovnitř.', 'El anfitrión no te dejó entrar.'],
  ["You can't vote for yourself.", 'Pro sebe hlasovat nemůžeš.', 'No puedes votarte a ti mismo.'],
  ["You can't vote for that card.", 'Pro tuhle kartu hlasovat nemůžeš.', 'No puedes votar esa carta.'],
  ['Developer mode on', 'Vývojářský režim zapnut', 'Modo desarrollador activado'],
  ['Rename bot', 'Přejmenovat bota', 'Renombrar bot'],
  ['Bot name', 'Jméno bota', 'Nombre del bot'],
  ['PHOTO FRAMES', 'RÁMEČKY FOTEK', 'MARCOS DE FOTO'],
  ['NAME COLOR', 'BARVA JMÉNA', 'COLOR DEL NOMBRE'],
  ['Waiting for', 'Čeká se na hráče', 'Esperando a'],
  ['to snap a photo…', '— až se vyfotí…', 'para que se haga una foto…'],
  ['picked the best caption', 'vybral(a) nejlepší popisek', 'eligió el mejor pie de foto'],
  ['wins the game!', 'vyhrává hru!', 'gana la partida!'],
  ['win the game!', 'vyhrávají hru!', 'ganan la partida!'],
  ['1st', '1.', '1.º'],
  ['2nd', '2.', '2.º'],
  ['3rd', '3.', '3.º'],
];

// Texty poskládané z více částí (čísla, jména) — regulární výraz na celý text.
// Funkce dostane nalezené části a vrátí překlad.
const PATTERNS = [
  [/^(\d+) of (\d+) guessed the impostor$/, (m, lang) => (lang === 'cs' ? `${m[1]} z ${m[2]} uhodli impostora` : `${m[1]} de ${m[2]} adivinaron al impostor`)],
  [/^\+(\d+) pts$/, (m, lang) => (lang === 'cs' ? `+${m[1]} b.` : `+${m[1]} pts`)],
  [/^You were caught… but still got \+(\d+) pts$/, (m, lang) => (lang === 'cs' ? `Chytili tě… ale i tak máš +${m[1]} b.` : `Te pillaron… pero aun así +${m[1]} pts`)],
  [/^You escaped! \+(\d+) pts$/, (m, lang) => (lang === 'cs' ? `Unikl jsi! +${m[1]} b.` : `¡Escapaste! +${m[1]} pts`)],
  [/^Round (\d+) \/ (\d+)(.*)$/i, (m, lang) => `${lang === 'cs' ? 'Kolo' : 'Ronda'} ${m[1]} / ${m[2]}${m[3] ? ' ' + tr(m[3].trim(), lang) : ''}`],
  [/^results$/i, (m, lang) => (lang === 'cs' ? 'výsledky' : 'resultados')],
  [/^— vote$/, (m, lang) => (lang === 'cs' ? '— hlasování' : '— votación')],
  [/^— pick$/, (m, lang) => (lang === 'cs' ? '— výběr' : '— elección')],
  [/^— doodle time$/, (m, lang) => (lang === 'cs' ? '— kreslení' : '— a dibujar')],
  [/^— who's the impostor\?$/, (m, lang) => (lang === 'cs' ? '— kdo je impostor?' : '— ¿quién es el impostor?')],
  [/^Players \((\d+)\)$/, (m, lang) => `${lang === 'cs' ? 'Hráči' : 'Jugadores'} (${m[1]})`],
  [/^Wants to join \((\d+)\)$/, (m, lang) => `${lang === 'cs' ? 'Chce se připojit' : 'Quiere unirse'} (${m[1]})`],
  [/^Need at least (\d+) players$/, (m, lang) => (lang === 'cs' ? `Potřebujete aspoň ${m[1]} hráče` : `Hacen falta al menos ${m[1]} jugadores`)],
  [/^You need at least (\d+) players\.$/, (m, lang) => (lang === 'cs' ? `Potřebujete aspoň ${m[1]} hráče.` : `Hacen falta al menos ${m[1]} jugadores.`)],
  [/^Waiting for the host \((.+)\) to start…$/, (m, lang) => (lang === 'cs' ? `Čeká se, až hostitel (${m[1]}) spustí hru…` : `Esperando a que el anfitrión (${m[1]}) empiece…`)],
  [/^(.+) has to let you in$/, (m, lang) => (lang === 'cs' ? `${m[1]} tě musí pustit dovnitř` : `${m[1]} tiene que dejarte entrar`)],
  [/^Remove (.+)\?$/, (m, lang) => (lang === 'cs' ? `Vyhodit hráče ${m[1]}?` : `¿Echar a ${m[1]}?`)],
  [/^(\d+) \/ (\d+) players done…$/, (m, lang) => (lang === 'cs' ? `${m[1]} / ${m[2]} hráčů hotovo…` : `${m[1]} / ${m[2]} jugadores listos…`)],
  [/^(\d+) \/ (\d+) voted…$/, (m, lang) => (lang === 'cs' ? `${m[1]} / ${m[2]} hlasovalo…` : `${m[1]} / ${m[2]} han votado…`)],
  [/^(\d+) \/ (\d+) captions in…$/, (m, lang) => (lang === 'cs' ? `${m[1]} / ${m[2]} popisků…` : `${m[1]} / ${m[2]} pies de foto…`)],
  [/^Waiting for (.+) to snap a photo…$/, (m, lang) => (lang === 'cs' ? `Čeká se, až se ${m[1]} vyfotí…` : `Esperando a que ${m[1]} se haga una foto…`)],
  [/^What's going on in (.+)'s photo\? Write a caption\.$/, (m, lang) => (lang === 'cs' ? `Co se děje na fotce hráče ${m[1]}? Napiš popisek.` : `¿Qué pasa en la foto de ${m[1]}? Escribe un pie.`)],
  [/^(.+) is picking the best caption…$/, (m, lang) => (lang === 'cs' ? `${m[1]} vybírá nejlepší popisek…` : `${m[1]} está eligiendo el mejor pie…`)],
  [/^(.+) didn't snap a photo — the round was skipped, no points\.$/, (m, lang) => (lang === 'cs' ? `${m[1]} se nevyfotil(a) — kolo se přeskočilo, žádné body.` : `${m[1]} no se hizo foto: ronda saltada, sin puntos.`)],
  [/^(.+) picked the best caption$/, (m, lang) => (lang === 'cs' ? `${m[1]} vybral(a) nejlepší popisek` : `${m[1]} eligió el mejor pie`)],
  [/^(.+)'s photo$/, (m, lang) => (lang === 'cs' ? `Fotka hráče ${m[1]}` : `Foto de ${m[1]}`)],
  [/^(.+) wins? the game!$/, (m, lang) => (lang === 'cs' ? `${m[1]} vyhrává hru!` : `¡${m[1]} gana la partida!`)],
  [/^(\d+) votes? · \+(\d+) pts$/, (m, lang) => (lang === 'cs'
    ? `${m[1]} ${csPlural(m[1], 'hlas', 'hlasy', 'hlasů')} · +${m[2]} b.`
    : `${m[1]} ${esPlural(m[1], 'voto', 'votos')} · +${m[2]} pts`)],
  [/^(\d+) votes?$/, (m, lang) => (lang === 'cs' ? `${m[1]} ${csPlural(m[1], 'hlas', 'hlasy', 'hlasů')}` : `${m[1]} ${esPlural(m[1], 'voto', 'votos')}`)],
  [/^\+(\d+) pts$/, (m, lang) => (lang === 'cs' ? `+${m[1]} b.` : `+${m[1]} pts`)],
  [/^\+(\d+) pts ·$/, (m, lang) => (lang === 'cs' ? `+${m[1]} b. ·` : `+${m[1]} pts ·`)],
  [/^(\d+) items$/, (m, lang) => (lang === 'cs' ? `${m[1]} ${csPlural(m[1], 'věc', 'věci', 'věcí')}` : `${m[1]} objetos`)],
  [/^(\d+) coins$/, (m, lang) => (lang === 'cs' ? `${m[1]} ${csPlural(m[1], 'mince', 'mince', 'mincí')}` : `${m[1]} monedas`)],
  [/^\+(\d+) coins — see you tomorrow!$/, (m, lang) => (lang === 'cs' ? `+${m[1]} mincí — uvidíme se zítra!` : `+${m[1]} monedas. ¡Hasta mañana!`)],
  [/^(\d+) days left$/, (m, lang) => (lang === 'cs' ? `zbývá ${m[1]} ${csPlural(m[1], 'den', 'dny', 'dní')}` : `quedan ${m[1]} días`)],
  [/^(\d+h )?(\d+)m left$/, (m, lang) => (lang === 'cs' ? `zbývá ${m[1] || ''}${m[2]} min` : `quedan ${m[1] || ''}${m[2]} min`)],
  [/^Come back in (.+)$/, (m, lang) => (lang === 'cs' ? `Vrať se za ${m[1]}` : `Vuelve en ${m[1]}`)],
  [/^Next spin in (.+)$/, (m, lang) => (lang === 'cs' ? `Další zatočení za ${m[1]}` : `Siguiente giro en ${m[1]}`)],
  [/^Reward in (\d+)s…$/, (m, lang) => (lang === 'cs' ? `Odměna za ${m[1]} s…` : `Premio en ${m[1]} s…`)],
  [/^\+(\d+)% extra$/, (m, lang) => (lang === 'cs' ? `+${m[1]} % navíc` : `+${m[1]} % extra`)],
  [/^Buy for (.+)$/, (m, lang) => (lang === 'cs' ? `Koupit za ${m[1]}` : `Comprar por ${m[1]}`)],
  [/^Open another$/, (m, lang) => (lang === 'cs' ? 'Otevřít další' : 'Abrir otro')],
  [/^Duplicate — you get$/, (m, lang) => (lang === 'cs' ? 'Duplikát — dostáváš' : 'Repetido: recibes')],
  [/^Already yours — you get$/, (m, lang) => (lang === 'cs' ? 'Už to máš — dostáváš' : 'Ya lo tienes: recibes')],
  [/^You own the Party Pack — you get$/, (m, lang) => (lang === 'cs' ? 'Máš Party Pack — dostáváš' : 'Tienes el Party Pack: recibes')],
  [/^\+(\d+) coins$/, (m, lang) => (lang === 'cs' ? `+${m[1]} mincí` : `+${m[1]} monedas`)],
  [/^Equipped: (.+)$/, (m, lang) => (lang === 'cs' ? `Nasazeno: ${m[1]}` : `Equipado: ${m[1]}`)],
  [/^Unlocked! \+(\d+) coins \(prototype — nothing was charged\)$/, (m, lang) => (lang === 'cs' ? `Odemčeno! +${m[1]} mincí (prototyp — nic se nezaplatilo)` : `¡Desbloqueado! +${m[1]} monedas (prototipo: no se cobró nada)`)],
  [/^(.+) is in the (Party Pack|Question Packs)$/, (m, lang) => (lang === 'cs' ? `${tr(m[1], lang)} je v nabídce ${tr(m[2], lang)}` : `${tr(m[1], lang)} está en ${tr(m[2], lang)}`)],
  [/^1 game of (.+)$/, (m, lang) => (lang === 'cs' ? `1 hra módu ${m[1]}` : `1 partida de ${m[1]}`)],
  [/^Ticket bought: 1 game of (.+)$/, (m, lang) => (lang === 'cs' ? `Vstupenka koupena: 1 hra módu ${m[1]}` : `Entrada comprada: 1 partida de ${m[1]}`)],
  [/^(\d+)× GAME$/, (m, lang) => (lang === 'cs' ? `${m[1]}× HRA` : `${m[1]}× PARTIDA`)],
  [/^In lobby · (.+)$/, (m, lang) => (lang === 'cs' ? `V lobby · ${trParts(m[1], lang)}` : `En sala · ${trParts(m[1], lang)}`)],
  [/^Playing · (.+)$/, (m, lang) => (lang === 'cs' ? `Hraje · ${m[1]}` : `Jugando · ${m[1]}`)],
  [/^(\d+) players?$/, (m, lang) => (lang === 'cs' ? `${m[1]} ${csPlural(m[1], 'hráč', 'hráči', 'hráčů')}` : `${m[1]} ${esPlural(m[1], 'jugador', 'jugadores')}`)],
  [/^(.+) is now your friend$/, (m, lang) => (lang === 'cs' ? `${m[1]} je teď tvůj přítel` : `${m[1]} ya es tu amigo`)],
  [/^(.+) sent you a friend request$/, (m, lang) => (lang === 'cs' ? `${m[1]} ti poslal(a) žádost o přátelství` : `${m[1]} te envió una solicitud de amistad`)],
  [/^(.+) accepted your friend request$/, (m, lang) => (lang === 'cs' ? `${m[1]} přijal(a) tvou žádost o přátelství` : `${m[1]} aceptó tu solicitud de amistad`)],
  [/^(.+) removed from friends$/, (m, lang) => (lang === 'cs' ? `${m[1]} odebrán(a) z přátel` : `${m[1]} eliminado de amigos`)],
  [/^(.+) invited you to (.+)$/, (m, lang) => (lang === 'cs' ? `${m[1]} tě zve do hry ${m[2]}` : `${m[1]} te invita a ${m[2]}`)],
  [/^invited you to play$/, (m, lang) => (lang === 'cs' ? 'tě zve do hry' : 'te invita a jugar')],
  [/^Your code: (.+)$/, (m, lang) => (lang === 'cs' ? `Tvůj kód: ${m[1]}` : `Tu código: ${m[1]}`)],
  [/^(Common|Rare|Epic|Legendary|Mythic) (\d+) %$/, (m, lang) => `${tr(m[1], lang)} ${m[2]} %`],
  [/^(\d+) pts$/, (m, lang) => (lang === 'cs' ? `${m[1]} b.` : `${m[1]} pts`)],
];

// Když se text skládá z „A · B“, přeložit každou část zvlášť.
function trParts(text, lang) {
  return text.split(' · ').map((p) => tr(p, lang)).join(' · ');
}

const DICT = { cs: {}, es: {} };
for (const [en, cs, es] of DICT_ROWS) { DICT.cs[en] = cs; DICT.es[en] = es; }

function tr(text, lang = getLang()) {
  if (lang === 'en' || !text) return text;
  const exact = DICT[lang][text];
  if (exact !== undefined) return exact;
  for (const [re, fn] of PATTERNS) {
    const m = text.match(re);
    if (m) return fn(m, lang);
  }
  return text;
}

// --------------------------------------------- překlad obrazovky ---

// Kde se nepřekládá: jména hráčů, kódy, otázky ze serveru, texty od hráčů.
const I18N_SKIP = '.player-name, .code-display, .prompt-text, .caption-text, .caption-card, .impostor-prompts, input, textarea, [data-no-i18n]';
const ATTRS = ['placeholder', 'aria-label', 'title'];
// uzel -> { raw: anglický text, out: náš překlad } — když appka text uzlu
// sama změní, bere se nový text jako nový originál
const originals = new WeakMap();

function translateTextNode(node, lang) {
  const parent = node.parentElement;
  if (!parent || parent.closest(I18N_SKIP)) return;
  const rec = originals.get(node);
  const raw = rec && node.nodeValue === rec.out ? rec.raw : node.nodeValue;
  const trimmed = raw.trim();
  if (!trimmed || !/[A-Za-z]/.test(trimmed)) return;
  const next = raw.replace(trimmed, tr(trimmed, lang));
  if (next !== node.nodeValue) {
    originals.set(node, { raw, out: next });
    node.nodeValue = next;
  }
}

function translateTree(root, lang = getLang()) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) return translateTextNode(root, lang);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) translateTextNode(n, lang);
  const els = [root, ...root.querySelectorAll('[placeholder],[aria-label],[title]')];
  for (const el of els) {
    if (!el.getAttribute || el.closest('[data-no-i18n]')) continue;
    for (const a of ATTRS) {
      const key = `data-i18n-${a}`;
      const orig = el.getAttribute(key) ?? el.getAttribute(a);
      if (!orig) continue;
      const out = tr(orig, lang);
      if (out !== el.getAttribute(a)) {
        if (!el.hasAttribute(key)) el.setAttribute(key, orig);
        el.setAttribute(a, out);
      }
    }
  }
}

// Každý nový nebo změněný text na stránce se přeloží hned (před vykreslením).
const i18nObserver = new MutationObserver((mutations) => {
  const lang = getLang();
  if (lang === 'en') return;
  for (const m of mutations) {
    if (m.type === 'characterData') translateTextNode(m.target, lang);
    else m.addedNodes.forEach((node) => translateTree(node, lang));
  }
});
i18nObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
document.documentElement.lang = getLang();

// ------------------------------------------------ výběr jazyka ---

function languagePickerHtml() {
  const cur = getLang();
  return `<div class="lang-picker" data-no-i18n>
    ${LANGS.map((l) => `<button class="lang-chip ${l.id === cur ? 'active' : ''}" data-lang="${l.id}"><b>${l.id.toUpperCase()}</b><span>${l.label}</span></button>`).join('')}
  </div>`;
}

function setLang(lang) {
  try { localStorage.setItem('vyraz_lang', lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
  if (typeof send === 'function') send({ type: 'set_lang', lang }); // hostitel lobby → otázky v jeho jazyce
}
