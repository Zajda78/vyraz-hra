# Nasazení "Výraz" na Google Cloud Run (přes Firebase/Google účet)

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
