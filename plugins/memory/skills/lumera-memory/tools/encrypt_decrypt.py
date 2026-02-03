#!/usr/bin/env python3
"""
Lumera Agent Memory - Standalone Encryption Utilities

Provides AES-256-GCM encryption/decryption for session data.
Can be used independently of the full Lumera client.
"""

import argparse
import base64
import hashlib
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False


# ==============================================================================
# Data Classes
# ==============================================================================

@dataclass
class EncryptionResult:
    """Result of encryption operation."""
    ciphertext: bytes
    nonce: bytes
    algorithm: str
    key_id: str
    plaintext_sha256: str
    ciphertext_sha256: str

    def to_dict(self) -> dict:
        return {
            "algorithm": self.algorithm,
            "key_id": self.key_id,
            "plaintext_sha256": self.plaintext_sha256,
            "ciphertext_sha256": self.ciphertext_sha256,
            "nonce_hex": self.nonce.hex(),
            "ciphertext_bytes": len(self.ciphertext)
        }

    def to_storage_format(self) -> bytes:
        """Return ciphertext with prepended nonce for storage."""
        return self.nonce + self.ciphertext


@dataclass
class DecryptionResult:
    """Result of decryption operation."""
    plaintext: str
    verified: bool
    plaintext_sha256: str

    def to_dict(self) -> dict:
        return {
            "verified": self.verified,
            "plaintext_sha256": self.plaintext_sha256,
            "plaintext_bytes": len(self.plaintext.encode('utf-8'))
        }


# ==============================================================================
# Key Management
# ==============================================================================

class KeyStore:
    """
    Simple key storage and management.

    For production, replace with proper key management (KMS, Vault, etc.)
    """

    def __init__(self, key_dir: Optional[str] = None):
        """
        Initialize key store.

        Args:
            key_dir: Directory to store keys (default: ~/.lumera/keys)
        """
        if key_dir is None:
            key_dir = os.path.expanduser("~/.lumera/keys")

        self.key_dir = Path(key_dir)
        self.key_dir.mkdir(parents=True, exist_ok=True)

        # In-memory cache
        self._cache = {}

    def get_key(self, key_id: str) -> bytes:
        """Get key by ID, creating if it doesn't exist."""
        if key_id in self._cache:
            return self._cache[key_id]

        key_path = self.key_dir / f"{key_id}.key"

        if key_path.exists():
            # Load existing key
            key_data = key_path.read_bytes()
            key = base64.b64decode(key_data)
        else:
            # Generate new key
            key = AESGCM.generate_key(bit_length=256)
            key_path.write_bytes(base64.b64encode(key))
            os.chmod(key_path, 0o600)  # Restrict permissions

        self._cache[key_id] = key
        return key

    def import_key(self, key_id: str, key_bytes: bytes) -> None:
        """Import an existing key."""
        if len(key_bytes) != 32:
            raise ValueError(f"Key must be 32 bytes, got {len(key_bytes)}")

        key_path = self.key_dir / f"{key_id}.key"
        key_path.write_bytes(base64.b64encode(key_bytes))
        os.chmod(key_path, 0o600)

        self._cache[key_id] = key_bytes

    def export_key(self, key_id: str) -> bytes:
        """Export a key as raw bytes."""
        return self.get_key(key_id)

    def list_keys(self) -> list:
        """List all available key IDs."""
        return [p.stem for p in self.key_dir.glob("*.key")]

    def delete_key(self, key_id: str) -> bool:
        """Delete a key."""
        key_path = self.key_dir / f"{key_id}.key"

        if key_path.exists():
            key_path.unlink()
            self._cache.pop(key_id, None)
            return True

        return False


def derive_key_from_password(
    password: str,
    salt: Optional[bytes] = None,
    iterations: int = 100000
) -> Tuple[bytes, bytes]:
    """
    Derive encryption key from password using HKDF.

    Args:
        password: Password string
        salt: Optional salt (generated if not provided)
        iterations: Not used for HKDF (kept for API compatibility)

    Returns:
        (derived_key, salt)
    """
    if not HAS_CRYPTO:
        raise RuntimeError("cryptography package required")

    if salt is None:
        salt = os.urandom(16)

    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        info=b"lumera-agent-memory",
    )

    key = hkdf.derive(password.encode('utf-8'))
    return key, salt


