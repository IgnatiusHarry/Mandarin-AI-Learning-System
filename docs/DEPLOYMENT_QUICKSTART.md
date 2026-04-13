# Ming Laoshi Production Deployment Quickstart

**Document:** Mandarin AI Learning System Deployment Guide  
**Target:** Full production integration (OpenClaw + Supabase + Web)  
**Owner:** Mythief (Ignatius Harry)  
**Status:** READY FOR EXECUTION  

---

## 📋 Pre-Deployment Checklist

Before you start, ensure you have:

- [ ] GitHub repo cloned locally: `https://github.com/IgnatiusHarry/Mandarin-AI-Learning-System.git`
- [ ] Branch: `feature/mandarin-learning-upgrade`
- [ ] Supabase account (free tier sufficient for MVP)
- [ ] Vercel account (for frontend)
- [ ] Railway.app account OR VPS access (for backend)
- [ ] Anthropic API key (Claude)
- [ ] Telegram Bot Token (from @BotFather)
- [ ] OpenClaw API Secret (from your OpenClaw deployment)

---

## 🔧 Step 1: Supabase Project Setup (20 min)

### 1.1 Create Project
```bash
# Go to https://supabase.com
# Click "New Project"
# Fill in:
#   Organization: <your org>
#   Name: mandarin-ai-learning
#   Database Password: <strong password>
#   Region: Singapore (closest to Taiwan)
# Wait 5-10 min for project to initialize
```

### 1.2 Get Project Credentials
```bash
# In Supabase dashboard:
# 1. Go to Settings > API
# 2. Copy:
#    - Project URL → SUPABASE_URL
#    - anon public key → SUPABASE_ANON_KEY
#    - service_role key → SUPABASE_SERVICE_KEY
# 3. Go to Auth > Providers > Email
#    - Ensure "Email/Password" is enabled
```

### 1.3 Run Schema
```bash
# In Supabase dashboard:
# 1. Go to SQL Editor
# 2. Click "New Query"
# 3. Paste entire contents of: sql/schema.sql (from repo)
# 4. Click "Run"
# 5. Wait for completion (should be <10 sec)

# Verify: In Table Editor, you should see:
# - profiles
# - vocabulary
# - user_reviews
# - conversations
# - conversation_messages
# - review_sessions
# - daily_goals
```

### 1.4 Enable RLS (Row Level Security)
```bash
# Already enabled in schema.sql
# Verify by going to Auth > Policies
# Each table should have "own data" policy
```

---

## 🖥️ Step 2: Backend Deployment (40 min)

### Option A: Railway.app (Recommended - Simplest)

#### 2A.1 Prepare Repository
```bash
cd /path/to/Mandarin-AI-Learning-System
git branch -M feature/mandarin-learning-upgrade main-deploy
git push origin main-deploy
```

#### 2A.2 Railway Setup
```bash
# 1. Go to https://railway.app
# 2. Click "Create New"
# 3. Select "Deploy from GitHub"
# 4. Authorize GitHub, select your repo
# 5. Select "Mandarin-AI-Learning-System"
# 6. Select main-deploy branch
# 7. Configure root directory: ./backend
# 8. Click "Deploy"
```

#### 2A.3 Environment Variables
```bash
# In Railway dashboard, go to your service > Variables
# Add all keys from backend/.env.example:

SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=<from Supabase settings>
SUPABASE_SERVICE_KEY=<from Supabase settings>
ANTHROPIC_API_KEY=sk-ant-<your-key>
TELEGRAM_BOT_TOKEN=<from @BotFather>
OPENCLAW_API_SECRET=<your-secret>
CRON_SECRET=<any-strong-string>
FRONTEND_URL=https://mandarin-learning.vercel.app  # or your domain
APP_ENV=production
```

#### 2A.4 Verify Deployment
```bash
# After Railway finishes deployment (~5 min):
# Get your backend URL from Railway dashboard (e.g., https://mandarin-prod-xyz.railway.app)

curl -X GET https://YOUR-RAILWAY-URL/health
# Expected: { "status": "ok", "service": "ming-laoshi" }
```

---

### Option B: Manual VPS (AWS EC2, DigitalOcean, etc.)

#### 2B.1 SSH into VPS
```bash
ssh -i <key.pem> ubuntu@<your-vps-ip>
sudo apt update && sudo apt upgrade -y
```

#### 2B.2 Install Dependencies
```bash
# Python 3.11+
sudo apt install -y python3.11 python3.11-venv python3-pip

# Create venv
python3.11 -m venv /opt/mandarin-env
source /opt/mandarin-env/bin/activate

# Clone repo
cd /opt
git clone https://github.com/IgnatiusHarry/Mandarin-AI-Learning-System.git
cd Mandarin-AI-Learning-System
git checkout feature/mandarin-learning-upgrade

# Install Python deps
cd backend
pip install -r requirements.txt
```

