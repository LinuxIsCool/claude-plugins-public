# Skill Validation

Testing and validating skills before deployment.

## Validation Checklist

### Frontmatter Validation

- [ ] `name`: lowercase, hyphens, under 64 chars
- [ ] `name`: matches folder name
- [ ] `name`: no reserved words (`anthropic`, `claude`)
- [ ] `description`: under 1024 chars
- [ ] `description`: third person voice
- [ ] `description`: includes what + when + triggers
- [ ] `allowed-tools`: only necessary tools
- [ ] `version`: semver format (if present)

### Content Validation

- [ ] Body under 500 lines
- [ ] Uses imperative voice
- [ ] Has all sections: Overview, Instructions, Examples
- [ ] Uses `{baseDir}` for all paths
- [ ] No hardcoded absolute paths
- [ ] 2-3 concrete examples with input/output
- [ ] Error handling documented
- [ ] One-level-deep references only

### Discovery Testing

- [ ] Skill triggers on intended phrases
- [ ] Skill does NOT trigger on unrelated requests
- [ ] Description keywords match user intent
- [ ] No false positives with similar skills

### Execution Testing

- [ ] Scripts execute without errors
- [ ] Tool permissions appropriate
- [ ] Examples produce expected output
- [ ] Error cases handled gracefully

## Validation Commands

### Check File Structure
```bash
ls -la .claude/skills/my-skill/
```

### Validate YAML Frontmatter
```bash
head -20 .claude/skills/my-skill/SKILL.md
```

### Check Line Count
```bash
wc -l .claude/skills/my-skill/SKILL.md
```

### Find Hardcoded Paths
```bash
grep -n "^/" .claude/skills/my-skill/SKILL.md
grep -n "~/" .claude/skills/my-skill/SKILL.md
```

### Check Description Length
```bash
head -10 .claude/skills/my-skill/SKILL.md | grep "description:" | wc -c
```

## Testing Discovery

### Method 1: Direct Invocation
```
/my-skill-name
```
Verify the skill loads and behaves correctly.

### Method 2: Intent Matching
Ask questions that should trigger the skill:
```
"Process this PDF"  # Should trigger pdf-processing
"Review my code"    # Should trigger code-review
```

### Method 3: Negative Testing
Ask questions that should NOT trigger:
```
"What's the weather?"  # pdf-processing should NOT trigger
```

### Method 4: Check Context
```
/context
```
Verify skill descriptions are loaded and not truncated.

## Testing Across Models

Test with all models you plan to support:

| Model | Test For |
|-------|----------|
| **Haiku** | Are instructions clear enough for simpler model? |
| **Sonnet** | Is content efficient and well-structured? |
| **Opus** | Does skill avoid over-explanation? |

What works for Opus may need more detail for Haiku.

## Common Validation Failures

### 1. Description Too Vague
**Symptom**: Skill never triggers
**Fix**: Add specific trigger phrases and use cases

### 2. Description Too Broad
**Symptom**: Skill triggers inappropriately
**Fix**: Narrow scope, add conditions

### 3. Missing Prerequisites
**Symptom**: Skill fails during execution
**Fix**: Document required tools, APIs, environment

### 4. Hardcoded Paths
**Symptom**: Works locally, fails elsewhere
**Fix**: Use `{baseDir}` variable

### 5. Nested References
**Symptom**: Claude doesn't read full content
**Fix**: Flatten to one-level-deep references

### 6. Over-Permissioned Tools
**Symptom**: Security concerns
**Fix**: Restrict `allowed-tools` to minimum needed

## Automated Validation Script

```bash
#!/bin/bash
# validate-skill.sh

SKILL_DIR=$1

echo "Validating: $SKILL_DIR"

# Check SKILL.md exists
if [ ! -f "$SKILL_DIR/SKILL.md" ]; then
    echo "ERROR: Missing SKILL.md"
    exit 1
fi

# Check frontmatter
if ! head -1 "$SKILL_DIR/SKILL.md" | grep -q "^---"; then
    echo "ERROR: Missing YAML frontmatter"
    exit 1
fi

# Check name field
if ! grep -q "^name:" "$SKILL_DIR/SKILL.md"; then
    echo "ERROR: Missing name field"
    exit 1
fi

# Check description field
if ! grep -q "^description:" "$SKILL_DIR/SKILL.md"; then
    echo "ERROR: Missing description field"
    exit 1
fi

# Check line count
LINES=$(wc -l < "$SKILL_DIR/SKILL.md")
if [ "$LINES" -gt 500 ]; then
    echo "WARNING: SKILL.md exceeds 500 lines ($LINES)"
fi

# Check for hardcoded paths
if grep -n "^/" "$SKILL_DIR/SKILL.md" | grep -v "^/context" | grep -v "^/skill"; then
    echo "WARNING: Possible hardcoded absolute paths"
fi

echo "Validation complete"
```

## Pre-Deployment Checklist

Before committing a skill:

1. [ ] Run validation script
2. [ ] Test with `/skill-name` direct invocation
3. [ ] Test with natural language triggers
4. [ ] Verify no false positives
5. [ ] Test with target model(s)
6. [ ] Review tool permissions
7. [ ] Document in skill README or SKILL.md

## Debugging Tips

### Skill Not Loading
1. Check `/context` for truncation
2. Verify YAML frontmatter is valid
3. Check skill location (project vs personal)

### Skill Not Triggering
1. Add more trigger phrases to description
2. Make description more specific
3. Check for competing skills

### Execution Errors
1. Test scripts independently
2. Check tool permissions
3. Verify file paths use `{baseDir}`
