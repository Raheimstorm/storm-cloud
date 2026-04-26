// src/adapters/drive.js — Google Drive operations for Storm Cloud
// Replaces the local filesystem adapter. Works from any device, anywhere.
const { google } = require('googleapis');
const { getAuthClient } = require('./googleAuth');

// ── HELPERS ──────────────────────────────────────────────────────────────────

function getDriveClient(tokens) {
  const auth = getAuthClient(tokens);
  return google.drive({ version: 'v3', auth });
}

// Convert bytes to human-readable
function formatSize(bytes) {
  if (!bytes) return 'unknown size';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// Strip HTML from Google Docs exports
function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 3000);
}

// ── LIST FILES ────────────────────────────────────────────────────────────────
async function listFiles(tokens, { folder = 'root', query = '' } = {}) {
  const drive = getDriveClient(tokens);

  let q = `'${folder}' in parents and trashed = false`;
  if (query) q += ` and name contains '${query}'`;

  const res = await drive.files.list({
    q,
    pageSize: 20,
    fields: 'files(id, name, mimeType, size, modifiedTime, parents)',
    orderBy: 'modifiedTime desc'
  });

  const files = res.data.files || [];

  const formatted = files.map(f => ({
    id: f.id,
    name: f.name,
    type: f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
    mimeType: f.mimeType,
    size: formatSize(parseInt(f.size)),
    modified: f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : 'unknown'
  }));

  return {
    folder,
    files: formatted,
    total: formatted.length,
    folders: formatted.filter(f => f.type === 'folder').length,
    documents: formatted.filter(f => f.type === 'file').length
  };
}

// ── SEARCH FILES ──────────────────────────────────────────────────────────────
async function searchFiles(tokens, { query }) {
  const drive = getDriveClient(tokens);

  const res = await drive.files.list({
    q: `name contains '${query}' and trashed = false`,
    pageSize: 10,
    fields: 'files(id, name, mimeType, size, modifiedTime)',
    orderBy: 'modifiedTime desc'
  });

  const files = (res.data.files || []).map(f => ({
    id: f.id,
    name: f.name,
    type: f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
    size: formatSize(parseInt(f.size)),
    modified: new Date(f.modifiedTime).toLocaleDateString()
  }));

  return { query, results: files, total: files.length };
}

// ── READ FILE ─────────────────────────────────────────────────────────────────
async function readFile(tokens, { file_id, file_name }) {
  const drive = getDriveClient(tokens);

  // If only name given, search for it first
  let id = file_id;
  let name = file_name;

  if (!id && name) {
    const search = await drive.files.list({
      q: `name = '${name}' and trashed = false`,
      pageSize: 1,
      fields: 'files(id, name, mimeType)'
    });
    if (!search.data.files?.length) {
      return { error: `File "${name}" not found in Google Drive.` };
    }
    id = search.data.files[0].id;
    name = search.data.files[0].name;
  }

  // Get file metadata
  const meta = await drive.files.get({
    fileId: id,
    fields: 'id, name, mimeType, size'
  });

  const mimeType = meta.data.mimeType;
  let content;

  // Google Docs → export as plain text
  if (mimeType === 'application/vnd.google-apps.document') {
    const exported = await drive.files.export(
      { fileId: id, mimeType: 'text/plain' },
      { responseType: 'text' }
    );
    content = (exported.data || '').slice(0, 3000);
  } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    const exported = await drive.files.export(
      { fileId: id, mimeType: 'text/csv' },
      { responseType: 'text' }
    );
    content = (exported.data || '').slice(0, 2000);
  } else if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    const downloaded = await drive.files.get(
      { fileId: id, alt: 'media' },
      { responseType: 'text' }
    );
    content = (downloaded.data || '').slice(0, 3000);
  } else {
    return { error: `Cannot read "${meta.data.name}" — it's a binary file (${mimeType}). Storm can only read text documents.` };
  }

  return {
    id,
    name: meta.data.name,
    mimeType,
    content,
    length: content.length
  };
}

// ── CREATE FILE ───────────────────────────────────────────────────────────────
async function createFile(tokens, { name, content, folder_id = 'root' }) {
  const drive = getDriveClient(tokens);

  const { Readable } = require('stream');
  const stream = Readable.from([content]);

  const res = await drive.files.create({
    requestBody: {
      name,
      parents: [folder_id]
    },
    media: {
      mimeType: 'text/plain',
      body: stream
    },
    fields: 'id, name, webViewLink'
  });

  return {
    success: true,
    id: res.data.id,
    name: res.data.name,
    link: res.data.webViewLink
  };
}

// ── RENAME FILE ───────────────────────────────────────────────────────────────
async function renameFile(tokens, { file_id, new_name }) {
  const drive = getDriveClient(tokens);

  const old = await drive.files.get({ fileId: file_id, fields: 'name' });

  await drive.files.update({
    fileId: file_id,
    requestBody: { name: new_name }
  });

  return { success: true, from: old.data.name, to: new_name };
}

// ── DELETE FILE ───────────────────────────────────────────────────────────────
async function deleteFile(tokens, { file_id }) {
  const drive = getDriveClient(tokens);

  const meta = await drive.files.get({ fileId: file_id, fields: 'name' });
  await drive.files.delete({ fileId: file_id });

  return { success: true, deleted: meta.data.name };
}

// ── CREATE FOLDER ─────────────────────────────────────────────────────────────
async function createFolder(tokens, { name, parent_id = 'root' }) {
  const drive = getDriveClient(tokens);

  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parent_id]
    },
    fields: 'id, name'
  });

  return { success: true, id: res.data.id, name: res.data.name };
}

module.exports = {
  listFiles,
  searchFiles,
  readFile,
  createFile,
  renameFile,
  deleteFile,
  createFolder
};
