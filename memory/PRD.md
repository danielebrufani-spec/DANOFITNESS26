# DANOFITNESS26 - PRD

## Descrizione del Progetto
App fitness completa per gestione palestra con sistema di abbonamenti, prenotazione lezioni, gamification e classifica settimanale.

## Stack Tecnologico
- **Frontend:** React Native (Expo) + TypeScript
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Deployment:** Vercel (frontend) + Render (backend)

## Core Features Implementate

### Autenticazione
- Login/Registrazione utenti
- Ruoli: Admin, Istruttore, Client
- Reset password

### Abbonamenti
- Tipi: 8 lezioni, 16 lezioni, Mensile, Trimestrale
- Gestione scadenza e lezioni rimanenti
- Log ingressi per abbonamento

### Prenotazioni
- Prenotazione lezioni settimanali
- Conferma presenza da admin
- Date bloccate (es. 14 Marzo 2026)
- Notifiche in-app

### Gamification
- **Sistema Livelli:** 7 livelli da "Divano Vivente" a "Dio della Palestra"
- **Classifica Settimanale:** Top 3 con gestione pari merito
- **Bacheca Medaglie:** Collezione medaglie vinte (oro, argento, bronzo)
- **Ruota della Fortuna:** Premi settimanali

## Task Completati (7 Marzo 2025)
- [x] Implementazione UI Bacheca Medaglie nel profilo utente
- [x] Card preview con conteggio medaglie (oro/argento/bronzo)
- [x] Modal dettagliato con storico vittorie
- [x] Aggiunta endpoint `getMyMedals` in apiService

## Prossimi Task
- [ ] Suoni e animazioni per la Ruota della Fortuna
- [ ] Aggiornamento dipendenze npm obsolete

## Future Tasks (Backlog)
- [ ] Sfide settimanali
- [ ] Badge collezionabili per milestone
- [ ] Sistema XP
- [ ] Dark/Light mode toggle
- [ ] Vista calendario prenotazioni
- [ ] Funzionalita social ("Chi viene?")

## Schema Database

### Collection: medals
```json
{
  "user_id": "string",
  "settimana_display": "string",
  "settimana_inizio": "string",
  "posizione": "number",
  "medaglia": "oro|argento|bronzo",
  "allenamenti": "number",
  "pari_merito": "boolean",
  "created_at": "datetime"
}
```

## API Endpoints Principali
- `GET /api/medals/me` - Medaglie utente corrente
- `GET /api/leaderboard/weekly` - Classifica settimanale
- `GET /api/user/livello` - Livello settimanale utente
- `POST /api/bookings` - Crea prenotazione
- `GET /api/subscriptions/me` - Abbonamenti utente

## Note Tecniche
- L'app e un progetto React Native/Expo, non funziona nel browser tradizionale
- Test vanno fatti nell'app Expo Go o build nativa
- Backend endpoint testabile con curl
