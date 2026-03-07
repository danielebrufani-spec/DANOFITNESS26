from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from passlib.context import CryptContext
import jwt
from bson import ObjectId
from enum import Enum
# APScheduler removed to save memory on Render free tier
import asyncio
# pywebpush disabled to save memory - uncomment when needed
# from pywebpush import webpush, WebPushException
import json

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

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

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
    LEZIONI_8 = "lezioni_8"
    LEZIONI_16 = "lezioni_16"
    MENSILE = "mensile"
    TRIMESTRALE = "trimestrale"

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
    archived: Optional[bool] = False  # Cliente archiviato (non attivo)

class SubscriptionCreate(BaseModel):
    user_id: str
    tipo: SubscriptionType
    data_inizio: Optional[datetime] = None
    lezioni_rimanenti: Optional[int] = None  # Allow setting initial lessons
    data_scadenza: Optional[datetime] = None  # Allow setting custom expiry date

class SubscriptionUpdate(BaseModel):
    lezioni_rimanenti: Optional[int] = None
    data_scadenza: Optional[datetime] = None
    attivo: Optional[bool] = None

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

# ======================== HELPER FUNCTIONS ========================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

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
    if tipo == SubscriptionType.LEZIONI_8 or tipo == SubscriptionType.LEZIONI_16:
        # Validità annuale per abbonamenti a lezioni
        return start_date + timedelta(days=365)
    elif tipo == SubscriptionType.MENSILE:
        return start_date + timedelta(days=30)
    elif tipo == SubscriptionType.TRIMESTRALE:
        return start_date + timedelta(days=90)
    return start_date

def get_initial_lessons(tipo: SubscriptionType) -> Optional[int]:
    if tipo == SubscriptionType.LEZIONI_8:
        return 8
    elif tipo == SubscriptionType.LEZIONI_16:
        return 16
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
    """Restituisce le date di inizio (lunedì) e fine (sabato) della SETTIMANA PRECEDENTE"""
    today = datetime.now(ROME_TZ)
    current_day = today.weekday()  # 0=Lunedì, 6=Domenica
    
    # Calcola il lunedì della settimana corrente
    if current_day == 6:  # Domenica
        this_monday = today + timedelta(days=1)
    else:
        this_monday = today - timedelta(days=current_day)
    
    # Vai alla settimana precedente
    prev_monday = this_monday - timedelta(days=7)
    prev_monday = prev_monday.replace(hour=0, minute=0, second=0, microsecond=0)
    prev_saturday = prev_monday + timedelta(days=5)
    
    return prev_monday.strftime("%Y-%m-%d"), prev_saturday.strftime("%Y-%m-%d")

def get_current_week_dates() -> tuple:
    """Restituisce le date di inizio (lunedì) e fine (sabato) della SETTIMANA CORRENTE"""
    today = datetime.now(ROME_TZ)
    current_day = today.weekday()  # 0=Lunedì, 6=Domenica
    
    # Calcola il lunedì della settimana corrente
    if current_day == 6:  # Domenica
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
            must_reset_password=user.get("must_reset_password", False)
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
        must_reset_password=current_user.get("must_reset_password", False)
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
    blocked = await db.blocked_dates.find({"data": {"$gte": today}}).to_list(100)
    return [{"data": b["data"], "motivo": b["motivo"]} for b in blocked]

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
    return {"message": f"Data {data} sbloccata"}

# ======================== LESSONS ROUTES ========================

