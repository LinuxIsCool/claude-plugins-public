---
name: eliza-agents
description: ElizaOS multi-agent TypeScript framework for building autonomous AI agents with modular plugins and extensible architecture
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# ElizaOS Agents Mastery

ElizaOS is the open-source framework for multi-agent AI development, enabling developers to build, deploy, and orchestrate autonomous agents with sophisticated personalities, memory systems, and plugin-based capabilities. Built on TypeScript and Bun, it provides a comprehensive runtime for agent lifecycle management, from character definition to multi-agent communication.

## Territory Map

**Core Repository**: `/resources/agents/eliza/`

```
eliza/
├── packages/
│   ├── core/              # Agent runtime, types, memory system
│   │   ├── src/
│   │   │   ├── runtime.ts           # AgentRuntime implementation
│   │   │   ├── types/               # Core type definitions
│   │   │   │   ├── agent.ts         # Character interface
│   │   │   │   ├── components.ts    # Action, Provider, Evaluator
│   │   │   │   ├── runtime.ts       # IAgentRuntime interface
│   │   │   │   ├── service.ts       # Service base class
│   │   │   │   ├── memory.ts        # Memory system types
│   │   │   │   └── events.ts        # Event system
│   │   │   ├── character.ts         # Character loading/validation
│   │   │   └── schemas/             # Zod validation schemas
│   │   └── package.json
│   │
│   ├── cli/               # Command-line interface
│   ├── server/            # Express API server
│   ├── client/            # React web interface
│   ├── plugin-bootstrap/  # Core event handlers & providers
│   ├── plugin-sql/        # PostgreSQL/PGLite database adapters
│   └── plugin-starter/    # Plugin development template
│
├── examples/
│   ├── standalone.ts              # Minimal agent example
│   └── standalone-cli-chat.ts     # Interactive chat interface
│
└── docs/
    └── jobs-api-examples.md       # Async task system

Key Files:
- packages/core/src/types/index.ts      # All type exports
- packages/core/src/runtime.ts          # Main runtime implementation
- packages/plugin-starter/src/plugin.ts # Plugin template with examples
- CLAUDE.md                             # Comprehensive development guide
```

## Core Capabilities

### 1. Agent Runtime Architecture

**AgentRuntime** is the central orchestration layer that manages:

- **Character Definition**: Personality, knowledge, communication style
- **Plugin System**: Actions, Providers, Evaluators, Services
- **Memory System**: Conversation history, embeddings, RAG
- **Event System**: MESSAGE_RECEIVED, WORLD_CONNECTED, etc.
- **Model Integration**: OpenAI, Anthropic, Gemini, Llama, Grok
- **Database Adapters**: PostgreSQL, PGLite (in-memory)

```typescript
// Core runtime structure
interface IAgentRuntime {
  agentId: UUID;
  character: Character;

  // Component registries
  actions: Action[];
  providers: Provider[];
  evaluators: Evaluator[];
  services: Map<ServiceTypeName, Service[]>;

  // Capabilities
  registerPlugin(plugin: Plugin): Promise<void>;
  processActions(message: Memory, responses: Memory[]): Promise<void>;
  composeState(message: Memory): Promise<State>;
  useModel(modelType: ModelTypeName, params): Promise<Result>;

  // Memory operations
  addEmbeddingToMemory(memory: Memory): Promise<Memory>;
  getAllMemories(): Promise<Memory[]>;
}
```

### 2. Component Types (The Four Pillars)

**Services**: Stateful integrations with external APIs

```typescript
export class WalletService extends Service {
  static serviceType = 'wallet';
  private client: ExternalAPIClient;

  async initialize(runtime: IAgentRuntime): Promise<void> {
    this.client = new ExternalAPIClient(process.env.API_KEY);
  }

  async transfer(to: string, amount: number): Promise<TransactionResult> {
    return await this.client.transfer(to, amount);
  }
}
```

