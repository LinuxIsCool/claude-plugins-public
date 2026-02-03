---
description: Cite a resource in the current session
args: url
---

# Library Cite Command

Record a citation from the current session to a library resource.

## Arguments

- `url` (required): URL of the resource to cite

## Instructions

1. **Get Session Context**: Determine the current session ID from the conversation context or use a default format.

2. **Load Library**:
   ```python
   import sys
   sys.path.insert(0, "${CLAUDE_PLUGIN_ROOT}/src")
   from lib import Library
   lib = Library()
   ```

3. **Check Resource Exists**: Verify the URL is in the library:
   ```python
   resource = lib.get_by_url("<url>")
   if not resource:
       # Resource not in library - offer to add it
       print(f"Resource not found in library: {url}")
       print("Would you like me to add it first?")
       return
   ```

4. **Ask for Citation Context**: Prompt for context if not provided:
   - Why is this resource being cited?
   - What type of citation? (reference, extends, implements, supports, contradicts)

5. **Record Citation**:
   ```python
   citation = lib.add_citation(
       source_id="session-<id>",  # Current session
       target_url="<url>",
       context="<user's context>",
       citation_type="<type>",  # default: reference
   )

   if citation:
       print(f"Citation recorded: {resource.title}")
       print(f"Type: {citation.citation_type}")
   ```

6. **Show Resource Info**: Display the cited resource:
   ```python
   print(f"Title: {resource.title}")
   print(f"Type: {resource.type.value}")
   print(f"Citations: {len(resource.cited_by)}")
   ```

## Citation Types

Explain the types to help user choose:

| Type | Use When |
|------|----------|
| `reference` | General citation, consulted for information |
| `extends` | Building upon or continuing the work |
| `implements` | Implementing concepts or methods from the work |
| `supports` | Provides evidence or validation |
| `contradicts` | Disagrees with or refutes |

## Output Format

```
# Citation Recorded

Resource: **Paper Title**
URL: https://arxiv.org/abs/2312.12345
Type: reference
Context: "Referenced for knowledge graph architecture discussion"

This resource now has 5 citations.
PageRank: 0.0234
Authority: 0.156
```

## Edge Cases

1. **URL not in library**: Offer to add it via `lib.add_resource()`
2. **Duplicate citation**: Check if same session already cited (optional - duplicates allowed)
3. **Invalid URL format**: Validate URL before processing

## Related Commands

- `/library` - View library statistics
- `/library-search` - Find resources to cite
