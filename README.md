# KickOff Ordina

Ordinazioni dal posto (ombrellone, spogliatoio, tavolo) per il centro
sportivo KickOff. Il cliente scansiona il QR alla sua postazione, ordina,
sceglie ritiro o consegna, e paga in loco. Il bar riceve, accetta, e lo
scontrino si stampa da solo.

Stack: Next.js 14 (App Router) + Supabase (DB + Realtime) + Vercel — stesso
stack di PointLab.

## 1. Crea il progetto Supabase

1. Vai su supabase.com, crea un nuovo progetto.
2. Apri **SQL Editor** e incolla il contenuto di `supabase/schema.sql`, esegui.
3. Se stai aggiornando un progetto già esistente (non partendo da zero),
   esegui anche in ordine i file dentro `supabase/migrations/` che non hai
   ancora lanciato — sono numerati, vanno eseguiti in sequenza.
4. In **Project Settings → API** copia: `Project URL`, `anon public key`,
   `service_role key` (quest'ultima è segreta, mai esporla al browser).

## 2. Configura le variabili d'ambiente

Copia `.env.example` in `.env.local` e compila con i valori di Supabase.
Scegli due PIN diversi:
- `BAR_PIN` — dai ai baristi, funziona solo in `/bar` (accetta/rifiuta/pronto,
  attiva/disattiva prodotti). Non apre `/admin`.
- `ADMIN_PIN` — il tuo, funziona sia in `/admin` che in `/bar`.

## 3. Sviluppo locale

```
npm install
npm run dev
```

- `/` — home
- `/o/[tableId]` — pagina cliente di una postazione (il link che finisce nel QR)
- `/bar` — dashboard bar (chiede il PIN)
- `/admin` — pannello admin: postazioni/QR, prodotti, zone (chiede il PIN)

Le postazioni di esempio non esistono finché non le crei da `/admin →
Postazioni & QR`: scegli la zona, dai un nome (es. "Ombrellone 12"),
genera. Il QR si scarica in PNG pronto da stampare.

## 4. Deploy su Vercel

Stesso flusso che usi già per PointLab: carica il progetto (o fai push
su GitHub e collega la repo), imposta le stesse variabili d'ambiente di
`.env.local` nelle **Environment Variables** di Vercel, deploy.

Una volta collegato il dominio custom, aggiorna `NEXT_PUBLIC_SITE_URL` con
l'URL definitivo — è quello che viene incorporato nei QR code, quindi vanno
rigenerati (basta riaprire la pagina Postazioni in Admin) se lo cambi dopo
averli già stampati.

## 5. Stampa automatica dello scontrino (comande separate bar/cucina)

Vercel non può parlare direttamente con una stampante che sta sulla rete
locale del bar. Serve un piccolo agent che gira lì:

1. Un mini-PC o Raspberry Pi collegato alla stessa rete Wi-Fi/LAN della
   stampante termica (deve supportare stampa via rete/IP, es. Epson TM-T20).
2. Su quel dispositivo: cartella `print-agent/`, `npm install`,
   configura `print-agent/.env` con URL Supabase, service role key, e
   l'IP della stampante bar (`PRINTER_IP_BAR`).
3. Avvialo con `npm start` (consigliato: gestito da `pm2` o da un
   servizio di sistema, così riparte da solo dopo un riavvio).

Ogni prodotto in `/admin → Prodotti` ha una **postazione** (Bar o Cucina).
Quando un ordine contiene prodotti di entrambe, il sistema stampa **due
comande separate**: quella del bar (con prezzi e totale) e quella della
cucina (solo articoli e note, senza prezzi — pensata per chi prepara, non
per l'incasso).

Se hai due stampanti fisiche diverse (una al bar, una in cucina), imposta
anche `PRINTER_IP_CUCINA` nel `.env` del print-agent: la comanda cucina
uscirà sulla stampante giusta. Se ne hai solo una, lasciala vuota — usciranno
comunque due scontrini separati dalla stessa stampante.

Da quel momento: ogni volta che il bar preme "Accetta" su un ordine, le
comande escono in automatico sulla stampante fisica.

## Report serale automatico via email

Ogni giorno, di default alle 20:00 UTC (circa le 21:00-22:00 in Italia,
a seconda dell'ora legale), un cron job invia un'email di riepilogo con
ordini, ricavi, scontrino medio, tempo medio di preparazione, prodotto
più venduto e ordini rifiutati.

Per attivarlo:
1. Crea un account su [resend.com](https://resend.com) (ha un piano
   gratuito), copia la `RESEND_API_KEY`.
2. Su Vercel, aggiungi le variabili `RESEND_API_KEY`, `REPORT_EMAIL`
   (l'indirizzo o gli indirizzi, separati da virgola, a cui inviarlo) e
   `CRON_SECRET` (una stringa a caso, es. generata da un password
   manager) — tutte descritte in `.env.example`.
3. Il file `vercel.json` nel progetto configura già l'orario del cron.
   Per cambiarlo, modifica la riga `schedule` (formato cron standard,
   orari in UTC).
4. Senza dominio verificato su Resend, puoi comunque testare subito
   usando l'indirizzo di prova `onboarding@resend.dev` come mittente
   (già impostato di default) — funziona solo per email verso il tuo
   stesso indirizzo registrato su Resend. Per mandarlo a chiunque,
   verifica un dominio tuo su Resend e aggiorna `REPORT_FROM_EMAIL`.

Se non configuri queste variabili, il sito funziona comunque normalmente:
il cron gira ma non invia nulla, senza errori.

## QR temporanei e antifrode

Ogni postazione ha un **token** separato dal suo id, incluso nell'URL del
QR (`?t=...`). Due cose sbloccate da questo:

- **"Rigenera QR"** in `/admin → Postazioni & QR`: se sospetti che un QR
  sia stato fotografato e usato per ordinare da fuori dal centro, premi
  questo bottone — il QR vecchio smette immediatamente di funzionare
  (il cliente vede "Questo QR non è più valido"), e ne generi uno nuovo
  da ristampare.
- **QR temporanei per eventi**: quando crei una postazione, spunta "QR
  temporaneo per evento" e imposta un intervallo di date — es. un'area
  dedicata a un torneo, attiva solo dal 30 luglio al 9 agosto. Fuori da
  quell'intervallo il QR mostra un messaggio invece del menu, senza che
  tu debba disattivarlo manualmente all'inizio/fine evento.

## Notifiche push vere

Oltre al suono quando la pagina è aperta, il cliente può attivare
notifiche push vere (arrivano anche a telefono bloccato/app in
background) mentre segue un ordine — compare un bottone "Attiva
notifiche" sotto il codice ordine.

Per attivarle serve una coppia di chiavi VAPID (senza terminale, con un
generatore online tipo [vapidkeys.com](https://vapidkeys.com)):

1. Genera la coppia di chiavi (pubblica + privata)
2. Su Vercel, aggiungi le variabili:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` (facoltativa, es. `mailto:tuaemail@esempio.it`)
3. Redeploy

Senza queste variabili il bottone "Attiva notifiche" semplicemente non
compare — il resto del sito funziona come prima, con l'aggiornamento in
tempo reale nella pagina (se il cliente la tiene aperta).

## PWA — installabile su telefono

**Solo `/bar` e `/admin`** sono installabili come app — apposta, non tutto
il sito. Le pagine cliente (`/o/[postazione]`) hanno un URL diverso per
ogni QR, quindi non ha senso "installarle": vanno sempre aperte dal
browser scansionando il QR di quella specifica postazione.

Per installare `/bar` o `/admin`:
- **Android/Chrome**: compare il prompt "Installa app" automaticamente
- **iPhone/Safari**: menu Condividi → "Aggiungi alla schermata Home",
  **mentre sei già su `/bar` o `/admin`** — l'app installata si aprirà
  sempre su quella pagina

Utile soprattutto per lo staff, che può tenere la dashboard come
un'icona sulla home invece di riaprire il browser ogni volta.

**Nota su iPhone e notifiche push**: Apple permette le notifiche push
solo dentro un'app installata con un unico URL fisso di partenza. Le
pagine ordine dei clienti invece hanno un URL diverso per ogni QR, quindi
su iPhone la funzione "Attiva notifiche" (vedi sotto) resta poco
affidabile — il suono/vibrazione a pagina aperta restano il modo
principale con cui un cliente iPhone viene avvisato. Su Android/Chrome e
computer funziona regolarmente.

## Cosa manca per una v2 più robusta

Questa è una prima versione pensata per partire in fretta, non ancora
esattamente allo standard di PointLab:

- **Autenticazione**: `/bar` e `/admin` usano due PIN condivisi (uno per
  ruolo) come "porta d'ingresso". Sopra, ora c'è un livello leggero di
  identificazione staff (nome scelto dopo il PIN) che etichetta le azioni
  nel registro attività — non è un secondo PIN vero e proprio, quindi
  resta comunque facile aggirarlo/saltarlo di proposito. Per un controllo
  più stringente servirebbe un vero sistema di autenticazione per persona.
- **Anti no-show**: ora c'è un limite di 3 ordini attivi contemporanei per
  numero di telefono (protegge da abusi/spam), ma non c'è ancora una vera
  gestione dei "clienti che non si presentano a ritirare".
- **Sessione staff giornaliera**: PIN e identità staff si azzerano da soli
  quando cambia il giorno (controllo lato browser, non un vero timer
  server-side) — se il tablet resta sempre acceso senza mai essere
  riaperto, il reset scatta comunque al primo caricamento della pagina
  del nuovo giorno, non esattamente a mezzanotte.
- **Notifiche**: il cliente vede lo stato aggiornarsi nella pagina aperta,
  ma non riceve una notifica push se chiude la scheda. Si può aggiungere
  un numero di telefono + SMS quando l'ordine è pronto.
- **Offerte**: coupon sconto, happy hour e upselling ci sono (vedi sopra).
  Mancano ancora promozioni automatiche più complesse (es. "3+1", combo).

## Struttura del progetto

```
app/
  page.jsx                 home
  o/[tableId]/page.jsx      pagina cliente (una per postazione, via QR)
  bar/page.jsx              dashboard bar
  admin/page.jsx            pannello admin
  api/
    orders/[id]/route.js    accetta/rifiuta/pronto/completato
    products/route.js       crea prodotto
    products/[id]/route.js  disponibilità/prezzo prodotto
    tables/route.js         crea/elimina postazione
    zones/[id]/route.js     sovrapprezzo zona
    auth/verify/route.js    verifica PIN staff
lib/
  supabaseClient.js         client browser (rispetta RLS)
  supabaseAdmin.js          client server-side (Service Role, solo API routes)
components/
  PinGate.jsx                schermata PIN per bar/admin
print-agent/                 script Node da far girare vicino alla stampante
supabase/schema.sql          schema database completo
```
