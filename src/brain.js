// src/brain.js — Storm's reasoning core (session-aware for cloud)
const AnthropicLib = require('@anthropic-ai/sdk');
const TOOLS = require('./tools');
const { executeTool, executeConfirmed } = require('./executor');

let client = null;

function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('YOUR_CLAUDE')) {
      throw new Error('Claude API key not set in environment variables.');
    }
    client = new AnthropicLib({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function buildSystemPrompt(userEmail = '') {
  const now = new Date();
  return `You are Storm — a voice-first personal AI agent running in the cloud. You are accessible from any device.

You are direct, efficient, and precise. You are not a chatbot. You execute actions on behalf of the user.

CAPABILITIES:
- Google Drive: list, search, read, create, rename, delete files and folders
- Gmail: read inbox, read email bodies, send emails, archive emails
- Google Calendar: list events, create events, delete events

CORE RULES:
1. Always use tools to answer questions — never guess file names, email content, or calendar data.
2. For destructive actions (delete file, send email, create event, delete event): set confirmed: false first. The system will ask the user to confirm. NEVER set confirmed: true on the first attempt.
3. When multiple items match ("the project file"), list them and ask which one.
4. Keep responses SHORT — under 3 sentences unless reading content aloud. This is voice-first.
5. If a Google API returns an error about authentication, tell the user to visit /auth/google.
6. Never fabricate data.
7. If you cannot do something, say so in one sentence and offer the closest available action.

CURRENT CONTEXT:
- Date/Time: ${now.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
- User: ${userEmail || 'authenticated user'}
- Environment: Cloud (Railway) — accessible from any device

RESPONSE STYLE:
- Concise, natural, informative — optimised for being read aloud
- First person: "I found..." not "Storm found..."
- For confirmations: clearly state what will happen and the exact phrase to confirm
- For errors: state the problem simply and suggest a fix`;
}

async function process(userMessage, history = [], tokens = null, userEmail = '') {
  const claudeClient = getClient();

  if (!tokens) {
    return {
      response: 'You need to connect your Google account first. Tap the Connect button to link Gmail, Calendar and Drive.',
      actions: [],
      updatedHistory: history
    };
  }

  const messages = [...history, { role: 'user', content: userMessage }];
  let pendingAction = null;
  const actionsExecuted = [];
  let iterations = 0;

  while (iterations < 8) {
    iterations++;

    const response = await claudeClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: buildSystemPrompt(userEmail),
      tools: TOOLS,
      messages
    });

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text');
      messages.push({ role: 'assistant', content: response.content });
      return {
        response: textBlock?.text || 'Done.',
        actions: actionsExecuted,
        pendingAction,
        updatedHistory: messages
      };
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      const toolResults = [];
      let confirmationRequired = false;

      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(toolUse.name, toolUse.input, tokens);

        if (result.needsConfirmation) {
          confirmationRequired = true;
          pendingAction = { toolName: toolUse.name, input: toolUse.input };
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: result.message
          });
        } else {
          actionsExecuted.push({
            tool: toolUse.name,
            input: toolUse.input,
            result,
            timestamp: new Date().toISOString()
          });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result)
          });
        }
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      if (confirmationRequired) {
        const confirmRes = await claudeClient.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 256,
          system: buildSystemPrompt(userEmail),
          tools: TOOLS,
          messages
        });
        const confirmText = confirmRes.content.find(b => b.type === 'text');
        messages.push({ role: 'assistant', content: confirmRes.content });

        return {
          response: confirmText?.text || 'Please confirm this action.',
          actions: actionsExecuted,
          pendingAction,
          needsConfirmation: true,
          updatedHistory: messages
        };
      }

      continue;
    }

    break;
  }

  return {
    response: 'Something went wrong. Please try again.',
    actions: actionsExecuted,
    updatedHistory: messages
  };
}

async function confirm(pendingAction, history = [], tokens = null, userEmail = '') {
  const claudeClient = getClient();
  const result = await executeConfirmed(pendingAction.toolName, pendingAction.input, tokens);

  const messages = [
    ...history,
    {
      role: 'user',
      content: `The user confirmed. Result of ${pendingAction.toolName}: ${JSON.stringify(result)}`
    }
  ];

  const response = await claudeClient.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    system: buildSystemPrompt(userEmail),
    messages
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return {
    response: textBlock?.text || 'Done.',
    result,
    updatedHistory: [...messages, { role: 'assistant', content: response.content }]
  };
}

module.exports = { process, confirm };
