# PII Redaction Patterns

Handling critical vs non-critical sensitive data in Lumera Agent Memory.

## Purpose

Lumera implements a two-tier redaction system that balances security with usability. Critical patterns (private keys, secret credentials) trigger fail-closed behavior, rejecting storage entirely. Non-critical patterns (emails, phone numbers) are redacted in-place while allowing storage to proceed. This cookbook explains pattern configuration, custom rules, and redaction reporting.

## Variables

```yaml
FAIL_CLOSED_BEHAVIOR: reject_storage
NON_CRITICAL_BEHAVIOR: redact_and_continue
REDACTION_TOKEN_FORMAT: "[REDACTED:{PATTERN_NAME}]"
REGEX_FLAGS: re.IGNORECASE (for most patterns)
```

## Instructions

### 1. Understanding the Two-Tier System

| Tier | Behavior | Example Patterns |
|------|----------|------------------|
| **Critical** | Fail-closed: reject entire storage | Private keys, AWS secret keys, auth headers |
| **Non-Critical** | Redact & continue: mask and proceed | Emails, phones, IP addresses |

**Rationale:** Critical patterns represent data that should never exist in agent sessions. Their presence indicates a workflow problem that needs human intervention. Non-critical patterns are expected in conversations and can be safely masked.

### 2. Default Critical Patterns

```python
import re
from dataclasses import dataclass

@dataclass
class RedactionRule:
    rule_name: str
    pattern: re.Pattern
    critical: bool
    count: int = 0

CRITICAL_PATTERNS = [
    # AWS Secret Access Key (40 chars, often follows key ID)
    RedactionRule(
        "aws_secret_key",
        re.compile(
            r'aws_secret_access_key["\s:=\\]+([A-Za-z0-9/+=]{40})',
            re.IGNORECASE
        ),
        critical=True
    ),

    # Private Keys (RSA, EC, generic)
    RedactionRule(
        "private_key",
        re.compile(
            r'-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----',
            re.IGNORECASE
        ),
        critical=True
    ),

    # Raw Authorization Headers
    RedactionRule(
        "auth_header_raw",
        re.compile(
            r'Authorization:\s*(Bearer|Basic)\s+[A-Za-z0-9+/=._-]{20,}',
            re.IGNORECASE
        ),
        critical=True
    ),

    # Database Connection Passwords
    RedactionRule(
        "database_password",
        re.compile(
            r'(password|passwd|pwd)["\s:=]+(["\'][^"\']{8,}["\']|[A-Za-z0-9!@#$%^&*]{8,})\s*(;|,|$)',
            re.IGNORECASE
        ),
        critical=True
    ),

    # GitHub Personal Access Tokens
    RedactionRule(
        "github_pat",
        re.compile(r'ghp_[A-Za-z0-9]{36}'),
        critical=True
    ),

    # Stripe Secret Keys
    RedactionRule(
        "stripe_secret",
        re.compile(r'sk_(live|test)_[A-Za-z0-9]{24,}'),
        critical=True
    ),
]
```

### 3. Default Non-Critical Patterns

```python
NON_CRITICAL_PATTERNS = [
    # AWS Access Key ID (AKIA prefix, 20 chars)
    RedactionRule(
        "aws_access_key",
        re.compile(r'\b(AKIA[0-9A-Z]{16})\b'),
        critical=False
    ),

    # Email Addresses
    RedactionRule(
        "email",
        re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
        critical=False
    ),

    # Phone Numbers (US formats)
    RedactionRule(
        "phone",
        re.compile(r'\b\d{3}[-.]?\d{4}\b|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'),
        critical=False
    ),

    # IPv4 Addresses
    RedactionRule(
        "ipv4",
        re.compile(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'),
        critical=False
    ),

    # Credit Card Numbers (basic pattern)
    RedactionRule(
        "credit_card",
        re.compile(r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'),
        critical=False
    ),

    # Social Security Numbers
    RedactionRule(
        "ssn",
        re.compile(r'\b\d{3}[-]?\d{2}[-]?\d{4}\b'),
        critical=False
    ),

    # Generic Long Tokens (potential API keys)
    RedactionRule(
        "api_token_generic",
        re.compile(r'\b[A-Za-z0-9_-]{32,}\b'),
        critical=False
    ),
]
```

### 4. Implementing Redaction

