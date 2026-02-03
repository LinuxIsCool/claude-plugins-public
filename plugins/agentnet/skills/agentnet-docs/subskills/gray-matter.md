---
name: gray-matter
description: YAML frontmatter parsing documentation for AgentNet
---

# Gray-Matter Frontmatter Parser

## Overview

`gray-matter` is a battle-tested YAML front matter parser used by Gatsby, Netlify, Astro, VitePress, TinaCMS, and many other major projects. It parses front-matter from strings or files quickly and reliably.

**Key Features:**
- Parses YAML by default (also supports JSON, TOML, Coffee, and custom parsers)
- Fast and lightweight (uses native YAML parsing, not regex)
- Returns structured object with separated data and content
- Supports custom delimiters and excerpt extraction
- TypeScript-compatible with included type definitions

## Installation

```bash
npm install gray-matter
```

## Basic Usage

### Parsing Frontmatter from Strings

```typescript
import matter from 'gray-matter';

const markdown = `---
title: Agent Profile
type: assistant
version: 1.0.0
---
# Agent Description

This agent handles specialized tasks.`;

const result = matter(markdown);

console.log(result.data);
// { title: 'Agent Profile', type: 'assistant', version: '1.0.0' }

console.log(result.content);
// '# Agent Description\n\nThis agent handles specialized tasks.'
```

### Parsing from Files

```typescript
import fs from 'fs';
import matter from 'matter';

const fileContent = fs.readFileSync('agent.md', 'utf8');
const result = matter(fileContent);
```

### Returned Object Structure

The `matter()` function returns a `GrayMatterFile` object with these properties:

```typescript
{
  data: object,           // Parsed frontmatter as JSON object
  content: string,        // Content without frontmatter
  excerpt: string,        // Optional extracted excerpt
  isEmpty: boolean,       // True if frontmatter is empty
  empty: string,         // Original string if frontmatter empty
  orig: string | Buffer, // Original input (non-enumerable)
  language: string,      // Parser used (default: 'yaml')
  matter: string,        // Raw unparsed frontmatter string
  stringify: function    // Function to convert back to string
}
```

## TypeScript Integration

### Basic TypeScript Usage

```typescript
import matter from 'gray-matter';

// gray-matter includes TypeScript definitions
const result = matter(markdownString);
result.data;     // type: { [key: string]: any }
result.content;  // type: string
```

### Type-Safe Frontmatter with Generics

gray-matter doesn't natively support generic typing, but you can create a typed wrapper:

```typescript
import matter, { GrayMatterFile } from 'gray-matter';

// Define your frontmatter schema
interface AgentFrontmatter {
  name: string;
  description: string;
  tools: string;
  model: 'sonnet' | 'opus' | 'haiku';
}

// Create typed wrapper function
function typedMatter<T = any>(markdown: string): GrayMatterFile<string> & { data: T } {
  const result = matter(markdown);
  return { ...result, data: result.data as T };
}

// Usage with type safety
const agent = typedMatter<AgentFrontmatter>(agentMarkdown);
agent.data.name;        // TypeScript knows this is string
agent.data.model;       // TypeScript knows this is 'sonnet' | 'opus' | 'haiku'
```

### Runtime Validation with Zod

For production code requiring validation, consider `zod-matter`:

```typescript
import { matter } from 'zod-matter';
import { z } from 'zod';

const agentSchema = z.object({
  name: z.string(),
  description: z.string(),
  tools: z.string(),
  model: z.enum(['sonnet', 'opus', 'haiku']),
});

const result = matter(agentMarkdown, { schema: agentSchema });
// result.data is typed AND validated at runtime
```

## Frontmatter Formats

### YAML (Default)

```markdown
---
title: My Agent
tags: [ai, assistant]
enabled: true
---
Content here
```

### JSON Front Matter

```markdown
---json
{
  "title": "My Agent",
  "tags": ["ai", "assistant"],
  "enabled": true
}
---
Content here
```

```typescript
// Parses automatically based on content
const result = matter(jsonMarkdown);
```

