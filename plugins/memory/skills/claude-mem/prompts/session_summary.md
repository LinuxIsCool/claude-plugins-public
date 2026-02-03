# Session Summary Prompt Template

## Purpose

Generate compressed progress summaries at the end of each exchange. This template captures what was accomplished, learned, and planned during a Claude Code session for retrieval in future sessions.

## Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `{SESSION_ID}` | UUID string | Unique session identifier |
| `{PROJECT}` | Project name | Derived from working directory |
| `{USER_PROMPT}` | Original request | The user's initial prompt |
| `{LAST_ASSISTANT_MESSAGE}` | Full response | Claude's complete response to the user |

## Template: Summary Header

```xml
PROGRESS SUMMARY CHECKPOINT
===========================
```

## Template: Summary Instruction

```xml
Write progress notes of what was done, what was learned, and what's next.

This is a checkpoint to capture progress so far. The session is ongoing - you may receive more requests and tool executions after this summary.

Write "next_steps" as the current trajectory of work (what's actively being worked on or coming up next), not as post-session future work.

Always write at least a minimal summary explaining current progress, even if work is still in early stages, so that users see a summary output tied to each request.
```

## Template: Output Format

```xml
Respond in this XML format:

<summary>
  <request>[Short title capturing the user's request AND the substance of what was discussed/done]</request>
  <investigated>[What has been explored so far? What was examined?]</investigated>
  <learned>[What have you learned about how things work?]</learned>
  <completed>[What work has been completed so far? What has shipped or changed?]</completed>
  <next_steps>[What are you actively working on or planning to work on next in this session?]</next_steps>
  <notes>[Additional insights or observations about the current progress]</notes>
</summary>
```

## Template: Full Summary Prompt

Complete template for generating a session summary:

```xml
PROGRESS SUMMARY CHECKPOINT
===========================

Write progress notes of what was done, what was learned, and what's next.

This is a checkpoint to capture progress so far. The session is ongoing - you may receive more requests and tool executions after this summary.

Write "next_steps" as the current trajectory of work (what's actively being worked on or coming up next), not as post-session future work.

Always write at least a minimal summary explaining current progress, even if work is still in early stages, so that users see a summary output tied to each request.

Claude's Full Response to User:
{LAST_ASSISTANT_MESSAGE}

Respond in this XML format:
<summary>
  <request>[Short title capturing the user's request AND the substance of what was discussed/done]</request>
  <investigated>[What has been explored so far? What was examined?]</investigated>
  <learned>[What have you learned about how things work?]</learned>
  <completed>[What work has been completed so far? What has shipped or changed?]</completed>
  <next_steps>[What are you actively working on or planning to work on next in this session?]</next_steps>
  <notes>[Additional insights or observations about the current progress]</notes>
</summary>

IMPORTANT! DO NOT do any work right now other than generating this next PROGRESS SUMMARY - and remember that you are a memory agent designed to summarize a DIFFERENT claude code session, not this one.

Never reference yourself or your own actions. Do not output anything other than the summary content formatted in the XML structure above. All other output is ignored by the system, and the system has been designed to be smart about token usage. Please spend your tokens wisely on useful summary content.

Thank you, this summary will be very useful for keeping track of our progress!
```

## Code Example: Building the Summary Prompt

```typescript
interface SDKSession {
  id: number;
  memory_session_id: string | null;
  project: string;
  user_prompt: string;
  last_assistant_message?: string;
}

interface ModeConfig {
  prompts: {
    header_summary_checkpoint: string;
    summary_instruction: string;
    summary_context_label: string;
    summary_format_instruction: string;
    xml_summary_request_placeholder: string;
    xml_summary_investigated_placeholder: string;
    xml_summary_learned_placeholder: string;
    xml_summary_completed_placeholder: string;
    xml_summary_next_steps_placeholder: string;
    xml_summary_notes_placeholder: string;
    summary_footer: string;
  };
}

function buildSummaryPrompt(session: SDKSession, mode: ModeConfig): string {
  const lastAssistantMessage = session.last_assistant_message || '';

  return `${mode.prompts.header_summary_checkpoint}
${mode.prompts.summary_instruction}

${mode.prompts.summary_context_label}
${lastAssistantMessage}

${mode.prompts.summary_format_instruction}
<summary>
  <request>${mode.prompts.xml_summary_request_placeholder}</request>
  <investigated>${mode.prompts.xml_summary_investigated_placeholder}</investigated>
  <learned>${mode.prompts.xml_summary_learned_placeholder}</learned>
  <completed>${mode.prompts.xml_summary_completed_placeholder}</completed>
  <next_steps>${mode.prompts.xml_summary_next_steps_placeholder}</next_steps>
  <notes>${mode.prompts.xml_summary_notes_placeholder}</notes>
</summary>

${mode.prompts.summary_footer}`;
}
```

## Code Example: Parsing Summary Response

```typescript
interface ParsedSummary {
  request: string;
  investigated: string;
  learned: string;
  completed: string;
  next_steps: string;
  notes: string;
}

function parseSummaryResponse(xml: string): ParsedSummary | null {
  // Extract content within <summary>...</summary>
  const summaryMatch = xml.match(/<summary>([\s\S]*?)<\/summary>/);
  if (!summaryMatch) {
    return null;
  }

  const content = summaryMatch[1];

  // Extract each field
  const extractField = (field: string): string => {
    const regex = new RegExp(`<${field}>([\\s\\S]*?)<\\/${field}>`);
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  };

  return {
    request: extractField('request'),
    investigated: extractField('investigated'),
    learned: extractField('learned'),
    completed: extractField('completed'),
    next_steps: extractField('next_steps'),
    notes: extractField('notes')
  };
}
```

