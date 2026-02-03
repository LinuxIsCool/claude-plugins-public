# Memory Card Template

Template for generating deterministic memory cards from session data.

## Purpose

This template defines the structure and extraction rules for memory cards. Use it when generating summaries for stored sessions. The template is designed to be filled programmatically, but can also guide manual card creation for testing or migration.

## Variables

```yaml
SESSION_ID: <session_id>
EXTRACTION_TIMESTAMP: <iso8601_timestamp>
ALGORITHM_VERSION: "1.0"
```

## Template

```yaml
# Memory Card for Session: {SESSION_ID}
# Generated: {EXTRACTION_TIMESTAMP}
# Algorithm: v{ALGORITHM_VERSION}

title: |
  <first_user_message_truncated_to_80_chars>

summary_bullets:
  - "[{role}] {message_content_truncated_to_100_chars}..."
  - "[{role}] {message_content_truncated_to_100_chars}..."
  - "[{role}] {message_content_truncated_to_100_chars}..."

decisions:
  # Messages containing: decided, decision, will use, chosen, selected, going with
  - "{decision_statement_truncated_to_100_chars}..."
  - "{decision_statement_truncated_to_100_chars}..."
  - "{decision_statement_truncated_to_100_chars}..."

todos:
  # Messages containing: todo, need to, should, must, will need, remember to
  - "{action_item_truncated_to_100_chars}..."
  - "{action_item_truncated_to_100_chars}..."
  - "{action_item_truncated_to_100_chars}..."

entities:
  # Capitalized words (3+ chars, excluding sentence starters)
  - "{ProperNoun1}"
  - "{ProperNoun2}"
  - "{ProperNoun3}"
  # ... up to 10

keywords:
  # Top 10 frequent words (5+ chars, excluding stop words)
  - "{keyword1}"
  - "{keyword2}"
  - "{keyword3}"
  # ... up to 10

notable_quotes:
  # Messages containing ? or !
  - "{question_or_exclamation_truncated_to_100_chars}..."
  - "{question_or_exclamation_truncated_to_100_chars}..."
  - "{question_or_exclamation_truncated_to_100_chars}..."
```

## Field Specifications

### title

| Property | Value |
|----------|-------|
| Source | First message where `role == "user"` |
| Max Length | 80 characters |
| Truncation | At word boundary if possible, append "..." |
| Fallback | "Untitled Session" if no user messages |

**Example:**
```yaml
# Input message: "I need help deploying the authentication service to production with zero downtime"
title: "I need help deploying the authentication service to production with zero..."
```

### summary_bullets

| Property | Value |
|----------|-------|
| Source | First 3 messages (any role) |
| Format | `[{role}] {content}...` |
| Max Length | 100 characters per bullet |
| Count | Maximum 3 bullets |

**Example:**
```yaml
summary_bullets:
  - "[user] I need help deploying the authentication service to production with zero downtime..."
  - "[assistant] I can help with that. Let me review your current deployment configuration and suggest..."
  - "[user] Here's my docker-compose.yml and the current Kubernetes manifests for the service..."
```

### decisions

| Property | Value |
|----------|-------|
| Detection | Message contains any of: decided, decision, will use, chosen, selected, going with, opted for, settled on |
| Source | Full message content (case-insensitive match) |
| Max Length | 100 characters per decision |
| Count | Maximum 3 decisions |

**Example:**
```yaml
decisions:
  - "I've decided to use a blue-green deployment strategy for this service..."
  - "We'll go with AWS ECS over EKS for this project due to simpler setup..."
  - "Selected PostgreSQL as the primary database based on the requirements..."
```

### todos

| Property | Value |
|----------|-------|
| Detection | Message contains any of: todo, need to, should, must, will need, remember to, don't forget, make sure to |
| Source | Full message content (case-insensitive match) |
| Max Length | 100 characters per todo |
| Count | Maximum 3 todos |

**Example:**
```yaml
todos:
  - "We need to update the load balancer health check endpoints before the deployment..."
  - "Remember to rotate the API keys after the migration is complete..."
  - "Should implement circuit breakers for the external API calls..."
```

### entities

| Property | Value |
|----------|-------|
| Detection | Words starting with capital letter, 3+ characters |
| Exclusions | Common sentence starters: I, The, This, That, It, We, You, They |
| Sorting | By frequency in source text (descending) |
| Count | Maximum 10 entities |

