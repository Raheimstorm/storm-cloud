// src/routes/tts.js
const express = require('express');
const router  = express.Router();
const { generateSpeech } = require('../tts');

router.post('/tts', async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'No text.' });

  try {
    const audio = await generateSpeech(text.slice(0, 1000));
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', audio.length);
    res.send(audio);
  } catch (err) {
    console.error('[TTS]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
