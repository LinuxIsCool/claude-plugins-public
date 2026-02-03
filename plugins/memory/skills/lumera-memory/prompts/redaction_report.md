# Redaction Report Template

Template for generating redaction summaries after PII/secret processing.

## Purpose

This template standardizes the format for redaction reports. Reports are generated automatically during the storage pipeline and attached to session metadata. Use this template to understand report structure, generate human-readable summaries, or create audit logs.

## Variables

```yaml
SESSION_ID: <session_id>
PROCESSING_TIMESTAMP: <iso8601_timestamp>
REPORT_VERSION: "1.0"
CRITICAL_BEHAVIOR: "fail_closed"
NON_CRITICAL_BEHAVIOR: "redact_and_continue"
```

## Template

```yaml
# Redaction Report for Session: {SESSION_ID}
# Processed: {PROCESSING_TIMESTAMP}
# Report Version: v{REPORT_VERSION}

status: "{clean|redacted|blocked}"
critical_detected: {true|false}

rules_fired:
  - rule: "{rule_name}"
    count: {occurrence_count}
    critical: {true|false}
    action: "{blocked|redacted}"
  # ... additional rules

summary:
  total_patterns_detected: {count}
  total_occurrences: {count}
  critical_occurrences: {count}
  non_critical_occurrences: {count}

message: "{human_readable_summary}"
```

## Status Definitions

| Status | Description | Critical Detected | Rules Fired |
|--------|-------------|-------------------|-------------|
| `clean` | No sensitive patterns found | false | 0 |
| `redacted` | Non-critical patterns masked | false | >= 1 |
| `blocked` | Critical pattern rejected storage | true | >= 1 |

## Report Fields

### status

| Value | When Used |
|-------|-----------|
| `clean` | No patterns matched in session data |
| `redacted` | Non-critical patterns found and masked, storage proceeded |
| `blocked` | Critical pattern found, storage rejected |

### critical_detected

Boolean indicating whether any critical (fail-closed) pattern was found.

- `true`: At least one critical pattern matched (storage rejected)
- `false`: No critical patterns (may have non-critical redactions)

### rules_fired

Array of pattern matches with details:

| Field | Type | Description |
|-------|------|-------------|
| `rule` | string | Pattern identifier (e.g., "email", "aws_secret_key") |
| `count` | integer | Number of occurrences in session |
| `critical` | boolean | Whether pattern triggers fail-closed |
| `action` | string | "blocked" for critical, "redacted" for non-critical |

### summary

Aggregate statistics:

| Field | Description |
|-------|-------------|
| `total_patterns_detected` | Number of distinct pattern types matched |
| `total_occurrences` | Sum of all pattern matches |
| `critical_occurrences` | Sum of critical pattern matches |
| `non_critical_occurrences` | Sum of non-critical pattern matches |

### message

Human-readable summary suitable for logging or display.

## Report Examples

### Clean Session (No Sensitive Data)

```yaml
status: "clean"
critical_detected: false

rules_fired: []

summary:
  total_patterns_detected: 0
  total_occurrences: 0
  critical_occurrences: 0
  non_critical_occurrences: 0

message: "No sensitive patterns detected. Session is clean."
```

### Redacted Session (Non-Critical PII)

```yaml
status: "redacted"
critical_detected: false

rules_fired:
  - rule: "email"
    count: 2
    critical: false
    action: "redacted"
  - rule: "phone"
    count: 1
    critical: false
    action: "redacted"
  - rule: "ipv4"
    count: 3
    critical: false
    action: "redacted"

summary:
  total_patterns_detected: 3
  total_occurrences: 6
  critical_occurrences: 0
  non_critical_occurrences: 6

message: "Redacted 6 occurrences across 3 pattern types (email, phone, ipv4). Session stored successfully."
```

### Blocked Session (Critical Pattern)

```yaml
status: "blocked"
critical_detected: true

rules_fired:
  - rule: "aws_secret_key"
    count: 1
    critical: true
    action: "blocked"
  - rule: "email"
    count: 2
    critical: false
    action: "would_redact"

summary:
  total_patterns_detected: 2
  total_occurrences: 3
  critical_occurrences: 1
  non_critical_occurrences: 2

message: "CRITICAL: Detected aws_secret_key pattern (1 occurrence). Storage rejected. Remove sensitive data from source before storing."
```

## Pattern Reference

### Critical Patterns (Fail-Closed)

| Rule Name | Description | Example |
|-----------|-------------|---------|
| `aws_secret_key` | AWS Secret Access Key | `aws_secret_access_key=wJalr...` |
| `private_key` | PEM-encoded private key | `-----BEGIN RSA PRIVATE KEY-----` |
| `auth_header_raw` | Authorization header | `Authorization: Bearer eyJ...` |
| `database_password` | Connection string password | `password="secretpass"` |
| `github_pat` | GitHub Personal Access Token | `ghp_xxxxxxxxxxxxxxxxxxxx` |
| `stripe_secret` | Stripe Secret Key | `sk_live_xxxxxxxxxxxx` |