#### 2B.3 Create .env
```bash
# Create backend/.env
cat > backend/.env << 'EOF'
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=<from Supabase>
SUPABASE_SERVICE_KEY=<from Supabase>
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=...
OPENCLAW_API_SECRET=...
CRON_SECRET=...
FRONTEND_URL=https://mandarin-learning.vercel.app
APP_ENV=production
EOF
```

#### 2B.4 Run with Systemd
```bash
# Create service file
sudo cat > /etc/systemd/system/mandarin.service << 'EOF'
[Unit]
Description=Ming Laoshi Backend
After=network.target

[Service]
Type=notify
User=ubuntu
WorkingDirectory=/opt/Mandarin-AI-Learning-System/backend
Environment="PATH=/opt/mandarin-env/bin"
EnvironmentFile=/opt/Mandarin-AI-Learning-System/backend/.env
ExecStart=/opt/mandarin-env/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable mandarin
sudo systemctl start mandarin
sudo systemctl status mandarin

# Verify logs
journalctl -u mandarin -f
```

#### 2B.5 Nginx Reverse Proxy
```bash
sudo apt install -y nginx

sudo cat > /etc/nginx/sites-available/mandarin << 'EOF'
server {
    listen 80;
    server_name mandarin-backend.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/mandarin /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Enable HTTPS (optional but recommended)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d mandarin-backend.yourdomain.com
```

#### 2B.6 Test
```bash
curl -X GET https://mandarin-backend.yourdomain.com/health
# Expected: { "status": "ok", "service": "ming-laoshi" }
```

---

## 🌐 Step 3: Frontend Deployment (20 min)

### 3.1 Vercel Setup
```bash
# 1. Go to https://vercel.com
# 2. Click "Add New" > "Project"
# 3. Import your GitHub repo
# 4. Select root directory: ./frontend
# 5. Configure env vars
```

### 3.2 Environment Variables (Vercel)
```bash
# In Vercel project settings > Environment Variables

NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase>
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND-URL  # from Railway or your VPS
```

### 3.3 Deploy
```bash
# Click "Deploy"
# Wait 2-3 min for build + deployment

# After completion, Vercel will give you a domain:
# https://mandarin-learning-XXXXX.vercel.app
```

### 3.4 Verify
```bash
# Open in browser: https://mandarin-learning-XXXXX.vercel.app
# You should see login page (if UI exists)
# Check browser console for errors
```

---

## 🔗 Step 4: Integration Testing (30 min)

### Test 1: Health Check
```bash
BACKEND_URL="https://YOUR-BACKEND-URL"

curl -X GET $BACKEND_URL/health
# Expected: { "status": "ok", "service": "ming-laoshi" }
```

### Test 2: OpenClaw Integration
```bash
BACKEND_URL="https://YOUR-BACKEND-URL"
OPENCLAW_SECRET="<your-secret>"

curl -X POST $BACKEND_URL/api/message \
  -H "X-API-Key: $OPENCLAW_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "telegram_id": 841875314,
    "text": "我學習了新詞：學習",
    "message_type": "text"
  }'

# Expected: { "reply_text": "...", "parse_mode": "Markdown" }
# Side effect: New vocabulary row in Supabase
```

### Test 3: JWT/Web Auth
```bash
# 1. Go to web app: https://mandarin-learning-XXXXX.vercel.app
# 2. Click "Sign Up" → enter email + password
# 3. Check email for magic link, click it
# 4. Browser stores JWT in localStorage
# 5. Try loading dashboard (should show stats)
# 6. Open browser DevTools > Network:
#    - Find request to /api/stats
#    - Header: Authorization: Bearer <token>
#    - Should return user data
```

### Test 4: Identity Linking
```bash
# 1. User logs in web app → gets supabase_auth_id
# 2. Link telegram via API:

BACKEND_URL="https://YOUR-BACKEND-URL"
JWT_TOKEN="<from-step-3>"
TELEGRAM_ID=841875314

curl -X POST $BACKEND_URL/api/profile/link-telegram \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{ \"telegram_id\": $TELEGRAM_ID }"

# Expected: { "status": "ok", "profile_id": "...", "telegram_id": 841875314 }
# Side effect: profile.telegram_id set to 841875314

# Verify: Both Telegram messages and web requests now see same user profile
```

### Test 5: Conversation Flow
```bash
# 1. Start conversation
curl -X POST $BACKEND_URL/api/conversation/start \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "topic": "daily routine", "source": "web" }'
# Response: { "id": "<conversation-id>", "user_id": "...", ... }

# 2. Send message
CONVO_ID="<from-step-1>"
curl -X POST $BACKEND_URL/api/conversation/message \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"conversation_id\": \"$CONVO_ID\",
    \"content\": \"今天我想練習口說\"
  }"
# Response: { "role": "user", "content": "...", ... } + AI response

# 3. Get history
curl -X GET "$BACKEND_URL/api/conversation/history?conversation_id=$CONVO_ID" \
  -H "Authorization: Bearer $JWT_TOKEN"
# Response: [ { "role": "user", "content": "..." }, { "role": "assistant", "content": "..." } ]
```

