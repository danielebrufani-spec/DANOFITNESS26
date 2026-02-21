# DanoFitness23 - Product Requirements Document

## Overview
App mobile per la gestione delle prenotazioni di lezioni fitness per la palestra "Danofitness23" di Daniele.

## User Personas
- **Admin (Daniele)**: Gestisce utenti, abbonamenti, visualizza prenotazioni settimanali
- **Clienti**: Si registrano, prenotano lezioni, gestiscono il proprio profilo

## Core Requirements

### 1. User Management
- [x] Registrazione clienti
- [x] Login con JWT authentication
- [x] Admin può eliminare utenti
- [x] Admin può visualizzare tutti gli utenti

### 2. Subscription Management
- [x] Abbonamenti a lezioni (8 o 16 lezioni)
- [x] Abbonamenti a tempo (mensile, trimestrale)
- [x] Admin può creare, modificare, eliminare abbonamenti
- [x] Scalatura automatica lezioni a mezzanotte

### 3. Booking System
- [x] Clienti possono prenotare lezioni
- [x] Clienti possono cancellare prenotazioni
- [x] Vista settimanale (Lun-Sab) per admin
- [x] Refresh automatico ogni 30 secondi
- [x] Bottone refresh manuale

### 4. Class Schedule
- [x] Orario settimanale predefinito
- [x] Attività: Circuito, Funzionale, Pilates, Yoga
- [x] Prenotazioni settimana prossima aprono Sabato alle 7:00

### 5. UI/UX
- [x] Logo Danofitness23 su login, registrazione, home
- [x] Barra di ricerca utenti nel pannello admin
- [x] Icone chiare per modifica/elimina (matita, cestino)
- [ ] Dialogo di conferma per eliminazioni (solo alert nativo, non funziona su web)

## Technical Architecture

### Backend (FastAPI)
- MongoDB database
- JWT authentication
- APScheduler per job automatici
- Endpoints REST API con prefisso /api

### Frontend (Expo/React Native)
- React Native con Expo
- TypeScript
- Zustand per state management
- Tab navigation: Home, Prenota, Profilo, Admin

## API Endpoints
- POST /api/auth/register - Registrazione
- POST /api/auth/login - Login
- GET /api/lessons - Lista lezioni
- POST /api/bookings - Crea prenotazione
- DELETE /api/bookings/{id} - Cancella prenotazione
- GET /api/admin/weekly-bookings - Vista settimanale admin
- DELETE /api/admin/users/{id} - Elimina utente
- DELETE /api/subscriptions/{id} - Elimina abbonamento

## Completed in This Session (Feb 21, 2026)

### BUG FIX CRITICO - Date Prenotazioni
**Problema**: Le prenotazioni venivano salvate con la data sbagliata (off-by-one day).
**Causa**: `getDateString()` in `constants.ts` usava `toISOString()` che converte in UTC, causando date sbagliate per utenti in timezone come Italia (UTC+1/+2).
**Soluzione**: Modificato `getDateString()` e `getTodayDateString()` per usare componenti data locali invece di UTC.
**File modificato**: `/app/frontend/src/utils/constants.ts`
**Test**: 11/11 test passati, prenotazioni ora appaiono nel giorno corretto.

## Backlog (P1 - Priority)
- [ ] Notifiche push per conferme prenotazione
- [ ] Notifiche abbonamenti in scadenza
- [ ] Dialogo conferma eliminazione web-compatible

## Future Tasks (P2)
- [ ] Quota iscrizione stagionale (30 EUR)
- [ ] Export dati prenotazioni

## Known Issues
- Expo tunnel (ngrok) occasionalmente instabile - riavviare con `sudo supervisorctl restart expo`
- JWT secret key sotto la lunghezza raccomandata (27 vs 32 bytes) - WARNING non critico

## Credentials
- **Admin**: admin@danofitness.it / DanoFitness2025!
- **Test Client**: test.client@danofitness.it / TestPassword123!
