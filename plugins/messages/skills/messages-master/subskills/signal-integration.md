# Signal Integration Sub-Skill

Deep knowledge for Signal message sync via signal-cli.

## Architecture Overview

```
Signal Phone App (primary)
         │
         ├── Links to: signal-cli (secondary device)
         │                  │
         │                  ├── CLI Mode: One-shot commands
         │                  │   - listContacts, listGroups, receive
         │                  │   - Best for sync operations
         │                  │
         │                  └── Daemon Mode: JSON-RPC server
         │                      - Real-time message receiving
         │                      - Conflicts with manual receive
         │
         └── Android Backup (historical messages)
                 └── Encrypted .backup file
```

## Critical Insight: Historical Messages

**Signal does NOT provide an API for historical messages.** The `receive` command only gets:
- New messages from server queue (undelivered)
- Messages sent from other devices (sync messages)

For historical messages, you need:
1. **Android backup** (recommended) - decrypt `.backup` file
2. **Signal Desktop database** - encrypted SQLite
3. **Device transfer during linking** (unreliable with signal-cli)

## signal-cli Setup

### Java vs Native Binary

| Version | Pros | Cons |
|---------|------|------|
| **Java** | Full feature support, reliable WebSocket | Requires Java 21+, slower startup |
| **Native (GraalVM)** | Fast, no JRE needed | WebSocket issues with `link` command |

**Recommendation**: Use Java version for linking, either for operations.

### Installation

```bash
# Java version (recommended)
wget https://github.com/AsamK/signal-cli/releases/download/v0.13.22/signal-cli-0.13.22.tar.gz
tar xf signal-cli-0.13.22.tar.gz

# Requires Java 21+
sudo apt install openjdk-21-jre-headless

# Set path
export SIGNAL_CLI_PATH=/path/to/signal-cli-0.13.22/bin/signal-cli
```

### Environment Variables

```bash
SIGNAL_PHONE=+1234567890        # Your Signal phone number
SIGNAL_CLI_PATH=/path/to/signal-cli  # Optional: override default path
```

## Device Linking

### Generate QR Code

```bash
# Start link process (stays running until scanned)
signal-cli link --name "claude-code"

# Output: sgnl://linkdevice?uuid=...&pub_key=...

# Generate QR from URI (Node.js)
node -e "require('qrcode-terminal').generate('sgnl://...', {small: true})"
```

### On Phone
1. Signal → Settings → Linked Devices
2. Link New Device
3. Scan QR code
4. **Important**: If offered, select "Transfer message history"

### Verify Link

```bash
signal-cli listAccounts
# Output: Number: +1234567890
```

## CLI Mode Operations

### List Contacts

```bash
signal-cli -a +1234567890 --output=json listContacts
```

**Output format**: Single-line JSON array (not one object per line)

```json
[{"number":"+14157079105","name":"Alice","profile":{"givenName":"Alice","familyName":"Smith"}},...]
```

**Contact name resolution** (priority order):
1. `contact.name`
2. `contact.profile.givenName` + `contact.profile.familyName`
3. `contact.profile.givenName`
4. `contact.number`

### List Groups

```bash
signal-cli -a +1234567890 --output=json listGroups
```

**Output format**: Single-line JSON array

```json
[{"id":"base64groupid","name":"Family Chat","members":["+1..."]}]
```

### Receive Messages

```bash
signal-cli -a +1234567890 --output=json receive -t 10
```

**Output format**: One JSON object per line (different from list commands!)

```json
{"envelope":{"source":"+1...","timestamp":1234567890,"dataMessage":{"message":"Hello"}},"account":"+1..."}
{"envelope":{"source":"+1...","syncMessage":{"sentMessage":{"message":"My reply"}}},"account":"+1..."}
```

### Message Types in Envelopes

| Type | Location | Description |
|------|----------|-------------|
| Incoming | `envelope.dataMessage.message` | Message from others |
| Sync (sent) | `envelope.syncMessage.sentMessage.message` | Your messages from other devices |
| Typing | `envelope.typingMessage` | Typing indicators |
| Receipt | `envelope.receiptMessage` | Delivery/read receipts |

## Daemon Mode (JSON-RPC)

### Start Daemon

```bash
signal-cli -a +1234567890 daemon --tcp 127.0.0.1:7583
```

### Why Daemon Mode Conflicts

The daemon continuously receives messages internally. Calling `receive` via JSON-RPC fails with:
```
error: Receive command cannot be used if messages are already being received.
```

**Solution**: Use CLI mode for sync operations, daemon only for real-time listening.

## Android Backup Decryption (Recommended for Historical Messages)

### Step 1: Create Backup on Phone

On Android: Signal → Settings → Chats → Chat backups → Create backup

**Output**: `signal-YYYY-MM-DD-HH-MM-SS.backup` (typically 1-5GB)

### Step 2: Note the Passphrase

30-digit passphrase displayed on phone (6 groups of 5 digits):
```
12345 67890 12345 67890 12345 67890
```