```python
import json
from typing import Tuple
from dataclasses import dataclass, field

@dataclass
class RedactionReport:
    """Report of redactions performed."""
    rules_fired: list[RedactionRule] = field(default_factory=list)
    critical_detected: bool = False

    def to_dict(self) -> dict:
        return {
            "rules_fired": [
                {"rule": r.rule_name, "count": r.count, "critical": r.critical}
                for r in self.rules_fired
            ],
            "critical_detected": self.critical_detected
        }

def redact_session(session_data: dict) -> Tuple[dict, RedactionReport]:
    """
    Redact PII and secrets from session data.

    - Critical patterns: Raise ValueError (fail-closed)
    - Non-critical patterns: Replace with [REDACTED:PATTERN_NAME]

    Returns:
        (redacted_data, report)
    """
    # Serialize for pattern matching
    session_json = json.dumps(session_data, indent=2)
    report = RedactionReport()

    # Combine all rules
    all_rules = CRITICAL_PATTERNS + NON_CRITICAL_PATTERNS

    # Check all patterns
    for rule in all_rules:
        matches = list(rule.pattern.finditer(session_json))

        if matches:
            rule.count = len(matches)
            report.rules_fired.append(rule)

            if rule.critical:
                # FAIL-CLOSED: Reject storage entirely
                report.critical_detected = True
                raise ValueError(
                    f"CRITICAL: Detected {rule.rule_name} pattern in session. "
                    f"Found {len(matches)} occurrence(s). "
                    f"Remove sensitive data from source before storing."
                )
            else:
                # REDACT & CONTINUE: Mask the pattern
                session_json = rule.pattern.sub(
                    f"[REDACTED:{rule.rule_name.upper()}]",
                    session_json
                )

    # Deserialize redacted data
    redacted_data = json.loads(session_json)

    return redacted_data, report
```

### 5. Adding Custom Rules

```python
def add_custom_rule(
    rule_name: str,
    pattern: str,
    critical: bool,
    flags: int = re.IGNORECASE
) -> RedactionRule:
    """Create and register a custom redaction rule."""
    rule = RedactionRule(
        rule_name=rule_name,
        pattern=re.compile(pattern, flags),
        critical=critical
    )

    if critical:
        CRITICAL_PATTERNS.append(rule)
    else:
        NON_CRITICAL_PATTERNS.append(rule)

    return rule

# Example: Add custom internal project ID pattern
add_custom_rule(
    rule_name="internal_project_id",
    pattern=r'proj-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}',
    critical=False
)

# Example: Add internal API key format (critical)
add_custom_rule(
    rule_name="internal_api_key",
    pattern=r'INTERNAL_[A-Z]{3}_KEY_[A-Za-z0-9]{32}',
    critical=True
)
```

### 6. Handling Redaction Reports

```python
def process_redaction_report(report: RedactionReport) -> dict:
    """Generate human-readable redaction summary."""

    if not report.rules_fired:
        return {
            "status": "clean",
            "message": "No sensitive patterns detected",
            "redactions": []
        }

    redaction_summary = []
    for rule in report.rules_fired:
        redaction_summary.append({
            "pattern": rule.rule_name,
            "occurrences": rule.count,
            "severity": "critical" if rule.critical else "non-critical",
            "action": "blocked" if rule.critical else "redacted"
        })

    return {
        "status": "redacted",
        "message": f"Redacted {sum(r.count for r in report.rules_fired)} occurrences",
        "redactions": redaction_summary
    }
```

## Common Patterns

### Pre-Storage Validation

```python
def validate_before_store(session_data: dict) -> bool:
    """Validate session can be stored (dry-run redaction)."""
    try:
        _, report = redact_session(session_data.copy())
        return True
    except ValueError as e:
        if "CRITICAL" in str(e):
            return False
        raise
```

### Selective Field Redaction

```python
def redact_specific_fields(
    data: dict,
    fields_to_redact: list[str]
) -> dict:
    """Redact only specific fields in a dictionary."""

    def _redact_nested(obj, path=""):
        if isinstance(obj, dict):
            return {
                k: _redact_nested(v, f"{path}.{k}")
                for k, v in obj.items()
            }
        elif isinstance(obj, list):
            return [_redact_nested(item, path) for item in obj]
        elif isinstance(obj, str):
            # Check if current path should be redacted
            for field in fields_to_redact:
                if path.endswith(field):
                    return "[REDACTED:FIELD]"
            return obj
        return obj

    return _redact_nested(data)

# Usage
redacted = redact_specific_fields(session_data, [".email", ".phone", ".ssn"])
```

### Audit Logging for Redactions

