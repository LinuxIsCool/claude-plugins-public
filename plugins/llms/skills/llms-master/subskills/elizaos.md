---
name: elizaos
description: Master ElizaOS for building multi-agent AI systems with plugins, services, and client integrations. Use when building autonomous agents, plugin-based architectures, multi-agent coordination, or integrating with Discord/Telegram/Twitter. TypeScript monorepo with comprehensive plugin system.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# ElizaOS Mastery

Open-source multi-agent AI framework with plugin architecture.

## Territory Map

```
resources/embeddings/eliza/
├── packages/
│   ├── core/                # AgentRuntime, types, state management
│   │   ├── src/runtime.ts   # Central orchestrator
│   │   └── src/types/       # All type definitions
│   ├── plugin-starter/      # Template for new plugins
│   ├── plugin-bootstrap/    # Core plugin to study
│   ├── server/              # REST API, WebSocket, auth
│   ├── client/              # React UI
│   └── api-client/          # Type-safe API wrapper
├── examples/                # Standalone implementations
└── docs/                    # Architecture guides
```

## Core Architecture

### The Four Component Types

**1. Services** (Stateful External Integration)
```typescript
export class MyService extends Service {
  static serviceType = 'my_service';

  async initialize(runtime: IAgentRuntime): Promise<void> {
    // Setup external connections
  }

  async stop(): Promise<void> {
    // Cleanup
  }
}
```

**2. Actions** (User Command Handlers)
```typescript
export const myAction: Action = {
  name: 'MY_ACTION',
  description: 'Handles user requests',

  validate: async (runtime, message) => {
    return message.content.text.includes('keyword');
  },

  handler: async (runtime, message, state, options, callback) => {
    const service = runtime.getService<MyService>('my_service');
    const result = await service.process(message);

    await callback({ text: `Result: ${result}` });
    return { success: true, data: { result } };
  }
};
```

**3. Providers** (Read-Only Context Supply)
```typescript
export const myProvider: Provider = {
  name: 'my_provider',

  get: async (runtime, message, state) => {
    const service = runtime.getService<MyService>('my_service');
    return { text: `Status: ${service.getStatus()}` };
  }
};
```

**4. Evaluators** (Post-Interaction Learning)
```typescript
export const myEvaluator: Evaluator = {
  name: 'MY_EVALUATOR',

  handler: async (runtime, message, state) => {
    // Learn from interaction outcome
    await runtime.addMemory({ content: { text: 'Learned pattern' } });
    return { success: true };
  }
};
```

## Plugin Structure

```typescript
// src/index.ts
export const plugin: Plugin = {
  name: 'my-plugin',
  description: 'Plugin description',
  services: [MyService],
  actions: [myAction],
  providers: [myProvider],
  evaluators: [myEvaluator],
};

export default plugin;
```

## Beginner Techniques

### Create New Plugin
```bash
elizaos create my-plugin
cd my-plugin
elizaos dev
```

### Basic Agent Runtime
```typescript
const runtime = new AgentRuntime({
  character,
  database: adapter,
  plugins: [bootstrapPlugin, myPlugin],
  fetch: globalThis.fetch
});

const message = createMessageMemory({
  userId: 'user-123',
  content: { text: 'Hello agent' },
  roomId: 'room-123'
});

await runtime.processActions(message, []);
```

## Intermediate Techniques

### Service Access Pattern
```typescript
// Get single service
const service = runtime.getService<MyService>('my_service');

// Get all services of type
const services = runtime.getServicesByType<MyService>('my_service');
```

### State Composition
```typescript
const state = await runtime.composeState(
  message,
  ['provider1', 'provider2'],  // Include specific providers
  false,                        // Don't skip cache
);
```

### Error Handling
```typescript
handler: async (runtime, message, state, options, callback) => {
  try {
    const result = await service.operation();
    await callback({ text: `Success: ${result}` });
    return { success: true, data: { result } };
  } catch (error) {
    await callback({ text: 'Error occurred', error: true });
    return { success: false, error };
  }
}
```

## Advanced Techniques

### Multi-Agent Coordination
```typescript
const agents: Map<string, AgentRuntime> = new Map();

// Agent A: Analyst
agents.set('analyst', new AgentRuntime({
  character: analyzerCharacter,
  plugins: [analysisPlugin]
}));

// Agent B: Executor
agents.set('executor', new AgentRuntime({
  character: executorCharacter,
  plugins: [executionPlugin]
}));

// Event-driven coordination
runtime.registerEvent('analysis_complete', async (params) => {
  const executor = agents.get('executor');
  await executor.processActions({ content: { text: params.data } });
});
```

### Memory & Embeddings
```typescript
// Add with embedding
await runtime.addEmbeddingToMemory(memory);

// Queue for async processing
await runtime.queueEmbeddingGeneration(memory, 'high');
```

## Client Integrations

- **Discord**: Full channel management
- **Telegram**: Message and update handling
- **Twitter**: Tweets, timeline, Spaces
- **Farcaster**: Web3 social
- **Web UI**: React with Socket.IO

## Predefined Service Types

```typescript
ServiceType = {
  TRANSCRIPTION, VIDEO, BROWSER, PDF,
  REMOTE_FILES, WEB_SEARCH, EMAIL,
  TASK, WALLET, LP_POOL, TOKEN_DATA
};
```

## Key Rules

1. **All external APIs through Services** (never from Actions/Providers)
2. **Providers are read-only** (no state modification)
3. **One in_progress action at a time**
4. **Error handling returns actionable info** to LLM

## When to Use ElizaOS

- Building autonomous AI agents
- Plugin-based extensible systems
- Multi-agent coordination
- Platform integrations (Discord, Telegram, etc.)
- Agent memory and learning systems

## Reference Files

- Core runtime: `packages/core/src/runtime.ts`
- Type definitions: `packages/core/src/types/`
- Plugin starter: `packages/plugin-starter/`
- Bootstrap plugin: `packages/plugin-bootstrap/`
