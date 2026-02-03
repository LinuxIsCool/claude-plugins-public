# Context Injection Prompt Template

## Purpose

Inject relevant historical context at the start of each Claude Code session. This template defines the format for memory context that appears in the SessionStart hook's `additionalContext` field.

## Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `{PROJECT}` | Project name | Current working project |
| `{OBSERVATION_COUNT}` | Integer | Number of observations to include |
| `{SESSION_COUNT}` | Integer | Number of session summaries to include |
| `{FULL_OBSERVATION_COUNT}` | Integer | Observations with full details |
| `{TOKEN_ESTIMATE}` | Integer | Estimated tokens used |
| `{USE_COLORS}` | Boolean | Enable ANSI color codes |

## Template: Header Section

### Plain Text (colors=false)

```markdown
# Recent Activity - {PROJECT}

**Observations**: {OBSERVATION_COUNT} | **Sessions**: {SESSION_COUNT}
**Estimated Tokens**: ~{TOKEN_ESTIMATE}
```

### With Colors (colors=true)

```
\x1b[1;36m# Recent Activity - {PROJECT}\x1b[0m

\x1b[90mObservations: {OBSERVATION_COUNT} | Sessions: {SESSION_COUNT}\x1b[0m
\x1b[90mEstimated Tokens: ~{TOKEN_ESTIMATE}\x1b[0m
```

## Template: Timeline Section

### Observation Row Format

```markdown
| ID | Time | Type | Title |
|----|------|------|-------|
| #{ID} | {TIME} | {TYPE_EMOJI} | {TITLE} |
```

### Date Grouping

```markdown
### {DATE_HEADER}

| ID | Time | Type | Title |
|----|------|------|-------|
| #123 | 3:40 PM | bugfix | Fixed auth token refresh |
| #122 | 3:35 PM | discovery | Found root cause in token validation |

### {PREVIOUS_DATE}

| ID | Time | Type | Title |
|----|------|------|-------|
| #120 | 5:20 PM | feature | Added OAuth2 PKCE support |
```

### Type Emoji Mapping

| Type | Emoji | Description |
|------|-------|-------------|
| bugfix | `🔴` | Something was broken, now fixed |
| feature | `🟣` | New capability added |
| refactor | `🔄` | Code restructured |
| change | `✅` | Generic modification |
| discovery | `🔵` | Learning about existing system |
| decision | `⚖️` | Architectural/design choice |

## Template: Full Observation Detail

For the most recent N observations (configurable via `fullObservationCount`):

```markdown
---

### #{ID}: {TITLE}
**Type**: {TYPE} | **{RELATIVE_TIME}**

{SUBTITLE}

**Facts**:
- {FACT_1}
- {FACT_2}
- {FACT_3}

**Narrative**: {NARRATIVE}

**Files Read**: {FILES_READ}
**Files Modified**: {FILES_MODIFIED}

---
```

## Template: Summary Section

When `showMostRecentSummary` is enabled:

```markdown
## Most Recent Summary

**Request**: {SUMMARY_REQUEST}

**Investigated**: {SUMMARY_INVESTIGATED}

**Learned**: {SUMMARY_LEARNED}

**Completed**: {SUMMARY_COMPLETED}

**Next Steps**: {SUMMARY_NEXT_STEPS}

**Notes**: {SUMMARY_NOTES}
```

## Template: Previously Section

When `showPreviousAssistant` is enabled:

```markdown
## Previously

{LAST_ASSISTANT_MESSAGE}
```

## Template: Footer Section

```markdown
---

*Context includes {OBSERVATION_COUNT} observations from {SESSION_COUNT} sessions*
*Use mem-search for older memories | /mem-search "query"*
```

## Template: Empty State

When no memories exist:

### Plain Text

```markdown
# Welcome to {PROJECT}

No recent activity found for this project.

**Getting Started**:
- claude-mem will automatically capture observations as you work
- Use tools, edit files, and run commands - memories are created from your actions
- Search your history anytime with `/mem-search "query"`
```

### With Colors

