from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo
import bcrypt as _bcrypt_lib
import jwt
from bson import ObjectId
from enum import Enum
import asyncio
import json
import random
import time
from emergentintegrations.llm.chat import LlmChat, UserMessage
from quiz_domande import QUIZ_PER_CATEGORIA, CATEGORIE_INFO, CATEGORIE


# ======================== IN-MEMORY CACHE ========================

class SimpleCache:
    """Cache in-memory con TTL per dati che cambiano raramente"""
    def __init__(self):
        self._store = {}

    def get(self, key: str):
        entry = self._store.get(key)
        if entry and time.time() < entry["expires"]:
            return entry["value"]
        if entry:
            del self._store[key]
        return None

    def set(self, key: str, value, ttl_seconds: int):
        self._store[key] = {"value": value, "expires": time.time() + ttl_seconds}

    def invalidate(self, key: str):
        self._store.pop(key, None)

    def invalidate_prefix(self, prefix: str):
        keys_to_del = [k for k in self._store if k.startswith(prefix)]
        for k in keys_to_del:
            del self._store[k]

cache = SimpleCache()

# Fuso orario Roma
ROME_TZ = ZoneInfo("Europe/Rome")

def now_rome() -> datetime:
    """Restituisce l'ora corrente nel fuso orario di Roma (naive, senza tzinfo per compatibilità MongoDB)"""
    return datetime.now(ROME_TZ).replace(tzinfo=None)

def today_rome() -> str:
    """Restituisce la data di oggi nel fuso orario di Roma (formato YYYY-MM-DD)"""
    return datetime.now(ROME_TZ).strftime("%Y-%m-%d")

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'danofitness')]

# JWT Config
SECRET_KEY = os.environ.get('JWT_SECRET', 'danofitness_secret_key_2025')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# VAPID Config for Push Notifications
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY')
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY')
VAPID_EMAIL = os.environ.get('VAPID_EMAIL', 'admin@danofitness.it')

# Scheduler removed to save memory on Render free tier
# scheduler = AsyncIOScheduler()

# Password hashing - direct bcrypt (compatible with all Python versions)
security = HTTPBearer()

def hash_password(password: str) -> str:
    return _bcrypt_lib.hashpw(password.encode('utf-8'), _bcrypt_lib.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return _bcrypt_lib.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

# Create the main app
app = FastAPI(title="DanoFitness23 API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ======================== ENUMS ========================

class SubscriptionType(str, Enum):
    LEZIONE_SINGOLA = "lezione_singola"
    LEZIONI_8 = "lezioni_8"
    LEZIONI_16 = "lezioni_16"
    MENSILE = "mensile"
    TRIMESTRALE = "trimestrale"
    PROVA_7GG = "prova_7gg"

class ActivityType(str, Enum):
    CIRCUITO = "circuito"
    FUNZIONALE = "funzionale"
    PILATES = "pilates"
    YOGA = "yoga"

class UserRole(str, Enum):
    ADMIN = "admin"
    CLIENT = "client"
    ISTRUTTORE = "istruttore"

# ======================== MODELS ========================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    nome: str
    cognome: str
    telefono: Optional[str] = None
    soprannome: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    nome: str
    cognome: str
    telefono: Optional[str] = None
    soprannome: Optional[str] = None
    role: str
    created_at: datetime
    push_token: Optional[str] = None
    profile_image: Optional[str] = None
    must_reset_password: Optional[bool] = False
    archived: Optional[bool] = False
    prova_attiva: Optional[bool] = False
    prova_inizio: Optional[str] = None
    prova_scadenza: Optional[str] = None
    ultimo_abb_tipo: Optional[str] = None
    ultimo_abb_inizio: Optional[str] = None
    ultimo_abb_scadenza: Optional[str] = None
    ultimo_abb_pagato: Optional[bool] = None

class SubscriptionCreate(BaseModel):
    user_id: str
    tipo: SubscriptionType
    data_inizio: Optional[datetime] = None
    lezioni_rimanenti: Optional[int] = None  # Allow setting initial lessons
    data_scadenza: Optional[datetime] = None  # Allow setting custom expiry date
    pagato: Optional[bool] = True  # Default pagato, False = da saldare

class SubscriptionUpdate(BaseModel):
    lezioni_rimanenti: Optional[int] = None
    data_scadenza: Optional[datetime] = None
    attivo: Optional[bool] = None
    pagato: Optional[bool] = None

class SubscriptionResponse(BaseModel):
    id: str
    user_id: str
    user_nome: Optional[str] = None
    user_cognome: Optional[str] = None
    tipo: str
    lezioni_rimanenti: Optional[int] = None
    lezioni_fatte: Optional[int] = None  # Count of attended lessons
    data_inizio: datetime
    data_scadenza: datetime
    attivo: bool
    scaduto: bool
    pagato: bool = True
    created_at: datetime

class LessonResponse(BaseModel):
    id: str
    giorno: str
    orario: str
    tipo_attivita: str
    descrizione: Optional[str] = None
    coach: Optional[str] = None

class BookingCreate(BaseModel):
    lesson_id: str
    data_lezione: str  # Format: YYYY-MM-DD

class BookingResponse(BaseModel):
    id: str
    user_id: str
    user_nome: Optional[str] = None
    user_cognome: Optional[str] = None
    lesson_id: str
    lesson_info: Optional[dict] = None
    data_lezione: str
    abbonamento_scaduto: bool
    confermata: bool
    lezione_scalata: bool
    created_at: datetime
    bonus_biglietti: Optional[int] = 0  # Bonus biglietti lotteria assegnati

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    user_nome: Optional[str] = None
    user_cognome: Optional[str] = None
    tipo: str
    messaggio: str
    letta: bool
    created_at: datetime

class PushTokenUpdate(BaseModel):
    push_token: str

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict  # Contains p256dh and auth keys

# ======================== CHAT/COMUNICAZIONI MODELS ========================

class MessageCreate(BaseModel):
    content: str

class ReplyCreate(BaseModel):
    content: str

class ReplyResponse(BaseModel):
    id: str
    user_id: str
    user_nome: str
    user_cognome: str
    user_profile_image: Optional[str] = None
    content: str
    created_at: datetime

class MessageResponse(BaseModel):
    id: str
    sender_id: str
    sender_nome: str
    sender_cognome: str
    sender_profile_image: Optional[str] = None
    content: str
    created_at: datetime
    replies: List[ReplyResponse] = []
    is_admin_message: bool = True

class DailyStats(BaseModel):
    data: str
    totale_prenotazioni: int
    prenotazioni_per_lezione: dict
    abbonamenti_scaduti: int
    lezioni_scalate: int = 0

# Annullamento Lezione singola
class CancelLessonCreate(BaseModel):
    lesson_id: str
    data_lezione: str  # YYYY-MM-DD
    motivo: str

# Consigli del Maestro
class ConsiglioCreate(BaseModel):
    testo: Optional[str] = None
    immagine_url: Optional[str] = None
    immagine_base64: Optional[str] = None  # Per upload diretto immagini
    spotify_url: Optional[str] = None

class ConsiglioResponse(BaseModel):
    id: str
    testo: Optional[str] = None
    immagine_url: Optional[str] = None
    immagine_base64: Optional[str] = None
    spotify_url: Optional[str] = None
    created_at: datetime
    attivo: bool = True

# Consigli Musicali (solo Spotify, leggero)
class ConsiglioMusicaleCreate(BaseModel):
    titolo: Optional[str] = None
    spotify_url: str

class ConsiglioMusicaleResponse(BaseModel):
    id: str
    titolo: Optional[str] = None
    spotify_url: str
    created_at: datetime


# ======================== NUTRIZIONE ========================

class NutritionProfileCreate(BaseModel):
    sesso: str  # "M" o "F"
    eta: int
    peso: float  # kg
    altezza: float  # cm
    obiettivo: str  # "dimagrire", "mantenimento", "massa"
    intolleranze: List[str] = []  # es. ["glutine", "lattosio"]
    alimenti_esclusi: Optional[str] = None  # testo libero
    note: Optional[str] = None

class NutritionProfileResponse(BaseModel):
    sesso: str
    eta: int
    peso: float
    altezza: float
    obiettivo: str
    intolleranze: List[str] = []
    alimenti_esclusi: Optional[str] = None
    note: Optional[str] = None
    bmr: float
    tdee: float
    calorie_giornaliere: float
    proteine_g: float
    carboidrati_g: float
    grassi_g: float
    lezioni_consigliate: int


# ======================== HELPER FUNCTIONS ========================

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = now_rome() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token non valido")
        # PERFORMANCE FIX: Exclude profile_image from default query (can be 4+ MB)
        user = await db.users.find_one(
            {"_id": ObjectId(user_id)},
            {"profile_image": 0}  # Exclude heavy field
        )
        if user is None:
            raise HTTPException(status_code=401, detail="Utente non trovato")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token scaduto")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token non valido")
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Accesso non autorizzato")
    return current_user

def calculate_expiry_date(tipo: SubscriptionType, start_date: datetime) -> datetime:
    if tipo == SubscriptionType.PROVA_7GG:
        return start_date + timedelta(days=7)
    elif tipo == SubscriptionType.LEZIONE_SINGOLA or tipo == SubscriptionType.LEZIONI_8 or tipo == SubscriptionType.LEZIONI_16:
        # Validità annuale per abbonamenti a lezioni (inclusa lezione singola)
        return start_date + timedelta(days=365)
    elif tipo == SubscriptionType.MENSILE:
        # Stesso giorno del mese successivo (es. 16/3 -> 16/4)
        month = start_date.month + 1
        year = start_date.year
        if month > 12:
            month = 1
            year += 1
        # Gestisci mesi con meno giorni (es. 31 gennaio -> 28 febbraio)
        import calendar
        max_day = calendar.monthrange(year, month)[1]
        day = min(start_date.day, max_day)
        return start_date.replace(year=year, month=month, day=day)
    elif tipo == SubscriptionType.TRIMESTRALE:
        # Stesso giorno, 3 mesi dopo (es. 16/3 -> 16/6)
        month = start_date.month + 3
        year = start_date.year
        while month > 12:
            month -= 12
            year += 1
        import calendar
        max_day = calendar.monthrange(year, month)[1]
        day = min(start_date.day, max_day)
        return start_date.replace(year=year, month=month, day=day)
    return start_date

def get_initial_lessons(tipo: SubscriptionType) -> Optional[int]:
    if tipo == SubscriptionType.LEZIONE_SINGOLA:
        return 1
    if tipo == SubscriptionType.LEZIONI_8:
        return 8
    elif tipo == SubscriptionType.LEZIONI_16:
        return 16
    # prova_7gg, mensile, trimestrale: no lesson count
    return None

# Removed count_attended_lessons to save memory - was causing too many DB queries

# ======================== LIVELLI SETTIMANALI ========================

LIVELLI_FITNESS = [
    {"livello": 0, "nome": "Divano Vivente", "icona": "🛋️", "descrizione": "Il divano ti chiama..."},
    {"livello": 1, "nome": "Schiappa in Ripresa", "icona": "🐌", "descrizione": "Almeno ti sei mosso!"},
    {"livello": 2, "nome": "Scaldapanca", "icona": "💦", "descrizione": "Stai ingranando..."},
    {"livello": 3, "nome": "Guerriero", "icona": "⚔️", "descrizione": "Ora si fa sul serio!"},
    {"livello": 4, "nome": "Bestia", "icona": "🦁", "descrizione": "Inarrestabile!"},
    {"livello": 5, "nome": "Leggenda", "icona": "🔥", "descrizione": "Quasi al top!"},
    {"livello": 6, "nome": "Dio della Palestra", "icona": "👑", "descrizione": "6 su 6! SEI UN DIO!"},
]

def get_livello_info(allenamenti_settimana: int) -> dict:
    """Restituisce le info del livello basato sugli allenamenti settimanali"""
    livello = min(allenamenti_settimana, 6)  # Max 6
    return LIVELLI_FITNESS[livello]

def get_previous_week_dates() -> tuple:
    """Restituisce le date di inizio (lunedì) e fine (sabato) della SETTIMANA PRECEDENTE
    
    La domenica, la "settimana precedente" è quella appena conclusa (Lun-Sab passati)
    """
    today = datetime.now(ROME_TZ)
    current_day = today.weekday()  # 0=Lunedì, 6=Domenica
    current_hour = today.hour
    
    # Calcola il lunedì della settimana "corrente" (che la domenica diventa la prossima)
    if current_day == 5 and current_hour >= 14:  # Sabato dopo le 14
        this_monday = today + timedelta(days=2)
    elif current_day == 6:  # Domenica -> settimana corrente = prossima settimana
        this_monday = today + timedelta(days=1)
    else:
        this_monday = today - timedelta(days=current_day)
    
    # Vai alla settimana precedente
    prev_monday = this_monday - timedelta(days=7)
    prev_monday = prev_monday.replace(hour=0, minute=0, second=0, microsecond=0)
    prev_saturday = prev_monday + timedelta(days=5)
    
    return prev_monday.strftime("%Y-%m-%d"), prev_saturday.strftime("%Y-%m-%d")

def get_current_week_dates() -> tuple:
    """Restituisce le date di inizio (lunedì) e fine (sabato) della SETTIMANA CORRENTE
    
    La domenica, la "settimana corrente" è quella che inizia domani (Lun-Sab prossimi)
    """
    today = datetime.now(ROME_TZ)
    current_day = today.weekday()  # 0=Lunedì, 6=Domenica
    current_hour = today.hour
    
    # Calcola il lunedì della settimana corrente
    if current_day == 5 and current_hour >= 14:  # Sabato dopo le 14
        this_monday = today + timedelta(days=2)
    elif current_day == 6:  # Domenica -> settimana corrente = prossima settimana
        this_monday = today + timedelta(days=1)
    else:
        this_monday = today - timedelta(days=current_day)
    
    this_monday = this_monday.replace(hour=0, minute=0, second=0, microsecond=0)
    this_saturday = this_monday + timedelta(days=5)
    
    return this_monday.strftime("%Y-%m-%d"), this_saturday.strftime("%Y-%m-%d")

# ======================== SCHEDULE DATA ========================

SCHEDULE = [
    {"giorno": "lunedi", "orario": "08:30", "tipo_attivita": ActivityType.CIRCUITO, "descrizione": "Allenamento a stazioni per resistenza, forza e velocità", "coach": "Daniele"},
    {"giorno": "lunedi", "orario": "20:30", "tipo_attivita": ActivityType.FUNZIONALE, "descrizione": "Allenamento di gruppo con metodologia Tabata", "coach": "Daniele"},
    {"giorno": "martedi", "orario": "13:15", "tipo_attivita": ActivityType.FUNZIONALE, "descrizione": "Allenamento di gruppo con metodologia Tabata", "coach": "Fabio"},
    {"giorno": "martedi", "orario": "17:30", "tipo_attivita": ActivityType.CIRCUITO, "descrizione": "Allenamento a stazioni per resistenza, forza e velocità", "coach": "Daniele"},
    {"giorno": "martedi", "orario": "20:15", "tipo_attivita": ActivityType.PILATES, "descrizione": "Per postura, flessibilità e concentrazione", "coach": "Toto"},
    {"giorno": "mercoledi", "orario": "08:30", "tipo_attivita": ActivityType.FUNZIONALE, "descrizione": "Allenamento di gruppo con metodologia Tabata", "coach": "Daniele"},
    {"giorno": "mercoledi", "orario": "20:30", "tipo_attivita": ActivityType.CIRCUITO, "descrizione": "Allenamento a stazioni per resistenza, forza e velocità", "coach": "Daniele"},
    {"giorno": "giovedi", "orario": "13:15", "tipo_attivita": ActivityType.CIRCUITO, "descrizione": "Allenamento a stazioni per resistenza, forza e velocità", "coach": "Daniele"},
    {"giorno": "giovedi", "orario": "17:30", "tipo_attivita": ActivityType.FUNZIONALE, "descrizione": "Allenamento di gruppo con metodologia Tabata", "coach": "Daniele"},
    {"giorno": "giovedi", "orario": "20:15", "tipo_attivita": ActivityType.PILATES, "descrizione": "Per postura, flessibilità e concentrazione", "coach": "Toto"},
    {"giorno": "venerdi", "orario": "08:30", "tipo_attivita": ActivityType.FUNZIONALE, "descrizione": "Allenamento di gruppo con metodologia Tabata", "coach": "Fabio"},
    {"giorno": "venerdi", "orario": "20:15", "tipo_attivita": ActivityType.FUNZIONALE, "descrizione": "Allenamento di gruppo con metodologia Tabata", "coach": "Daniele"},
    {"giorno": "sabato", "orario": "13:30", "tipo_attivita": ActivityType.YOGA, "descrizione": "Disciplina che unisce respiro, movimento e meditazione", "coach": "Costanza"},
]

# ======================== AUTH ROUTES ========================

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if email exists
    existing_user = await db.users.find_one({"email": user_data.email.lower()})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email già registrata")
    
    # Create user
    user = {
        "email": user_data.email.lower(),
        "password": hash_password(user_data.password),
        "nome": user_data.nome,
        "cognome": user_data.cognome,
        "telefono": user_data.telefono,
        "soprannome": user_data.soprannome,
        "role": UserRole.CLIENT,
        "push_token": None,
        "created_at": now_rome()
    }
    
    result = await db.users.insert_one(user)
    user_id = str(result.inserted_id)
    
    # Create token
    token = create_access_token({"sub": user_id})
    
    return {
        "token": token,
        "user": UserResponse(
            id=user_id,
            email=user["email"],
            nome=user["nome"],
            cognome=user["cognome"],
            telefono=user["telefono"],
            role=user["role"],
            created_at=user["created_at"],
            push_token=user["push_token"]
        )
    }

@api_router.post("/auth/login")
async def login(login_data: UserLogin):
    # PERFORMANCE FIX: Exclude profile_image from login query
    user = await db.users.find_one(
        {"email": login_data.email.lower()},
        {"profile_image": 0}  # Exclude heavy field
    )
    if not user:
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    
    # Support both password field names for backwards compatibility
    hashed_pwd = user.get("hashed_password") or user.get("password")
    if not hashed_pwd or not verify_password(login_data.password, hashed_pwd):
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    
    user_id = str(user["_id"])
    token = create_access_token({"sub": user_id})
    
    return {
        "token": token,
        "user": UserResponse(
            id=user_id,
            email=user["email"],
            nome=user["nome"],
            cognome=user["cognome"],
            telefono=user.get("telefono"),
            role=user["role"],
            created_at=user["created_at"],
            push_token=user.get("push_token"),
            must_reset_password=user.get("must_reset_password", False),
            archived=user.get("archived", False)
        )
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user["_id"]),
        email=current_user["email"],
        nome=current_user["nome"],
        cognome=current_user["cognome"],
        telefono=current_user.get("telefono"),
        role=current_user["role"],
        created_at=current_user["created_at"],
        push_token=current_user.get("push_token"),
        profile_image=None,
        must_reset_password=current_user.get("must_reset_password", False),
        archived=current_user.get("archived", False),
        prova_attiva=current_user.get("prova_attiva", False),
        prova_inizio=current_user.get("prova_inizio"),
        prova_scadenza=current_user.get("prova_scadenza")
    )

@api_router.put("/auth/push-token")
async def update_push_token(data: PushTokenUpdate, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"push_token": data.push_token}}
    )
    return {"message": "Token push aggiornato"}

# ======================== DATE BLOCCATE ========================

class BlockedDateCreate(BaseModel):
    data: str  # formato YYYY-MM-DD
    motivo: str

@api_router.get("/blocked-dates")
async def get_blocked_dates(current_user: dict = Depends(get_current_user)):
    """Ritorna tutte le date bloccate future"""
    today = now_rome().strftime("%Y-%m-%d")
    cached = cache.get(f"blocked_dates_{today}")
    if cached is not None:
        return cached
    blocked = await db.blocked_dates.find({"data": {"$gte": today}}).to_list(100)
    result = [{"data": b["data"], "motivo": b["motivo"]} for b in blocked]
    cache.set(f"blocked_dates_{today}", result, 60)
    return result

@api_router.post("/admin/block-date")
async def block_date(blocked: BlockedDateCreate, admin_user: dict = Depends(get_admin_user)):
    """Blocca una data per le prenotazioni"""
    # Controlla se già bloccata
    existing = await db.blocked_dates.find_one({"data": blocked.data})
    if existing:
        return {"message": f"Data {blocked.data} già bloccata"}
    
    await db.blocked_dates.insert_one({
        "data": blocked.data,
        "motivo": blocked.motivo,
        "created_at": now_rome(),
        "created_by": str(admin_user["_id"])
    })
    
    # Invalida cache date bloccate
    cache.invalidate_prefix("blocked_dates_")
    
    # Cancella eventuali prenotazioni esistenti per quella data
    result = await db.bookings.delete_many({"data_lezione": blocked.data})
    
    return {
        "message": f"Data {blocked.data} bloccata",
        "motivo": blocked.motivo,
        "prenotazioni_cancellate": result.deleted_count
    }

@api_router.delete("/admin/unblock-date/{data}")
async def unblock_date(data: str, admin_user: dict = Depends(get_admin_user)):
    """Sblocca una data"""
    result = await db.blocked_dates.delete_one({"data": data})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Data non trovata")
    cache.invalidate_prefix("blocked_dates_")
    return {"message": f"Data {data} sbloccata"}

# ======================== CANCEL SINGLE LESSON ========================

@api_router.post("/admin/cancel-lesson")
async def cancel_lesson(data: CancelLessonCreate, admin_user: dict = Depends(get_admin_user)):
    """Annulla una lezione specifica in una data specifica"""
    # Verifica che la lezione esista
    try:
        lesson = await db.lessons.find_one({"_id": ObjectId(data.lesson_id)})
    except:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    if not lesson:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    
    # Controlla se già annullata
    existing = await db.cancelled_lessons.find_one({
        "lesson_id": data.lesson_id,
        "data_lezione": data.data_lezione
    })
    if existing:
        return {"message": "Lezione già annullata", "prenotazioni_cancellate": 0}
    
    # Salva l'annullamento
    await db.cancelled_lessons.insert_one({
        "lesson_id": data.lesson_id,
        "data_lezione": data.data_lezione,
        "motivo": data.motivo,
        "orario": lesson.get("orario"),
        "tipo_attivita": lesson.get("tipo_attivita"),
        "coach": lesson.get("coach", ""),
        "created_at": now_rome(),
        "created_by": str(admin_user["_id"])
    })
    
    # Cancella prenotazioni esistenti per quella lezione in quella data
    result = await db.bookings.delete_many({
        "lesson_id": data.lesson_id,
        "data_lezione": data.data_lezione
    })
    
    cache.invalidate_prefix("cancelled_lessons_")
    
    return {
        "message": f"Lezione {lesson.get('orario')} del {data.data_lezione} annullata",
        "motivo": data.motivo,
        "prenotazioni_cancellate": result.deleted_count
    }

