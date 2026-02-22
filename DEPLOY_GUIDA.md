# DanoFitness23 - Guida Deploy Produzione

## 🚀 Deploy in 3 Passaggi

### PASSO 1: Database (MongoDB Atlas - Gratuito)

1. Vai su https://www.mongodb.com/atlas
2. Crea account gratuito
3. Crea un cluster (scegli "FREE - Shared")
4. Crea un utente database (username + password)
5. Nelle impostazioni Network Access, aggiungi `0.0.0.0/0` per permettere connessioni
6. Copia la **Connection String** (sarà tipo: `mongodb+srv://username:password@cluster.xxxxx.mongodb.net/danofitness`)

---

### PASSO 2: Backend (Railway - Gratuito)

1. Vai su https://railway.app
2. Accedi con GitHub
3. Clicca "New Project" → "Deploy from GitHub repo"
4. Seleziona il tuo repository (cartella `backend`)
5. Nelle **Variables**, aggiungi:
   ```
   MONGO_URL = (la connection string di MongoDB Atlas)
   DB_NAME = danofitness
   SECRET_KEY = (una stringa segreta lunga, es: DanoFitness2025SuperSecretKey123!)
   VAPID_PRIVATE_KEY = (la chiave che hai già, oppure generane una nuova)
   VAPID_PUBLIC_KEY = (la chiave pubblica corrispondente)
   ```
6. Railway ti darà un URL tipo: `https://danofitness-backend.up.railway.app`
7. **Copia questo URL!**

---

### PASSO 3: Frontend (Vercel - Gratuito)

1. Vai su https://vercel.com
2. Accedi con GitHub
3. Clicca "Add New Project"
4. Importa il tuo repository (cartella `frontend`)
5. Nelle **Environment Variables**, aggiungi:
   ```
   REACT_APP_BACKEND_URL = https://danofitness-backend.up.railway.app
   EXPO_PUBLIC_BACKEND_URL = https://danofitness-backend.up.railway.app
   ```
6. Clicca "Deploy"
7. Vercel ti darà un URL tipo: `https://danofitness23.vercel.app`

---

## ✅ Fatto!

La tua app sarà disponibile su:
- **Frontend**: https://danofitness23.vercel.app (o il nome che scegli)
- **Backend**: https://danofitness-backend.up.railway.app

### Vantaggi:
- ✅ Sempre online 24/7
- ✅ Velocissima
- ✅ Gratuita (per uso normale)
- ✅ Aggiornamenti automatici quando fai push su GitHub

---

## 🔧 Dominio Personalizzato (Opzionale)

Se vuoi un dominio tipo `app.danofitness.it`:
1. Compra il dominio (es: su Aruba, ~10€/anno)
2. In Vercel vai su Settings → Domains
3. Aggiungi il tuo dominio e segui le istruzioni DNS

---

## 📱 PWA - Installazione su Telefono

Dopo il deploy, i tuoi clienti potranno:
1. Aprire il link nel browser
2. Cliccare "Aggiungi alla schermata Home"
3. Usare l'app come un'app normale!