**Example:**
```yaml
entities:
  - "AWS"
  - "PostgreSQL"
  - "Kubernetes"
  - "Docker"
  - "ECS"
  - "CloudWatch"
  - "Redis"
  - "Nginx"
```

### keywords

| Property | Value |
|----------|-------|
| Detection | Words 5+ characters, not in stop word list |
| Stop Words | the, and, for, are, but, not, you, all, can, had, her, was, one, our, out, has, have, been, would, could, should, will, with, this, that, from, they, which, their, what, there, about, when, make, like, just, over, into, also, some, than, them, then, very, after, before, being, other, those, these |
| Sorting | By frequency (descending) |
| Count | Maximum 10 keywords |

**Example:**
```yaml
keywords:
  - "deployment"
  - "service"
  - "production"
  - "authentication"
  - "configuration"
  - "container"
  - "health"
  - "database"
  - "endpoint"
  - "cluster"
```

### notable_quotes

| Property | Value |
|----------|-------|
| Detection | Message contains `?` or `!` |
| Source | Full message content |
| Max Length | 100 characters per quote |
| Count | Maximum 3 quotes |

**Example:**
```yaml
notable_quotes:
  - "What's the best way to handle database migrations during a rolling deployment?"
  - "That's a great solution! I hadn't considered using feature flags for the rollout..."
  - "Are there any rate limiting concerns we should address before going live?"
```

## Complete Example

**Input Session:**
```json
{
  "session_id": "sess_2025_01_15_auth_deploy",
  "messages": [
    {
      "role": "user",
      "content": "I need help deploying the authentication service to production with zero downtime. We're using Docker and Kubernetes.",
      "timestamp": "2025-01-15T10:30:00Z"
    },
    {
      "role": "assistant",
      "content": "I can help with that. For zero-downtime deployment, I recommend using a blue-green deployment strategy. What's your current setup?",
      "timestamp": "2025-01-15T10:30:15Z"
    },
    {
      "role": "user",
      "content": "We have 3 replicas running on EKS. Should we increase that during deployment?",
      "timestamp": "2025-01-15T10:31:00Z"
    },
    {
      "role": "assistant",
      "content": "Yes, I've decided to recommend increasing to 6 replicas during deployment. We need to ensure the health checks are properly configured first.",
      "timestamp": "2025-01-15T10:31:30Z"
    }
  ]
}
```

**Output Memory Card:**
```yaml
title: "I need help deploying the authentication service to production with zero..."

summary_bullets:
  - "[user] I need help deploying the authentication service to production with zero downtime. We're..."
  - "[assistant] I can help with that. For zero-downtime deployment, I recommend using a blue-green..."
  - "[user] We have 3 replicas running on EKS. Should we increase that during deployment?"

decisions:
  - "Yes, I've decided to recommend increasing to 6 replicas during deployment. We need to ensure..."

todos:
  - "We need to ensure the health checks are properly configured first..."

entities:
  - "Docker"
  - "Kubernetes"
  - "EKS"

keywords:
  - "deployment"
  - "authentication"
  - "service"
  - "production"
  - "replicas"
  - "health"
  - "checks"
  - "downtime"
  - "configured"
  - "recommend"

notable_quotes:
  - "What's your current setup?"
  - "Should we increase that during deployment?"
```

## Usage in Code

```python
from memory_card import generate_memory_card

# Generate card from session
card = generate_memory_card(session_data)

# Access fields
print(f"Title: {card.title}")
print(f"Keywords: {', '.join(card.keywords)}")

# Convert to dict for storage
card_dict = card.to_dict()
```

## Validation Checklist

Before storing a memory card, verify:

- [ ] Title is present and <= 80 characters
- [ ] Title ends with "..." if truncated
- [ ] Summary bullets have role prefix format `[role]`
- [ ] No more than 3 items per array field (except entities/keywords)
- [ ] No more than 10 entities and 10 keywords
- [ ] All text fields are properly truncated
- [ ] No PII or sensitive data in any field (should be redacted upstream)

## Related Resources

- `cookbook/memory-cards.md` - Generation algorithm details
- `cookbook/quickstart.md` - Using cards in storage workflow
- `tools/lumera_client.py` - Client implementation