---

## 🔔 Step 5: OpenClaw Webhook Configuration

### 5.1 Set OpenClaw Message Handler
```bash
# In your OpenClaw deployment:
# 1. Open OpenClaw config/plugins
# 2. Find "HTTP" or "webhook" plugin
# 3. Configure POST endpoint:
#    URL: https://YOUR-BACKEND-URL/api/message
#    Method: POST
#    Header: X-API-Key: <OPENCLAW_API_SECRET>
#    Body template: { "telegram_id": $SENDER_ID, "text": $MESSAGE_TEXT, "message_type": "text" }
```

### 5.2 Test Integration
```bash
# In Telegram:
# 1. Send message to your bot: "我今天學習了5個新詞"
# 2. OpenClaw captures it
# 3. Forwards to backend /api/message
# 4. Backend replies with vocabulary breakdown
# 5. OpenClaw returns reply to Telegram
```

---

## 📊 Step 6: Data Validation

### 6.1 Check Database Health
```sql
-- In Supabase SQL Editor:

-- Count rows
SELECT 'profiles' AS table_name, COUNT(*) FROM profiles
UNION ALL
SELECT 'vocabulary', COUNT(*) FROM vocabulary
UNION ALL
SELECT 'user_reviews', COUNT(*) FROM user_reviews
UNION ALL
SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL
SELECT 'conversation_messages', COUNT(*) FROM conversation_messages;

-- Check for orphans
SELECT * FROM vocabulary WHERE user_id NOT IN (SELECT id FROM profiles);
SELECT * FROM user_reviews WHERE user_id NOT IN (SELECT id FROM profiles);

-- Verify identity linking
SELECT id, supabase_auth_id, telegram_id FROM profiles LIMIT 5;
```

### 6.2 Memory Preservation Check
```bash
# Document baseline row counts before any data migrations
# After migration, re-run counts and verify no unexpected deletes

# Example baseline:
# profiles: 1
# vocabulary: 0
# user_reviews: 0
# conversations: 0
```

---

## 🚨 Troubleshooting

### Problem: Backend /health returns 502 Bad Gateway

**Diagnosis:**
```bash
# Check if service is running
systemctl status mandarin  # if VPS
# OR check Railway dashboard for errors

# Check logs
journalctl -u mandarin -n 50  # VPS
# OR Railway logs in dashboard
```

**Solutions:**
1. Verify env vars are set correctly
2. Check Supabase URL is reachable: `curl https://YOUR-SUPABASE-URL/auth/v1/health`
3. Restart service: `systemctl restart mandarin`

---

### Problem: /api/message returns 401 Invalid API key

**Diagnosis:**
```bash
# Verify secret matches
echo "Backend secret: $OPENCLAW_API_SECRET"
echo "Header sent: X-API-Key: ..."
```

**Solution:**
1. Ensure exact match (no whitespace)
2. Re-check env var in Railway/VPS

---

### Problem: Web app shows "Cannot fetch /api/stats"

**Diagnosis:**
```bash
# Check CORS
curl -X OPTIONS https://YOUR-BACKEND-URL/api/stats \
  -H "Origin: https://mandarin-learning-XXXXX.vercel.app" \
  -v

# Should include: Access-Control-Allow-Origin: https://mandarin-learning-XXXXX.vercel.app
```

**Solution:**
1. Ensure `FRONTEND_URL` in backend .env matches your Vercel domain exactly
2. Redeploy backend

---

### Problem: Conversation returns "Invalid or expired token"

**Diagnosis:**
```bash
# Check JWT validity
curl -X GET https://YOUR-SUPABASE-URL/auth/v1/user \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY"
# Should return user info, not 401
```

**Solution:**
1. Token may have expired (Supabase tokens last ~1 hour)
2. User needs to log out and log back in

---

## ✅ Production Readiness Checklist

After all steps, verify:

- [ ] Supabase project created and schema deployed
- [ ] Backend deployed (Railway or VPS) and /health returns ok
- [ ] Frontend deployed to Vercel
- [ ] All env vars set and reachable
- [ ] /api/message accepts OpenClaw requests with valid secret
- [ ] Web login creates Supabase auth user
- [ ] /api/stats returns user data when authenticated
- [ ] Conversation flow works (start → message → history)
- [ ] Identity linking works (telegram_id ↔ supabase_auth_id)
- [ ] Database has no orphan rows
- [ ] Historical data preserved (row counts stable)
- [ ] OpenClaw webhook configured and tested

---

## 🎉 Congratulations!

You now have a fully integrated system:

```
Telegram/OpenClaw
        ↓
    /api/message (X-API-Key auth)
        ↓
Backend (FastAPI)
        ↓
Supabase (unified profile + data)
        ↓
Web App (Next.js, JWT auth)
```

**Next:** Create a monitoring dashboard to track usage, errors, and user progress.

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-13  
**Status:** READY FOR PRODUCTION DEPLOYMENT

