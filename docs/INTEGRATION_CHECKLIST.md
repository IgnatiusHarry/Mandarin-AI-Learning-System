# Ming Laoshi Production Integration Execution Checklist

**Project:** Mandarin AI Learning System  
**Branch:** feature/mandarin-learning-upgrade  
**Target:** Full production integration (OpenClaw ↔ Supabase ↔ Web)  
**Owner:** Mythief (Ignatius Harry)  
**Start Date:** 2026-04-13  
**Target Completion:** 2026-04-15  

---

## 📅 Phase 1: Infrastructure Setup (Day 1)

### Supabase
- [ ] Create Supabase account
- [ ] Create new project (region: Singapore)
- [ ] Copy project credentials:
  - [ ] SUPABASE_URL
  - [ ] SUPABASE_ANON_KEY
  - [ ] SUPABASE_SERVICE_KEY
- [ ] Run schema.sql in SQL Editor
- [ ] Verify all tables exist:
  - [ ] profiles
  - [ ] vocabulary
  - [ ] user_reviews
  - [ ] user_reviews_weak
  - [ ] conversations
  - [ ] conversation_messages
  - [ ] review_sessions
  - [ ] review_log
  - [ ] daily_goals
- [ ] Enable Auth > Email/Password
- [ ] Verify RLS policies enabled on all user tables

### Backend Deployment
**Option Selected:** ☐ Railway.app ☐ VPS (EC2/DigitalOcean) ☐ Other

#### Railway Path
- [ ] Push branch to GitHub as main-deploy
- [ ] Create Railway account
- [ ] Link GitHub repo
- [ ] Select Mandarin-AI-Learning-System
- [ ] Set root directory: ./backend
- [ ] Add environment variables (see step below)
- [ ] Deploy
- [ ] Get backend URL: `https://____.railway.app`

#### VPS Path
- [ ] Provision VPS (Ubuntu 22.04)
- [ ] SSH access verified
- [ ] Install Python 3.11+
- [ ] Install dependencies: git, nginx, systemd
- [ ] Clone repo + checkout feature/mandarin-learning-upgrade
- [ ] Create Python venv
- [ ] Install requirements.txt
- [ ] Create .env file
- [ ] Configure systemd service
- [ ] Configure Nginx reverse proxy
- [ ] Verify port 80/443 open
- [ ] Get backend URL

### Backend Environment Variables
- [ ] **SUPABASE_URL** = `https://YOUR-PROJECT.supabase.co`
- [ ] **SUPABASE_ANON_KEY** = `eyJ...` (from Supabase)
- [ ] **SUPABASE_SERVICE_KEY** = `eyJ...` (from Supabase)
- [ ] **ANTHROPIC_API_KEY** = `sk-ant-...` (from Anthropic)
- [ ] **TELEGRAM_BOT_TOKEN** = `123456789:ABC...` (from @BotFather)
- [ ] **OPENCLAW_API_SECRET** = `<your-openclaw-secret>`
- [ ] **CRON_SECRET** = `<any-strong-random-string>`
- [ ] **FRONTEND_URL** = `https://mandarin-learning-XXXXX.vercel.app` (exact match)
- [ ] **APP_ENV** = `production`

### Frontend Deployment (Vercel)
- [ ] Create Vercel account
- [ ] Import GitHub repo
- [ ] Set root directory: ./frontend
- [ ] Add environment variables:
  - [ ] **NEXT_PUBLIC_SUPABASE_URL** = same as backend
  - [ ] **NEXT_PUBLIC_SUPABASE_ANON_KEY** = same as backend
  - [ ] **NEXT_PUBLIC_API_URL** = your backend URL
- [ ] Deploy
- [ ] Get frontend URL: `https://mandarin-learning-XXXXX.vercel.app`
- [ ] Update backend FRONTEND_URL if changed
- [ ] Redeploy backend with updated CORS

---

## 🧪 Phase 2: Integration Testing (Day 2)

### Test 1: Backend Health
```bash
curl -X GET https://YOUR-BACKEND-URL/health
```
- [ ] Returns: `{ "status": "ok", "service": "ming-laoshi" }`
- [ ] Status code: 200

### Test 2: OpenClaw Auth (Valid Secret)
```bash
curl -X POST https://YOUR-BACKEND-URL/api/message \
  -H "X-API-Key: YOUR_OPENCLAW_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{ "telegram_id": 841875314, "text": "我學習了新詞", "message_type": "text" }'
```
- [ ] Returns: `{ "reply_text": "...", "parse_mode": "Markdown" }`
- [ ] Status code: 200

