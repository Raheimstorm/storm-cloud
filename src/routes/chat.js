// src/routes/chat.js
const express = require('express');
const router  = express.Router();
const brain   = require('../brain');
const { logAction, getActions } = require('../db');

// POST /api/chat
router.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'No message provided.' });

  const tokens    = req.session.googleTokens || null;
  const userEmail = req.session.userEmail || '';

  // Session-scoped conversation history (last 20 messages)
  if (!req.session.history) req.session.history = [];

  // Session-scoped pending confirmation
  const lower = message.toLowerCase().trim();
  const isConfirm = ['confirm', 'yes', 'go ahead', 'do it', 'proceed', 'confirmed'].includes(lower) || lower.startsWith('yes ');
  const isCancel  = ['cancel', 'no', 'abort', 'stop', 'never mind'].includes(lower) || lower.startsWith('no ');

  if (req.session.pendingAction) {
    if (isConfirm) return handleConfirm(req, res, tokens, userEmail);
    if (isCancel)  return handleCancel(req, res);
  }

  try {
    const result = await brain.handleMessage( req.session.history, tokens, userEmail);

    req.session.history = result.updatedHistory.slice(-20);

    if (result.pendingAction) {
      req.session.pendingAction = result.pendingAction;
    }

    logAction({
      type: 'command',
      input: message,
      output: result.response,
      status: result.needsConfirmation ? 'awaiting_confirmation' : 'completed',
      tools: result.actions?.map(a => a.tool) || []
    });

    res.json({
      response: result.response,
      actions: result.actions,
      needsConfirmation: !!result.needsConfirmation
    });

  } catch (err) {
    console.error('[brain error]', err.message);
    const msg = err.message.includes('API key')
      ? 'Claude API key missing or invalid. Check environment variables.'
      : `Error: ${err.message}`;
    logAction({ type: 'error', input: message, output: err.message, status: 'error' });
    res.status(500).json({ error: msg, response: msg });
  }
});

async function handleConfirm(req, res, tokens, userEmail) {
  const action = req.session.pendingAction;
  const history = req.session.history || [];
  req.session.pendingAction = null;

  try {
    const result = await brain.confirm(action, history, tokens, userEmail);
    req.session.history = result.updatedHistory.slice(-20);

    logAction({
      type: 'confirmed',
      input: `Confirmed: ${action.toolName}`,
      output: result.response,
      status: 'completed',
      tools: [action.toolName]
    });

    res.json({ response: result.response, actions: [{ tool: action.toolName, result: result.result }], needsConfirmation: false });
  } catch (err) {
    res.status(500).json({ error: err.message, response: `Failed: ${err.message}` });
  }
}

function handleCancel(req, res) {
  req.session.pendingAction = null;
  const response = "Action cancelled. What else can I help you with?";
  logAction({ type: 'cancelled', input: 'cancel', output: response, status: 'cancelled' });
  res.json({ response, actions: [], needsConfirmation: false });
}

// GET /api/actions
router.get('/actions', (req, res) => res.json(getActions(30)));

// GET /api/status
router.get('/status', (req, res) => {
  res.json({
    storm: 'online',
    brain: !!(process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.includes('YOUR')),
    tts: !!process.env.ELEVENLABS_API_KEY,
    google: !!req.session.googleTokens,
    email: req.session.userEmail || null,
    name: req.session.userName || null,
    googleConfigured: !!(process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.includes('YOUR'))
  });
});

module.exports = router;
