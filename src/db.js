// src/db.js — In-memory action log (cloud-safe, no disk writes)
const log = [];

function logAction({ type, input, output, status = 'completed', tools = [] }) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    type,
    input: typeof input === 'string' ? input.slice(0, 200) : input,
    output: typeof output === 'string' ? output.slice(0, 300) : output,
    status,
    tools
  };
  log.unshift(entry);
  if (log.length > 100) log.pop();
  return entry;
}

function getActions(limit = 30) {
  return log.slice(0, limit);
}

module.exports = { logAction, getActions };