### Test 3: OpenClaw Auth (Invalid Secret)
```bash
curl -X POST https://YOUR-BACKEND-URL/api/message \
  -H "X-API-Key: INVALID_SECRET" \
  -d '{ "telegram_id": 841875314, "text": "test" }'
```
- [ ] Returns: `{ "detail": "Invalid API key" }`
- [ ] Status code: 401

### Test 4: OpenClaw Auth (Missing Secret)
```bash
curl -X POST https://YOUR-BACKEND-URL/api/message \
  -d '{ "telegram_id": 841875314, "text": "test" }'
```
- [ ] Returns: `{ "detail": "Invalid API key" }`
- [ ] Status code: 401

### Test 5: Web Login (Supabase Auth)
- [ ] Open frontend: `https://mandarin-learning-XXXXX.vercel.app`
- [ ] Click "Sign Up" (if exists)
- [ ] Enter test email: `mythief-test@gmail.com`
- [ ] Enter password: `TestPassword123!`
- [ ] Verify confirmation email sent
- [ ] Click magic link in email
- [ ] Browser redirects to dashboard
- [ ] Check localStorage: `localStorage.getItem('sb_auth_token')` exists
- [ ] JWT token structure: `eyJ...` (3 parts separated by dots)

### Test 6: JWT Auth (Valid Token)
```bash
# Get token from browser localStorage
JWT_TOKEN="<copy-from-localStorage>"

curl -X GET https://YOUR-BACKEND-URL/api/stats \
  -H "Authorization: Bearer $JWT_TOKEN"
```
- [ ] Returns: `{ "total_words": 0, "mastered_words": 0, ... }`
- [ ] Status code: 200
- [ ] No 401/403 errors

### Test 7: JWT Auth (Invalid Token)
```bash
curl -X GET https://YOUR-BACKEND-URL/api/stats \
  -H "Authorization: Bearer INVALID_TOKEN"
```
- [ ] Returns: `{ "detail": "Invalid or expired token" }`
- [ ] Status code: 401

### Test 8: JWT Auth (Missing Token)
```bash
curl -X GET https://YOUR-BACKEND-URL/api/stats
```
- [ ] Returns: `{ "detail": "Missing authorization" }`
- [ ] Status code: 401

### Test 9: Database Write (Vocabulary)
**Setup:** Verified Test 2 passed (OpenClaw message sent)

```sql
-- In Supabase SQL Editor:
SELECT id, user_id, word, pinyin FROM vocabulary 
WHERE user_id IN (
  SELECT id FROM profiles WHERE telegram_id = 841875314
)
LIMIT 10;
```
- [ ] Result: At least 1 row (word added by Test 2)
- [ ] Fields populated: id, user_id, word, pinyin
- [ ] No NULL fields in core columns

### Test 10: Identity Resolution
**Setup:** 
1. Web user created in Test 5
2. Get supabase_auth_id from JWT (`sub` claim)
3. Send OpenClaw message as telegram_id = 841875314

```sql
-- In Supabase SQL Editor:
SELECT id, supabase_auth_id, telegram_id FROM profiles 
WHERE telegram_id = 841875314 OR supabase_auth_id = '<jwt-sub-claim>';
```
- [ ] Result: **Exactly 1 row** (same profile for both)
- [ ] `supabase_auth_id` = JWT sub claim
- [ ] `telegram_id` = 841875314
- [ ] `id` = same UUID for both identity paths

### Test 11: Identity Linking Endpoint
```bash
JWT_TOKEN="<from-Test-5>"

curl -X POST https://YOUR-BACKEND-URL/api/profile/link-telegram \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "telegram_id": 841875314 }'
```
- [ ] Returns: `{ "status": "ok", "profile_id": "...", "telegram_id": 841875314 }`
- [ ] Status code: 200

### Test 12: Conversation Start
```bash
JWT_TOKEN="<from-Test-5>"

curl -X POST https://YOUR-BACKEND-URL/api/conversation/start \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "topic": "daily routine", "source": "web" }'
```
- [ ] Returns: `{ "id": "<uuid>", "user_id": "...", "topic": "daily routine", "source": "web" }`
- [ ] Status code: 200

### Test 13: Conversation Message
```bash
CONVO_ID="<from-Test-12>"
JWT_TOKEN="<from-Test-5>"

curl -X POST https://YOUR-BACKEND-URL/api/conversation/message \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"conversation_id\": \"$CONVO_ID\", \"content\": \"今天我想練習口說\" }"
```
- [ ] Returns: Message object with `role`, `content`, `corrections`, `vocab_introduced`
- [ ] Status code: 200
- [ ] AI response present (not just echo)

