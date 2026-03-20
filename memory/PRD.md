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

## Credenziali Test
- Email: danielebrufani@gmail.com
- Password: Mariavittoria23

## Task Futuri
### P1
- "Porta un Amico" (sistema referral per biglietti lotteria bonus)
- Gamification avanzata (streak e milestone)

### P2  
- Integrazione Instagram per bonus
- UI/UX: Dark/Light mode, calendario visuale, pagina statistiche personali
- Aggiornamento dipendenze frontend outdated