@api_router.get("/lessons", response_model=List[LessonResponse])
async def get_lessons(current_user: dict = Depends(get_current_user)):
    # Initialize lessons if not exists
    count = await db.lessons.count_documents({})
    if count == 0:
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
    lessons = await db.lessons.find({"giorno": giorno.lower()}).to_list(100)
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
        "created_at": now_rome()
    }
    
    result = await db.subscriptions.insert_one(subscription)
    
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
                created_at=sub["created_at"]
            ))
    
    return result

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
        user = await db.users.find_one({"_id": ObjectId(updated_sub["user_id"])})
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
        created_at=booking["created_at"]
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
            lessons = await db.lessons.find(
                {"_id": {"$in": [ObjectId(lid) for lid in set(lesson_ids_to_fetch)]}}
            ).to_list(len(set(lesson_ids_to_fetch)))
            lessons_cache = {str(l["_id"]): l for l in lessons}
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
    
    prev_bookings = await db.bookings.find({
        "user_id": user_id,
        "data_lezione": {"$in": prev_week_dates},
        "lezione_scalata": True
    }).to_list(100)
    
    # Conta OGNI allenamento fatto (anche più di uno al giorno)
    allenamenti_prev = len(prev_bookings)
    livello_info = get_livello_info(allenamenti_prev)
    
    # === SETTIMANA CORRENTE (per barra progresso) ===
    curr_monday, curr_saturday = get_current_week_dates()
    curr_week_dates = []
    start_curr = datetime.strptime(curr_monday, "%Y-%m-%d")
    for i in range(6):
        d = start_curr + timedelta(days=i)
        curr_week_dates.append(d.strftime("%Y-%m-%d"))
    
    # Conta prenotazioni confermate (scalate) + prenotazioni future confermate
    curr_bookings = await db.bookings.find({
        "user_id": user_id,
        "data_lezione": {"$in": curr_week_dates},
        "confermata": True
    }).to_list(100)
    
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
    Restituisce il log degli ingressi PROGRESSIVO per un abbonamento.
    Mostra: numero progressivo, giorno della settimana, data, orario, tipo lezione.
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
    
    # Query base: tutte le prenotazioni confermate o scalate dell'utente
    base_query = {
        "user_id": sub_user_id,
        "$or": [
            {"lezione_scalata": True},
            {"confermata": True}
        ]
    }
    
    # Prova prima con filtro date
    bookings = []
    if data_inizio and data_scadenza:
        query_with_dates = {**base_query, "data_lezione": {"$gte": data_inizio, "$lte": data_scadenza}}
        bookings = await db.bookings.find(query_with_dates).sort("data_lezione", 1).to_list(200)
        logger.info(f"[LOG-INGRESSI] Con filtro date: {len(bookings)} risultati")
    
    # Se non trova nulla con filtro date, mostra TUTTE le prenotazioni dell'utente
    if len(bookings) == 0:
        logger.warning(f"[LOG-INGRESSI] Nessun risultato con filtro date, mostro tutto")
        bookings = await db.bookings.find(base_query).sort("data_lezione", 1).to_list(200)
        logger.info(f"[LOG-INGRESSI] Senza filtro date: {len(bookings)} risultati")
    
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
        "tipo": {"$in": ["lezioni_8", "lezioni_16"]},
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
    
    participants = []
    for booking in bookings:
        user = users_cache.get(booking["user_id"])
        if user:
            # Usa soprannome se presente, altrimenti nome completo
            display_name = user.get("soprannome") if user.get("soprannome") else f"{user.get('nome', '')} {user.get('cognome', '')}"
            participants.append({
                "nome": display_name.strip()
            })
    
    return {
        "lesson_id": lesson_id,
        "date": lesson_date,
        "participants": participants,
        "count": len(participants)
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
        lessons = await db.lessons.find(
            {"_id": {"$in": [ObjectId(lid) for lid in lesson_ids]}}
        ).to_list(len(lesson_ids))
        lessons_cache = {str(l["_id"]): l for l in lessons}
    
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
    # PERFORMANCE FIX: Exclude profile_image from bulk user query
    # Escludi utenti archiviati dalla lista principale
    users = await db.users.find({"archived": {"$ne": True}}, {"profile_image": 0}).to_list(1000)
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
            profile_image=None,  # Excluded for performance
            archived=user.get("archived", False)
        ) for user in users
    ]


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
        user = await db.users.find_one({"_id": ObjectId(user_id)})
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
        user = await db.users.find_one({"_id": ObjectId(user_id)})
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
        lessons = await db.lessons.find(
            {"_id": {"$in": [ObjectId(lid) for lid in set(lesson_ids_to_fetch)]}}
        ).to_list(len(set(lesson_ids_to_fetch)))
        lessons_cache = {str(l["_id"]): l for l in lessons}
    
    # Batch load all subscriptions for these users
    pacchetto_users = set()
    if user_ids:
        pacchetto_subs = await db.subscriptions.find({
            "user_id": {"$in": user_ids},
            "attivo": True,
            "tipo": {"$in": ["lezioni_8", "lezioni_16"]}
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
            "tipo": {"$in": ["lezioni_8", "lezioni_16"]},
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
            "tipo": {"$in": ["lezioni_8", "lezioni_16"]},
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

@api_router.get("/admin/weekly-stats")
async def get_weekly_stats(admin_user: dict = Depends(get_admin_user)):
    """Get weekly statistics: total presences and lessons already deducted.
    La settimana si resetta domenica alle 9:00 (quando si aprono le prenotazioni della settimana successiva)
    """
    today = now_rome()
    current_day = today.weekday()  # 0=Monday, 6=Sunday
    current_hour = today.hour
    
    # Determina se siamo nella "nuova settimana" (domenica dopo le 9:00)
    # In quel caso, mostriamo la settimana che INIZIA domani (lunedì)
    # Altrimenti mostriamo la settimana corrente
    
    if current_day == 6 and current_hour >= 9:
        # Domenica dopo le 9:00 -> mostra settimana PROSSIMA (inizia domani)
        monday = today + timedelta(days=1)
    elif current_day == 6 and current_hour < 9:
        # Domenica prima delle 9:00 -> mostra settimana corrente
        monday = today - timedelta(days=6)
    else:
        # Lunedì-Sabato -> mostra settimana corrente
        monday = today - timedelta(days=current_day)
    
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    sunday = monday + timedelta(days=6)
    
    # Get date strings for the week (Mon-Sun)
    week_dates = []
    for i in range(7):
        d = monday + timedelta(days=i)
        week_dates.append(d.strftime("%Y-%m-%d"))
    
    # Count total confirmed bookings (presenze)
    presenze = await db.bookings.count_documents({
        "data_lezione": {"$in": week_dates},
        "confermata": True
    })
    
    # Count lessons that have been actually deducted (lezione_scalata = true)
    lezioni_scalate = await db.bookings.count_documents({
        "data_lezione": {"$in": week_dates},
        "confermata": True,
        "lezione_scalata": True
    })
    
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
    """Get top 5 positions by workouts - mostra la settimana CORRENTE.
    TUTTE le posizioni sono sempre presenti (1°, 2°, 3°, 4°, 5°).
    Le posizioni sono basate sul NUMERO di allenamenti:
    - 1° = chi ha fatto più allenamenti
    - 2° = chi ha fatto il secondo numero più alto
    - ecc.
    Più persone possono essere nella stessa posizione (pari merito).
    """
    today = now_rome()
    current_day = today.weekday()
    
    # Calcola lunedì della settimana CORRENTE
    monday = today - timedelta(days=current_day)
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    saturday = monday + timedelta(days=5)
    saturday_str = saturday.strftime("%Y-%m-%d")
    
    # Controlla se le lezioni del sabato di QUESTA settimana sono state scalate
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
    
    return {
        "leaderboard": leaderboard,
        "settimana": f"{monday.strftime('%d/%m')} - {saturday.strftime('%d/%m')}",
        "total_participants": len(leaderboard),
        "status": "ready"
    }


# ======================== WEEKLY BOOKINGS VIEW (ADMIN ONLY) ========================

@api_router.get("/admin/weekly-bookings")
async def get_weekly_bookings(admin_user: dict = Depends(get_admin_user)):
    """Get all bookings for the current week grouped by lesson - OPTIMIZED"""
    # Calculate current week (Mon-Sat)
    today = now_rome()
    current_day = today.weekday()  # 0 = Monday
    
    # If it's Saturday after 7 AM or Sunday, show next week
    if current_day == 5 and today.hour >= 7:  # Saturday after 7 AM
        days_until_monday = 2
        monday = today + timedelta(days=days_until_monday)
    elif current_day == 6:  # Sunday
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
    
    # Get all lessons
    lessons = await db.lessons.find().to_list(100)
    
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
    """Get dashboard statistics for admin - OPTIMIZED"""
    if current_user.get("role") != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    
    today = today_rome()
    now = now_rome()
    
    # Stats - Conta utenti non archiviati
    total_users = await db.users.count_documents({"role": "client", "archived": {"$ne": True}})
    
    # Carica TUTTI gli utenti archiviati in un set per lookup veloce
    archived_users = await db.users.find({"archived": True}, {"_id": 1}).to_list(1000)
    archived_user_ids = set(str(u["_id"]) for u in archived_users)
    
    # Conta abbonamenti REALMENTE attivi (non scaduti per data e non esauriti per lezioni)
    all_active_subs = await db.subscriptions.find({"attivo": True}).to_list(1000)
    active_subscriptions = 0
    
    for sub in all_active_subs:
        # Skip se utente archiviato (lookup O(1) nel set)
        if sub["user_id"] in archived_user_ids:
            continue
        
        # Verifica scadenza per data
        data_scadenza = sub.get("data_scadenza")
        if isinstance(data_scadenza, str):
            from dateutil import parser
            data_scadenza = parser.parse(data_scadenza).replace(tzinfo=ROME_TZ)
        
        is_expired = data_scadenza < now if data_scadenza else False
        
        # Verifica lezioni esaurite (per abbonamenti a pacchetto)
        if sub.get("lezioni_rimanenti") is not None and sub["lezioni_rimanenti"] <= 0:
            is_expired = True
        
        if not is_expired:
            active_subscriptions += 1
    
    bookings_today = await db.bookings.count_documents({"data_lezione": today, "confermata": True})
    
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

# ======================== AUTOMATIC LESSON PROCESSING ========================

async def process_lessons_after_30min():
    """Process bookings 30 minutes after each lesson starts - deduct lessons from subscriptions"""
    now = now_rome()
    today = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M")
    
    # Calculate time 30 minutes ago
    time_30min_ago = (now - timedelta(minutes=30)).strftime("%H:%M")
    
    logger.info(f"[SCHEDULER] Checking lessons that started around {time_30min_ago}")
    
    # Find all lessons for today
    lessons = await db.lessons.find({}).to_list(100)
    
    for lesson in lessons:
        lesson_time = lesson["orario"]
        
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
                    "tipo": {"$in": ["lezioni_8", "lezioni_16"]},
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
            "tipo": {"$in": ["lezioni_8", "lezioni_16"]},
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
    
    result = []
    for notif in notifications:
        try:
            user = await db.users.find_one({"_id": ObjectId(notif["user_id"])})
        except:
            user = None
        
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
        user = await db.users.find_one({"_id": ObjectId(user_id)})
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
        user = await db.users.find_one({"_id": ObjectId(user_id)})
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
        
        hashed_password = pwd_context.hash(data.new_password)
        
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
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="Utente non trovato")
        
        # Non permettere reset password di altri admin
        if user.get("role") == UserRole.ADMIN and str(user["_id"]) != str(admin_user["_id"]):
            raise HTTPException(status_code=400, detail="Non puoi resettare la password di un altro admin")
        
        # Valida la nuova password
        if len(data.new_password) < 6:
            raise HTTPException(status_code=400, detail="La password deve essere di almeno 6 caratteri")
        
        # Hash della nuova password
        hashed_password = pwd_context.hash(data.new_password)
        
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
    """
    # Verifica che sia un istruttore o admin
    if current_user.get("role") not in [UserRole.ISTRUTTORE, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Accesso riservato agli istruttori")
    
    today = now_rome()
    current_day = today.weekday()
    monday = today - timedelta(days=current_day)
    
    # Genera date della settimana (lun-sab)
    week_dates = [(monday + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6)]
    
    # Query parallele per velocizzare
    all_lessons, bookings = await asyncio.gather(
        db.lessons.find({}, {"_id": 1, "giorno": 1, "orario": 1, "tipo_attivita": 1, "coach": 1}).to_list(100),
        db.bookings.find(
            {"data_lezione": {"$in": week_dates}, "confermata": True},
            {"user_id": 1, "lesson_id": 1, "data_lezione": 1, "lezione_scalata": 1}
        ).to_list(1000)
    )
    
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
        "tipo": {"$in": ["lezioni_8", "lezioni_16"]},
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


# ==================== LOTTERIA PREMI ====================

import random

async def get_users_with_active_subscription() -> set:
    """Restituisce gli user_id degli utenti con abbonamento attivo"""
    now = now_rome()
    active_user_ids = set()
    
    # Ottieni tutti gli abbonamenti attivi
    subscriptions = await db.subscriptions.find({"attivo": True}).to_list(1000)
    
    for sub in subscriptions:
        is_expired = sub["data_scadenza"] < now
        # Per abbonamenti a pacchetto, controlla anche le lezioni rimanenti
        if sub.get("lezioni_rimanenti") is not None and sub["lezioni_rimanenti"] <= 0:
            is_expired = True
        
        if not is_expired:
            active_user_ids.add(sub["user_id"])
    
    return active_user_ids


async def run_lottery_extraction():
    """Esegue l'estrazione della lotteria - SOLO per utenti con abbonamento attivo"""
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
    
    # Filtra chi ha almeno 1 biglietto
    partecipanti = [{"_id": uid, "biglietti": b} for uid, b in biglietti_per_utente.items() if b >= 1]
    
    if not partecipanti:
        logger.warning("[LOTTERY] Nessun partecipante con biglietti")
        return None
    
    # Crea lista pesata (più biglietti = più possibilità, ma estrazione CASUALE)
    pool = []
    for p in partecipanti:
        pool.extend([p["_id"]] * p["biglietti"])
    
    # ESTRAZIONE CASUALE - random.choice seleziona a caso dalla pool
    winner_id = random.choice(pool)
    winner = await db.users.find_one({"_id": ObjectId(winner_id)})
    
    if winner:
        winner_biglietti = next((p["biglietti"] for p in partecipanti if p["_id"] == winner_id), 0)
        
        # Ottieni premio del mese se impostato
        prize = await db.lottery_prizes.find_one({"mese": current_month})
        
        winner_data = {
            "mese": current_month,
            "mese_riferimento": prev_month_str,
            "user_id": winner_id,
            "nome": winner.get("nome"),
            "cognome": winner.get("cognome"),
            "soprannome": winner.get("soprannome"),
            "biglietti": winner_biglietti,
            "totale_partecipanti": len(partecipanti),
            "totale_biglietti": len(pool),
            "data_estrazione": now_rome(),
            "premio": prize.get("premio") if prize else None,
            "premio_descrizione": prize.get("descrizione") if prize else None,
            "premio_ritirato": False,
            "estrazione_automatica": True
        }
        await db.lottery_winners.insert_one(winner_data)
        logger.info(f"[LOTTERY] VINCITORE ESTRATTO AUTOMATICAMENTE: {winner.get('nome')} {winner.get('cognome')} con {winner_biglietti} biglietti su {len(pool)} totali")
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
    """Ottieni stato lotteria: biglietti utente, vincitore"""
    now = datetime.now(ROME_TZ)
    current_month = now.strftime("%Y-%m")
    
    # ESTRAZIONE AUTOMATICA: Controlla se è il momento e esegui se necessario
    await check_and_run_lottery()
    
    # Calcola biglietti utente nel mese corrente
    start_date = f"{current_month}-01"
    next_month = now.month + 1 if now.month < 12 else 1
    next_year = now.year if now.month < 12 else now.year + 1
    end_date = f"{next_year}-{next_month:02d}-01"
    
    user_id = str(current_user["_id"])
    
    # Biglietti da allenamenti
    biglietti_allenamenti = await db.bookings.count_documents({
        "user_id": user_id,
        "data_lezione": {"$gte": start_date, "$lt": end_date},
        "lezione_scalata": True
    })
    
    # Biglietti bonus dalla ruota della fortuna
    wheel_doc = await db.wheel_tickets.find_one({"user_id": user_id, "mese": current_month})
    biglietti_ruota = wheel_doc.get("biglietti", 0) if wheel_doc else 0
    
    # Totale biglietti = allenamenti + bonus ruota
    biglietti = biglietti_allenamenti + biglietti_ruota
    
    # Verifica se l'utente ha abbonamento attivo (per partecipare alla lotteria)
    active_users = await get_users_with_active_subscription()
    ha_abbonamento_attivo = user_id in active_users
    
    # Ottieni vincitore corrente (estratto questo mese, riferito al mese scorso)
    winner = await db.lottery_winners.find_one({"mese": current_month})
    
    # Calcola prossima estrazione (1° del prossimo mese alle 12:00)
    if now.month == 12:
        next_extraction = datetime(now.year + 1, 1, 1, 12, 0, 0, tzinfo=ROME_TZ)
    else:
        next_extraction = datetime(now.year, now.month + 1, 1, 12, 0, 0, tzinfo=ROME_TZ)
    
    seconds_to_extraction = int((next_extraction - now).total_seconds())
    
    return {
        "biglietti_utente": biglietti,
        "mese_corrente": current_month,
        "ha_abbonamento_attivo": ha_abbonamento_attivo,
        "vincitore": {
            "nome": winner.get("nome"),
            "cognome": winner.get("cognome"),
            "soprannome": winner.get("soprannome"),
            "biglietti": winner.get("biglietti"),
            "mese_riferimento": winner.get("mese_riferimento"),
            "totale_partecipanti": winner.get("totale_partecipanti"),
            "totale_biglietti": winner.get("totale_biglietti"),
            "data_estrazione": winner.get("data_estrazione").isoformat() if winner.get("data_estrazione") else None,
            "premio": winner.get("premio"),
            "premio_descrizione": winner.get("premio_descrizione"),
            "premio_ritirato": winner.get("premio_ritirato", False),
            "is_me": winner.get("user_id") == user_id
        } if winner else None,
        "prossima_estrazione": next_extraction.isoformat(),
        "secondi_a_estrazione": max(0, seconds_to_extraction),
        "estrazione_fatta": winner is not None
    }


@api_router.get("/lottery/winners")
async def get_lottery_winners(current_user: dict = Depends(get_current_user)):
    """Ottieni storico vincitori"""
    winners = await db.lottery_winners.find().sort("data_estrazione", -1).to_list(12)
    return [{
        "mese": w.get("mese"),
        "mese_riferimento": w.get("mese_riferimento"),
        "nome": w.get("nome"),
        "cognome": w.get("cognome"),
        "biglietti": w.get("biglietti"),
        "totale_partecipanti": w.get("totale_partecipanti"),
        "data_estrazione": w.get("data_estrazione").isoformat() if w.get("data_estrazione") else None
    } for w in winners]


@api_router.post("/admin/lottery/extract-winner")
async def extract_winner(admin_user: dict = Depends(get_admin_user)):
    """Estrai manualmente il vincitore del mese (admin only) - SOLO abbonati attivi"""
    now = datetime.now(ROME_TZ)
    current_month = now.strftime("%Y-%m")
    
    # Controlla se l'estrazione di questo mese è già stata fatta
    existing = await db.lottery_winners.find_one({"mese": current_month})
    if existing:
        raise HTTPException(status_code=400, detail=f"Estrazione di {current_month} già effettuata! Vincitore: {existing.get('nome')} {existing.get('cognome')}")
    
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
    
    # Filtra chi ha almeno 1 biglietto
    partecipanti = [{"_id": uid, "biglietti": b} for uid, b in biglietti_per_utente.items() if b >= 1]
    
    if not partecipanti:
        raise HTTPException(status_code=400, detail="Nessun partecipante! Nessun abbonato attivo si è allenato il mese scorso.")
    
    # Crea lista pesata (più biglietti = più possibilità, ma CASUALE)
    pool = []
    for p in partecipanti:
        pool.extend([p["_id"]] * p["biglietti"])
    
    # ESTRAZIONE CASUALE
    winner_id = random.choice(pool)
    winner = await db.users.find_one({"_id": ObjectId(winner_id)})
    
    if not winner:
        raise HTTPException(status_code=500, detail="Errore nell'estrazione")
    
    winner_biglietti = next((p["biglietti"] for p in partecipanti if p["_id"] == winner_id), 0)
    
    # Ottieni premio del mese se impostato
    prize = await db.lottery_prizes.find_one({"mese": current_month})
    
    winner_data = {
        "mese": current_month,
        "mese_riferimento": prev_month_str,
        "user_id": winner_id,
        "nome": winner.get("nome"),
        "cognome": winner.get("cognome"),
        "soprannome": winner.get("soprannome"),
        "biglietti": winner_biglietti,
        "totale_partecipanti": len(partecipanti),
        "totale_biglietti": len(pool),
        "data_estrazione": now_rome(),
        "premio": prize.get("premio") if prize else None,
        "premio_descrizione": prize.get("descrizione") if prize else None,
        "premio_ritirato": False,
        "estratto_da": str(admin_user["_id"]),
        "estrazione_automatica": False
    }
    await db.lottery_winners.insert_one(winner_data)
    logger.info(f"[LOTTERY] Vincitore estratto MANUALMENTE da admin: {winner.get('nome')} {winner.get('cognome')}")
    
    return {
        "message": "Estrazione completata!",
        "vincitore": {
            "nome": winner.get("nome"),
            "cognome": winner.get("cognome"),
            "biglietti": winner_biglietti,
            "totale_partecipanti": len(partecipanti),
            "totale_biglietti": len(pool)
        }
    }


@api_router.post("/admin/lottery/mark-prize-collected/{mese}")
async def mark_prize_collected(mese: str, admin_user: dict = Depends(get_admin_user)):
    """Segna il premio come ritirato"""
    result = await db.lottery_winners.update_one(
        {"mese": mese},
        {"$set": {"premio_ritirato": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Vincitore non trovato")
    return {"message": "Premio segnato come ritirato"}


class SetPrizeRequest(BaseModel):
    premio: str
    descrizione: Optional[str] = None


@api_router.post("/admin/lottery/set-prize")
async def set_monthly_prize(data: SetPrizeRequest, admin_user: dict = Depends(get_admin_user)):
    """Imposta il premio del mese corrente"""
    now = datetime.now(ROME_TZ)
    current_month = now.strftime("%Y-%m")
    
    await db.lottery_prizes.update_one(
        {"mese": current_month},
        {"$set": {
            "mese": current_month,
            "premio": data.premio,
            "descrizione": data.descrizione,
            "updated_at": now_rome(),
            "updated_by": str(admin_user["_id"])
        }},
        upsert=True
    )
    
    logger.info(f"[LOTTERY] Premio del mese impostato: {data.premio}")
    return {"message": "Premio impostato", "premio": data.premio}


@api_router.get("/lottery/current-prize")
async def get_current_prize():
    """Ottieni il premio del mese corrente (pubblico)"""
    now = datetime.now(ROME_TZ)
    current_month = now.strftime("%Y-%m")
    
    prize = await db.lottery_prizes.find_one({"mese": current_month})
    if prize:
        return {
            "premio": prize.get("premio"),
            "descrizione": prize.get("descrizione"),
            "mese": current_month
        }
    return {"premio": None, "descrizione": None, "mese": current_month}


@api_router.get("/lottery/current-winner")
async def get_current_winner(current_user: dict = Depends(get_current_user)):
    """Ottieni il vincitore del mese corrente - VISIBILE A TUTTI GLI UTENTI"""
    now = datetime.now(ROME_TZ)
    current_month = now.strftime("%Y-%m")
    
    # Controlla estrazione automatica
    await check_and_run_lottery()
    
    winner = await db.lottery_winners.find_one({"mese": current_month})
    
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
    
    # Controlla se ha già girato oggi
    spin_today = await db.wheel_spins.find_one({
        "user_id": user_id,
        "data": today
    })
    
    if spin_today:
        return {
            "can_spin": False,
            "reason": "already_spun",
            "last_result": spin_today.get("premio"),
            "message": "Hai già girato! Torna dopo il prossimo allenamento 🎰"
        }
    
    # Controlla se ha fatto almeno un allenamento oggi (confermato e scalato)
    allenamento_oggi = await db.bookings.find_one({
        "user_id": user_id,
        "data_lezione": today,
        "lezione_scalata": True
    })
    
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


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Start the scheduler and create MongoDB indexes for performance"""
    
    # Creazione indici MongoDB per ottimizzare le query
    try:
        await db.users.create_index("email", unique=True)
        await db.subscriptions.create_index([("user_id", 1), ("attivo", 1)])
        await db.subscriptions.create_index("data_scadenza")
        await db.bookings.create_index([("user_id", 1), ("data_lezione", 1)])
        await db.bookings.create_index([("lesson_id", 1), ("data_lezione", 1)])
        await db.bookings.create_index("data_lezione")
        await db.lessons.create_index("giorno")
        await db.log_ingressi.create_index([("user_id", 1), ("data_lezione", 1)])
        await db.blocked_dates.create_index("data", unique=True)
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
            
            # Trova prenotazioni di oggi non ancora scalate
            bookings = await db.bookings.find({
                "data_lezione": oggi,
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
                    
                if ora_corrente < orario_lezione:
                    logger.info(f"[AUTO-PROCESS] Lezione {orario_lezione} non ancora iniziata (ora: {ora_corrente})")
                    continue
                
                user_id = booking["user_id"]
                logger.info(f"[AUTO-PROCESS] Processando booking user {user_id}, lezione {orario_lezione}")
                
                # Cerca abbonamento a PACCHETTO
                sub_pacchetto = await db.subscriptions.find_one({
                    "user_id": user_id,
                    "attivo": True,
                    "tipo": {"$in": ["lezioni_8", "lezioni_16"]},
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