**Actions**: User interaction handlers

```typescript
const transferAction: Action = {
  name: 'TRANSFER_TOKENS',
  description: 'Transfer tokens to another address',

  validate: async (runtime, message) => {
    return message.content.text.toLowerCase().includes('send') ||
           message.content.text.toLowerCase().includes('transfer');
  },

  handler: async (runtime, message, state, options, callback): Promise<ActionResult> => {
    const service = runtime.getService<WalletService>('wallet');
    const result = await service.transfer(to, amount);

    // Callback sends message to user
    await callback({
      text: `Transferred ${amount} tokens to ${to}`,
      action: 'TRANSFER_TOKENS',
    });

    // Return value enables action chaining
    return {
      success: true,
      values: { lastTransfer: result },
      data: { txHash: result.hash },
    };
  },
};
```

**Providers**: Read-only context suppliers

```typescript
const balanceProvider: Provider = {
  name: 'BALANCE_PROVIDER',
  description: 'Provides wallet balance information',

  get: async (runtime, message, state): Promise<ProviderResult> => {
    const service = runtime.getService<WalletService>('wallet');
    const balance = await service.getBalance();

    return {
      text: `Current balance: ${balance.amount} ${balance.token}`,
      values: { balance: balance.amount },
      data: { fullBalance: balance },
    };
  },
};
```

**Evaluators**: Post-interaction learning

```typescript
const transferEvaluator: Evaluator = {
  name: 'TRANSFER_EVALUATOR',
  alwaysRun: false,

  validate: async (runtime, message) => {
    return message.content.actions?.includes('TRANSFER_TOKENS');
  },

  handler: async (runtime, message, state) => {
    // Analyze transfer success and store patterns
    const success = state?.lastTransfer?.success;

    if (success) {
      await runtime.addMemory({
        content: { text: 'Successful transfer pattern detected' },
        type: 'learning',
      });
    }

    return { success, confidence: 0.9 };
  },
};
```

### 3. Plugin Structure

```typescript
export const myPlugin: Plugin = {
  name: 'my-plugin',
  description: 'Description of plugin capabilities',

  // Configuration
  config: {
    API_KEY: process.env.MY_API_KEY,
  },

  // Initialization
  async init(config: Record<string, string>) {
    const validatedConfig = await configSchema.parseAsync(config);
    // Set environment variables, initialize SDKs
  },

  // Components
  services: [MyService],
  actions: [myAction],
  providers: [myProvider],
  evaluators: [myEvaluator],

  // Custom model providers
  models: {
    [ModelType.TEXT_LARGE]: async (runtime, { prompt, maxTokens }) => {
      // Custom model implementation
      return generateResponse(prompt);
    },
  },

  // HTTP routes
  routes: [
    {
      name: 'api-endpoint',
      path: '/api/my-endpoint',
      type: 'GET',
      handler: async (req, res) => {
        res.json({ status: 'ok' });
      },
    },
  ],

  // Event handlers
  events: {
    MESSAGE_RECEIVED: [
      async (params) => {
        // React to message events
      },
    ],
  },

  // Plugin dependencies
  dependencies: ['@elizaos/plugin-sql'],
};
```

## Beginner Techniques

### Character Definition

The Character interface defines an agent's personality, knowledge, and behavior:

