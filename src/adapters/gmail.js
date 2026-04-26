// src/adapters/gmail.js
const { google } = require('googleapis');
const { getAuthClient } = require('./googleAuth');

function decodeBody(raw) {
  if (!raw) return '';
  const decoded = Buffer.from(raw, 'base64').toString('utf8');
  return decoded
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s{2,}/g, ' ').trim().slice(0, 2000);
}

function getHeader(headers, name) {
  const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

async function readEmails(tokens, { count = 5, query = '' } = {}) {
  const auth = getAuthClient(tokens);
  const gmail = google.gmail({ version: 'v1', auth });

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    maxResults: Math.min(count, 20),
    q: query || 'in:inbox'
  });

  const messages = listRes.data.messages || [];
  if (!messages.length) return { emails: [], total: 0 };

  const emails = await Promise.all(messages.map(async ({ id }) => {
    const msg = await gmail.users.messages.get({
      userId: 'me', id, format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date']
    });
    const headers = msg.data.payload.headers;
    return {
      id,
      from: getHeader(headers, 'From'),
      subject: getHeader(headers, 'Subject'),
      date: getHeader(headers, 'Date'),
      snippet: (msg.data.snippet || '').slice(0, 120) + '...'
    };
  }));

  return { emails, total: emails.length };
}

async function readEmailBody(tokens, { email_id }) {
  const auth = getAuthClient(tokens);
  const gmail = google.gmail({ version: 'v1', auth });

  const msg = await gmail.users.messages.get({ userId: 'me', id: email_id, format: 'full' });
  const headers = msg.data.payload.headers;

  function extractBody(payload) {
    if (payload.body?.data) return decodeBody(payload.body.data);
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) return decodeBody(part.body.data);
      }
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) return decodeBody(part.body.data);
      }
    }
    return '[Could not extract body]';
  }

  return {
    id: email_id,
    from: getHeader(headers, 'From'),
    subject: getHeader(headers, 'Subject'),
    date: getHeader(headers, 'Date'),
    body: extractBody(msg.data.payload)
  };
}

async function sendEmail(tokens, { to, subject, body }) {
  const auth = getAuthClient(tokens);
  const gmail = google.gmail({ version: 'v1', auth });

  const profile = await gmail.users.getProfile({ userId: 'me' });
  const from = profile.data.emailAddress;

  const raw = Buffer.from(
    `From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}`
  ).toString('base64url');

  const result = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  return { success: true, messageId: result.data.id, from, to, subject };
}

async function archiveEmail(tokens, { email_id }) {
  const auth = getAuthClient(tokens);
  const gmail = google.gmail({ version: 'v1', auth });
  await gmail.users.messages.modify({
    userId: 'me', id: email_id,
    requestBody: { removeLabelIds: ['INBOX'] }
  });
  return { success: true, email_id, action: 'archived' };
}

module.exports = { readEmails, readEmailBody, sendEmail, archiveEmail };
