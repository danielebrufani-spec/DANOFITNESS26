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