### TOML Front Matter

```markdown
---toml
title = "My Agent"
tags = ["ai", "assistant"]
enabled = true
---
Content here
```

```typescript
import toml from 'toml';

const result = matter(tomlMarkdown, {
  engines: {
    toml: toml.parse.bind(toml)
  }
});
```

### Custom Delimiters

```typescript
// Use custom delimiter (e.g., '~~~')
const result = matter(markdown, {
  delimiters: ['~~~', '~~~']
});
```

## Working with Content

### Accessing Data vs Content

```typescript
const markdown = `---
name: classifier
version: 2.0
---
## Purpose
Classifies incoming messages.`;

const { data, content } = matter(markdown);

// data: parsed frontmatter object
console.log(data.name);     // 'classifier'
console.log(data.version);  // 2.0

// content: string after frontmatter (with leading/trailing whitespace trimmed)
console.log(content);
// '## Purpose\nClassifies incoming messages.'
```

### Extracting Excerpts

```typescript
const markdown = `---
title: Agent Guide
---
This is the excerpt.
<!-- more -->
This is the rest of the content.`;

const result = matter(markdown, {
  excerpt: true,
  excerpt_separator: '<!-- more -->'
});

console.log(result.excerpt);
// 'This is the excerpt.'

console.log(result.content);
// Full content including excerpt
```

### Stringify Back to Markdown

```typescript
const result = matter(markdown);

// Modify data
result.data.updated = new Date().toISOString();
result.content += '\n\nNew content added.';

// Convert back to markdown string
const updated = matter.stringify(result.content, result.data);
console.log(updated);
// ---
// name: classifier
// updated: 2025-12-16T...
// ---
// Original content
//
// New content added.
```

## AgentNet Patterns

### Parsing Agent Profiles

```typescript
import fs from 'fs';
import matter from 'gray-matter';

interface AgentProfile {
  name: string;
  description: string;
  tools: string;
  model: string;
}

function loadAgentProfile(path: string): AgentProfile & { prompt: string } {
  const fileContent = fs.readFileSync(path, 'utf8');
  const result = matter(fileContent);

  return {
    ...result.data as AgentProfile,
    prompt: result.content
  };
}

// Usage
const mentor = loadAgentProfile('./agents/mentor.md');
console.log(mentor.name);        // 'mentor'
console.log(mentor.tools);       // 'Read,Grep,WebSearch'
console.log(mentor.prompt);      // Full agent prompt
```

### Parsing Post Metadata

```typescript
interface PostMetadata {
  author: string;
  timestamp: string;
  parent?: string;
  tags?: string[];
}

function parsePost(postContent: string) {
  const result = matter(postContent);
  const metadata = result.data as PostMetadata;

  return {
    id: generateId(metadata.author, metadata.timestamp),
    author: metadata.author,
    timestamp: new Date(metadata.timestamp),
    content: result.content,
    parent: metadata.parent || null,
    tags: metadata.tags || []
  };
}
```

### Validating Required Fields

```typescript
function loadAgentWithValidation(path: string) {
  const fileContent = fs.readFileSync(path, 'utf8');
  const result = matter(fileContent);

  // Validate required fields
  const required = ['name', 'description', 'tools', 'model'];
  const missing = required.filter(field => !result.data[field]);

  if (missing.length > 0) {
    throw new Error(`Agent profile missing required fields: ${missing.join(', ')}`);
  }

  return {
    ...result.data,
    prompt: result.content
  };
}
```

### Batch Processing Agent Directory

```typescript
import { glob } from 'glob';
import path from 'path';

async function loadAllAgents(agentsDir: string) {
  const agentFiles = await glob('**/*.md', { cwd: agentsDir });

  const agents = agentFiles.map(file => {
    const fullPath = path.join(agentsDir, file);
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const result = matter(fileContent);

    return {
      id: path.basename(file, '.md'),
      filepath: fullPath,
      ...result.data,
      prompt: result.content
    };
  });

  return agents;
}
```

