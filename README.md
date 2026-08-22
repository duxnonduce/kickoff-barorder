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

## Cosa manca per una v2 più robusta

Questa è una prima versione pensata per partire in fretta, non ancora
esattamente allo standard di PointLab:

- **Autenticazione**: `/bar` e `/admin` usano due PIN condivisi (uno per
  ruolo), non individuali. Come per PointLab, si può evolvere verso PIN
  per singolo membro dello staff con ruoli (Super Operatore, ecc.).
- **Anti no-show**: nessun limite ancora su "1 ordine attivo per cliente".
  Da aggiungere se diventa un problema reale.
- **Notifiche**: il cliente vede lo stato aggiornarsi nella pagina aperta,
  ma non riceve una notifica push se chiude la scheda. Si può aggiungere
  un numero di telefono + SMS quando l'ordine è pronto.
- **Offerte**: la tabella prodotti c'è, ma sconti/promozioni non sono
  ancora implementati nell'interfaccia.

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
