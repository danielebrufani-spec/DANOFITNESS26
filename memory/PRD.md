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

## Esclusione Vincitori Mese Precedente (27 Aprile 2026)
- I 3 vincitori del mese precedente (1°, 2°, 3°) vengono esclusi dall'estrazione successiva
- Applicato sia all'estrazione automatica (`run_lottery_extraction`) che manuale admin (`/admin/lottery/extract-winner`)
- Aggiornato regolamento lotteria in premi.tsx per comunicare la regola agli utenti
- Testato: su 5 utenti, 3 ex-vincitori correttamente esclusi, solo 2 nuovi ammessi

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
