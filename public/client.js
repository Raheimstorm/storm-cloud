// client.js — Storm Cloud frontend (mobile-first)
'use strict';

// ── STATE ────────────────────────────────────────────────────────────────────
const S = { IDLE:'idle', LISTENING:'listening', PROCESSING:'processing', SPEAKING:'speaking', CONFIRMING:'confirming' };
let state        = S.IDLE;
let isMuted      = false;
let recognition  = null;
let voiceOk      = false;
let currentAudio = null;
let isConnected  = false; // Google connected

// ── DOM ──────────────────────────────────────────────────────────────────────
const $body       = document.body;
const $stateLabel = document.getElementById('state-label');
const $conv       = document.getElementById('conv');
const $micBtn     = document.getElementById('mic-btn');
const $textInput  = document.getElementById('text-input');
const $toast      = document.getElementById('toast');
const $noSpeech   = document.getElementById('no-speech');
const $overlay    = document.getElementById('auth-overlay');
const $userBadge  = document.getElementById('user-badge');
const $connectBtn = document.getElementById('connect-btn');
const $dBrain     = document.getElementById('d-brain');
const $dTts       = document.getElementById('d-tts');
const $dGoogle    = document.getElementById('d-google');

// ── STATE MACHINE ─────────────────────────────────────────────────────────────
function setState(s) {
  state = s;
  $body.className = s;
  $stateLabel.textContent = s.toUpperCase();
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg, ms = 3500) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), ms);
}

// ── MESSAGES ──────────────────────────────────────────────────────────────────
function addMsg(text, type = 'storm') {
  const el = document.createElement('div');
  el.className = `msg ${type}`;
  el.textContent = text;
  $conv.appendChild(el);

  // Keep last 6 messages
  const all = $conv.querySelectorAll('.msg');
  if (all.length > 6) {
    all[0].style.transition = 'opacity 0.3s';
    all[0].style.opacity = '0';
    setTimeout(() => all[0].remove(), 300);
  }
  $conv.scrollTop = $conv.scrollHeight;
}

// ── TTS ───────────────────────────────────────────────────────────────────────
async function speak(text) {
  if (isMuted || !text) return;
  window.speechSynthesis.cancel();
  const cleaned = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();
  setState(S.SPEAKING);
  await new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = resolve;
    utterance.onerror = resolve;
    window.speechSynthesis.speak(utterance);
  });
  if (state === S.SPEAKING) setState(S.IDLE);
}


// ── COMMAND PROCESSOR ─────────────────────────────────────────────────────────
async function processCommand(text) {
  if (!text.trim()) return;
  if (state === S.PROCESSING) return;

  addMsg(text, 'user');
  setState(S.PROCESSING);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();

    if (!res.ok) {
      const errText = data.response || data.error || 'Server error';
      addMsg(errText, 'error');
      await speak(errText);
      setState(S.IDLE);
      return;
    }

    const reply = data.response || 'Done.';

    if (data.needsConfirmation) {
      addMsg(reply, 'confirm-prompt');
      setState(S.CONFIRMING);
      await speak(reply);
      // stays CONFIRMING — awaiting confirm/cancel
    } else {
      addMsg(reply, 'storm');
      await speak(reply);
      setState(S.IDLE);
    }

  } catch (err) {
    console.error('[processCommand]', err);
    addMsg('Connection error. Check that Storm is running.', 'error');
    setState(S.IDLE);
  }
}

// ── CONFIRM / CANCEL ──────────────────────────────────────────────────────────
async function sendConfirm() {
  setState(S.PROCESSING);
  await processCommand('confirm');
}
async function sendCancel() {
  setState(S.PROCESSING);
  await processCommand('cancel');
}

// ── TEXT INPUT ────────────────────────────────────────────────────────────────
function sendText() {
  const text = $textInput.value.trim();
  if (!text) return;
  $textInput.value = '';
  processCommand(text);
}
$textInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); }
});

// ── SPEECH RECOGNITION ────────────────────────────────────────────────────────
function initSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    $noSpeech.style.display = 'block';
    return;
  }
  voiceOk = true;
  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = e => {
    stopListen();
    processCommand(e.results[0][0].transcript);
  };
  recognition.onerror = e => {
    stopListen();
    if (e.error === 'no-speech') { toast('No speech detected — try again'); setState(S.IDLE); }
    else if (e.error === 'not-allowed') { $noSpeech.style.display = 'block'; toast('Microphone blocked — check browser permissions'); }
  };
  recognition.onend = () => {
    if (state === S.LISTENING) setState(S.IDLE);
  };
}

