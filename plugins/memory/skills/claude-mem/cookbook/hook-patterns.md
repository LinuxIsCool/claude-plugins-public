# Hook Patterns: Implementing All 5 Lifecycle Hooks

## Purpose

Implement the complete lifecycle hook architecture for Claude Code memory. This guide covers each of the 5 hooks, their responsibilities, and production-ready patterns.

## Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `WORKER_PORT` | `37777` | Worker service HTTP port |
| `WORKER_HOST` | `127.0.0.1` | Worker host (localhost only for security) |
| `TIMEOUT_MS` | `30000` | Default request timeout |
| `EXIT_CODE_SUCCESS` | `0` | Graceful success (Windows Terminal compatible) |
| `EXIT_CODE_NONBLOCKING` | `1` | Non-blocking error (shown to user) |
| `EXIT_CODE_BLOCKING` | `2` | Blocking error (fed to Claude for processing) |

## Instructions

### Hook Architecture Overview

```
Session Lifecycle:
┌─────────────────────────────────────────────────────────────┐
│ SessionStart (context-hook)                                  │
│   → Load recent context                                      │
│   → Inject memories via hookSpecificOutput                   │
├─────────────────────────────────────────────────────────────┤
│ UserPromptSubmit (new-hook)                                  │
│   → Initialize session in database                           │
│   → Start SDK agent for observation extraction               │
│   → Strip slash commands for cleaner memory                  │
├─────────────────────────────────────────────────────────────┤
│ PostToolUse (save-hook)                                      │
│   → Capture tool name, input, and response                   │
│   → Queue for AI-powered observation extraction              │
│   → Handle privacy filtering                                 │
├─────────────────────────────────────────────────────────────┤
│ Stop (summary-hook)                                          │
│   → Extract last assistant message from transcript           │
│   → Generate session summary via worker                      │
│   → Compress exchange for future retrieval                   │
├─────────────────────────────────────────────────────────────┤
│ SessionEnd (cleanup-hook)                                    │
│   → Finalize session in database                             │
│   → Trigger vector embedding generation                      │
│   → Clean up temporary resources                             │
└─────────────────────────────────────────────────────────────┘
```

### Standard Hook Response

All hooks (except SessionStart) return a standard response:

```typescript
const STANDARD_HOOK_RESPONSE = JSON.stringify({
  continue: true,
  suppressOutput: true
});
```

This tells Claude Code to:
- Continue processing (don't block the operation)
- Suppress hook output (don't show to user or feed to Claude)

## Code Examples

### Hook 1: SessionStart (context-hook.ts)

Injects relevant context at the start of each session.

```typescript
/**
 * SessionStart Hook - Context Injection
 *
 * Fetches relevant memories from worker and injects them
 * via hookSpecificOutput.additionalContext
 */
import { ensureWorkerRunning, getWorkerPort } from '../shared/worker-utils.js';
import { getProjectContext } from '../utils/project-name.js';

interface NormalizedHookInput {
  cwd?: string;
  sessionId: string;
}

interface HookResult {
  hookSpecificOutput?: {
    hookEventName: string;
    additionalContext: string;
  };
}

async function contextHandler(input: NormalizedHookInput): Promise<HookResult> {
  // Ensure worker is running before any requests
  await ensureWorkerRunning();

  const cwd = input.cwd ?? process.cwd();
  const context = getProjectContext(cwd);
  const port = getWorkerPort();

  // Support worktrees by passing all related projects
  const projectsParam = context.allProjects.join(',');
  const url = `http://127.0.0.1:${port}/api/context/inject?projects=${encodeURIComponent(projectsParam)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Context generation failed: ${response.status}`);
  }

  const additionalContext = (await response.text()).trim();

  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext
    }
  };
}
```

### Hook 2: UserPromptSubmit (new-hook.ts)

Initializes the session and starts the observation extraction agent.

```typescript
/**
 * UserPromptSubmit Hook - Session Initialization
 *
 * Creates session record and starts SDK agent for
 * continuous observation extraction during the session.
 */
import { ensureWorkerRunning, getWorkerPort } from '../shared/worker-utils.js';
import { getProjectName } from '../utils/project-name.js';
import { logger } from '../utils/logger.js';

interface SessionInitInput {
  sessionId: string;
  cwd?: string;
  prompt: string;
  platform?: string;
}

