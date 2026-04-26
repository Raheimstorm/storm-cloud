// src/adapters/calendar.js
const { google } = require('googleapis');
const { getAuthClient } = require('./googleAuth');

async function listEvents(tokens, { days_ahead = 7, max_results = 10 } = {}) {
  const auth = getAuthClient(tokens);
  const calendar = google.calendar({ version: 'v3', auth });

  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + days_ahead);

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    maxResults: max_results,
    singleEvents: true,
    orderBy: 'startTime'
  });

  const events = (res.data.items || []).map(e => ({
    id: e.id,
    title: e.summary || '(No title)',
    start: e.start.dateTime || e.start.date,
    end: e.end.dateTime || e.end.date,
    location: e.location || null,
    attendees: (e.attendees || []).map(a => a.email)
  }));

  return { events, total: events.length, range: `Next ${days_ahead} days` };
}

async function createEvent(tokens, { title, date, start_time, duration_minutes = 60, description = '' }) {
  const auth = getAuthClient(tokens);
  const calendar = google.calendar({ version: 'v3', auth });

  const startISO = `${date}T${start_time}:00`;
  const startDate = new Date(startISO);
  const endDate = new Date(startDate.getTime() + duration_minutes * 60000);

  // Check conflicts
  const conflicts = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: true
  });
  const conflicting = conflicts.data.items || [];

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: title,
      description,
      start: { dateTime: startISO, timeZone: tz },
      end: { dateTime: endDate.toISOString().slice(0, 19), timeZone: tz }
    }
  });

  return {
    success: true,
    eventId: res.data.id,
    title, start: startISO,
    conflictWarning: conflicting.length > 0
      ? `⚠ ${conflicting.length} existing event(s) overlap: ${conflicting.map(e => e.summary).join(', ')}`
      : null
  };
}

async function deleteEvent(tokens, { event_id }) {
  const auth = getAuthClient(tokens);
  const calendar = google.calendar({ version: 'v3', auth });

  const event = await calendar.events.get({ calendarId: 'primary', eventId: event_id });
  await calendar.events.delete({ calendarId: 'primary', eventId: event_id });

  return {
    success: true,
    deleted: event.data.summary,
    start: event.data.start.dateTime || event.data.start.date
  };
}

module.exports = { listEvents, createEvent, deleteEvent };