# ==============================================================================
# Core Encryption Functions
# ==============================================================================

def encrypt(
    plaintext: str,
    key: bytes,
    key_id: str = "unknown"
) -> EncryptionResult:
    """
    Encrypt plaintext using AES-256-GCM.

    Args:
        plaintext: String to encrypt
        key: 32-byte encryption key
        key_id: Identifier for the key (for metadata)

    Returns:
        EncryptionResult with ciphertext and metadata
    """
    if not HAS_CRYPTO:
        raise RuntimeError("cryptography package required")

    if len(key) != 32:
        raise ValueError(f"Key must be 32 bytes, got {len(key)}")

    # Create cipher
    aesgcm = AESGCM(key)

    # Generate random nonce (12 bytes for GCM)
    nonce = os.urandom(12)

    # Encrypt
    plaintext_bytes = plaintext.encode('utf-8')
    ciphertext = aesgcm.encrypt(nonce, plaintext_bytes, None)

    # Compute hashes
    plaintext_sha256 = hashlib.sha256(plaintext_bytes).hexdigest()
    ciphertext_with_nonce = nonce + ciphertext
    ciphertext_sha256 = hashlib.sha256(ciphertext_with_nonce).hexdigest()

    return EncryptionResult(
        ciphertext=ciphertext,
        nonce=nonce,
        algorithm="AES-256-GCM",
        key_id=key_id,
        plaintext_sha256=plaintext_sha256,
        ciphertext_sha256=ciphertext_sha256
    )


def decrypt(
    ciphertext_with_nonce: bytes,
    key: bytes,
    expected_sha256: Optional[str] = None
) -> DecryptionResult:
    """
    Decrypt AES-256-GCM ciphertext.

    Args:
        ciphertext_with_nonce: Encrypted data with prepended nonce
        key: 32-byte decryption key
        expected_sha256: Optional integrity check

    Returns:
        DecryptionResult with plaintext and verification status
    """
    if not HAS_CRYPTO:
        raise RuntimeError("cryptography package required")

    if len(key) != 32:
        raise ValueError(f"Key must be 32 bytes, got {len(key)}")

    # Verify integrity if expected hash provided
    verified = True
    if expected_sha256:
        actual_sha256 = hashlib.sha256(ciphertext_with_nonce).hexdigest()
        if actual_sha256 != expected_sha256:
            raise ValueError(
                f"Integrity check failed. "
                f"Expected: {expected_sha256}, Got: {actual_sha256}"
            )

    # Extract nonce and ciphertext
    nonce = ciphertext_with_nonce[:12]
    ciphertext = ciphertext_with_nonce[12:]

    # Decrypt
    aesgcm = AESGCM(key)

    try:
        plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, None)
    except Exception as e:
        raise ValueError(f"Decryption failed (wrong key or tampered data): {e}")

    plaintext = plaintext_bytes.decode('utf-8')
    plaintext_sha256 = hashlib.sha256(plaintext_bytes).hexdigest()

    return DecryptionResult(
        plaintext=plaintext,
        verified=verified,
        plaintext_sha256=plaintext_sha256
    )


# ==============================================================================
# File Operations
# ==============================================================================

def encrypt_file(
    input_path: str,
    output_path: str,
    key: bytes,
    key_id: str = "unknown"
) -> dict:
    """
    Encrypt a file.

    Args:
        input_path: Path to input file
        output_path: Path for encrypted output
        key: 32-byte encryption key
        key_id: Key identifier for metadata

    Returns:
        Encryption metadata
    """
    input_path = Path(input_path)
    output_path = Path(output_path)

    # Read input
    plaintext = input_path.read_text(encoding='utf-8')

    # Encrypt
    result = encrypt(plaintext, key, key_id)

    # Write output (nonce + ciphertext)
    output_path.write_bytes(result.to_storage_format())

    # Write metadata sidecar
    meta_path = output_path.with_suffix(output_path.suffix + '.meta')
    meta_path.write_text(json.dumps(result.to_dict(), indent=2))

    return result.to_dict()


