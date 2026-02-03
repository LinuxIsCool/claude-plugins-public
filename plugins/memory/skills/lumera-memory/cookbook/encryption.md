# AES-256-GCM Client-Side Encryption

Comprehensive guide to Lumera's encryption implementation for agent memory.

## Purpose

Lumera implements client-side encryption using AES-256-GCM, ensuring that session data is encrypted before leaving the local environment. The server (Cascade) never sees plaintext data. This cookbook explains the cryptographic architecture, key management, and verification patterns.

## Variables

```yaml
ALGORITHM: AES-256-GCM
KEY_SIZE_BITS: 256
NONCE_SIZE_BYTES: 12  # 96 bits for GCM
AUTH_TAG_SIZE_BYTES: 16  # 128 bits, appended to ciphertext
KEY_DERIVATION: Direct (production should use KDF)
KEY_STORAGE: In-memory (production should use HSM/KMS)
```

## Instructions

### 1. Understanding the Encryption Pipeline

```
Plaintext → UTF-8 Encode → AES-256-GCM Encrypt → Nonce || Ciphertext → Store
```

**Key components:**
- **Nonce (12 bytes):** Randomly generated per encryption, prepended to output
- **Ciphertext:** Encrypted data with authentication tag
- **No associated data (AAD):** Simplifies implementation; add if needed

### 2. Basic Encryption

```python
import os
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def encrypt_session(plaintext: str, key: bytes) -> tuple[bytes, dict]:
    """
    Encrypt session data with AES-256-GCM.

    Args:
        plaintext: Session data as JSON string
        key: 32-byte encryption key

    Returns:
        (ciphertext_with_nonce, metadata)
    """
    # Validate key size
    if len(key) != 32:
        raise ValueError(f"Key must be 32 bytes, got {len(key)}")

    aesgcm = AESGCM(key)

    # Generate random nonce (CRITICAL: never reuse with same key)
    nonce = os.urandom(12)

    # Encrypt
    plaintext_bytes = plaintext.encode('utf-8')
    ciphertext = aesgcm.encrypt(nonce, plaintext_bytes, None)

    # Prepend nonce for storage
    output = nonce + ciphertext

    # Compute verification hashes
    metadata = {
        "algorithm": "AES-256-GCM",
        "nonce_bytes": 12,
        "plaintext_sha256": hashlib.sha256(plaintext_bytes).hexdigest(),
        "ciphertext_sha256": hashlib.sha256(output).hexdigest(),
        "total_bytes": len(output)
    }

    return output, metadata
```

### 3. Basic Decryption

```python
def decrypt_session(
    ciphertext_with_nonce: bytes,
    key: bytes,
    expected_sha256: str = None
) -> str:
    """
    Decrypt session data with integrity verification.

    Args:
        ciphertext_with_nonce: Encrypted data with prepended nonce
        key: 32-byte decryption key
        expected_sha256: Optional ciphertext hash for integrity check

    Returns:
        Decrypted plaintext string
    """
    # Integrity check (before decryption)
    if expected_sha256:
        actual_sha256 = hashlib.sha256(ciphertext_with_nonce).hexdigest()
        if actual_sha256 != expected_sha256:
            raise ValueError(
                f"Integrity check failed. "
                f"Expected: {expected_sha256}, Got: {actual_sha256}"
            )

    aesgcm = AESGCM(key)

    # Extract nonce (first 12 bytes)
    nonce = ciphertext_with_nonce[:12]
    ciphertext = ciphertext_with_nonce[12:]

    # Decrypt and verify authentication tag
    try:
        plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, None)
    except Exception as e:
        raise ValueError(f"Decryption failed (tampering or wrong key): {e}")

    return plaintext_bytes.decode('utf-8')
```

### 4. Key Management

**Development/Testing:**
```python
# In-memory key store (NOT for production)
_KEY_STORE = {}

def get_or_create_key(key_id: str = "default") -> bytes:
    """Get or create an encryption key."""
    if key_id not in _KEY_STORE:
        _KEY_STORE[key_id] = AESGCM.generate_key(bit_length=256)
    return _KEY_STORE[key_id]
```

**Production patterns:**