```python
import logging
from datetime import datetime

logger = logging.getLogger("lumera.redaction")

def redact_with_audit(
    session_data: dict,
    session_id: str
) -> Tuple[dict, RedactionReport]:
    """Redact with full audit logging."""

    timestamp = datetime.utcnow().isoformat()

    try:
        redacted, report = redact_session(session_data)

        if report.rules_fired:
            logger.info(
                f"[{timestamp}] Session {session_id}: "
                f"Redacted {len(report.rules_fired)} pattern types"
            )
            for rule in report.rules_fired:
                logger.debug(
                    f"  - {rule.rule_name}: {rule.count} occurrences"
                )

        return redacted, report

    except ValueError as e:
        logger.error(
            f"[{timestamp}] Session {session_id}: "
            f"CRITICAL pattern blocked - {e}"
        )
        raise
```

### Recovering Original Positions

```python
def redact_with_positions(
    text: str,
    rules: list[RedactionRule]
) -> Tuple[str, list[dict]]:
    """Redact text and track original positions (for debugging)."""

    positions = []
    offset = 0

    for rule in rules:
        if rule.critical:
            continue  # Skip critical (would fail anyway)

        for match in rule.pattern.finditer(text):
            positions.append({
                "rule": rule.rule_name,
                "original_start": match.start(),
                "original_end": match.end(),
                "original_value_length": match.end() - match.start()
            })

    # Now perform actual redaction
    redacted = text
    for rule in rules:
        if not rule.critical:
            redacted = rule.pattern.sub(
                f"[REDACTED:{rule.rule_name.upper()}]",
                redacted
            )

    return redacted, positions
```

## Testing Redaction

```python
import pytest

def test_critical_pattern_raises():
    """Critical patterns should raise ValueError."""
    session = {
        "messages": [{
            "content": "Use aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCY"
        }]
    }

    with pytest.raises(ValueError) as excinfo:
        redact_session(session)

    assert "CRITICAL" in str(excinfo.value)
    assert "aws_secret_key" in str(excinfo.value)

def test_email_redaction():
    """Emails should be redacted, not blocked."""
    session = {
        "messages": [{
            "content": "Contact me at user@example.com"
        }]
    }

    redacted, report = redact_session(session)

    assert "[REDACTED:EMAIL]" in redacted["messages"][0]["content"]
    assert "user@example.com" not in redacted["messages"][0]["content"]
    assert any(r.rule_name == "email" for r in report.rules_fired)

def test_multiple_patterns():
    """Multiple non-critical patterns should all be redacted."""
    session = {
        "messages": [{
            "content": "Email: test@example.com, IP: 192.168.1.1"
        }]
    }

    redacted, report = redact_session(session)
    content = redacted["messages"][0]["content"]

    assert "[REDACTED:EMAIL]" in content
    assert "[REDACTED:IPV4]" in content
    assert len(report.rules_fired) == 2

def test_no_false_positives():
    """Normal text should not be redacted."""
    session = {
        "messages": [{
            "content": "The weather is nice today. Let's deploy the API."
        }]
    }

    redacted, report = redact_session(session)

    assert redacted == session  # No changes
    assert len(report.rules_fired) == 0
```

## Pattern Reference

### Critical Patterns (Fail-Closed)

| Pattern | Regex | Example Match |
|---------|-------|---------------|
| AWS Secret Key | `aws_secret_access_key["\s:=\\]+([A-Za-z0-9/+=]{40})` | `aws_secret_access_key=wJalrXUtn...` |
| Private Key | `-----BEGIN.*PRIVATE KEY-----` | `-----BEGIN RSA PRIVATE KEY-----` |
| Auth Header | `Authorization:\s*(Bearer\|Basic)\s+[A-Za-z0-9...]{20,}` | `Authorization: Bearer eyJ...` |
| DB Password | `(password\|passwd\|pwd)["\s:=]+...` | `password="secretpass123"` |

### Non-Critical Patterns (Redact & Continue)

| Pattern | Regex | Example Match |
|---------|-------|---------------|
| AWS Access Key | `AKIA[0-9A-Z]{16}` | `AKIAIOSFODNN7EXAMPLE` |
| Email | `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z\|a-z]{2,}` | `user@example.com` |
| Phone | `\d{3}[-.]?\d{3}[-.]?\d{4}` | `555-123-4567` |
| IPv4 | `\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}` | `192.168.1.1` |

## Related Resources

- `cookbook/encryption.md` - Post-redaction encryption
- `prompts/redaction_report.md` - Redaction summary template
- `tools/lumera_client.py` - Client implementation
