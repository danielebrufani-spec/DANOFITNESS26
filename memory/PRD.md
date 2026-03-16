# DANOFITNESS26 - Product Requirements Document

## Problem Statement
Fitness application for "DANOFITNESS26" gym. Full-stack app with React Native (Expo) frontend and FastAPI backend using MongoDB. Features user management, class booking, gamification (lottery, wheel of fortune, quiz), admin panel, AI nutrition plans.

## Tech Stack
- **Frontend:** React Native (Expo), TypeScript
- **Backend:** Python, FastAPI
- **Database:** MongoDB (motor async driver)
- **AI:** OpenAI GPT via emergentintegrations (Emergent LLM Key)
- **Deployment:** Vercel (frontend), Render (backend)

## Code Architecture
```
/app
├── backend/
│   ├── .env
│   ├── server.py (monolith - all routes, models, helpers)
│   ├── requirements.txt
│   └── tests/
│       └── test_performance_optimizations.py
└── frontend/
    ├── app/(tabs)/ (alimentazione, admin, home, premi, profilo, _layout)
    ├── app/services/api.ts
    └── ...
```

## Completed Features
- User auth (JWT), admin panel, class booking system
- Subscription management (lesson-based + time-based, paid/unpaid tracking)
- Gamification: weekly leaderboard, lottery, wheel of fortune, quiz
- AI nutrition plan (GPT via emergentintegrations)
- Archived user lockout
- Push notifications (Expo + Web)
- Chat/communications system
- Consigli del Maestro + Consigli Musicali (Spotify)
- Performance optimizations (indexes, GZip, cache, parallel queries, projections)

## Performance Optimizations (March 2026)
1. **MongoDB Indexes** on all major collections
2. **GZip Compression** via middleware (min 500 bytes)
3. **In-Memory Cache** (SimpleCache with TTL):
   - Lessons: 5 min TTL
   - Blocked dates: 1 min TTL
4. **Batch Query Fixes** (N+1 → batch):
   - admin/notifications
   - get_users_with_active_subscription (lottery)
5. **Parallel Queries** (asyncio.gather):
   - admin/dashboard, user/livello, lottery/status
   - weekly-stats, nutrition/my-plan, quiz/today, wheel/status
6. **Query Projections** on admin user lookups (archive, restore, delete, set-role, reset-password)
7. **profile_image exclusion** from bulk queries

## Upcoming Tasks (P1)
- "Porta un Amico" (Refer a Friend) system
- Streak Bonuses (+1 ticket for 3 consecutive days)
- Milestone Bonuses (+5 tickets for 50 total lessons)

## Future/Backlog (P2)
- Instagram Integration for Bonuses
- UI/UX Graphic Enhancements (dark/light mode, visual calendar, stats page)
- Update outdated frontend dependencies

## Key API Endpoints
See server.py for full list. Major endpoints:
- Auth: /api/auth/login, /api/auth/me, /api/auth/register
- Lessons: /api/lessons, /api/lessons/day/{giorno}
- Bookings: /api/bookings, /api/bookings/me
- Subscriptions: /api/subscriptions, /api/subscriptions/me
- Admin: /api/admin/dashboard, /api/admin/users, /api/admin/weekly-bookings
- Gamification: /api/lottery/status, /api/wheel/status, /api/quiz/today
- Nutrition: /api/nutrition/profile, /api/nutrition/generate-plan, /api/nutrition/my-plan
