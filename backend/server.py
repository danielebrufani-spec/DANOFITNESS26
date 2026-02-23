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
from datetime import datetime, timedelta, date
from passlib.context import CryptContext
import jwt
from bson import ObjectId
from enum import Enum
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import asyncio
from pywebpush import webpush, WebPushException
import json

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

# Scheduler for automatic tasks
scheduler = AsyncIOScheduler()

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

# ======================== MODELS ========================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    nome: str
    cognome: str
    telefono: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    nome: str
    cognome: str
    telefono: Optional[str] = None
    role: str
    created_at: datetime
    push_token: Optional[str] = None
    profile_image: Optional[str] = None

class SubscriptionCreate(BaseModel):
    user_id: str
    tipo: SubscriptionType
    data_inizio: Optional[datetime] = None
    lezioni_rimanenti: Optional[int] = None  # Allow setting initial lessons

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

# ======================== HELPER FUNCTIONS ========================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token non valido")
        user = await db.users.find_one({"_id": ObjectId(user_id)})
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
        "role": UserRole.CLIENT,
        "push_token": None,
        "created_at": datetime.utcnow()
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
    user = await db.users.find_one({"email": login_data.email.lower()})
    if not user or not verify_password(login_data.password, user["password"]):
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
            push_token=user.get("push_token")
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
        profile_image=current_user.get("profile_image")
    )

@api_router.put("/auth/push-token")
async def update_push_token(data: PushTokenUpdate, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"push_token": data.push_token}}
    )
    return {"message": "Token push aggiornato"}

class ProfileImageUpdate(BaseModel):
    profile_image: str

@api_router.put("/auth/profile-image")
async def update_profile_image(data: ProfileImageUpdate, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"profile_image": data.profile_image}}
    )
    return {"message": "Immagine profilo aggiornata"}

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
    
    start_date = data.data_inizio or datetime.utcnow()
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
        "created_at": datetime.utcnow()
    }
    
    result = await db.subscriptions.insert_one(subscription)
    
    is_expired = expiry_date < datetime.utcnow()
    
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
    
    result = []
    for sub in subscriptions:
        is_expired = sub["data_scadenza"] < datetime.utcnow()
        # Also check if lezioni_rimanenti is 0 for lesson-based subscriptions
        if sub["lezioni_rimanenti"] is not None and sub["lezioni_rimanenti"] <= 0:
            is_expired = True
        
        result.append(SubscriptionResponse(
            id=str(sub["_id"]),
            user_id=sub["user_id"],
            user_nome=current_user["nome"],
            user_cognome=current_user["cognome"],
            tipo=sub["tipo"],
            lezioni_rimanenti=sub["lezioni_rimanenti"],
            data_inizio=sub["data_inizio"],
            data_scadenza=sub["data_scadenza"],
            attivo=sub["attivo"],
            scaduto=is_expired,
            created_at=sub["created_at"]
        ))
    
    return result

@api_router.get("/subscriptions", response_model=List[SubscriptionResponse])
async def get_all_subscriptions(admin_user: dict = Depends(get_admin_user)):
    subscriptions = await db.subscriptions.find().to_list(1000)
    
    result = []
    for sub in subscriptions:
        try:
            user = await db.users.find_one({"_id": ObjectId(sub["user_id"])})
        except:
            user = None
        
        is_expired = sub["data_scadenza"] < datetime.utcnow()
        if sub["lezioni_rimanenti"] is not None and sub["lezioni_rimanenti"] <= 0:
            is_expired = True
        
        result.append(SubscriptionResponse(
            id=str(sub["_id"]),
            user_id=sub["user_id"],
            user_nome=user["nome"] if user else "Sconosciuto",
            user_cognome=user["cognome"] if user else "",
            tipo=sub["tipo"],
            lezioni_rimanenti=sub["lezioni_rimanenti"],
            data_inizio=sub["data_inizio"],
            data_scadenza=sub["data_scadenza"],
            attivo=sub["attivo"],
            scaduto=is_expired,
            created_at=sub["created_at"]
        ))
    
    return result

