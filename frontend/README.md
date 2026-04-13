# Mandarin AI Learning System — Frontend

This frontend is the web dashboard and interactive learning UI for the Mandarin AI Learning System.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Required env values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `BACKEND_API_URL`

4. Run dev server:

```bash
npm run dev
```

Open http://localhost:3000

## Build Checks

```bash
npm run check:secrets
npm run build
```

## Production

Deployment target: Vercel

Important production env:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `BACKEND_API_URL`

## Plan and Upgrade Workflow

This project is governed by:
- root `PLAN.md`
- `docs/UPGRADE_SYSTEM.md`
- `docs/upgrades/`

When adding or changing features:

1. Register upgrade note:

```bash
bash scripts/register_upgrade.sh "feature title"
```

2. Update `PLAN.md` if flow/scope changes.
3. Implement + test.
4. Mark upgrade status in `docs/upgrades/`.

Do not ship feature changes without updating plan + upgrade records.
