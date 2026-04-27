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
