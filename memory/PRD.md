# DanoFitness23 - Product Requirements Document

## Descrizione
App di fitness per la gestione di lezioni, prenotazioni, abbonamenti e gamification per DanoFitness23. 
- **Frontend**: React Native (Expo) con deploy su Vercel
- **Backend**: FastAPI + MongoDB con deploy su Render
- **Dominio produzione**: `danofitness23.vercel.app` → `diobestia.onrender.com`

## Architettura
- Frontend: Expo Router, React Native Web, TypeScript
- Backend: FastAPI, Motor (async MongoDB), bcrypt, PyJWT
- Database: MongoDB
- AI: OpenAI GPT via emergentintegrations (piano nutrizione)

## Configurazione URL
- **Preview**: `EXPO_PUBLIC_BACKEND_URL` da `.env`  
- **Produzione**: Fallback hardcoded a `https://diobestia.onrender.com`
- **CORS**: Include `danofitness23.vercel.app`, `danofitness26.vercel.app`

## Funzionalità Implementate
- Login/Registrazione con JWT
- Dashboard Home con saluti, ricetta del giorno, banner nutrizione
- Prenotazione lezioni (circuito, funzionale, pilates, yoga)
- Gestione abbonamenti (pacchetto lezioni, mensile, trimestrale)
- Lotteria mensile + Ruota della Fortuna
- Quiz fitness giornaliero
- Chat/Comunicazioni
- Classifica settimanale + Medaglie
- Consigli del Maestro + Consigli Musicali
- Piano nutrizione AI (GPT)
- Pannello Admin (gestione utenti, statistiche, piani AI)
- Pannello Istruttore
- Livello settimanale
- Date bloccate
- Performance optimization (cache, indici MongoDB, asyncio.gather)

## Fix Critici (16 Marzo 2026)
- Rimosso proxy code rotto che crashava il backend
- Corretti URL env vars (EXPO_PUBLIC_BACKEND_URL + fallback produzione)
- Rimosso public/index.html CRA che bloccava rendering Expo
- Eliminato nginx.conf inutile
- Verificato CORS produzione

## Miglioramento Admin Piani AI (16 Marzo 2026)
- Aggiunta barra di ricerca per filtrare piani per nome/cognome cliente
- Card profilo cliente con: sesso, età, altezza, peso, obiettivo, calorie, macro (P/C/G), intolleranze
- Rimossa visualizzazione piano completo dalla lista (performance)
- Backend ottimizzato: restituisce tutti i campi profilo senza il testo del piano
- Pulsante "Azzera Piano" funzionante su ogni card

## Pulsanti Copia & Stampa Piano (16 Marzo 2026)
- Pulsante "Copia Piano" per copiare il testo del piano negli appunti (con fallback)
- Pulsante "Stampa" (solo web) apre finestra di stampa formattata con titolo e stile
- Entrambi visibili sotto il piano generato nella pagina Dieta AI del cliente

## Dieta AI visibile per Istruttori (17 Marzo 2026)
- Tab "Dieta AI" ora accessibile anche agli istruttori (prima era nascosta)
- Backend già supportava il ruolo istruttore, modifica solo frontend _layout.tsx

## Sistema Annullamento Lezioni da Admin (20 Marzo 2026)
- Nuova collection `cancelled_lessons` nel DB
- Admin può annullare/ripristinare lezioni singole dal tab "Oggi" → "Gestione Lezioni della Settimana"
- Vista settimanale completa: tutte le lezioni da lunedì a sabato con pulsante Annulla/Ripristina
- Giorni passati senza pulsanti (non modificabili), giorni futuri con Annulla
- Prenotazioni esistenti cancellate automaticamente all'annullamento
- Nuove prenotazioni bloccate per lezioni annullate
- Banner dinamico nella Home + "ANNULLATA" nella pagina Lezioni
- Endpoint: POST/DELETE /api/admin/cancel-lesson, GET /api/cancelled-lessons

## Sistema Lotteria a 3 Vincitori e 3 Premi (26 Marzo 2026)
- Lotteria mensile aggiornata: ora estrae 3 vincitori distinti (1°, 2°, 3° posto)
- Admin può configurare 3 premi distinti per ogni mese (premio_1, premio_2, premio_3)
- Estrazione senza reinserimento: chi vince il 1° premio viene rimosso dal pool prima del 2° posto
- Ogni vincitore riceve il premio associato alla propria posizione
- Sia estrazione automatica (1° del mese ore 12:00) che manuale (admin) estraggono 3 vincitori
- Frontend mostra 3 premi con medaglie nella sezione premi, countdown e vincitori
- Albo d'Oro mostra 3 vincitori per mese con i rispettivi premi

## Riorganizzazione Pagina Lotteria (26 Marzo 2026)
- Premi mostrati UNA SOLA VOLTA (eliminata tripla ripetizione)
- Struttura: Premi → Countdown → Avviso abbonamento attivo

## Quiz a 4 Categorie (26 Marzo 2026)
- Rimosso vecchio quiz fitness con 65 domande
- 4 nuove categorie: GOSSIP, CULTURA GENERALE, CINEMA & SERIE TV, MUSICA
- 25 domande diverse per categoria (100 totali) in file separato `quiz_domande.py`
- Flusso: Gira ruota → Scegli categoria → Rispondi alla domanda
- Nuovo endpoint `POST /quiz/select-category` per salvare la scelta
- UI con griglia 2x2 per la selezione categoria, badge categoria sopra la domanda
- Ogni utente riceve una domanda diversa ogni giorno (hash user_id + data)

## Prova Gratuita 7 Giorni (26 Marzo 2026)
- Admin attiva manualmente la prova per nuovi clienti dal pannello Utenti
- Utente in prova vede tutto TRANNE il piano alimentare AI (riservato agli abbonati)
- Tab Abbonamento mostra card "PROVA" con date inizio/scadenza
- Tab Alimentazione mostra avviso per utenti in prova
- Admin può disattivare la prova in qualsiasi momento
- Trial users partecipano alle prenotazioni ma NON alla lotteria mensile
- Endpoints: POST /admin/activate-trial/{user_id}, POST /admin/deactivate-trial/{user_id}

## Credenziali Test
- Email: danielebrufani@gmail.com
- Password: Mariavittoria23

## Alert Nuove Registrazioni Admin (26 Marzo 2026)
- Popup modale al login admin se ci sono nuovi utenti registrati
- Mostra nome e cognome di ogni nuovo iscritto
- Pulsante "OK, VISTO!" per chiudere e marcare come visti
- Endpoints: GET /admin/new-registrations, POST /admin/mark-registrations-seen

## Bug Fix: Pulsante Prova 7gg non visibile (26 Marzo 2026)
- Il pulsante "Prova 7gg" non appariva per utenti con ruolo "utente" (solo per "client")
- Fix: condizione cambiata da `role === 'client'` a `role !== 'admin' && role !== 'istruttore'`

