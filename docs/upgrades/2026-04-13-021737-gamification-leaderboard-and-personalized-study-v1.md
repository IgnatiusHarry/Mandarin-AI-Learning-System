# Upgrade: gamification leaderboard and personalized study v1

- Date: 2026-04-13
- Owner: Copilot
- Status: shipped

## Background
Improve interactivity for Traditional Mandarin learners and prepare product direction for subscription monetization.

## Scope
- Add gamification API endpoints (profile, quests, leaderboard).
- Add personalized study-plan endpoint with focus words + missions.
- Add subscription plan endpoint (foundation for paid tiers).
- Upgrade web dashboard with XP/level/hearts, quests, missions, and upgrade cards.
- Add leaderboard page and navigation.

## Affected Areas
- Frontend: dashboard, navbar, leaderboard page, API client.
- Backend: new gamification router, app router registration, vocab ownership fix.
- Database: no schema migration required for v1.
- Telegram bot: no direct command changes in this upgrade.
- AI flow: no model/prompt changes in this upgrade.

## Implementation Plan
1. Implement backend endpoints for gamification + personalization.
2. Connect frontend dashboard and add leaderboard UX.
3. Validate build and deploy both backend and frontend to production.

## Verification
- Local checks:
	- Frontend build succeeded (`npm run build`).
	- No diagnostics errors on edited TS/Python files.
- Production checks:
	- Backend deployed and healthy.
	- Frontend deployed with alias retained.
	- New API routes require auth (401 without token, expected).

## Rollback Plan
Revert gamification route wiring and dashboard additions, then redeploy backend and frontend.

## PLAN.md Updates
- Sections changed:
	- Execution checklist interpretation for interactivity and subscription readiness.