```typescript
// Simple character definition
const character: Character = {
  name: 'Assistant',
  username: 'assistant',
  bio: 'A helpful AI assistant focused on productivity.',

  adjectives: ['helpful', 'concise', 'professional'],
  topics: ['technology', 'productivity', 'automation'],

  // Communication style
  style: {
    all: [
      'Be concise and clear',
      'Use bullet points for lists',
      'Provide actionable advice',
    ],
    chat: [
      'Use a friendly, conversational tone',
      'Ask clarifying questions when needed',
    ],
    post: [
      'Keep posts under 280 characters',
      'Use relevant hashtags',
    ],
  },

  // Conversation examples
  messageExamples: [
    [
      {
        name: '{{userName}}',
        content: { text: 'What can you help me with?' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'I can help with productivity tips, automation, and technology questions.',
          actions: [],
        },
      },
    ],
  ],

  // Knowledge base
  knowledge: [
    './knowledge/docs.md',
    { path: './knowledge/shared.md', shared: true },
    { directory: './knowledge/manuals/', shared: false },
  ],

  // Plugin selection
  plugins: ['@elizaos/plugin-bootstrap', '@elizaos/plugin-sql'],

  // Configuration
  settings: {
    VOICE: 'en-US-neural',
    MAX_RESPONSE_LENGTH: 500,
  },
};
```

### Creating a Minimal Agent

```typescript
import {
  AgentRuntime,
  createMessageMemory,
  stringToUuid,
  ChannelType,
} from '@elizaos/core';
import bootstrapPlugin from '@elizaos/plugin-bootstrap';
import openaiPlugin from '@elizaos/plugin-openai';
import sqlPlugin, { createDatabaseAdapter } from '@elizaos/plugin-sql';

async function createAgent() {
  // Define character
  const character: Character = {
    name: 'MyAgent',
    username: 'myagent',
    bio: 'A simple ElizaOS agent',
    adjectives: ['friendly'],
  };

  // Initialize database
  const agentId = stringToUuid(character.name);
  const adapter = createDatabaseAdapter(
    { dataDir: 'memory://' }, // In-memory PGLite
    agentId
  );
  await adapter.init();

  // Create runtime
  const runtime = new AgentRuntime({
    character,
    plugins: [sqlPlugin, bootstrapPlugin, openaiPlugin],
    settings: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    },
  });

  runtime.registerDatabaseAdapter(adapter);
  await runtime.initialize();

  return runtime;
}
```

### Processing Messages

```typescript
// Set up conversation context
const userId = uuidv4() as UUID;
const roomId = stringToUuid('chat-room');
const worldId = stringToUuid('chat-world');

await runtime.ensureConnection({
  entityId: userId,
  roomId,
  worldId,
  name: 'User',
  source: 'cli',
  channelId: 'chat',
  messageServerId: stringToUuid('server'),
  type: ChannelType.DM,
});

// Create and send message
const message = createMessageMemory({
  id: uuidv4() as UUID,
  entityId: userId,
  roomId,
  content: {
    text: 'Hello, agent!',
    source: 'cli',
    channelType: ChannelType.DM,
  },
});

// Process message through MessageService
const result = await runtime.messageService.handleMessage(runtime, message);
console.log('Agent response:', result.responseContent?.text);
```

## Intermediate Techniques

### Building Custom Actions

```typescript
import { Action, ActionResult, HandlerCallback } from '@elizaos/core';
import { z } from 'zod';

// Parameter validation schema
const weatherParamsSchema = z.object({
  location: z.string().min(1),
});

const weatherAction: Action = {
  name: 'GET_WEATHER',
  similes: ['WEATHER', 'FORECAST', 'TEMPERATURE'],
  description: 'Get weather information for a location',

  validate: async (runtime, message) => {
    const text = message.content.text.toLowerCase();
    return text.includes('weather') ||
           text.includes('temperature') ||
           text.includes('forecast');
  },

  handler: async (
    runtime,
    message,
    state,
    options,
    callback
  ): Promise<ActionResult> => {
    try {
      // Extract location from message using LLM
      const extractionPrompt = `Extract the location from: "${message.content.text}"
