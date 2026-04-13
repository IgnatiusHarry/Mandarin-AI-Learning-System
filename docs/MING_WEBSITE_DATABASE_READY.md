# Ming Ready Output: Website + Database

Dokumen ini adalah output eksekusi yang bisa langsung dipakai agar AI agent Ming bekerja end-to-end dengan website (frontend) dan database (Supabase).

## 1. Konfigurasi Environment

### Backend (`backend/.env`)

Gunakan nilai real production/staging:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_KEY=<service-role-key>
ANTHROPIC_API_KEY=<anthropic-key>
TELEGRAM_BOT_TOKEN=<telegram-bot-token>
OPENCLAW_API_SECRET=<shared-secret-openclaw>
CRON_SECRET=<cron-secret>
APP_ENV=production
FRONTEND_URL=https://<your-frontend-domain>
ENABLE_INTERNAL_SCHEDULER=false
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
BACKEND_API_URL=https://<your-backend-domain>
```

## 2. Jalankan Database Schema

Eksekusi SQL schema dari file berikut di Supabase SQL Editor:

- `sql/schema.sql`

Tujuan utama:
- tabel `profiles` menyimpan relasi `telegram_id` dan `supabase_auth_id`
- RLS aktif untuk akses data per user web

## 3. Jalankan Service

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 4. Integrasi Identity Telegram ↔ Web

Fitur yang sudah aktif:
- OpenClaw message payload bisa kirim `supabase_auth_id` opsional.
- Backend endpoint baru: `POST /api/profile/link-telegram`
- Frontend helper baru: `linkTelegram(token, telegramId)`

Flow yang direkomendasikan:
1. User login di web (Supabase Auth)
2. Frontend panggil `/api/profile/link-telegram` dengan Bearer token
3. User chat via Telegram/OpenClaw
4. Data belajar tersimpan di satu profile yang sama

## 5. Health Checks

Jalankan pengecekan berikut:

1. Backend health:
```bash
curl https://<your-backend-domain>/health
```

2. Endpoint web auth (contoh, pakai token user):
```bash
curl -X POST https://<your-backend-domain>/api/profile/link-telegram \
  -H "Authorization: Bearer <supabase-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"telegram_id": 841875314}'
```

3. OpenClaw webhook test:
```bash
curl -X POST https://<your-backend-domain>/api/message \
  -H "X-API-Key: <shared-secret-openclaw>" \
  -H "Content-Type: application/json" \
  -d '{"telegram_id": 841875314, "text": "/stats"}'
```

4. One-command smoke test (PowerShell):
```powershell
pwsh scripts/smoke_live_endpoints.ps1 \
  -BackendUrl "https://backend-blond-seven-35.vercel.app" \
  -FrontendUrl "https://frontend-six-weld-37.vercel.app"
```

Optional authenticated checks:
```powershell
pwsh scripts/smoke_live_endpoints.ps1 \
  -BackendUrl "https://backend-blond-seven-35.vercel.app" \
  -FrontendUrl "https://frontend-six-weld-37.vercel.app" \
  -OpenClawApiKey "<OPENCLAW_API_SECRET>" \
  -SupabaseAccessToken "<SUPABASE_USER_ACCESS_TOKEN>" \
  -TelegramId 841875314
```

## 6. Definition of Done

Ming dianggap siap pakai website + database jika:
- Login web berhasil (Supabase)
- Dashboard/review/conversation mengambil data tanpa error 401/403
- `/api/profile/link-telegram` mengembalikan `status: ok`
- Data Telegram dan data web terbaca sebagai satu user profile