## Field Guidelines

### request

Capture the essence of what the user asked for AND what was done:

```xml
<!-- Good -->
<request>Fix authentication token refresh bug in OAuth2 flow</request>
<request>Add dark mode toggle to settings page with theme persistence</request>

<!-- Bad - too vague -->
<request>Fix bug</request>
<request>Work on settings</request>
```

### investigated

Document what was explored or examined:

```xml
<!-- Good -->
<investigated>
Examined the OAuth2 token refresh logic in auth.ts.
Traced the token lifecycle from initial grant through refresh attempts.
Reviewed the error logs showing token expiry timing issues.
</investigated>
```

### learned

Capture insights about how the system works:

```xml
<!-- Good -->
<learned>
The token TTL was set to 30 minutes but the refresh window only started 5 minutes before expiry.
Tokens use RS256 signing and are validated against the JWKS endpoint.
The refresh token has a 7-day lifetime with sliding expiration.
</learned>
```

### completed

Document concrete deliverables:

```xml
<!-- Good -->
<completed>
Extended token TTL from 30 to 60 minutes in auth.ts.
Added buffer time calculation to start refresh 10 minutes before expiry.
Updated unit tests to verify new refresh window timing.
</completed>

<!-- Bad - describes process, not deliverables -->
<completed>
Looked at the code and found some issues.
Made some changes to improve things.
</completed>
```

### next_steps

Capture the current trajectory (not future work):

```xml
<!-- Good -->
<next_steps>
Currently implementing the UI feedback for token refresh status.
Will add logging to track refresh success rates.
Testing the changes against the staging OAuth provider.
</next_steps>

<!-- Bad - describes distant future -->
<next_steps>
Might want to refactor auth in the future.
Could consider adding more tests someday.
</next_steps>
```

### notes

Additional insights or observations:

```xml
<!-- Good -->
<notes>
The token expiry issue was intermittent because it depended on clock skew between client and server.
Consider adding clock sync validation in future iterations.
Related to issue #123 reported last week.
</notes>
```

## Common Patterns

### Pattern 1: Discovery-Heavy Session

When the session was mostly exploration:

```xml
<summary>
  <request>Investigate authentication architecture for security audit</request>
  <investigated>
    Traced auth flow from login through session management.
    Examined JWT validation, token refresh, and session storage.
    Reviewed security headers and CORS configuration.
  </investigated>
  <learned>
    Auth uses RS256 signed JWTs with 1-hour expiry.
    Refresh tokens stored in HttpOnly cookies.
    CORS allows specific origins defined in environment.
  </learned>
  <completed>
    Documented auth flow in architecture diagrams.
    Created security audit checklist from findings.
  </completed>
  <next_steps>
    Reviewing rate limiting implementation next.
    Will check for token revocation mechanisms.
  </next_steps>
  <notes>
    Found potential session fixation risk - flagged for review.
  </notes>
</summary>
```

### Pattern 2: Implementation-Heavy Session

When the session was mostly building:

```xml
<summary>
  <request>Implement OAuth2 PKCE flow for mobile app</request>
  <investigated>
    Reviewed existing OAuth configuration.
    Checked mobile app authentication requirements.
  </investigated>
  <learned>
    PKCE requires code_verifier and code_challenge generation.
    Mobile apps cannot safely store client secrets.
  </learned>
  <completed>
    Added PKCE challenge generation in auth/pkce.ts.
    Updated OAuth client configuration for public clients.
    Implemented token exchange endpoint for PKCE flow.
    Added integration tests for mobile auth flow.
  </completed>
  <next_steps>
    Testing against real OAuth provider.
    Updating mobile SDK documentation.
  </next_steps>
  <notes>
    Consider adding biometric authentication in future iteration.
  </notes>
</summary>
```

### Pattern 3: Debugging Session

When the session focused on fixing issues:

```xml
<summary>
  <request>Fix intermittent 401 errors on API requests</request>
  <investigated>
    Analyzed error logs for 401 responses.
    Traced failing requests through auth middleware.
    Compared successful vs failed request timing.
  </investigated>
  <learned>
    Token refresh was racing with API requests.
    Request queue was not waiting for token refresh completion.
    Clock skew between services was 30+ seconds.
  </learned>
  <completed>
    Added request queuing during token refresh in api-client.ts.
    Implemented retry logic for 401 responses with fresh token.
    Fixed race condition in token refresh mutex.
  </completed>
  <next_steps>
    Monitoring error rates after deployment.
    Adding metrics for token refresh timing.
  </next_steps>
  <notes>
    Root cause was a combination of clock skew and race condition.
    Consider adding NTP sync validation.
  </notes>
</summary>
```

## Storage Schema

The parsed summary is stored in the database:

```sql
CREATE TABLE session_summaries (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL,
  request TEXT NOT NULL,
  investigated TEXT,
  learned TEXT,
  completed TEXT,
  next_steps TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

## See Also

- [observation_extraction.md](./observation_extraction.md) - Observation extraction template
- [context_injection.md](./context_injection.md) - Context injection template
- [../cookbook/hook-patterns.md](../cookbook/hook-patterns.md) - Stop hook implementation