```
\x1b[1;36m# Welcome to {PROJECT}\x1b[0m

\x1b[90mNo recent activity found for this project.\x1b[0m

\x1b[1mGetting Started:\x1b[0m
- claude-mem will automatically capture observations as you work
- Use tools, edit files, and run commands - memories are created from your actions
- Search your history anytime with \x1b[33m/mem-search "query"\x1b[0m
```

## Code Example: Context Builder

```typescript
import type { Observation, SessionSummary } from './types';

interface ContextConfig {
  observationCount: number;      // How many observations to show
  sessionCount: number;          // How many sessions to summarize
  fullObservationCount: number;  // Observations with full details
  showMostRecentSummary: boolean;
  showPreviousAssistant: boolean;
}

interface TokenEconomics {
  totalObservations: number;
  displayedObservations: number;
  estimatedTokens: number;
}

function renderHeader(
  project: string,
  economics: TokenEconomics,
  config: ContextConfig,
  useColors: boolean
): string[] {
  const output: string[] = [];

  if (useColors) {
    output.push(`\x1b[1;36m# Recent Activity - ${project}\x1b[0m`);
    output.push('');
    output.push(`\x1b[90mObservations: ${economics.displayedObservations} of ${economics.totalObservations}\x1b[0m`);
  } else {
    output.push(`# Recent Activity - ${project}`);
    output.push('');
    output.push(`**Observations**: ${economics.displayedObservations} of ${economics.totalObservations}`);
  }

  return output;
}

function renderTimeline(
  observations: Observation[],
  fullObservationIds: Set<number>,
  config: ContextConfig,
  useColors: boolean
): string[] {
  const output: string[] = [];

  // Group observations by date
  const byDate = new Map<string, Observation[]>();
  for (const obs of observations) {
    const date = formatDateHeader(obs.created_at);
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(obs);
  }

  // Render each date group
  for (const [date, dateObs] of byDate) {
    output.push('');
    output.push(`### ${date}`);
    output.push('');
    output.push('| ID | Time | Type | Title |');
    output.push('|----|------|------|-------|');

    for (const obs of dateObs) {
      const time = formatTime(obs.created_at);
      const emoji = getTypeEmoji(obs.type);
      output.push(`| #${obs.id} | ${time} | ${emoji} | ${obs.title} |`);
    }
  }

  // Render full details for selected observations
  for (const obs of observations) {
    if (fullObservationIds.has(obs.id)) {
      output.push('');
      output.push('---');
      output.push('');
      output.push(`### #${obs.id}: ${obs.title}`);
      output.push(`**Type**: ${obs.type} | **${formatRelativeTime(obs.created_at)}**`);
      output.push('');
      output.push(obs.subtitle);
      output.push('');
      output.push('**Facts**:');
      for (const fact of obs.facts) {
        output.push(`- ${fact}`);
      }
      output.push('');
      output.push(`**Narrative**: ${obs.narrative}`);
      if (obs.files_read.length > 0) {
        output.push('');
        output.push(`**Files Read**: ${obs.files_read.join(', ')}`);
      }
      if (obs.files_modified.length > 0) {
        output.push(`**Files Modified**: ${obs.files_modified.join(', ')}`);
      }
    }
  }

  return output;
}

function renderSummary(
  summary: SessionSummary,
  useColors: boolean
): string[] {
  const output: string[] = [];

  output.push('');
  output.push('## Most Recent Summary');
  output.push('');
  output.push(`**Request**: ${summary.request}`);
  output.push('');

  if (summary.investigated) {
    output.push(`**Investigated**: ${summary.investigated}`);
    output.push('');
  }

  if (summary.learned) {
    output.push(`**Learned**: ${summary.learned}`);
    output.push('');
  }

  if (summary.completed) {
    output.push(`**Completed**: ${summary.completed}`);
    output.push('');
  }

  if (summary.next_steps) {
    output.push(`**Next Steps**: ${summary.next_steps}`);
    output.push('');
  }

  if (summary.notes) {
    output.push(`**Notes**: ${summary.notes}`);
  }

  return output;
}