## Prova 7 Giorni come Tipo Abbonamento (26 Marzo 2026)
- "Prova 7 Giorni - Gratis" aggiunta come 5° tipo abbonamento (accanto a 8 Lezioni, 16 Lezioni, Mensile, Trimestrale)
- Accessibile da Admin > Abbon. > Nuovo Abbonamento > Prova 7 Giorni
- Selezionandola: toggle pagamento nascosto, info box verde con limitazioni prova
- Backend: crea subscription con scadenza 7 giorni + attiva flag prova_attiva sull'utente
- Rimosso pulsante "Prova 7gg" dal tab Utenti (non più necessario)
- Test: Backend 6/6 passati, Frontend code review OK

## Redesign Completo - Tactical Obsidian / Kinetic Orange (27 Aprile 2026)
- Chiamato `design_agent_full_stack` per blueprint completo (salvato in `/app/design_guidelines.json`)
- **Nuova palette**: Obsidian #0A0A0A + Kinetic Orange #FF4500 (primary) + Neon Green #00E676 (streak/success) + Electric Blue #00B0FF (accent) — tema Functional/CrossFit
- **Font custom caricati**: `BebasNeue_400Regular` (headlines) + `Montserrat_{400,600,700,800,900}` (body) via `@expo-google-fonts/*`
- `app/_layout.tsx` rifatto per caricare font con splash `ActivityIndicator`
- `src/utils/constants.ts`: COLORS ampliati (primary/secondary/accent/surface/glow/…) + export `FITNESS_IMAGES` (6 URL Pexels/Unsplash per hero, circuito, funzionale, pilates, yoga, sfondo astratto)
- Aggiornati colori delle lezioni in `ATTIVITA_INFO` con immagini Pexels/Unsplash
- Creato `src/theme.ts` con FONTS, SPACING, RADII, glow helper cross-platform
- Nuovi componenti riusabili:
  - `FitButton.tsx` - pulsante con spring-scale on press + glow, 5 varianti
  - `FitCard.tsx` - card animata (fade-in + slide-up staggered)
  - `CountUp.tsx` - numeri animati per KPI (requestAnimationFrame easeOutCubic)
  - `ConfettiBurst.tsx` - coriandoli full-screen via canvas-confetti (CDN lazy-load)
- **Home cliente**: hero image con overlay scuro + kicker + greeting Bebas Neue + accent bar + quote (sostituisce la vecchia "Star Wars card")
- **Home admin**: KPI cards con CountUp animation + bordo sinistro colorato (primary/success/accent) + font Bebas Neue
- **Pagina Premi**: colori "VEGAS_COLORS" riallineati al Functional theme (Gold → Kinetic Orange). Confetti esplode quando si vincono biglietti alla ruota
- **Bottom tab bar**: colori tab Dieta/Premi/Classifica ricollegati a COLORS.primary/secondary
- Verificato via bundle: `FF4500`, `BebasNeue`, `Montserrat` presenti nell'HTML/JS finali

## Bonus Streak Settimanale (27 Aprile 2026)
- Nuovo sistema di bonus biglietti lotteria per allenamenti consecutivi
- Settimana ISO Lunedì → Domenica, reset automatico ogni lunedì
- 3 giorni consecutivi di allenamento → +3 biglietti (una volta/settimana)
- 5 giorni consecutivi → +3 biglietti extra (aggiuntivi, una volta/settimana)
- Skip di un giorno → streak azzerata (ricomincia da 1)
- Funzione `check_and_award_streak_bonus` agganciata ai 3 hook di `lezione_scalata: True`:
  - confirm-presence (admin)
  - process-day (auto)
  - process-started-lessons (cron)
- Nuovo endpoint `GET /api/streak/status`: ritorna streak corrente, giorni allenati, soglie, biglietti ottenuti
- Collection `streak_bonuses`: `{user_id, settimana (ISO), streak_attuale, bonus_3_dato, bonus_5_dato, mese}`
- I biglietti bonus vengono aggiunti al mese corrente in `wheel_tickets` (contano per la lotteria)
- Nuovo componente frontend `StreakBanner.tsx` nella Home cliente:
  - Card fiamma 🔥 animata con streak corrente
  - Pallini giorni settimana (Lun-Dom) con ✓ sui giorni allenati
  - 2 badge soglia (3gg +3🎟️ / 5gg +3🎟️) che diventano verdi quando raggiunti
  - Progress bar verso la prossima soglia
  - Modal "Come funziona?" con spiegazione dettagliata + esempio
- Test backend: tutte le casistiche passate ✅

## Modalità Bozza + Pubblicazione Lotteria (27 Aprile 2026)
- L'estrazione (auto il 1° del mese ore 12:00, o manuale admin) salva con `pubblicato: false`
- Solo l'admin vede i vincitori in bozza (campo `bozza_in_attesa` in `/lottery/status`)
- Nuovo box UI admin nella pagina Premi: mostra vincitori, premi, partecipanti + pulsanti PUBBLICA / RI-ESTRAI
- Endpoint: `POST /admin/lottery/publish/{mese}` rende visibili i vincitori a tutti
- Endpoint: `POST /admin/lottery/re-extract/{mese}` cancella la bozza e ri-estrae (solo su mese corrente non pubblicato)
- Retrocompatibilità: estrazioni esistenti senza campo `pubblicato` sono considerate pubblicate
- Test end-to-end: admin vede bozza, cliente NO; dopo publish cliente vede tutto ✅

## Tab Shop con Merchandise Sprint Design (29 Aprile 2026)
Nuovo tab Shop per vendita merchandise, con catalogo, ordini e invio automatico al produttore via WhatsApp.

**Backend (`server.py`):**
- 2 nuove collection: `shop_products`, `shop_orders`
- 10 endpoint: CRUD prodotti admin (`POST/PUT/DELETE /admin/shop/products`), lista pubblica (`GET /shop/products`), ordini (`POST /shop/orders`, `GET /shop/orders/me`, `GET /admin/shop/orders`, `PATCH/DELETE /admin/shop/orders/{id}`)
- `POST /shop/orders` ritorna sia l'ordine sia un **`whatsapp_text` con intro casuale sarcastica** (12 varianti) + scheda dettagliata cliente/prodotto/taglia/colore/quantità/totale/rif.

**Frontend (`shop.tsx` + `_layout.tsx`):**
- Header: logo Sprint Design (immagine fornita), info attività (Bastia Umbra, indirizzo, telefono cliccabile, orari)
- Catalogo prodotti grid 2 colonne con foto, prezzo Bebas Neue
- Modal acquisto: foto grande, descrizione, scelta taglia/colore, note → confermando apre `wa.me/393487397979` con testo precompilato
- Sezione "I Miei Ordini" (cliente) con stato colorato
- Pannello admin: pulsante "Nuovo Prodotto" → modal con upload foto (compressa via canvas API a max 800px JPEG 75%), taglie/colori CSV, switch magazzino e attivo
- Sezione admin "Tutti gli Ordini" con azioni: Evadi da Magazzino / Inviato a Produttore / In Consegna / Consegnato / Cancella
- Footer "SOLO PRODOTTINI DI QUALITÀ" in arancione fluo gigante con glow