Return JSON: { "location": "city name" }`;

      const extracted = await runtime.generateText(extractionPrompt);
      const params = weatherParamsSchema.parse(JSON.parse(extracted.text));

      // Get weather service
      const weatherService = runtime.getService<WeatherService>('weather');
      const weather = await weatherService.getWeather(params.location);

      // Send response to user
      await callback({
        text: `Weather in ${params.location}: ${weather.temperature}°F, ${weather.condition}`,
        action: 'GET_WEATHER',
      });

      return {
        success: true,
        text: `Retrieved weather for ${params.location}`,
        values: {
          location: params.location,
          temperature: weather.temperature,
        },
        data: { weather },
      };
    } catch (error) {
      await callback({
        text: 'Sorry, I could not retrieve the weather information.',
        error: true,
      });

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: '{{userName}}',
        content: { text: "What's the weather in San Francisco?" },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Weather in San Francisco: 65°F, partly cloudy',
          actions: ['GET_WEATHER'],
        },
      },
    ],
  ],
};
```

### Implementing Services

```typescript
import { Service, IAgentRuntime } from '@elizaos/core';
import { logger } from '@elizaos/core';

export class WeatherService extends Service {
  static serviceType = 'weather';
  capabilityDescription = 'Provides weather information using external API';

  private apiClient: WeatherAPIClient | null = null;
  private cache: Map<string, { data: WeatherData; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  constructor(protected runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime): Promise<WeatherService> {
    logger.info('Starting weather service');
    const service = new WeatherService(runtime);
    await service.initialize();
    return service;
  }

  async initialize(): Promise<void> {
    const apiKey = this.runtime.getSetting('WEATHER_API_KEY');
    if (!apiKey) {
      throw new Error('WEATHER_API_KEY not configured');
    }

    this.apiClient = new WeatherAPIClient(apiKey as string);
    logger.info('Weather service initialized');
  }

  async getWeather(location: string): Promise<WeatherData> {
    // Check cache
    const cached = this.cache.get(location);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Fetch from API
    if (!this.apiClient) {
      throw new Error('Weather service not initialized');
    }

    const data = await this.apiClient.getCurrentWeather(location);

    // Update cache
    this.cache.set(location, { data, timestamp: Date.now() });

    return data;
  }

  async stop(): Promise<void> {
    logger.info('Stopping weather service');
    this.cache.clear();
  }
}
```

### Creating Dynamic Providers

```typescript
const contextProvider: Provider = {
  name: 'CONTEXT_PROVIDER',
  description: 'Provides conversation context and user preferences',
  dynamic: true, // Recalculated on each message

  get: async (runtime, message, state): Promise<ProviderResult> => {
    // Get recent conversation history
    const recentMessages = await runtime.getAllMemories({
      roomId: message.roomId,
      count: 10,
    });

    // Get user entity
    const user = await runtime.getEntity(message.entityId);

    // Retrieve user preferences
    const preferences = await runtime.getAllMemories({
      entityId: message.entityId,
      type: 'preference',
    });

    const contextText = `
Conversation History:
${recentMessages.map(m => `${m.content.text}`).join('\n')}

User Preferences:
${preferences.map(p => p.content.text).join('\n')}

Current State: ${JSON.stringify(state, null, 2)}
`;

    return {
      text: contextText,
      values: {
        messageCount: recentMessages.length,
        userName: user?.name,
      },
      data: {
        recentMessages,
        preferences,
      },
    };
  },
};
```

### Event System Integration

```typescript
const myPlugin: Plugin = {
  name: 'event-driven-plugin',

  events: {
    MESSAGE_RECEIVED: [
      async ({ runtime, message, roomId }) => {
        logger.debug(`Message received in room ${roomId}`);

        // Track message analytics
        await runtime.addMemory({
          content: {
            text: `Analytics: ${message.content.text.length} chars`,
            type: 'analytics',
          },
          roomId,
        });
      },
    ],

    WORLD_CONNECTED: [
      async ({ runtime, world }) => {
        logger.info(`Connected to world: ${world.name}`);

        // Initialize world-specific resources
        const service = runtime.getService('my-service');
        await service.setupWorld(world);
      },
    ],

    VOICE_MESSAGE_RECEIVED: [
      async ({ runtime, audioBuffer, roomId }) => {
        // Process voice input
        const transcription = await runtime.transcribeAudio(audioBuffer);
        logger.debug(`Transcribed: ${transcription}`);
      },
    ],
  },
};
```

