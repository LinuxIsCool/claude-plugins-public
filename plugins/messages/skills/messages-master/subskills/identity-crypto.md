# Identity & Cryptography Sub-Skill

Content-addressed identifiers (CIDs) and decentralized identity (DIDs).

## Content Identifiers (CIDs)

### What is a CID?

A CID is a **content-addressed identifier** - a hash derived from the content itself. The messages plugin uses CIDs as primary keys for all messages.

### Format
```
msg_8JQB3nBTbgXuFeUrYz6r5UViMEcWBUUxUX8wkcJq5mbo
```

Structure:
- `msg_` - prefix indicating message CID
- 44 characters - base58-encoded SHA-256 hash

### Generation Algorithm

```typescript
function generateCID(input: MessageInput): string {
  // 1. Create canonical payload (sorted keys)
  const payload = canonicalize({
    content: input.content,
    kind: input.kind,
    created_at: input.created_at,
    account_id: input.account_id,
  });

  // 2. SHA-256 hash
  const hash = sha256(payload);

  // 3. Base58 encode (no truncation)
  const encoded = base58Encode(hash);

  // 4. Add prefix
  return "msg_" + encoded;
}
```

### Key Properties

| Property | Description |
|----------|-------------|
| **Deterministic** | Same input always produces same CID |
| **Collision-resistant** | Different content produces different CIDs |
| **Verifiable** | Anyone can verify content matches CID |
| **No authority** | No central server assigns IDs |

### Canonicalization

To ensure consistent hashing, objects are canonicalized:

```typescript
// Input (unordered)
{ kind: 1, content: "hello", created_at: 123, account_id: "alice" }

// Canonicalized (sorted keys)
{"account_id":"alice","content":"hello","created_at":123,"kind":1}
```

### Verification

```typescript
import { verifyCID, generateCID } from "@plugins/messages";

// Verify a message's integrity
const isValid = verifyCID(message.id, {
  content: message.content,
  kind: message.kind,
  created_at: message.created_at,
  account_id: message.account_id,
});
```

## Decentralized Identifiers (DIDs)

### What is a DID?

A DID is a **decentralized identifier** - a globally unique identifier that doesn't depend on any central authority. The messages plugin uses DIDs for cryptographic identity.

### Format
```
did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK
```

Structure:
- `did:key:` - method prefix
- `z6Mk...` - multibase-encoded Ed25519 public key

### Generation

```typescript
import { generateDID } from "@plugins/messages";

// Generate new DID with keypair
const { did, privateKey, publicKey } = await generateDID();

// Export for storage
const exported = exportDIDKeyPair(did, privateKey, publicKey);

// Import later
const imported = importDIDKeyPair(exported);
```

### Signing Messages

```typescript
import { signWithDID, verifyDIDSignature } from "@plugins/messages";

// Sign content
const signature = await signWithDID(privateKey, "message content");

// Verify signature
const isValid = await verifyDIDSignature(did, signature, "message content");
```

### Account DIDs

Accounts can optionally have DIDs for cryptographic identity:

```typescript
const account: Account = {
  id: "alice",
  name: "Alice",
  did: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  identities: [
    { platform: "telegram", handle: "@alice" },
    { platform: "github", handle: "alice-dev" },
  ],
  // ...
};
```

## Base58 Encoding

### Why Base58?

Base58 (Bitcoin alphabet) avoids confusing characters:
- No `0` (zero) or `O` (letter O)
- No `I` (letter I) or `l` (letter l)
- No `+` or `/` (URL-safe)

### Alphabet
```
123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
```

### Usage

```typescript
import { base58Encode, base58Decode } from "@plugins/messages";

// Encode bytes
const encoded = base58Encode(new Uint8Array([1, 2, 3]));

// Decode back
const decoded = base58Decode(encoded);
```

## Security Considerations

### CID Integrity
- CIDs provide **integrity verification** but not **authentication**
- Anyone can generate the same CID for the same content
- Use DIDs and signatures for authentication

### DID Key Storage
- Private keys should be stored securely
- Never expose private keys in logs or messages
- Consider using secure storage (keychain, encrypted file)

### Signature Verification
- Always verify signatures before trusting signed content
- Check that the DID matches expected identity
- Verify the signature algorithm matches expectations

## Common Patterns

### Verify Message Integrity
```typescript
const message = await store.getMessage(cid);
if (message) {
  const valid = verifyCID(message.id, message);
  if (!valid) {
    console.error("Message content has been tampered with!");
  }
}
```

### Link Identity Across Platforms
```typescript
// One DID, multiple platform identities
const account = await store.createAccount({
  id: "alice",
  name: "Alice Smith",
  did: "did:key:z6Mk...",
  identities: [
    { platform: "telegram", handle: "@alice" },
    { platform: "discord", handle: "alice#1234" },
    { platform: "email", handle: "alice@example.com" },
  ],
});
```

### Sign Agent Messages
```typescript
// Agent creates signed message
const content = "I am agent-001 and I approve this message.";
const signature = await signWithDID(agentPrivateKey, content);

const message = await store.createMessage({
  content,
  kind: Kind.Text,
  // ... other fields
  tags: [
    ["signature", signature],
    ["signer", agentDID],
  ],
});
```
