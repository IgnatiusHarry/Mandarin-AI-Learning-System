# Upgrade System

This document defines how feature or concept upgrades are managed continuously.

## Workflow
1. Register upgrade request.
2. Analyze impact (frontend, backend, database, Telegram flow, AI flow).
3. Implement in small releasable increments.
4. Verify locally and in production.
5. Update PLAN.md and upgrade note status.

## Required Artifacts Per Upgrade
- One file in `docs/upgrades/` generated from template
- Updated `PLAN.md` if scope or behavior changes
- Verification section with concrete checks

## Status Values
- `proposed`
- `in-progress`
- `blocked`
- `shipped`

## Minimum Verification
- Build/check command result
- Health endpoint check for backend if affected
- At least one user journey check for impacted feature

## Governance Rules
- Do not close an upgrade without verification evidence.
- Do not add feature scope without updating PLAN.md.
- Keep each upgrade small enough to ship safely.