## Advanced Techniques

### Multi-Agent Communication

ElizaOS supports sophisticated multi-agent architectures through shared worlds and rooms:

```typescript
// Create multiple agents with different specializations
async function createMultiAgentSystem() {
  // Researcher agent
  const researcher = new AgentRuntime({
    character: {
      name: 'Researcher',
      bio: 'Expert in information gathering and analysis',
      plugins: ['@elizaos/plugin-research'],
    },
    plugins: [researchPlugin],
  });

  // Writer agent
  const writer = new AgentRuntime({
    character: {
      name: 'Writer',
      bio: 'Creates engaging content based on research',
      plugins: ['@elizaos/plugin-content'],
    },
    plugins: [contentPlugin],
  });

  // Shared world for communication
  const worldId = stringToUuid('collaboration-world');
  const roomId = stringToUuid('project-room');

  await researcher.ensureConnection({
    entityId: researcher.agentId,
    roomId,
    worldId,
    name: 'Researcher',
    source: 'system',
    type: ChannelType.GROUP,
  });

  await writer.ensureConnection({
    entityId: writer.agentId,
    roomId,
    worldId,
    name: 'Writer',
    source: 'system',
    type: ChannelType.GROUP,
  });

  // Workflow: Researcher gathers data, Writer creates content
  async function runWorkflow(topic: string) {
    // Step 1: Research
    const researchMessage = createMessageMemory({
      id: uuidv4() as UUID,
      entityId: researcher.agentId,
      roomId,
      content: {
        text: `Research topic: ${topic}`,
        source: 'workflow',
      },
    });

    const researchResult = await researcher.messageService.handleMessage(
      researcher,
      researchMessage
    );

    // Step 2: Write based on research
    const writeMessage = createMessageMemory({
      id: uuidv4() as UUID,
      entityId: writer.agentId,
      roomId,
      content: {
        text: `Write article about: ${topic}
Research findings: ${researchResult.responseContent?.text}`,
        source: 'workflow',
      },
    });

    const article = await writer.messageService.handleMessage(
      writer,
      writeMessage
    );

    return article.responseContent?.text;
  }

  return { researcher, writer, runWorkflow };
}
```

### Custom Memory Providers

```typescript
import { IDatabaseAdapter } from '@elizaos/core';

export class VectorDatabaseAdapter implements IDatabaseAdapter {
  private vectorStore: VectorStore;

  async init(): Promise<void> {
    this.vectorStore = new VectorStore({
      dimensions: 1536, // OpenAI embedding size
      metric: 'cosine',
    });
  }

  async addMemory(memory: Memory): Promise<void> {
    // Generate embedding
    const embedding = await this.generateEmbedding(memory.content.text);

    // Store with vector
    await this.vectorStore.add({
      id: memory.id,
      vector: embedding,
      metadata: {
        content: memory.content,
        roomId: memory.roomId,
        timestamp: Date.now(),
      },
    });
  }

  async searchMemoriesByEmbedding(
    embedding: number[],
    opts: { limit?: number; threshold?: number }
  ): Promise<Memory[]> {
    const results = await this.vectorStore.search(embedding, {
      limit: opts.limit || 10,
      threshold: opts.threshold || 0.7,
    });

    return results.map(r => ({
      id: r.id,
      content: r.metadata.content,
      roomId: r.metadata.roomId,
      similarity: r.score,
    }));
  }

  async getMemories(opts: {
    roomId?: UUID;
    count?: number;
    unique?: boolean;
  }): Promise<Memory[]> {
    // Implement retrieval logic
    return this.vectorStore.query({
      filter: { roomId: opts.roomId },
      limit: opts.count || 50,
    });
  }
}
```

### RAG (Retrieval-Augmented Generation)

