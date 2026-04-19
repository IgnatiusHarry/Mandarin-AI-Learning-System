# PLAN.md — Mandarin AI Learning System

Stack: Python (FastAPI) + Supabase + Telegram Bot + Next.js Web App + Claude API

Target user: HSK 3-4 learner, daily use via Telegram + Web

Goal: Personal AI learning assistant that grows with vocabulary, prevents forgetting, and enables daily Mandarin conversation practice.

## Architecture Summary

### Phase 0: Infrastructure Setup (Day 1-2)
0.1 Supabase Setup
- Create project at supabase.com
- Enable Auth (email + magic link)
- Get SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
- Run all SQL schemas from Section 3

0.2 Project Structure (VSCode)

0.3 Dependencies

### Phase 1: MVP — Core Vocabulary Loop (Week 1-2)

Telegram Bot Commands

| Command | Action |
|---|---|
| Paste any Chinese text | Auto-extract vocab, save to DB, confirm |
| /review | SRS flashcard session (cards due today) |
| /stats | Today's progress: X learned, Y mastered |
| /add 學習 xuexi to study | Manual add with pinyin + meaning |
| /weak | Show words you keep forgetting |
| /chat | Start AI Mandarin conversation |

Vocab Processing Flow

SM-2 Spaced Repetition (srs.py)

### Phase 2: AI Conversation + Tone Practice (Week 3-4)
Conversation System Prompt

### Phase 3: Smart Daily System (Week 5-6)
Daily Cron (APScheduler)

Weak Word Radar

### Web client performance & caching (shipped)
- **SWR** shared cache across Home, Words, Progress, Rank, Chat (dedupe window ~2 min, no refetch on tab focus).
- **AuthProvider** resolves Supabase session once; pages reuse the same access token instead of calling `getSession()` on every navigation.
- **NavBar prefetch** on hover/focus warms the cache for likely next pages.
- **Realtime**: vocabulary inserts from Telegram trigger `mutate()` on all `learner/*` keys so the dashboard stays fresh without a full reload.

### Personalization (shipped / ongoing)
- **Profile**: `GET/PATCH /api/profile/me` for `hsk_level`, `native_language`, `daily_goal_words` (dashboard “Your learning profile”).
- **Study plan**: `GET /api/gamification/study-plan` uses weak + due counts, HSK filter on focus words, localized `coach_tip`, and per-user mission targets.
- **Chat**: lesson welcome messages mix **deck words + weak SRS words** from the user; Claude prompt weaves known/weak lists and may add a short explanation in the learner’s native language after Chinese grammar notes.
- **Review scope**: `GET /api/vocab/lesson-options` drives lesson filters from configured chapter decks.

### Vocabulary list UX (shipped)
- **Fonts**: global stack includes TC/SC system fonts + Noto-style fallbacks so imported Han / mixed textbook strings don’t render as tofu (□) next to Latin-only fonts.
- **Book placement**: meanings may include tags like `[M4L5]` or `【M4L5】`; the UI strips them from running text and shows a **Modul · Pelajaran** badge (textbook-style level), matching the “buku” workflow in this plan.
- **Retention radar**: vocabulary page surfaces **SRS weak words** (avg quality &lt; 3, ≥3 reviews) with next review hints and links to **Review** — same forgetting signal used by SM-2 / `next_review_at` in `user_reviews`.

### Section 3: Full Supabase SQL Schema

### Section 4: Supabase Realtime (Telegram → Web sync)

### Section 5: Deployment (VPS Setup)

### Section 6: Execution Checklist

Week 1 — Core Loop
- [x] Supabase project created + all SQL run
- [x] FastAPI backend up + Supabase client connected (Legacy)
- [x] Next.js API Routes (New Native Backend)
- [ ] Telegram bot registered + webhook set
- [x] Paste Chinese text -> AI extracts vocab -> saved to DB (bot path)
- [x] Bot replies with word breakdown + tone info

Week 2 — SRS Review
- [x] SM-2 algorithm implemented
- [ ] /review command working (Telegram flashcard flow)
- [x] Review results saved -> mastery_level updated (web + API)
- [ ] /stats command shows daily progress

Week 3 — AI Conversation
- [ ] /chat command starts Mandarin conversation
- [x] Conversation history stored in Supabase (web + API)
- [x] Grammar/tone corrections embedded in AI responses
- [ ] /weak command shows trouble words

Week 4 — Daily System
- [ ] Morning cron (9 AM push)
- [ ] Evening summary cron
- [x] Streak tracking logic (exposed via API / dashboard)
- [ ] Milestone notifications (10 words, 50 words, 100 words mastered)

Week 5-6 — Web App
- [x] Next.js dashboard: streak, due cards, word count
- [x] Flashcard review UI (web)
- [x] Native Next.js API Routes (bypassing Python backend)
- [x] Vocabulary list with mastery badges + tone display
- [x] Shared Memory: Telegram <-> Web integration
- [x] Auth Fix: Specific linkage for 'ternakduit99@gmail.com'

Week 7-8 — Polish
- [x] AI chat web UI
- [x] Progress charts (recharts: words over time, mastery curve)
- [x] Tone visualization (color-coded by tone 1-4)
- [ ] Full end-to-end test

## Daily User Flow (Final Vision)

Morning (9 AM Telegram push)
- "5 kata perlu direview hari ini! Streak: 12 hari"
- User: /review
- Bot: shows flashcard -> user rates 1-5 -> next card

Afternoon (spontaneous learning)
- User sees Chinese text and pastes it to Telegram
- Bot confirms added vocab with pinyin, meaning, example, and next review

Evening (conversation practice)
- User: /chat
- AI opens Mandarin conversation and gives tone correction guidance

Web dashboard (anytime)
- 127 words learned | 43 mastered | 8 weak words
- Streak: 12 days
- Due today: 7 cards

HarryAlphaLab — Mandarin AI Learning System v1.0

## Continuous Update System (Always Keep Plan Fresh)

Every feature upgrade or concept change must follow this rule:

1. Register a new upgrade note:
   - `bash scripts/register_upgrade.sh "upgrade title"`
2. Fill detail in generated file under `docs/upgrades/`.
3. Update this PLAN.md if scope, flow, or timeline changes.
4. Implement and validate (local + production checks).
5. Change upgrade note status: `proposed` -> `in-progress` -> `shipped`.
6. Record evidence (commands run, endpoints checked, screenshots/logs).

No upgrade is considered complete until PLAN.md and upgrade notes are both updated.
