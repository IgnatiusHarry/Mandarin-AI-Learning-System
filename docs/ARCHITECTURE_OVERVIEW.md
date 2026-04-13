# Ming Laoshi Architecture Overview

**System:** Mandarin AI Learning System v1.0  
**Status:** Production-Ready (pending deployment)  
**Owner:** Mythief (Ignatius Harry)  
**Date:** 2026-04-13  

---

## 🏗️ System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        USERS                                 │
└─────────┬───────────────────────────────────┬────────────────┘
          │                                   │
    ┌─────▼─────┐                       ┌────▼────────┐
    │  Telegram │                       │  Web Browser │
    │    Bot    │                       │  (Next.js)   │
    └─────┬─────┘                       └────┬────────┘
          │                                   │
          │ (OpenClaw webhook)                │ (HTTPS)
          │ X-API-Key header                  │ JWT Bearer
          │ POST /api/message                 │ GET/POST /api/*
          │                                   │
    ┌─────▼───────────────────────────────────▼────────┐
    │  FastAPI Backend                                 │
    │  ├─ /api/message (OpenClaw ingress)             │
    │  ├─ /api/vocab (vocabulary management)          │
    │  ├─ /api/review (SRS flashcards)               │
    │  ├─ /api/conversation (AI chat)                │
    │  ├─ /api/stats (progress dashboard)            │
    │  ├─ /api/gamification (badges/streaks)         │
    │  ├─ /cron/* (scheduled jobs)                   │
    │  └─ /health (readiness check)                  │
    │                                                  │
    │  Auth Middleware:                               │
    │  ├─ verify_openclaw_secret() [X-API-Key]      │
    │  ├─ verify_supabase_jwt() [Bearer JWT]         │
    │  └─ verify_cron_secret() [X-Cron-Secret]       │
    │                                                  │
    │  Services:                                       │
    │  ├─ ai_processor (Claude API integration)      │
    │  ├─ command_handler (Telegram command parsing) │
    │  ├─ srs (SM-2 spaced repetition algorithm)     │
    │  ├─ scheduler (internal cron manager)          │
    │  └─ telegram_sender (outbound messages)        │
    └────┬────────────────────────────────────────────┘
         │ (HTTPS)
         │ Supabase client (service key)
         │
    ┌────▼──────────────────────────────────────────┐
    │  Supabase PostgreSQL Database                 │
    │                                                │
    │  Core Tables:                                 │
    │  ├─ profiles                                  │
    │  │  ├─ id (UUID PK)                          │
    │  │  ├─ supabase_auth_id (nullable, UNIQUE)   │
    │  │  ├─ telegram_id (nullable, UNIQUE)        │
    │  │  └─ other: display_name, hsk_level, etc   │
    │  │                                            │
    │  ├─ vocabulary                               │
    │  │  ├─ id (UUID PK)                         │
    │  │  ├─ user_id (FK → profiles)              │
    │  │  ├─ word, pinyin, meaning_en/id          │
    │  │  └─ source (telegram|web|manual)         │
    │  │                                            │
    │  ├─ user_reviews                            │
    │  │  ├─ id (UUID PK)                        │
    │  │  ├─ user_id + vocabulary_id (UNIQUE)    │
    │  │  ├─ interval_days, ease_factor (SM-2)  │
    │  │  └─ mastery_level (0-5)                │
    │  │                                           │
    │  ├─ conversations                           │
    │  │  ├─ id (UUID PK)                       │
    │  │  ├─ user_id (FK → profiles)            │
    │  │  └─ topic, source, started_at, ended_at│
    │  │                                           │
    │  ├─ conversation_messages                  │
    │  │  ├─ id (UUID PK)                      │
    │  │  ├─ conversation_id (FK)              │
    │  │  ├─ role (user|assistant)             │
    │  │  ├─ content                           │
    │  │  └─ corrections, vocab_introduced    │
    │  │                                        │
    │  ├─ review_sessions (practice sessions)  │
    │  ├─ review_log (individual card reviews)│
    │  └─ daily_goals (streak tracking)        │
    │                                            │
    │  Auth:                                      │
    │  └─ auth.users (Supabase built-in)       │
    │     └─ Used for web login (email/password)│
    │                                            │
    │  RLS Policies:                             │
    │  └─ All tables: user can only see own data│
    └────────────────────────────────────────────┘
         │
         └─ Also accessible to:
            ├─ Backend (service key bypasses RLS)
            └─ Web app (JWT validates ownership via RLS)
```

---

## 🔐 Authentication Flows

### Flow 1: Telegram → OpenClaw → Backend

```
User sends Telegram message
    │
    ▼
OpenClaw captures & routes
    │
    ├─ Validate: X-API-Key header == OPENCLAW_API_SECRET
    │ (middleware: verify_openclaw_secret())
    │
    └─ If valid:
       POST /api/message
       {
         "telegram_id": 841875314,
         "text": "我學習了新詞",
         "message_type": "text",
         "supabase_auth_id": <optional>
       }
         │
         ▼
       Backend processes:
       1. Resolve user_id from telegram_id
       2. Extract vocabulary from text
       3. Save to vocabulary table
       4. Generate AI response
       5. Return JSON
       
       Response:
       {
         "reply_text": "...",
         "parse_mode": "Markdown"
       }
         │
         ▼
       OpenClaw routes reply back to Telegram
```

### Flow 2: Web Browser → Supabase Auth → Backend API

```
User opens web app
    │
    ▼
Click "Sign Up" / "Log In"
    │
    ├─ Supabase Auth UI pops up
    ├─ User enters email + password
    ├─ Magic link sent (or password verified)
    └─ User confirms → JWT created
       │
       ▼
    Browser localStorage stores JWT:
    {
      "sub": "<user-uuid>",
      "email": "user@example.com",
      "aud": "authenticated",
      ...
    }
    │
    ▼
User makes API request (e.g., GET /api/stats)
    │
    ├─ Browser automatically includes:
    │  Authorization: Bearer <JWT>
    │
    └─ Backend receives:
       verify_supabase_jwt() called
       │
       ├─ Extract JWT token from header
       ├─ Call Supabase Auth API:
       │  GET /auth/v1/user
       │  Header: Authorization: Bearer <JWT>
       │
       └─ If token valid:
          Return decoded user info: {"sub": user_id, "email": ...}
          │
          ├─ Now we know: supabase_auth_id = user_id
          ├─ Query profiles table:
          │  SELECT * FROM profiles WHERE supabase_auth_id = user_id
          │
          └─ If profile exists:
             Proceed with request (e.g., fetch /api/stats)
             RLS policy enforces: user can only see own data
```

### Flow 3: Identity Linking (Telegram ↔ Web)

```
Scenario: User has both Telegram (842875314) and Web (supabase-uuid) accounts

Step 1: Web user logs in
    → Gets JWT with sub = supabase-uuid
    → Web profile created: profiles { supabase_auth_id, telegram_id=NULL }

Step 2: User sends Telegram message
    → OpenClaw sends: POST /api/message { telegram_id: 841875314, text: "..." }
    → Backend checks: SELECT * FROM profiles WHERE telegram_id = 841875314
    → If found: Use that profile_id
    → If not found: Create new profile { telegram_id: 841875314, supabase_auth_id: NULL }

Step 3: User wants to link accounts
    → POST /api/profile/link-telegram
    → Header: Authorization: Bearer <web-jwt>
    → Body: { "telegram_id": 841875314 }
    → Backend:
       1. Decode JWT → get supabase_auth_id
       2. Query: SELECT id FROM profiles WHERE supabase_auth_id = <web-user-id>
       3. Update: UPDATE profiles SET telegram_id = 841875314 WHERE id = <profile-id>
       4. Constraint: telegram_id UNIQUE ensures no conflicts
    → Result: Single profile { supabase_auth_id, telegram_id both set }

Step 4: All future messages unified
    → Telegram message → backend uses telegram_id → same profile
    → Web request → backend uses supabase_auth_id → same profile
    → All vocabulary, reviews, conversations visible in both channels
```

---

## 📊 Data Flow Examples

### Example 1: Learn New Word (Telegram)

```
User: "我今天學習了書"
  │
  ▼
OpenClaw → POST /api/message { telegram_id: 841875314, text: "我今天學習了書" }
  │
  ▼
Backend:
  1. Get profile: SELECT * FROM profiles WHERE telegram_id = 841875314
  2. AI extract: ["書"]
  3. Add vocabulary:
     INSERT INTO vocabulary (user_id, word, pinyin, meaning_en, source)
     VALUES (profile_id, "書", "shū", "book", "telegram")
  4. Increment daily goal:
     UPDATE daily_goals SET actual_new_words = actual_new_words + 1
  5. Generate response via Claude
  6. Return AI breakdown + pinyin + example
  │
  ▼
User sees: "書 (shū) — book. Example: 我有一本好書。"
```

### Example 2: Review Card (Web)

```
User: clicks "Review Now"
  │
  ▼
Web: GET /api/review/due { Authorization: Bearer <jwt> }
  │
  ▼
Backend:
  1. Decode JWT → supabase_auth_id = user_uuid
  2. Get profile: SELECT id FROM profiles WHERE supabase_auth_id = user_uuid
  3. Query due cards:
     SELECT v.id, v.word, v.pinyin, v.meaning_en, ur.mastery_level
     FROM vocabulary v
     JOIN user_reviews ur ON v.id = ur.vocabulary_id
     WHERE v.user_id = profile_id AND ur.next_review_at <= NOW()
     ORDER BY ur.mastery_level ASC
     LIMIT 5
  4. Return array of due cards
  │
  ▼
Web UI displays: flashcard #1 (word + pinyin)
  │
User rates: "4 - I knew it perfectly"
  │
  ▼
Web: POST /api/review/answer { vocabulary_id: ..., quality: 4 }
  │
  ▼
Backend:
  1. Decode JWT → get profile
  2. Calculate SM-2 algorithm:
     interval_days, ease_factor, mastery_level
  3. Update user_reviews:
     UPDATE user_reviews 
     SET interval_days = X, ease_factor = Y, mastery_level = Z, next_review_at = ...
     WHERE user_id = profile_id AND vocabulary_id = vocab_id
  4. Log review: INSERT INTO review_log (...)
  5. Update daily goal: increment actual_reviews
  6. Return updated SRS state
  │
  ▼
Web UI: "Correct! Next review in X days" → show next card
```

### Example 3: AI Conversation (Web)

```
User: "我想練習口說"
  │
  ▼
Web: POST /api/conversation/start { topic: "口說練習", source: "web" }
  │
  ▼
Backend:
  1. Decode JWT → profile_id
  2. Create conversation:
     INSERT INTO conversations (user_id, topic, source)
     VALUES (profile_id, "口說練習", "web")
  3. Return conversation_id
  │
  ▼
User: "我每天早上6點起床"
  │
  ▼
Web: POST /api/conversation/message
       { conversation_id: ..., content: "我每天早上6點起床" }
  │
  ▼
Backend:
  1. Fetch last 20 messages from this conversation
  2. Get user's vocabulary (for context)
  3. Call Claude API:
     system: "You are a Mandarin teacher. User is HSK 3-4. Correct errors gently..."
     messages: [history] + latest user message
  4. Get AI response
  5. Extract corrections + vocab_introduced
  6. Save to conversation_messages:
     INSERT INTO conversation_messages
       (conversation_id, role, content, corrections, vocab_introduced)
     VALUES (convo_id, "user", user_message, NULL, NULL)
     (convo_id, "assistant", ai_response, corrections_json, vocab_array)
  7. Return AI response + corrections + intro words
  │
  ▼
Web UI: "你每天早上6點起床很早！今天做什麼了？
         [Correction: 6點 should be 六點 for formality]
         [Introduced: 早、做]"
```

---

## 🔄 Data Preservation Strategy

### Principle 1: Additive Only
- No `DELETE` operations on user-facing tables
- No `DROP TABLE` commands
- Only `INSERT`, `UPDATE`, `SELECT`

### Principle 2: All Changes Backward Compatible
- New columns: nullable or have defaults
- Schema migrations: non-breaking
- API: versioning ready

### Principle 3: Cascading Deletes (Controlled)
- All FK relationships: `ON DELETE CASCADE`
- If profile deleted: related vocabulary, reviews, conversations all deleted
- No orphan rows possible

### Principle 4: Idempotent Operations
- Identity linking: `UPDATE ... SET telegram_id = X` is safe if run twice
- Vocabulary upsert: `INSERT ... ON CONFLICT (user_id, word) DO UPDATE ...`
- SRS updates: calculation deterministic

---

## 🛡️ Security Model

### Auth Layers

| Layer | Method | Used By | Validation |
|-------|--------|---------|-----------|
| **L1: OpenClaw Secret** | X-API-Key header | Telegram bot | Exact string match |
| **L2: JWT** | Authorization Bearer | Web app | Supabase Auth API |
| **L3: RLS** | Row-level policies | Database | auth.uid() vs supabase_auth_id |

### Permission Matrix

| Source | Auth | DB Access | Can Read | Can Write |
|--------|------|-----------|----------|-----------|
| Telegram (via OpenClaw) | X-API-Key | Service key (bypass RLS) | All own data | Insert vocabulary, reviews |
| Web (via JWT) | Bearer JWT | Anon key + RLS | Only own data (RLS enforced) | Full CRUD on own data |
| Backend itself | N/A | Service key (bypass RLS) | All data | All operations |

### Data Isolation
- Each user's data tied to `profiles.id`
- Web users linked via `profiles.supabase_auth_id`
- Telegram users linked via `profiles.telegram_id`
- RLS policies: `WHERE user_id IN (SELECT id FROM profiles WHERE supabase_auth_id = auth.uid())`

---

## 📈 Scalability Considerations

### Current Architecture (MVP)
- Single Supabase project
- Single FastAPI instance
- No caching layer
- Suitable for: 100-1000 active users

### Future Scale-Out
```
If > 1000 users:
├─ Add Redis cache layer (vocabulary, reviews)
├─ Load balance FastAPI (multiple instances)
├─ Supabase: use read replicas for stats queries
└─ CDN for static assets (Next.js already does this)

If > 10K users:
├─ Separate read/write connections
├─ Implement API rate limiting
├─ Archive old conversations
├─ Consider PostgreSQL connection pooling
└─ Dedicated monitoring (Datadog, New Relic)
```

---

## 🚀 Deployment Architecture

### Recommended (Current)

```
┌─────────────────────────────────────┐
│  Vercel (Frontend)                  │
│  ├─ Next.js 16                     │
│  ├─ Auto-scaling                   │
│  └─ CDN built-in                   │
└──────────────┬──────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────┐
│  Railway.app (Backend)              │
│  ├─ FastAPI + Uvicorn              │
│  ├─ Auto-scaling                   │
│  └─ PostgreSQL driver built-in     │
└──────────────┬──────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────┐
│  Supabase (Database + Auth)         │
│  ├─ PostgreSQL 15+                 │
│  ├─ Built-in Auth (Supabase Auth)  │
│  └─ Real-time subscriptions        │
└─────────────────────────────────────┘
```

### Alternative: Self-Hosted
```
┌─────────────────────────────────────┐
│  GitHub Pages / Netlify (Frontend)  │
└─────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  VPS (Backend)                      │
│  ├─ AWS EC2 / DigitalOcean         │
│  ├─ FastAPI + Gunicorn + Nginx     │
│  └─ Systemd for process management │
└─────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  PostgreSQL (Self-Hosted or RDS)    │
└─────────────────────────────────────┘
```

---

## 📋 Monitoring & Observability

### Health Checks
- `GET /health` → backend liveness
- JWT validation timing (Supabase Auth API latency)
- DB query performance (Supabase metrics)

### Key Metrics
- API response time (per endpoint)
- Error rate (4xx, 5xx)
- Vocabulary added per user per day
- Review completion rate
- Conversation turn count
- User retention (streaks)

### Alerting
- Backend down > 5 min → alert
- API error rate > 5% → alert
- Supabase auth failures > 10% → alert
- Conversation AI timeout > 30s → log + retry

---

## 🎯 Success Metrics

### MVP Phase (Weeks 1-4)
- Users can paste Chinese text → vocabulary auto-extracted ✅
- Users can review flashcards via SRS ✅
- Users can practice conversations with AI ✅
- Web dashboard shows stats ✅
- No data loss events ✅

### Growth Phase (Months 2-3)
- 100+ active users
- 1000+ vocabulary items learned
- 50+ review sessions per day
- < 500ms API response time (p95)
- 99% uptime

---

**Architecture Version:** 1.0  
**Status:** VALIDATED & READY FOR DEPLOYMENT  
**Owner:** Mythief (Ignatius Harry)  
**Last Updated:** 2026-04-13

