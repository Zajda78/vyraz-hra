# Poznámky k projektu "Výraz" / "Mogging face" — pro předání do jiného chatu

> Tenhle soubor vlož na začátek nové konverzace s Claude Code (nebo ho jen
> přilož), ať ví přesně, o co jde, jaký je aktuální stav a kde jsou soubory.
> Není součástí samotné appky — je to jen poznámka pro tebe a pro AI.

## Co to je

Mobilní párty hra pro partu kamarádů, hraje se v prohlížeči na telefonu.
Hráči se připojí do společné "lobby" přes 4místný kód, appka drží živý stav
přes WebSocket. Aktuálně má appka **tři herní módy** (výběr na úvodní
obrazovce), sdílejí stejný engine kol/skóre/pódia:

1. **Výraz** — padne věta se jménem náhodného spoluhráče (např. "Výraz, když
   ti Petra dluží 500 Kč…"), všichni se vyfotí s reakcí, fotky se odhalí
   najednou a hlasuje se, čí výraz sedí nejlíp.
2. **Domalovánka** — stejné jako Výraz, ale po vyfocení je navíc čas si do
   fotky prstem něco dokreslit (barevná paleta), teprve pak hlasování.
3. **Main character** (dřív "Popisovánka") — každé kolo je objektem fotky
   jiný hráč (rotují se postupně), ostatní k jeho fotce napíšou popisek a on
   sám vybere ten nejlepší — autor vítězného popisku bere body.

**Bodování** je sdílené napříč Výrazem a Domalovánkou: podle pořadí v
hlasování — 1. místo 100 b., 2. místo 80 b., dál klesá
(`POINTS_BY_RANK = [100, 80, 64, 51, 41, 33, 26, 21, 17, 13]` v
`server.js`), shodný počet hlasů = shodné pořadí = shodné body. V Main
character dostává vítězný popisek rovnou 100 b. (`CAPTION_WIN_POINTS`),
objekt fotky (soudce) body nedostává.

Na konci hry je pódium (1.–3. místo), při shodném skóre víc lidí na jednom
stupínku.

Aktuální název appky v prohlížeči/ikonce je **"Mogging face"** — je to jen
prozatímní název, uživatel chce později přejmenovat (viz `index.html`
`<title>`, `manifest.json` `name`/`short_name`, `app.js` úvodní `<h1>`).

## Tech stack a kde co je

- **`server.js`** — Node.js + Express (servíruje statické soubory z
  `public/`) + `ws` (raw WebSocket, ne Socket.io). Celý herní stav žije jen
  v paměti procesu v proměnné `lobbies` (Map kód→lobby) — **restart serveru
  = konec všech rozehraných her**. Žádná databáze.
- **`public/index.html`** — kostra stránky, PWA meta tagy, manifest, ikonka.
- **`public/app.js`** — celý frontend (vanilla JS, žádný framework/build
  krok). Jeden `renderApp(state)` dispatcher podle `state.phase`, staví
  HTML přes template stringy.
- **`public/style.css`** — fialovo-neonový design (viz `--accent:#9333EA`,
  tmavě fialové pozadí `--bg:#170B2E`).
- **`public/icon.svg`** — vlastní vygenerovaná ikonka (barevná clona
  fotoaparátu jako "okvětní lístky"), používá se jako favicon, PWA ikonka i
  logo v hlavičce appky (`<img class="mark" src="icon.svg">`).
- **`package.json`** — závislosti `express` + `ws`, `npm start` spustí
  `node server.js`.
- **`render.yaml`** — konfigurace pro nasazení na Render.com (Blueprint,
  Free plán, `npm install` / `npm start`).
- **`DEPLOY.md`** — podrobný návod na nasazení (Render.com zdarma bez
  karty, i alternativa přes Google Cloud Run/Firebase).

## Nasazení — kde appka běží

- **GitHub repo:** https://github.com/Zajda78/vyraz-hra (kód se pushuje na
  `main`, Render má na tenhle repo napojený auto-deploy)
- **Živá appka:** https://vyraz-hra.onrender.com (Render.com, Free plán,
  žádná karta)
- **Jak nahrát změnu na živou appku:** commitnout a `git push origin main`
  ve složce `vyraz-hra` — Render se sám znovu nasadí (build trvá pár
  minut).
- **Důležitá vlastnost zdarma tieru:** appka po ~15 minutách bez provozu
  "usne", první příchozí pak čeká desítky vteřin, než se probere.

## Jak appku spustit lokálně

```bash
cd vyraz-hra
npm install
npm start
```
Otevři `http://localhost:3000`. Pro test na telefonu ve stejné Wi-Fi použij
lokální IP počítače místo `localhost` (zjistíš přes `ipconfig`).

## Nedávno opravená zásadní chyba (pro kontext, kdyby se to vrátilo)

Hráči se občas při hraní "zasekli" — appka nedávala žádnou zpětnou vazbu a
nešlo pokračovat. Příčina: (1) appka vůbec neuměla obnovit spadlý
WebSocket, (2) zdarma proxy na Renderu umí tiše zabít spojení bez provozu
(dlouhé fáze jako psaní popisku). Oprava (viz `server.js` heartbeat/ping a
`rejoin` handler, `app.js` `scheduleReconnect`/`doReconnect`/session v
`localStorage`): server posílá ping každých 25 s, klient si pamatuje kód
lobby + své ID a po výpadku se sám zkouší znovu připojit se zobrazeným
"Připojování k serveru…" overlayem. Otestováno živě na Renderu, funguje.

## Další nápady / kam appka může jít dál

V `C:\Users\zajda\MyPrograme\` (o úroveň výš, mimo tenhle projekt) jsou i
starší brainstormingové soubory s dalšími nápady na herní módy a
monetizaci, kdyby se k nim chtělo vrátit:
- `napady-hra.md` — přehled projektu, historie rozhodnutí
- `herni-mody.md` — další nápady na módy (foto/psaní/kreslení/hlas), ze
  kterých vzešly Domalovánka a Main character
- `monetizace-hry.md` — nápady na reklamy, mince, no-ads nákup — **zatím
  nic z tohodle není v appce naprogramované**, jen v hlavě/poznámkách.

## Co ještě chybí / stojí za zvážení

- Appka nemá žádnou perzistentní databázi — při restartu serveru
  (např. Render redeploy) se ztratí všechny rozehrané hry. Pro pár
  kamarádů na jeden večer to nevadí, ale je to limit.
- Monetizace (mince, reklamy) zatím vůbec neimplementována.
- Jméno appky "Mogging face" je jen prozatímní placeholder.
- Ikonka appky je SVG — na starším iOS Safari nemusí `apple-touch-icon`
  fungovat úplně spolehlivě (SVG tam oficiálně není 100% podporované).