async function sessionInitHandler(input: SessionInitInput): Promise<{ continue: boolean; suppressOutput: boolean }> {
  await ensureWorkerRunning();

  const { sessionId, cwd, prompt, platform } = input;
  const project = getProjectName(cwd || process.cwd());
  const port = getWorkerPort();

  logger.debug('HOOK', 'Initializing session', { contentSessionId: sessionId, project });

  // Step 1: Initialize session in database
  const initResponse = await fetch(`http://127.0.0.1:${port}/api/sessions/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentSessionId: sessionId,
      project,
      prompt
    })
  });

  if (!initResponse.ok) {
    throw new Error(`Session initialization failed: ${initResponse.status}`);
  }

  const initResult = await initResponse.json() as {
    sessionDbId: number;
    promptNumber: number;
    skipped?: boolean;
    reason?: string;
  };

  // Check if prompt was entirely private
  if (initResult.skipped && initResult.reason === 'private') {
    logger.info('HOOK', 'Session skipped - private content', { sessionDbId: initResult.sessionDbId });
    return { continue: true, suppressOutput: true };
  }

  // Step 2: Start SDK agent (Claude Code only, not Cursor)
  if (platform !== 'cursor' && initResult.sessionDbId) {
    // Strip leading slash from commands for cleaner memory
    const cleanedPrompt = prompt.startsWith('/') ? prompt.substring(1) : prompt;

    const agentResponse = await fetch(`http://127.0.0.1:${port}/sessions/${initResult.sessionDbId}/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userPrompt: cleanedPrompt,
        promptNumber: initResult.promptNumber
      })
    });

    if (!agentResponse.ok) {
      throw new Error(`SDK agent start failed: ${agentResponse.status}`);
    }
  }

  logger.info('HOOK', `Session initialized | dbId=${initResult.sessionDbId} | prompt#=${initResult.promptNumber}`);

  return { continue: true, suppressOutput: true };
}
```

### Hook 3: PostToolUse (save-hook.ts)

Captures tool usage for observation extraction.

```typescript
/**
 * PostToolUse Hook - Observation Capture
 *
 * Sends tool usage data to worker for AI-powered
 * observation extraction and storage.
 */
import { ensureWorkerRunning, getWorkerPort } from '../shared/worker-utils.js';
import { logger } from '../utils/logger.js';

interface ObservationInput {
  sessionId: string;
  cwd?: string;
  toolName: string;
  toolInput?: string;
  toolResponse?: string;
}

async function observationHandler(input: ObservationInput): Promise<{ continue: boolean; suppressOutput: boolean }> {
  await ensureWorkerRunning();

  const { sessionId, cwd, toolName, toolInput, toolResponse } = input;
  const port = getWorkerPort();

  logger.dataIn('HOOK', `PostToolUse: ${toolName}`, { workerPort: port });

  if (!cwd) {
    throw new Error(`Missing cwd in PostToolUse hook input for session ${sessionId}`);
  }

  // Send to worker for processing
  const response = await fetch(`http://127.0.0.1:${port}/api/sessions/observations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentSessionId: sessionId,
      tool_name: toolName,
      tool_input: toolInput,
      tool_response: toolResponse,
      cwd
    })
  });

  if (!response.ok) {
    throw new Error(`Observation storage failed: ${response.status}`);
  }

  logger.debug('HOOK', 'Observation captured', { toolName });

  return { continue: true, suppressOutput: true };
}
```

### Hook 4: Stop (summary-hook.ts)

Generates a compressed summary of the session exchange.

```typescript
/**
 * Stop Hook - Session Summarization
 *
 * Extracts the final assistant message and triggers
 * AI-powered session summarization.
 */
import { ensureWorkerRunning, getWorkerPort } from '../shared/worker-utils.js';
import { extractLastMessage } from '../shared/transcript-parser.js';
import { logger } from '../utils/logger.js';

interface SummarizeInput {
  sessionId: string;
  transcriptPath?: string;
}

async function summarizeHandler(input: SummarizeInput): Promise<{ continue: boolean; suppressOutput: boolean }> {
  await ensureWorkerRunning();

  const { sessionId, transcriptPath } = input;
  const port = getWorkerPort();

  if (!transcriptPath) {
    throw new Error(`Missing transcriptPath in Stop hook input`);
  }

  // Extract last assistant message (the work Claude did)
  // User messages in transcripts are mostly tool_results, not actual user input
  const lastAssistantMessage = extractLastMessage(transcriptPath, 'assistant', true);

  logger.dataIn('HOOK', 'Stop: Requesting summary', {
    workerPort: port,
    hasLastAssistantMessage: !!lastAssistantMessage
  });

  const response = await fetch(`http://127.0.0.1:${port}/api/sessions/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentSessionId: sessionId,
      last_assistant_message: lastAssistantMessage
    })
  });

  if (!response.ok) {
    // Return standard response even on failure (graceful degradation)
    return { continue: true, suppressOutput: true };
  }

  logger.debug('HOOK', 'Summary request sent successfully');

  return { continue: true, suppressOutput: true };
}
```

### Hook 5: SessionEnd (cleanup-hook.ts)

Finalizes the session and triggers post-processing.

```typescript
/**
 * SessionEnd Hook - Session Finalization
 *
 * Finalizes session record and triggers vector embedding
 * generation for new observations.
 */