function startListen() {
  if (!voiceOk || isMuted) return;
  if (state === S.PROCESSING || state === S.SPEAKING || state === S.LISTENING) return;
  // Stop current audio so user can interrupt Storm
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  setState(S.LISTENING);
  $micBtn.classList.add('active');
  try { recognition.start(); } catch { /* already running */ }
}

function stopListen() {
  $micBtn.classList.remove('active');
  try { recognition.stop(); } catch {}
}

// ── MIC BUTTON — hold to talk ─────────────────────────────────────────────────
$micBtn.addEventListener('mousedown', e => { e.preventDefault(); startListen(); });
$micBtn.addEventListener('touchstart', e => { e.preventDefault(); startListen(); }, { passive: false });
document.addEventListener('mouseup', stopListen);
document.addEventListener('touchend', stopListen);

// Spacebar shortcut (desktop)
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); startListen(); }
  if (e.code === 'Enter' && state === S.CONFIRMING) sendConfirm();
  if (e.code === 'Escape' && state === S.CONFIRMING) sendCancel();
});
document.addEventListener('keyup', e => {
  if (e.code === 'Space') stopListen();
});

// ── MUTE ──────────────────────────────────────────────────────────────────────
function toggleMute() {
  isMuted = !isMuted;
  const btn = document.getElementById('mute-btn');
  document.getElementById('vol-waves').style.display = isMuted ? 'none' : 'block';
  document.getElementById('mute-x1').style.display   = isMuted ? 'block' : 'none';
  document.getElementById('mute-x2').style.display   = isMuted ? 'block' : 'none';
  btn.classList.toggle('muted', isMuted);
  if (isMuted && currentAudio) { currentAudio.pause(); currentAudio = null; setState(S.IDLE); }
  toast(isMuted ? 'Storm muted' : 'Storm unmuted');
}

// ── GOOGLE AUTH ───────────────────────────────────────────────────────────────
function connectGoogle() {
  window.location.href = '/auth/google';
}
function dismissOverlay() {
  $overlay.classList.remove('show');
  toast('Running without Google — voice and text only');
}

// ── STATUS POLLING ────────────────────────────────────────────────────────────
function setDot(el, status) {
  el.className = 'sdot ' + (status === true ? 'ok' : status === false ? 'err' : 'warn');
}

async function pollStatus() {
  try {
    const res  = await fetch('/api/status', { credentials: 'same-origin' });
    const data = await res.json();

    setDot($dBrain,  data.brain);
    setDot($dTts,    data.tts);
    setDot($dGoogle, data.google);

    isConnected = data.google;

    if (data.google && data.email) {
      // Show user badge, update connect button
      const short = data.name || data.email.split('@')[0];
      $userBadge.textContent = '✓ ' + short;
      $userBadge.style.display = 'block';
      $connectBtn.textContent = 'Connected';
      $connectBtn.classList.add('connected');
      $overlay.classList.remove('show');
    }

    // Show auth overlay if Google not configured at all
    if (!data.googleConfigured) {
      // Google OAuth not set up yet — don't show overlay, just show status
    }

  } catch { /* silent */ }
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
async function boot() {
  initSpeech();
  await pollStatus();

  // Check URL params for auth result
  const params = new URLSearchParams(window.location.search);
  if (params.get('auth_success')) {
    toast('Google account connected!', 4000);
    window.history.replaceState({}, '', '/');
    await pollStatus();
  }
  if (params.get('auth_error')) {
    toast('Google auth failed: ' + params.get('auth_error'), 5000);
    window.history.replaceState({}, '', '/');
  }

  // Show connect overlay only if google not connected and not dismissed
  if (!isConnected && !sessionStorage.getItem('overlay_dismissed')) {
    setTimeout(() => $overlay.classList.add('show'), 800);
  }

  // Poll every 20s
  setInterval(pollStatus, 20000);

  // Boot greeting
  setTimeout(async () => {
    const greeting = isConnected
      ? "Storm online. Gmail, Calendar, and Drive are connected. What do you need?"
      : "Storm online. Connect your Google account to access Gmail, Calendar, and Drive.";
    addMsg(greeting, 'storm');
    await speak(greeting);
  }, 500);
}

// Overlay dismiss also sets sessionStorage so it doesn't reappear on refresh
document.querySelector('.auth-skip')?.addEventListener('click', () => {
  sessionStorage.setItem('overlay_dismissed', '1');
});

boot();
