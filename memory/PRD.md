# DanoFitness23 - Product Requirements Document

> Storico implementazioni: vedi `/app/memory/CHANGELOG.md` · Backlog: vedi `/app/memory/ROADMAP.md`

## Descrizione
App di fitness per la gestione di lezioni, prenotazioni, abbonamenti e gamification per DanoFitness23.
- **Frontend**: React Native (Expo) con deploy su Vercel
- **Backend**: FastAPI + MongoDB con deploy su Render
- **Dominio produzione**: `danofitness23.vercel.app` → `diobestia.onrender.com`

## Architettura
- Frontend: Expo Router, React Native Web, TypeScript
- Backend: FastAPI, Motor (async MongoDB), bcrypt, PyJWT — monolite `/app/backend/server.py` (~9.250 righe, P0: modularizzare)
- Database: MongoDB (certificati medici su GridFS)
- AI: OpenAI GPT via emergentintegrations (piano nutrizione, Chiedi al Maestro)

## Configurazione URL
- **Preview**: `EXPO_PUBLIC_BACKEND_URL` da `.env`
- **Produzione**: Fallback hardcoded a `https://diobestia.onrender.com`
- **CORS**: Include `danofitness23.vercel.app`, `danofitness26.vercel.app`

## Funzionalità Principali
- Login/Registrazione JWT; prova gratuita 7gg con approvazione admin
- Prenotazione lezioni (circuito, funzionale, pilates, interval step, tabata) + lezioni speciali una tantum; campo `data_inizio` per lezioni ricorrenti attive da una data
- Abbonamenti (pacchetto, mensile, trimestrale, quota stagionale) + insoluti
- Gamification: Lotteria mensile (3 vincitori, bozza→pubblica, premi congelati per estrazione, premi nuovi = prossima estrazione), Ruota, Quiz 4 categorie, Crono (vinci tra 9.99–10.01s, classifica mensile con tie-break cronologico, vincitore del mese con premio a sorpresa dal Maestro)
- Popup Home (via popupQueue.ts — OBBLIGATORIO per ogni popup in Home): nuovi orari, visita medica, giochi sbloccati, vincitori del mese (una volta sola, localStorage), avvisi admin self-service
- Certificato medico: upload/view/replace su GridFS; vecchi clienti deadline 01/12/2026, nuovi 30gg dal primo abbonamento; archivio + convalida admin
- Visita medica sabato 07/11/2026 (30 slot, prenotazione da Home)
- Web Push notifications; notifiche WhatsApp (formatWhatsAppNumber, +39)
- Piano nutrizione AI, Chiedi al Maestro Q&A, Top 3 settimana, streak/KPI Home
- Pannello Admin: utenti, orari e lezioni self-service, certificati, lotteria (estrazione, correggi premi), avvisi popup, statistiche
- Tema Tactical Obsidian / Kinetic Orange

## Collezioni MongoDB chiave
`users, lessons, bookings, subscriptions, lottery_prizes (per mese), lottery_winners (estrazioni con snapshot premi + crono_classifica + crono_premio), wheel_tickets, timer_plays, quiz, certificates (GridFS), migrations, activities`

## Credenziali Test
Vedi `/app/memory/test_credentials.md` (admin: danielebrufani@gmail.com / Mariavittoria23)

## Note operative
- Popup Home: sempre via popupQueue.ts
- Metro bundle stale ricorrente nel preview: restart frontend se le modifiche UI non appaiono
- Deploy live: "Save to GitHub" → Render/Vercel auto-deploy
- /bookings/me va in 500 se un booking manca di created_at (attenzione nei seed)
