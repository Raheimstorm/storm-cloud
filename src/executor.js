// src/executor.js — Dispatches tool calls, enforces confirmation gate
const drive = require('./adapters/drive');
const gmail = require('./adapters/gmail');
const cal   = require('./adapters/calendar');

const DESTRUCTIVE = new Set(['delete_drive_file', 'send_email', 'create_event', 'delete_event']);

async function executeTool(toolName, input, tokens) {
  // Confirmation gate
  if (DESTRUCTIVE.has(toolName) && !input.confirmed) {
    return {
      needsConfirmation: true,
      pendingTool: toolName,
      pendingInput: input,
      message: confirmationMessage(toolName, input)
    };
  }

  try {
    switch (toolName) {
      // DRIVE
      case 'list_drive_files':   return await drive.listFiles(tokens, input);
      case 'search_drive':       return await drive.searchFiles(tokens, input);
      case 'read_drive_file':    return await drive.readFile(tokens, input);
      case 'create_drive_file':  return await drive.createFile(tokens, input);
      case 'rename_drive_file':  return await drive.renameFile(tokens, input);
      case 'delete_drive_file':  return await drive.deleteFile(tokens, input);
      case 'create_drive_folder': return await drive.createFolder(tokens, input);

      // GMAIL
      case 'read_emails':      return await gmail.readEmails(tokens, input);
      case 'read_email_body':  return await gmail.readEmailBody(tokens, input);
      case 'send_email':       return await gmail.sendEmail(tokens, input);
      case 'archive_email':    return await gmail.archiveEmail(tokens, input);

      // CALENDAR
      case 'list_events':   return await cal.listEvents(tokens, input);
      case 'create_event':  return await cal.createEvent(tokens, input);
      case 'delete_event':  return await cal.deleteEvent(tokens, input);

      default: return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    // Surface Google API errors clearly
    const msg = err.response?.data?.error?.message || err.message;
    return { error: msg };
  }
}

async function executeConfirmed(toolName, input, tokens) {
  return executeTool(toolName, { ...input, confirmed: true }, tokens);
}

function confirmationMessage(toolName, input) {
  switch (toolName) {
    case 'delete_drive_file':
      return `About to permanently delete Drive file ID: ${input.file_id}. Say "confirm" to proceed or "cancel" to abort.`;
    case 'send_email':
      return `About to send email to ${input.to}, subject: "${input.subject}". Say "confirm" to send or "cancel" to abort.`;
    case 'create_event':
      return `About to create calendar event: "${input.title}" on ${input.date} at ${input.start_time}. Say "confirm" to create or "cancel" to abort.`;
    case 'delete_event':
      return `About to delete calendar event ID: ${input.event_id}. Say "confirm" to delete or "cancel" to abort.`;
    default:
      return `About to perform ${toolName}. Say "confirm" to proceed or "cancel" to abort.`;
  }
}

module.exports = { executeTool, executeConfirmed };
