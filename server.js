// server.js — Storm Cloud Server
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cors    = require('cors');
const path    = require('path');

const app = express();

// ── Trust proxy (required for Railway/Render HTTPS) ───────────────────────────
app.set('trust proxy', 1);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'storm-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', require('./src/routes/chat'));
app.use('/api', require('./src/routes/tts'));
app.use('/auth', require('./src/routes/auth'));

// ── Root ──────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[server error]', err);
  res.status(500).json({ error: err.message });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  const claudeOk  = process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.includes('YOUR');
  const elevenOk  = !!process.env.ELEVENLABS_API_KEY;
  const googleOk  = process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.includes('YOUR');

  console.log('\n  ⚡  ⚡  ⚡  ⚡  ⚡  ⚡  ⚡  ⚡  ⚡  ⚡');
  console.log('        S T O R M   C L O U D');
  console.log(`        Port: ${PORT}`);
  console.log('  ⚡  ⚡  ⚡  ⚡  ⚡  ⚡  ⚡  ⚡  ⚡  ⚡\n');
  console.log(`  ${claudeOk ? '✅' : '❌'} Claude API     ${claudeOk ? 'Ready' : '→ Set ANTHROPIC_API_KEY'}`);
  console.log(`  ${elevenOk ? '✅' : '❌'} ElevenLabs     ${elevenOk ? 'Ready' : '→ Set ELEVENLABS_API_KEY'}`);
  console.log(`  ${googleOk ? '✅' : '⏳'} Google OAuth   ${googleOk ? 'Configured' : '→ Set GOOGLE_CLIENT_ID + SECRET'}`);
  console.log('\n  Users connect Google at: /auth/google\n');
});
