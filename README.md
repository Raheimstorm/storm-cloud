# ⚡ STORM CLOUD — Deployment Guide
## Works on any device — Android, iPhone, Desktop, Tablet

---

## What Changed from v1 (local) → v2 (cloud)

| v1 Local                  | v2 Cloud                        |
|---------------------------|---------------------------------|
| Runs on your PC only      | Runs anywhere — any browser     |
| Local file system         | Google Drive (better on mobile) |
| Tokens stored in JSON file| Tokens stored in session        |
| No HTTPS needed           | HTTPS required (Railway handles it) |

---

## Deploy to Railway (Recommended — Free Tier Available)

### Step 1 — Push to GitHub

```bash
# In the storm-cloud folder:
git init
git add .
git commit -m "Storm Cloud v2"

# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/storm-cloud.git
git push -u origin main
```

### Step 2 — Deploy on Railway

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select your `storm-cloud` repo
3. Railway auto-detects Node.js and deploys

### Step 3 — Set Environment Variables in Railway

Go to your project → Variables tab → Add each:

```
ANTHROPIC_API_KEY      = sk-ant-api03-X6Sz7dS-...  (your Claude key)
ELEVENLABS_API_KEY     = 5d0b515c103f550e06c8d...   (already set)
ELEVENLABS_VOICE_ID    = qsiRIDxZEoXB7eXEuRFz       (Storm's voice)
ELEVENLABS_MODEL       = eleven_turbo_v2_5
GOOGLE_CLIENT_ID       = (from Google Cloud Console)
GOOGLE_CLIENT_SECRET   = (from Google Cloud Console)
GOOGLE_REDIRECT_URI    = https://YOUR-APP.railway.app/auth/google/callback
SESSION_SECRET         = (run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
NODE_ENV               = production
```

> Railway auto-sets PORT — do not add it manually.

### Step 4 — Get Your Live URL

Railway gives you a URL like:
```
https://storm-cloud-production-xxxx.railway.app
```
Open this on **any device** — phone, tablet, desktop. Storm works everywhere.

---

## Google OAuth Setup (Gmail + Calendar + Drive)

### Step 1 — Create Google Cloud Project
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. New Project → name it "Storm"

### Step 2 — Enable APIs
APIs & Services → Library → Enable each:
- **Gmail API**
- **Google Calendar API**
- **Google Drive API**

### Step 3 — Configure OAuth Consent Screen
APIs & Services → OAuth Consent Screen:
- User Type: External
- App name: Storm
- Add your email as test user

### Step 4 — Create OAuth Credentials
APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID:
- Application type: **Web application**
- Authorised redirect URI:
  ```
  https://YOUR-APP.railway.app/auth/google/callback
  ```
  (also add `http://localhost:3000/auth/google/callback` for local testing)

### Step 5 — Copy credentials to Railway Variables
```
GOOGLE_CLIENT_ID     = 123456789-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET = GOCSPX-xxxxxxxxxxxx
GOOGLE_REDIRECT_URI  = https://YOUR-APP.railway.app/auth/google/callback
```

### Step 6 — Connect on your phone
1. Open your Railway URL in Chrome on Android
2. Tap "Connect Google" → authorise
3. All three dots (AI, VOICE, GOOGLE) go green
4. Storm is live

---

## Using Storm on Android

### Add to Home Screen (PWA-style)
1. Open your Railway URL in Chrome
2. Tap menu (⋮) → "Add to Home screen"
3. Storm appears as an app icon
4. Opens full-screen, no browser UI

### Voice Commands
- **Tap and hold** the mic button to speak
- **Release** to send
- Alternatively type in the text box

### Example Commands
```
"List my Drive files"
"Search Drive for project proposal"
"Read my last 5 emails"
"What's on my calendar this week?"
"Create a meeting called Weekly Sync on Friday at 10am"
"Send an email to john@gmail.com about the project update"
"Create a file called ideas.txt with the content innovation pipeline"
```

---

## Local Development (optional)

```bash
npm install
# Edit .env — set GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
npm start
# Open http://localhost:3000 in Chrome
```

---

## Architecture

```
Android Chrome / Any Browser
        ↕ HTTPS
Railway Cloud Server (Node.js + Express)
        ├── Sessions (express-session)
        ├── Claude API (brain — reasoning + tool use)
        ├── ElevenLabs API (Storm's voice)
        └── Google APIs
            ├── Gmail API
            ├── Calendar API
            └── Drive API
```

---

## Security Notes

- Google tokens are stored in server-side sessions (not in the browser)
- Sessions expire after 30 days — user reconnects via /auth/google
- SESSION_SECRET must be a strong random string in production
- Never commit .env to git — it's in .gitignore
- **Rotate your Claude and ElevenLabs keys** — they were shared in chat

---

## Troubleshooting

**"Connect Google" does nothing:**
→ GOOGLE_CLIENT_ID not set in Railway Variables. Check the Setup section.

**Voice not working on Android:**
→ Must use Chrome. Open the URL in Chrome, not Samsung Browser or Firefox.
→ Allow microphone when Chrome prompts.

**Storm says "Claude API key missing":**
→ ANTHROPIC_API_KEY not set in Railway Variables.

**Google auth fails with redirect_uri_mismatch:**
→ GOOGLE_REDIRECT_URI in Railway must exactly match what's in Google Cloud Console.
→ Copy-paste exactly — no trailing slashes.

**Session lost after Railway redeploy:**
→ Normal — users re-authenticate via /auth/google. Sessions don't persist across server restarts without a Redis store.

---

## File Structure

```
storm-cloud/
├── server.js                      # Express + session server
├── package.json
├── railway.json                   # Railway deployment config
├── Procfile                       # Render/Heroku compatibility
├── .env                           # Local dev config (never commit)
├── .gitignore
├── README.md
│
├── src/
│   ├── brain.js                   # Claude agentic loop
│   ├── tools.js                   # Tool definitions (Drive/Gmail/Calendar)
│   ├── executor.js                # Tool dispatcher + confirmation gate
│   ├── tts.js                     # ElevenLabs TTS
│   ├── db.js                      # In-memory action log
│   │
│   ├── adapters/
│   │   ├── googleAuth.js          # Shared OAuth2 client
│   │   ├── drive.js               # Google Drive adapter
│   │   ├── gmail.js               # Gmail adapter
│   │   └── calendar.js            # Calendar adapter
│   │
│   └── routes/
│       ├── chat.js                # /api/chat — main command endpoint
│       ├── tts.js                 # /api/tts — voice synthesis
│       └── auth.js                # /auth/google — OAuth flow
│
└── public/
    ├── index.html                 # Storm UI (mobile-first)
    └── client.js                  # Voice pipeline + UI logic
```