def decrypt_file(
    input_path: str,
    output_path: str,
    key: bytes,
    expected_sha256: Optional[str] = None
) -> dict:
    """
    Decrypt a file.

    Args:
        input_path: Path to encrypted file
        output_path: Path for decrypted output
        key: 32-byte decryption key
        expected_sha256: Optional integrity check

    Returns:
        Decryption metadata
    """
    input_path = Path(input_path)
    output_path = Path(output_path)

    # Try to load expected hash from metadata if not provided
    if expected_sha256 is None:
        meta_path = input_path.with_suffix(input_path.suffix + '.meta')
        if meta_path.exists():
            meta = json.loads(meta_path.read_text())
            expected_sha256 = meta.get("ciphertext_sha256")

    # Read encrypted data
    ciphertext_with_nonce = input_path.read_bytes()

    # Decrypt
    result = decrypt(ciphertext_with_nonce, key, expected_sha256)

    # Write output
    output_path.write_text(result.plaintext, encoding='utf-8')

    return result.to_dict()


# ==============================================================================
# Session Helpers
# ==============================================================================

def encrypt_session(
    session_data: dict,
    key: bytes,
    key_id: str = "default"
) -> Tuple[bytes, dict]:
    """
    Encrypt a session data dictionary.

    Args:
        session_data: Session data to encrypt
        key: 32-byte encryption key
        key_id: Key identifier

    Returns:
        (ciphertext_with_nonce, metadata)
    """
    plaintext = json.dumps(session_data, sort_keys=True, ensure_ascii=False)
    result = encrypt(plaintext, key, key_id)

    return result.to_storage_format(), result.to_dict()


def decrypt_session(
    ciphertext_with_nonce: bytes,
    key: bytes,
    expected_sha256: Optional[str] = None
) -> Tuple[dict, dict]:
    """
    Decrypt a session data dictionary.

    Args:
        ciphertext_with_nonce: Encrypted session data
        key: 32-byte decryption key
        expected_sha256: Optional integrity check

    Returns:
        (session_data, metadata)
    """
    result = decrypt(ciphertext_with_nonce, key, expected_sha256)
    session_data = json.loads(result.plaintext)

    return session_data, result.to_dict()


# ==============================================================================
# Utility Functions
# ==============================================================================

def generate_key() -> bytes:
    """Generate a new 256-bit key."""
    if not HAS_CRYPTO:
        raise RuntimeError("cryptography package required")

    return AESGCM.generate_key(bit_length=256)


def key_to_base64(key: bytes) -> str:
    """Encode key as base64 string."""
    return base64.b64encode(key).decode('ascii')


def key_from_base64(key_b64: str) -> bytes:
    """Decode key from base64 string."""
    return base64.b64decode(key_b64.encode('ascii'))


def compute_sha256(data: bytes) -> str:
    """Compute SHA-256 hash of data."""
    return hashlib.sha256(data).hexdigest()


# ==============================================================================
# CLI Interface
# ==============================================================================

