# Upgrade: Web SWR cache, profile PATCH, study-plan personalization

- Date: 2026-04-16
- Owner: TBD
- Status: shipped

## Background

Web pages felt slow because each route re-fetched Supabase session and hit the API on every mount. Learners also needed clearer control of HSK level, native language, and daily goals so chat, SRS, and missions stay aligned with their profile.

## Scope

- Client-side caching with SWR + shared auth session context.
- NavBar hover prefetch for common API bundles.
- `PATCH /api/profile/me` for personalization fields.
- Richer `GET /api/gamification/study-plan` (due/weak counts, coach tip, HSK-aware focus words).
- `GET /api/vocab/lesson-options` for review lesson filters.
- Conversation lesson welcome text driven by user weak words + deck vocabulary.
- Claude system prompt: optional short native-language clarification after grammar explanations.

## Affected Areas

- Frontend: `AppProviders`, `auth-context`, dashboard/vocabulary/progress/leaderboard/review/conversation pages, `NavBar`, `api.ts`, `learner-keys.ts`, dependency `swr`.
- Backend: `routers/profile.py`, `routers/vocab.py`, `routers/gamification.py`, `models/schemas.py`, `services/ai_processor.py`.
- Database: no migration (uses existing `profiles` columns).
- Telegram bot: unchanged.
- AI flow: conversation system prompt extended (rule 9).

## Implementation Plan

1. Ship SWR + `AuthProvider` in root layout; standardize `learner/*` cache keys.
2. Refactor data-heavy pages to `useSWR`; invalidate on Realtime and after review session.
3. Add profile PATCH, lesson-options endpoint, and gamification study-plan enhancements.

## Verification

- Local checks: `cd frontend && npm run build` (passed); `cd backend && python -m compileall -q .` (passed).
- Production checks: TBD (deploy and smoke-test dashboard, review, PATCH profile, study-plan JSON).

## Rollback Plan

Revert frontend `AppProviders` wrapper and SWR refactors; revert backend router/schema changes in a single commit.

## PLAN.md Updates

- Sections changed: added “Web client performance & caching”, “Personalization”, updated Week 5–8 checklist items to reflect shipped web features.