**Tip**: Send passphrase to yourself via "Note to Self", then retrieve with:
```bash
signal-cli -a +PHONE --output=json receive -t 5
# Look for syncMessage.sentMessage.message
```

### Step 3: Transfer Backup to PC

**Option A: WiFi HTTP Upload** (for large files)
```python
# Simple upload server (upload-server.py)
import http.server, cgi, os
UPLOAD_DIR = os.path.expanduser("~/signal-backup")
os.makedirs(UPLOAD_DIR, exist_ok=True)

class UploadHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        ctype, pdict = cgi.parse_header(self.headers['Content-Type'])
        pdict['boundary'] = bytes(pdict['boundary'], 'utf-8')
        fields = cgi.parse_multipart(self.rfile, pdict)
        file_data = fields.get('file')[0]
        with open(f"{UPLOAD_DIR}/signal-backup.backup", 'wb') as f:
            f.write(file_data)
        # ... send response

# Run: python3 upload-server.py
# Access: http://YOUR_IP:8888 from phone browser
```

**Option B: LocalSend** (cross-platform)
```bash
flatpak install flathub org.localsend.localsend_app
```

**Option C: USB/ADB**
```bash
adb pull /storage/emulated/0/Signal/Backups/signal-*.backup ./
```

### Step 4: Decrypt Backup

**Python Method (No System Dependencies)**

```bash
# Clone Python decryptor
git clone https://github.com/mossblaser/signal_for_android_decryption /tmp/signal_decrypt

# Ensure dependencies
pip install cryptography protobuf

# Decrypt
python3 /tmp/signal_decrypt/decrypt_backup.py \
  --passphrase "12345 67890 12345 67890 12345 67890" \
  ~/signal-backup/signal-backup.backup \
  ~/signal-backup/decrypted/
```

**Output directory contents:**
```
decrypted/
├── database.sqlite    # Message database (main target)
├── attachments/       # Media files (photos, videos)
├── avatars/           # Contact/group avatars
├── stickers/          # Sticker packs
├── preferences.json   # App preferences
└── key_value.json     # Key-value store
```

**Rust Method** (requires OpenSSL dev headers)
```bash
# Requires: sudo apt install libssl-dev
cargo install signal-backup-decode
signal-backup-decode ~/signal-backup/signal-backup.backup "PASSPHRASE" -o ~/signal-backup/decrypted/
```

**C++ Method** (most features)
```bash
# Build from source or use binary release
signalbackup-tools signal.backup PASSPHRASE --output messages.sqlite
```

### Step 5: Import into Messages Plugin

```bash
# Dry run first (check counts)
bun plugins/messages/src/cli.ts signal-backup -f ~/signal-backup/decrypted/database.sqlite --dry-run

# Import
bun plugins/messages/src/cli.ts signal-backup -f ~/signal-backup/decrypted/database.sqlite
```

**Typical output:**
```
Signal Backup Summary:
  Total Messages: 30,928
  Readable Messages: 27,304
  Threads: 575
  Recipients: 2,090
  Date Range: 2023-08-01 to 2026-01-05
```

### Database Schema Notes

Key tables in `database.sqlite`:

| Table | Purpose |
|-------|---------|
| `message` | All messages (body, timestamp, thread_id, type) |
| `thread` | Conversations (recipient_id links to recipient) |
| `recipient` | Contacts and groups (e164, profile_name, group_id) |
| `attachment` | Media file references |

**Important schema details:**
- `thread.recipient_id` (not `thread_recipient_id`)
- **Direction detection**: Use `from_recipient_id === self_recipient_id` (NOT type bits!)
  - Self recipient is typically `_id=2` with your phone number
  - Type bit patterns (10xxx, 2xxxx) are unreliable across Signal versions
- Timestamps in milliseconds (Unix epoch × 1000)
- Some messages are protobuf-encoded (body starts with "Ci") - skipped

**Direction repair**: If messages have wrong direction tags, run:
```bash
bun plugins/messages/src/cli.ts signal-repair -f ~/signal-backup/decrypted/database.sqlite
```

### Deduplication

CID-based storage ensures re-importing won't create duplicates. Safe to:
- Re-import same backup
- Import overlapping time ranges
- Import from both API and backup

## Messages Plugin Integration

### Adapter Pattern (CLI Mode)

```typescript
async function receiveViaCli(phone: string, timeout: number): Promise<SignalEnvelope[]> {
  const proc = spawn(signalCliPath, ["-a", phone, "--output=json", "receive", "-t", String(timeout)]);

  // Parse line-by-line JSON output
  const lines = stdout.split("\n");
  return lines.map(line => JSON.parse(line).envelope);
}

async function listContactsViaCli(phone: string): Promise<SignalConversation[]> {
  // Parse single-line JSON array output
  const contacts = JSON.parse(stdout);
  return contacts.map(c => ({
    id: c.number,
    name: c.name || c.profile?.givenName || c.number,
    type: "dm"
  }));
}
```

