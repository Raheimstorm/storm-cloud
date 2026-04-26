// src/routes/auth.js — Google OAuth, stores tokens in session
const express = require('express');
const router  = express.Router();
const { getAuthUrl, exchangeCode } = require('../adapters/googleAuth');
const { google } = require('googleapis');
const { getAuthClient } = require('../adapters/googleAuth');

const isConfigured = () =>
  process.env.GOOGLE_CLIENT_ID &&
  !process.env.GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE');

// GET /auth/google — begin OAuth
router.get('/google', (req, res) => {
  if (!isConfigured()) {
    return res.send(`
      <!DOCTYPE html><html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Storm — Setup</title>
        <style>
          body { background: #060810; color: #e2e8f0; font-family: monospace; padding: 30px 20px; max-width: 600px; margin: 0 auto; }
          h2 { color: #00d4ff; } a { color: #00d4ff; }
          ol li { margin: 10px 0; color: #94a3b8; }
          code { background: #1e2640; padding: 3px 8px; border-radius: 4px; color: #fff; font-size: 0.9em; }
        </style>
      </head><body>
        <h2>⚡ Google Not Configured</h2>
        <p>Add these to your Railway environment variables:</p>
        <ol>
          <li>Go to <a href="https://console.cloud.google.com" target="_blank">console.cloud.google.com</a></li>
          <li>Create project → Enable <strong>Gmail API</strong>, <strong>Google Calendar API</strong>, <strong>Google Drive API</strong></li>
          <li>Credentials → OAuth 2.0 Client ID → Web application</li>
          <li>Authorised redirect URI: <code>${process.env.GOOGLE_REDIRECT_URI || 'https://YOUR-APP.railway.app/auth/google/callback'}</code></li>
          <li>Add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> to Railway Variables</li>
          <li>Redeploy and return here</li>
        </ol>
        <p><a href="/">← Back to Storm</a></p>
      </body></html>
    `);
  }

  const url = getAuthUrl();
  res.redirect(url);
});

// GET /auth/google/callback — exchange code for tokens, store in session
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect('/?auth_error=' + encodeURIComponent(error));
  }

  try {
    const tokens = await exchangeCode(code);

    // Fetch user profile to store email
    const auth = getAuthClient(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth });
    const profile = await oauth2.userinfo.get();

    req.session.googleTokens = tokens;
    req.session.userEmail    = profile.data.email;
    req.session.userName     = profile.data.name;

    res.redirect('/?auth_success=1');
  } catch (err) {
    console.error('[auth callback error]', err.message);
    res.redirect('/?auth_error=' + encodeURIComponent(err.message));
  }
});

// GET /auth/status
router.get('/status', (req, res) => {
  res.json({
    connected: !!req.session.googleTokens,
    email: req.session.userEmail || null,
    name: req.session.userName || null
  });
});

// POST /auth/disconnect
router.post('/disconnect', (req, res) => {
  req.session.destroy();
  res.json({ disconnected: true });
});

module.exports = router;