@api_router.delete("/admin/cancel-lesson/{lesson_id}/{data_lezione}")
async def restore_lesson(lesson_id: str, data_lezione: str, admin_user: dict = Depends(get_admin_user)):
    """Ripristina una lezione precedentemente annullata"""
    result = await db.cancelled_lessons.delete_one({
        "lesson_id": lesson_id,
        "data_lezione": data_lezione
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Annullamento non trovato")
    cache.invalidate_prefix("cancelled_lessons_")
    return {"message": "Lezione ripristinata"}

@api_router.get("/cancelled-lessons")
async def get_cancelled_lessons(current_user: dict = Depends(get_current_user)):
    """Ottieni lezioni annullate per la settimana corrente"""
    now = now_rome()
    weekday = now.weekday()
    monday = now - timedelta(days=weekday)
    saturday = monday + timedelta(days=5)
    
    monday_str = monday.strftime("%Y-%m-%d")
    saturday_str = saturday.strftime("%Y-%m-%d")
    
    cancelled = await db.cancelled_lessons.find(
        {"data_lezione": {"$gte": monday_str, "$lte": saturday_str}},
        {"_id": 0}
    ).to_list(100)
    
    return cancelled

# ======================== LESSONS ROUTES ========================

async def get_cached_lessons():
    """Recupera lezioni dalla cache o dal DB (TTL 5 minuti)"""
    cached = cache.get("all_lessons")
    if cached is not None:
        return cached
    lessons = await db.lessons.find().to_list(100)
    if not lessons:
        lessons_to_insert = []
        for lesson in SCHEDULE:
            lessons_to_insert.append({
                "giorno": lesson["giorno"],
                "orario": lesson["orario"],
                "tipo_attivita": lesson["tipo_attivita"].value if hasattr(lesson["tipo_attivita"], 'value') else lesson["tipo_attivita"],
                "descrizione": lesson["descrizione"],
                "coach": lesson.get("coach", "Daniele")
            })
        await db.lessons.insert_many(lessons_to_insert)
        lessons = await db.lessons.find().to_list(100)
    cache.set("all_lessons", lessons, 300)
    return lessons

@api_router.get("/lessons", response_model=List[LessonResponse])
async def get_lessons(current_user: dict = Depends(get_current_user)):
    lessons = await get_cached_lessons()
    return [
        LessonResponse(
            id=str(lesson["_id"]),
            giorno=lesson["giorno"],
            orario=lesson["orario"],
            tipo_attivita=lesson["tipo_attivita"],
            descrizione=lesson.get("descrizione"),
            coach=lesson.get("coach", "Daniele")
        ) for lesson in lessons
    ]

@api_router.get("/lessons/day/{giorno}", response_model=List[LessonResponse])
async def get_lessons_by_day(giorno: str, current_user: dict = Depends(get_current_user)):
    all_lessons = await get_cached_lessons()
    lessons = [l for l in all_lessons if l["giorno"] == giorno.lower()]
    return [
        LessonResponse(
            id=str(lesson["_id"]),
            giorno=lesson["giorno"],
            orario=lesson["orario"],
            tipo_attivita=lesson["tipo_attivita"],
            descrizione=lesson.get("descrizione"),
            coach=lesson.get("coach", "Daniele")
        ) for lesson in lessons
    ]

# ======================== SUBSCRIPTIONS ROUTES ========================

@api_router.post("/subscriptions", response_model=SubscriptionResponse)
async def create_subscription(data: SubscriptionCreate, admin_user: dict = Depends(get_admin_user)):
    # Verify user exists
    try:
        user = await db.users.find_one({"_id": ObjectId(data.user_id)})
    except:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    # Cancella tutti gli abbonamenti scaduti dell'utente
    now = now_rome()
    old_subs = await db.subscriptions.find({"user_id": data.user_id}).to_list(100)
    for old_sub in old_subs:
        is_expired = old_sub["data_scadenza"] < now
        if old_sub.get("lezioni_rimanenti") is not None and old_sub["lezioni_rimanenti"] <= 0:
            is_expired = True
        if is_expired:
            await db.subscriptions.delete_one({"_id": old_sub["_id"]})
    
    # Verifica che l'utente non abbia già un abbonamento attivo
    active_sub = await db.subscriptions.find_one({
        "user_id": data.user_id,
        "attivo": True,
        "data_scadenza": {"$gte": now}
    })
    if active_sub:
        # Se ha lezioni_rimanenti, controlla che non siano esaurite
        if active_sub.get("lezioni_rimanenti") is None or active_sub["lezioni_rimanenti"] > 0:
            raise HTTPException(status_code=400, detail="L'utente ha già un abbonamento attivo. Elimina prima quello esistente.")
    
    start_date = data.data_inizio or now_rome()
    
    # Use custom expiry date if provided, otherwise calculate from subscription type
    if data.data_scadenza is not None:
        expiry_date = data.data_scadenza
    else:
        expiry_date = calculate_expiry_date(data.tipo, start_date)
    
    # Use custom lessons if provided, otherwise use default
    if data.lezioni_rimanenti is not None:
        initial_lessons = data.lezioni_rimanenti
    else:
        initial_lessons = get_initial_lessons(data.tipo)
    
    subscription = {
        "user_id": data.user_id,
        "tipo": data.tipo.value,
        "lezioni_rimanenti": initial_lessons,
        "data_inizio": start_date,
        "data_scadenza": expiry_date,
        "attivo": True,
        "pagato": data.pagato if data.pagato is not None else True,
        "created_at": now_rome()
    }
    
    result = await db.subscriptions.insert_one(subscription)
    
    # Se è prova 7gg, attiva anche i flag prova sull'utente
    if data.tipo == SubscriptionType.PROVA_7GG:
        await db.users.update_one(
            {"_id": ObjectId(data.user_id)},
            {"$set": {
                "prova_attiva": True,
                "prova_inizio": start_date.strftime("%Y-%m-%d"),
                "prova_scadenza": expiry_date.strftime("%Y-%m-%d"),
            }}
        )
        logger.info(f"[TRIAL] Prova attivata via abbonamento per {user.get('nome')} {user.get('cognome')} - scade {expiry_date.strftime('%Y-%m-%d')}")
    else:
        # Abbonamento "vero" → rimuovi automaticamente eventuale stato di prova
        if user.get("prova_attiva"):
            await db.users.update_one(
                {"_id": ObjectId(data.user_id)},
                {"$set": {
                    "prova_attiva": False,
                    "prova_terminata_il": now_rome().strftime("%Y-%m-%d"),
                }}
            )
            logger.info(f"[TRIAL] Prova disattivata automaticamente per {user.get('nome')} {user.get('cognome')} - nuovo abbonamento {data.tipo.value}")
    
    is_expired = expiry_date < now_rome()
    
    return SubscriptionResponse(
        id=str(result.inserted_id),
        user_id=data.user_id,
        user_nome=user["nome"],
        user_cognome=user["cognome"],
        tipo=subscription["tipo"],
        lezioni_rimanenti=subscription["lezioni_rimanenti"],
        data_inizio=subscription["data_inizio"],
        data_scadenza=subscription["data_scadenza"],
        attivo=subscription["attivo"],
        scaduto=is_expired,
        pagato=subscription.get("pagato", True),
        created_at=subscription["created_at"]
    )

@api_router.get("/subscriptions/me", response_model=List[SubscriptionResponse])
async def get_my_subscriptions(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    subscriptions = await db.subscriptions.find({"user_id": user_id}).to_list(100)
    now = now_rome()
    
    result = []
    for sub in subscriptions:
        is_expired = sub["data_scadenza"] < now
        # Also check if lezioni_rimanenti is 0 for lesson-based subscriptions
        if sub["lezioni_rimanenti"] is not None and sub["lezioni_rimanenti"] <= 0:
            is_expired = True
        
        # Salta gli abbonamenti scaduti
        if is_expired:
            continue
        
        result.append(SubscriptionResponse(
            id=str(sub["_id"]),
            user_id=sub["user_id"],
            user_nome=current_user["nome"],
            user_cognome=current_user["cognome"],
            tipo=sub["tipo"],
            lezioni_rimanenti=sub["lezioni_rimanenti"],
            lezioni_fatte=None,
            data_inizio=sub["data_inizio"],
            data_scadenza=sub["data_scadenza"],
            attivo=sub["attivo"],
            scaduto=False,
            pagato=sub.get("pagato", True),
            created_at=sub["created_at"]
        ))
    
    return result

@api_router.get("/subscriptions", response_model=List[SubscriptionResponse])
async def get_all_subscriptions(admin_user: dict = Depends(get_admin_user)):
    subscriptions = await db.subscriptions.find().to_list(1000)
    now = now_rome()
    
    # PERFORMANCE FIX: Batch load all users at once
    user_ids = list(set(sub["user_id"] for sub in subscriptions))
    users = await db.users.find(
        {"_id": {"$in": [ObjectId(uid) for uid in user_ids]}},
        {"profile_image": 0}  # Exclude heavy field
    ).to_list(len(user_ids))
    users_cache = {str(u["_id"]): u for u in users}
    
    result = []
    for sub in subscriptions:
        # Converti data_scadenza se è una stringa
        data_scadenza = sub["data_scadenza"]
        if isinstance(data_scadenza, str):
            from dateutil import parser
            data_scadenza = parser.parse(data_scadenza).replace(tzinfo=ROME_TZ)
        
        # Controlla se è scaduto
        is_expired = data_scadenza < now
        if sub["lezioni_rimanenti"] is not None and sub["lezioni_rimanenti"] <= 0:
            is_expired = True
        
        # Salta gli abbonamenti scaduti (vanno solo nella home admin)
        if is_expired:
            continue
        
        user = users_cache.get(sub["user_id"])
        
        result.append(SubscriptionResponse(
            id=str(sub["_id"]),
            user_id=sub["user_id"],
            user_nome=user["nome"] if user else "Sconosciuto",
            user_cognome=user["cognome"] if user else "",
            tipo=sub["tipo"],
            lezioni_rimanenti=sub["lezioni_rimanenti"],
            lezioni_fatte=None,
            data_inizio=sub["data_inizio"],
            data_scadenza=sub["data_scadenza"],
            attivo=sub["attivo"],
            scaduto=False,
            pagato=sub.get("pagato", True),
            created_at=sub["created_at"]
        ))
    
    return result

@api_router.get("/subscriptions/expired", response_model=List[SubscriptionResponse])
async def get_expired_subscriptions(admin_user: dict = Depends(get_admin_user)):
    now = now_rome()
    
    # Get all subscriptions and filter expired ones
    all_subs = await db.subscriptions.find({"attivo": True}).to_list(1000)
    
    # PERFORMANCE FIX: Batch load all users at once (ESCLUDI UTENTI ARCHIVIATI)
    user_ids = list(set(sub["user_id"] for sub in all_subs))
    users = await db.users.find(
        {
            "_id": {"$in": [ObjectId(uid) for uid in user_ids]},
            "archived": {"$ne": True}  # Escludi utenti archiviati
        },
        {"profile_image": 0}  # Exclude heavy field
    ).to_list(len(user_ids))
    users_cache = {str(u["_id"]): u for u in users}
    
    result = []
    for sub in all_subs:
        # Salta se l'utente è archiviato (non presente nella cache)
        if sub["user_id"] not in users_cache:
            continue
            
        # Converti data_scadenza se è una stringa
        data_scadenza = sub["data_scadenza"]
        if isinstance(data_scadenza, str):
            from dateutil import parser
            data_scadenza = parser.parse(data_scadenza).replace(tzinfo=ROME_TZ)
        
        is_expired = data_scadenza < now
        if sub["lezioni_rimanenti"] is not None and sub["lezioni_rimanenti"] <= 0:
            is_expired = True
        
        if is_expired:
            user = users_cache.get(sub["user_id"])
            
            result.append(SubscriptionResponse(
                id=str(sub["_id"]),
                user_id=sub["user_id"],
                user_nome=user["nome"] if user else "Sconosciuto",
                user_cognome=user["cognome"] if user else "",
                tipo=sub["tipo"],
                lezioni_rimanenti=sub["lezioni_rimanenti"],
                lezioni_fatte=None,
                data_inizio=sub["data_inizio"],
                data_scadenza=sub["data_scadenza"],
                attivo=sub["attivo"],
                scaduto=True,
                pagato=sub.get("pagato", True),
                created_at=sub["created_at"]
            ))
    
    return result

@api_router.get("/subscriptions/insoluti", response_model=List[SubscriptionResponse])
async def get_unpaid_subscriptions(admin_user: dict = Depends(get_admin_user)):
    """Lista abbonamenti attivi non pagati"""
    now = now_rome()
    unpaid_subs = await db.subscriptions.find({"pagato": False, "attivo": True}).to_list(1000)
    
    if not unpaid_subs:
        return []
    
    user_ids = list(set(sub["user_id"] for sub in unpaid_subs))
    users = await db.users.find(
        {"_id": {"$in": [ObjectId(uid) for uid in user_ids]}},
        {"profile_image": 0}
    ).to_list(len(user_ids))
    users_cache = {str(u["_id"]): u for u in users}
    
    result = []
    for sub in unpaid_subs:
        data_scadenza = sub["data_scadenza"]
        if isinstance(data_scadenza, str):
            from dateutil import parser
            data_scadenza = parser.parse(data_scadenza).replace(tzinfo=ROME_TZ)
        
        is_expired = data_scadenza < now
        if sub.get("lezioni_rimanenti") is not None and sub["lezioni_rimanenti"] <= 0:
            is_expired = True
        
        user = users_cache.get(sub["user_id"])
        result.append(SubscriptionResponse(
            id=str(sub["_id"]),
            user_id=sub["user_id"],
            user_nome=user["nome"] if user else "Sconosciuto",
            user_cognome=user["cognome"] if user else "",
            tipo=sub["tipo"],
            lezioni_rimanenti=sub["lezioni_rimanenti"],
            lezioni_fatte=None,
            data_inizio=sub["data_inizio"],
            data_scadenza=sub["data_scadenza"],
            attivo=sub["attivo"],
            scaduto=is_expired,
            pagato=False,
            created_at=sub["created_at"]
        ))
    
    return result

@api_router.put("/subscriptions/{subscription_id}/segna-pagato")
async def mark_subscription_paid(subscription_id: str, admin_user: dict = Depends(get_admin_user)):
    """Segna un abbonamento come pagato"""
    try:
        sub = await db.subscriptions.find_one({"_id": ObjectId(subscription_id)})
    except:
        raise HTTPException(status_code=404, detail="Abbonamento non trovato")
    
    if not sub:
        raise HTTPException(status_code=404, detail="Abbonamento non trovato")
    
    await db.subscriptions.update_one(
        {"_id": ObjectId(subscription_id)},
        {"$set": {"pagato": True}}
    )
    
    return {"message": "Abbonamento segnato come pagato"}


@api_router.put("/subscriptions/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription(subscription_id: str, data: SubscriptionUpdate, admin_user: dict = Depends(get_admin_user)):
    """Update subscription - admin only. Can modify remaining lessons, expiry date, or active status."""
    try:
        sub = await db.subscriptions.find_one({"_id": ObjectId(subscription_id)})
    except:
        raise HTTPException(status_code=404, detail="Abbonamento non trovato")
    
    if not sub:
        raise HTTPException(status_code=404, detail="Abbonamento non trovato")
    
    # Build update dict
    update_data = {}
    if data.lezioni_rimanenti is not None:
        update_data["lezioni_rimanenti"] = data.lezioni_rimanenti
    if data.data_scadenza is not None:
        update_data["data_scadenza"] = data.data_scadenza
    if data.attivo is not None:
        update_data["attivo"] = data.attivo
    if data.pagato is not None:
        update_data["pagato"] = data.pagato
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nessun dato da aggiornare")
    
    # Update subscription
    await db.subscriptions.update_one(
        {"_id": ObjectId(subscription_id)},
        {"$set": update_data}
    )
    
    # Get updated subscription
    updated_sub = await db.subscriptions.find_one({"_id": ObjectId(subscription_id)})
    
    # Get user info
    try:
        user = await db.users.find_one({"_id": ObjectId(updated_sub["user_id"])}, {"nome": 1, "cognome": 1})
    except:
        user = None
    
    is_expired = updated_sub["data_scadenza"] < now_rome()
    if updated_sub["lezioni_rimanenti"] is not None and updated_sub["lezioni_rimanenti"] <= 0:
        is_expired = True
    
    return SubscriptionResponse(
        id=str(updated_sub["_id"]),
        user_id=updated_sub["user_id"],
        user_nome=user["nome"] if user else "Sconosciuto",
        user_cognome=user["cognome"] if user else "",
        tipo=updated_sub["tipo"],
        lezioni_rimanenti=updated_sub["lezioni_rimanenti"],
        lezioni_fatte=None,
        data_inizio=updated_sub["data_inizio"],
        data_scadenza=updated_sub["data_scadenza"],
        attivo=updated_sub["attivo"],
        scaduto=is_expired,
        pagato=updated_sub.get("pagato", True),
        created_at=updated_sub["created_at"]
    )

@api_router.delete("/subscriptions/{subscription_id}")
async def delete_subscription(subscription_id: str, admin_user: dict = Depends(get_admin_user)):
    try:
        result = await db.subscriptions.delete_one({"_id": ObjectId(subscription_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Abbonamento non trovato")
        return {"message": "Abbonamento eliminato"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))



# ======================== ALERT NUOVI ISCRITTI (ADMIN) ========================

@api_router.get("/admin/new-registrations")
async def get_new_registrations(admin_user: dict = Depends(get_admin_user)):
    """Ritorna utenti registrati dopo l'ultimo controllo dell'admin"""
    admin_id = str(admin_user["_id"])
    
    last_check = await db.admin_last_check.find_one({"admin_id": admin_id})
    last_check_time = last_check["checked_at"] if last_check else admin_user.get("created_at", datetime(2020, 1, 1))
    
    new_users = await db.users.find(
        {"created_at": {"$gt": last_check_time}, "role": {"$nin": ["admin"]}},
        {"_id": 0, "nome": 1, "cognome": 1, "email": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(50)
    
    return {
        "nuovi_utenti": [{
            "nome": u.get("nome"),
            "cognome": u.get("cognome"),
            "email": u.get("email"),
            "data_registrazione": u["created_at"].strftime("%d/%m/%Y %H:%M") if u.get("created_at") else None
        } for u in new_users],
        "count": len(new_users)
    }


@api_router.post("/admin/mark-registrations-seen")
async def mark_registrations_seen(admin_user: dict = Depends(get_admin_user)):
    """Segna le registrazioni come viste"""
    admin_id = str(admin_user["_id"])
    await db.admin_last_check.update_one(
        {"admin_id": admin_id},
        {"$set": {"admin_id": admin_id, "checked_at": now_rome()}},
        upsert=True
    )
    return {"message": "Registrazioni segnate come viste"}


# ======================== PROVA GRATUITA (TRIAL) ========================

@api_router.post("/admin/activate-trial/{user_id}")
async def activate_trial(user_id: str, admin_user: dict = Depends(get_admin_user)):
    """Attiva 7 giorni di prova gratuita per un utente"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    if user.get("prova_attiva"):
        raise HTTPException(status_code=400, detail="Questo utente ha gia una prova attiva!")
    
    now = datetime.now(ROME_TZ)
    scadenza = now + timedelta(days=7)
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "prova_attiva": True,
            "prova_inizio": now.strftime("%Y-%m-%d"),
            "prova_scadenza": scadenza.strftime("%Y-%m-%d"),
        }}
    )
    
    logger.info(f"[TRIAL] Prova attivata per {user.get('nome')} {user.get('cognome')} - scade {scadenza.strftime('%Y-%m-%d')}")
    return {
        "message": f"Prova attivata per {user.get('nome')} {user.get('cognome')}!",
        "prova_inizio": now.strftime("%Y-%m-%d"),
        "prova_scadenza": scadenza.strftime("%Y-%m-%d")
    }


@api_router.post("/admin/deactivate-trial/{user_id}")
async def deactivate_trial(user_id: str, admin_user: dict = Depends(get_admin_user)):
    """Disattiva la prova gratuita di un utente"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"prova_attiva": False}}
    )
    
    logger.info(f"[TRIAL] Prova disattivata per {user.get('nome')} {user.get('cognome')}")
    return {"message": f"Prova disattivata per {user.get('nome')} {user.get('cognome')}"}


# ======================== BOOKINGS ROUTES ========================

@api_router.post("/bookings", response_model=BookingResponse)
async def create_booking(data: BookingCreate, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    
    # Verify lesson exists
    try:
        lesson = await db.lessons.find_one({"_id": ObjectId(data.lesson_id)})
    except:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    
    if not lesson:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    
    # CHECK LEZIONE ANNULLATA
    cancelled = await db.cancelled_lessons.find_one({
        "lesson_id": data.lesson_id,
        "data_lezione": data.data_lezione
    })
    if cancelled:
        raise HTTPException(
            status_code=400,
            detail=f"Lezione annullata: {cancelled.get('motivo', 'Lezione sospesa')}"
        )
    
    # CHECK DATA BLOCCATA
    blocked = await db.blocked_dates.find_one({"data": data.data_lezione})
    if blocked:
        raise HTTPException(
            status_code=400, 
            detail=f"⚠️ Prenotazioni chiuse per questa data: {blocked.get('motivo', 'Lezione sospesa')}"
        )
    
    # Check booking week limit: can only book current week, unlocks next week on SUNDAY at 9:00 AM Rome time
    now = now_rome()
    booking_date = datetime.strptime(data.data_lezione, "%Y-%m-%d")
    
    # Calculate the end of bookable week
    today_weekday = now.weekday()  # 0=Monday, 6=Sunday
    current_hour = now.hour
    
    # Next week bookings open ONLY on Sunday at 9:00 AM Rome time
    can_book_next_week = (today_weekday == 6 and current_hour >= 9)  # Sunday after 9 AM
    
    if can_book_next_week:
        # Can book this week + next week (until next Saturday)
        days_until_next_saturday = 6  # Next Saturday
        max_bookable_date = now.replace(hour=23, minute=59, second=59) + timedelta(days=days_until_next_saturday)
    else:
        # Can only book until this Saturday
        if today_weekday == 6:  # Sunday before 9 AM
            days_until_saturday = 6  # Current week's Saturday
        else:
            days_until_saturday = 5 - today_weekday  # Days until Saturday
            if days_until_saturday < 0:
                days_until_saturday = 0  # Already Saturday
        max_bookable_date = now.replace(hour=23, minute=59, second=59) + timedelta(days=days_until_saturday)
    
    if booking_date > max_bookable_date:
        if today_weekday == 6 and current_hour < 9:
            raise HTTPException(status_code=400, detail="Le prenotazioni per la prossima settimana si aprono alle 9:00 di domenica mattina.")
        else:
            raise HTTPException(status_code=400, detail="Puoi prenotare solo per la settimana corrente. Le prenotazioni per la prossima settimana si aprono domenica alle 9:00.")
    
    # Check if lesson is passed - bookable until lesson start time
    try:
        lesson_date = datetime.strptime(data.data_lezione, "%Y-%m-%d")
        lesson_time_parts = lesson["orario"].split(":")
        lesson_hour = int(lesson_time_parts[0])
        lesson_minute = int(lesson_time_parts[1]) if len(lesson_time_parts) > 1 else 0
        lesson_datetime = lesson_date.replace(hour=lesson_hour, minute=lesson_minute)
        
        # Can book until lesson start time (no buffer)
        if now_rome() > lesson_datetime:
            raise HTTPException(status_code=400, detail="Non puoi prenotare una lezione già iniziata")
    except ValueError as e:
        logging.error(f"Error parsing lesson datetime: {e}")
        # Continue anyway if there's a parsing error
    
    # Check if already booked
    existing_booking = await db.bookings.find_one({
        "user_id": user_id,
        "lesson_id": data.lesson_id,
        "data_lezione": data.data_lezione
    })
    
    if existing_booking:
        raise HTTPException(status_code=400, detail="Hai già prenotato questa lezione")
    
    # Check subscription status - BLOCCA se non ha abbonamento attivo
    subscriptions = await db.subscriptions.find({
        "user_id": user_id,
        "attivo": True
    }).to_list(100)
    
    ha_abbonamento_attivo = False
    for sub in subscriptions:
        is_expired = sub["data_scadenza"] < now
        if sub["lezioni_rimanenti"] is not None and sub["lezioni_rimanenti"] <= 0:
            is_expired = True
        if not is_expired:
            ha_abbonamento_attivo = True
            break
    
    # Se non ha abbonamento attivo, BLOCCA la prenotazione
    if not ha_abbonamento_attivo:
        raise HTTPException(
            status_code=403, 
            detail="NO_SUBSCRIPTION"
        )
    
    booking = {
        "user_id": user_id,
        "lesson_id": data.lesson_id,
        "data_lezione": data.data_lezione,
        "abbonamento_scaduto": False,  # Se arriva qui, ha abbonamento attivo
        "confermata": True,
        "lezione_scalata": False,
        "created_at": now_rome(),
        # Salva i dati della lezione direttamente nella prenotazione
        "lesson_data": {
            "giorno": lesson["giorno"],
            "orario": lesson["orario"],
            "tipo_attivita": lesson["tipo_attivita"],
            "coach": lesson.get("coach", "Daniele")
        }
    }
    
    result = await db.bookings.insert_one(booking)
    
    # BONUS: Prima prenotazione della domenica = +2 biglietti! 🎟️
    bonus_biglietti = 0
    if today_weekday == 6 and current_hour >= 9:  # Domenica dopo le 9
        # Controlla se è la PRIMA prenotazione della settimana prossima
        # Calcola lunedì della prossima settimana
        next_monday = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        next_saturday = (now + timedelta(days=6)).strftime("%Y-%m-%d")
        
        # Conta prenotazioni già fatte oggi per la prossima settimana (esclusa questa)
        count_today = await db.bookings.count_documents({
            "data_lezione": {"$gte": next_monday, "$lte": next_saturday},
            "created_at": {"$gte": now.replace(hour=9, minute=0, second=0, microsecond=0)},
            "_id": {"$ne": result.inserted_id}
        })
        
        if count_today == 0:
            # È la PRIMA prenotazione! Assegna bonus
            bonus_biglietti = 2
            current_month = now.strftime("%Y-%m")
            
            # Aggiungi biglietti bonus
            await db.wheel_tickets.update_one(
                {"user_id": user_id, "mese": current_month},
                {"$inc": {"biglietti": bonus_biglietti}},
                upsert=True
            )
            logger.info(f"[BONUS] Prima prenotazione domenica! +{bonus_biglietti} biglietti a {current_user['nome']}")
    
    return BookingResponse(
        id=str(result.inserted_id),
        user_id=user_id,
        user_nome=current_user["nome"],
        user_cognome=current_user["cognome"],
        lesson_id=data.lesson_id,
        lesson_info=booking["lesson_data"],
        data_lezione=data.data_lezione,
        abbonamento_scaduto=False,
        confermata=True,
        lezione_scalata=False,
        created_at=booking["created_at"],
        bonus_biglietti=bonus_biglietti  # Nuovo campo per notificare il bonus
    )

@api_router.get("/bookings/me", response_model=List[BookingResponse])
async def get_my_bookings(current_user: dict = Depends(get_current_user)):
    """Get current user's bookings - OPTIMIZED"""
    user_id = str(current_user["_id"])
    bookings = await db.bookings.find({"user_id": user_id}).sort("data_lezione", -1).to_list(100)
    
    # PERFORMANCE FIX: Batch load all lessons at once
    lesson_ids_to_fetch = []
    for booking in bookings:
        if not booking.get("lesson_data"):
            if booking.get("lesson_id"):
                lesson_ids_to_fetch.append(booking["lesson_id"])
    
    lessons_cache = {}
    if lesson_ids_to_fetch:
        try:
            all_lessons = await get_cached_lessons()
            lessons_cache = {str(l["_id"]): l for l in all_lessons}
        except:
            pass
    
    result = []
    for booking in bookings:
        # Prima prova a usare lesson_data salvato nella prenotazione
        lesson_info = booking.get("lesson_data")
        
        # Se non c'è lesson_data, usa la cache
        if not lesson_info:
            lesson = lessons_cache.get(booking.get("lesson_id"))
            if lesson:
                lesson_info = {
                    "giorno": lesson["giorno"],
                    "orario": lesson["orario"],
                    "tipo_attivita": lesson["tipo_attivita"],
                    "coach": lesson.get("coach", "Daniele")
                }
        
        result.append(BookingResponse(
            id=str(booking["_id"]),
            user_id=booking["user_id"],
            user_nome=current_user["nome"],
            user_cognome=current_user["cognome"],
            lesson_id=booking.get("lesson_id", ""),
            lesson_info=lesson_info,
            data_lezione=booking["data_lezione"],
            abbonamento_scaduto=booking.get("abbonamento_scaduto", False),
            confermata=booking.get("confermata", True),
            lezione_scalata=booking.get("lezione_scalata", False),
            created_at=booking["created_at"]
        ))
    
    return result

# Log ingressi - lezioni effettuate dall'utente
@api_router.get("/bookings/history")
async def get_booking_history(current_user: dict = Depends(get_current_user)):
    """Ottiene lo storico delle lezioni effettuate (log ingressi)"""
    user_id = str(current_user["_id"])
    today = today_rome()
    
    # Prende le prenotazioni passate (data < oggi) che sono state confermate e scalate
    bookings = await db.bookings.find({
        "user_id": user_id,
        "data_lezione": {"$lt": today},
        "lezione_scalata": True
    }).sort("data_lezione", -1).to_list(100)
    
    result = []
    for booking in bookings:
        lesson_info = booking.get("lesson_data", {})
        result.append({
            "id": str(booking["_id"]),
            "data": booking["data_lezione"],
            "orario": lesson_info.get("orario", ""),
            "tipo_attivita": lesson_info.get("tipo_attivita", ""),
            "coach": lesson_info.get("coach", "Daniele")
        })
    
    return result

# ======================== LIVELLO SETTIMANALE ========================

@api_router.get("/user/livello")
async def get_user_livello(current_user: dict = Depends(get_current_user)):
    """Restituisce il livello settimanale dell'utente + progresso settimana corrente"""
    user_id = str(current_user["_id"])
    
    # === SETTIMANA PRECEDENTE (per livello raggiunto) ===
    prev_monday, prev_saturday = get_previous_week_dates()
    prev_week_dates = []
    start = datetime.strptime(prev_monday, "%Y-%m-%d")
    for i in range(6):
        d = start + timedelta(days=i)
        prev_week_dates.append(d.strftime("%Y-%m-%d"))
    
    # === SETTIMANA CORRENTE (per barra progresso) ===
    curr_monday, curr_saturday = get_current_week_dates()
    curr_week_dates = []
    start_curr = datetime.strptime(curr_monday, "%Y-%m-%d")
    for i in range(6):
        d = start_curr + timedelta(days=i)
        curr_week_dates.append(d.strftime("%Y-%m-%d"))
    
    # PERFORMANCE FIX: Query parallele per le due settimane
    prev_bookings, curr_bookings = await asyncio.gather(
        db.bookings.find({
            "user_id": user_id,
            "data_lezione": {"$in": prev_week_dates},
            "lezione_scalata": True
        }).to_list(100),
        db.bookings.find({
            "user_id": user_id,
            "data_lezione": {"$in": curr_week_dates},
            "confermata": True
        }).to_list(100)
    )
    
    # Conta OGNI allenamento fatto (anche più di uno al giorno)
    allenamenti_prev = len(prev_bookings)
    livello_info = get_livello_info(allenamenti_prev)
    
    # Conta OGNI allenamento (anche più di uno al giorno)
    allenamenti_curr_fatti = len([b for b in curr_bookings if b.get("lezione_scalata")])
    allenamenti_curr_prenotati = len([b for b in curr_bookings if not b.get("lezione_scalata")])
    
    # Prossimo livello
    prossimo_livello = None
    if allenamenti_prev < 5:
        prossimo_livello = LIVELLI_FITNESS[allenamenti_prev + 1]
    
    # Formatta date per display (DD/MM)
    def format_date_short(date_str):
        d = datetime.strptime(date_str, "%Y-%m-%d")
        return d.strftime("%d/%m")
    
    return {
        # Livello settimana precedente
        "livello": livello_info["livello"],
        "nome": livello_info["nome"],
        "icona": livello_info["icona"],
        "descrizione": livello_info["descrizione"],
        "allenamenti_settimana_precedente": allenamenti_prev,
        "settimana_precedente": f"{format_date_short(prev_monday)} - {format_date_short(prev_saturday)}",
        "prossimo_livello": prossimo_livello,
        "tutti_livelli": LIVELLI_FITNESS,
        # Progresso settimana corrente
        "settimana_corrente": f"{format_date_short(curr_monday)} - {format_date_short(curr_saturday)}",
        "allenamenti_fatti": allenamenti_curr_fatti,
        "allenamenti_prenotati": allenamenti_curr_prenotati,
        "max_allenamenti": 6
    }

# Conta lezioni effettuate nel periodo dell'abbonamento
@api_router.get("/subscriptions/{sub_id}/lessons-count")
async def get_subscription_lessons_count(sub_id: str, current_user: dict = Depends(get_current_user)):
    """Conta quante lezioni sono state fatte durante il periodo dell'abbonamento"""
    user_id = str(current_user["_id"])
    
    try:
        subscription = await db.subscriptions.find_one({"_id": ObjectId(sub_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Abbonamento non trovato")
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Abbonamento non trovato")
    
    if subscription["user_id"] != user_id and current_user.get("role") != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    data_inizio = subscription["data_inizio"]
    data_scadenza = subscription["data_scadenza"]
    
    # Conta le prenotazioni scalate nel periodo
    count = await db.bookings.count_documents({
        "user_id": subscription["user_id"],
        "data_lezione": {"$gte": data_inizio, "$lte": data_scadenza},
        "lezione_scalata": True
    })
    
    return {"lessons_count": count, "data_inizio": data_inizio, "data_scadenza": data_scadenza}


@api_router.get("/subscriptions/{sub_id}/log-ingressi")
async def get_subscription_log_ingressi(sub_id: str, current_user: dict = Depends(get_current_user)):
    """
    Restituisce il log degli ingressi SOLO per l'abbonamento specificato.
    Mostra: numero progressivo, giorno della settimana, data, orario, tipo lezione.
    Il log si azzera quando l'abbonamento scade/cambia.
    """
    user_id = str(current_user["_id"])
    
    try:
        subscription = await db.subscriptions.find_one({"_id": ObjectId(sub_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Abbonamento non trovato")
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Abbonamento non trovato")
    
    if subscription["user_id"] != user_id and current_user.get("role") != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    sub_user_id = subscription["user_id"]
    
    # Date di inizio e fine abbonamento
    data_inizio = subscription.get("data_inizio")
    data_scadenza = subscription.get("data_scadenza")
    
    # Normalizza le date in formato YYYY-MM-DD
    def normalize_date(d):
        if d is None:
            return None
        if isinstance(d, datetime):
            return d.strftime("%Y-%m-%d")
        if isinstance(d, str):
            # Rimuovi parte tempo se presente
            return d.split('T')[0] if 'T' in d else d[:10] if len(d) >= 10 else d
        return None
    
    data_inizio = normalize_date(data_inizio)
    data_scadenza = normalize_date(data_scadenza)
    
    logger.info(f"[LOG-INGRESSI] sub_id={sub_id}, user_id={sub_user_id}, inizio={data_inizio}, scadenza={data_scadenza}")
    
    # Query: SOLO lezioni nel periodo dell'abbonamento
    bookings = []
    if data_inizio and data_scadenza:
        query = {
            "user_id": sub_user_id,
            "data_lezione": {"$gte": data_inizio, "$lte": data_scadenza},
            "$or": [
                {"lezione_scalata": True},
                {"confermata": True}
            ]
        }
        bookings = await db.bookings.find(query).sort("data_lezione", 1).to_list(200)
        logger.info(f"[LOG-INGRESSI] Lezioni nel periodo abbonamento: {len(bookings)}")
    else:
        # Se mancano le date, non mostrare nulla (abbonamento non valido)
        logger.warning(f"[LOG-INGRESSI] Date abbonamento mancanti, log vuoto")
        bookings = []
    
    # Mappa giorni
    giorni_map = {
        0: "Lunedì", 1: "Martedì", 2: "Mercoledì", 
        3: "Giovedì", 4: "Venerdì", 5: "Sabato", 6: "Domenica"
    }
    
    log_entries = []
    for idx, booking in enumerate(bookings, 1):
        lesson_data = booking.get("lesson_data", {})
        data_lezione = booking.get("data_lezione", "")
        
        # Calcola giorno della settimana dalla data
        giorno_settimana = ""
        try:
            if data_lezione:
                data_obj = datetime.strptime(data_lezione[:10], "%Y-%m-%d")
                giorno_settimana = giorni_map.get(data_obj.weekday(), "")
        except:
            pass
        
        log_entries.append({
            "numero": idx,
            "giorno": giorno_settimana,
            "data": data_lezione[:10] if data_lezione else "N/D",
            "orario": lesson_data.get("orario") or booking.get("orario_lezione") or "N/D",
            "tipo_attivita": lesson_data.get("tipo_attivita") or booking.get("tipo_attivita") or "N/D",
            "coach": lesson_data.get("coach", "Daniele")
        })
    
    logger.info(f"[LOG-INGRESSI] Restituisco {len(log_entries)} ingressi")
    
    return {
        "log_ingressi": log_entries,
        "totale": len(log_entries)
    }


@api_router.delete("/bookings/{booking_id}")
async def cancel_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    
    try:
        booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    except:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")
    
    if not booking:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")
    
    # Allow admin to delete any booking
    if current_user.get("role") != UserRole.ADMIN and booking["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    await db.bookings.delete_one({"_id": ObjectId(booking_id)})
    return {"message": "Prenotazione cancellata"}


@api_router.post("/admin/bookings/{booking_id}/confirm-presence")
async def confirm_presence_and_deduct(booking_id: str, admin_user: dict = Depends(get_admin_user)):
    """
    Conferma la presenza di un utente e scala la lezione dall'abbonamento.
    Solo per admin.
    """
    try:
        booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    except:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")
    
    if not booking:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")
    
    # Se già scalata, non fare nulla
    if booking.get("lezione_scalata"):
        return {"message": "Lezione già scalata", "already_processed": True}
    
    user_id = booking["user_id"]
    oggi = now_rome().strftime("%Y-%m-%d")
    
    # Cerca abbonamento a PACCHETTO
    sub_pacchetto = await db.subscriptions.find_one({
        "user_id": user_id,
        "attivo": True,
        "tipo": {"$in": ["lezione_singola", "lezioni_8", "lezioni_16"]},
        "lezioni_rimanenti": {"$gt": 0}
    })
    
    result = {"message": "", "tipo_abbonamento": "", "lezioni_rimanenti": None}
    
    if sub_pacchetto:
        # Scala la lezione dall'abbonamento a pacchetto
        await db.subscriptions.update_one(
            {"_id": sub_pacchetto["_id"]},
            {"$inc": {"lezioni_rimanenti": -1}}
        )
        
        # Segna come scalata
        await db.bookings.update_one(
            {"_id": ObjectId(booking_id)},
            {"$set": {"lezione_scalata": True}}
        )
        
        updated_sub = await db.subscriptions.find_one({"_id": sub_pacchetto["_id"]})
        result["message"] = "Lezione scalata con successo"
        result["tipo_abbonamento"] = sub_pacchetto["tipo"]
        result["lezioni_rimanenti"] = updated_sub["lezioni_rimanenti"]
        
        # Notifica se abbonamento esaurito
        if updated_sub["lezioni_rimanenti"] <= 0:
            notification = {
                "user_id": user_id,
                "tipo": "abbonamento_esaurito",
                "messaggio": f"Il tuo abbonamento {sub_pacchetto['tipo']} è esaurito.",
                "letta": False,
                "created_at": now_rome()
            }
            await db.notifications.insert_one(notification)
            result["message"] = "Lezione scalata - Abbonamento esaurito!"
    else:
        # Cerca abbonamento a TEMPO
        sub_tempo = await db.subscriptions.find_one({
            "user_id": user_id,
            "attivo": True,
            "tipo": {"$in": ["mensile", "trimestrale", "annuale"]},
            "data_scadenza": {"$gte": oggi}
        })
        
        if sub_tempo:
            # Segna come scalata (conferma presenza)
            await db.bookings.update_one(
                {"_id": ObjectId(booking_id)},
                {"$set": {"lezione_scalata": True}}
            )
            result["message"] = "Presenza confermata"
            result["tipo_abbonamento"] = sub_tempo["tipo"]
        else:
            raise HTTPException(status_code=400, detail="Utente senza abbonamento valido")
    
    logger.info(f"[CONFIRM] Presenza confermata per booking {booking_id}, user {user_id}")
    # Valuta streak bonus settimanale dopo la conferma
    try:
        streak_res = await check_and_award_streak_bonus(user_id, booking["data_lezione"])
        if streak_res.get("bonus_awarded", 0) > 0:
            result["streak_bonus"] = streak_res
    except Exception as exc:
        logger.warning(f"[STREAK] Errore streak bonus per {user_id}: {exc}")
    return result

# Endpoint per vedere i partecipanti di una lezione (pubblico per utenti autenticati)
@api_router.get("/lessons/{lesson_id}/participants/{lesson_date}")
async def get_lesson_participants(lesson_id: str, lesson_date: str, current_user: dict = Depends(get_current_user)):
    """Restituisce i partecipanti di una lezione per una data specifica - OPTIMIZED"""
    bookings = await db.bookings.find({
        "lesson_id": lesson_id,
        "data_lezione": lesson_date,
        "confermata": True
    }).to_list(100)
    
    # PERFORMANCE FIX: Batch load all users at once
    user_ids = list(set(b["user_id"] for b in bookings))
    users_cache = {}
    if user_ids:
        try:
            users = await db.users.find(
                {"_id": {"$in": [ObjectId(uid) for uid in user_ids]}},
                {"profile_image": 0}  # Exclude only heavy field, keep all others
            ).to_list(len(user_ids))
            users_cache = {str(u["_id"]): u for u in users}
        except Exception as e:
            logging.error(f"Error loading users for participants: {e}")
    
    is_admin = current_user.get("role") == UserRole.ADMIN
    participants = []
    for booking in bookings:
        user = users_cache.get(booking["user_id"])
        if user:
            # Usa soprannome se presente, altrimenti nome completo
            display_name = user.get("soprannome") if user.get("soprannome") else f"{user.get('nome', '')} {user.get('cognome', '')}"
            entry = {"nome": display_name.strip()}
            # Espone i campi gestionali solo all'admin
            if is_admin:
                entry["booking_id"] = str(booking["_id"])
                entry["user_id"] = booking["user_id"]
                entry["lezione_scalata"] = booking.get("lezione_scalata", False)
            participants.append(entry)
    
    return {
        "lesson_id": lesson_id,
        "date": lesson_date,
        "participants": participants,
        "count": len(participants)
    }


# ===== ADMIN: Gestione manuale prenotazioni =====

class AdminForceBookingCreate(BaseModel):
    user_id: str
    lesson_id: str
    data_lezione: str
    scala_lezione: bool = True


@api_router.post("/admin/bookings/force-add")
async def admin_force_add_booking(data: AdminForceBookingCreate, admin_user: dict = Depends(get_admin_user)):
    """Admin-only: aggiunge un cliente a una lezione senza i normali controlli (settimana, ora, ecc).
    Se scala_lezione=True, scala 1 lezione dal pacchetto attivo (se presente)."""
    try:
        user = await db.users.find_one({"_id": ObjectId(data.user_id)})
    except:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    try:
        lesson = await db.lessons.find_one({"_id": ObjectId(data.lesson_id)})
    except:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    if not lesson:
        raise HTTPException(status_code=404, detail="Lezione non trovata")

    existing = await db.bookings.find_one({
        "user_id": data.user_id,
        "lesson_id": data.lesson_id,
        "data_lezione": data.data_lezione
    })
    if existing:
        raise HTTPException(status_code=400, detail="Cliente già prenotato a questa lezione")

    booking = {
        "user_id": data.user_id,
        "lesson_id": data.lesson_id,
        "data_lezione": data.data_lezione,
        "abbonamento_scaduto": False,
        "confermata": True,
        "lezione_scalata": False,
        "created_at": now_rome(),
        "added_by_admin": True,
        "lesson_data": {
            "giorno": lesson["giorno"],
            "orario": lesson["orario"],
            "tipo_attivita": lesson["tipo_attivita"],
            "coach": lesson.get("coach", "Daniele")
        }
    }
    result = await db.bookings.insert_one(booking)
    booking_id = str(result.inserted_id)

    scaled_info = {"scalata": False, "tipo": None, "lezioni_rimanenti": None}
    if data.scala_lezione:
        sub_pacchetto = await db.subscriptions.find_one({
            "user_id": data.user_id,
            "attivo": True,
            "tipo": {"$in": ["lezione_singola", "lezioni_8", "lezioni_16"]},
            "lezioni_rimanenti": {"$gt": 0}
        })
        if sub_pacchetto:
            await db.subscriptions.update_one(
                {"_id": sub_pacchetto["_id"]},
                {"$inc": {"lezioni_rimanenti": -1}}
            )
            await db.bookings.update_one(
                {"_id": ObjectId(booking_id)},
                {"$set": {"lezione_scalata": True}}
            )
            updated = await db.subscriptions.find_one({"_id": sub_pacchetto["_id"]})
            scaled_info = {
                "scalata": True,
                "tipo": sub_pacchetto["tipo"],
                "lezioni_rimanenti": updated["lezioni_rimanenti"]
            }

    return {
        "message": "Cliente aggiunto alla lezione",
        "booking_id": booking_id,
        "scaled": scaled_info
    }


@api_router.delete("/admin/bookings/{booking_id}/admin-remove")
async def admin_remove_booking(booking_id: str, riaccredita: bool = False, admin_user: dict = Depends(get_admin_user)):
    """Admin-only: rimuove una prenotazione. Se riaccredita=True e la lezione era stata scalata, riaccredita +1 al pacchetto attivo più recente."""
    try:
        booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    except:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")
    if not booking:
        raise HTTPException(status_code=404, detail="Prenotazione non trovata")

    user_id = booking["user_id"]
    was_scaled = booking.get("lezione_scalata", False)
    credit_info = {"riaccreditata": False, "tipo": None, "lezioni_rimanenti": None}

    if riaccredita and was_scaled:
        sub = await db.subscriptions.find_one(
            {
                "user_id": user_id,
                "attivo": True,
                "tipo": {"$in": ["lezione_singola", "lezioni_8", "lezioni_16"]},
                "lezioni_rimanenti": {"$ne": None}
            },
            sort=[("data_inizio", -1)]
        )
        if sub:
            await db.subscriptions.update_one(
                {"_id": sub["_id"]},
                {"$inc": {"lezioni_rimanenti": 1}}
            )
            updated = await db.subscriptions.find_one({"_id": sub["_id"]})
            credit_info = {
                "riaccreditata": True,
                "tipo": sub["tipo"],
                "lezioni_rimanenti": updated["lezioni_rimanenti"]
            }

    await db.bookings.delete_one({"_id": ObjectId(booking_id)})
    return {
        "message": "Prenotazione rimossa",
        "was_scaled": was_scaled,
        "credit": credit_info
    }


@api_router.get("/bookings/day/{day_date}", response_model=List[BookingResponse])
async def get_bookings_by_date(day_date: str, admin_user: dict = Depends(get_admin_user)):
    """Get all bookings for a specific date - OPTIMIZED"""
    bookings = await db.bookings.find({"data_lezione": day_date}).to_list(1000)
    
    # PERFORMANCE FIX: Batch load all users and lessons at once
    user_ids = list(set(b["user_id"] for b in bookings))
    lesson_ids = list(set(b.get("lesson_id") for b in bookings if b.get("lesson_id")))
    
    users_cache = {}
    if user_ids:
        users = await db.users.find(
            {"_id": {"$in": [ObjectId(uid) for uid in user_ids]}},
            {"profile_image": 0}
        ).to_list(len(user_ids))
        users_cache = {str(u["_id"]): u for u in users}
    
    lessons_cache = {}
    if lesson_ids:
        all_lessons = await get_cached_lessons()
        lessons_cache = {str(l["_id"]): l for l in all_lessons}
    
    result = []
    for booking in bookings:
        user = users_cache.get(booking["user_id"])
        lesson = lessons_cache.get(booking.get("lesson_id"))
        
        result.append(BookingResponse(
            id=str(booking["_id"]),
            user_id=booking["user_id"],
            user_nome=user["nome"] if user else "Sconosciuto",
            user_cognome=user["cognome"] if user else "",
            lesson_id=booking.get("lesson_id", ""),
            lesson_info={
                "giorno": lesson["giorno"] if lesson else "",
                "orario": lesson["orario"] if lesson else "",
                "tipo_attivita": lesson["tipo_attivita"] if lesson else "",
                "coach": lesson.get("coach", "Daniele") if lesson else "Daniele"
            } if lesson else None,
            data_lezione=booking["data_lezione"],
            abbonamento_scaduto=booking.get("abbonamento_scaduto", False),
            confermata=booking.get("confermata", True),
            lezione_scalata=booking.get("lezione_scalata", False),
            created_at=booking["created_at"]
        ))
    
    return result

# ======================== ADMIN ROUTES ========================

@api_router.get("/admin/users", response_model=List[UserResponse])
async def get_all_users(admin_user: dict = Depends(get_admin_user)):
    # Escludi utenti archiviati dalla lista principale
    users = await db.users.find({"archived": {"$ne": True}}, {"profile_image": 0}).to_list(1000)
    
    # Recupera l'ultimo abbonamento per ogni utente (ordinato per data creazione desc)
    all_subs = await db.subscriptions.find({}, {"_id": 0, "user_id": 1, "tipo": 1, "data_inizio": 1, "data_scadenza": 1, "pagato": 1, "created_at": 1}).sort("created_at", -1).to_list(5000)
    
    # Mappa: user_id -> ultimo abbonamento
    last_sub_map = {}
    for sub in all_subs:
        uid = sub["user_id"]
        if uid not in last_sub_map:
            last_sub_map[uid] = sub
    
    result = []
    for user in users:
        uid = str(user["_id"])
        last_sub = last_sub_map.get(uid)
        result.append(UserResponse(
            id=uid,
            email=user["email"],
            nome=user["nome"],
            cognome=user["cognome"],
            telefono=user.get("telefono"),
            soprannome=user.get("soprannome"),
            role=user["role"],
            created_at=user["created_at"],
            push_token=user.get("push_token"),
            profile_image=None,
            archived=user.get("archived", False),
            prova_attiva=user.get("prova_attiva", False),
            prova_inizio=user.get("prova_inizio"),
            prova_scadenza=user.get("prova_scadenza"),
            ultimo_abb_tipo=last_sub["tipo"] if last_sub else None,
            ultimo_abb_inizio=last_sub["data_inizio"].strftime("%Y-%m-%d") if last_sub and last_sub.get("data_inizio") else None,
            ultimo_abb_scadenza=last_sub["data_scadenza"].strftime("%Y-%m-%d") if last_sub and last_sub.get("data_scadenza") else None,
            ultimo_abb_pagato=last_sub.get("pagato") if last_sub else None,
        ))
    return result


@api_router.get("/admin/users/archived", response_model=List[UserResponse])
async def get_archived_users(admin_user: dict = Depends(get_admin_user)):
    """Ottieni lista clienti archiviati (non attivi)"""
    users = await db.users.find({"archived": True}, {"profile_image": 0}).to_list(1000)
    return [
        UserResponse(
            id=str(user["_id"]),
            email=user["email"],
            nome=user["nome"],
            cognome=user["cognome"],
            telefono=user.get("telefono"),
            soprannome=user.get("soprannome"),
            role=user["role"],
            created_at=user["created_at"],
            push_token=user.get("push_token"),
            profile_image=None,
            archived=True
        ) for user in users
    ]


@api_router.post("/admin/users/{user_id}/archive")
async def archive_user(user_id: str, admin_user: dict = Depends(get_admin_user)):
    """Archivia un cliente (lo mette in stato non attivo senza cancellarlo)"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"role": 1, "nome": 1, "cognome": 1})
    except:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    # Non permettere di archiviare admin
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Non puoi archiviare un admin")
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"archived": True, "archived_at": now_rome()}}
    )
    
    logger.info(f"[ADMIN] Cliente {user.get('nome')} {user.get('cognome')} archiviato")
    return {"message": f"Cliente {user.get('nome')} {user.get('cognome')} archiviato con successo"}


@api_router.post("/admin/users/{user_id}/restore")
async def restore_user(user_id: str, admin_user: dict = Depends(get_admin_user)):
    """Riattiva un cliente archiviato"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"nome": 1, "cognome": 1})
    except:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"archived": False}, "$unset": {"archived_at": ""}}
    )
    
    logger.info(f"[ADMIN] Cliente {user.get('nome')} {user.get('cognome')} riattivato")
    return {"message": f"Cliente {user.get('nome')} {user.get('cognome')} riattivato con successo"}

@api_router.get("/admin/daily-stats/{stats_date}", response_model=DailyStats)
async def get_daily_stats(stats_date: str, admin_user: dict = Depends(get_admin_user)):
    """Get daily statistics - OPTIMIZED"""
    bookings = await db.bookings.find({"data_lezione": stats_date}).to_list(1000)
    
    # PERFORMANCE FIX: Batch load lessons and subscriptions
    lesson_ids_to_fetch = []
    user_ids = list(set(b["user_id"] for b in bookings))
    
    for booking in bookings:
        if not booking.get("lesson_data"):
            if booking.get("lesson_id"):
                lesson_ids_to_fetch.append(booking["lesson_id"])
    
    lessons_cache = {}
    if lesson_ids_to_fetch:
        all_lessons = await get_cached_lessons()
        lessons_cache = {str(l["_id"]): l for l in all_lessons}
    
    # Batch load all subscriptions for these users
    pacchetto_users = set()
    if user_ids:
        pacchetto_subs = await db.subscriptions.find({
            "user_id": {"$in": user_ids},
            "attivo": True,
            "tipo": {"$in": ["lezione_singola", "lezioni_8", "lezioni_16"]}
        }).to_list(1000)
        pacchetto_users = set(s["user_id"] for s in pacchetto_subs)
    
    prenotazioni_per_lezione = {}
    lezioni_scalate_count = 0  # Conta solo quelle GIA' scalate
    
    for booking in bookings:
        # Usa lesson_data salvato nella prenotazione o recupera dalla cache
        lesson_data = booking.get("lesson_data")
        if not lesson_data:
            lesson = lessons_cache.get(booking.get("lesson_id"))
            if lesson:
                lesson_data = {
                    "orario": lesson["orario"],
                    "tipo_attivita": lesson["tipo_attivita"],
                    "coach": lesson.get("coach", "Daniele")
                }
        
        if lesson_data:
            key = f"{lesson_data['orario']} - {lesson_data['tipo_attivita'].capitalize()}"
            if key not in prenotazioni_per_lezione:
                prenotazioni_per_lezione[key] = 0
            prenotazioni_per_lezione[key] += 1
        
        # Conta SOLO lezioni GIA' scalate (lezione_scalata=True)
        if booking.get("lezione_scalata") == True:
            lezioni_scalate_count += 1
    
    # Count expired subscriptions
    now = now_rome()
    all_subs = await db.subscriptions.find({"attivo": True}).to_list(1000)
    abbonamenti_scaduti = 0
    for sub in all_subs:
        is_expired = sub["data_scadenza"] < now
        if sub["lezioni_rimanenti"] is not None and sub["lezioni_rimanenti"] <= 0:
            is_expired = True
        if is_expired:
            abbonamenti_scaduti += 1
    
    return DailyStats(
        data=stats_date,
        totale_prenotazioni=len(bookings),
        prenotazioni_per_lezione=prenotazioni_per_lezione,
        abbonamenti_scaduti=abbonamenti_scaduti,
        lezioni_scalate=lezioni_scalate_count
    )

@api_router.post("/admin/process-day/{process_date}")
async def process_end_of_day(process_date: str, admin_user: dict = Depends(get_admin_user)):
    """Process end of day: deduct lessons from per-lesson subscriptions"""
    bookings = await db.bookings.find({
        "data_lezione": process_date,
        "lezione_scalata": False,
        "confermata": True
    }).to_list(1000)
    
    processed = 0
    for booking in bookings:
        user_id = booking["user_id"]
        
        # Find active per-lesson subscription
        sub = await db.subscriptions.find_one({
            "user_id": user_id,
            "attivo": True,
            "tipo": {"$in": ["lezione_singola", "lezioni_8", "lezioni_16"]},
            "lezioni_rimanenti": {"$gt": 0}
        })
        
        if sub:
            # Deduct lesson
            await db.subscriptions.update_one(
                {"_id": sub["_id"]},
                {"$inc": {"lezioni_rimanenti": -1}}
            )
            
            # Mark booking as processed
            await db.bookings.update_one(
                {"_id": booking["_id"]},
                {"$set": {"lezione_scalata": True}}
            )
            
            processed += 1
            # Bonus streak settimanale
            try:
                await check_and_award_streak_bonus(user_id, booking.get("data_lezione"))
            except Exception as exc:
                logger.warning(f"[STREAK] {exc}")
            
            # Check if subscription is now empty
            updated_sub = await db.subscriptions.find_one({"_id": sub["_id"]})
            if updated_sub["lezioni_rimanenti"] <= 0:
                # Create notification for expired subscription
                notification = {
                    "user_id": user_id,
                    "tipo": "abbonamento_esaurito",
                    "messaggio": f"Il tuo abbonamento {sub['tipo']} è esaurito. Rinnova per continuare a prenotare.",
                    "letta": False,
                    "created_at": now_rome()
                }
                await db.notifications.insert_one(notification)
    
    return {"message": f"Elaborate {processed} prenotazioni", "processed": processed}


@api_router.post("/admin/process-started-lessons")
async def process_started_lessons(admin_user: dict = Depends(get_admin_user)):
    """
    Processa automaticamente le lezioni GIA' INIZIATE (basato su orario Roma).
    Scala le lezioni dagli abbonamenti a pacchetto e segna come presenti per quelli a tempo.
    """
    now = now_rome()
    oggi = now.strftime("%Y-%m-%d")
    ora_corrente = now.strftime("%H:%M")
    
    logger.info(f"[PROCESS] Inizio processo lezioni iniziate - Data: {oggi}, Ora Roma: {ora_corrente}")
    
    # Trova tutte le prenotazioni di oggi non ancora scalate
    bookings = await db.bookings.find({
        "data_lezione": oggi,
        "lezione_scalata": False,
        "confermata": True
    }).to_list(1000)
    
    processed_pacchetto = 0
    processed_tempo = 0
    skipped = 0
    
    for booking in bookings:
        # Ottieni l'orario della lezione
        lesson_data = booking.get("lesson_data", {})
        orario_lezione = lesson_data.get("orario", "")
        
        if not orario_lezione:
            # Prova a recuperare dalla lezione
            try:
                lesson_id = booking.get("lesson_id")
                if lesson_id:
                    lesson = await db.lessons.find_one({"_id": ObjectId(lesson_id)})
                    if lesson:
                        orario_lezione = lesson.get("orario", "")
            except:
                pass
        
        if not orario_lezione:
            logger.warning(f"[PROCESS] Booking {booking['_id']} senza orario, skip")
            skipped += 1
            continue
        
        # Controlla se la lezione è già iniziata (ora corrente >= orario lezione)
        if ora_corrente < orario_lezione:
            logger.info(f"[PROCESS] Lezione {orario_lezione} non ancora iniziata (ora: {ora_corrente}), skip")
            skipped += 1
            continue
        
        user_id = booking["user_id"]
        
        # Cerca abbonamento attivo dell'utente
        # Prima cerca abbonamento a PACCHETTO (lezioni_8, lezioni_16)
        sub_pacchetto = await db.subscriptions.find_one({
            "user_id": user_id,
            "attivo": True,
            "tipo": {"$in": ["lezione_singola", "lezioni_8", "lezioni_16"]},
            "lezioni_rimanenti": {"$gt": 0}
        })
        
        if sub_pacchetto:
            # Scala la lezione dall'abbonamento a pacchetto
            await db.subscriptions.update_one(
                {"_id": sub_pacchetto["_id"]},
                {"$inc": {"lezioni_rimanenti": -1}}
            )
            
            # Segna come scalata
            await db.bookings.update_one(
                {"_id": booking["_id"]},
                {"$set": {"lezione_scalata": True}}
            )
            
            processed_pacchetto += 1
            logger.info(f"[PROCESS] Scalata lezione pacchetto per user {user_id}, lezione {orario_lezione}")
            
            # Controlla se abbonamento esaurito
            updated_sub = await db.subscriptions.find_one({"_id": sub_pacchetto["_id"]})
            if updated_sub and updated_sub["lezioni_rimanenti"] <= 0:
                notification = {
                    "user_id": user_id,
                    "tipo": "abbonamento_esaurito",
                    "messaggio": f"Il tuo abbonamento {sub_pacchetto['tipo']} è esaurito. Rinnova per continuare a prenotare.",
                    "letta": False,
                    "created_at": now_rome()
                }
                await db.notifications.insert_one(notification)
        else:
            # Cerca abbonamento a TEMPO (mensile, trimestrale, annuale)
            oggi_str = oggi  # già stringa "YYYY-MM-DD"
            sub_tempo = await db.subscriptions.find_one({
                "user_id": user_id,
                "attivo": True,
                "tipo": {"$in": ["mensile", "trimestrale", "annuale"]}
            })
            
            if sub_tempo:
                # Verifica scadenza (gestisce sia stringa che datetime)
                data_scadenza = sub_tempo.get("data_scadenza", "")
                if isinstance(data_scadenza, datetime):
                    data_scadenza = data_scadenza.strftime("%Y-%m-%d")
                
                if data_scadenza >= oggi_str:
                    # Segna come scalata (conferma presenza)
                    await db.bookings.update_one(
                        {"_id": booking["_id"]},
                        {"$set": {"lezione_scalata": True}}
                    )
                    processed_tempo += 1
                    logger.info(f"[PROCESS] ✓ Confermata presenza TEMPO per user {user_id}, lezione {orario_lezione}")
                else:
                    logger.warning(f"[PROCESS] Abbonamento tempo scaduto per user {user_id}")
                    skipped += 1
            else:
                logger.warning(f"[PROCESS] User {user_id} senza abbonamento valido, skip")
                skipped += 1
    
    result = {
        "message": f"Processo completato alle {ora_corrente} (Roma)",
        "data": oggi,
        "processed_pacchetto": processed_pacchetto,
        "processed_tempo": processed_tempo,
        "skipped": skipped,
        "totale_processate": processed_pacchetto + processed_tempo
    }
    
    logger.info(f"[PROCESS] Risultato: {result}")
    return result

# ======================== WEEKLY STATS (ADMIN ONLY) ========================


@api_router.post("/admin/force-process")
async def force_process_lessons(admin_user: dict = Depends(get_admin_user)):
    """Forza il processamento di tutte le lezioni non scalate (oggi e ieri)"""
    now = now_rome()
    oggi = now.strftime("%Y-%m-%d")
    ieri = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    
    bookings = await db.bookings.find({
        "data_lezione": {"$in": [oggi, ieri]},
        "lezione_scalata": False,
        "confermata": True
    }).to_list(1000)
    
    processed = 0
    for booking in bookings:
        user_id = booking["user_id"]
        
        sub_pacchetto = await db.subscriptions.find_one({
            "user_id": user_id, "attivo": True,
            "tipo": {"$in": ["lezione_singola", "lezioni_8", "lezioni_16"]},
            "lezioni_rimanenti": {"$gt": 0}
        })
        
        if sub_pacchetto:
            await db.subscriptions.update_one(
                {"_id": sub_pacchetto["_id"]},
                {"$inc": {"lezioni_rimanenti": -1}}
            )
            await db.bookings.update_one(
                {"_id": booking["_id"]},
                {"$set": {"lezione_scalata": True, "subscription_id": str(sub_pacchetto["_id"])}}
            )
            processed += 1
            try:
                await check_and_award_streak_bonus(user_id, booking.get("data_lezione"))
            except Exception as exc:
                logger.warning(f"[STREAK] {exc}")
        else:
            sub_tempo = await db.subscriptions.find_one({
                "user_id": user_id, "attivo": True,
                "tipo": {"$in": ["mensile", "trimestrale"]},
                "data_scadenza": {"$gte": now}
            })
            if sub_tempo:
                await db.bookings.update_one(
                    {"_id": booking["_id"]},
                    {"$set": {"lezione_scalata": True, "subscription_id": str(sub_tempo["_id"])}}
                )
                processed += 1
                try:
                    await check_and_award_streak_bonus(user_id, booking.get("data_lezione"))
                except Exception as exc:
                    logger.warning(f"[STREAK] {exc}")
    
    return {"message": f"Processate {processed} prenotazioni su {len(bookings)} trovate"}

@api_router.get("/admin/weekly-stats")
async def get_weekly_stats(admin_user: dict = Depends(get_admin_user)):
    """Get weekly statistics: total presences and lessons already deducted.
    
    Logica settimana:
    - Lun-Ven: mostra settimana corrente
    - Sabato fino alle 14:00: mostra settimana corrente
    - Sabato dopo le 14:00: mostra settimana prossima
    - Domenica: mostra SEMPRE settimana prossima
    """
    today = now_rome()
    current_day = today.weekday()  # 0=Monday, 6=Sunday
    current_hour = today.hour
    
    # Se è Sabato dopo le 14:00 o Domenica, mostra la settimana PROSSIMA
    if current_day == 5 and current_hour >= 14:  # Saturday after 2 PM
        monday = today + timedelta(days=2)
    elif current_day == 6:  # Sunday - SEMPRE settimana prossima
        monday = today + timedelta(days=1)
    else:
        # Lunedì-Sabato (prima delle 14) -> mostra settimana corrente
        monday = today - timedelta(days=current_day)
    
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    sunday = monday + timedelta(days=6)
    
    # Get date strings for the week (Mon-Sun)
    week_dates = []
    for i in range(7):
        d = monday + timedelta(days=i)
        week_dates.append(d.strftime("%Y-%m-%d"))
    
    # PERFORMANCE FIX: Parallel count queries
    presenze, lezioni_scalate = await asyncio.gather(
        db.bookings.count_documents({
            "data_lezione": {"$in": week_dates},
            "confermata": True
        }),
        db.bookings.count_documents({
            "data_lezione": {"$in": week_dates},
            "confermata": True,
            "lezione_scalata": True
        })
    )
    
    # Format dates for display (DD/MM)
    monday_display = monday.strftime("%d/%m")
    sunday_display = sunday.strftime("%d/%m")
    
    return {
        "presenze": presenze,
        "lezioni_scalate": lezioni_scalate,
        "settimana": f"{monday_display} - {sunday_display}"
    }


# ======================== TOP 5 SETTIMANALE ========================

# Utenti da escludere dalla classifica (utenti di test)
LEADERBOARD_EXCLUDED_USERS = ["daniele brufani"]

@api_router.get("/leaderboard/weekly")
async def get_weekly_leaderboard(current_user: dict = Depends(get_current_user)):
    """Get top 3 positions by workouts - mostra la settimana CORRENTE.
    Solo podio: 1°, 2°, 3° posto.
    Le posizioni sono basate sul NUMERO di allenamenti:
    - 1° = chi ha fatto più allenamenti
    - 2° = chi ha fatto il secondo numero più alto
    - 3° = chi ha fatto il terzo numero più alto
    Più persone possono essere nella stessa posizione (pari merito).
    """
    today = now_rome()
    current_day = today.weekday()
    
    # Calcola lunedì della settimana CORRENTE
    monday = today - timedelta(days=current_day)
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    saturday = monday + timedelta(days=5)
    saturday_str = saturday.strftime("%Y-%m-%d")
    
    # Controlla se il sabato è bloccato (lezione sospesa)
    sabato_bloccato = await db.blocked_dates.find_one({"data": saturday_str})
    
    if not sabato_bloccato:
        # Sabato NON bloccato: aspetta che le lezioni del sabato vengano processate
        yoga_sabato_scalate = await db.bookings.count_documents({
            "data_lezione": saturday_str,
            "confermata": True,
            "lezione_scalata": True
        })
        
        if yoga_sabato_scalate == 0:
            return {
                "leaderboard": [],
                "settimana": f"{monday.strftime('%d/%m')} - {saturday.strftime('%d/%m')}",
                "total_participants": 0,
                "status": "pending"
            }
    else:
        # Sabato BLOCCATO: la classifica esce basandosi sulle lezioni fino a venerdì
        # Aspetta che sia almeno sabato per mostrare la classifica
        if current_day < 5:  # Prima di sabato
            venerdi_str = (monday + timedelta(days=4)).strftime("%Y-%m-%d")
            lezioni_venerdi = await db.bookings.count_documents({
                "data_lezione": venerdi_str,
                "confermata": True,
                "lezione_scalata": True
            })
            if lezioni_venerdi == 0 and current_day < 4:
                return {
                    "leaderboard": [],
                    "settimana": f"{monday.strftime('%d/%m')} - {saturday.strftime('%d/%m')}",
                    "total_participants": 0,
                    "status": "pending"
                }
    
    # Get date strings for the week (Mon-Sat)
    week_dates = [(monday + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6)]
    
    # Query: per ogni utente, conta allenamenti e prendi ultima lezione
    pipeline = [
        {
            "$match": {
                "data_lezione": {"$in": week_dates},
                "confermata": True,
                "lezione_scalata": True
            }
        },
        {
            "$lookup": {
                "from": "lessons",
                "localField": "lesson_id",
                "foreignField": "_id",
                "as": "lesson_info"
            }
        },
        {
            "$unwind": {"path": "$lesson_info", "preserveNullAndEmptyArrays": True}
        },
        {
            "$group": {
                "_id": "$user_id",
                "allenamenti": {"$sum": 1},
                "ultimo_data": {"$max": "$data_lezione"},
                "ultimo_orario": {"$max": "$lesson_info.orario"}
            }
        },
        {"$sort": {"allenamenti": -1, "ultimo_data": 1, "ultimo_orario": 1}},
        {"$limit": 30}
    ]
    
    top_users = await db.bookings.aggregate(pipeline).to_list(length=30)
    
    if not top_users:
        return {
            "leaderboard": [],
            "settimana": f"{monday.strftime('%d/%m')} - {saturday.strftime('%d/%m')}",
            "total_participants": 0,
            "status": "no_data"
        }
    
    # Fetch tutti gli utenti in una sola query
    user_ids = [ObjectId(entry["_id"]) for entry in top_users if entry["_id"]]
    users_map = {}
    if user_ids:
        users_cursor = db.users.find(
            {"_id": {"$in": user_ids}},
            {"_id": 1, "nome": 1, "cognome": 1, "soprannome": 1}
        )
        async for u in users_cursor:
            users_map[str(u["_id"])] = u
    
    # Filtra utenti esclusi e costruisci lista
    filtered_entries = []
    for entry in top_users:
        user = users_map.get(entry["_id"])
        if user:
            full_name = f"{user.get('nome', '')} {user.get('cognome', '')}".strip().lower()
            if full_name in [name.lower() for name in LEADERBOARD_EXCLUDED_USERS]:
                continue
            filtered_entries.append({
                "user_id": entry["_id"],
                "user": user,
                "allenamenti": entry["allenamenti"],
                "ultimo_data": entry.get("ultimo_data"),
                "ultimo_orario": entry.get("ultimo_orario")
            })
    
    # Trova i TOP 3 numeri DISTINTI di allenamenti (solo podio)
    unique_counts = sorted(set(e["allenamenti"] for e in filtered_entries), reverse=True)[:3]
    
    # Assegna posizioni basate sul numero di allenamenti
    # 1° = chi ha il numero più alto, 2° = chi ha il secondo più alto, ecc.
    leaderboard = []
    settimana_key = f"{monday.strftime('%Y-%m-%d')}"
    
    for position, count in enumerate(unique_counts, 1):
        # Trova tutti con questo numero di allenamenti
        entries_with_count = [e for e in filtered_entries if e["allenamenti"] == count]
        
        # Ordina per chi ha finito prima (pari merito se stessa lezione finale)
        entries_with_count.sort(key=lambda x: (x["ultimo_data"] or "", x["ultimo_orario"] or ""))
        
        for entry in entries_with_count:
            user = entry["user"]
            display_name = user.get("soprannome") or user.get("nome", "Utente")
            
            # Controlla pari merito: stessa posizione E più di una persona
            is_pari = len(entries_with_count) > 1
            
            leaderboard.append({
                "posizione": position,
                "nome": display_name,
                "nome_completo": f"{user.get('nome', '')} {user.get('cognome', '')}".strip(),
                "allenamenti": entry["allenamenti"],
                "is_me": entry["user_id"] == str(current_user["_id"]),
                "pari_merito": is_pari
            })
            
            # SALVA MEDAGLIA nel database (se non già salvata)
            medal_type = {1: "oro", 2: "argento", 3: "bronzo"}.get(position)
            if medal_type:
                existing_medal = await db.medals.find_one({
                    "user_id": entry["user_id"],
                    "settimana": settimana_key
                })
                if not existing_medal:
                    await db.medals.insert_one({
                        "user_id": entry["user_id"],
                        "settimana": settimana_key,
                        "settimana_display": f"{monday.strftime('%d/%m')} - {saturday.strftime('%d/%m')}",
                        "posizione": position,
                        "medaglia": medal_type,
                        "allenamenti": entry["allenamenti"],
                        "pari_merito": is_pari,
                        "created_at": now_rome()
                    })
    
    return {
        "leaderboard": leaderboard,
        "settimana": f"{monday.strftime('%d/%m')} - {saturday.strftime('%d/%m')}",
        "total_participants": len(leaderboard),
        "status": "ready"
    }


# ======================== BACHECA MEDAGLIE ========================

@api_router.get("/medals/me")
async def get_my_medals(current_user: dict = Depends(get_current_user)):
    """Ritorna tutte le medaglie vinte dall'utente"""
    user_id = str(current_user["_id"])
    
    medals = await db.medals.find(
        {"user_id": user_id}
    ).sort("created_at", -1).to_list(100)
    
    # Conta medaglie per tipo
    oro = sum(1 for m in medals if m["medaglia"] == "oro")
    argento = sum(1 for m in medals if m["medaglia"] == "argento")
    bronzo = sum(1 for m in medals if m["medaglia"] == "bronzo")
    
    return {
        "totale": len(medals),
        "oro": oro,
        "argento": argento,
        "bronzo": bronzo,
        "medaglie": [
            {
                "settimana": m["settimana_display"],
                "posizione": m["posizione"],
                "medaglia": m["medaglia"],
                "allenamenti": m["allenamenti"],
                "pari_merito": m.get("pari_merito", False)
            }
            for m in medals
        ]
    }



# ======================== WEEKLY BOOKINGS VIEW (ADMIN ONLY) ========================

@api_router.get("/admin/weekly-bookings")
async def get_weekly_bookings(admin_user: dict = Depends(get_admin_user)):
    """Get all bookings for the current week grouped by lesson - OPTIMIZED
    
    Logica settimana:
    - Lun-Ven: mostra settimana corrente
    - Sabato fino alle 14:00: mostra settimana corrente
    - Sabato dopo le 14:00: mostra settimana prossima
    - Domenica: mostra SEMPRE settimana prossima
    """
    # Calculate current week (Mon-Sat)
    today = now_rome()
    current_day = today.weekday()  # 0 = Monday
    
    # Se è Sabato dopo le 14:00 o Domenica, mostra la settimana PROSSIMA
    if current_day == 5 and today.hour >= 14:  # Saturday after 2 PM
        days_until_monday = 2
        monday = today + timedelta(days=days_until_monday)
    elif current_day == 6:  # Sunday - SEMPRE settimana prossima
        days_until_monday = 1
        monday = today + timedelta(days=days_until_monday)
    else:
        # Find this week's Monday
        days_from_monday = current_day
        monday = today - timedelta(days=days_from_monday)
    
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    saturday = monday + timedelta(days=5)
    
    # Get date strings for the week
    week_dates = []
    for i in range(6):  # Mon to Sat
        d = monday + timedelta(days=i)
        week_dates.append(d.strftime("%Y-%m-%d"))
    
    # Get all lessons (from cache)
    lessons = await get_cached_lessons()
    
    # Get all bookings for this week
    all_bookings = await db.bookings.find({
        "data_lezione": {"$in": week_dates}
    }).to_list(5000)
    
    # PERFORMANCE FIX: Batch load all users at once
    user_ids = list(set(b["user_id"] for b in all_bookings))
    if user_ids:
        users = await db.users.find(
            {"_id": {"$in": [ObjectId(uid) for uid in user_ids]}},
            {"profile_image": 0}  # Exclude heavy field
        ).to_list(len(user_ids))
        users_cache = {str(u["_id"]): u for u in users}
    else:
        users_cache = {}
    
    # Group bookings by date and lesson
    result = []
    for date_str in week_dates:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        day_name = ["lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"][date_obj.weekday()]
        
        # Get lessons for this day
        day_lessons = [l for l in lessons if l["giorno"] == day_name]
        day_lessons.sort(key=lambda x: x["orario"])
        
        day_data = {
            "data": date_str,
            "giorno": day_name,
            "lezioni": []
        }
        
        # Get ALL bookings for this date
        date_bookings = [b for b in all_bookings if b["data_lezione"] == date_str]
        
        for lesson in day_lessons:
            lesson_id = str(lesson["_id"])
            lesson_bookings = [b for b in date_bookings if b.get("lesson_id") == lesson_id]
            
            # Get user details from cache
            participants = []
            for booking in lesson_bookings:
                user = users_cache.get(booking["user_id"])
                if user:
                    participants.append({
                        "booking_id": str(booking["_id"]),
                        "user_id": booking["user_id"],
                        "nome": user["nome"],
                        "cognome": user["cognome"],
                        "soprannome": user.get("soprannome", ""),
                        "abbonamento_scaduto": booking.get("abbonamento_scaduto", False),
                        "lezione_scalata": booking.get("lezione_scalata", False)
                    })
            
            day_data["lezioni"].append({
                "lesson_id": lesson_id,
                "orario": lesson["orario"],
                "tipo_attivita": lesson["tipo_attivita"],
                "partecipanti": participants,
                "totale_iscritti": len(participants)
            })
        
        result.append(day_data)
    
    return {
        "settimana_inizio": week_dates[0],
        "settimana_fine": week_dates[5],
        "giorni": result
    }

# Dashboard stats for admin
@api_router.get("/admin/dashboard")
async def get_admin_dashboard(current_user: dict = Depends(get_current_user)):
    """Get dashboard statistics for admin - OPTIMIZED with parallel queries"""
    if current_user.get("role") != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    
    today = today_rome()
    now = now_rome()
    
    # PERFORMANCE FIX: Esegui query indipendenti in parallelo
    total_users_task = db.users.count_documents({"role": "client", "archived": {"$ne": True}})
    bookings_today_task = db.bookings.count_documents({"data_lezione": today, "confermata": True})
    all_active_subs_task = db.subscriptions.find({"attivo": True}, {"user_id": 1, "data_scadenza": 1, "lezioni_rimanenti": 1}).to_list(1000)
    archived_users_task = db.users.find({"archived": True}, {"_id": 1}).to_list(1000)
    
    total_users, bookings_today, all_active_subs, archived_users = await asyncio.gather(
        total_users_task, bookings_today_task, all_active_subs_task, archived_users_task
    )
    
    archived_user_ids = set(str(u["_id"]) for u in archived_users)
    
    active_subscriptions = 0
    for sub in all_active_subs:
        if sub["user_id"] in archived_user_ids:
            continue
        data_scadenza = sub.get("data_scadenza")
        if isinstance(data_scadenza, str):
            from dateutil import parser
            data_scadenza = parser.parse(data_scadenza).replace(tzinfo=ROME_TZ)
        is_expired = data_scadenza < now if data_scadenza else False
        if sub.get("lezioni_rimanenti") is not None and sub["lezioni_rimanenti"] <= 0:
            is_expired = True
        if not is_expired:
            active_subscriptions += 1
    
    return {
        "stats": {
            "total_users": total_users,
            "active_subscriptions": active_subscriptions,
            "bookings_today": bookings_today
        },
        "expiring_soon": [],
        "today_lessons": [],
        "recent_users": []
    }


# ======================== NUTRIZIONE ENDPOINTS ========================

def calcola_nutrizione(profilo: NutritionProfileCreate, lezioni_settimana: int = 0):
    """Calcolo scientifico del fabbisogno calorico e macronutrienti"""
    # BMR - Formula Mifflin-St Jeor
    if profilo.sesso.upper() == "M":
        bmr = (10 * profilo.peso) + (6.25 * profilo.altezza) - (5 * profilo.eta) - 5
    else:
        bmr = (10 * profilo.peso) + (6.25 * profilo.altezza) - (5 * profilo.eta) - 161
    
    # Fattore attività basato sulle lezioni settimanali
    if lezioni_settimana == 0:
        fattore = 1.2
        lezioni_consigliate = 3
    elif lezioni_settimana <= 2:
        fattore = 1.375
        lezioni_consigliate = 3
    elif lezioni_settimana <= 4:
        fattore = 1.55
        lezioni_consigliate = 4
    else:
        fattore = 1.725
        lezioni_consigliate = 5
    
    tdee = bmr * fattore
    
    # Aggiustamento per obiettivo
    if profilo.obiettivo == "dimagrire":
        calorie = tdee - 400
        lezioni_consigliate = max(lezioni_consigliate, 4)
    elif profilo.obiettivo == "massa":
        calorie = tdee + 350
        lezioni_consigliate = max(lezioni_consigliate, 4)
    else:
        calorie = tdee
    
    # Macronutrienti
    proteine_g = round((calorie * 0.28) / 4, 0)
    carboidrati_g = round((calorie * 0.45) / 4, 0)
    grassi_g = round((calorie * 0.27) / 9, 0)
    
    return {
        "bmr": round(bmr, 0),
        "tdee": round(tdee, 0),
        "calorie_giornaliere": round(calorie, 0),
        "proteine_g": proteine_g,
        "carboidrati_g": carboidrati_g,
        "grassi_g": grassi_g,
        "lezioni_consigliate": lezioni_consigliate,
    }


@api_router.post("/nutrition/profile")
async def save_nutrition_profile(data: NutritionProfileCreate, current_user: dict = Depends(get_current_user)):
    """Salva il profilo nutrizionale dell'utente"""
    user_id = str(current_user["_id"])
    
    # Verifica abbonamento attivo (admin e istruttori bypassano)
    is_privileged = current_user.get("role") in ("admin", "istruttore")
    if not is_privileged:
        has_sub = await check_user_has_active_subscription(user_id)
        if not has_sub:
            raise HTTPException(status_code=403, detail="Serve un abbonamento attivo per accedere al piano alimentare")
    
    # Calcola lezioni medie settimanali dell'utente (ultime 4 settimane)
    now = now_rome()
    quattro_sett_fa = (now - timedelta(days=28)).strftime("%Y-%m-%d")
    lezioni_count = await db.bookings.count_documents({
        "user_id": user_id,
        "confermata": True,
        "lezione_scalata": True,
        "data_lezione": {"$gte": quattro_sett_fa}
    })
    lezioni_settimana = round(lezioni_count / 4)
    
    calcoli = calcola_nutrizione(data, lezioni_settimana)
    
    profile_doc = {
        "user_id": user_id,
        "sesso": data.sesso,
        "eta": data.eta,
        "peso": data.peso,
        "altezza": data.altezza,
        "obiettivo": data.obiettivo,
        "intolleranze": data.intolleranze,
        "alimenti_esclusi": data.alimenti_esclusi,
        "note": data.note,
        "lezioni_settimana": lezioni_settimana,
        **calcoli,
        "updated_at": now,
    }
    
    await db.nutrition_profiles.update_one(
        {"user_id": user_id},
        {"$set": profile_doc},
        upsert=True
    )
    
    return {**profile_doc, "message": "Profilo salvato"}


@api_router.post("/nutrition/generate-plan")
async def generate_meal_plan(background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Genera il piano alimentare mensile con AI (in background)"""
    user_id = str(current_user["_id"])
    
    # Verifica abbonamento attivo (admin e istruttori bypassano)
    is_privileged = current_user.get("role") in ("admin", "istruttore")
    if not is_privileged:
        # Utenti in prova NON possono generare il piano
        is_trial = await check_user_is_trial(user_id)
        if is_trial:
            raise HTTPException(status_code=403, detail="Il piano alimentare AI e riservato agli abbonati. Sottoscrivi un abbonamento per accedere!")
        has_sub = await check_user_has_active_subscription(user_id)
        if not has_sub:
            raise HTTPException(status_code=403, detail="Serve un abbonamento attivo")
    
    # Recupera profilo nutrizionale
    profile = await db.nutrition_profiles.find_one({"user_id": user_id})
    if not profile:
        raise HTTPException(status_code=400, detail="Compila prima il tuo profilo nutrizionale")
    
    # Controlla se ha già generato questo mese
    now = now_rome()
    mese_corrente = now.strftime("%Y-%m")
    existing_plan = await db.meal_plans.find_one({
        "user_id": user_id,
        "mese": mese_corrente
    })
    if existing_plan and existing_plan.get("piano"):
        raise HTTPException(status_code=400, detail="Hai già generato il piano per questo mese!")
    
    # Controlla se c'è già una generazione in corso
    if existing_plan and existing_plan.get("status") == "generating":
        return {"status": "generating", "message": "Il piano è in fase di generazione... attendere circa 1 minuto."}
    
    # Se c'era un errore, elimina il record per poter riprovare
    if existing_plan and existing_plan.get("status") == "error":
        await db.meal_plans.delete_one({"user_id": user_id, "mese": mese_corrente})
    
    # Prepara il prompt per l'AI
    intolleranze_text = ", ".join(profile.get("intolleranze", [])) if profile.get("intolleranze") else "nessuna"
    esclusi_text = profile.get("alimenti_esclusi", "nessuno") or "nessuno"
    
    obiettivo_desc = {
        "dimagrire": "perdita di peso graduale e sana",
        "mantenimento": "mantenimento del peso forma",
        "massa": "aumento della massa muscolare"
    }.get(profile["obiettivo"], profile["obiettivo"])
    
    prompt = f"""Crea un piano alimentare settimanale per:
- {"Uomo" if profile["sesso"] == "M" else "Donna"}, {profile["eta"]} anni, {profile["peso"]}kg, {profile["altezza"]}cm
- Obiettivo: {obiettivo_desc}
- {profile["calorie_giornaliere"]} kcal/giorno (P:{profile["proteine_g"]}g C:{profile["carboidrati_g"]}g G:{profile["grassi_g"]}g)
- Intolleranze: {intolleranze_text}
- Evitare: {esclusi_text}
- Allenamenti: {profile.get("lezioni_settimana", 0)}/settimana

Crea 2 settimane tipo (la 3a e 4a possono ruotare). Per ogni giorno: Colazione, Spuntino, Pranzo, Merenda, Cena con 2 alternative e calorie. Usa ricette italiane di stagione. Aggiungi lista spesa e consigli allenamento. Formato ben strutturato in italiano."""
    
    # Crea un record "in generazione" nel DB
    await db.meal_plans.update_one(
        {"user_id": user_id, "mese": mese_corrente},
        {"$set": {
            "user_id": user_id,
            "user_nome": current_user["nome"],
            "user_cognome": current_user["cognome"],
            "mese": mese_corrente,
            "status": "generating",
            "piano": None,
            "created_at": now,
        }},
        upsert=True
    )
    
    # Lancia la generazione in background
    async def generate_plan_background(uid, profile_data, mese):
        try:
            import httpx
            llm_key = os.environ.get("EMERGENT_LLM_KEY", "").strip()
            
            # Retry fino a 3 volte in caso di errore 502
            response_text = None
            for attempt in range(3):
                try:
                    async with httpx.AsyncClient(timeout=180.0) as client:
                        resp = await client.post(
                            "https://integrations.emergentagent.com/llm/chat/completions",
                            headers={"Content-Type": "application/json", "Authorization": f"Bearer {llm_key}"},
                            json={
                                "model": "gpt-4.1",
                                "messages": [
                                    {"role": "system", "content": "Sei un nutrizionista sportivo esperto italiano. Crea piani alimentari dettagliati, personalizzati e basati sulla scienza della nutrizione. Rispondi sempre in italiano."},
                                    {"role": "user", "content": prompt}
                                ]
                            }
                        )
                    
                    if resp.status_code == 200:
                        response_text = resp.json()["choices"][0]["message"]["content"]
                        break
                    else:
                        logger.warning(f"[NUTRITION] Tentativo {attempt+1}/3 - Status {resp.status_code}")
                        await asyncio.sleep(3)
                except Exception as retry_err:
                    logger.warning(f"[NUTRITION] Tentativo {attempt+1}/3 - Errore: {retry_err}")
                    await asyncio.sleep(3)
            
            if not response_text:
                raise Exception("Generazione fallita dopo 3 tentativi")
            
            await db.meal_plans.update_one(
                {"user_id": uid, "mese": mese},
                {"$set": {
                    "piano": response_text,
                    "status": "completed",
                    "profilo": {
                        "peso": profile_data["peso"],
                        "obiettivo": profile_data["obiettivo"],
                        "calorie": profile_data["calorie_giornaliere"],
                    },
                }}
            )
            logger.info(f"[NUTRITION] Piano generato per {uid} - {len(response_text)} caratteri")
        except Exception as e:
            logger.error(f"[NUTRITION] Errore background: {e}")
            await db.meal_plans.update_one(
                {"user_id": uid, "mese": mese},
                {"$set": {"status": "error", "error_detail": str(e)}}
            )
    
    # Avvia task in background con asyncio
    asyncio.create_task(generate_plan_background(user_id, dict(profile), mese_corrente))
    
    return {
        "status": "generating",
        "message": "Il piano alimentare è in fase di generazione! Ci vogliono circa 30-60 secondi. La pagina si aggiornerà automaticamente."
    }


@api_router.get("/nutrition/my-plan")
async def get_my_plan(current_user: dict = Depends(get_current_user)):
    """Recupera profilo e piano corrente dell'utente"""
    user_id = str(current_user["_id"])
    now = now_rome()
    mese_corrente = now.strftime("%Y-%m")
    
    # PERFORMANCE FIX: Parallel DB queries
    profile, plan, has_sub = await asyncio.gather(
        db.nutrition_profiles.find_one({"user_id": user_id}, {"_id": 0}),
        db.meal_plans.find_one(
            {"user_id": user_id, "mese": mese_corrente},
            {"_id": 0, "user_nome": 0, "user_cognome": 0}
        ),
        check_user_has_active_subscription(user_id)
    )
    
    # Admin e istruttori hanno sempre accesso
    is_privileged = current_user.get("role") in ("admin", "istruttore")
    
    return {
        "has_subscription": has_sub or is_privileged,
        "profile": profile,
        "plan": plan,
        "mese_corrente": mese_corrente,
    }


@api_router.delete("/nutrition/reset-plan")
async def reset_meal_plan(current_user: dict = Depends(get_current_user)):
    """Azzera il piano alimentare - solo admin"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo l'admin può azzerare i piani")
    
    user_id = str(current_user["_id"])
    now = now_rome()
    mese_corrente = now.strftime("%Y-%m")
    
    result = await db.meal_plans.delete_one({"user_id": user_id, "mese": mese_corrente})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Nessun piano da azzerare per questo mese")
    

@api_router.delete("/admin/nutrition/reset-plan/{user_id}")
async def admin_reset_user_plan(user_id: str, current_user: dict = Depends(get_current_user)):
    """Admin azzera il piano di un utente specifico"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo l'admin può azzerare i piani")
    
    now = now_rome()
    mese_corrente = now.strftime("%Y-%m")
    
    result = await db.meal_plans.delete_one({"user_id": user_id, "mese": mese_corrente})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Nessun piano da azzerare per questo utente")
    
    return {"message": "Piano dell'utente azzerato con successo."}

    return {"message": "Piano azzerato! Ora puoi rigenerarlo con nuove indicazioni."}



@api_router.get("/admin/nutrition/plans")
async def get_all_nutrition_plans(admin_user: dict = Depends(get_admin_user)):
    """Admin: vedi tutti i piani generati"""
    now = now_rome()
    mese_corrente = now.strftime("%Y-%m")
    
    # PERFORMANCE: Parallel queries
    plans_task = db.meal_plans.find(
        {"mese": mese_corrente},
        {"_id": 0, "piano": 0}  # Escludi il piano completo per leggerezza
    ).sort("created_at", -1).to_list(1000)
    count_plans_task = db.meal_plans.count_documents({"mese": mese_corrente})
    count_profiles_task = db.nutrition_profiles.count_documents({})
    
    plans, total_plans, total_profiles = await asyncio.gather(
        plans_task, count_plans_task, count_profiles_task
    )
    
    # Arricchisci con dati dal profilo
    user_ids = list(set(p["user_id"] for p in plans))
    profiles_cache = {}
    if user_ids:
        profiles = await db.nutrition_profiles.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0}
        ).to_list(len(user_ids))
        profiles_cache = {p["user_id"]: p for p in profiles}
    
    for plan in plans:
        plan["profile_at_generation"] = profiles_cache.get(plan["user_id"], plan.get("profilo", {}))
        plan.setdefault("generated_at", plan.get("created_at"))
    
    return {
        "mese": mese_corrente,
        "piani_generati": total_plans,
        "profili_totali": total_profiles,
        "plans": plans,
    }

@api_router.get("/admin/nutrition/plan/{user_id}")
async def get_user_nutrition_plan(user_id: str, admin_user: dict = Depends(get_admin_user)):
    """Admin: vedi il piano completo di un utente"""
    now = now_rome()
    mese_corrente = now.strftime("%Y-%m")
    
    plan = await db.meal_plans.find_one(
        {"user_id": user_id, "mese": mese_corrente},
        {"_id": 0}
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Nessun piano trovato per questo utente")
    
    profile = await db.nutrition_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    return {"plan": plan, "profile": profile}


# ======================== AUTOMATIC LESSON PROCESSING ========================

async def process_lessons_after_30min():
    """Process bookings 30 minutes after each lesson starts - deduct lessons from subscriptions"""
    now = now_rome()
    today = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M")
    
    # Calculate time 30 minutes ago
    time_30min_ago = (now - timedelta(minutes=30)).strftime("%H:%M")
    
    logger.info(f"[SCHEDULER] Checking lessons that started around {time_30min_ago}")
    
    # Find all lessons for today (from cache)
    lessons = await get_cached_lessons()
    
    for lesson in lessons:
        lesson_time = lesson["orario"]
        lesson_id = str(lesson["_id"])
        
        # Check se la lezione è annullata per oggi
        cancelled = await db.cancelled_lessons.find_one({
            "lesson_id": lesson_id,
            "data_lezione": today
        })
        if cancelled:
            logger.info(f"[SCHEDULER] Skipping {lesson_time} on {today} (cancelled: {cancelled.get('motivo', '')})")
            continue
        
        # Check if this lesson started approximately 30 minutes ago (within 5 min window)
        lesson_hour, lesson_min = map(int, lesson_time.split(":"))
        lesson_datetime = now.replace(hour=lesson_hour, minute=lesson_min, second=0, microsecond=0)
        lesson_plus_30 = lesson_datetime + timedelta(minutes=30)
        
        # Process if we're within 5 minutes of the 30-minute mark
        time_diff = abs((now - lesson_plus_30).total_seconds())
        if time_diff <= 300:  # 5 minute window
            # Find bookings for this lesson today that haven't been processed
            bookings = await db.bookings.find({
                "lesson_id": str(lesson["_id"]),
                "data_lezione": today,
                "lezione_scalata": False,
                "confermata": True
            }).to_list(100)
            
            for booking in bookings:
                user_id = booking["user_id"]
                
                # Find active per-lesson subscription
                sub = await db.subscriptions.find_one({
                    "user_id": user_id,
                    "attivo": True,
                    "tipo": {"$in": ["lezione_singola", "lezioni_8", "lezioni_16"]},
                    "lezioni_rimanenti": {"$gt": 0}
                })
                
                if sub:
                    # Deduct lesson
                    await db.subscriptions.update_one(
                        {"_id": sub["_id"]},
                        {"$inc": {"lezioni_rimanenti": -1}}
                    )
                    
                    logger.info(f"[SCHEDULER] Deducted 1 lesson for user {user_id}, lesson at {lesson_time}")
                    
                    # Check if subscription is now empty
                    updated_sub = await db.subscriptions.find_one({"_id": sub["_id"]})
                    if updated_sub["lezioni_rimanenti"] <= 0:
                        notification = {
                            "user_id": user_id,
                            "tipo": "abbonamento_esaurito",
                            "messaggio": f"Il tuo abbonamento {sub['tipo']} è esaurito. Rinnova per continuare a prenotare.",
                            "letta": False,
                            "created_at": now_rome()
                        }
                        await db.notifications.insert_one(notification)
                
                # Mark booking as processed (even if no subscription to deduct)
                await db.bookings.update_one(
                    {"_id": booking["_id"]},
                    {"$set": {"lezione_scalata": True}}
                )

async def process_day_automatically():
    """Backup midnight processing for any missed bookings"""
    yesterday = (now_rome() - timedelta(days=1)).strftime("%Y-%m-%d")
    
    logger.info(f"[SCHEDULER] Backup processing for {yesterday}")
    
    bookings = await db.bookings.find({
        "data_lezione": yesterday,
        "lezione_scalata": False,
        "confermata": True
    }).to_list(1000)
    
    processed = 0
    processed_tempo = 0
    for booking in bookings:
        user_id = booking["user_id"]
        
        # Find active per-lesson subscription
        sub = await db.subscriptions.find_one({
            "user_id": user_id,
            "attivo": True,
            "tipo": {"$in": ["lezione_singola", "lezioni_8", "lezioni_16"]},
            "lezioni_rimanenti": {"$gt": 0}
        })
        
        if sub:
            # Deduct lesson
            await db.subscriptions.update_one(
                {"_id": sub["_id"]},
                {"$inc": {"lezioni_rimanenti": -1}}
            )
            
            # Mark booking as processed
            await db.bookings.update_one(
                {"_id": booking["_id"]},
                {"$set": {"lezione_scalata": True}}
            )
            
            processed += 1
            
            # Check if subscription is now empty
            updated_sub = await db.subscriptions.find_one({"_id": sub["_id"]})
            if updated_sub["lezioni_rimanenti"] <= 0:
                notification = {
                    "user_id": user_id,
                    "tipo": "abbonamento_esaurito",
                    "messaggio": f"Il tuo abbonamento {sub['tipo']} è esaurito. Rinnova per continuare a prenotare.",
                    "letta": False,
                    "created_at": now_rome()
                }
                await db.notifications.insert_one(notification)
        else:
            # Cerca abbonamento a TEMPO (mensile, trimestrale, annuale)
            sub_tempo = await db.subscriptions.find_one({
                "user_id": user_id,
                "attivo": True,
                "tipo": {"$in": ["mensile", "trimestrale", "annuale"]}
            })
            
            if sub_tempo:
                # Segna come scalata (conferma presenza)
                await db.bookings.update_one(
                    {"_id": booking["_id"]},
                    {"$set": {"lezione_scalata": True}}
                )
                processed_tempo += 1
    
    total_processed = processed + processed_tempo
    logger.info(f"[SCHEDULER] Processed {processed} pacchetto + {processed_tempo} tempo = {total_processed} for {yesterday}")
    
    # Log the processing
    await db.processing_logs.insert_one({
        "data": yesterday,
        "processed": processed,
        "timestamp": now_rome()
    })

class UserUpdate(BaseModel):
    nome: Optional[str] = None
    cognome: Optional[str] = None
    soprannome: Optional[str] = None
    telefono: Optional[str] = None

@api_router.put("/admin/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, admin_user: dict = Depends(get_admin_user)):
    """Admin: Update user data"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    update_data = {}
    if data.nome is not None:
        update_data["nome"] = data.nome
    if data.cognome is not None:
        update_data["cognome"] = data.cognome
    if data.soprannome is not None:
        update_data["soprannome"] = data.soprannome if data.soprannome else None
    if data.telefono is not None:
        update_data["telefono"] = data.telefono
    
    if update_data:
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    return {
        "id": str(updated_user["_id"]),
        "nome": updated_user["nome"],
        "cognome": updated_user["cognome"],
        "soprannome": updated_user.get("soprannome"),
        "telefono": updated_user.get("telefono"),
        "email": updated_user["email"]
    }

@api_router.get("/admin/notifications", response_model=List[NotificationResponse])
async def get_all_notifications(admin_user: dict = Depends(get_admin_user)):
    notifications = await db.notifications.find().sort("created_at", -1).to_list(100)
    
    # PERFORMANCE FIX: Batch load all users at once (era N+1 query)
    user_ids = list(set(n["user_id"] for n in notifications))
    users_cache = {}
    if user_ids:
        users = await db.users.find(
            {"_id": {"$in": [ObjectId(uid) for uid in user_ids]}},
            {"nome": 1, "cognome": 1}
        ).to_list(len(user_ids))
        users_cache = {str(u["_id"]): u for u in users}
    
    result = []
    for notif in notifications:
        user = users_cache.get(notif["user_id"])
        result.append(NotificationResponse(
            id=str(notif["_id"]),
            user_id=notif["user_id"],
            user_nome=user["nome"] if user else "Sconosciuto",
            user_cognome=user["cognome"] if user else "",
            tipo=notif["tipo"],
            messaggio=notif["messaggio"],
            letta=notif.get("letta", False),
            created_at=notif["created_at"]
        ))
    
    return result

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin_user: dict = Depends(get_admin_user)):
    """Delete a user and all their associated data (subscriptions, bookings)"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"role": 1})
        if not user:
            raise HTTPException(status_code=404, detail="Utente non trovato")
        
        # Cannot delete admin users
        if user.get("role") == UserRole.ADMIN:
            raise HTTPException(status_code=400, detail="Non puoi eliminare un admin")
        
        # Delete user's subscriptions
        await db.subscriptions.delete_many({"user_id": user_id})
        
        # Delete user's bookings
        await db.bookings.delete_many({"user_id": user_id})
        
        # Delete user's notifications
        await db.notifications.delete_many({"user_id": user_id})
        
        # Delete the user
        await db.users.delete_one({"_id": ObjectId(user_id)})
        
        return {"message": "Utente eliminato con successo"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/admin/users/{user_id}/set-role")
async def set_user_role(user_id: str, role: str, admin_user: dict = Depends(get_admin_user)):
    """Imposta il ruolo di un utente (admin only)"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"role": 1})
        if not user:
            raise HTTPException(status_code=404, detail="Utente non trovato")
        
        # Validate role
        valid_roles = ["client", "istruttore"]
        if role not in valid_roles:
            raise HTTPException(status_code=400, detail=f"Ruolo non valido. Usa: {valid_roles}")
        
        # Cannot change admin role
        if user.get("role") == UserRole.ADMIN:
            raise HTTPException(status_code=400, detail="Non puoi modificare il ruolo di un admin")
        
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"role": role}}
        )
        
        logger.info(f"[ROLE] User {user_id} ruolo cambiato a {role}")
        return {"message": f"Ruolo aggiornato a {role}", "role": role}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ResetPasswordRequest(BaseModel):
    new_password: str


class ChangePasswordRequest(BaseModel):
    new_password: str
    confirm_password: str


@api_router.post("/auth/change-password")
async def change_password(data: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    """Cambia password (usato dopo reset da admin)"""
    try:
        if data.new_password != data.confirm_password:
            raise HTTPException(status_code=400, detail="Le password non coincidono")
        
        if len(data.new_password) < 6:
            raise HTTPException(status_code=400, detail="La password deve essere di almeno 6 caratteri")
        
        hashed_password = hash_password(data.new_password)
        
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$set": {
                "hashed_password": hashed_password,
                "must_reset_password": False  # Rimuovi il flag
            }}
        )
        
        logger.info(f"[PASSWORD CHANGE] User {current_user['email']} ha cambiato la password")
        return {"message": "Password cambiata con successo"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/admin/users/{user_id}/reset-password")
async def admin_reset_password(user_id: str, data: ResetPasswordRequest, admin_user: dict = Depends(get_admin_user)):
    """Reset password di un utente (admin only) - richiede cambio al primo login"""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"role": 1, "email": 1})
        if not user:
            raise HTTPException(status_code=404, detail="Utente non trovato")
        
        # Non permettere reset password di altri admin
        if user.get("role") == UserRole.ADMIN and str(user["_id"]) != str(admin_user["_id"]):
            raise HTTPException(status_code=400, detail="Non puoi resettare la password di un altro admin")
        
        # Valida la nuova password
        if len(data.new_password) < 6:
            raise HTTPException(status_code=400, detail="La password deve essere di almeno 6 caratteri")
        
        # Hash della nuova password
        hashed_password = hash_password(data.new_password)
        
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "hashed_password": hashed_password,
                "must_reset_password": True  # Forza cambio password al primo login
            }}
        )
        
        logger.info(f"[PASSWORD RESET] Admin {admin_user['email']} ha resettato la password di {user['email']}")
        return {"message": "Password resettata. L'utente dovrà cambiarla al primo accesso."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/istruttore/lezioni")
async def get_istruttore_lezioni(current_user: dict = Depends(get_current_user)):
    """
    Vista per istruttori: mostra tutte le lezioni della settimana con i partecipanti.
    OTTIMIZZATO per velocità.
    
    Logica settimana (allineata con admin):
    - Lun-Sab (prima delle 14): settimana corrente
    - Sabato dopo le 14: settimana prossima
    - Domenica: SEMPRE settimana prossima
    """
    # Verifica che sia un istruttore o admin
    if current_user.get("role") not in [UserRole.ISTRUTTORE, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Accesso riservato agli istruttori")
    
    today = now_rome()
    current_day = today.weekday()
    current_hour = today.hour
    
    # Calcola il lunedì della settimana da mostrare
    if current_day == 5 and current_hour >= 14:  # Sabato dopo le 14
        monday = today + timedelta(days=2)
    elif current_day == 6:  # Domenica -> settimana PROSSIMA
        monday = today + timedelta(days=1)
    else:
        monday = today - timedelta(days=current_day)
    
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Genera date della settimana (lun-sab)
    week_dates = [(monday + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6)]
    
    # Query parallele per velocizzare (lezioni dalla cache)
    all_lessons = await get_cached_lessons()
    bookings = await db.bookings.find(
        {"data_lezione": {"$in": week_dates}, "confermata": True},
        {"user_id": 1, "lesson_id": 1, "data_lezione": 1, "lezione_scalata": 1}
    ).to_list(1000)
    
    # Carica solo gli utenti necessari (solo nome e soprannome)
    user_ids = list(set(b["user_id"] for b in bookings))
    users = await db.users.find(
        {"_id": {"$in": [ObjectId(uid) for uid in user_ids]}},
        {"nome": 1, "soprannome": 1}
    ).to_list(len(user_ids)) if user_ids else []
    users_map = {str(u["_id"]): u for u in users}
    
    # Pre-indicizza bookings per velocità
    bookings_index = {}
    for b in bookings:
        lesson_id = b.get('lesson_id')
        if lesson_id:
            key = f"{lesson_id}_{b['data_lezione']}"
            if key not in bookings_index:
                bookings_index[key] = []
            bookings_index[key].append(b)
    
    # Pre-indicizza lezioni per giorno
    lessons_by_day = {}
    for lesson in all_lessons:
        giorno = lesson.get("giorno", "")
        if giorno not in lessons_by_day:
            lessons_by_day[giorno] = []
        lessons_by_day[giorno].append(lesson)
    
    # Costruisci risultato
    giorni_db = ["lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"]
    giorni_display = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"]
    
    result = []
    for i, data in enumerate(week_dates):
        day_lessons = lessons_by_day.get(giorni_db[i], [])
        day_lessons.sort(key=lambda x: x["orario"])
        
        lezioni_list = []
        for lesson in day_lessons:
            key = f"{str(lesson['_id'])}_{data}"
            lesson_bookings = bookings_index.get(key, [])
            
            partecipanti = [
                {
                    "nome": users_map.get(b["user_id"], {}).get("nome", ""),
                    "soprannome": users_map.get(b["user_id"], {}).get("soprannome", ""),
                    "lezione_scalata": b.get("lezione_scalata", False)
                }
                for b in lesson_bookings
            ]
            
            lezioni_list.append({
                "id": str(lesson["_id"]),
                "orario": lesson["orario"],
                "tipo_attivita": lesson["tipo_attivita"],
                "coach": lesson.get("coach", "Daniele"),
                "partecipanti": partecipanti,
                "totale_iscritti": len(partecipanti)
            })
        
        result.append({
            "data": data,
            "giorno": giorni_display[i],
            "lezioni": lezioni_list
        })
    
    return {
        "settimana": f"{week_dates[0]} - {week_dates[-1]}",
        "giorni": result
    }


@api_router.get("/notifications/me", response_model=List[NotificationResponse])
async def get_my_notifications(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    notifications = await db.notifications.find({"user_id": user_id}).sort("created_at", -1).to_list(100)
    
    return [
        NotificationResponse(
            id=str(notif["_id"]),
            user_id=notif["user_id"],
            user_nome=current_user["nome"],
            user_cognome=current_user["cognome"],
            tipo=notif["tipo"],
            messaggio=notif["messaggio"],
            letta=notif.get("letta", False),
            created_at=notif["created_at"]
        ) for notif in notifications
    ]

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    try:
        await db.notifications.update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {"letta": True}}
        )
        return {"message": "Notifica segnata come letta"}
    except:
        raise HTTPException(status_code=404, detail="Notifica non trovata")

# ======================== CHAT/COMUNICAZIONI ========================

@api_router.post("/messages", response_model=MessageResponse)
async def create_message(message: MessageCreate, admin_user: dict = Depends(get_admin_user)):
    """Admin creates a new message/announcement"""
    message_doc = {
        "sender_id": str(admin_user["_id"]),
        "content": message.content,
        "created_at": now_rome(),
        "replies": [],
        "is_admin_message": True
    }
    
    result = await db.messages.insert_one(message_doc)
    
    # Send push notification to all users (both web and mobile)
    users = await db.users.find({
        "role": "client",
        "$or": [
            {"push_subscription": {"$exists": True}},
            {"expo_push_token": {"$exists": True}}
        ]
    }).to_list(1000)
    
    for user in users:
        await send_push_notification(
            str(user["_id"]),
            "💬 Nuova Comunicazione",
            message.content[:100] + "..." if len(message.content) > 100 else message.content,
            {"screen": "comunicazioni", "type": "chat"}
        )
    
    return MessageResponse(
        id=str(result.inserted_id),
        sender_id=str(admin_user["_id"]),
        sender_nome=admin_user["nome"],
        sender_cognome=admin_user["cognome"],
        sender_profile_image=admin_user.get("profile_image"),
        content=message.content,
        created_at=message_doc["created_at"],
        replies=[],
        is_admin_message=True
    )

@api_router.get("/messages", response_model=List[MessageResponse])
async def get_messages(current_user: dict = Depends(get_current_user)):
    """Get all messages with replies"""
    messages = await db.messages.find().sort("created_at", -1).to_list(100)
    
    # PERFORMANCE FIX: Batch load users without profile_image
    user_ids = set()
    for msg in messages:
        user_ids.add(msg["sender_id"])
        for reply in msg.get("replies", []):
            user_ids.add(reply["user_id"])
    
    users_cache = {}
    if user_ids:
        users = await db.users.find(
            {"_id": {"$in": [ObjectId(uid) for uid in user_ids]}},
            {"profile_image": 0}  # Exclude heavy field
        ).to_list(len(user_ids))
        users_cache = {str(u["_id"]): u for u in users}
    
    result = []
    for msg in messages:
        sender = users_cache.get(msg["sender_id"])
        
        replies = []
        for reply in msg.get("replies", []):
            reply_user = users_cache.get(reply["user_id"])
            if reply_user:
                replies.append(ReplyResponse(
                    id=reply["id"],
                    user_id=reply["user_id"],
                    user_nome=reply_user["nome"],
                    user_cognome=reply_user["cognome"],
                    user_profile_image=None,  # Excluded for performance
                    content=reply["content"],
                    created_at=reply["created_at"]
                ))
        
        result.append(MessageResponse(
            id=str(msg["_id"]),
            sender_id=msg["sender_id"],
            sender_nome=sender["nome"] if sender else "Admin",
            sender_cognome=sender["cognome"] if sender else "",
            sender_profile_image=None,  # Excluded for performance
            content=msg["content"],
            created_at=msg["created_at"],
            replies=replies,
            is_admin_message=msg.get("is_admin_message", True)
        ))
    
    return result

@api_router.get("/messages/unread-count")
async def get_unread_count(last_read: str = None, current_user: dict = Depends(get_current_user)):
    """Get count of unread messages since last_read timestamp"""
    try:
        if last_read:
            # Parse the ISO format string, handle various formats
            try:
                last_read_dt = datetime.fromisoformat(last_read.replace('Z', '+00:00'))
                # Make it naive for comparison
                if last_read_dt.tzinfo:
                    last_read_dt = last_read_dt.replace(tzinfo=None)
            except:
                last_read_dt = datetime(1970, 1, 1)
        else:
            last_read_dt = datetime(1970, 1, 1)
        
        user_id = str(current_user["_id"])
        is_admin = current_user.get("role") == "admin"
        
        logging.info(f"[UNREAD] Checking for user {user_id}, is_admin: {is_admin}, last_read: {last_read_dt}")
        
        count = 0
        messages = await db.messages.find().to_list(100)
        
        for msg in messages:
            msg_time = msg.get("created_at")
            logging.info(f"[UNREAD] Message time: {msg_time}, sender: {msg.get('sender_id')}")
            
            if msg_time and msg_time > last_read_dt:
                # Per client: conta tutti i messaggi
                # Per admin: non conta i propri messaggi
                if not is_admin or str(msg.get("sender_id")) != user_id:
                    count += 1
                    logging.info(f"[UNREAD] Counting this message, count now: {count}")
            
            # Count replies from others
            for reply in msg.get("replies", []):
                reply_time = reply.get("created_at")
                if reply_time and reply_time > last_read_dt:
                    if str(reply.get("user_id")) != user_id:
                        count += 1
        
        logging.info(f"[UNREAD] Final count: {count}")
        return {"unread_count": count}
    except Exception as e:
        logging.error(f"Error getting unread count: {e}")
        return {"unread_count": 0}

@api_router.post("/messages/{message_id}/reply", response_model=ReplyResponse)
async def reply_to_message(message_id: str, reply: ReplyCreate, current_user: dict = Depends(get_current_user)):
    """Reply to a message"""
    message = await db.messages.find_one({"_id": ObjectId(message_id)})
    if not message:
        raise HTTPException(status_code=404, detail="Messaggio non trovato")
    
    user_id = str(current_user["_id"])
    user_role = current_user.get("role", "client")
    user_name = f"{current_user['nome']} {current_user.get('cognome', '')}".strip()
    
    reply_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "content": reply.content,
        "created_at": now_rome()
    }
    
    await db.messages.update_one(
        {"_id": ObjectId(message_id)},
        {"$push": {"replies": reply_doc}}
    )
    
    # Prepare notification content
    notification_body = reply.content[:100] + "..." if len(reply.content) > 100 else reply.content
    
    # If a client replies, notify the admin
    if user_role == "client":
        # Find all admins with push subscriptions
        admins = await db.users.find({
            "role": "admin", 
            "push_subscription": {"$exists": True, "$ne": None}
        }).to_list(10)
        
        for admin in admins:
            logging.info(f"[PUSH] Sending reply notification to admin {admin['_id']}")
            await send_push_notification(
                str(admin["_id"]),
                f"Risposta da {user_name}",
                notification_body
            )
    
    # If admin replies, notify the original message sender (if it's not admin)
    elif user_role == "admin":
        # Also notify all clients who have replied to this message
        notified_users = set()
        
        # Notify message participants
        for existing_reply in message.get("replies", []):
            reply_user_id = existing_reply.get("user_id")
            if reply_user_id and reply_user_id != user_id and reply_user_id not in notified_users:
                user = await db.users.find_one({
                    "_id": ObjectId(reply_user_id),
                    "push_subscription": {"$exists": True, "$ne": None}
                })
                if user:
                    logging.info(f"[PUSH] Sending admin reply notification to user {reply_user_id}")
                    await send_push_notification(
                        reply_user_id,
                        f"Risposta da {user_name}",
                        notification_body
                    )
                    notified_users.add(reply_user_id)
    
    return ReplyResponse(
        id=reply_doc["id"],
        user_id=str(current_user["_id"]),
        user_nome=current_user["nome"],
        user_cognome=current_user["cognome"],
        user_profile_image=current_user.get("profile_image"),
        content=reply.content,
        created_at=reply_doc["created_at"]
    )

@api_router.delete("/messages/{message_id}")
async def delete_message(message_id: str, admin_user: dict = Depends(get_admin_user)):
    """Admin deletes a message"""
    result = await db.messages.delete_one({"_id": ObjectId(message_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Messaggio non trovato")
    return {"message": "Messaggio eliminato"}

# ======================== PUSH NOTIFICATIONS ========================

@api_router.get("/push/vapid-public-key")
async def get_vapid_public_key():
    """Get the VAPID public key for push subscription"""
    return {"publicKey": VAPID_PUBLIC_KEY}

@api_router.post("/push/subscribe")
async def subscribe_push(subscription: PushSubscription, current_user: dict = Depends(get_current_user)):
    """Save push subscription for user"""
    user_id = current_user["_id"]
    
    # Save subscription to database
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"push_subscription": subscription.dict()}}
    )
    
    logger.info(f"[PUSH] User {user_id} subscribed to push notifications")
    return {"message": "Iscrizione alle notifiche push completata"}

@api_router.delete("/push/unsubscribe")
async def unsubscribe_push(current_user: dict = Depends(get_current_user)):
    """Remove push subscription for user"""
    user_id = current_user["_id"]
    
    await db.users.update_one(
        {"_id": user_id},
        {"$unset": {"push_subscription": ""}}
    )
    
    logger.info(f"[PUSH] User {user_id} unsubscribed from push notifications")
    return {"message": "Disiscrizione dalle notifiche push completata"}

# Expo Push Token endpoints
class ExpoPushTokenRequest(BaseModel):
    expo_push_token: str

@api_router.post("/push/expo-token")
async def register_expo_push_token(data: ExpoPushTokenRequest, current_user: dict = Depends(get_current_user)):
    """Register Expo push token for mobile notifications"""
    user_id = current_user["_id"]
    
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"expo_push_token": data.expo_push_token}}
    )
    
    logger.info(f"[EXPO PUSH] User {user_id} registered token: {data.expo_push_token[:20]}...")
    return {"message": "Token Expo registrato con successo"}

@api_router.delete("/push/expo-token")
async def unregister_expo_push_token(current_user: dict = Depends(get_current_user)):
    """Remove Expo push token"""
    user_id = current_user["_id"]
    
    await db.users.update_one(
        {"_id": user_id},
        {"$unset": {"expo_push_token": ""}}
    )
    
    logger.info(f"[EXPO PUSH] User {user_id} unregistered expo token")
    return {"message": "Token Expo rimosso"}

async def send_expo_push_notification(expo_token: str, title: str, body: str, data: dict = None):
    """Send push notification via Expo Push API"""
    import httpx
    
    message = {
        "to": expo_token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {},
        "priority": "high",
        "channelId": "default",
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=message,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                }
            )
            
            if response.status_code == 200:
                logger.info(f"[EXPO PUSH] Notification sent: {title}")
                return True
            else:
                logger.error(f"[EXPO PUSH] Failed: {response.text}")
                return False
    except Exception as e:
        logger.error(f"[EXPO PUSH] Error: {e}")
        return False


async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    """Send push notification to a specific user (Web + Expo)"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        logger.info(f"[PUSH] User {user_id} not found")
        return False
    
    sent = False
    
    # Try Expo Push first (mobile)
    if "expo_push_token" in user and user["expo_push_token"]:
        expo_sent = await send_expo_push_notification(
            user["expo_push_token"], 
            title, 
            body, 
            data
        )
        if expo_sent:
            sent = True
            logger.info(f"[EXPO PUSH] Notification sent to user {user_id}: {title}")
    
    # Try Web Push
    if "push_subscription" in user and user["push_subscription"]:
        subscription = user["push_subscription"]
        try:
            payload = json.dumps({
                "title": title,
                "body": body,
                "data": data or {},
                "icon": "/icon-192.png",
                "badge": "/icon-192.png"
            })
            
            # Push notifications disabled to save memory
            # webpush(
            #     subscription_info=subscription,
            #     data=payload,
            #     vapid_private_key=VAPID_PRIVATE_KEY,
            #     vapid_claims={"sub": f"mailto:{VAPID_EMAIL}"}
            # )
            
            logger.info(f"[WEB PUSH] Notification disabled to save memory - {title}")
            sent = True
        except Exception as e:
            logger.error(f"[WEB PUSH] Error: {e}")
            # If subscription is invalid, remove it
            if e.response and e.response.status_code in [404, 410]:
                await db.users.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$unset": {"push_subscription": ""}}
                )
    
    if not sent:
        logger.info(f"[PUSH] User {user_id} has no push subscription")
    
    return sent

async def check_expiring_subscriptions():
    """Check for expiring subscriptions and send notifications"""
    logger.info("[SCHEDULER] Checking for expiring subscriptions...")
    
    now = now_rome()
    three_days_later = now + timedelta(days=3)
    
    # Check time-based subscriptions (mensile, trimestrale) - 3 days before expiration
    time_based_subs = await db.subscriptions.find({
        "tipo": {"$in": ["mensile", "trimestrale"]},
        "attivo": True,
        "data_scadenza": {"$lte": three_days_later, "$gt": now},
        "notifica_scadenza_inviata": {"$ne": True}
    }).to_list(100)
    
    for sub in time_based_subs:
        user = await db.users.find_one({"_id": ObjectId(sub["user_id"])})
        if user:
            days_left = (sub["data_scadenza"] - now).days
            await send_push_notification(
                str(sub["user_id"]),
                "Abbonamento in Scadenza",
                f"Il tuo abbonamento scade tra {days_left} giorni. Rinnova per continuare ad allenarti!"
            )
            
            # Mark notification as sent
            await db.subscriptions.update_one(
                {"_id": sub["_id"]},
                {"$set": {"notifica_scadenza_inviata": True}}
            )
            logger.info(f"[PUSH] Sent expiration notification to user {sub['user_id']}")
    
    # Check lesson-based subscriptions (8, 16 lezioni) - 2 lessons remaining
    lesson_based_subs = await db.subscriptions.find({
        "tipo": {"$in": ["lezione_singola", "lezioni_8", "lezioni_16"]},
        "attivo": True,
        "lezioni_rimanenti": {"$lte": 2, "$gt": 0},
        "notifica_lezioni_inviata": {"$ne": True}
    }).to_list(100)
    
    for sub in lesson_based_subs:
        user = await db.users.find_one({"_id": ObjectId(sub["user_id"])})
        if user:
            await send_push_notification(
                str(sub["user_id"]),
                "Poche Lezioni Rimaste",
                f"Ti restano solo {sub['lezioni_rimanenti']} lezioni. Rinnova il tuo abbonamento!"
            )
            
            # Mark notification as sent
            await db.subscriptions.update_one(
                {"_id": sub["_id"]},
                {"$set": {"notifica_lezioni_inviata": True}}
            )
            logger.info(f"[PUSH] Sent lessons notification to user {sub['user_id']}")

# ======================== CONSIGLI DEL MAESTRO ========================

@api_router.get("/consigli", response_model=List[ConsiglioResponse])
async def get_consigli():
    """Get all active consigli del maestro (public) - OPTIMIZED"""
    # Limit base64 images to avoid huge payloads
    consigli = await db.consigli.find({"attivo": True}).sort("created_at", -1).to_list(20)
    
    result = []
    for c in consigli:
        # Truncate base64 image if it's too large (over 500KB)
        img_base64 = c.get("immagine_base64")
        if img_base64 and len(img_base64) > 500000:
            # Keep only first 500KB to avoid timeout
            img_base64 = img_base64[:500000]
        
        result.append(ConsiglioResponse(
            id=str(c["_id"]),
            testo=c.get("testo"),
            immagine_url=c.get("immagine_url"),
            immagine_base64=img_base64,
            spotify_url=c.get("spotify_url"),
            created_at=c["created_at"],
            attivo=c.get("attivo", True)
        ))
    return result

@api_router.post("/consigli", response_model=ConsiglioResponse)
async def create_consiglio(data: ConsiglioCreate, admin_user: dict = Depends(get_admin_user)):
    """Create a new consiglio del maestro (admin only)"""
    if not data.testo and not data.immagine_url and not data.immagine_base64 and not data.spotify_url:
        raise HTTPException(status_code=400, detail="Inserisci almeno un contenuto")
    
    consiglio = {
        "testo": data.testo,
        "immagine_url": data.immagine_url,
        "immagine_base64": data.immagine_base64,
        "spotify_url": data.spotify_url,
        "created_at": now_rome(),
        "attivo": True
    }
    
    result = await db.consigli.insert_one(consiglio)
    
    return ConsiglioResponse(
        id=str(result.inserted_id),
        testo=consiglio["testo"],
        immagine_url=consiglio["immagine_url"],
        immagine_base64=consiglio["immagine_base64"],
        spotify_url=consiglio["spotify_url"],
        created_at=consiglio["created_at"],
        attivo=True
    )

@api_router.delete("/consigli/{consiglio_id}")
async def delete_consiglio(consiglio_id: str, admin_user: dict = Depends(get_admin_user)):
    """Delete a consiglio (admin only)"""
    try:
        obj_id = ObjectId(consiglio_id)
    except Exception as e:
        logger.error(f"[DELETE CONSIGLIO] Invalid ObjectId: {consiglio_id}, error: {e}")
        raise HTTPException(status_code=400, detail=f"ID non valido: {consiglio_id}")
    
    try:
        result = await db.consigli.delete_one({"_id": obj_id})
        if result.deleted_count == 0:
            logger.warning(f"[DELETE CONSIGLIO] Not found: {consiglio_id}")
            raise HTTPException(status_code=404, detail="Consiglio non trovato")
        logger.info(f"[DELETE CONSIGLIO] Deleted: {consiglio_id}")
        return {"message": "Consiglio eliminato"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DELETE CONSIGLIO] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Errore durante l'eliminazione: {str(e)}")

# ======================== CONSIGLI MUSICALI ========================

@api_router.get("/consigli-musicali", response_model=List[ConsiglioMusicaleResponse])
async def get_consigli_musicali():
    """Get all music recommendations (public, lightweight)"""
    consigli = await db.consigli_musicali.find().sort("created_at", -1).to_list(20)
    return [
        ConsiglioMusicaleResponse(
            id=str(c["_id"]),
            titolo=c.get("titolo"),
            spotify_url=c["spotify_url"],
            created_at=c["created_at"]
        ) for c in consigli
    ]

@api_router.post("/consigli-musicali", response_model=ConsiglioMusicaleResponse)
async def create_consiglio_musicale(data: ConsiglioMusicaleCreate, admin_user: dict = Depends(get_admin_user)):
    """Create a new music recommendation (admin only)"""
    if not data.spotify_url:
        raise HTTPException(status_code=400, detail="Inserisci un link Spotify")
    
    consiglio = {
        "titolo": data.titolo,
        "spotify_url": data.spotify_url,
        "created_at": now_rome()
    }
    
    result = await db.consigli_musicali.insert_one(consiglio)
    
    return ConsiglioMusicaleResponse(
        id=str(result.inserted_id),
        titolo=consiglio["titolo"],
        spotify_url=consiglio["spotify_url"],
        created_at=consiglio["created_at"]
    )

@api_router.delete("/consigli-musicali/{consiglio_id}")
async def delete_consiglio_musicale(consiglio_id: str, admin_user: dict = Depends(get_admin_user)):
    """Delete a music recommendation (admin only)"""
    try:
        obj_id = ObjectId(consiglio_id)
    except Exception as e:
        logger.error(f"[DELETE MUSIC] Invalid ObjectId: {consiglio_id}, error: {e}")
        raise HTTPException(status_code=400, detail=f"ID non valido: {consiglio_id}")
    
    try:
        result = await db.consigli_musicali.delete_one({"_id": obj_id})
        if result.deleted_count == 0:
            logger.warning(f"[DELETE MUSIC] Not found: {consiglio_id}")
            raise HTTPException(status_code=404, detail="Consiglio non trovato")
        logger.info(f"[DELETE MUSIC] Deleted: {consiglio_id}")
        return {"message": "Consiglio eliminato"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DELETE MUSIC] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Errore durante l'eliminazione: {str(e)}")

# ======================== INIT ADMIN ========================

@api_router.post("/init/admin")
async def init_admin():
    """Initialize admin user if not exists"""
    admin = await db.users.find_one({"email": "admin@danofitness.it"})
    if admin:
        return {"message": "Admin già esistente", "admin_id": str(admin["_id"])}
    
    admin_user = {
        "email": "admin@danofitness.it",
        "password": hash_password("DanoFitness2025!"),
        "nome": "Daniele",
        "cognome": "Admin",
        "telefono": "339 50 20 625",
        "role": UserRole.ADMIN,
        "push_token": None,
        "created_at": now_rome()
    }
    
    result = await db.users.insert_one(admin_user)
    return {"message": "Admin creato", "admin_id": str(result.inserted_id)}

@api_router.get("/")
async def root():
    return {"message": "DanoFitness23 API", "version": "1.0.0"}

@api_router.get("/health")
@api_router.head("/health")
async def health_check():
    return {"status": "healthy", "service": "DanoFitness23 API"}

@api_router.get("/test-llm")
async def test_llm_connection():
    """Test di connessione al servizio AI"""
    import httpx
    try:
        llm_key = os.environ.get("EMERGENT_LLM_KEY", "").strip()
        if not llm_key:
            return {"status": "error", "detail": "EMERGENT_LLM_KEY non configurata"}
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://integrations.emergentagent.com/llm/chat/completions",
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {llm_key}"},
                json={"model": "gpt-4.1", "messages": [{"role": "user", "content": "Dimmi solo OK"}], "max_tokens": 10}
            )
            if resp.status_code == 200:
                data = resp.json()
                return {"status": "ok", "response": data["choices"][0]["message"]["content"]}
            else:
                return {"status": "error", "http_code": resp.status_code, "detail": resp.text[:300]}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


# ==================== LOTTERIA PREMI ====================

# Utenti di test esclusi dalla lotteria (nome, cognome in minuscolo)
UTENTI_TEST_ESCLUSI = [
    ("daniele", "brufani"),
]

async def check_user_has_active_subscription(user_id: str) -> bool:
    """Verifica se un singolo utente ha abbonamento attivo O prova attiva (per UI)"""
    now = now_rome()
    today_str = now.strftime("%Y-%m-%d")
    
    # Controlla prova gratuita attiva
    user = await db.users.find_one(
        {"_id": ObjectId(user_id)},
        {"prova_attiva": 1, "prova_scadenza": 1}
    )
    if user and user.get("prova_attiva") and user.get("prova_scadenza"):
        if user["prova_scadenza"] >= today_str:
            return True
    
    # Cerca abbonamento attivo dell'utente (solo campi necessari)
    subscription = await db.subscriptions.find_one(
        {"user_id": user_id, "attivo": True},
        {"data_scadenza": 1, "lezioni_rimanenti": 1}
    )
    
    if not subscription:
        return False
    
    is_expired = subscription["data_scadenza"] < now
    if subscription.get("lezioni_rimanenti") is not None and subscription["lezioni_rimanenti"] <= 0:
        is_expired = True
    
    return not is_expired


async def check_user_is_trial(user_id: str) -> bool:
    """Verifica se un utente e in prova gratuita (non abbonato vero).
    Se la prova è scaduta, disattiva automaticamente il flag `prova_attiva`."""
    today_str = now_rome().strftime("%Y-%m-%d")
    now = now_rome()
    # Controlla flag prova sull'utente
    user = await db.users.find_one(
        {"_id": ObjectId(user_id)},
        {"prova_attiva": 1, "prova_scadenza": 1}
    )
    if user and user.get("prova_attiva") and user.get("prova_scadenza"):
        if user["prova_scadenza"] >= today_str:
            return True
        # Prova scaduta → disattiva il flag automaticamente
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"prova_attiva": False, "prova_terminata_il": today_str}}
        )
        logger.info(f"[TRIAL] Prova scaduta auto-disattivata per user {user_id}")
    # Controlla anche se ha un abbonamento di tipo prova_7gg attivo
    trial_sub = await db.subscriptions.find_one({
        "user_id": user_id,
        "tipo": "prova_7gg",
        "attivo": True,
        "data_scadenza": {"$gte": now}
    })
    if trial_sub:
        return True
    return False

async def get_users_with_active_subscription() -> set:
    """Restituisce gli user_id degli utenti con abbonamento attivo per la LOTTERIA (esclude utenti test)"""
    now = now_rome()
    active_user_ids = set()
    
    # Ottieni tutti gli abbonamenti attivi (escludi prova_7gg - la prova non partecipa alla lotteria)
    subscriptions = await db.subscriptions.find({"attivo": True, "tipo": {"$ne": "prova_7gg"}}).to_list(1000)
    
    # Filtra abbonamenti non scaduti
    candidate_user_ids = set()
    for sub in subscriptions:
        is_expired = sub["data_scadenza"] < now
        if sub.get("lezioni_rimanenti") is not None and sub["lezioni_rimanenti"] <= 0:
            is_expired = True
        if not is_expired:
            candidate_user_ids.add(sub["user_id"])
    
    if not candidate_user_ids:
        return active_user_ids
    
    # PERFORMANCE FIX: Batch load tutti gli utenti in una query sola (era N+1)
    users = await db.users.find(
        {"_id": {"$in": [ObjectId(uid) for uid in candidate_user_ids]}},
        {"nome": 1, "cognome": 1}
    ).to_list(len(candidate_user_ids))
    
    for user in users:
        nome = (user.get("nome") or "").lower().strip()
        cognome = (user.get("cognome") or "").lower().strip()
        is_test_user = (nome, cognome) in UTENTI_TEST_ESCLUSI
        
        if not is_test_user:
            active_user_ids.add(str(user["_id"]))
        else:
            logger.info(f"[LOTTERY] Utente test escluso: {user.get('nome')} {user.get('cognome')}")
    
    return active_user_ids


# ==================== STREAK BONUS SETTIMANALE ====================
# Bonus biglietti per allenamenti consecutivi in una stessa settimana (Lun-Dom)
#   • 3 giorni consecutivi in settimana → +3 biglietti (una sola volta/settimana)
#   • 5 giorni consecutivi in settimana → +3 biglietti (aggiuntivi, una sola volta/settimana)
# Se l'utente salta un giorno la streak si azzera (ricomincia da zero).
# A fine settimana (nuova settimana ISO) il conteggio riparte da zero.

STREAK_BONUS_3_TICKETS = 3
STREAK_BONUS_5_TICKETS = 3


def _week_bounds(d: date) -> tuple[date, date, str]:
    """Restituisce (lunedì, domenica, chiave_settimana_ISO) per la data data."""
    monday = d - timedelta(days=d.weekday())
    sunday = monday + timedelta(days=6)
    iso_year, iso_week, _ = d.isocalendar()
    return monday, sunday, f"{iso_year}-W{iso_week:02d}"


async def compute_user_streak(user_id: str, ref_date: date) -> dict:
    """Calcola streak corrente e stato bonus per user_id nella settimana di ref_date.

    Restituisce:
      { settimana, streak_corrente, max_streak, bonus_3_dato, bonus_5_dato,
        giorni_allenati: [date ISO sorted], max_consecutivi }
    """
    monday, sunday, week_key = _week_bounds(ref_date)
    bookings_week = await db.bookings.find(
        {
            "user_id": user_id,
            "lezione_scalata": True,
            "data_lezione": {"$gte": monday.isoformat(), "$lte": sunday.isoformat()},
        },
        {"data_lezione": 1, "_id": 0},
    ).to_list(50)

    dates_trained = sorted({b["data_lezione"] for b in bookings_week})

    # streak che INCLUDE ref_date (solo giorni consecutivi CONTIGUI a ref_date)
    trained_set = set(dates_trained)
    streak_corrente = 0
    if ref_date.isoformat() in trained_set:
        streak_corrente = 1
        cur = ref_date
        while True:
            prev = cur - timedelta(days=1)
            if prev < monday or prev.isoformat() not in trained_set:
                break
            streak_corrente += 1
            cur = prev

    # max streak nella settimana
    max_consecutivi = 0
    if dates_trained:
        run = 1
        max_consecutivi = 1
        for i in range(1, len(dates_trained)):
            prev_d = date.fromisoformat(dates_trained[i - 1])
            cur_d = date.fromisoformat(dates_trained[i])
            if (cur_d - prev_d).days == 1:
                run += 1
                max_consecutivi = max(max_consecutivi, run)
            else:
                run = 1

    state = await db.streak_bonuses.find_one({"user_id": user_id, "settimana": week_key}) or {}

    return {
        "settimana": week_key,
        "lunedi": monday.isoformat(),
        "domenica": sunday.isoformat(),
        "streak_corrente": streak_corrente,
        "max_consecutivi": max_consecutivi,
        "bonus_3_dato": state.get("bonus_3_dato", False),
        "bonus_5_dato": state.get("bonus_5_dato", False),
        "giorni_allenati": dates_trained,
    }


async def check_and_award_streak_bonus(user_id: str, data_lezione_str: str) -> dict:
    """Valuta la streak dopo una lezione completata e assegna eventuali bonus."""
    try:
        ref = date.fromisoformat(data_lezione_str)
    except Exception:
        return {"bonus_awarded": 0}

    info = await compute_user_streak(user_id, ref)
    streak = info["streak_corrente"]
    bonus_3_dato = info["bonus_3_dato"]
    bonus_5_dato = info["bonus_5_dato"]
    bonus_awarded = 0

    if streak >= 3 and not bonus_3_dato:
        bonus_awarded += STREAK_BONUS_3_TICKETS
        bonus_3_dato = True
    if streak >= 5 and not bonus_5_dato:
        bonus_awarded += STREAK_BONUS_5_TICKETS
        bonus_5_dato = True

    mese_corrente = ref.strftime("%Y-%m")
    await db.streak_bonuses.update_one(
        {"user_id": user_id, "settimana": info["settimana"]},
        {
            "$set": {
                "user_id": user_id,
                "settimana": info["settimana"],
                "streak_attuale": streak,
                "max_consecutivi": max(streak, info["max_consecutivi"]),
                "bonus_3_dato": bonus_3_dato,
                "bonus_5_dato": bonus_5_dato,
                "ultima_data": ref.isoformat(),
                "mese": mese_corrente,
                "updated_at": now_rome(),
            }
        },
        upsert=True,
    )

    if bonus_awarded > 0:
        await db.wheel_tickets.update_one(
            {"user_id": user_id, "mese": mese_corrente},
            {"$inc": {"biglietti": bonus_awarded}},
            upsert=True,
        )
        logger.info(
            f"[STREAK] user={user_id} streak={streak} bonus=+{bonus_awarded} biglietti (settimana={info['settimana']})"
        )

    return {
        "bonus_awarded": bonus_awarded,
        "streak": streak,
        "bonus_3_dato": bonus_3_dato,
        "bonus_5_dato": bonus_5_dato,
    }


@api_router.get("/streak/status")
async def get_streak_status(current_user: dict = Depends(get_current_user)):
    """Stato streak settimanale dell'utente + prossima soglia."""
    user_id = str(current_user["_id"])
    today = now_rome().date()
    info = await compute_user_streak(user_id, today)

    streak = info["streak_corrente"]
    if streak < 3:
        prossima_soglia = 3
        biglietti_prossima = STREAK_BONUS_3_TICKETS
    elif streak < 5:
        prossima_soglia = 5
        biglietti_prossima = STREAK_BONUS_5_TICKETS
    else:
        prossima_soglia = None
        biglietti_prossima = 0

    biglietti_ottenuti = (
        (STREAK_BONUS_3_TICKETS if info["bonus_3_dato"] else 0)
        + (STREAK_BONUS_5_TICKETS if info["bonus_5_dato"] else 0)
    )

    return {
        "settimana": info["settimana"],
        "lunedi": info["lunedi"],
        "domenica": info["domenica"],
        "oggi": today.isoformat(),
        "streak_corrente": streak,
        "max_consecutivi": info["max_consecutivi"],
        "giorni_allenati": info["giorni_allenati"],
        "bonus_3_dato": info["bonus_3_dato"],
        "bonus_5_dato": info["bonus_5_dato"],
        "biglietti_ottenuti": biglietti_ottenuti,
        "prossima_soglia": prossima_soglia,
        "biglietti_prossima_soglia": biglietti_prossima,
        "soglia_3": {"giorni": 3, "biglietti": STREAK_BONUS_3_TICKETS},
        "soglia_5": {"giorni": 5, "biglietti": STREAK_BONUS_5_TICKETS},
    }




async def run_lottery_extraction():
    """Esegue l'estrazione della lotteria - 3 VINCITORI - SOLO per utenti con abbonamento attivo"""
    now = datetime.now(ROME_TZ)
    current_month = now.strftime("%Y-%m")
    
    # Controlla se l'estrazione di questo mese è già stata fatta
    existing = await db.lottery_winners.find_one({"mese": current_month})
    if existing:
        logger.info(f"[LOTTERY] Estrazione {current_month} già effettuata")
        return existing
    
    # Calcola il mese precedente per contare i biglietti
    if now.month == 1:
        prev_month = 12
        prev_year = now.year - 1
    else:
        prev_month = now.month - 1
        prev_year = now.year
    
    prev_month_str = f"{prev_year}-{prev_month:02d}"
    
    # Conta allenamenti (biglietti) per ogni utente nel mese precedente
    start_date = f"{prev_month_str}-01"
    end_date = f"{current_month}-01"
    
    # FILTRO: Solo utenti con abbonamento ATTIVO partecipano
    active_user_ids = await get_users_with_active_subscription()
    
    if not active_user_ids:
        logger.warning("[LOTTERY] Nessun utente con abbonamento attivo")
        return None
    
    # Aggregazione per contare biglietti da allenamenti per utente (solo abbonati attivi)
    pipeline = [
        {"$match": {
            "data_lezione": {"$gte": start_date, "$lt": end_date},
            "lezione_scalata": True,
            "user_id": {"$in": list(active_user_ids)}  # Solo abbonati attivi
        }},
        {"$group": {
            "_id": "$user_id",
            "biglietti": {"$sum": 1}
        }}
    ]
    
    partecipanti_allenamenti = await db.bookings.aggregate(pipeline).to_list(1000)
    
    # Crea dizionario biglietti per utente
    biglietti_per_utente = {p["_id"]: p["biglietti"] for p in partecipanti_allenamenti}
    
    # Aggiungi biglietti bonus dalla ruota della fortuna (del mese precedente)
    wheel_bonuses = await db.wheel_tickets.find({"mese": prev_month_str}).to_list(1000)
    for wb in wheel_bonuses:
        uid = wb["user_id"]
        if uid in active_user_ids:  # Solo abbonati attivi
            bonus = wb.get("biglietti", 0)
            if uid in biglietti_per_utente:
                biglietti_per_utente[uid] += bonus
            elif bonus > 0:  # Se ha solo biglietti bonus (senza allenamenti)
                biglietti_per_utente[uid] = bonus
    
    # ESCLUDI I VINCITORI DEL MESE PRECEDENTE (richiesta admin)
    prev_extraction = await db.lottery_winners.find_one({"mese": prev_month_str})
    if prev_extraction and "vincitori" in prev_extraction:
        excluded_ids = {v.get("user_id") for v in prev_extraction["vincitori"] if v.get("user_id")}
        if excluded_ids:
            logger.info(f"[LOTTERY] Esclusi {len(excluded_ids)} vincitori del mese precedente ({prev_month_str})")
            for uid in excluded_ids:
                biglietti_per_utente.pop(uid, None)

    # Filtra chi ha almeno 1 biglietto
    partecipanti = [{"_id": uid, "biglietti": b} for uid, b in biglietti_per_utente.items() if b >= 1]
    
    if not partecipanti:
        logger.warning("[LOTTERY] Nessun partecipante con biglietti")
        return None
    
    # Crea lista pesata (più biglietti = più possibilità, ma estrazione CASUALE)
    pool = []
    for p in partecipanti:
        pool.extend([p["_id"]] * p["biglietti"])
    
    # ESTRAZIONE 3 VINCITORI - Il Maestro è buono!
    num_vincitori = min(3, len(partecipanti))  # Massimo 3, o meno se non ci sono abbastanza partecipanti
    vincitori_ids = []
    vincitori_data = []
    pool_copy = pool.copy()
    
    for i in range(num_vincitori):
        if not pool_copy:
            break
        
        # Estrai vincitore
        winner_id = random.choice(pool_copy)
        
        # Evita duplicati: rimuovi TUTTI i biglietti di questo vincitore dalla pool
        pool_copy = [uid for uid in pool_copy if uid != winner_id]
        
        vincitori_ids.append(winner_id)
        
        winner = await db.users.find_one({"_id": ObjectId(winner_id)})
        if winner:
            winner_biglietti = next((p["biglietti"] for p in partecipanti if p["_id"] == winner_id), 0)
            vincitori_data.append({
                "posizione": i + 1,
                "user_id": winner_id,
                "nome": winner.get("nome"),
                "cognome": winner.get("cognome"),
                "soprannome": winner.get("soprannome"),
                "biglietti": winner_biglietti
            })
            logger.info(f"[LOTTERY] VINCITORE {i+1}: {winner.get('nome')} {winner.get('cognome')} con {winner_biglietti} biglietti")
    
    if vincitori_data:
        # Ottieni i 3 premi del mese se impostati
        prize = await db.lottery_prizes.find_one({"mese": current_month})
        default_prizes = ["Maglietta o Canotta DanoFitness", "Maglietta o Canotta DanoFitness", "Maglietta o Canotta DanoFitness"]
        premi = [
            prize.get("premio_1", default_prizes[0]) if prize else default_prizes[0],
            prize.get("premio_2", default_prizes[1]) if prize else default_prizes[1],
            prize.get("premio_3", default_prizes[2]) if prize else default_prizes[2],
        ]
        
        # Assegna premio a ogni vincitore in base alla posizione
        for v in vincitori_data:
            pos_idx = v["posizione"] - 1
            v["premio"] = premi[pos_idx] if pos_idx < len(premi) else default_prizes[0]
        
        winner_data = {
            "mese": current_month,
            "mese_riferimento": prev_month_str,
            "vincitori": vincitori_data,
            "totale_partecipanti": len(partecipanti),
            "totale_biglietti": len(pool),
            "data_estrazione": now_rome(),
            "premio_1": premi[0],
            "premio_2": premi[1] if len(premi) > 1 else premi[0],
            "premio_3": premi[2] if len(premi) > 2 else premi[0],
            "premi_ritirati": [False, False, False],
            "estrazione_automatica": True,
            "pubblicato": False
        }
        await db.lottery_winners.insert_one(winner_data)
        logger.info(f"[LOTTERY] ESTRAZIONE BOZZA COMPLETATA: {len(vincitori_data)} vincitori su {len(pool)} biglietti totali (in attesa di pubblicazione admin)")
        return winner_data
    
    return None


async def check_and_run_lottery():
    """Controlla se è il momento dell'estrazione automatica (1° del mese ore 12:00)"""
    now = datetime.now(ROME_TZ)
    
    # Estrazione automatica: 1° del mese alle 12:00
    if now.day == 1 and now.hour >= 12:
        return await run_lottery_extraction()
    
    return None


@api_router.get("/lottery/status")
async def get_lottery_status(current_user: dict = Depends(get_current_user)):
    """Ottieni stato lotteria: biglietti utente, 3 vincitori"""
    now = datetime.now(ROME_TZ)
    current_month = now.strftime("%Y-%m")
    user_id = str(current_user["_id"])
    
    # ESTRAZIONE AUTOMATICA: Controlla se è il momento e esegui se necessario
    await check_and_run_lottery()
    
    # Prima recupera i dati vincitori e abbonamento
    # raw_winner_data = dati grezzi (anche se non pubblicati) -- usato per countdown/biglietti
    raw_winner_data = await db.lottery_winners.find_one({"mese": current_month})
    is_admin = current_user.get("role") == "admin"
    # Per non-admin: mostra vincitori solo se pubblicati (o se manca il campo = legacy = visibile)
    if raw_winner_data and not is_admin and raw_winner_data.get("pubblicato", True) is False:
        winner_data = None  # utente non vede vincitori in bozza
    else:
        winner_data = raw_winner_data
    ha_abbonamento_attivo = await check_user_has_active_subscription(user_id)
    
    # Calcola biglietti utente
    # Se è il giorno dell'estrazione (1° del mese) e l'estrazione NON è ancora fatta,
    # mostra i biglietti del mese PRECEDENTE (quelli che verranno usati per l'estrazione)
    if now.day == 1 and now.hour < 12 and not raw_winner_data:
        # Mostra biglietti del mese precedente
        if now.month == 1:
            prev_month_str_calc = f"{now.year - 1}-12"
        else:
            prev_month_str_calc = f"{now.year}-{now.month - 1:02d}"
        start_date = f"{prev_month_str_calc}-01"
        end_date = f"{current_month}-01"
        
        biglietti_allenamenti = await db.bookings.count_documents({
            "user_id": user_id,
            "data_lezione": {"$gte": start_date, "$lt": end_date},
            "lezione_scalata": True
        })
        wheel_doc = await db.wheel_tickets.find_one({"user_id": user_id, "mese": prev_month_str_calc})
    else:
        # Mostra biglietti del mese corrente (dopo estrazione = 0)
        start_date = f"{current_month}-01"
        next_month = now.month + 1 if now.month < 12 else 1
        next_year = now.year if now.month < 12 else now.year + 1
        end_date = f"{next_year}-{next_month:02d}-01"
        
        biglietti_allenamenti = await db.bookings.count_documents({
            "user_id": user_id,
            "data_lezione": {"$gte": start_date, "$lt": end_date},
            "lezione_scalata": True
        })
        wheel_doc = await db.wheel_tickets.find_one({"user_id": user_id, "mese": current_month})
    
    biglietti_ruota = wheel_doc.get("biglietti", 0) if wheel_doc else 0
    
    # Totale biglietti = allenamenti + bonus ruota
    biglietti = biglietti_allenamenti + biglietti_ruota
    
    # Calcola prossima estrazione (1° del mese alle 12:00)
    if raw_winner_data:
        # Estrazione già fatta questo mese - prossima è il 1° del mese successivo
        if now.month == 12:
            next_extraction = datetime(now.year + 1, 1, 1, 12, 0, 0, tzinfo=ROME_TZ)
        else:
            next_extraction = datetime(now.year, now.month + 1, 1, 12, 0, 0, tzinfo=ROME_TZ)
    elif now.day == 1 and now.hour < 12:
        # Giorno dell'estrazione, prima delle 12:00 - countdown a OGGI ore 12:00
        next_extraction = datetime(now.year, now.month, 1, 12, 0, 0, tzinfo=ROME_TZ)
    else:
        # Countdown al 1° del prossimo mese alle 12:00
        if now.month == 12:
            next_extraction = datetime(now.year + 1, 1, 1, 12, 0, 0, tzinfo=ROME_TZ)
        else:
            next_extraction = datetime(now.year, now.month + 1, 1, 12, 0, 0, tzinfo=ROME_TZ)
    
    seconds_to_extraction = int((next_extraction - now).total_seconds())
    
    # Prepara lista vincitori (supporta sia vecchio formato singolo che nuovo formato 3 vincitori)
    vincitori = []
    is_me_winner = False
    
    if winner_data:
        # Nuovo formato: array vincitori
        if "vincitori" in winner_data:
            for v in winner_data["vincitori"]:
                is_me = v.get("user_id") == user_id
                if is_me:
                    is_me_winner = True
                vincitori.append({
                    "posizione": v.get("posizione"),
                    "nome": v.get("nome"),
                    "cognome": v.get("cognome"),
                    "soprannome": v.get("soprannome"),
                    "biglietti": v.get("biglietti"),
                    "premio": v.get("premio"),
                    "is_me": is_me
                })
        # Vecchio formato: singolo vincitore (retrocompatibilità)
        else:
            is_me = winner_data.get("user_id") == user_id
            if is_me:
                is_me_winner = True
            vincitori.append({
                "posizione": 1,
                "nome": winner_data.get("nome"),
                "cognome": winner_data.get("cognome"),
                "soprannome": winner_data.get("soprannome"),
                "biglietti": winner_data.get("biglietti"),
                "premio": winner_data.get("premio"),
                "is_me": is_me
            })
    
    # Premi dal winner_data o dal current-prize
    premio_1 = winner_data.get("premio_1") if winner_data else None
    premio_2 = winner_data.get("premio_2") if winner_data else None
    premio_3 = winner_data.get("premio_3") if winner_data else None
    
    # Info per admin: c'è una bozza in attesa di pubblicazione?
    pending_bozza = None
    if is_admin and raw_winner_data and raw_winner_data.get("pubblicato", True) is False:
        pending_bozza = {
            "mese": raw_winner_data.get("mese"),
            "mese_riferimento": raw_winner_data.get("mese_riferimento"),
            "data_estrazione": raw_winner_data.get("data_estrazione").isoformat() if raw_winner_data.get("data_estrazione") else None,
            "totale_partecipanti": raw_winner_data.get("totale_partecipanti", 0),
            "totale_biglietti": raw_winner_data.get("totale_biglietti", 0),
            "vincitori": [
                {
                    "posizione": v.get("posizione"),
                    "nome": v.get("nome"),
                    "cognome": v.get("cognome"),
                    "soprannome": v.get("soprannome"),
                    "biglietti": v.get("biglietti"),
                    "premio": v.get("premio"),
                } for v in raw_winner_data.get("vincitori", [])
            ],
        }

    # Flag per i clienti: l'estrazione è stata fatta ma admin non ha ancora pubblicato
    in_attesa_pubblicazione = (
        raw_winner_data is not None
        and raw_winner_data.get("pubblicato", True) is False
    )

    return {
        "biglietti_utente": biglietti,
        "mese_corrente": current_month,
        "ha_abbonamento_attivo": ha_abbonamento_attivo,
        "vincitori": vincitori,
        "mese_riferimento": winner_data.get("mese_riferimento") if winner_data else None,
        "totale_partecipanti": winner_data.get("totale_partecipanti") if winner_data else 0,
        "totale_biglietti": winner_data.get("totale_biglietti") if winner_data else 0,
        "data_estrazione": winner_data.get("data_estrazione").isoformat() if winner_data and winner_data.get("data_estrazione") else None,
        "premio_1": premio_1,
        "premio_2": premio_2,
        "premio_3": premio_3,
        "is_me_winner": is_me_winner,
        "prossima_estrazione": next_extraction.isoformat(),
        "secondi_a_estrazione": max(0, seconds_to_extraction),
        "estrazione_fatta": winner_data is not None,
        "is_admin": is_admin,
        "bozza_in_attesa": pending_bozza,
        "in_attesa_pubblicazione": in_attesa_pubblicazione,
    }


# ==================== QUIZ A CATEGORIE ====================
# 4 categorie: GOSSIP, CULTURA GENERALE, CINEMA & SERIE TV, MUSICA
# Domande importate da quiz_domande.py

@api_router.get("/quiz/today")
async def get_quiz_today(current_user: dict = Depends(get_current_user)):
    """Quiz BONUS con scelta categoria - collegato alla ruota!"""
    user_id = str(current_user["_id"])
    today = now_rome().strftime("%Y-%m-%d")
    
    existing_answer, spin_today, category_choice = await asyncio.gather(
        db.quiz_answers.find_one({"user_id": user_id, "data": today}),
        db.wheel_spins.find_one({"user_id": user_id, "data": today}),
        db.quiz_category_choices.find_one({"user_id": user_id, "data": today})
    )
    
    if existing_answer:
        cat = existing_answer.get("categoria", "cultura")
        domande = QUIZ_PER_CATEGORIA.get(cat, QUIZ_PER_CATEGORIA["cultura"])
        quiz_index = hash(user_id + today + cat) % len(domande)
        domanda = domande[quiz_index]
        return {
            "can_play": False,
            "reason": "already_answered",
            "domanda_id": domanda["id"],
            "domanda": domanda["domanda"],
            "risposte": domanda["risposte"],
            "gia_risposto": True,
            "risposta_corretta": existing_answer.get("corretta"),
            "biglietti_vinti": existing_answer.get("biglietti_vinti", 0),
            "risposta_data": existing_answer.get("risposta_index"),
            "wheel_result": existing_answer.get("wheel_biglietti", 0),
            "bonus_type": existing_answer.get("bonus_type", "standard"),
            "categoria": cat,
            "needs_category": False,
            "message": "Hai gia risposto! Torna dopo il prossimo giro di ruota"
        }
    
    if not spin_today:
        return {
            "can_play": False,
            "reason": "no_spin",
            "domanda_id": None,
            "domanda": None,
            "risposte": [],
            "gia_risposto": False,
            "risposta_corretta": None,
            "biglietti_vinti": 0,
            "risposta_data": None,
            "wheel_result": 0,
            "bonus_type": None,
            "categoria": None,
            "needs_category": False,
            "message": "Gira prima la ruota per sbloccare il Quiz Bonus!"
        }
    
    wheel_biglietti = spin_today.get("biglietti", 0)
    if wheel_biglietti > 0:
        bonus_type = "raddoppia"
        potential_bonus = wheel_biglietti
    elif wheel_biglietti < 0:
        bonus_type = "annulla"
        potential_bonus = abs(wheel_biglietti)
    else:
        bonus_type = "standard"
        potential_bonus = 1
    
    if not category_choice:
        return {
            "can_play": True,
            "needs_category": True,
            "categorie": [
                {**CATEGORIE_INFO[c], "key": c} for c in CATEGORIE
            ],
            "domanda_id": None,
            "domanda": None,
            "risposte": [],
            "gia_risposto": False,
            "risposta_corretta": None,
            "biglietti_vinti": 0,
            "risposta_data": None,
            "wheel_result": wheel_biglietti,
            "bonus_type": bonus_type,
            "potential_bonus": potential_bonus,
            "categoria": None,
            "message": "Scegli una categoria per il Quiz Bonus!"
        }
    
    cat = category_choice["categoria"]
    domande = QUIZ_PER_CATEGORIA.get(cat, QUIZ_PER_CATEGORIA["cultura"])
    quiz_index = hash(user_id + today + cat) % len(domande)
    domanda = domande[quiz_index]
    
    return {
        "can_play": True,
        "needs_category": False,
        "domanda_id": domanda["id"],
        "domanda": domanda["domanda"],
        "risposte": domanda["risposte"],
        "gia_risposto": False,
        "risposta_corretta": None,
        "biglietti_vinti": 0,
        "risposta_data": None,
        "wheel_result": wheel_biglietti,
        "bonus_type": bonus_type,
        "potential_bonus": potential_bonus,
        "categoria": cat,
        "message": f"Categoria: {CATEGORIE_INFO[cat]['nome']} {CATEGORIE_INFO[cat]['emoji']}"
    }


class SelectCategoryRequest(BaseModel):
    categoria: str


@api_router.post("/quiz/select-category")
async def select_quiz_category(data: SelectCategoryRequest, current_user: dict = Depends(get_current_user)):
    """Seleziona la categoria del quiz del giorno"""
    user_id = str(current_user["_id"])
    today = now_rome().strftime("%Y-%m-%d")
    
    if data.categoria not in CATEGORIE:
        raise HTTPException(status_code=400, detail="Categoria non valida")
    
    existing = await db.quiz_category_choices.find_one({"user_id": user_id, "data": today})
    if existing:
        raise HTTPException(status_code=400, detail="Hai gia scelto la categoria oggi!")
    
    spin_today = await db.wheel_spins.find_one({"user_id": user_id, "data": today})
    if not spin_today:
        raise HTTPException(status_code=400, detail="Devi prima girare la ruota!")
    
    await db.quiz_category_choices.insert_one({
        "user_id": user_id,
        "data": today,
        "categoria": data.categoria,
        "created_at": now_rome()
    })
    
    domande = QUIZ_PER_CATEGORIA[data.categoria]
    quiz_index = hash(user_id + today + data.categoria) % len(domande)
    domanda = domande[quiz_index]
    
    wheel_biglietti = spin_today.get("biglietti", 0)
    if wheel_biglietti > 0:
        bonus_type = "raddoppia"
        potential_bonus = wheel_biglietti
    elif wheel_biglietti < 0:
        bonus_type = "annulla"
        potential_bonus = abs(wheel_biglietti)
    else:
        bonus_type = "standard"
        potential_bonus = 1
    
    return {
        "success": True,
        "categoria": data.categoria,
        "domanda_id": domanda["id"],
        "domanda": domanda["domanda"],
        "risposte": domanda["risposte"],
        "wheel_result": wheel_biglietti,
        "bonus_type": bonus_type,
        "potential_bonus": potential_bonus,
        "message": f"Categoria {CATEGORIE_INFO[data.categoria]['nome']} selezionata!"
    }


@api_router.post("/quiz/answer")
async def submit_quiz_answer(risposta_index: int, current_user: dict = Depends(get_current_user)):
    """Rispondi al quiz bonus - effetto dipende dal risultato della ruota!"""
    user_id = str(current_user["_id"])
    today = now_rome().strftime("%Y-%m-%d")
    current_month = now_rome().strftime("%Y-%m")
    
    existing = await db.quiz_answers.find_one({"user_id": user_id, "data": today})
    if existing:
        return {"success": False, "message": "Hai gia risposto al quiz di oggi!", "gia_risposto": True}
    
    spin_today = await db.wheel_spins.find_one({"user_id": user_id, "data": today})
    if not spin_today:
        return {"success": False, "message": "Devi prima girare la ruota!", "gia_risposto": False}
    
    category_choice = await db.quiz_category_choices.find_one({"user_id": user_id, "data": today})
    if not category_choice:
        return {"success": False, "message": "Devi prima scegliere una categoria!", "gia_risposto": False}
    
    cat = category_choice["categoria"]
    wheel_biglietti = spin_today.get("biglietti", 0)
    
    if wheel_biglietti > 0:
        bonus_type = "raddoppia"
        potential_bonus = wheel_biglietti
    elif wheel_biglietti < 0:
        bonus_type = "annulla"
        potential_bonus = abs(wheel_biglietti)
    else:
        bonus_type = "standard"
        potential_bonus = 1
    
    domande = QUIZ_PER_CATEGORIA.get(cat, QUIZ_PER_CATEGORIA["cultura"])
    quiz_index = hash(user_id + today + cat) % len(domande)
    domanda = domande[quiz_index]
    
    is_correct = risposta_index == domanda["corretta"]
    
    if is_correct:
        biglietti_vinti = potential_bonus
        if bonus_type == "raddoppia":
            message = f"RADDOPPIO! +{biglietti_vinti} biglietti extra!"
        elif bonus_type == "annulla":
            message = f"SALVATO! Hai recuperato {biglietti_vinti} biglietti!"
        else:
            message = f"Corretto! +{biglietti_vinti} biglietto!"
    else:
        biglietti_vinti = 0
        if bonus_type == "raddoppia":
            message = f"Peccato! Non hai raddoppiato... ma hai comunque vinto {wheel_biglietti} alla ruota!"
        elif bonus_type == "annulla":
            message = f"Risposta sbagliata... la perdita di {abs(wheel_biglietti)} biglietti resta."
        else:
            message = "Sbagliato! Nessun biglietto bonus questa volta..."
    
    await db.quiz_answers.insert_one({
        "user_id": user_id,
        "data": today,
        "domanda_id": domanda["id"],
        "categoria": cat,
        "risposta_index": risposta_index,
        "corretta": is_correct,
        "biglietti_vinti": biglietti_vinti,
        "bonus_type": bonus_type,
        "wheel_biglietti": wheel_biglietti,
        "created_at": now_rome()
    })
    
    if is_correct and biglietti_vinti > 0:
        await db.wheel_tickets.update_one(
            {"user_id": user_id, "mese": current_month},
            {"$inc": {"biglietti": biglietti_vinti}},
            upsert=True
        )
        logger.info(f"[QUIZ BONUS] {current_user['nome']} - {bonus_type} - {cat}: +{biglietti_vinti} biglietti")
    
    return {
        "success": True,
        "corretta": is_correct,
        "risposta_corretta_index": domanda["corretta"],
        "biglietti_vinti": biglietti_vinti,
        "bonus_type": bonus_type,
        "wheel_result": wheel_biglietti,
        "categoria": cat,
        "message": message
    }



@api_router.get("/lottery/winners")
async def get_lottery_winners(current_user: dict = Depends(get_current_user)):
    """Ottieni storico vincitori con 3 posti (filtra bozze non pubblicate per non-admin)"""
    is_admin = current_user.get("role") == "admin"
    # Per non-admin: mostra solo estrazioni pubblicate (o legacy senza campo)
    query = {} if is_admin else {"$or": [{"pubblicato": True}, {"pubblicato": {"$exists": False}}]}
    winners = await db.lottery_winners.find(query).sort("data_estrazione", -1).to_list(12)
    result = []
    for w in winners:
        vincitori = w.get("vincitori", [])
        # Retrocompatibilità: vecchio formato singolo vincitore
        if not vincitori and w.get("nome"):
            vincitori = [{
                "posizione": 1,
                "nome": w.get("nome"),
                "cognome": w.get("cognome"),
                "soprannome": w.get("soprannome"),
                "biglietti": w.get("biglietti"),
                "premio": w.get("premio")
            }]
        result.append({
            "mese": w.get("mese"),
            "mese_riferimento": w.get("mese_riferimento"),
            "vincitori": [{
                "posizione": v.get("posizione"),
                "nome": v.get("nome"),
                "cognome": v.get("cognome"),
                "soprannome": v.get("soprannome"),
                "biglietti": v.get("biglietti"),
                "premio": v.get("premio")
            } for v in vincitori],
            "totale_partecipanti": w.get("totale_partecipanti"),
            "data_estrazione": w.get("data_estrazione").isoformat() if w.get("data_estrazione") else None
        })
    return result


@api_router.post("/admin/lottery/extract-winner")
async def extract_winner(admin_user: dict = Depends(get_admin_user)):
    """Estrai manualmente 3 vincitori del mese (admin only) - SOLO abbonati attivi"""
    now = datetime.now(ROME_TZ)
    current_month = now.strftime("%Y-%m")
    
    # Controlla se l'estrazione di questo mese è già stata fatta
    existing = await db.lottery_winners.find_one({"mese": current_month})
    if existing:
        nomi = ", ".join([f"{v.get('nome')} {v.get('cognome')}" for v in existing.get("vincitori", [])])
        raise HTTPException(status_code=400, detail=f"Estrazione di {current_month} già effettuata! Vincitori: {nomi}")
    
    # Calcola il mese precedente per contare i biglietti
    if now.month == 1:
        prev_month = 12
        prev_year = now.year - 1
    else:
        prev_month = now.month - 1
        prev_year = now.year
    
    prev_month_str = f"{prev_year}-{prev_month:02d}"
    
    # Conta allenamenti (biglietti) per ogni utente nel mese precedente
    start_date = f"{prev_month_str}-01"
    end_date = f"{current_month}-01"
    
    # FILTRO: Solo utenti con abbonamento ATTIVO partecipano
    active_user_ids = await get_users_with_active_subscription()
    
    if not active_user_ids:
        raise HTTPException(status_code=400, detail="Nessun utente con abbonamento attivo!")
    
    # Aggregazione per contare biglietti da allenamenti per utente (solo abbonati attivi)
    pipeline = [
        {"$match": {
            "data_lezione": {"$gte": start_date, "$lt": end_date},
            "lezione_scalata": True,
            "user_id": {"$in": list(active_user_ids)}
        }},
        {"$group": {
            "_id": "$user_id",
            "biglietti": {"$sum": 1}
        }}
    ]
    
    partecipanti_allenamenti = await db.bookings.aggregate(pipeline).to_list(1000)
    
    # Crea dizionario biglietti per utente
    biglietti_per_utente = {p["_id"]: p["biglietti"] for p in partecipanti_allenamenti}
    
    # Aggiungi biglietti bonus dalla ruota della fortuna (del mese precedente)
    wheel_bonuses = await db.wheel_tickets.find({"mese": prev_month_str}).to_list(1000)
    for wb in wheel_bonuses:
        uid = wb["user_id"]
        if uid in active_user_ids:
            bonus = wb.get("biglietti", 0)
            if uid in biglietti_per_utente:
                biglietti_per_utente[uid] += bonus
            elif bonus > 0:
                biglietti_per_utente[uid] = bonus
    
    # ESCLUDI I VINCITORI DEL MESE PRECEDENTE (richiesta admin)
    prev_extraction = await db.lottery_winners.find_one({"mese": prev_month_str})
    if prev_extraction and "vincitori" in prev_extraction:
        excluded_ids = {v.get("user_id") for v in prev_extraction["vincitori"] if v.get("user_id")}
        if excluded_ids:
            logger.info(f"[LOTTERY] Esclusi {len(excluded_ids)} vincitori del mese precedente ({prev_month_str})")
            for uid in excluded_ids:
                biglietti_per_utente.pop(uid, None)

    # Filtra chi ha almeno 1 biglietto
    partecipanti = [{"_id": uid, "biglietti": b} for uid, b in biglietti_per_utente.items() if b >= 1]
    
    if not partecipanti:
        raise HTTPException(status_code=400, detail="Nessun partecipante! Nessun abbonato attivo si è allenato il mese scorso.")
    
    # Crea lista pesata
    pool = []
    for p in partecipanti:
        pool.extend([p["_id"]] * p["biglietti"])
    
    # ESTRAZIONE 3 VINCITORI DISTINTI
    num_vincitori = min(3, len(partecipanti))
    vincitori_ids = []
    vincitori_data = []
    pool_copy = pool.copy()
    
    for i in range(num_vincitori):
        if not pool_copy:
            break
        winner_id = random.choice(pool_copy)
        pool_copy = [uid for uid in pool_copy if uid != winner_id]
        vincitori_ids.append(winner_id)
        
        winner = await db.users.find_one({"_id": ObjectId(winner_id)})
        if winner:
            winner_biglietti = next((p["biglietti"] for p in partecipanti if p["_id"] == winner_id), 0)
            vincitori_data.append({
                "posizione": i + 1,
                "user_id": winner_id,
                "nome": winner.get("nome"),
                "cognome": winner.get("cognome"),
                "soprannome": winner.get("soprannome"),
                "biglietti": winner_biglietti
            })
    
    if not vincitori_data:
        raise HTTPException(status_code=500, detail="Errore nell'estrazione")
    
    # Ottieni i 3 premi del mese se impostati
    prize = await db.lottery_prizes.find_one({"mese": current_month})
    default_prizes = ["Maglietta o Canotta DanoFitness", "Maglietta o Canotta DanoFitness", "Maglietta o Canotta DanoFitness"]
    premi = [
        prize.get("premio_1", default_prizes[0]) if prize else default_prizes[0],
        prize.get("premio_2", default_prizes[1]) if prize else default_prizes[1],
        prize.get("premio_3", default_prizes[2]) if prize else default_prizes[2],
    ]
    
    # Assegna premio a ogni vincitore
    for v in vincitori_data:
        pos_idx = v["posizione"] - 1
        v["premio"] = premi[pos_idx] if pos_idx < len(premi) else default_prizes[0]
    
    winner_data = {
        "mese": current_month,
        "mese_riferimento": prev_month_str,
        "vincitori": vincitori_data,
        "totale_partecipanti": len(partecipanti),
        "totale_biglietti": len(pool),
        "data_estrazione": now_rome(),
        "premio_1": premi[0],
        "premio_2": premi[1],
        "premio_3": premi[2],
        "premi_ritirati": [False, False, False],
        "estratto_da": str(admin_user["_id"]),
        "estrazione_automatica": False,
        "pubblicato": False
    }
    await db.lottery_winners.insert_one(winner_data)
    logger.info(f"[LOTTERY] 3 Vincitori estratti MANUALMENTE da admin (in attesa di pubblicazione)")
    
    return {
        "message": f"Estrazione completata! {len(vincitori_data)} vincitori!",
        "vincitori": [{
            "posizione": v["posizione"],
            "nome": v["nome"],
            "cognome": v["cognome"],
            "biglietti": v["biglietti"],
            "premio": v["premio"]
        } for v in vincitori_data],
        "totale_partecipanti": len(partecipanti),
        "totale_biglietti": len(pool)
    }


@api_router.post("/admin/lottery/publish/{mese}")
async def publish_lottery(mese: str, admin_user: dict = Depends(get_admin_user)):
    """Pubblica un'estrazione in bozza: i vincitori diventano visibili a tutti gli utenti"""
    doc = await db.lottery_winners.find_one({"mese": mese})
    if not doc:
        raise HTTPException(status_code=404, detail="Nessuna estrazione trovata per questo mese")
    if doc.get("pubblicato", True) is True:
        raise HTTPException(status_code=400, detail="Estrazione già pubblicata")
    await db.lottery_winners.update_one(
        {"mese": mese},
        {"$set": {"pubblicato": True, "data_pubblicazione": now_rome(), "pubblicato_da": str(admin_user["_id"])}}
    )
    logger.info(f"[LOTTERY] Estrazione {mese} PUBBLICATA da admin {admin_user.get('nome')}")
    return {"message": f"Estrazione di {mese} pubblicata! Ora è visibile a tutti gli utenti."}


@api_router.post("/admin/lottery/re-extract/{mese}")
async def re_extract_lottery(mese: str, admin_user: dict = Depends(get_admin_user)):
    """Cancella la bozza e ri-esegue l'estrazione (solo per il mese corrente e bozze non pubblicate)"""
    now = datetime.now(ROME_TZ)
    current_month = now.strftime("%Y-%m")
    if mese != current_month:
        raise HTTPException(status_code=400, detail="Si può ri-estrarre solo per il mese corrente")
    
    doc = await db.lottery_winners.find_one({"mese": mese})
    if not doc:
        raise HTTPException(status_code=404, detail="Nessuna estrazione da ri-eseguire per questo mese")
    if doc.get("pubblicato", True) is True:
        raise HTTPException(status_code=400, detail="Impossibile ri-estrarre: estrazione già pubblicata")
    
    # Cancella la bozza e ri-estrai
    await db.lottery_winners.delete_one({"mese": mese})
    logger.info(f"[LOTTERY] Ri-estrazione richiesta da admin {admin_user.get('nome')} per {mese} - bozza cancellata")
    
    new_draft = await run_lottery_extraction()
    if not new_draft:
        raise HTTPException(status_code=400, detail="Ri-estrazione fallita: nessun partecipante valido")
    
    return {
        "message": "Ri-estrazione completata! Nuovi vincitori in bozza.",
        "vincitori": [{
            "posizione": v["posizione"],
            "nome": v.get("nome"),
            "cognome": v.get("cognome"),
            "soprannome": v.get("soprannome"),
            "biglietti": v.get("biglietti"),
            "premio": v.get("premio"),
        } for v in new_draft.get("vincitori", [])],
    }




@api_router.post("/admin/lottery/mark-prize-collected/{mese}/{posizione}")
async def mark_prize_collected(mese: str, posizione: int, admin_user: dict = Depends(get_admin_user)):
    """Segna il premio di un vincitore specifico come ritirato (posizione: 1, 2 o 3)"""
    if posizione < 1 or posizione > 3:
        raise HTTPException(status_code=400, detail="Posizione deve essere 1, 2 o 3")
    
    winner_doc = await db.lottery_winners.find_one({"mese": mese})
    if not winner_doc:
        raise HTTPException(status_code=404, detail="Vincitore non trovato")
    
    premi_ritirati = winner_doc.get("premi_ritirati", [False, False, False])
    while len(premi_ritirati) < 3:
        premi_ritirati.append(False)
    premi_ritirati[posizione - 1] = True
    
    await db.lottery_winners.update_one(
        {"mese": mese},
        {"$set": {"premi_ritirati": premi_ritirati}}
    )
    return {"message": f"Premio {posizione}° posto segnato come ritirato"}


class SetPrizeRequest(BaseModel):
    premio_1: str
    premio_2: str
    premio_3: str


@api_router.post("/admin/lottery/set-prize")
async def set_monthly_prize(data: SetPrizeRequest, admin_user: dict = Depends(get_admin_user)):
    """Imposta i 3 premi del mese corrente"""
    now = datetime.now(ROME_TZ)
    current_month = now.strftime("%Y-%m")
    
    await db.lottery_prizes.update_one(
        {"mese": current_month},
        {"$set": {
            "mese": current_month,
            "premio_1": data.premio_1,
            "premio_2": data.premio_2,
            "premio_3": data.premio_3,
            "updated_at": now_rome(),
            "updated_by": str(admin_user["_id"])
        }},
        upsert=True
    )
    
    logger.info(f"[LOTTERY] Premi del mese impostati: 1={data.premio_1}, 2={data.premio_2}, 3={data.premio_3}")
    return {"message": "Premi impostati", "premio_1": data.premio_1, "premio_2": data.premio_2, "premio_3": data.premio_3}


@api_router.get("/lottery/current-prize")
async def get_current_prize():
    """Ottieni i 3 premi del mese corrente (pubblico)"""
    now = datetime.now(ROME_TZ)
    current_month = now.strftime("%Y-%m")
    
    prize = await db.lottery_prizes.find_one({"mese": current_month})
    if prize:
        return {
            "premio_1": prize.get("premio_1"),
            "premio_2": prize.get("premio_2"),
            "premio_3": prize.get("premio_3"),
            "mese": current_month
        }
    return {"premio_1": None, "premio_2": None, "premio_3": None, "mese": current_month}


@api_router.get("/lottery/current-winner")
async def get_current_winner(current_user: dict = Depends(get_current_user)):
    """Ottieni il vincitore del mese corrente - VISIBILE A TUTTI GLI UTENTI"""
    now = datetime.now(ROME_TZ)
    current_month = now.strftime("%Y-%m")
    
    # Controlla estrazione automatica
    await check_and_run_lottery()
    
    winner = await db.lottery_winners.find_one({"mese": current_month})
    
    # Per non-admin: nascondi bozze non pubblicate
    if winner and current_user.get("role") != "admin" and winner.get("pubblicato", True) is False:
        winner = None
    
    if winner:
        return {
            "has_winner": True,
            "mese": current_month,
            "mese_riferimento": winner.get("mese_riferimento"),
            "vincitore": {
                "nome": winner.get("nome"),
                "cognome": winner.get("cognome"),
                "soprannome": winner.get("soprannome"),
                "biglietti": winner.get("biglietti"),
                "totale_partecipanti": winner.get("totale_partecipanti"),
                "totale_biglietti": winner.get("totale_biglietti"),
                "data_estrazione": winner.get("data_estrazione").isoformat() if winner.get("data_estrazione") else None,
                "is_me": winner.get("user_id") == str(current_user["_id"])
            },
            "premio": {
                "nome": winner.get("premio"),
                "descrizione": winner.get("premio_descrizione"),
                "ritirato": winner.get("premio_ritirato", False)
            } if winner.get("premio") else None
        }
    
    return {
        "has_winner": False,
        "mese": current_month,
        "vincitore": None,
        "premio": None
    }


# ==================== RUOTA DELLA FORTUNA ====================

# Definizione premi della ruota
RUOTA_PREMI = [
    {"id": 0, "premio": "ritenta", "testo": "Ritenta sarai più fortunato!", "emoji": "💨", "biglietti": 0, "tipo": "comune"},
    {"id": 1, "premio": "+1", "testo": "+1 Biglietto!", "emoji": "🎟️", "biglietti": 1, "tipo": "comune"},
    {"id": 2, "premio": "flessioni", "testo": "10 Flessioni ADESSO!", "emoji": "💪", "biglietti": 0, "tipo": "comune"},
    {"id": 3, "premio": "+2", "testo": "+2 Biglietti!", "emoji": "🎟️", "biglietti": 2, "tipo": "media"},
    {"id": 4, "premio": "jackpot", "testo": "+5 Biglietti! JACKPOT!", "emoji": "🌟", "biglietti": 5, "tipo": "raro"},
    {"id": 5, "premio": "bestia", "testo": "Urla 'SONO UNA BESTIA!'", "emoji": "😂", "biglietti": 0, "tipo": "comune"},
    {"id": 6, "premio": "-1", "testo": "-1 Biglietto! Sfigato!", "emoji": "💀", "biglietti": -1, "tipo": "comune"},
    {"id": 7, "premio": "maestro", "testo": "Il Maestro ti ruba 3 biglietti!", "emoji": "😈", "biglietti": -3, "tipo": "rarissimo"},
]

# Pesi per probabilità (più alto = più probabile)
RUOTA_PESI = [20, 20, 15, 10, 2, 15, 10, 1]  # jackpot raro (2), maestro rarissimo (1)


@api_router.get("/wheel/status")
async def get_wheel_status(current_user: dict = Depends(get_current_user)):
    """Verifica se l'utente può girare la ruota oggi"""
    user_id = str(current_user["_id"])
    today = today_rome()
    
    # PERFORMANCE FIX: Query parallele
    spin_today, allenamento_oggi = await asyncio.gather(
        db.wheel_spins.find_one({"user_id": user_id, "data": today}),
        db.bookings.find_one({"user_id": user_id, "data_lezione": today, "lezione_scalata": True})
    )
    
    if spin_today:
        return {
            "can_spin": False,
            "reason": "already_spun",
            "last_result": spin_today.get("premio"),
            "message": "Hai già girato! Torna dopo il prossimo allenamento 🎰"
        }
    
    if not allenamento_oggi:
        return {
            "can_spin": False,
            "reason": "no_workout",
            "message": "Completa un allenamento oggi per sbloccare la ruota! 💪"
        }
    
    return {
        "can_spin": True,
        "message": "Gira la ruota! 🎰"
    }


@api_router.post("/wheel/spin")
async def spin_wheel(current_user: dict = Depends(get_current_user)):
    """Gira la ruota della fortuna"""
    user_id = str(current_user["_id"])
    today = today_rome()
    
    # Verifica se può girare
    spin_today = await db.wheel_spins.find_one({
        "user_id": user_id,
        "data": today
    })
    
    if spin_today:
        raise HTTPException(status_code=400, detail="Hai già girato la ruota oggi!")
    
    # Verifica allenamento
    allenamento_oggi = await db.bookings.find_one({
        "user_id": user_id,
        "data_lezione": today,
        "lezione_scalata": True
    })
    
    if not allenamento_oggi:
        raise HTTPException(status_code=400, detail="Devi completare un allenamento per girare!")
    
    # Estrai premio con pesi
    import random
    premio_idx = random.choices(range(len(RUOTA_PREMI)), weights=RUOTA_PESI, k=1)[0]
    premio = RUOTA_PREMI[premio_idx]
    
    # Applica biglietti (positivi o negativi)
    if premio["biglietti"] != 0:
        # Aggiorna biglietti nella collezione wheel_tickets
        current_month = datetime.now(ROME_TZ).strftime("%Y-%m")
        await db.wheel_tickets.update_one(
            {"user_id": user_id, "mese": current_month},
            {"$inc": {"biglietti": premio["biglietti"]}},
            upsert=True
        )
    
    # Salva lo spin
    await db.wheel_spins.insert_one({
        "user_id": user_id,
        "data": today,
        "premio_id": premio["id"],
        "premio": premio["testo"],
        "biglietti": premio["biglietti"],
        "timestamp": now_rome()
    })
    
    logger.info(f"[WHEEL] {current_user.get('nome')} ha girato: {premio['testo']}")
    
    return {
        "success": True,
        "premio_id": premio["id"],
        "premio": premio,
        "message": premio["testo"]
    }


@api_router.get("/wheel/prizes")
async def get_wheel_prizes():
    """Ottieni la lista dei premi della ruota"""
    return {"premi": RUOTA_PREMI}


# ============================================================================
# ============================ SHOP / MERCHANDISE ============================
# ============================================================================

class ShopProductCreate(BaseModel):
    nome: str
    descrizione: Optional[str] = ""
    prezzo: float
    foto_base64: Optional[str] = None  # data URL "data:image/jpeg;base64,..."
    taglie: List[str] = []  # es ["S","M","L","XL"]
    colori: List[str] = []  # es ["Nero","Rosso","Bianco"]
    in_magazzino: bool = False  # Se True può essere evaso direttamente
    attivo: bool = True
    offerta_giorno: bool = False  # Pezzo unico, pronta consegna, visto e piaciuto


class ShopProductUpdate(BaseModel):
    nome: Optional[str] = None
    descrizione: Optional[str] = None
    prezzo: Optional[float] = None
    foto_base64: Optional[str] = None
    taglie: Optional[List[str]] = None
    colori: Optional[List[str]] = None
    in_magazzino: Optional[bool] = None
    attivo: Optional[bool] = None
    offerta_giorno: Optional[bool] = None


class ShopOrderCreate(BaseModel):
    product_id: str
    taglia: Optional[str] = None
    colore: Optional[str] = None
    quantita: int = 1
    note: Optional[str] = ""


class ShopOrderStatusUpdate(BaseModel):
    status: Optional[str] = None  # "in_attesa","inviato_produttore","in_consegna","consegnato","annullato"
    evaso_da: Optional[str] = None  # "magazzino" | "produttore"


def _serialize_product(p: dict) -> dict:
    return {
        "id": str(p["_id"]),
        "nome": p.get("nome", ""),
        "descrizione": p.get("descrizione", ""),
        "prezzo": p.get("prezzo", 0),
        "foto_base64": p.get("foto_base64"),
        "taglie": p.get("taglie", []),
        "colori": p.get("colori", []),
        "in_magazzino": p.get("in_magazzino", False),
        "attivo": p.get("attivo", True),
        "offerta_giorno": p.get("offerta_giorno", False),
        "created_at": p.get("created_at").isoformat() if p.get("created_at") else None,
    }


def _serialize_order(o: dict) -> dict:
    return {
        "id": str(o["_id"]),
        "user_id": o.get("user_id"),
        "user_nome": o.get("user_nome", ""),
        "user_cognome": o.get("user_cognome", ""),
        "user_telefono": o.get("user_telefono", ""),
        "product_id": o.get("product_id"),
        "product_nome": o.get("product_nome", ""),
        "product_foto_base64": o.get("product_foto_base64"),
        "taglia": o.get("taglia"),
        "colore": o.get("colore"),
        "quantita": o.get("quantita", 1),
        "prezzo": o.get("prezzo", 0),
        "totale": o.get("totale", 0),
        "status": o.get("status", "in_attesa"),
        "evaso_da": o.get("evaso_da"),
        "note": o.get("note", ""),
        "created_at": o.get("created_at").isoformat() if o.get("created_at") else None,
        "updated_at": o.get("updated_at").isoformat() if o.get("updated_at") else None,
    }


# --- Catalogo (lettura clienti) ---

@api_router.get("/shop/products")
async def list_shop_products(current_user: dict = Depends(get_current_user)):
    """Lista prodotti attivi visibili ai clienti"""
    products = await db.shop_products.find({"attivo": True}).sort("created_at", -1).to_list(200)
    return [_serialize_product(p) for p in products]


# --- Admin CRUD prodotti ---

@api_router.get("/admin/shop/products")
async def admin_list_shop_products(admin_user: dict = Depends(get_admin_user)):
    products = await db.shop_products.find({}).sort("created_at", -1).to_list(500)
    return [_serialize_product(p) for p in products]


@api_router.post("/admin/shop/products")
async def admin_create_shop_product(data: ShopProductCreate, admin_user: dict = Depends(get_admin_user)):
    doc = {
        "nome": data.nome.strip(),
        "descrizione": (data.descrizione or "").strip(),
        "prezzo": float(data.prezzo),
        "foto_base64": data.foto_base64,
        "taglie": [t.strip() for t in data.taglie if t.strip()],
        "colori": [c.strip() for c in data.colori if c.strip()],
        "in_magazzino": bool(data.in_magazzino),
        "attivo": bool(data.attivo),
        "offerta_giorno": bool(data.offerta_giorno),
        "created_at": now_rome(),
    }
    res = await db.shop_products.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _serialize_product(doc)


@api_router.put("/admin/shop/products/{product_id}")
async def admin_update_shop_product(product_id: str, data: ShopProductUpdate, admin_user: dict = Depends(get_admin_user)):
    update_fields = {k: v for k, v in data.dict().items() if v is not None}
    if not update_fields:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    try:
        res = await db.shop_products.update_one({"_id": ObjectId(product_id)}, {"$set": update_fields})
    except Exception:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    p = await db.shop_products.find_one({"_id": ObjectId(product_id)})
    return _serialize_product(p)


@api_router.delete("/admin/shop/products/{product_id}")
async def admin_delete_shop_product(product_id: str, admin_user: dict = Depends(get_admin_user)):
    try:
        res = await db.shop_products.delete_one({"_id": ObjectId(product_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    return {"message": "Prodotto eliminato"}


# --- Ordini ---

# Frasi sarcastiche/divertenti per il messaggio WhatsApp al produttore (ordini da produrre)
WHATSAPP_INTROS = [
    "🚨 Allarme rosso Mirko! Un altro cliente è caduto vittima della linea DanoFitness 💪",
    "🔥 Mirko, ho una notizia bomba: un altro pazzo ha deciso di vestirsi come un atleta! 🏋️",
    "👀 Mirko, indovina chi non resiste al fascino del nostro merch? Eccone un altro!",
    "🎯 Mirko mio, abbiamo un nuovo cliente conquistato dal richiamo del prodottino di qualità!",
    "🦾 Yo Mirko, ennesima vittima del marketing aggressivo della palestra. Fattura, fattura!",
    "💸 Mirko, contante in arrivo! Un altro tesserato ha cliccato sul pulsante magico.",
    "🚀 Houston, abbiamo un ordine. Mirko, prepara la macchina da cucire (o la scatola, a seconda).",
    "🥇 Mirko, ti annuncio con orgoglio che il merchandising vola: ordine appena entrato!",
    "🎉 Mirko, festeggia! Un altro cliente non ha saputo resistere ai 'prodottini di qualità'™",
    "👕 Mirko, è di nuovo quel momento: c'è chi ha capito che senza una nostra t-shirt non si vive.",
    "📦 Pacco in partenza, Mirko! Qualcuno ha appena premuto 'ordina' senza pensarci due volte 😎",
    "🤡 Mirko, un altro caduto. Si vede che le mie lezioni di funzionale fanno effetto anche sulla testa.",
]

# Frasi per ordini evasi DAL MAGAZZINO (FYI a Mirko, non deve produrre nulla)
WHATSAPP_INTROS_MAGAZZINO = [
    "📦 Mirko, FYI: ho evaso questo ordine direttamente dal magazzino. Tu rilassati, è tutto sotto controllo 😎",
    "💪 Yo Mirko, ennesima vittoria del magazzino DanoFitness! Niente cuciture per te oggi.",
    "🏆 Mirko, ti aggiorno: questo l'ho gestito io dal mio stock. Tu pensa al prossimo che arriverà 😉",
    "🎯 Mirko mio, magazzino ringrazia e saluta. Ordine evaso senza disturbarti!",
    "⚡ Notizia flash, Mirko: ho preso roba dal magazzino. Risparmiati la fatica, te lo dico solo per traccia 📋",
    "🤘 Mirko, magazzino batte produzione 1-0. Tutto ok, è solo per tenerti aggiornato!",
    "✅ Mirko, ordine sistemato dal mio scaffale. Considerala una piccola vacanza dalla cucitura 🛋️",
    "📋 Promemoria Mirko: questo cliente l'ho coperto io con merce esistente. Riposati!",
    "🦾 Mirko, dal magazzino con furore! Ordine evaso senza produzione, FYI per te.",
    "🎁 Mirko, ho aperto la cassetta del magazzino e tirato fuori questo. Tu fai altro, va bene così 👌",
]


@api_router.post("/shop/orders")
async def create_shop_order(data: ShopOrderCreate, current_user: dict = Depends(get_current_user)):
    """Crea un ordine. Restituisce anche il messaggio WhatsApp pronto da inviare al produttore."""
    try:
        product = await db.shop_products.find_one({"_id": ObjectId(data.product_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    if not product:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    if not product.get("attivo", True):
        raise HTTPException(status_code=400, detail="Prodotto non più disponibile")

    # Validazione taglia/colore se il prodotto le richiede
    if product.get("taglie") and not data.taglia:
        raise HTTPException(status_code=400, detail="Seleziona una taglia")
    if product.get("colori") and not data.colore:
        raise HTTPException(status_code=400, detail="Seleziona un colore")

    qta = max(1, int(data.quantita or 1))
    prezzo = float(product.get("prezzo", 0))
    totale = round(prezzo * qta, 2)

    order = {
        "user_id": str(current_user["_id"]),
        "user_nome": current_user.get("nome", ""),
        "user_cognome": current_user.get("cognome", ""),
        "user_telefono": current_user.get("telefono", ""),
        "product_id": data.product_id,
        "product_nome": product.get("nome", ""),
        "product_foto_base64": product.get("foto_base64"),
        "taglia": data.taglia,
        "colore": data.colore,
        "quantita": qta,
        "prezzo": prezzo,
        "totale": totale,
        "status": "in_attesa",
        "evaso_da": None,
        "note": (data.note or "").strip(),
        "admin_notified": False,
        "created_at": now_rome(),
        "updated_at": now_rome(),
    }
    res = await db.shop_orders.insert_one(order)
    order["_id"] = res.inserted_id

    # 🎟️ BONUS: +5 biglietti lotteria per ogni acquisto
    SHOP_TICKETS_BONUS = 5
    current_month = now_rome().strftime("%Y-%m")
    user_id = str(current_user["_id"])
    await db.wheel_tickets.update_one(
        {"user_id": user_id, "mese": current_month},
        {"$inc": {"biglietti": SHOP_TICKETS_BONUS}},
        upsert=True
    )
    logger.info(f"[SHOP-BONUS] +{SHOP_TICKETS_BONUS} biglietti a {current_user.get('nome')} per ordine {res.inserted_id}")

    # Genera scheda ordine + frase divertente per WhatsApp
    intro = random.choice(WHATSAPP_INTROS)
    cliente = f"{order['user_nome']} {order['user_cognome']}".strip() or "Anonimo"
    tel = f" (tel: {order['user_telefono']})" if order['user_telefono'] else ""
    righe = [
        intro,
        "",
        "📋 *NUOVO ORDINE DANOFITNESS23*",
        "",
        f"👤 Cliente: *{cliente}*{tel}",
        f"🛍️ Prodotto: *{order['product_nome']}*",
    ]
    if order.get("taglia"):
        righe.append(f"📏 Taglia: *{order['taglia']}*")
    if order.get("colore"):
        righe.append(f"🎨 Colore: *{order['colore']}*")
    righe.append(f"🔢 Quantità: *{qta}*")
    righe.append(f"💰 Totale: *€ {totale:.2f}*")
    if order.get("note"):
        righe.append(f"📝 Note: {order['note']}")
    righe.append("")
    righe.append(f"🆔 Rif. ordine: {str(res.inserted_id)[-6:].upper()}")
    righe.append("")
    righe.append("Procedi pure quando puoi 🙏 — Daniele")

    whatsapp_text = "\n".join(righe)

    return {
        "order": _serialize_order(order),
        "whatsapp_text": whatsapp_text,
        "bonus_biglietti": SHOP_TICKETS_BONUS,
    }


@api_router.get("/shop/orders/me")
async def list_my_orders(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    orders = await db.shop_orders.find({"user_id": user_id}).sort("created_at", -1).to_list(200)
    return [_serialize_order(o) for o in orders]


@api_router.delete("/shop/orders/{order_id}")
async def cancel_my_order(order_id: str, current_user: dict = Depends(get_current_user)):
    """Il cliente può annullare il proprio ordine SOLO finché è in_attesa.
    Cancellazione: revoca i 5 biglietti bonus e elimina completamente l'ordine."""
    try:
        order = await db.shop_orders.find_one({"_id": ObjectId(order_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    if order.get("user_id") != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Non puoi annullare questo ordine")
    if order.get("status") != "in_attesa":
        raise HTTPException(status_code=400, detail="L'ordine è già stato preso in carico, non può più essere annullato")

    # Revoca i 5 biglietti bonus (decrementa il mese in cui sono stati assegnati)
    SHOP_TICKETS_BONUS = 5
    created = order.get("created_at")
    ticket_month = created.strftime("%Y-%m") if hasattr(created, "strftime") else now_rome().strftime("%Y-%m")
    user_id = str(current_user["_id"])
    ticket_doc = await db.wheel_tickets.find_one({"user_id": user_id, "mese": ticket_month})
    if ticket_doc:
        new_count = max(0, ticket_doc.get("biglietti", 0) - SHOP_TICKETS_BONUS)
        await db.wheel_tickets.update_one(
            {"user_id": user_id, "mese": ticket_month},
            {"$set": {"biglietti": new_count}}
        )
        logger.info(f"[SHOP-CANCEL] Revocati {SHOP_TICKETS_BONUS} biglietti a user {user_id} (ordine {order_id})")

    # Elimina completamente l'ordine
    await db.shop_orders.delete_one({"_id": ObjectId(order_id)})
    return {"message": "Ordine annullato e biglietti revocati"}


@api_router.get("/admin/shop/orders")
async def admin_list_orders(admin_user: dict = Depends(get_admin_user)):
    # Esclude gli ordini archiviati dall'admin (soft delete)
    orders = await db.shop_orders.find({"hidden_from_admin": {"$ne": True}}).sort("created_at", -1).to_list(1000)
    return [_serialize_order(o) for o in orders]


@api_router.patch("/admin/shop/orders/{order_id}")
async def admin_update_order(order_id: str, data: ShopOrderStatusUpdate, admin_user: dict = Depends(get_admin_user)):
    update_fields = {k: v for k, v in data.dict().items() if v is not None}
    if not update_fields:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    update_fields["updated_at"] = now_rome()
    try:
        res = await db.shop_orders.update_one({"_id": ObjectId(order_id)}, {"$set": update_fields})
    except Exception:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    o = await db.shop_orders.find_one({"_id": ObjectId(order_id)})
    return _serialize_order(o)


@api_router.delete("/admin/shop/orders/{order_id}")
async def admin_delete_order(order_id: str, admin_user: dict = Depends(get_admin_user)):
    """Soft delete: l'ordine sparisce dalla vista admin ma rimane visibile al cliente come promemoria."""
    try:
        res = await db.shop_orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": {"hidden_from_admin": True, "updated_at": now_rome()}}
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    return {"message": "Ordine archiviato"}


@api_router.get("/admin/shop/orders/pending-notifications")
async def admin_pending_order_notifications(admin_user: dict = Depends(get_admin_user)):
    """Restituisce gli ordini nuovi non ancora visti dall'admin (per popup di notifica all'apertura app)"""
    orders = await db.shop_orders.find({
        "admin_notified": {"$ne": True},
        "hidden_from_admin": {"$ne": True},
        "status": "in_attesa",
    }).sort("created_at", -1).to_list(50)
    return {
        "count": len(orders),
        "orders": [_serialize_order(o) for o in orders],
    }


@api_router.post("/admin/shop/orders/mark-notified")
async def admin_mark_notified(admin_user: dict = Depends(get_admin_user)):
    """Marca tutti gli ordini in_attesa come visti (chiamato dopo che l'admin ha visualizzato il popup)"""
    res = await db.shop_orders.update_many(
        {"admin_notified": {"$ne": True}, "status": "in_attesa"},
        {"$set": {"admin_notified": True}}
    )
    return {"updated": res.modified_count}


@api_router.post("/admin/shop/orders/{order_id}/whatsapp-link")
async def admin_get_whatsapp_link(order_id: str, fonte: str = "produttore", admin_user: dict = Depends(get_admin_user)):
    """Ritorna il testo WhatsApp per Mirko.
    Param `fonte`: "produttore" (frase sarcastica per ordine da produrre) o "magazzino" (FYI per ordine evaso da magazzino)"""
    try:
        order = await db.shop_orders.find_one({"_id": ObjectId(order_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Ordine non trovato")
    if not order:
        raise HTTPException(status_code=404, detail="Ordine non trovato")

    intro = random.choice(WHATSAPP_INTROS_MAGAZZINO if fonte == "magazzino" else WHATSAPP_INTROS)
    cliente = f"{order.get('user_nome','')} {order.get('user_cognome','')}".strip() or "Anonimo"
    tel = f" (tel: {order.get('user_telefono')})" if order.get('user_telefono') else ""
    titolo = "📦 *ORDINE EVASO DA MAGAZZINO*" if fonte == "magazzino" else "📋 *NUOVO ORDINE DANOFITNESS23*"
    righe = [
        intro,
        "",
        titolo,
        "",
        f"👤 Cliente: *{cliente}*{tel}",
        f"🛍️ Prodotto: *{order.get('product_nome','')}*",
    ]
    if order.get("taglia"):
        righe.append(f"📏 Taglia: *{order['taglia']}*")
    if order.get("colore"):
        righe.append(f"🎨 Colore: *{order['colore']}*")
    righe.append(f"🔢 Quantità: *{order.get('quantita', 1)}*")
    righe.append(f"💰 Totale: *€ {order.get('totale', 0):.2f}*")
    if order.get("note"):
        righe.append(f"📝 Note: {order['note']}")
    righe.append("")
    righe.append(f"🆔 Rif. ordine: {str(order['_id'])[-6:].upper()}")
    righe.append("")
    if fonte == "magazzino":
        righe.append("Tutto a posto, è solo per tenerti aggiornato 🙏 — Daniele")
    else:
        righe.append("Procedi pure quando puoi 🙏 — Daniele")

    return {"whatsapp_text": "\n".join(righe)}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://danofitness23.vercel.app",
        "https://danofitness26.vercel.app",
        "http://localhost:3000",
        "http://localhost:8081",
        "http://localhost:19006",
        "https://gamification-phase2-1.preview.emergentagent.com",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Start the scheduler and create MongoDB indexes for performance"""
    
    # Creazione indici MongoDB per ottimizzare le query
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("role")
        await db.users.create_index("archived")
        await db.subscriptions.create_index([("user_id", 1), ("attivo", 1)])
        await db.subscriptions.create_index("data_scadenza")
        await db.subscriptions.create_index([("attivo", 1), ("pagato", 1)])
        await db.bookings.create_index([("user_id", 1), ("data_lezione", 1)])
        await db.bookings.create_index([("lesson_id", 1), ("data_lezione", 1)])
        await db.bookings.create_index("data_lezione")
        await db.bookings.create_index([("data_lezione", 1), ("confermata", 1), ("lezione_scalata", 1)])
        await db.lessons.create_index("giorno")
        await db.log_ingressi.create_index([("user_id", 1), ("data_lezione", 1)])
        await db.blocked_dates.create_index("data", unique=True)
        await db.medals.create_index("user_id")
        await db.wheel_spins.create_index([("user_id", 1), ("data", 1)])
        await db.quiz_answers.create_index([("user_id", 1), ("date", 1)])
        await db.meal_plans.create_index([("user_id", 1), ("mese", 1)])
        await db.nutrition_profiles.create_index("user_id", unique=True)
        logger.info("[DB] MongoDB indexes created successfully")
    except Exception as e:
        logger.warning(f"[DB] Index creation warning: {e}")
    
    # Blocca date specifiche (lezioni sospese)
    blocked_dates_to_add = [
        {"data": "2026-03-14", "motivo": "Costanza ha un corso di aggiornamento, scusate per il disagio! 🙏"},
    ]
    for bd in blocked_dates_to_add:
        existing = await db.blocked_dates.find_one({"data": bd["data"]})
        if not existing:
            await db.blocked_dates.insert_one({
                "data": bd["data"],
                "motivo": bd["motivo"],
                "created_at": now_rome(),
                "created_by": "system"
            })
            logger.info(f"[BLOCKED] Data {bd['data']} bloccata: {bd['motivo']}")
    
    # Indice per cancelled_lessons
    try:
        await db.cancelled_lessons.create_index([("lesson_id", 1), ("data_lezione", 1)], unique=True)
    except Exception:
        pass
    
    # Cleanup: disattiva flag prova_attiva per utenti che hanno un abbonamento "vero"
    # o la cui prova è scaduta (sana eventuali stati incoerenti dei dati esistenti)
    try:
        today_str = now_rome().strftime("%Y-%m-%d")
        # Trova tutti gli utenti con prova_attiva=True
        utenti_in_prova = await db.users.find(
            {"prova_attiva": True},
            {"_id": 1, "nome": 1, "cognome": 1, "prova_scadenza": 1}
        ).to_list(1000)
        cleaned = 0
        for u in utenti_in_prova:
            uid = str(u["_id"])
            # 1) Prova scaduta
            if u.get("prova_scadenza") and u["prova_scadenza"] < today_str:
                await db.users.update_one(
                    {"_id": u["_id"]},
                    {"$set": {"prova_attiva": False, "prova_terminata_il": today_str}}
                )
                cleaned += 1
                logger.info(f"[STARTUP-CLEANUP] Prova scaduta disattivata per {u.get('nome')} {u.get('cognome')}")
                continue
            # 2) Ha già un abbonamento vero attivo (non prova_7gg)
            real_sub = await db.subscriptions.find_one({
                "user_id": uid,
                "attivo": True,
                "tipo": {"$ne": "prova_7gg"},
                "data_scadenza": {"$gte": now_rome()}
            })
            if real_sub:
                await db.users.update_one(
                    {"_id": u["_id"]},
                    {"$set": {"prova_attiva": False, "prova_terminata_il": today_str}}
                )
                cleaned += 1
                logger.info(f"[STARTUP-CLEANUP] Prova disattivata (ha abbonamento {real_sub['tipo']}) per {u.get('nome')} {u.get('cognome')}")
        if cleaned > 0:
            logger.info(f"[STARTUP-CLEANUP] {cleaned} utenti puliti dal flag prova_attiva")
    except Exception as e:
        logger.warning(f"[STARTUP-CLEANUP] Errore: {e}")
    
    # Avvia il background task per processare le lezioni automaticamente
    asyncio.create_task(auto_process_lessons_task())
    logger.info("[AUTO-PROCESS] Background task avviato - controlla ogni 2 minuti")


# Background task per processare automaticamente le lezioni iniziate
async def auto_process_lessons_task():
    """
    Task che gira in background e processa automaticamente le lezioni
    quando iniziano (basato su orario Roma).
    Controlla ogni 2 minuti.
    """
    # Prima esecuzione immediata dopo 10 secondi
    await asyncio.sleep(10)
    
    while True:
        try:
            now = now_rome()
            oggi = now.strftime("%Y-%m-%d")
            ora_corrente = now.strftime("%H:%M")
            
            logger.info(f"[AUTO-PROCESS] Check alle {ora_corrente} (Roma) - Data: {oggi}")
            
            # Trova prenotazioni di oggi E di ieri non ancora scalate (safety net per restart/deploy)
            ieri = (now - timedelta(days=1)).strftime("%Y-%m-%d")
            bookings = await db.bookings.find({
                "data_lezione": {"$in": [oggi, ieri]},
                "lezione_scalata": False,
                "confermata": True
            }).to_list(1000)
            
            logger.info(f"[AUTO-PROCESS] Trovate {len(bookings)} prenotazioni da processare")
            
            if not bookings:
                await asyncio.sleep(120)  # Aspetta 2 minuti
                continue
            
            processed = 0
            
            for booking in bookings:
                # Ottieni l'orario della lezione
                lesson_data = booking.get("lesson_data", {})
                orario_lezione = lesson_data.get("orario", "")
                
                if not orario_lezione:
                    try:
                        lesson_id = booking.get("lesson_id")
                        if lesson_id:
                            lesson = await db.lessons.find_one({"_id": ObjectId(lesson_id)})
                            if lesson:
                                orario_lezione = lesson.get("orario", "")
                    except:
                        pass
                
                if not orario_lezione:
                    logger.warning(f"[AUTO-PROCESS] Booking {booking['_id']} senza orario")
                    continue
                
                # Per le lezioni di ieri, processa subito (sono già passate)
                booking_date = booking.get("data_lezione", "")
                if booking_date == oggi and ora_corrente < orario_lezione:
                    logger.info(f"[AUTO-PROCESS] Lezione {orario_lezione} non ancora iniziata (ora: {ora_corrente})")
                    continue
                
                user_id = booking["user_id"]
                logger.info(f"[AUTO-PROCESS] Processando booking user {user_id}, lezione {orario_lezione}")
                
                # Cerca abbonamento a PACCHETTO
                sub_pacchetto = await db.subscriptions.find_one({
                    "user_id": user_id,
                    "attivo": True,
                    "tipo": {"$in": ["lezione_singola", "lezioni_8", "lezioni_16"]},
                    "lezioni_rimanenti": {"$gt": 0}
                })
                
                if sub_pacchetto:
                    await db.subscriptions.update_one(
                        {"_id": sub_pacchetto["_id"]},
                        {"$inc": {"lezioni_rimanenti": -1}}
                    )
                    await db.bookings.update_one(
                        {"_id": booking["_id"]},
                        {"$set": {"lezione_scalata": True}}
                    )
                    processed += 1
                    logger.info(f"[AUTO-PROCESS] ✓ Scalata lezione PACCHETTO per user {user_id}")
                    
                    # Notifica se abbonamento esaurito
                    updated_sub = await db.subscriptions.find_one({"_id": sub_pacchetto["_id"]})
                    if updated_sub and updated_sub["lezioni_rimanenti"] <= 0:
                        notification = {
                            "user_id": user_id,
                            "tipo": "abbonamento_esaurito",
                            "messaggio": f"Il tuo abbonamento {sub_pacchetto['tipo']} è esaurito.",
                            "letta": False,
                            "created_at": now_rome()
                        }
                        await db.notifications.insert_one(notification)
                else:
                    # Abbonamento a TEMPO
                    sub_tempo = await db.subscriptions.find_one({
                        "user_id": user_id,
                        "attivo": True,
                        "tipo": {"$in": ["mensile", "trimestrale", "annuale"]}
                    })
                    
                    if sub_tempo:
                        # Verifica scadenza (gestisce sia stringa che datetime)
                        data_scadenza = sub_tempo.get("data_scadenza", "")
                        if isinstance(data_scadenza, datetime):
                            data_scadenza = data_scadenza.strftime("%Y-%m-%d")
                        
                        if data_scadenza >= oggi:
                            await db.bookings.update_one(
                                {"_id": booking["_id"]},
                                {"$set": {"lezione_scalata": True}}
                            )
                            processed += 1
                            logger.info(f"[AUTO-PROCESS] ✓ Confermata presenza TEMPO per user {user_id}")
                        else:
                            logger.warning(f"[AUTO-PROCESS] Abbonamento tempo scaduto per user {user_id}")
                    else:
                        logger.warning(f"[AUTO-PROCESS] User {user_id} senza abbonamento valido")
            
            if processed > 0:
                logger.info(f"[AUTO-PROCESS] === Totale processate: {processed} lezioni ===")
            
            await asyncio.sleep(120)  # Aspetta 2 minuti
                
        except Exception as e:
            logger.error(f"[AUTO-PROCESS] Errore: {e}")
            await asyncio.sleep(120)


# Endpoint temporaneo per promuovere utente ad admin (da rimuovere dopo l'uso)
@app.post("/api/promote-admin/{email}")
async def promote_to_admin(email: str):
    result = await db.users.update_one(
        {"email": email},
        {"$set": {"role": "admin"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return {"message": f"Utente {email} promosso ad admin"}


# Endpoint temporaneo per importare le lezioni
@app.post("/api/import-lessons")
async def import_lessons():
    lessons = [
        {"giorno": "lunedi", "orario": "08:30", "tipo_attivita": "circuito", "descrizione": "Allenamento a stazioni per resistenza, forza e velocità", "coach": "Daniele"},
        {"giorno": "lunedi", "orario": "20:30", "tipo_attivita": "funzionale", "descrizione": "Allenamento di gruppo con metodologia Tabata", "coach": "Daniele"},
        {"giorno": "martedi", "orario": "13:15", "tipo_attivita": "funzionale", "descrizione": "Allenamento di gruppo con metodologia Tabata", "coach": "Fabio"},
        {"giorno": "martedi", "orario": "17:30", "tipo_attivita": "circuito", "descrizione": "Allenamento a stazioni per resistenza, forza e velocità", "coach": "Daniele"},
        {"giorno": "martedi", "orario": "20:15", "tipo_attivita": "pilates", "descrizione": "Per postura, flessibilità e concentrazione", "coach": "Toto"},
        {"giorno": "mercoledi", "orario": "08:30", "tipo_attivita": "funzionale", "descrizione": "Allenamento di gruppo con metodologia Tabata", "coach": "Daniele"},
        {"giorno": "mercoledi", "orario": "20:30", "tipo_attivita": "circuito", "descrizione": "Allenamento a stazioni per resistenza, forza e velocità", "coach": "Daniele"},
        {"giorno": "giovedi", "orario": "13:15", "tipo_attivita": "circuito", "descrizione": "Allenamento a stazioni per resistenza, forza e velocità", "coach": "Daniele"},
        {"giorno": "giovedi", "orario": "17:30", "tipo_attivita": "funzionale", "descrizione": "Allenamento di gruppo con metodologia Tabata", "coach": "Daniele"},
        {"giorno": "giovedi", "orario": "20:15", "tipo_attivita": "pilates", "descrizione": "Per postura, flessibilità e concentrazione", "coach": "Toto"},
        {"giorno": "venerdi", "orario": "08:30", "tipo_attivita": "funzionale", "descrizione": "Allenamento di gruppo con metodologia Tabata", "coach": "Fabio"},
        {"giorno": "venerdi", "orario": "20:15", "tipo_attivita": "funzionale", "descrizione": "Allenamento di gruppo con metodologia Tabata", "coach": "Daniele"},
        {"giorno": "sabato", "orario": "13:30", "tipo_attivita": "yoga", "descrizione": "Disciplina che unisce respiro, movimento e meditazione", "coach": "Costanza"},
    ]
    
    # Clear existing lessons and insert new ones
    await db.lessons.delete_many({})
    result = await db.lessons.insert_many(lessons)
    return {"message": f"Importate {len(result.inserted_ids)} lezioni"}


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