import { ensureWorkerRunning, getWorkerPort } from '../shared/worker-utils.js';
import { logger } from '../utils/logger.js';

interface CleanupInput {
  sessionId: string;
}

async function cleanupHandler(input: CleanupInput): Promise<{ continue: boolean; suppressOutput: boolean }> {
  await ensureWorkerRunning();

  const { sessionId } = input;
  const port = getWorkerPort();

  logger.debug('HOOK', 'SessionEnd: Finalizing session', { sessionId });

  // Finalize session in database
  const response = await fetch(`http://127.0.0.1:${port}/api/sessions/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentSessionId: sessionId
    })
  });

  if (!response.ok) {
    logger.warn('HOOK', 'Session finalization failed', { sessionId, status: response.status });
    // Graceful degradation - don't block session end
    return { continue: true, suppressOutput: true };
  }

  // Trigger vector embedding generation (async, fire-and-forget)
  fetch(`http://127.0.0.1:${port}/api/sessions/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentSessionId: sessionId })
  }).catch(error => {
    logger.warn('HOOK', 'Embedding generation failed', { sessionId }, error);
  });

  logger.info('HOOK', 'Session finalized', { sessionId });

  return { continue: true, suppressOutput: true };
}
```

## Common Patterns

### Ensure Worker Running

Before any HTTP call, ensure the worker is available:

```typescript
import { spawn } from 'child_process';
import { existsSync } from 'fs';

async function ensureWorkerRunning(): Promise<void> {
  const port = getWorkerPort();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(1000)
    });

    if (response.ok) return; // Worker is running
  } catch {
    // Worker not running, start it
  }

  const workerPath = getWorkerPath();
  if (!existsSync(workerPath)) {
    throw new Error('Worker script not found');
  }

  // Start worker in background
  const child = spawn('bun', ['run', workerPath], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, CLAUDE_MEM_MANAGED: 'true' }
  });

  child.unref();

  // Wait for worker to be ready
  await waitForWorkerReady(port, 30000);
}
```

### Privacy Filtering

Strip private content before storage:

```typescript
function stripPrivateTags(content: string): string {
  // Remove content within <private>...</private> tags
  return content.replace(/<private>[\s\S]*?<\/private>/gi, '[REDACTED]');
}

function containsPrivateContent(content: string): boolean {
  return /<private>/i.test(content);
}
```

### Exit Code Strategy

```typescript
// Windows Terminal compatibility - use exit 0 for graceful shutdown
function handleError(error: Error, exitCode: number = 0): never {
  console.error(`Hook error: ${error.message}`);
  process.exit(exitCode);
}

// Exit codes:
// 0 = Success or graceful shutdown (Windows Terminal closes tabs)
// 1 = Non-blocking error (shown to user, continues)
// 2 = Blocking error (fed to Claude for processing)
```

### Transcript Parsing

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function extractLastMessage(
  transcriptPath: string,
  role: 'user' | 'assistant',
  fullContent: boolean = false
): string | null {
  const transcript = JSON.parse(readFileSync(transcriptPath, 'utf-8'));

  // Find last message of specified role
  for (let i = transcript.messages.length - 1; i >= 0; i--) {
    const message = transcript.messages[i];
    if (message.role === role) {
      return fullContent ? message.content : truncate(message.content, 1000);
    }
  }

  return null;
}
```

## Best Practices

### 1. Graceful Degradation

Hooks should never block the user experience:

```typescript
try {
  await processHook(input);
} catch (error) {
  logger.error('HOOK', 'Hook failed', {}, error as Error);
  // Return success anyway - don't block user
  return { continue: true, suppressOutput: true };
}
```

### 2. Timeout Handling

Set reasonable timeouts for all HTTP requests:

```typescript
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
  signal: AbortSignal.timeout(30000) // 30 second timeout
});
```

### 3. Logging Strategy

Use structured logging with context:

```typescript
logger.info('HOOK', 'Message', {
  sessionId: input.sessionId,
  project: projectName,
  elapsed: Date.now() - startTime
});
```

### 4. Worker Communication

Always communicate via HTTP API, never direct database access:

```typescript
// GOOD: HTTP API call
const response = await fetch(`http://127.0.0.1:${port}/api/sessions/observations`, { ... });

// BAD: Direct database access from hook
// const db = new Database('~/.claude-mem/claude-mem.db');
// db.run('INSERT INTO observations ...');
```

## See Also

- [quickstart.md](./quickstart.md) - Installation and setup
- [worker-service.md](./worker-service.md) - HTTP API documentation
- [progressive-disclosure.md](./progressive-disclosure.md) - Token-efficient search patterns