**Pagamento:** nessuno in app — paga in palestra alla consegna.

**Testato:** creazione prodotto, ordine end-to-end con scheda WhatsApp generata correttamente, cleanup ordine/prodotto OK ✅

## Auto-Cleanup Flag Prova Scaduta/Convertita (29 Aprile 2026)
Risolve il bug in cui un cliente, dopo aver finito la settimana di prova o aver ricevuto un abbonamento vero, manteneva il badge "PROVA" verde nella scheda admin.

**Backend (`server.py`):**
1. **`create_subscription`**: quando viene assegnato un abbonamento NON-`prova_7gg`, se l'utente aveva `prova_attiva=True`, il flag viene automaticamente impostato a `False` con `prova_terminata_il=oggi`
2. **`check_user_is_trial`**: se la prova è scaduta (`prova_scadenza < today`), il flag viene auto-disattivato al primo check
3. **Startup cleanup**: all'avvio del backend, scansiona tutti gli utenti con `prova_attiva=True` e disattiva il flag se (a) la prova è scaduta o (b) hanno un abbonamento vero attivo
- Verificato: log mostra "1 utenti puliti dal flag prova_attiva" (Daniele Brufani in Preview)

⚠️ Per il caso specifico Manuela Uster (in DB Production): il fix verrà applicato automaticamente al primo deploy su Render dopo "Save to Github"

## Aggiunta/Rimozione Manuale Clienti su Lezioni — Admin (28 Aprile 2026)
Permette all'admin di gestire retroattivamente le prenotazioni (bypass dei controlli normali) per:
- aggiungere un cliente che si è dimenticato di prenotare (anche a lezione iniziata)
- rimuovere un cliente e riaccreditargli la lezione se erroneamente scalata

**Backend (`server.py`):**
- `GET /lessons/{lesson_id}/participants/{lesson_date}` ora include `booking_id`, `user_id`, `lezione_scalata` solo se chi chiama è admin (campi nascosti ai client)
- `POST /admin/bookings/force-add` body `{user_id, lesson_id, data_lezione, scala_lezione}` → crea booking bypassando validazioni (settimana, ora, abbonamento). Se `scala_lezione=true`, scala 1 lezione dal pacchetto attivo (`lezione_singola`/`lezioni_8`/`lezioni_16`)
- `DELETE /admin/bookings/{booking_id}/admin-remove?riaccredita=bool` → rimuove booking. Se `riaccredita=true` e la prenotazione era `lezione_scalata=true`, riaccredita +1 al pacchetto più recente

**Frontend (`admin.tsx` tab Riepilogo → Gestione Lezioni Attive):**
- Mostrate ora TUTTE le lezioni della settimana (passate + oggi + future) — prima erano filtrate solo le future
- Card lezione: tap sull'header → espande lista partecipanti (con badge "SCALATA" verde se la lezione era stata scalata)
- ➕ arancione → modale "Aggiungi Cliente": ricerca cliente + checkbox "Scala lezione"
- ➖ rosso accanto a ogni partecipante → conferma rimozione, poi (se era scalata) chiede se riaccreditare

**Testato via curl:** force-add e admin-remove funzionano correttamente, scala/riaccredito coerenti ✅

## Fix Reset Giorno Selezionato dopo Prenotazione (28 Aprile 2026)
- `useEffect` con dipendenza `[lessons]` re-triggerava `setSelectedDate(firstAvailableDay)` dopo ogni reload — il cliente tornava al primo giorno disponibile dopo ogni prenotazione
- Fix: guardia `selectedDate === null` → auto-select solo al primo caricamento; la scelta dell'utente viene preservata dopo prenotazione/cancellazione

## Lezione Singola + Card Riepilogo Migliorata (28 Aprile 2026)
- Nuovo tipo abbonamento `lezione_singola` (1 lezione, 10€, validità 365gg)
  - Backend: aggiunto a `SubscriptionType` enum, `calculate_expiry_date`, `get_initial_lessons`; tutte le query `{"$in": ["lezioni_8","lezioni_16"]}` aggiornate per includerlo
  - Frontend: voce nel modale di creazione admin (`admin.tsx`) e nel rinnovo rapido dalla Home (`home.tsx`)
- Card riepilogo abbonamenti (tab Abbon. admin):
  - Mensile / Trimestrale → mostra solo `Scadenza: DD/MM/YYYY`
  - Lezione Singola / 8 Lezioni / 16 Lezioni → mostra `Lezioni residue: X/N`
  - Prova 7gg → mostra la scadenza
- Testato via API: `POST /api/subscriptions` con tipo `lezione_singola` ritorna `lezioni_rimanenti: 1` e scadenza +365gg ✅

## Fix Layout Partecipanti Prenota (28 Aprile 2026)
- Bug: quando si espandeva il dropdown "Chi partecipa?" in una lezione prenotata, il card si deformava (la sezione partecipanti era il 4° figlio di un container `flexDirection: row` e si allargava di lato anziché in basso)
- Fix: `lessonCard` passa da `flexDirection: row` a `column`; introdotto nuovo contenitore `lessonRow` (row) che raggruppa colorBar + lessonContent + bookButton; la `participantsSection` è ora full-width sotto la riga principale
- `participantsToggle` con borderTop per separazione visuale; `participantsList` con padding interno uniforme
- Risultato: l'espansione del dropdown cresce verticalmente senza alterare la griglia della card

## Esclusione Vincitori Mese Precedente (27 Aprile 2026)
- I 3 vincitori del mese precedente (1°, 2°, 3°) vengono esclusi dall'estrazione successiva
- Applicato sia all'estrazione automatica (`run_lottery_extraction`) che manuale admin (`/admin/lottery/extract-winner`)
- Aggiornato regolamento lotteria in premi.tsx per comunicare la regola agli utenti
- Testato: su 5 utenti, 3 ex-vincitori correttamente esclusi, solo 2 nuovi ammessi

