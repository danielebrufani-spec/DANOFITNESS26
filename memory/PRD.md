# DanoFitness23 - Product Requirements Document

## Original Problem Statement
Applicazione di prenotazione fitness per "DanoFitness23" con:
- Interfaccia Admin (Daniele) e Client
- Registrazione utenti con email, telefono e foto profilo
- Sistema prenotazioni settimanali (Lun-Sab)
- Gestione abbonamenti (solo admin)
- Chat interna (solo admin può iniziare, clienti rispondono)
- Orario invernale con attività (Circuito, Workout Funzionale, Pilates, Yoga)

## Tech Stack
- **Frontend**: React Native, Expo SDK 54, Expo Router, Zustand, Axios
- **Backend**: Python, FastAPI, Pydantic, APScheduler
- **Database**: MongoDB
- **Timezone**: Europe/Rome (orario italiano)

## What's Been Implemented

### Core Features ✅
- Login/Registrazione utenti
- Dashboard Admin con statistiche giornaliere
- Sistema prenotazioni lezioni
- Gestione abbonamenti (lezioni e tempo)
- Chat tra admin e clienti
- Scalatura automatica lezioni (job ogni 30 min, orario italiano)
- Alert abbonamento scaduto
- Tab "Scaduti" per admin
- Ordinamento alfabetico utenti/abbonamenti

### Session 2026-02-25 ✅
- Messaggio benvenuto Home: "Ciao [Nome]!" + "Signore Pietà, Cristo pietà"
- Orario italiano (Europe/Rome) per scalatura lezioni
- **Admin Tab Presenze**: "Presenze Totali Settimanali" in alto
- **Admin Tab Abbonamenti**: Barra di ricerca per cliente
- **Modal Modifica Abbonamento** completamente rifatto:
  - Selezione tipo abbonamento (8 lezioni, 16 lezioni, mensile, trimestrale)
  - Pulsanti +/- grandi per lezioni rimanenti
  - Pulsanti rapidi data (+1 mese, +3 mesi, +1 anno)
  - ScrollView per evitare che contenuti siano coperti
  - Pulsanti Salva/Elimina grandi e accessibili

## Known Issues (P0)
1. **P0 - Logout si blocca**: App si congela al logout

## Backlog
- P2: Migrazione Expo SDK 54 → 55 (futuro)
- P2: Allegati chat da completare

## Credentials
- **Admin**: admin@danofitness.it / DanoFitness2025!

## Important Notes
- Push notifications RIMOSSE
- Modifiche visibili su Expo Go solo dopo DEPLOY + riavvio app
