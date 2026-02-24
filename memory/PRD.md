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
- Scalatura automatica lezioni (job ogni 30 min)
- Alert abbonamento scaduto
- Tab "Scaduti" per admin
- Ordinamento alfabetico utenti/abbonamenti

### Session 2026-02-24 ✅
- Aggiunto messaggio di benvenuto grande nella Home:
  - "Ciao [Nome]!" (32px bold)
  - "Signore Pietà, Cristo pietà" (citazione in corsivo)
- **Corretto fuso orario**: Backend ora usa Europe/Rome invece di UTC
  - Scalatura lezioni usa orario italiano
  - Job automatici usano orario italiano

## Known Issues (P0-P1)
1. **P0 - Logout si blocca**: App si congela al logout
2. **P1 - Allegati chat**: Funzione incompleta/rotta
3. **P1 - UI Login**: Testo "oppure" possibilmente troncato

## Backlog
- P2: Migrazione Expo SDK 54 → 55 (futuro)
- P2: Pulizia codice notifiche push (rimosso ma file residui)
- P2: Miglioramento storage allegati (da base64 a file storage)

## Credentials
- **Admin**: admin@danofitness.it / DanoFitness2025!

## Important Notes
- Push notifications RIMOSSE (utente le ha trovate complicate)
- Modifiche visibili su Expo Go solo dopo DEPLOY + riavvio app
- Il sistema di scalatura lezioni ora usa l'orario italiano (Europe/Rome)