### Non-Critical Patterns (Redact & Continue)

| Rule Name | Replacement Token | Example Match |
|-----------|-------------------|---------------|
| `aws_access_key` | `[REDACTED:AWS_ACCESS_KEY]` | `AKIAIOSFODNN7EXAMPLE` |
| `email` | `[REDACTED:EMAIL]` | `user@example.com` |
| `phone` | `[REDACTED:PHONE]` | `555-123-4567` |
| `ipv4` | `[REDACTED:IPV4]` | `192.168.1.1` |
| `credit_card` | `[REDACTED:CREDIT_CARD]` | `4111-1111-1111-1111` |
| `ssn` | `[REDACTED:SSN]` | `123-45-6789` |
| `api_token_generic` | `[REDACTED:API_TOKEN_GENERIC]` | Any 32+ char token |

## Structured Output

### JSON Format

```json
{
  "status": "redacted",
  "critical_detected": false,
  "rules_fired": [
    {
      "rule": "email",
      "count": 2,
      "critical": false,
      "action": "redacted"
    },
    {
      "rule": "ipv4",
      "count": 1,
      "critical": false,
      "action": "redacted"
    }
  ],
  "summary": {
    "total_patterns_detected": 2,
    "total_occurrences": 3,
    "critical_occurrences": 0,
    "non_critical_occurrences": 3
  },
  "message": "Redacted 3 occurrences across 2 pattern types (email, ipv4). Session stored successfully."
}
```

### Markdown Format (for Logging)

```markdown
## Redaction Report

**Session:** sess_2025_01_15_001
**Status:** redacted
**Processed:** 2025-01-15T10:30:00Z

### Patterns Detected

| Pattern | Occurrences | Action |
|---------|-------------|--------|
| email | 2 | redacted |
| ipv4 | 1 | redacted |

### Summary

- Total patterns: 2
- Total occurrences: 3
- Critical: 0
- Non-critical: 3

**Result:** Session stored successfully with redactions.
```

## Usage in Code

```python
from redaction import redact_session, RedactionReport

def generate_report_summary(report: RedactionReport) -> dict:
    """Generate structured report from RedactionReport."""

    if not report.rules_fired:
        return {
            "status": "clean",
            "critical_detected": False,
            "rules_fired": [],
            "summary": {
                "total_patterns_detected": 0,
                "total_occurrences": 0,
                "critical_occurrences": 0,
                "non_critical_occurrences": 0
            },
            "message": "No sensitive patterns detected. Session is clean."
        }

    # Calculate totals
    total_occurrences = sum(r.count for r in report.rules_fired)
    critical_occurrences = sum(r.count for r in report.rules_fired if r.critical)
    non_critical_occurrences = total_occurrences - critical_occurrences

    # Determine status
    if report.critical_detected:
        status = "blocked"
        critical_rule = next(r for r in report.rules_fired if r.critical)
        message = (
            f"CRITICAL: Detected {critical_rule.rule_name} pattern "
            f"({critical_rule.count} occurrence(s)). Storage rejected."
        )
    else:
        status = "redacted"
        pattern_names = ", ".join(r.rule_name for r in report.rules_fired)
        message = (
            f"Redacted {total_occurrences} occurrences across "
            f"{len(report.rules_fired)} pattern types ({pattern_names}). "
            f"Session stored successfully."
        )

    return {
        "status": status,
        "critical_detected": report.critical_detected,
        "rules_fired": [
            {
                "rule": r.rule_name,
                "count": r.count,
                "critical": r.critical,
                "action": "blocked" if r.critical else "redacted"
            }
            for r in report.rules_fired
        ],
        "summary": {
            "total_patterns_detected": len(report.rules_fired),
            "total_occurrences": total_occurrences,
            "critical_occurrences": critical_occurrences,
            "non_critical_occurrences": non_critical_occurrences
        },
        "message": message
    }
```

## Audit Log Integration

```python
import logging
from datetime import datetime

audit_logger = logging.getLogger("lumera.redaction.audit")

def log_redaction_event(
    session_id: str,
    report: dict,
    user_id: str = None
) -> None:
    """Log redaction event for audit trail."""

    event = {
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": "redaction",
        "session_id": session_id,
        "user_id": user_id,
        "status": report["status"],
        "critical_detected": report["critical_detected"],
        "patterns_detected": report["summary"]["total_patterns_detected"],
        "total_redactions": report["summary"]["non_critical_occurrences"]
    }

    if report["critical_detected"]:
        audit_logger.warning(f"CRITICAL_BLOCKED: {event}")
    elif report["status"] == "redacted":
        audit_logger.info(f"REDACTED: {event}")
    else:
        audit_logger.debug(f"CLEAN: {event}")
```

## Related Resources

- `cookbook/pii-redaction.md` - Redaction implementation details
- `cookbook/quickstart.md` - Using reports in storage workflow
- `tools/lumera_client.py` - Client implementation
