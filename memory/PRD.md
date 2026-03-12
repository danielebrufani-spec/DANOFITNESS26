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
- **Classifica Settimanale:** TOP 3 (podio) con gestione pari merito
- **Bacheca Medaglie:** Collezione medaglie vinte (oro, argento, bronzo) nel profilo utente
- **Ruota della Fortuna:** Premi settimanali con suoni

## Task Completati (7 Marzo 2025 - sessioni iniziali)
- [x] Implementazione UI Bacheca Medaglie nel profilo utente
- [x] Card preview con conteggio medaglie (oro/argento/bronzo)
- [x] Modal dettagliato con storico vittorie
- [x] Modifica classifica da TOP 5 a TOP 3 (solo podio)
- [x] Medaglie del podio piu grandi e visibili
- [x] Aggiunta suoni alla Ruota della Fortuna (spin + vittoria/perdita)
- [x] Toggle ON/OFF per i suoni

## Task Completati (12 Marzo 2025 - sessione precedente)
- [x] Sistema lotteria mensile con 3 vincitori
- [x] Quiz bonus dopo la Ruota della Fortuna (65+ domande)
- [x] Bonus domenicale (2 biglietti al primo che prenota)
- [x] Suoni Ruota della Fortuna con toggle
- [x] Animazioni prenotazioni (confetti + modal cancellazione)
- [x] Bacheca Medaglie nel profilo
- [x] Correzione reset dati settimanali per admin/istruttori (domenica)
- [x] Log ingressi solo per abbonamento corrente
- [x] Esclusione utente test "Daniele Brufani" dalla lotteria

## Bug Fix Completati (Feb 2026)
- [x] Fix banner "Abbonamento Scaduto" - separata la logica di verifica abbonamento (`check_user_has_active_subscription`) dalla logica lotteria (`get_users_with_active_subscription`)
- [x] Timer 10 secondi sul Quiz Bonus - barra visuale con countdown, blocco risposte e messaggio "Tempo scaduto!" quando scade
- [x] Sistema Pagamenti Insoluti: toggle "Pagato/Da saldare" alla creazione abbonamento, tab "Insoluti" nell'admin con pulsante "Segna Pagato", badge "DA SALDARE" sulle card, pulsante toggle pagamento su ogni card abbonamento
- [x] Timer Quiz parte al click del cliente (pulsante "INIZIA QUIZ"), non automaticamente
- [x] Domande quiz sostituite con 65 domande tecniche di fisiologia, biochimica e scienza dell'allenamento

## Prossimi Task (P1)
- [ ] Streak Bonus: +1 biglietto per 3 giorni consecutivi di allenamento
- [ ] Milestone Bonus: +5 biglietti per 50 lezioni totali
- [ ] Porta un Amico (Referral): bonus biglietti per chi invita e chi viene invitato

## Task Futuri (P2)
- [ ] Integrazione Instagram per bonus (codice segreto o upload screenshot)
- [ ] Dark/Light mode toggle
- [ ] Vista calendario prenotazioni
- [ ] Pagina statistiche personali con grafici

## Backlog (P3)
- [ ] Aggiornamento dipendenze npm obsolete (warning Vercel)
- [ ] Sfide settimanali
- [ ] Badge collezionabili per milestone
- [ ] Sistema XP
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
- `GET /api/leaderboard/weekly` - Classifica settimanale (TOP 3)
- `GET /api/user/livello` - Livello settimanale utente
- `POST /api/bookings` - Crea prenotazione
- `GET /api/subscriptions/me` - Abbonamenti utente
- `POST /api/wheel/spin` - Gira la ruota della fortuna
- `GET /api/subscriptions/insoluti` - Lista abbonamenti non pagati (admin)
- `PUT /api/subscriptions/{id}/segna-pagato` - Segna abbonamento come pagato (admin)

## Note Tecniche
- L'app e un progetto React Native/Expo, non funziona nel browser tradizionale
- Test vanno fatti nell'app Expo Go o build nativa
- Backend endpoint testabile con curl
- Suoni ruota usano expo-av con URL audio esterni