## Code Examples

### Complete Agent Parser

```typescript
import fs from 'fs';
import matter from 'gray-matter';

interface AgentConfig {
  name: string;
  description: string;
  tools: string;
  model: 'sonnet' | 'opus' | 'haiku';
}

interface Agent extends AgentConfig {
  prompt: string;
  filepath: string;
}

class AgentLoader {
  static load(filepath: string): Agent {
    const content = fs.readFileSync(filepath, 'utf8');
    const result = matter(content);

    // Validate required fields
    this.validate(result.data);

    return {
      filepath,
      name: result.data.name,
      description: result.data.description,
      tools: result.data.tools,
      model: result.data.model,
      prompt: result.content.trim()
    };
  }

  private static validate(data: any): asserts data is AgentConfig {
    const required = ['name', 'description', 'tools', 'model'];
    const missing = required.filter(field => !data[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (!['sonnet', 'opus', 'haiku'].includes(data.model)) {
      throw new Error(`Invalid model: ${data.model}`);
    }
  }

  static save(agent: Agent): void {
    const content = matter.stringify(agent.prompt, {
      name: agent.name,
      description: agent.description,
      tools: agent.tools,
      model: agent.model
    });

    fs.writeFileSync(agent.filepath, content, 'utf8');
  }
}

// Usage
const agent = AgentLoader.load('./agents/mentor.md');
console.log(agent.name);
console.log(agent.prompt);

// Modify and save
agent.description = 'Updated description';
AgentLoader.save(agent);
```

### Post Parser with Hierarchy

```typescript
interface PostMatter {
  author: string;
  timestamp: string;
  parent?: string;
}

interface Post {
  id: string;
  author: string;
  timestamp: Date;
  content: string;
  parent: string | null;
  replies: Post[];
}

function parseThread(posts: string[]): Post[] {
  const parsed: Post[] = posts.map(postContent => {
    const result = matter(postContent);
    const meta = result.data as PostMatter;

    return {
      id: `${meta.author}-${meta.timestamp}`,
      author: meta.author,
      timestamp: new Date(meta.timestamp),
      content: result.content,
      parent: meta.parent || null,
      replies: []
    };
  });

  // Build hierarchy
  const postMap = new Map(parsed.map(p => [p.id, p]));
  const roots: Post[] = [];

  for (const post of parsed) {
    if (post.parent) {
      const parent = postMap.get(post.parent);
      if (parent) {
        parent.replies.push(post);
      }
    } else {
      roots.push(post);
    }
  }

  return roots;
}
```

## Performance Notes

- gray-matter is fast because it uses native YAML parsing (not regex)
- For bulk operations, consider caching parsed results
- Reading from disk is the bottleneck, not parsing
- Use async file operations for large-scale batch processing

## Common Pitfalls

1. **Empty frontmatter**: Check `result.isEmpty` before using `result.data`
2. **Type safety**: gray-matter returns `{ [key: string]: any }` - add validation
3. **Missing fields**: Always validate required frontmatter fields
4. **Date parsing**: YAML dates are parsed as Date objects, but custom fields need manual parsing
5. **Whitespace**: Leading/trailing whitespace in content is trimmed by default

## Sources

- [gray-matter npm package](https://www.npmjs.com/package/gray-matter)
- [gray-matter GitHub repository](https://github.com/jonschlinkert/gray-matter)
- [gray-matter Complete Guide & Documentation [2025]](https://generalistprogrammer.com/tutorials/gray-matter-npm-package-guide)
- [Top 5 gray-matter Code Examples](https://snyk.io/advisor/npm-package/gray-matter/example)
- [Setting up a NextJS Markdown Blog with Typescript](https://bionicjulia.com/blog/setting-up-nextjs-markdown-blog-with-typescript)
- [GitHub Issue #168: Add Generic Data Typing](https://github.com/jonschlinkert/gray-matter/issues/168)
- [zod-matter: Typesafe front matter](https://github.com/HiDeoo/zod-matter)