function renderFooter(
  economics: TokenEconomics,
  config: ContextConfig,
  useColors: boolean
): string[] {
  const output: string[] = [];

  output.push('');
  output.push('---');
  output.push('');

  if (useColors) {
    output.push(`\x1b[90m*Context includes ${economics.displayedObservations} observations*\x1b[0m`);
    output.push(`\x1b[90m*Use mem-search for older memories*\x1b[0m`);
  } else {
    output.push(`*Context includes ${economics.displayedObservations} observations*`);
    output.push(`*Use mem-search for older memories | /mem-search "query"*`);
  }

  return output;
}
```

## Code Example: HTTP API Call

```typescript
async function injectContext(
  project: string,
  useColors: boolean = false
): Promise<string> {
  const port = getWorkerPort();
  const url = new URL(`http://127.0.0.1:${port}/api/context/inject`);
  url.searchParams.set('project', project);
  if (useColors) {
    url.searchParams.set('colors', 'true');
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Context injection failed: ${response.status}`);
  }

  return await response.text();
}

// For worktrees (multiple related projects)
async function injectContextMulti(
  projects: string[],
  useColors: boolean = false
): Promise<string> {
  const port = getWorkerPort();
  const url = new URL(`http://127.0.0.1:${port}/api/context/inject`);
  url.searchParams.set('projects', projects.join(','));
  if (useColors) {
    url.searchParams.set('colors', 'true');
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Context injection failed: ${response.status}`);
  }

  return await response.text();
}
```

## Configuration Options

Settings in `~/.claude-mem/settings.json`:

```json
{
  "context": {
    "observationCount": 50,
    "sessionCount": 5,
    "fullObservationCount": 3,
    "showMostRecentSummary": true,
    "showPreviousAssistant": true,
    "maxTokens": 8000
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `observationCount` | 50 | Maximum observations in timeline |
| `sessionCount` | 5 | Sessions to include summaries from |
| `fullObservationCount` | 3 | Observations with full details |
| `showMostRecentSummary` | true | Include most recent summary |
| `showPreviousAssistant` | true | Include previous assistant message |
| `maxTokens` | 8000 | Soft cap on context tokens |

## Common Patterns

### Pattern 1: Default Context (50 observations)

```markdown
# Recent Activity - my-project

**Observations**: 50 of 234 | **Sessions**: 5

### Jan 14, 2025

| ID | Time | Type | Title |
|----|------|------|-------|
| #234 | 4:15 PM | bugfix | Fixed auth token refresh |
| #233 | 4:10 PM | discovery | Found race condition in token refresh |
| #232 | 4:05 PM | change | Added logging to auth module |

[... more observations ...]

---

### #234: Fixed auth token refresh
**Type**: bugfix | **5 minutes ago**

Token was expiring before refresh window started

**Facts**:
- Token TTL was 30 minutes
- Refresh window was 5 minutes before expiry
- Changed TTL to 60 minutes

**Narrative**: The authentication token was expiring before the refresh mechanism could trigger...

**Files Modified**: src/auth.ts

---

## Most Recent Summary

**Request**: Fix authentication token refresh bug

**Completed**: Extended token TTL and fixed refresh window timing

---

*Context includes 50 observations from 5 sessions*
```

### Pattern 2: Minimal Context (10 observations)

For token-constrained environments:

```json
{
  "context": {
    "observationCount": 10,
    "sessionCount": 1,
    "fullObservationCount": 1,
    "showMostRecentSummary": true,
    "showPreviousAssistant": false
  }
}
```

### Pattern 3: Worktree Context (Multiple Projects)

When working in a git worktree, context merges from parent and worktree:

```bash
# Request with multiple projects
curl "http://127.0.0.1:37777/api/context/inject?projects=main-repo,feature-branch"
```

Output shows unified timeline from both projects:

```markdown
# Recent Activity - feature-branch

**Observations**: 50 from main-repo + feature-branch

### Jan 14, 2025 (feature-branch)

| ID | Time | Type | Title |
|----|------|------|-------|
| #456 | 3:00 PM | feature | Added dark mode to settings |

### Jan 14, 2025 (main-repo)

| ID | Time | Type | Title |
|----|------|------|-------|
| #234 | 2:30 PM | bugfix | Fixed auth token refresh |
```

## See Also

- [observation_extraction.md](./observation_extraction.md) - How observations are created
- [session_summary.md](./session_summary.md) - How summaries are generated
- [../cookbook/hook-patterns.md](../cookbook/hook-patterns.md) - SessionStart hook implementation