```typescript
const knowledgeProvider: Provider = {
  name: 'KNOWLEDGE_PROVIDER',
  description: 'Retrieves relevant knowledge from vector store',

  get: async (runtime, message, state): Promise<ProviderResult> => {
    // Generate embedding for query
    const queryEmbedding = await runtime.embed(message.content.text);

    // Search knowledge base
    const relevantDocs = await runtime.searchMemoriesByEmbedding(
      queryEmbedding,
      {
        limit: 5,
        threshold: 0.75,
      }
    );

    // Format for context injection
    const knowledgeText = relevantDocs
      .map((doc, i) => `[${i + 1}] ${doc.content.text}`)
      .join('\n\n');

    return {
      text: `Relevant Knowledge:\n${knowledgeText}`,
      values: {
        documentCount: relevantDocs.length,
      },
      data: {
        documents: relevantDocs,
      },
    };
  },
};
```

### Action Chaining and Multi-Step Plans

```typescript
const complexAction: Action = {
  name: 'COMPLEX_WORKFLOW',
  description: 'Execute multi-step workflow',

  handler: async (runtime, message, state, options, callback): Promise<ActionResult> => {
    const { actionPlan, actionContext } = options || {};

    // Check if we're in a multi-step plan
    if (actionPlan) {
      const { currentStep, totalSteps, steps } = actionPlan;

      logger.info(`Executing step ${currentStep}/${totalSteps}: ${steps[currentStep - 1].action}`);

      // Access previous results
      const previousResult = actionContext?.getPreviousResult?.('PREVIOUS_ACTION');

      if (previousResult && previousResult.success) {
        // Use data from previous step
        const dataFromPrevious = previousResult.values?.processedData;

        // Perform current step
        const result = await performStep(dataFromPrevious);

        await callback({
          text: `Completed step ${currentStep}: ${result.message}`,
        });

        return {
          success: true,
          values: { stepResult: result },
          data: { step: currentStep, result },
        };
      }
    }

    // Standalone execution
    const result = await performStandaloneAction();

    await callback({
      text: result.message,
    });

    return {
      success: true,
      values: { result },
    };
  },
};
```

### Custom Model Integration

```typescript
const customModelPlugin: Plugin = {
  name: 'custom-model',

  models: {
    [ModelType.TEXT_LARGE]: async (runtime, params) => {
      const { prompt, maxTokens, temperature } = params;

      // Integrate custom model API
      const response = await customModelAPI.generate({
        prompt,
        max_tokens: maxTokens,
        temperature,
      });

      return response.text;
    },

    [ModelType.EMBEDDING]: async (runtime, params) => {
      const { input } = params;

      // Custom embedding model
      const embedding = await customEmbedAPI.embed(input);

      return embedding.vector;
    },

    [ModelType.IMAGE_GENERATION]: async (runtime, params) => {
      const { prompt, size } = params;

      // Image generation
      const image = await imageGenAPI.create({
        prompt,
        size,
      });

      return { url: image.url };
    },
  },
};

// Use custom model
const result = await runtime.useModel(ModelType.TEXT_LARGE, {
  prompt: 'Generate a story',
  maxTokens: 500,
  temperature: 0.8,
});
```

### Database Migrations and Schema Management

