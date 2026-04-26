// src/tools.js — Storm Cloud tool definitions for Claude
const TOOLS = [

  // ── GOOGLE DRIVE ──────────────────────────────────────────────────────────
  {
    name: 'list_drive_files',
    description: 'List files and folders in Google Drive. Use folder="root" for the top level.',
    input_schema: {
      type: 'object',
      properties: {
        folder: { type: 'string', description: 'Folder ID or "root" for top-level Drive.' },
        query: { type: 'string', description: 'Optional: filter by filename keyword.' }
      }
    }
  },
  {
    name: 'search_drive',
    description: 'Search for files in Google Drive by name.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keyword to find files by name.' }
      },
      required: ['query']
    }
  },
  {
    name: 'read_drive_file',
    description: 'Read the text content of a Google Drive file (Docs, text files, etc.).',
    input_schema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'Google Drive file ID (from list or search results).' },
        file_name: { type: 'string', description: 'File name (alternative to file_id — Storm will search).' }
      }
    }
  },
  {
    name: 'create_drive_file',
    description: 'Create a new text file in Google Drive with given content.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'File name (include extension, e.g. "notes.txt").' },
        content: { type: 'string', description: 'Text content of the file.' },
        folder_id: { type: 'string', description: 'Optional folder ID. Defaults to Drive root.' }
      },
      required: ['name', 'content']
    }
  },
  {
    name: 'rename_drive_file',
    description: 'Rename a file or folder in Google Drive.',
    input_schema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'File ID to rename.' },
        new_name: { type: 'string', description: 'New name for the file.' }
      },
      required: ['file_id', 'new_name']
    }
  },
  {
    name: 'delete_drive_file',
    description: 'DESTRUCTIVE: Permanently delete a Drive file. Must set confirmed: true only after user explicitly confirms.',
    input_schema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', description: 'File ID to delete.' },
        confirmed: { type: 'boolean', description: 'Must be true — only after user spoken confirmation.' }
      },
      required: ['file_id', 'confirmed']
    }
  },
  {
    name: 'create_drive_folder',
    description: 'Create a new folder in Google Drive.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Folder name.' },
        parent_id: { type: 'string', description: 'Parent folder ID. Defaults to root.' }
      },
      required: ['name']
    }
  },

  // ── GMAIL ────────────────────────────────────────────────────────────────
  {
    name: 'read_emails',
    description: 'Read emails from Gmail inbox.',
    input_schema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of emails to read (default 5, max 20).' },
        query: { type: 'string', description: 'Optional Gmail search query e.g. "from:boss@work.com".' }
      }
    }
  },
  {
    name: 'read_email_body',
    description: 'Read the full body of a specific email by its ID.',
    input_schema: {
      type: 'object',
      properties: {
        email_id: { type: 'string', description: 'Gmail message ID from read_emails.' }
      },
      required: ['email_id']
    }
  },
  {
    name: 'send_email',
    description: 'DESTRUCTIVE: Send an email. Must set confirmed: true only after user confirms recipient and content.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address.' },
        subject: { type: 'string', description: 'Email subject.' },
        body: { type: 'string', description: 'Plain text email body.' },
        confirmed: { type: 'boolean', description: 'Must be true — user confirmed.' }
      },
      required: ['to', 'subject', 'body', 'confirmed']
    }
  },
  {
    name: 'archive_email',
    description: 'Archive an email (removes from inbox, keeps in All Mail).',
    input_schema: {
      type: 'object',
      properties: {
        email_id: { type: 'string', description: 'Gmail message ID to archive.' }
      },
      required: ['email_id']
    }
  },

  // ── CALENDAR ─────────────────────────────────────────────────────────────
  {
    name: 'list_events',
    description: 'List upcoming Google Calendar events.',
    input_schema: {
      type: 'object',
      properties: {
        days_ahead: { type: 'number', description: 'How many days ahead to look (default 7).' },
        max_results: { type: 'number', description: 'Max events (default 10).' }
      }
    }
  },
  {
    name: 'create_event',
    description: 'DESTRUCTIVE: Create a calendar event. Must set confirmed: true after user confirms.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title.' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format.' },
        start_time: { type: 'string', description: 'Start time in HH:MM (24-hour).' },
        duration_minutes: { type: 'number', description: 'Duration in minutes (default 60).' },
        description: { type: 'string', description: 'Optional description.' },
        confirmed: { type: 'boolean' }
      },
      required: ['title', 'date', 'start_time', 'confirmed']
    }
  },
  {
    name: 'delete_event',
    description: 'DESTRUCTIVE: Delete a calendar event. Must set confirmed: true.',
    input_schema: {
      type: 'object',
      properties: {
        event_id: { type: 'string', description: 'Calendar event ID from list_events.' },
        confirmed: { type: 'boolean' }
      },
      required: ['event_id', 'confirmed']
    }
  }
];

module.exports = TOOLS;