### CLI Commands

```bash
# Check status
bun plugins/messages/src/cli.ts signal-status

# Sync (dry run)
bun plugins/messages/src/cli.ts signal-sync --dry-run

# Sync messages (one-time)
bun plugins/messages/src/cli.ts signal-sync

# Continue listening for new messages (with timeout)
bun plugins/messages/src/cli.ts signal-sync --realtime

# Continuous live sync (runs until Ctrl+C)
bun plugins/messages/src/cli.ts signal-live

# Repair direction tags in existing data
bun plugins/messages/src/cli.ts signal-repair -f ~/signal-backup/decrypted/database.sqlite
```

### Continuous Live Sync Service

The `signal-live` command starts a persistent sync service:

```bash
bun plugins/messages/src/cli.ts signal-live
```

**Features:**
- **Dual-mode**: Tries daemon first (TCP port 7583), falls back to CLI polling
- **Auto-reconnect**: Exponential backoff on disconnect (1s, 2s, 4s...)
- **Real-time display**: Shows messages as they arrive with direction arrows

**Output example:**
```
[2026-01-06 10:30:15] ← Samu: Hey everyone, quick update...
[2026-01-06 10:30:45] → Me: Sounds good!
```

**For persistent background sync:**
```bash
# Run in tmux
tmux new-session -d -s signal-sync 'cd ~/Workspace/claude-plugins/plugins/messages && bun src/cli.ts signal-live'

# Check on it
tmux attach -t signal-sync
```

### MCP Tool

```json
{
  "tool": "messages_import_signal",
  "params": {
    "dryRun": false,
    "sinceDays": 7
  }
}
```

## Data Mapping

| Signal Field | Message Field |
|--------------|---------------|
| `envelope.timestamp` | `created_at` |
| `dataMessage.message` | `content` |
| `envelope.source` | `author.handle` |
| `contact.name` | `author.name` |
| `envelope.dataMessage.groupInfo.groupId` | `refs.thread_id` |

### Kind Mapping

- Signal messages: `Kind.Signal` (1002)
- Thread types: "dm" or "group"

## Troubleshooting

### "Connection closed!" during link

**Cause**: Native binary WebSocket issue
**Fix**: Use Java signal-cli version

### "Receive command cannot be used..."

**Cause**: Daemon mode conflict
**Fix**: Kill daemon, use CLI mode for sync

### No messages after sync

**Cause**: Server queue empty (phone already received them)
**Fix**: Use Android backup for historical messages

### Empty contacts/groups list

**Cause**: JSON parsing expecting wrong format
**Fix**: Parse as single-line JSON array, not line-by-line

### Java version error: "Unrecognized option --enable-native-access"

**Cause**: Java version too old
**Fix**: Install Java 21+: `sudo apt install openjdk-21-jre-headless`

## CLI Quick Reference

```bash
# === Status & Setup ===
bun plugins/messages/src/cli.ts signal-status

# === Live Sync (new messages only) ===
bun plugins/messages/src/cli.ts signal-sync --dry-run
bun plugins/messages/src/cli.ts signal-sync
bun plugins/messages/src/cli.ts signal-sync --realtime
bun plugins/messages/src/cli.ts signal-live  # Continuous (runs until Ctrl+C)

# === Backup Import (historical messages) ===
bun plugins/messages/src/cli.ts signal-backup -f ~/signal-backup/decrypted/database.sqlite --dry-run
bun plugins/messages/src/cli.ts signal-backup -f ~/signal-backup/decrypted/database.sqlite

# === Search ===
bun plugins/messages/src/cli.ts search "meeting" -p signal
bun plugins/messages/src/cli.ts thread signal_dm_12507970950

# === Stats ===
bun plugins/messages/src/cli.ts stats
```

## Summary: Getting Historical Messages

```
┌────────────────────────────────────────────────────────────────┐
│  SIGNAL HISTORICAL MESSAGE IMPORT FLOW                          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Android Phone]                                               │
│       │                                                        │
│       ▼                                                        │
│  Create backup in Signal app                                   │
│  (Settings → Chats → Chat backups → Create)                   │
│       │                                                        │
│       ▼                                                        │
│  Note 30-digit passphrase                                      │
│       │                                                        │
│       ▼                                                        │
│  Transfer .backup to PC (WiFi/USB/LocalSend)                   │
│       │                                                        │
│       ▼                                                        │
│  [Linux PC]                                                    │
│       │                                                        │
│       ▼                                                        │
│  Decrypt with Python tool:                                     │
│  python3 decrypt_backup.py -p "PASSPHRASE" backup decrypted/   │
│       │                                                        │
│       ▼                                                        │
│  Import into messages plugin:                                  │
│  bun cli.ts signal-backup -f decrypted/database.sqlite         │
│       │                                                        │
│       ▼                                                        │
│  Messages searchable! 🎉                                       │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```