def cli():
    """Command-line interface."""
    parser = argparse.ArgumentParser(
        description="Lumera Encryption Utilities",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate a new key
  python encrypt_decrypt.py generate-key

  # Encrypt a file
  python encrypt_decrypt.py encrypt input.json output.enc --key-id default

  # Decrypt a file
  python encrypt_decrypt.py decrypt output.enc decrypted.json --key-id default

  # Encrypt stdin
  echo '{"test": true}' | python encrypt_decrypt.py encrypt-stdin --key-id default

  # List keys
  python encrypt_decrypt.py list-keys
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # generate-key
    gen_parser = subparsers.add_parser("generate-key", help="Generate a new encryption key")
    gen_parser.add_argument("--key-id", default="default", help="Key identifier")
    gen_parser.add_argument("--output", help="Output key to file (base64)")

    # encrypt
    enc_parser = subparsers.add_parser("encrypt", help="Encrypt a file")
    enc_parser.add_argument("input", help="Input file path")
    enc_parser.add_argument("output", help="Output file path")
    enc_parser.add_argument("--key-id", default="default", help="Key identifier")

    # decrypt
    dec_parser = subparsers.add_parser("decrypt", help="Decrypt a file")
    dec_parser.add_argument("input", help="Input file path")
    dec_parser.add_argument("output", help="Output file path")
    dec_parser.add_argument("--key-id", default="default", help="Key identifier")

    # encrypt-stdin
    enc_stdin_parser = subparsers.add_parser("encrypt-stdin", help="Encrypt stdin to stdout (base64)")
    enc_stdin_parser.add_argument("--key-id", default="default", help="Key identifier")

    # decrypt-stdin
    dec_stdin_parser = subparsers.add_parser("decrypt-stdin", help="Decrypt base64 stdin to stdout")
    dec_stdin_parser.add_argument("--key-id", default="default", help="Key identifier")

    # list-keys
    subparsers.add_parser("list-keys", help="List available keys")

    # delete-key
    del_parser = subparsers.add_parser("delete-key", help="Delete a key")
    del_parser.add_argument("key_id", help="Key identifier to delete")

    # verify
    ver_parser = subparsers.add_parser("verify", help="Verify ciphertext integrity")
    ver_parser.add_argument("input", help="Encrypted file path")
    ver_parser.add_argument("--expected-sha256", help="Expected SHA-256 hash")

    args = parser.parse_args()

    if not HAS_CRYPTO:
        print("Error: cryptography package not installed", file=sys.stderr)
        print("Install with: pip install cryptography", file=sys.stderr)
        sys.exit(1)

    key_store = KeyStore()

    if args.command == "generate-key":
        key = key_store.get_key(args.key_id)
        key_b64 = key_to_base64(key)

        if args.output:
            Path(args.output).write_text(key_b64)
            print(f"Key saved to {args.output}")
        else:
            print(f"Key ID: {args.key_id}")
            print(f"Key (base64): {key_b64}")

    elif args.command == "encrypt":
        key = key_store.get_key(args.key_id)
        meta = encrypt_file(args.input, args.output, key, args.key_id)
        print(f"Encrypted: {args.input} -> {args.output}")
        print(f"SHA-256: {meta['ciphertext_sha256']}")

    elif args.command == "decrypt":
        key = key_store.get_key(args.key_id)
        meta = decrypt_file(args.input, args.output, key)
        print(f"Decrypted: {args.input} -> {args.output}")
        print(f"Verified: {meta['verified']}")

    elif args.command == "encrypt-stdin":
        key = key_store.get_key(args.key_id)
        plaintext = sys.stdin.read()
        result = encrypt(plaintext, key, args.key_id)
        ciphertext_b64 = base64.b64encode(result.to_storage_format()).decode('ascii')
        print(ciphertext_b64)

    elif args.command == "decrypt-stdin":
        key = key_store.get_key(args.key_id)
        ciphertext_b64 = sys.stdin.read().strip()
        ciphertext_with_nonce = base64.b64decode(ciphertext_b64)
        result = decrypt(ciphertext_with_nonce, key)
        print(result.plaintext)

    elif args.command == "list-keys":
        keys = key_store.list_keys()
        if keys:
            print("Available keys:")
            for key_id in keys:
                print(f"  - {key_id}")
        else:
            print("No keys found")

    elif args.command == "delete-key":
        if key_store.delete_key(args.key_id):
            print(f"Deleted key: {args.key_id}")
        else:
            print(f"Key not found: {args.key_id}")

    elif args.command == "verify":
        ciphertext = Path(args.input).read_bytes()
        actual_sha256 = compute_sha256(ciphertext)
        print(f"SHA-256: {actual_sha256}")

        if args.expected_sha256:
            if actual_sha256 == args.expected_sha256:
                print("Integrity: VERIFIED")
            else:
                print("Integrity: FAILED")
                print(f"Expected: {args.expected_sha256}")
                sys.exit(1)

    else:
        parser.print_help()


if __name__ == "__main__":
    cli()