### Test 14: Conversation History
```bash
CONVO_ID="<from-Test-12>"
JWT_TOKEN="<from-Test-5>"

curl -X GET "https://YOUR-BACKEND-URL/api/conversation/history?conversation_id=$CONVO_ID" \
  -H "Authorization: Bearer $JWT_TOKEN"
```
- [ ] Returns: Array of messages
- [ ] Each message has: `role` (user|assistant), `content`, `created_at`
- [ ] At least 2 messages (user + assistant from Test 13)
- [ ] Status code: 200

### Test 15: Review Due Cards
```bash
JWT_TOKEN="<from-Test-5>"

curl -X GET https://YOUR-BACKEND-URL/api/review/due \
  -H "Authorization: Bearer $JWT_TOKEN"
```
- [ ] Returns: Array (may be empty if no reviews yet)
- [ ] If cards exist: `{ "vocabulary_id": "...", "word": "...", "mastery_level": 0 }`
- [ ] Status code: 200

### Test 16: Submit Review Answer
```bash
JWT_TOKEN="<from-Test-5>"
VOCAB_ID="<from-Test-15-or-database>"

curl -X POST https://YOUR-BACKEND-URL/api/review/answer \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"vocabulary_id\": \"$VOCAB_ID\", \"quality\": 4 }"
```
- [ ] Returns: `{ "interval": X, "ease_factor": Y, "next_review_at": "...", "mastery_level": Z }`
- [ ] Status code: 200
- [ ] Database updated: user_reviews row created/updated

---

## 🔗 Phase 3: OpenClaw Webhook Integration (Day 2)

### Setup OpenClaw Message Handler
- [ ] Access OpenClaw deployment (local or production)
- [ ] Find "HTTP Webhook" or message handling config
- [ ] Configure POST endpoint:
  - [ ] URL: `https://YOUR-BACKEND-URL/api/message`
  - [ ] Method: POST
  - [ ] Header: `X-API-Key: <OPENCLAW_API_SECRET>`
  - [ ] Body format: JSON with `telegram_id`, `text`, `message_type`
- [ ] Save configuration
- [ ] Test webhook: Send test Telegram message to bot

### Test 17: End-to-End Telegram → Backend
1. In Telegram, send message to your bot: "我學習了新單詞：書"
2. Verify:
   - [ ] OpenClaw captures message
   - [ ] Routes to `/api/message` with correct header
   - [ ] Backend processes (no 401 errors)
   - [ ] Reply appears in Telegram
   - [ ] Vocabulary saved to Supabase

```sql
-- Verify in Supabase:
SELECT word, pinyin FROM vocabulary 
WHERE user_id IN (SELECT id FROM profiles WHERE telegram_id = 841875314)
ORDER BY created_at DESC LIMIT 5;
```
- [ ] Result: Latest message's words appear in vocabulary

---

## 🛡️ Phase 4: Data Integrity & Memory Preservation (Day 2)

### Pre-Check (Before Migration)
```sql
-- In Supabase SQL Editor, run and save results:

SELECT 'profiles' AS table_name, COUNT(*) AS row_count FROM profiles
UNION ALL SELECT 'vocabulary', COUNT(*) FROM vocabulary
UNION ALL SELECT 'user_reviews', COUNT(*) FROM user_reviews
UNION ALL SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL SELECT 'conversation_messages', COUNT(*) FROM conversation_messages
UNION ALL SELECT 'review_sessions', COUNT(*) FROM review_sessions
UNION ALL SELECT 'daily_goals', COUNT(*) FROM daily_goals;
```
- [ ] Baseline saved: `_baseline_row_counts.txt`

### Post-Check (After Integration)
```sql
-- Run same query again:

SELECT 'profiles' AS table_name, COUNT(*) AS row_count FROM profiles
UNION ALL SELECT 'vocabulary', COUNT(*) FROM vocabulary
UNION ALL SELECT 'user_reviews', COUNT(*) FROM user_reviews
UNION ALL SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL SELECT 'conversation_messages', COUNT(*) FROM conversation_messages
UNION ALL SELECT 'review_sessions', COUNT(*) FROM review_sessions
UNION ALL SELECT 'daily_goals', COUNT(*) FROM daily_goals;
```
- [ ] Row counts **not decreased** for any table
- [ ] Expected changes:
  - [ ] profiles: +1 (test user)
  - [ ] vocabulary: +1+ (from OpenClaw test)
  - [ ] conversations: +1 (from web test)
  - [ ] conversation_messages: +2+ (user + assistant)

