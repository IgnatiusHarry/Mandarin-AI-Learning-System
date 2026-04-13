# Upgrade: duolingo interactive loop hardening

- Date: 2026-04-13
- Owner: Copilot
- Status: shipped

## Background
Plan alignment required for Duolingo-style daily loop with explicit cron behavior and operational workflow for future upgrades.

## Scope
- Sync root PLAN.md to v1.0 roadmap and daily flow vision.
- Add internal APScheduler support for automatic morning/evening cron jobs.
- Refactor cron endpoint logic into reusable job services.
- Add upgrade governance docs + automation script.

## Affected Areas
- Frontend: documentation update in README.
- Backend: scheduler wiring, cron jobs service, requirements, config.
- Database: no schema change.
- Telegram bot: reminder/summary messages improved through cron jobs.
- AI flow: no direct model/prompt change in this upgrade.

## Implementation Plan
1. Update PLAN.md and define continuous upgrade process.
2. Implement APScheduler and shared cron jobs.
3. Validate backend health and cron route availability in production.

## Verification
- Local checks:
	- No diagnostics errors on updated backend files.
	- `bash -n scripts/register_upgrade.sh` succeeded.
	- `bash scripts/register_upgrade.sh "duolingo interactive loop hardening"` succeeded.
- Production checks:
	- backend `/health` responds 200.
	- frontend proxy `/api/backend/health` responds 200.

## Rollback Plan
Revert scheduler files and main lifespan integration, then redeploy backend.

## PLAN.md Updates
- Sections changed:
	- Architecture Summary
	- Execution Checklist
	- Daily User Flow
	- Continuous Update System