```python
# 1. Environment variable (simple but limited)
import base64

def get_key_from_env(key_id: str) -> bytes:
    key_b64 = os.environ.get(f"LUMERA_KEY_{key_id.upper()}")
    if not key_b64:
        raise ValueError(f"Key {key_id} not found in environment")
    return base64.b64decode(key_b64)

# 2. AWS KMS integration
import boto3

def get_key_from_kms(key_arn: str) -> bytes:
    kms = boto3.client('kms')
    response = kms.generate_data_key(
        KeyId=key_arn,
        KeySpec='AES_256'
    )
    return response['Plaintext']

# 3. HashiCorp Vault
import hvac

def get_key_from_vault(path: str) -> bytes:
    client = hvac.Client(url=os.environ['VAULT_ADDR'])
    secret = client.secrets.kv.v2.read_secret_version(path=path)
    return base64.b64decode(secret['data']['data']['key'])
```

### 5. Key Rotation

```python
class KeyRotator:
    """Handle key rotation with versioning."""

    def __init__(self):
        self.keys = {}  # key_id -> bytes
        self.current_version = 1

    def rotate(self) -> str:
        """Generate new key and increment version."""
        self.current_version += 1
        new_key_id = f"v{self.current_version}"
        self.keys[new_key_id] = AESGCM.generate_key(bit_length=256)
        return new_key_id

    def encrypt_with_current(self, plaintext: str) -> tuple[bytes, str]:
        """Encrypt using current key version."""
        key_id = f"v{self.current_version}"
        key = self.keys[key_id]
        ciphertext, _ = encrypt_session(plaintext, key)
        return ciphertext, key_id

    def decrypt_with_version(self, ciphertext: bytes, key_id: str) -> str:
        """Decrypt using specified key version."""
        key = self.keys.get(key_id)
        if not key:
            raise ValueError(f"Key version {key_id} not found")
        return decrypt_session(ciphertext, key)
```

### 6. Crypto Result Object

```python
from dataclasses import dataclass

@dataclass
class CryptoResult:
    """Encryption result with full metadata."""
    ciphertext: bytes
    algorithm: str
    key_id: str
    plaintext_sha256: str
    ciphertext_sha256: str
    nonce_hex: str = None  # For debugging only

    def to_dict(self) -> dict:
        return {
            "algorithm": self.algorithm,
            "key_id": self.key_id,
            "plaintext_sha256": self.plaintext_sha256,
            "ciphertext_sha256": self.ciphertext_sha256,
            "bytes": len(self.ciphertext)
        }

def encrypt_with_metadata(
    plaintext: str,
    key_id: str = "default"
) -> CryptoResult:
    """Full encryption with metadata tracking."""
    key = get_or_create_key(key_id)
    ciphertext, meta = encrypt_session(plaintext, key)

    return CryptoResult(
        ciphertext=ciphertext,
        algorithm="AES-256-GCM",
        key_id=key_id,
        plaintext_sha256=meta["plaintext_sha256"],
        ciphertext_sha256=meta["ciphertext_sha256"]
    )
```

## Common Patterns

### Encrypt-Store-Verify Round Trip

```python
import json

async def secure_store_flow(session_data: dict, client) -> dict:
    """Complete encryption and storage workflow."""

    # 1. Serialize to JSON
    plaintext = json.dumps(session_data, sort_keys=True)

    # 2. Encrypt
    crypto_result = encrypt_with_metadata(plaintext, key_id="production")

    # 3. Store to Cascade
    cascade_uri = await client.cascade.upload_blob(crypto_result.ciphertext)

    # 4. Index with crypto metadata
    client.index.store_memory(
        session_id=session_data["session_id"],
        cascade_uri=cascade_uri,
        metadata={"crypto": crypto_result.to_dict()}
    )

    # 5. Verify by retrieval
    retrieved_blob = await client.cascade.download_blob(cascade_uri)
    retrieved_hash = hashlib.sha256(retrieved_blob).hexdigest()

    assert retrieved_hash == crypto_result.ciphertext_sha256, "Verification failed"

    return {
        "cascade_uri": cascade_uri,
        "crypto": crypto_result.to_dict(),
        "verified": True
    }
```

### Batch Encryption with Parallel Processing

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