@api_router.get("/subscriptions/expired", response_model=List[SubscriptionResponse])
async def get_expired_subscriptions(admin_user: dict = Depends(get_admin_user)):
    now = datetime.utcnow()
    
    # Get all subscriptions and filter expired ones
    all_subs = await db.subscriptions.find({"attivo": True}).to_list(1000)
    
    result = []
    for sub in all_subs:
        is_expired = sub["data_scadenza"] < now
        if sub["lezioni_rimanenti"] is not None and sub["lezioni_rimanenti"] <= 0:
            is_expired = True
        
        if is_expired:
            try:
                user = await db.users.find_one({"_id": ObjectId(sub["user_id"])})
            except:
                user = None
            
            result.append(SubscriptionResponse(
                id=str(sub["_id"]),
                user_id=sub["user_id"],
                user_nome=user["nome"] if user else "Sconosciuto",
                user_cognome=user["cognome"] if user else "",
                tipo=sub["tipo"],
                lezioni_rimanenti=sub["lezioni_rimanenti"],
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
    
    is_expired = updated_sub["data_scadenza"] < datetime.utcnow()
    if updated_sub["lezioni_rimanenti"] is not None and updated_sub["lezioni_rimanenti"] <= 0:
        is_expired = True
    
    return SubscriptionResponse(
        id=str(updated_sub["_id"]),
        user_id=updated_sub["user_id"],
        user_nome=user["nome"] if user else "Sconosciuto",
        user_cognome=user["cognome"] if user else "",
        tipo=updated_sub["tipo"],
        lezioni_rimanenti=updated_sub["lezioni_rimanenti"],
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
    
    # Check if lesson is passed (with 1 hour buffer)
    # Lesson is bookable until 1 hour after start
    try:
        lesson_date = datetime.strptime(data.data_lezione, "%Y-%m-%d")
        lesson_time_parts = lesson["orario"].split(":")
        lesson_hour = int(lesson_time_parts[0])
        lesson_minute = int(lesson_time_parts[1]) if len(lesson_time_parts) > 1 else 0
        lesson_datetime = lesson_date.replace(hour=lesson_hour, minute=lesson_minute)
        
        # Add 1 hour buffer
        cutoff_time = lesson_datetime + timedelta(hours=1)
        
        if datetime.utcnow() > cutoff_time:
            raise HTTPException(status_code=400, detail="Non puoi prenotare una lezione già passata")
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
    
    # Check subscription status
    now = datetime.utcnow()
    subscriptions = await db.subscriptions.find({
        "user_id": user_id,
        "attivo": True
    }).to_list(100)
    
    abbonamento_scaduto = True
    for sub in subscriptions:
        is_expired = sub["data_scadenza"] < now
        if sub["lezioni_rimanenti"] is not None and sub["lezioni_rimanenti"] <= 0:
            is_expired = True
        if not is_expired:
            abbonamento_scaduto = False
            break
    
    booking = {
        "user_id": user_id,
        "lesson_id": data.lesson_id,
        "data_lezione": data.data_lezione,
        "abbonamento_scaduto": abbonamento_scaduto,
        "confermata": True,
        "lezione_scalata": False,
        "created_at": datetime.utcnow()
    }
    
    result = await db.bookings.insert_one(booking)
    
    return BookingResponse(
        id=str(result.inserted_id),
        user_id=user_id,
        user_nome=current_user["nome"],
        user_cognome=current_user["cognome"],
        lesson_id=data.lesson_id,
        lesson_info={
            "giorno": lesson["giorno"],
            "orario": lesson["orario"],
            "tipo_attivita": lesson["tipo_attivita"]
        },
        data_lezione=data.data_lezione,
        abbonamento_scaduto=abbonamento_scaduto,
        confermata=True,
        lezione_scalata=False,
        created_at=booking["created_at"]
    )

@api_router.get("/bookings/me", response_model=List[BookingResponse])
async def get_my_bookings(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    bookings = await db.bookings.find({"user_id": user_id}).sort("data_lezione", -1).to_list(100)
    
    result = []
    for booking in bookings:
        try:
            lesson = await db.lessons.find_one({"_id": ObjectId(booking["lesson_id"])})
        except:
            lesson = None
        
        result.append(BookingResponse(
            id=str(booking["_id"]),
            user_id=booking["user_id"],
            user_nome=current_user["nome"],
            user_cognome=current_user["cognome"],
            lesson_id=booking["lesson_id"],
            lesson_info={
                "giorno": lesson["giorno"] if lesson else "",
                "orario": lesson["orario"] if lesson else "",
                "tipo_attivita": lesson["tipo_attivita"] if lesson else ""
            } if lesson else None,
            data_lezione=booking["data_lezione"],
            abbonamento_scaduto=booking.get("abbonamento_scaduto", False),
            confermata=booking.get("confermata", True),
            lezione_scalata=booking.get("lezione_scalata", False),
            created_at=booking["created_at"]
        ))
    
    return result

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

@api_router.get("/bookings/day/{date}", response_model=List[BookingResponse])
async def get_bookings_by_date(date: str, admin_user: dict = Depends(get_admin_user)):
    bookings = await db.bookings.find({"data_lezione": date}).to_list(1000)
    
    result = []
    for booking in bookings:
        try:
            user = await db.users.find_one({"_id": ObjectId(booking["user_id"])})
            lesson = await db.lessons.find_one({"_id": ObjectId(booking["lesson_id"])})
        except:
            user = None
            lesson = None
        
        result.append(BookingResponse(
            id=str(booking["_id"]),
            user_id=booking["user_id"],
            user_nome=user["nome"] if user else "Sconosciuto",
            user_cognome=user["cognome"] if user else "",
            lesson_id=booking["lesson_id"],
            lesson_info={
                "giorno": lesson["giorno"] if lesson else "",
                "orario": lesson["orario"] if lesson else "",
                "tipo_attivita": lesson["tipo_attivita"] if lesson else ""
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
    users = await db.users.find().to_list(1000)
    return [
        UserResponse(
            id=str(user["_id"]),
            email=user["email"],
            nome=user["nome"],
            cognome=user["cognome"],
            telefono=user.get("telefono"),
            role=user["role"],
            created_at=user["created_at"],
            push_token=user.get("push_token"),
            profile_image=user.get("profile_image")
        ) for user in users
    ]

@api_router.get("/admin/daily-stats/{date}", response_model=DailyStats)
async def get_daily_stats(date: str, admin_user: dict = Depends(get_admin_user)):
    bookings = await db.bookings.find({"data_lezione": date}).to_list(1000)
    
    prenotazioni_per_lezione = {}
    for booking in bookings:
        try:
            lesson = await db.lessons.find_one({"_id": ObjectId(booking["lesson_id"])})
            if lesson:
                key = f"{lesson['orario']} - {lesson['tipo_attivita']}"
                if key not in prenotazioni_per_lezione:
                    prenotazioni_per_lezione[key] = 0
                prenotazioni_per_lezione[key] += 1
        except:
            pass
    
    # Count expired subscriptions
    now = datetime.utcnow()
    all_subs = await db.subscriptions.find({"attivo": True}).to_list(1000)
    abbonamenti_scaduti = 0
    for sub in all_subs:
        is_expired = sub["data_scadenza"] < now
        if sub["lezioni_rimanenti"] is not None and sub["lezioni_rimanenti"] <= 0:
            is_expired = True
        if is_expired:
            abbonamenti_scaduti += 1
    
    return DailyStats(
        data=date,
        totale_prenotazioni=len(bookings),
        prenotazioni_per_lezione=prenotazioni_per_lezione,
        abbonamenti_scaduti=abbonamenti_scaduti
    )

@api_router.post("/admin/process-day/{date}")
async def process_end_of_day(date: str, admin_user: dict = Depends(get_admin_user)):
    """Process end of day: deduct lessons from per-lesson subscriptions"""
    bookings = await db.bookings.find({
        "data_lezione": date,
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
                    "created_at": datetime.utcnow()
                }
                await db.notifications.insert_one(notification)
    
    return {"message": f"Elaborate {processed} prenotazioni", "processed": processed}

# ======================== WEEKLY BOOKINGS VIEW (ADMIN ONLY) ========================

@api_router.get("/admin/weekly-bookings")
async def get_weekly_bookings(admin_user: dict = Depends(get_admin_user)):
    """Get all bookings for the current week grouped by lesson"""
    # Calculate current week (Mon-Sat)
    today = datetime.utcnow()
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
            lesson_bookings = [b for b in date_bookings if b["lesson_id"] == lesson_id]
            
            # Get user details for each booking
            participants = []
            for booking in lesson_bookings:
                try:
                    user = await db.users.find_one({"_id": ObjectId(booking["user_id"])})
                    if user:
                        participants.append({
                            "booking_id": str(booking["_id"]),
                            "user_id": booking["user_id"],
                            "nome": user["nome"],
                            "cognome": user["cognome"],
                            "abbonamento_scaduto": booking.get("abbonamento_scaduto", False),
                            "lezione_scalata": booking.get("lezione_scalata", False)
                        })
                except:
                    pass
            
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

# ======================== AUTOMATIC MIDNIGHT PROCESSING ========================

async def process_day_automatically():
    """Automatically process bookings at midnight - deduct lessons from subscriptions"""
    # Get yesterday's date (the day that just ended)
    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    
    logger.info(f"[SCHEDULER] Processing bookings for {yesterday}")
    
    bookings = await db.bookings.find({
        "data_lezione": yesterday,
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
                notification = {
                    "user_id": user_id,
                    "tipo": "abbonamento_esaurito",
                    "messaggio": f"Il tuo abbonamento {sub['tipo']} è esaurito. Rinnova per continuare a prenotare.",
                    "letta": False,
                    "created_at": datetime.utcnow()
                }
                await db.notifications.insert_one(notification)
    
    logger.info(f"[SCHEDULER] Processed {processed} bookings for {yesterday}")
    
    # Log the processing
    await db.processing_logs.insert_one({
        "data": yesterday,
        "processed": processed,
        "timestamp": datetime.utcnow()
    })

@api_router.get("/admin/processing-logs")
async def get_processing_logs(admin_user: dict = Depends(get_admin_user)):
    """Get logs of automatic processing"""
    logs = await db.processing_logs.find().sort("timestamp", -1).to_list(30)
    return [
        {
            "data": log["data"],
            "processed": log["processed"],
            "timestamp": log["timestamp"].isoformat()
        } for log in logs
    ]

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
        "created_at": datetime.utcnow(),
        "replies": [],
        "is_admin_message": True
    }
    
    result = await db.messages.insert_one(message_doc)
    
    # Send push notification to all users
    users = await db.users.find({"role": "client", "push_subscription": {"$exists": True}}).to_list(1000)
    for user in users:
        await send_push_notification(
            str(user["_id"]),
            "Nuova Comunicazione",
            message.content[:100] + "..." if len(message.content) > 100 else message.content
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
    
    result = []
    for msg in messages:
        sender = await db.users.find_one({"_id": ObjectId(msg["sender_id"])})
        
        replies = []
        for reply in msg.get("replies", []):
            reply_user = await db.users.find_one({"_id": ObjectId(reply["user_id"])})
            if reply_user:
                replies.append(ReplyResponse(
                    id=reply["id"],
                    user_id=reply["user_id"],
                    user_nome=reply_user["nome"],
                    user_cognome=reply_user["cognome"],
                    user_profile_image=reply_user.get("profile_image"),
                    content=reply["content"],
                    created_at=reply["created_at"]
                ))
        
        result.append(MessageResponse(
            id=str(msg["_id"]),
            sender_id=msg["sender_id"],
            sender_nome=sender["nome"] if sender else "Admin",
            sender_cognome=sender["cognome"] if sender else "",
            sender_profile_image=sender.get("profile_image") if sender else None,
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
        "created_at": datetime.utcnow()
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
            
            webpush(
                subscription_info=subscription,
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": f"mailto:{VAPID_EMAIL}"}
            )
            
            logger.info(f"[WEB PUSH] Notification sent to user {user_id}: {title}")
            sent = True
        except WebPushException as e:
            logger.error(f"[WEB PUSH] Failed to send notification to user {user_id}: {e}")
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
    
    now = datetime.utcnow()
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
        "created_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(admin_user)
    return {"message": "Admin creato", "admin_id": str(result.inserted_id)}

@api_router.get("/")
async def root():
    return {"message": "DanoFitness23 API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "DanoFitness23 API"}

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
    """Start the scheduler for automatic midnight processing"""
    # Schedule the job to run at midnight (00:00) every day
    scheduler.add_job(
        process_day_automatically,
        CronTrigger(hour=0, minute=0),  # Run at midnight
        id="midnight_processing",
        replace_existing=True
    )
    
    # Schedule subscription expiration check at 9:00 AM every day
    scheduler.add_job(
        check_expiring_subscriptions,
        CronTrigger(hour=9, minute=0),  # Run at 9 AM
        id="subscription_expiration_check",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("[SCHEDULER] Started automatic midnight processing scheduler")
    logger.info("[SCHEDULER] Started subscription expiration check scheduler (9:00 AM daily)")

@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown()
    client.close()
