# Messages Integration Sub-Skill

## Overview

Bidirectional integration between transcripts and messages plugin:
1. **Shared accounts**: Speaker profiles link to messages accounts
2. **Message emission**: Utterances become searchable messages
3. **Account resolution**: Find speakers by messages identity

## Prerequisites

Messages plugin must be installed and active:
```
.claude/messages/
├── store/events/
├── views/accounts/
└── ...
```

Check with: `isMessagesPluginAvailable()`

## Linking Speakers to Accounts

### Manual Link

```typescript
// Add messages identity to speaker
speaker.identities.push({
  platform: "messages",
  external_id: "alice_chen",  // Messages account ID
  handle: "Alice Chen",
  verified: true,
  linked_at: Date.now()
});
```

### Automatic Resolution

```typescript
// Find matching account by name
const account = await findAccountByName("Alice Chen");
if (account) {
  const link = createSpeakerLink(account.id, account.name);
  speaker.identities.push(link);
}
```

## Emitting Transcripts to Messages

### Via MCP Tool

```json
// transcripts_emit_to_messages
{
  "transcript_id": "tx_abc123..."
}
```

### What Gets Created

1. **Thread** for the transcript:
   ```json
   {
     "id": "transcript_tx_abc123",
     "title": "Meeting Recording",
     "type": "topic",
     "participants": ["spk_alice", "spk_bob"],
     "source": { "platform": "transcripts" }
   }
   ```

2. **Messages** for each utterance:
   ```json
   {
     "id": "msg_ut_abc123_0001",
     "account_id": "alice_chen",  // If linked
     "kind": 1051,  // UTTERANCE_MESSAGE_KIND
     "content": "Welcome to the meeting",
     "refs": { "thread_id": "transcript_tx_abc123" },
     "tags": [
       ["transcript_id", "tx_abc123"],
       ["start_ms", "0"],
       ["end_ms", "3500"]
     ]
   }
   ```

## Message Kinds

| Kind | Value | Description |
|------|-------|-------------|
| TRANSCRIPT_MESSAGE_KIND | 1050 | Full transcript summary |
| UTTERANCE_MESSAGE_KIND | 1051 | Single utterance |

## Speaker to Account Mapping

When emitting, speakers resolve to accounts:

```typescript
const speakerAccountMap = new Map<SpeakerID, string>();

for (const speaker of speakers) {
  const link = speaker.identities.find(i => i.platform === "messages");
  if (link) {
    speakerAccountMap.set(speaker.id, link.external_id);
  }
}

await emitTranscriptToMessages(transcript, speakerAccountMap);
```

## Querying Across Plugins

### Find transcripts by messages account
```typescript
// Search messages for utterances from account
const results = await messages_search({
  query: "",
  kinds: [1051],
  accounts: ["alice_chen"]
});
```

### Find messages account for speaker
```typescript
const link = getSpeakerMessagesLink(speaker);
const account = await getMessagesAccount(link.external_id);
```

## Import Speakers from Messages

Create speaker profiles from existing messages accounts:

```typescript
for await (const result of importSpeakersFromMessages()) {
  console.log(`${result.action}: ${result.accountName}`);
}
```

Skips system accounts (user, claude, system) and agent accounts.

## Best Practices

1. **Link early**: Connect speakers to accounts when creating
2. **Emit after review**: Verify transcript before emitting
3. **Use same names**: Keep speaker/account names consistent
4. **Check availability**: Always verify messages plugin is active
5. **Handle missing links**: Gracefully handle unlinked speakers