### Orphan Detection
```sql
-- Check for orphan rows (data integrity):

SELECT 'vocabulary orphans' AS check_type, COUNT(*) FROM vocabulary 
WHERE user_id NOT IN (SELECT id FROM profiles)
UNION ALL
SELECT 'user_reviews orphans', COUNT(*) FROM user_reviews
WHERE user_id NOT IN (SELECT id FROM profiles)
UNION ALL
SELECT 'conversations orphans', COUNT(*) FROM conversations
WHERE user_id NOT IN (SELECT id FROM profiles)
UNION ALL
SELECT 'review_sessions orphans', COUNT(*) FROM review_sessions
WHERE user_id NOT IN (SELECT id FROM profiles);
```
- [ ] All results = 0 (no orphans)
- [ ] Data integrity: **PASS**

### Historical Data Verification
```sql
-- If migrating from old system, verify no data lost:

-- Check vocabulary from Telegram still accessible
SELECT COUNT(*) FROM vocabulary 
WHERE user_id IN (SELECT id FROM profiles WHERE telegram_id = 841875314);

-- Check conversations persisted
SELECT COUNT(*) FROM conversations 
WHERE user_id IN (SELECT id FROM profiles WHERE supabase_auth_id = '<web-user-id>');
```
- [ ] All historical records present
- [ ] No unexpected deletions
- [ ] Memory preservation: **PASS**

---

## 📋 Phase 5: Final Verification (Day 3)

### Functional Tests (All Lanes)

#### Lane 1: Health & Auth
- [ ] /health returns ok
- [ ] OpenClaw secret validation works (valid passes, invalid fails)
- [ ] JWT validation works (valid passes, invalid fails)

#### Lane 2: Data Flow
- [ ] Telegram message → OpenClaw → Backend → Supabase ✅
- [ ] Web login → Supabase Auth → JWT ✅
- [ ] Web API calls → JWT validation → Supabase read/write ✅

#### Lane 3: Identity Unification
- [ ] Telegram user ID resolves to profile ✅
- [ ] Web user auth_id resolves to profile ✅
- [ ] Same profile receives writes from both sources ✅

#### Lane 4: Conversation AI
- [ ] Conversation starts successfully ✅
- [ ] Messages send and receive AI response ✅
- [ ] History persists ✅
- [ ] Corrections/vocab_introduced populated ✅

#### Lane 5: SRS Review
- [ ] Review cards generated ✅
- [ ] Answer submission updates SRS state ✅
- [ ] Mastery level progresses ✅

#### Lane 6: Memory Preservation
- [ ] No data lost ✅
- [ ] No orphans ✅
- [ ] Historical access maintained ✅

---

## ✅ GO/NO-GO Decision

### GO Criteria (All Must Pass)
- [ ] All 16 API tests passed
- [ ] All 6 lanes verified
- [ ] Data integrity check passed (no orphans)
- [ ] Memory preservation verified (row counts stable)
- [ ] End-to-end Telegram → Backend → Supabase works
- [ ] Identity linking works (telegram ↔ web unified)
- [ ] No critical blockers remain

### DECISION: **GO** ☐ / **NO-GO** ☐

**If NO-GO, list blockers:**
```
1. _________________________________________
2. _________________________________________
3. _________________________________________
```

**Remediation plan:**
```
_________________________________________
_________________________________________
```

---

## 🎉 Post-Launch Checklist

- [ ] Deploy to production (beyond staging)
- [ ] Enable monitoring/alerting:
  - [ ] Backend uptime monitoring
  - [ ] API error rate tracking
  - [ ] Supabase query performance
  - [ ] Vercel frontend monitoring
- [ ] Set up logs aggregation (e.g., Datadog, CloudWatch)
- [ ] Create runbook for incidents
- [ ] Schedule post-launch review (1 week, 1 month)
- [ ] Announce to users (if beta)
- [ ] Document operational procedures

---

## 📞 Support & Escalation

**If blocked:**
1. Check DEPLOYMENT_QUICKSTART.md troubleshooting section
2. Review PROD_INTEGRATION_REPORT.md for expected behavior
3. Check application logs:
   - Backend: Railway dashboard or systemd journal
   - Frontend: Vercel dashboard or browser console
   - Supabase: Logs in dashboard
4. Contact: Mythief (Ignatius Harry) / OpenClaw support

---

**Checklist Version:** 1.0  
**Status:** READY FOR EXECUTION  
**Owner:** Mythief (Ignatius Harry)  
**Date Created:** 2026-04-13