async def batch_encrypt(sessions: list[dict]) -> list[CryptoResult]:
    """Encrypt multiple sessions in parallel."""
    executor = ThreadPoolExecutor(max_workers=4)
    loop = asyncio.get_event_loop()

    async def encrypt_one(session):
        plaintext = json.dumps(session)
        return await loop.run_in_executor(
            executor,
            lambda: encrypt_with_metadata(plaintext)
        )

    tasks = [encrypt_one(s) for s in sessions]
    return await asyncio.gather(*tasks)
```

### Integrity Verification Before Decryption

```python
def secure_decrypt(
    ciphertext: bytes,
    index_entry: dict,
    key_id: str = "default"
) -> str:
    """Decrypt with full integrity verification."""

    expected_hash = index_entry["metadata"]["crypto"]["ciphertext_sha256"]

    # 1. Verify ciphertext integrity
    actual_hash = hashlib.sha256(ciphertext).hexdigest()
    if actual_hash != expected_hash:
        raise ValueError(
            f"Ciphertext integrity check failed. "
            f"Data may have been tampered with. "
            f"Expected: {expected_hash[:16]}..., Got: {actual_hash[:16]}..."
        )

    # 2. Decrypt
    key = get_or_create_key(key_id)
    plaintext = decrypt_session(ciphertext, key)

    # 3. Verify plaintext hash (optional extra check)
    expected_plaintext_hash = index_entry["metadata"]["crypto"]["plaintext_sha256"]
    actual_plaintext_hash = hashlib.sha256(plaintext.encode()).hexdigest()

    if actual_plaintext_hash != expected_plaintext_hash:
        raise ValueError("Plaintext hash mismatch after decryption")

    return plaintext
```

## Security Considerations

### Nonce Requirements

```python
# CRITICAL: Never reuse nonce with the same key
# GCM security breaks completely on nonce reuse

# GOOD: Random nonce per encryption
nonce = os.urandom(12)

# BAD: Counter-based nonce (risk of collision in distributed systems)
# nonce = counter.to_bytes(12, 'big')

# BAD: Timestamp-based nonce (collisions within same millisecond)
# nonce = struct.pack('>Q', int(time.time() * 1000)) + b'\x00\x00\x00\x00'
```

### Key Security Checklist

| Requirement | Implementation |
|-------------|---------------|
| Key size | 256 bits (32 bytes) |
| Key storage | Never in code, use env/KMS/Vault |
| Key rotation | Version keys, support old versions for decryption |
| Key derivation | Use HKDF if deriving from password |
| Memory protection | Zero key bytes after use (if possible) |

### Authentication Tag Verification

```python
# GCM automatically verifies authentication tag during decryption
# If tag verification fails, decrypt() raises InvalidTag exception

try:
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
except cryptography.exceptions.InvalidTag:
    # Ciphertext was tampered with
    raise SecurityError("Authentication tag verification failed")
```

## Testing Encryption

```python
import pytest

def test_encrypt_decrypt_roundtrip():
    """Verify encryption/decryption roundtrip."""
    original = '{"session_id": "test", "messages": []}'
    key = AESGCM.generate_key(bit_length=256)

    ciphertext, metadata = encrypt_session(original, key)
    decrypted = decrypt_session(ciphertext, key)

    assert decrypted == original
    assert len(ciphertext) > len(original)  # Encryption adds overhead

def test_wrong_key_fails():
    """Verify decryption fails with wrong key."""
    original = '{"test": true}'
    key1 = AESGCM.generate_key(bit_length=256)
    key2 = AESGCM.generate_key(bit_length=256)

    ciphertext, _ = encrypt_session(original, key1)

    with pytest.raises(Exception):
        decrypt_session(ciphertext, key2)

def test_tampered_ciphertext_fails():
    """Verify tampered ciphertext is detected."""
    original = '{"test": true}'
    key = AESGCM.generate_key(bit_length=256)

    ciphertext, _ = encrypt_session(original, key)

    # Tamper with ciphertext
    tampered = bytearray(ciphertext)
    tampered[20] ^= 0xFF
    tampered = bytes(tampered)

    with pytest.raises(Exception):
        decrypt_session(tampered, key)
```

## Related Resources

- `cookbook/quickstart.md` - Basic operations
- `cookbook/pii-redaction.md` - Pre-encryption redaction
- `tools/encrypt_decrypt.py` - Standalone encryption utilities
