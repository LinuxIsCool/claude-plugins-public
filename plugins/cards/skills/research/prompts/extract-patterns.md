# Extract Patterns Prompt

## Purpose
Identify recurring patterns across multiple resources that inform Cards design.

## Prompt Template

```
Extract patterns from the following resources that inform morphological data modeling:

## Sources
{list of @repos, maps, or other resources}

## Focus Areas
1. **Identity patterns**: How is entity identity represented? (UUIDs, hashes, URIs, RIDs)
2. **Type systems**: How are types/classes defined and validated?
3. **Temporal patterns**: How are creation time, modification history tracked?
4. **Relationship patterns**: How are parent/child/neighbor relationships modeled?
5. **Transformation patterns**: How does data move between formats?

## Tasks

For each pattern identified:
1. Name the pattern
2. Describe how it works
3. Note which resources use it
4. Assess relevance to Cards

## Output Format

Generate an insight document following the template in:
`plugins/cards/skills/research/SKILL.md` → Insight Template section

Save to: `plugins/cards/skills/research/insights/{topic}-patterns.md`
```

## Variables

| Variable | Description |
|----------|-------------|
| `{sources}` | List of resource @tags to analyze |
| `{topic}` | Theme being investigated (e.g., "identity", "relationships") |

## Example Usage

```
Extract patterns from the following resources that inform morphological data modeling:

## Sources
- @repos/koi-research
- @repos/koi-net
- maps/personal-digital.md (reference to external POC)

## Focus Areas
...
```

## Cross-Reference

After extracting patterns, update relevant maps with links to the new insight:
```markdown
## Cross-References
- Patterns extracted in: [insights/{topic}-patterns.md]
```
