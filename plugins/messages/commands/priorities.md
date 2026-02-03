---
description: Show message/thread priorities across Signal, Telegram, and Email
argument-hint: "[overview|signal|telegram|emails]"
---

# Priorities Command

Show thread and message priorities across all messaging platforms. Today is !date.

## Arguments

The user invoked: `/priorities $ARGUMENTS`

## Available Subcommands

### No Arguments or "overview" or "all"
Show top priority threads for all platforms in one view.

Run:
```bash
bun plugins/messages/src/cli.ts analytics overview --limit 15
```

Present the output showing:
- Signal threads (priority, outbound, inbound, recency)
- Telegram threads (priority, outbound, inbound, recency)
- Email threads (priority, signals like $ for bills, recency)

### "signal"
Show only Signal thread priorities.

Run:
```bash
bun plugins/messages/src/cli.ts analytics threads --platform signal --limit 20
```

### "telegram"
Show only Telegram thread priorities.

Run:
```bash
bun plugins/messages/src/cli.ts analytics threads --platform telegram --limit 20
```

### "emails" or "email"
Show only Email thread priorities with content signals.

Run:
```bash
bun plugins/messages/src/cli.ts analytics emails --limit 20
```

## Scoring Explanation

After showing results, briefly explain the scoring:

**Chat Threads (Signal/Telegram):**
- Outbound messages weighted heavily (messages YOU send indicate priority)
- Group dilution: large groups weighted less (1/sqrt(participants))
- Reciprocity bonus for bidirectional conversations
- 7-day decay half-life

**Relationship Tiers:**
- **Engaged**: You've messaged them at least once (historical outbound > 0)
- **Monitor**: Only inbound messages (they message you, you never replied)
- **Noise**: Below minimum activity threshold

Threads where you've engaged historically stay prioritized even when dormant. This prevents spam and broadcast groups from surfacing while keeping important but quiet relationships visible.

**Email Threads:**
- Financial keywords ($): bill, invoice, payment, due
- Urgency keywords (!): urgent, ASAP, deadline
- Question keywords (?): ?, can you, help
- 2-day decay half-life (faster than chat)

## Thread Blacklist

Permanently exclude noisy threads from priority rankings by adding them to:
```
.claude/messages/config/thread-blacklist.json
```

Format:
```json
{
  "description": "Threads to exclude from priority rankings",
  "blacklist": [
    { "thread_id": "tg_-1001357982180", "name": "Noisy Group", "reason": "noise" }
  ]
}
```

Blacklisted threads still sync (data is preserved) but score as 0 in priority rankings.

## Examples

```
/priorities              → All platforms overview
/priorities overview     → Same as above
/priorities signal       → Signal threads only
/priorities telegram     → Telegram threads only
/priorities emails       → Email threads with signals
```

## Follow-up Suggestions

After showing priorities, offer:
1. View a specific thread: `/messages thread <id>`
2. Search messages: `/messages search <query>`
3. Filter by different limits: run with `--limit N`

## CLI Location

```
bun plugins/messages/src/cli.ts analytics <subcommand>
```
