# DANOFITNESS26 - Product Requirements Document

## Problem Statement
Fitness application for "DANOFITNESS26" gym. Full-stack app with React Native (Expo) frontend and FastAPI backend using MongoDB. Features user management, class booking, gamification (lottery, wheel of fortune, quiz), and an admin panel with AI nutrition plans.

## Tech Stack
- **Frontend:** React Native (Expo 54), TypeScript, expo-router
- **Backend:** Python, FastAPI
- **Database:** MongoDB (motor async driver)
- **AI:** OpenAI GPT via emergentintegrations (Emergent LLM Key)
- **Deployment:** Vercel (frontend), Render (backend)

## Code Architecture
```
/app
├── backend/
│   ├── .env (MONGO_URL, DB_NAME, EMERGENT_LLM_KEY)
│   ├── server.py (monolith)
│   └── requirements.txt
└── frontend/
    ├── .env (REACT_APP_BACKEND_URL, EXPO_PUBLIC_BACKEND_URL)
    ├── app/(tabs)/ (_layout, home, admin, alimentazione, prenota, premi, profilo, etc.)
    ├── src/context/AuthContext.tsx
    ├── src/services/api.ts
    └── src/utils/constants.ts
```

## Completed Features

### Core
- User auth (JWT), admin panel, class booking system
- Subscription management (lesson-based + time-based, paid/unpaid tracking)
- Gamification: weekly leaderboard, lottery, wheel of fortune, quiz with timer
- Push notifications (Expo + Web), Chat/communications system
- Consigli del Maestro + Consigli Musicali (Spotify)
- Archived user lockout

### AI Nutrition (March 2026)
- "Alimentazione" tab with AI-generated monthly meal plans (GPT via emergentintegrations)
- User nutritional profile (weight, height, goals, intolerances)
- Admin "Dieta AI" tab showing profiles count, plans count, plan details
- Home banner inviting clients to create their plan (persistent until done)

### Performance Optimizations (March 2026)
1. MongoDB Indexes on major collections
2. GZip Compression (min 500 bytes)
3. In-Memory Cache (SimpleCache with TTL): Lessons 5min, Blocked dates 1min
4. Batch Query Fixes (N+1 → batch): notifications, lottery users
5. Parallel Queries (asyncio.gather): dashboard, livello, lottery, weekly-stats, nutrition, quiz, wheel
6. Query Projections on admin user lookups
7. profile_image exclusion from bulk queries

### UI/UX (March 2026)
- "Dieta AI" tab positioned 2nd (after Home) with red colored icon (#FF6B6B)
- Prominent nutrition banner on Home with red accent (visible until plan created)
- Admin "Dieta AI" tab with stats and plan list

### Environment Fix (March 2026)
- Fixed EXPO_PUBLIC_BACKEND_URL not being baked into static export
- Added window.location fallback for preview environment detection

## Upcoming Tasks (P1)
- "Porta un Amico" (Refer a Friend) system
- Streak Bonuses (+1 ticket for 3 consecutive training days)
- Milestone Bonuses (+5 tickets for 50 total lessons)

## Future/Backlog (P2)
- Instagram Integration for Bonuses
- UI/UX Graphic Enhancements (dark/light mode, visual calendar, stats page)
- Update outdated frontend dependencies

## Key API Endpoints
- Auth: /api/auth/login, /api/auth/me, /api/auth/register
- Lessons: /api/lessons, /api/lessons/day/{giorno}
- Bookings: /api/bookings, /api/bookings/me
- Subscriptions: /api/subscriptions, /api/subscriptions/me, /api/subscriptions/insoluti
- Admin: /api/admin/dashboard, /api/admin/users, /api/admin/weekly-bookings, /api/admin/nutrition/plans
- Gamification: /api/lottery/status, /api/wheel/status, /api/quiz/today
- Nutrition: /api/nutrition/profile, /api/nutrition/generate-plan, /api/nutrition/my-plan
