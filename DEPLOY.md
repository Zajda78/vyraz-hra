# Nasazení "Výraz" na Render.com (zdarma, bez karty)

Render umí spustit náš Node/WebSocket server přímo, bez placení a bez karty.
Jediná podmínka: kód musí být v GitHub repozitáři, ze kterého si ho Render natáhne.

## 1. GitHub repozitář

Pokud nemáš GitHub účet, založ si ho zdarma na https://github.com/signup.

Pak vytvoř nové **prázdné** repo (bez README) na https://github.com/new — třeba
pod názvem `vyraz-hra`.

V terminálu, ve složce `vyraz-hra` (kód už je tu lokálně připravený a commitnutý),
spusť (nahraď `TVOJE-JMENO` svým GitHub uživatelským jménem):

```bash
git remote add origin https://github.com/TVOJE-JMENO/vyraz-hra.git
git branch -M main
git push -u origin main
```

Prohlížeč/terminál tě požádá o přihlášení k GitHubu — přihlas se.

## 2. Render

1. Jdi na https://render.com a zaregistruj se (nejrychlejší je tlačítko "Sign up with GitHub" — propojí se to rovnou s tvým GitHub účtem).
2. V Render dashboardu klikni **New → Web Service**.
3. Vyber svůj repozitář `vyraz-hra` (Render se ho zeptá o povolení přístupu ke GitHubu, jen poprvé).
4. Render sám najde soubor `render.yaml` a předvyplní: Build command `npm install`, Start command `npm start`, plán **Free**. Nic měnit nemusíš.
5. Klikni **Create Web Service** / **Deploy**.

Za pár minut (první build trvá déle) dostaneš adresu ve tvaru
`https://vyraz-hra.onrender.com` — to je tvůj trvalý veřejný odkaz.

**Jedna vlastnost zdarma tieru:** pokud appku 15 minut nikdo nepoužívá, "usne" a
další příchozí musí počkat ~30–60 vteřin, než se probere. Pak už běží normálně.

## Když příště appku upravíme

Stačí lokální změny commitnout a `git push` — Render automaticky znovu nasadí.

---

# Alternativa: nasazení na Google Cloud Run (přes Firebase/Google účet)

Appka potřebuje běžet jako trvalý server (WebSocket + živý stav lobby v paměti),
takže "čistý" Firebase Hosting (jen statické stránky) nestačí — musí to jet přes
**Cloud Run**, což je součást stejného Google Cloud/Firebase ekosystému.

Přihlášení a založení projektu musíš udělat ty sám (běží to přes tvůj prohlížeč) —
tady jsou přesné kroky.

## 1. Nainstaluj Google Cloud CLI

Pokud ho ještě nemáš: https://cloud.google.com/sdk/docs/install
(stáhni instalátor pro Windows a projeď ho — na konci se otevře přihlašovací okno).

## 2. Přihlas se a nastav projekt

V PowerShellu nebo příkazové řádce:

```bash
gcloud auth login
```

Otevře se prohlížeč — přihlas se svým Google účtem.

Pokud ještě nemáš žádný GCP/Firebase projekt, založ ho:

```bash
gcloud projects create vyraz-hra-tvoje-jmeno --name="Výraz"
gcloud config set project vyraz-hra-tvoje-jmeno
```

(Pokud projekt z Firebase konzole už máš, jen `gcloud config set project <ID-projektu>`.)

## 3. Zapni billing a potřebné API

Cloud Run vyžaduje mít u projektu zapnutý billing účet (platební kartu) — **i pro
bezplatnou úroveň**, která je ale velkoryse dostačující pro pár kamarádů (2 miliony
požadavků měsíčně zdarma). Zapneš ho v https://console.cloud.google.com/billing
u svého projektu.

Pak zapni Cloud Run API:

```bash
gcloud services enable run.googleapis.com
```

## 4. Nasaď appku

V terminálu se přepni do složky `vyraz-hra` (tam, kde je `server.js`) a spusť:

```bash
gcloud run deploy vyraz-hra --source . --region europe-west1 --allow-unauthenticated --max-instances=1
```

Co to dělá:
- `--source .` — Cloud Run appku sám zabalí a nasadí přímo z tohohle adresáře, žádný Docker soubor není potřeba.
- `--allow-unauthenticated` — aby appka byla veřejně přístupná bez přihlašování (jinak by ji nikdo z kamarádů nemohl otevřít).
- `--max-instances=1` — **důležité**: appka drží stav lobby v paměti jednoho procesu. Bez tohohle by Cloud Run mohl při větším provozu spustit appku ve více kopiích najednou a hráči by se rozdělili na různé servery, které o sobě neví. S jedním kamarádským serverem to stačí s rezervou.

Na konci příkaz vypíše **Service URL** — něco jako `https://vyraz-hra-xxxxx-ew.a.run.app`. To je tvůj trvalý veřejný odkaz.

## 5. (Volitelné) Hezčí adresa přes Firebase Hosting

Pokud chceš místo `.run.app` adresu ve tvaru `vyraz-hra.web.app`, dej vědět — propojím
Cloud Run službu s Firebase Hostingem (`firebase init hosting` + rewrite pravidlo).

## Když příště appku upravíme

Stačí ve složce `vyraz-hra` znovu spustit stejný příkaz z kroku 4 — nahradí starou verzi novou.
