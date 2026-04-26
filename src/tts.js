// src/tts.js
const fetch = require('node-fetch');

async function generateSpeech(text) {
  const apiKey  = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const model   = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5';

  const cleaned = text
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1').replace(/#{1,6}\s/g, '')
    .replace(/\n{2,}/g, '. ').replace(/\n/g, ' ')
    .replace(/[⚡⚠️✅❌🔥]/g, '').trim();

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({
      text: cleaned,
      model_id: model,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.80,
        style: 0.25,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs ${response.status}: ${err}`);
  }

  return response.buffer();
}

module.exports = { generateSpeech };