## UI/UX Redesign FASE 2 (27 Aprile 2026)
Applicato il design system Tactical Obsidian / Kinetic Orange a TUTTE le pagine principali rimanenti:
- **`prenota.tsx`**: titoli in Bebas Neue (PRENOTA LEZIONE 38px), date selector con bordo Obsidian, lesson cards con border 1px #2C2C2E + barra colore 4px, button "PRENOTA" Montserrat Black uppercase, "MIE PRENOTAZIONI" banner Bebas Neue
- **`admin.tsx`**: title 38px Bebas Neue, tab pills uppercase Montserrat, statsCard con borderLeft 4px primary, KPI numbers Bebas Neue 32px, dayName uppercase, lessonTime Bebas Neue 18px, sectionTitle Bebas Neue 22px, subscription cards con bordo + borderLeft on expired
- **`profilo.tsx`**: PROFILO 38px Bebas Neue, userCard con border-top 4px orange, userName Bebas Neue uppercase, sectionTitle Bebas Neue, infoCard con border 1px, AMMINISTRATORE pill Montserrat Black uppercase, contactNumber Bebas Neue, ESCI button outline rosso
- **`alimentazione.tsx`**: rimosso COLORS locale (teal #4ECDC4) — ora usa COLORS globale (orange), header Bebas Neue 38px, infoCard con borderLeft 4px primary, calcCard con borderLeft 4px success (Neon Green) per macro values, button text bianco Montserrat Black uppercase
- Mantenuta retrocompatibilità: tutti i ref a COLORS.card e COLORS.cardLight continuano a funzionare (alias in constants.ts)
- Verificato via screenshot: home/profilo/admin/dieta tutti renderizzano col nuovo theme; bundler OK senza errori


## Task Futuri
### Night Beach Dark Theme — Mare Notturno Estivo (16 Giugno 2026)
Restyle dopo feedback utente che trovava il light theme poco leggibile. Switch da "Tropical Pop Light" → **"Night Beach"** (dark + tropical neon).

**Palette aggiornata (`constants.ts`):**
- primary: `#00C8FF` Turchese neon
- secondary: `#FF1493` Fucsia neon
- accent: `#FFEA00` Banana lemon
- background: `#0D1B2A` Deep night sea
- surface: `#1A2B3D` Card navy
- text: `#FFFFFF` (bianco su navy = alto contrasto)
- success: `#39FF14` Lime neon
- error: `#FF4D6D`

**Ombre Night Beach:** glow turchese (rgba(0,200,255,0.18-0.35))
**Hero overlay:** `rgba(13,27,42,0.55)` (navy translucido)
**Premi/VEGAS:** background navy notte, gold giallo neon, fucsia accent
**StreakBanner:** card navy, fiamma gialla, dots fucsia, glow turchese
**Silhouette estive mantenute** — risaltano bellissimo su navy

## Tropical Pop Light Restyling Completo (8 Giugno 2026)
Restyling completo dell'app da "Dark Obsidian + Kinetic Orange" → **"Tropical Pop Italian Riviera Summer 2026"** (tema chiaro/solare).

**Nuova palette centrale (`constants.ts`):**
- primary: `#0099DD` Azzurro Mare (sostituisce Kinetic Orange)
- secondary: `#FF1493` Fucsia POP
- accent: `#FFEA00` Banana Yellow
- background: `#F0F9FF` Sky Tint White (era #0A0A0A obsidian)
- surface: `#FFFFFF` Pure White cards
- text: `#0C2333` Deep Navy (era #FFFFFF)
- coral, sand, accentLime per pop estivo
- Gradient sunset (fucsia → arancio) + sea (azzurro → cyan)

**Nuovo Sistema Ombre (`theme.ts`):**
- summerSoft: `0 8px 24px rgba(0,153,221,0.12)` (più morbide)
- RADII bumped: sm 6→12, md 10→16, lg 14→24

**Nuovo componente decorativo:**
- `/app/frontend/src/components/SummerSilhouettes.tsx` — overlay assoluto con silhouette estive (palme, sole, onde, ombrelloni, gelati, occhiali, fiamme cuori) a opacity 11-20%, 8 varianti per schermata (home/altro/shop/maestro/prenota/classifica/eventi/login)

**Hero immagine aggiornata:** Pool/beach Unsplash + overlay azzurro mare (rgba(0,153,221,0.35))

**Schermate aggiornate manualmente:**
- `home.tsx`: hero overlay blu, kicker giallo banana shadow, silhouette estive
- `login.tsx`: silhouette login (sole 220px, palme, ombrelloni)
- `altro.tsx`: silhouette variant altro
- `maestro.tsx`: silhouette cuori/fiamme/sole
- `premi.tsx`: VEGAS_COLORS aggiornato tropical (background F0F9FF, fucsia/sunset gold), bulk replace di tutti i rgba(0,0,0,X) → rgba(255,255,255,X)
- `StreakBanner.tsx`: card bianca con ombra azzurra, dots blu/giallo, modal tropical

## Top 3 della Settimana — Maestro Curated (1 Maggio 2026)
Pubblicazione settimanale anonima delle 3 risposte più divertenti del Maestro, curate da Daniele.

**Backend (`server.py`):**
- Helper `_iso_week_key(dt)` → "YYYY-Www" (settimana ISO Monday-based, anchor jan4)
- `GET /api/admin/maestro/week-pool?settimana=YYYY-Www` (default = scorsa) — restituisce tutte le domande della settimana per l'admin (con user_nome)
- `POST /api/admin/maestro/publish-top` body `{settimana, question_ids: [1-3]}` — upsert in `maestro_top` (idempotente)
- `GET /api/maestro/top` — pubblica anonima per tutti gli utenti (ritorna SOLO `argomento`, `domanda`, `risposta` — niente nomi/ID/date)
- `DELETE /api/admin/maestro/publish-top/{settimana}` — admin rimuove pubblicazione
- Privacy verificata server-side: nessun leak di `user_nome`/`user_id`/`data`/`created_at`

**Frontend (`maestro.tsx`):**
- Box collassabile **"COME FUNZIONA"** in cima con 4 regole numerate (3 argomenti + 250 caratteri, +1 biglietto/1 al giorno, lunedì Top 3 anonima, sarcasmo + off-topic respinte)
- Sezione **"TOP X DELLA SETTIMANA"** sotto il form: card con medaglia oro numerata, badge argomento colorato, chip "ANONIMO" (eye-off), DOMANDA citazione + RISPOSTA DEL MAESTRO. Nessun nome utente nel DOM.
- **Pannello Admin** condizionale: gold-bordered con switch toggle SCORSA/CORRENTE settimana, lista domande selezionabili (max 3 → checkbox oro), pulsante "PUBBLICA TOP (n/3)", "Ricarica" + messaggi di feedback. Form domanda nascosto per admin.
- Card "CHIEDI AL MAESTRO" in Altro ora visibile anche all'admin (per accedere al pannello curation)

**Test:** 15/15 backend pytest + 12/12 frontend checkpoint passati ✅

## Chiedi al Maestro — Q&A AI Sarcastico (1 Maggio 2026)
Nuova feature in tab "Altro": l'utente può fare 1 domanda al giorno al "Maestro" su Amore, Sesso o Lavoro e riceve risposta sarcastica AI in stile palestra.

**Backend (`server.py`):**
- 4 endpoint: `POST /api/maestro/ask`, `GET /api/maestro/today`, `GET /api/maestro/history`, `GET /api/admin/maestro/all`
- Modello: `gpt-4.1-mini` via Emergent LLM Key (HTTPx pattern già in uso per la dieta), temperature 0.95, max 220 token
- Prompt sistema "MAESTRO_SYSTEM_PROMPT": tono bastardo-affettuoso, 3 argomenti only (amore/sesso/lavoro), rifiuta fuori-tema con sarcasmo, max 100 parole, riferimenti palestra graditi
- Limite 1 domanda/giorno per utente (key `{user_id, data}`), HTTP 429 al secondo tentativo
- **+1 biglietto lotteria** automatico nel mese corrente (atomic upsert su `wheel_tickets`)
- Validazione: 5 ≤ caratteri ≤ 250, argomento ∈ {amore,sesso,lavoro}
- Collection `maestro_questions`: `{user_id, user_nome, argomento, domanda, risposta, data, mese, biglietto_dato, created_at}`

**Frontend:**
- Nuova schermata `app/(tabs)/maestro.tsx`: hero "CHIEDI AL MAESTRO" Bebas Neue 44px + 3 chip colorati (AMORE rosa, SESSO arancio, LAVORO blu), TextInput multiline + counter 250, submit "CHIEDI AL MAESTRO" arancione
- Stato bloccato (post-domanda): card risposta animata con badge argomento + "TU HAI CHIESTO" (citazione) → divider → "IL MAESTRO RISPONDE", banner +1 biglietto giallo
- Archivio personale ultime 30 risposte sotto la domanda di oggi
- Card "CHIEDI AL MAESTRO" in cima al tab Altro (rosa, icona chatbubble), nascosta per admin/istruttore
- Tab `maestro` in `_layout.tsx` con `href: null` (route esiste, non in bottom bar)

**Costo:** ~0.035 cent/domanda → **~1€/mese** anche con 80 utenti tutti i giorni.

**Test:** 11/11 backend pytest + 16/16 frontend checkpoint passati ✅

## Riorganizzazione Bottom Tab Bar + Banda KPI Home (1 Maggio 2026)
Bottom bar passa da 10+ tab a SOLO 5 tab fisse per il cliente:
- 🏠 Home • 📅 Prenota • 🎁 Premi • 🛒 Shop • ⋯ Altro
Per admin: Home, Lezioni, Admin, Premi, Shop, Altro (Profilo accessibile da Altro).

**Nuovi file:**
- `app/(tabs)/altro.tsx` — griglia 2-col animata (stagger 60ms, spring on press) con 6 card: DIETA AI, CLASSIFICA, CURIOSITÀ, EVENTI, ABBONAMENTO, PROFILO. Routing via `router.push()`.
- `src/components/KPIBanner.tsx` — banner Home (solo cliente): 🔥 STREAK / 🎟️ BIGLIETTI / ⏳ GIORNI/LEZIONI. Carica in parallelo `/streak/status`, `/lottery/status`, `/subscriptions/me` con graceful fallback.

**Modifiche `_layout.tsx`:** 6 tab nascoste con `href: null` (alimentazione, abbonamento, curiosita, classifica, eventi, profilo) + nuova `altro` con icona `apps`.

**Test agent:** 13/13 PASS su mobile (390x844) e desktop (1280x900).


## Riattivazione Account via WhatsApp per Utenti Archiviati (30 Giugno 2026)
Quando l'admin archivia un cliente, il cliente all'ingresso vede la schermata "Account Sospeso" (in `app/(tabs)/profilo.tsx`). Aggiunta una CTA verde WhatsApp **"RIATTIVA ACCOUNT E ABBONAMENTO"** sopra il pulsante logout.

**Flow:**
1. Click sulla CTA → si apre un Modal con 5 opzioni di abbonamento (radio): Lezione Singola (10€), 8 Lezioni (55€), 16 Lezioni (95€), Mensile (65€), Trimestrale (175€).
2. Selezionata una opzione, il pulsante "APRI WHATSAPP E INVIA" diventa attivo.
3. Click → apre `wa.me/393395020625` con messaggio pre-compilato:  
   `Ciao Daniele! Sono [Nome Cognome] e vorrei riattivare il mio account su DanoFitness.\n\nAbbonamento scelto: [tipo] ([prezzo])\n\nFammi sapere come procedere. Grazie!`

**File modificato:** `app/(tabs)/profilo.tsx` (import `Linking` + `Platform`, state `showReactivateModal`/`selectedReactivateKey`, costanti `DANIELE_WA_NUMBER` e `REACTIVATION_OPTIONS`, helper `buildReactivationMessage`/`handleOpenWhatsAppReactivation`, Modal con radio list e stili).

**Test:** Verifica e2e tramite Playwright — `wait_for_selector('text=Account Sospeso')` + click testID `archived-reactivate-btn` + selezione `reactivate-option-mensile` → tutti i selector trovati, modal funzionante. TypeScript compile pulito su `profilo.tsx`.

## Pannello Avvisi Popup — Admin Self-Service (2 Luglio 2026)
Sistema completo per gestire i popup di avviso dall'Admin senza dover richiedere modifiche al codice.

**Backend (`backend/server.py`)**: nuova collezione `admin_announcements` + endpoints:
- `GET /api/announcements/active` → lista annunci ATTIVI + non scaduti (visibile ad ogni utente loggato non archiviato)
- `GET /api/admin/announcements` → lista completa (admin)
- `POST /api/admin/announcements` → crea
- `PUT /api/admin/announcements/{id}` → modifica (con flag `scadenza_clear` per rimuovere scadenza)
- `PATCH /api/admin/announcements/{id}/toggle` → attiva/disattiva
- `DELETE /api/admin/announcements/{id}` → elimina definitivo

**Campi annuncio:** `titolo`, `messaggio`, `colore` (orange/red/yellow/blue/green), `lampeggiante` (bool), `attivo` (bool), `scadenza` (datetime opzionale).

**Frontend:**
- `src/components/AdminAnnouncementPopup.tsx` — fetcha annunci attivi all'apertura app, mostra i popup **a cascata (uno alla volta)**, con contatore "Avviso X di N". Titolo lampeggiante se abilitato. Pulsante "OK, ho letto" (chiude solo la sessione) + "Non mostrarmi più oggi" (localStorage per ID, reset a mezzanotte).
- `src/components/AdminAnnouncementsPanel.tsx` — pannello: form completo (titolo/messaggio/scelta colore/switch lampeggiante/switch attivo/scadenza YYYY-MM-DD + HH:MM), lista card con badge stato (ATTIVO/OFF/SCADUTO), azioni per card (Attiva/Disattiva, Modifica, Elimina).
- Nuova route `app/(tabs)/avvisi.tsx` con header dedicato — la tab compare **in fondo nella barra bottom** con icona 📢 (visibile solo admin, href `null` per gli altri).
- `<AdminAnnouncementPopup />` renderizzato in `app/(tabs)/_layout.tsx` per tutti gli utenti non archiviati.

**Test:** Backend testato end-to-end via curl (create × 2, list active, toggle, delete). Popup client visibile all'apertura app (Playwright: `wait_for_selector('[data-testid^="announcement-popup-"]')` ✅). Route `/avvisi` renderizza correttamente. TypeScript compile pulito.

**Come si usa (dal telefono di Daniele):**
1. Tap sulla tab **Avvisi** 📢 nella barra in basso → click **NUOVO**
2. Compila titolo, messaggio, sceglie colore, opzionale lampeggio + scadenza
3. Salva → il popup appare a **tutti** i clienti/istruttori alla prossima apertura app
4. Per rimuoverlo: Disattiva (rimane in archivio) o Elimina (definitivo)

**Aggiornamento (2 Luglio 2026 - richiesto da Daniele):** la voce "Avvisi" è stata **spostata dalla sub-tab interna del pannello Admin alla barra di navigazione in basso** (perché "si leggeva malissimo" tra le altre sub-tab). Ora è una tab dedicata top-level tipo Home/Prenota/Admin, visibile solo per l'admin.

## Pannello Orari & Lezioni — Admin Self-Service (7 Luglio 2026)
Nuova tab dedicata `📅 Orari` (icona calendar) nella barra bottom, visibile solo per admin.

**Backend** (`server.py` sezioni ATTIVITÀ e ADMIN LESSONS CRUD):
- Nuova collection `activities` con seed automatico di 6 attività di default (circuito, funzionale, pilates, yoga, acquapower, acquagag) su startup se collezione vuota. Ogni doc: `key`, `nome`, `colore`, `icona`, `is_default`.
- Endpoints attività: `GET /api/activities`, `POST/PUT/DELETE /api/admin/activities`. Delete guard: rifiuta se attività ancora in uso da lezioni.
- Endpoints lezioni: `POST/PUT/DELETE /api/admin/lessons` con validazione giorno (VALID_DAYS) + orario HH:MM regex + tipo_attivita esistente + no duplicati (stesso giorno+orario). Cache `all_lessons` invalidata su ogni CUD.

**Frontend:**
- `src/components/LessonScheduleManager.tsx` — componente principale: vista lista raggruppata per giorno (Lunedì..Domenica) con card lezione (orario, attività, coach, descrizione, Modifica/Elimina). Header con pulsanti "NUOVA LEZIONE" (form completo) e "Gestisci Attività" (sotto-modale). Ogni giorno ha un "Aggiungi" quick-shortcut.
- Sotto-modale `ActivitiesModal`: aggiungi/rimuovi attività (nome + palette 10 colori). Attività default hanno badge "DEFAULT".
- `app/(tabs)/orari.tsx` — route dedicata con `isAdmin` gate + `<LessonScheduleManager />`.
- Tab bar entry in `_layout.tsx` con `href` admin-only + icona 📅.
- `api.ts` aggiornato con tipi `Activity`, `ActivityPayload`, `LessonPayload` + 7 nuovi metodi API.

**Test (iteration_13.json):** Backend 100% (6/6 pytest passati) — seed, CRUD, duplicate/in-use guards, validation, cache invalidation, admin auth. Frontend 100% — tab visibile, route caricata, lezioni renderizzate correttamente, modal creazione OK. Cleanup automatico. Nessun bug trovato.

**Come si usa:**
1. Tap sulla tab 📅 **Orari** nella barra in basso.
2. **NUOVA LEZIONE** → scegli giorno chip, digita orario (HH:MM), scegli attività chip, coach, opzionale descrizione, SALVA.
3. **Gestisci Attività** → aggiungi nuove tipologie (Zumba, Spinning, ecc.) con colore custom. Le default non si eliminano se usate.
4. **Modifica/Elimina** dalla card della singola lezione.


## Duplica Settimana + Notifiche Sonore (7 Luglio 2026)

### Duplica Settimana (Backup/Restore Orario)
Nuova collezione `schedule_snapshots` con endpoints admin CRUD:
- `POST /api/admin/schedule-snapshots` → crea snapshot dell'orario corrente (nome opzionale, default "Backup DD/MM/YYYY HH:MM")
- `GET /api/admin/schedule-snapshots` → lista (proiezione senza campo pesante `lessons`)
- `POST /api/admin/schedule-snapshots/{id}/restore` → delete tutte le lezioni correnti + insert dallo snapshot + cache invalidation
- `DELETE /api/admin/schedule-snapshots/{id}` → elimina snapshot
- Cap alzato a 2000 lezioni per sicurezza future.

Frontend: nuovo sotto-modale `SnapshotsModal` in `LessonScheduleManager.tsx` accessibile via pulsante "Duplica Settimana" nel pannello Orari. UI: form nome + salva + lista backup con azioni Ripristina/Elimina. Confirm dialog al restore (avviso di sostituzione totale).

### Notifiche Sonore + Badge Tab Avvisi
- **Web Audio API ding** (`src/utils/notificationSound.ts`): 2 note (C6 + G5 con 80ms delay) per un effetto campanella. Cross-browser, senza asset esterni. No-op su native.
- **`AdminAnnouncementPopup`** ora suona il ding UNA volta per ogni avviso nuovo mai visto. Traccia gli ID in localStorage key `announce_sounds_played` (permanente, cap 500 ID). Non risuona su riaperture app.
- **Badge tab Avvisi** in `_layout.tsx`: state `activeAnnouncementCount` con polling 60s. Se N > 0 mostra pallino rosso con numero sul tab 📢.

### Test (iteration_14.json)
- Backend 100% — 13/13 pytest passati (auth gating, CRUD, list projection, restore E2E preserva giorno/orario/tipo/coach, error handling 400/404).
- Frontend 100% — pulsante Duplica Settimana visibile, modale creazione OK, restore/delete verificati. Ding: localStorage popolato al primo popup, NON re-fired al reload. Badge Avvisi: numero corretto nel bottom bar.
- Test file: `/app/backend/tests/test_schedule_snapshots.py`.



## Task Pianificati Futuri
### P1
- Sistema Notifiche In-App (icona campanella) per lezioni cancellate, abbonamenti in scadenza, classifica
- "Porta un Amico" (sistema referral per biglietti lotteria bonus)
- Gamification avanzata (streak e milestone)

### P2  
- Integrazione Instagram per bonus
- UI/UX: Dark/Light mode, calendario visuale, pagina statistiche personali
- Aggiornamento dipendenze frontend outdated

### P3
- Modularizzazione server.py (~5400 righe) in router separati


## Web Push Notifications (7 Luglio 2026)

**Obiettivo**: notifiche di sistema sul telefono dei clienti **anche ad app chiusa** quando l'admin pubblica un avviso.

### Backend (`server.py` sezione WEB PUSH NOTIFICATIONS)
- Aggiunta libreria `pywebpush==2.3.0` in requirements.txt.
- VAPID keys generate una tantum (secp256r1) e salvate in `/app/backend/.env`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:danielebrufani@gmail.com`.
- Nuova collezione `push_subscriptions` (fields: user_id, endpoint, p256dh, auth, created_at, updated_at).
- Endpoints:
  - `GET /api/push/vapid-public-key` (pubblico, no auth) → chiave VAPID per il client
  - `GET /api/push/status` (auth) → { subscribed, devices }
  - `POST /api/push/subscribe` (auth) → upsert idempotente per (user_id, endpoint)
  - `POST /api/push/unsubscribe` (auth) → rimuove sub
- Helper `send_push_to_all_users(title, body, tag)` → itera su tutte le sub (escluse archiviate), invia webpush, cleanup automatico su 404/410 (subscription scadute).
- Hook nell'endpoint `POST /admin/announcements` e `PATCH /admin/announcements/{id}/toggle`: se l'annuncio viene creato/riattivato con `attivo=true`, invia push a tutti in tempo reale. Response include `push_stats={sent, failed, expired_cleaned}`.

### Frontend
- Service worker `/app/frontend/public/sw.js` (già esistente, patchato per `data.tag` dinamico dal backend). Gestisce `push` event (mostra notification con vibrate + sound), `notificationclick` (apre l'app o focus).
- Nuovo componente `src/components/PushNotificationButton.tsx`:
  - Detection stabile del support browser via `useState(lazy)` (fix bug iter_15).
  - Legge `Notification.permission` all'apertura.
  - Rendering condizionale: `push-btn-unsupported` (no serviceWorker/PushManager), `push-btn-denied` (permission=denied), `push-btn-subscribe` (default, CTA arancione), `push-btn-unsubscribe` (già attivo, verde).
  - Flow subscribe: `Notification.requestPermission()` → `serviceWorker.register('/sw.js')` → `getVapidPublicKey()` → `pushManager.subscribe({applicationServerKey})` → `pushSubscribe(endpoint+keys)` a backend.
- Pulsante integrato in `app/(tabs)/altro.tsx` in fondo alla schermata (visibile a tutti gli utenti non archiviati).
- 4 nuovi metodi `apiService`: `getVapidPublicKey`, `getPushStatus`, `pushSubscribe`, `pushUnsubscribe`.

### Test
- **Iteration_15**: Backend 100% (10/10 pytest). Frontend bug: pulsante non renderizzato per `checking` gate.
- **Iteration_16 (retest)**: Frontend 100% dopo fix del gate + stabilizzazione `isSupported`. Card `push-btn-denied` visibile in chromium headless (permission=denied by default), tutte le grid altro-card restano visibili sopra.

### Limitazioni note
- iOS Safari richiede che l'app sia stata **"aggiunta a Home"** dal browser prima di poter ricevere push (iOS 16.4+). Il messaggio nel card `push-btn-unsupported` guida l'utente.
- Broadcast attualmente sincrono all'interno della create/toggle announcement handler. Con centinaia di subscriber sarà da spostare in `BackgroundTasks`. Cap 5000 sub per broadcast.

### Come si usa (Daniele)
1. Ogni cliente apre l'app → tab **Altro** → in fondo trova il pulsante arancione **"ATTIVA NOTIFICHE PUSH"** → tap → il browser chiede il permesso → conferma.
2. D'ora in avanti, ogni volta che Daniele pubblica un nuovo annuncio dalla tab **Avvisi**, quel cliente riceve una notifica di sistema sul telefono (con suono) anche se l'app è chiusa.
3. Per disattivare: tap sul pulsante verde "NOTIFICHE ATTIVE ✓".

## Popup Opt-in Notifiche per Utenti Esistenti (7 Luglio 2026)

**Obiettivo**: al prossimo accesso, tutti i VECCHI utenti che non hanno ancora attivato le notifiche push vedono un popup con pulsante "ATTIVA NOTIFICHE". Frequenza scelta dall'utente: **una volta al giorno** finché non attivano (opzione b).

### Implementazione
- Nuovo util condiviso `src/utils/pushSubscribe.ts`: `isPushSupported()` + `subscribeToPush()` (logica estratta da `PushNotificationButton`, ora usata da entrambi i componenti — niente duplicazione).
- Nuovo componente `src/components/PushOptInPopup.tsx` (Modal, palette arancione #FF6B00, titolo Bebas "NON PERDERTI NIENTE!"):
  - Mostra SOLO se: web + push supportate + `Notification.permission !== 'denied'` + non già subscribed (check `GET /push/status`) + non dismissato oggi (localStorage `push_optin_dismissed_date`).
  - Skip per nuovissimi iscritti (`onboardingStatus.is_brand_new && can_self_activate_trial`) perché hanno già il pulsante nel WelcomeGate. Il check onboarding è SALTATO per admin/istruttore (non vedono mai il gate ma l'endpoint li segna brand_new).
  - CTA "ATTIVA NOTIFICHE" → `subscribeToPush()`; successo = stato verde "NOTIFICHE ATTIVE!" + auto-chiusura 2.2s; permesso negato dal prompt = dismiss silenzioso; errore = messaggio inline.
  - "Non ora, ricordamelo domani" / X = salva data odierna in localStorage → riappare domani.
  - testIDs: `push-optin-popup`, `push-optin-activate`, `push-optin-dismiss`, `push-optin-close`.
- Montato in `app/(tabs)/_layout.tsx` dopo `AdminAnnouncementPopup` (`!isArchived`).

### Test (self-test Playwright, 7 Lug 2026)
- Admin login → popup visibile, CTA+dismiss presenti, dismiss chiude e salva localStorage, reload → non riappare oggi. ✓
- Client nuovissimo → NO popup, WelcomeGate col suo pulsante push (refactor intatto). ✓
- Nota headless: `Notification.permission` è 'denied' di default in chromium headless → testato con override init-script a 'default'.
- Nota ambiente: dopo la creazione dei nuovi file Metro serviva un bundle stale → risolto con `supervisorctl restart frontend`.

## Debug: popup non appare in produzione (7 Luglio 2026, sera)

**Segnalazione utente**: dopo "Save to Github", aprendo un profilo vecchio su Android/PC il popup notifiche non appare.

### Diagnosi (verificata con curl sul live)
- Frontend Vercel (danofitness23.vercel.app): AGGIORNATO ✓ (il bundle `entry-83da404e...js` contiene `push-optin-popup`).
- Backend Render (https://diobestia.onrender.com): **VECCHIO** ✗ — `/api/push/status` → 404, `/api/push/vapid-public-key` → `{"publicKey":"temp"}` (stub legacy pre-13:06 del 7/7).
- Il popup chiama `GET /push/status` prima di mostrarsi → 404 → catch silenzioso → popup nascosto. Comportamento coerente col codice.
- Causa: il deploy Render non è partito/è fallito dopo il push. In più su Render MANCANO le env `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (sono solo nel .env locale, gitignorato).

### Fix applicati in preview
- Rimossi endpoint push LEGACY duplicati in `server.py` (ex righe 4608-4638: GET vapid con `publicKey`, POST subscribe su `users.push_subscription`, DELETE unsubscribe). Restano solo i nuovi (righe ~1144-1195, collection `push_subscriptions`). Endpoint expo-token e helper legacy `send_push_notification` intatti (usati in 5 punti).
- Sanity check preview: vapid-public-key restituisce `public_key` corretto, push/status 200 con auth. ✓

### Azioni RICHIESTE ALL'UTENTE su Render (dashboard servizio "diobestia")
1. Environment → aggiungere: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (valori nel .env backend locale).
2. Manual Deploy → "Deploy latest commit" (o verificare perché l'auto-deploy è fallito negli Events).
3. Verifica: https://diobestia.onrender.com/api/push/vapid-public-key deve rispondere `{"public_key":"BEWmP8..."}` e NON `{"publicKey":"temp"}`.
4. Nuovo "Save to Github" per portare online anche la pulizia dei duplicati.

### Root cause CONFERMATA dai log Render forniti dall'utente (7 Lug 2026)
- Build Render FALLITA: `ERROR: No matching distribution found for emergentintegrations==0.1.0` — il pip freeze della sessione precedente ha incluso `emergentintegrations` in requirements.txt SENZA l'extra index CDN.
- Render usava anche Python 3.14.3 (default) vs 3.11.15 del pod.

### Fix applicati
1. `backend/requirements.txt`: aggiunta prima riga `--extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/` (verificato: tutte le altre 126 pin esistono su PyPI pubblico, incluso google-auth==2.49.0.dev0; solo emergentintegrations sta sul CDN). Dry-run pip OK.
2. Creato `backend/.python-version` = `3.11.15` per allineare Render all'ambiente di sviluppo (alternativa: env var PYTHON_VERSION su Render).

### Prossimi step utente: Save to Github → Render deploy → aggiungere 3 env VAPID su Render → verificare /api/push/vapid-public-key.

### Fix definitivo VAPID senza intervento su Render (7 Lug 2026, sera)
- Utente ha chiesto "fallo tu" (non vuole/riesce a modificare le env su Render, dove VAPID_PUBLIC_KEY è settata al placeholder "temp").
- Soluzione: in `server.py` (sezione WEB PUSH) le chiavi VAPID ora hanno fallback nel codice: `_vapid_from_env()` usa l'env solo se presente e != "temp", altrimenti le chiavi ufficiali del progetto (_DEFAULT_VAPID_PUBLIC_KEY/_DEFAULT_VAPID_PRIVATE_KEY, le stesse del .env locale). VAPID_SUBJECT default mailto:danielebrufani@gmail.com.
- Testato: env="temp" → chiave vera; env mancante → chiave vera; env custom → rispettata. Endpoint preview OK.
- NOTA: dopo il prossimo Save to Github, Render risponderà con la chiave vera SENZA toccare le env. Se in futuro si ruotano le chiavi, basta settare le env su Render (hanno precedenza, tranne "temp").
- NOTA BROWSER: l'utente usa Brave su Android → per ricevere push serve attivare "Usa i servizi Google per la messaggistica push" in brave://settings/privacy (di default è OFF su Brave).

## RIMOZIONE Popup Opt-in Notifiche (7 Lug 2026, sera - richiesta utente)
- Utente: "togli le notifiche danno problemi" → rimosso il popup opt-in all'accesso.
- Eliminato `src/components/PushOptInPopup.tsx`; rimossi import+mount da `app/(tabs)/_layout.tsx`; aggiornato commento in `pushSubscribe.ts`.
- RESTA ATTIVO: tutto il sistema web push (backend + service worker + pulsante "ATTIVA NOTIFICHE PUSH" nel tab Altro e nel WelcomeGate + fallback chiavi VAPID in server.py). Solo il popup automatico è stato tolto.
- Verificato con screenshot: login admin → nessun popup, dashboard OK.
- Se in futuro l'utente rivuole il popup: recuperabile da git history (commit del 7/7 pomeriggio, componente PushOptInPopup).

## Ricerca Utenti Admin: inclusi gli ARCHIVIATI (9 Lug 2026)
- Richiesta: "inserisci nella ricerca utenti ANCHE GLI UTENTI ARCHIVIATI".
- `admin.tsx`: `filteredUsers` ora, SOLO quando c'è una query di ricerca, unisce `users` + `archivedUsers` (dedup per id). Senza query la lista mostra solo gli attivi come prima (gli archiviati hanno la loro tab "Archivio").
- Card utente archiviato nei risultati: badge viola "ARCHIVIATO" (testID `archived-badge-{id}`), pulsante verde "Riattiva" (testID `restore-user-{id}`, chiama `handleRestoreUser`) al posto di "Archivia"; nascosto il pulsante "Istruttore" per gli archiviati. Contatore "X di N" ora usa attivi+archiviati come denominatore.
- Test Playwright: ricerca "Test Client" archiviato → badge+Riattiva OK; ricerca "Marco" attivo → nessun badge, Archivia presente. Utente di test poi ripristinato.
- NOTA: 2 errori TS pre-esistenti in admin.tsx righe ~1205/1215 (prop 'cognome' su tipo booking) NON introdotti da questa modifica, non bloccanti per Metro.

## Lezioni SPECIALI una tantum + Acquagym venerdì 17/07 (13 Lug 2026)
- Richiesta: "lezione speciale solo per questa settimana venerdì 18.30 acquagym ALLA PISCINA CAMPING". Oggi (orologio server) = lunedì 13/07/2026 → venerdì = 2026-07-17. (Primo tentativo con 10/07 corretto: era già passato.)
- **Backend** (`server.py`):
  - Campo `data_specifica` (YYYY-MM-DD, opzionale) su lessons: LessonCreate/Update/Response.
  - `_lesson_is_visible()`: le lezioni una tantum spariscono da GET /lessons e /lessons/day dopo la loro data.
  - `_validate_data_specifica()`: valida formato e DERIVA il giorno della settimana dalla data (GIORNI_IT_ORDER).
  - Dup-check giorno+orario ora include data_specifica (una speciale può coesistere con una ricorrente stesso slot).
  - `create_booking`: se lesson.data_specifica != data_lezione → 400 "lezione speciale valida solo il DD/MM/YYYY".
  - Startup migration idempotente: attività "acquagym" (#00C8FF, pool) + upsert lezione {venerdi, 18:30, data_specifica 2026-07-17, coach Daniele, descr Piscina Camping} + cleanup tentativo 10/07. Girerà su PROD al prossimo deploy Render.
- **Frontend**: `Lesson`/`LessonPayload` +data_specifica; `constants.ts` ATTIVITA_INFO +acquagym; `prenota.tsx` getLessonsForDate (filtra per data, 3 call sites) + badge giallo "⭐ LEZIONE SPECIALE · SOLO QUESTA SETTIMANA"; `LessonScheduleManager.tsx` campo form "Lezione speciale: solo per una data (opzionale)" (testID lesson-form-data-specifica) + badge "SOLO DD/MM" nella lista (testID lesson-oneoff-{id}).
- **Test**: curl prenotazione data sbagliata → 400 ✓; data giusta 17/07 → creata (poi cancellata) ✓; screenshot prenota: venerdì 17 mostra Acquagym+badge, lunedì no ✓. TSC pulito.
- NOTA: testclient_kpi@test.com ora ha PROVA 7 GIORNI attiva (scade 20/07) — attivata per il test.
- L'admin può creare future lezioni una tantum da Orari → Nuova Lezione → campo data.