```typescript
import { DatabaseMigrationService } from '@elizaos/plugin-sql';

const myPlugin: Plugin = {
  name: 'custom-storage',

  async init(config) {
    // Register custom schema migrations
    const migrationService = new DatabaseMigrationService();

    migrationService.registerMigration({
      version: '1.0.0',
      name: 'create_custom_tables',
      up: async (db) => {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS custom_data (
            id UUID PRIMARY KEY,
            agent_id UUID NOT NULL,
            data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
          );

          CREATE INDEX idx_custom_data_agent
          ON custom_data(agent_id);
        `);
      },
      down: async (db) => {
        await db.execute('DROP TABLE IF EXISTS custom_data');
      },
    });
  },
};
```

## When to Use ElizaOS

**Choose ElizaOS when you need:**

- Multi-agent systems with specialized roles and collaboration
- Rich character personalities with consistent communication styles
- Plugin-based extensibility for domain-specific capabilities
- Built-in memory and conversation history management
- RAG (Retrieval-Augmented Generation) with knowledge bases
- Integration with multiple LLM providers (OpenAI, Anthropic, etc.)
- Web interface and API server for agent management
- TypeScript/Bun development environment
- Production-ready agent deployment with PostgreSQL

**Consider alternatives for:**

- Single-purpose chatbots without personality (use lighter frameworks)
- Python-first development (consider CrewAI, LangChain)
- Simple API wrapper over LLMs (use direct SDK)
- Browser-only applications (ElizaOS requires Node/Bun runtime)

## Development Workflow

### Quick Start

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install ElizaOS CLI
bun install -g @elizaos/cli

# Create new project
elizaos create my-agent
cd my-agent

# Configure API keys
elizaos env edit-local
# Add: OPENAI_API_KEY=your_key_here

# Start development server
elizaos dev
```

### Plugin Development

```bash
# Create from template
elizaos create --template plugin my-plugin
cd my-plugin

# Install dependencies
bun install

# Development with hot reload
elizaos dev

# Run tests
bun test

# Build for production
bun run build
```

### Testing Strategies

```typescript
// Unit test for action
import { describe, it, expect } from 'bun:test';

describe('WeatherAction', () => {
  it('validates weather queries correctly', async () => {
    const mockMessage = {
      content: { text: "What's the weather like?" },
    };

    const isValid = await weatherAction.validate(
      mockRuntime,
      mockMessage
    );

    expect(isValid).toBe(true);
  });

  it('handles errors gracefully', async () => {
    const mockService = {
      getWeather: async () => {
        throw new Error('API unavailable');
      },
    };

    const result = await weatherAction.handler(
      mockRuntime,
      mockMessage,
      undefined,
      undefined,
      mockCallback
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

## Reference Files

**Essential Reading**:
- `/resources/agents/eliza/README.md` - Project overview and quick start
- `/resources/agents/eliza/CLAUDE.md` - Comprehensive development guide
- `/resources/agents/eliza/AGENTS.md` - Detailed agent architecture documentation

**Core Types**:
- `/resources/agents/eliza/packages/core/src/types/agent.ts` - Character and Agent interfaces
- `/resources/agents/eliza/packages/core/src/types/components.ts` - Action, Provider, Evaluator types
- `/resources/agents/eliza/packages/core/src/types/runtime.ts` - IAgentRuntime interface
- `/resources/agents/eliza/packages/core/src/types/service.ts` - Service base class
- `/resources/agents/eliza/packages/core/src/types/plugin.ts` - Plugin interface

**Templates**:
- `/resources/agents/eliza/packages/plugin-starter/src/plugin.ts` - Complete plugin template
- `/resources/agents/eliza/examples/standalone.ts` - Minimal agent implementation
- `/resources/agents/eliza/examples/standalone-cli-chat.ts` - Interactive chat example

**Configuration**:
- `/resources/agents/eliza/packages/core/src/schemas/character.ts` - Character validation schema
- `/resources/agents/eliza/.env.example` - Environment variable template

**CRITICAL RULES**:
- NEVER use `npm` or `pnpm` - ALWAYS use `bun`
- ALWAYS use `workspace:*` for internal `@elizaos/*` dependencies
- NEVER use `EventEmitter` - use `EventTarget` instead
- NEVER use `execa` - use `Bun.spawn()` or `bun-exec` utilities
- Base branch is `develop`, NOT `main`
- Services are REQUIRED for external APIs - never call APIs directly from Actions
- Actions MUST return `ActionResult` for proper chaining
- Providers are READ-ONLY - no state modifications
- Evaluators run POST-interaction - not for input parsing
