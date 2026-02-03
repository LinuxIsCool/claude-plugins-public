---
name: anthropic-sdk-typescript
description: Official TypeScript SDK for Claude API with messages, streaming, tool use, and batch processing
allowed-tools: Read, Glob, Grep, Bash
---

# Anthropic SDK TypeScript Mastery

Master the official TypeScript SDK for building applications with Claude. This SDK provides type-safe access to the Anthropic API with support for messages, streaming, tool execution, batch processing, and beta features.

## Territory Map

The SDK provides a comprehensive TypeScript interface to Claude's capabilities:

- **Messages API**: Create conversations with Claude
- **Streaming**: Real-time response streaming with Server-Sent Events
- **Tool Use**: Function calling with automatic execution and validation
- **Batches**: Process multiple requests efficiently
- **Type Safety**: Full TypeScript definitions for all parameters and responses
- **Error Handling**: Structured error types for robust error management
- **Beta Features**: Early access to new capabilities like extended thinking and prompt caching

## Core Capabilities

### Installation
```bash
npm install @anthropic-ai/sdk
```

### Basic Setup
```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY'], // default
});
```

### Type Definitions
The SDK includes comprehensive TypeScript definitions:
```typescript
import Anthropic from '@anthropic-ai/sdk';

const params: Anthropic.MessageCreateParams = {
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude' }],
  model: 'claude-sonnet-4-5-20250929',
};

const message: Anthropic.Message = await client.messages.create(params);
```

## Beginner Techniques

### Basic Message Creation
```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

async function main() {
  const result = await client.messages.create({
    messages: [
      {
        role: 'user',
        content: 'Hey Claude!',
      },
    ],
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
  });

  console.log(result.content);
}

main();
```

### Counting Tokens
```typescript
const result = await client.messages.countTokens({
  messages: [
    {
      role: 'user',
      content: 'Hey Claude!',
    },
  ],
  model: 'claude-sonnet-4-5-20250929',
});

console.log(result); // { input_tokens: 25 }
```

### Basic Error Handling
```typescript
try {
  const message = await client.messages.create({
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello, Claude' }],
    model: 'claude-sonnet-4-5-20250929',
  });
} catch (err) {
  if (err instanceof Anthropic.APIError) {
    console.log(err.status);   // 400
    console.log(err.name);     // BadRequestError
    console.log(err.headers);  // {server: 'nginx', ...}
  } else {
    throw err;
  }
}
```

### Accessing Usage Information
```typescript
const message = await client.messages.create({
  messages: [{ role: 'user', content: 'Hello!' }],
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
});

console.log(message.usage);
// { input_tokens: 25, output_tokens: 13 }
```

## Intermediate Techniques

### Streaming Responses
```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

async function main() {
  const stream = client.messages
    .stream({
      messages: [
        {
          role: 'user',
          content: 'How can I recursively list all files in a directory in Rust?',
        },
      ],
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
    })
    .on('contentBlock', (content) => console.log('contentBlock', content))
    .on('message', (message) => console.log('message', message))
    .on('text', (text) => console.log(text));

  // Iterate through events
  for await (const event of stream) {
    console.log('event', event);
  }

  // Get final message
  const message = await stream.finalMessage();
  console.log('finalMessage', message);
}

main();
```

### Manual Tool Use
```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

async function main() {
  const userMessage: Anthropic.MessageParam = {
    role: 'user',
    content: 'What is the weather in SF?',
  };

  const tools: Anthropic.Tool[] = [
    {
      name: 'get_weather',
      description: 'Get the weather for a specific location',
      input_schema: {
        type: 'object',
        properties: {
          location: { type: 'string' }
        },
      },
    },
  ];

  // First request - Claude will use the tool
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [userMessage],
    tools,
  });

  // Extract tool use
  const tool = message.content.find(
    (content): content is Anthropic.ToolUseBlock =>
      content.type === 'tool_use',
  );

  // Second request - provide tool result
  const result = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [
      userMessage,
      { role: message.role, content: message.content },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: tool.id,
            content: 'The weather is 73f',
          },
        ],
      },
    ],
    tools,
  });

  console.log(result);
}

main();
```

### Streaming with Tool Use
```typescript
const stream = client.messages
  .stream({
    messages: [
      {
        role: 'user',
        content: 'What is the weather in SF?',
      },
    ],
    tools: [
      {
        name: 'get_weather',
        description: 'Get the weather at a specific location',
        input_schema: {
          type: 'object',
          properties: {
            location: { type: 'string' },
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
            },
          },
          required: ['location'],
        },
      },
    ],
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
  })
  .on('inputJson', (delta, snapshot) => {
    console.log(`delta: ${delta}`);
    console.log(`snapshot: ${inspect(snapshot)}`);
  });

await stream.done();
```

### Message Batches
```typescript
// Create a batch
const batch = await client.messages.batches.create({
  requests: [
    {
      custom_id: 'my-first-request',
      params: {
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello, world' }],
      },
    },
    {
      custom_id: 'my-second-request',
      params: {
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hi again, friend' }],
      },
    },
  ],
});

// Get results when processing_status === 'ended'
const results = await client.messages.batches.results(batch.id);
for await (const entry of results) {
  if (entry.result.type === 'succeeded') {
    console.log(entry.result.message.content);
  }
}
```

## Advanced Techniques

### Automated Tool Execution with Zod
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const client = new Anthropic();

async function main() {
  const message = await client.beta.messages.toolRunner({
    messages: [
      {
        role: 'user',
        content: 'What is the weather in SF?',
      },
    ],
    tools: [
      betaZodTool({
        name: 'getWeather',
        description: 'Get the weather at a specific location',
        inputSchema: z.object({
          location: z.string().describe('The city and state, e.g. San Francisco, CA'),
        }),
        run: ({ location }) => {
          return `The weather is foggy with a temperature of 20°C in ${location}.`;
        },
      }),
    ],
    model: 'claude-3-5-sonnet-latest',
    max_tokens: 1024,
    max_iterations: 10,
  });

  console.log('Final response:', message.content);
}

main();
```

### Advanced Tool Runner with Iteration Control
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { BetaToolUseBlock } from '@anthropic-ai/sdk/resources/beta';
import { z } from 'zod';

const client = new Anthropic();

async function main() {
  const runner = client.beta.messages.toolRunner({
    messages: [
      {
        role: 'user',
        content: `I'm planning a trip to San Francisco. Can you help with weather, time, and currency exchange rates?`,
      },
    ],
    tools: [
      betaZodTool({
        name: 'getWeather',
        description: 'Get the weather at a specific location',
        inputSchema: z.object({
          location: z.string(),
        }),
        run: ({ location }) => {
          return `The weather is sunny with a temperature of 20°C in ${location}.`;
        },
      }),
      betaZodTool({
        name: 'getTime',
        description: 'Get the current time in a specific timezone',
        inputSchema: z.object({
          timezone: z.string(),
        }),
        run: ({ timezone }) => {
          return `The current time in ${timezone} is 3:00 PM.`;
        },
      }),
      betaZodTool({
        name: 'getCurrencyExchangeRate',
        description: 'Get the exchange rate between two currencies',
        inputSchema: z.object({
          from_currency: z.string(),
          to_currency: z.string(),
        }),
        run: ({ from_currency, to_currency }) => {
          return `The exchange rate from ${from_currency} to ${to_currency} is 0.85.`;
        },
      }),
    ],
    model: 'claude-3-5-sonnet-latest',
    max_tokens: 1024,
    max_iterations: 10,
  });

  // Process each message as it arrives
  for await (const message of runner) {
    console.log(`Message ${message.id}:`);

    for (const block of message.content) {
      switch (block.type) {
        case 'text':
          console.log(`Text: ${block.text}`);
          break;
        case 'tool_use':
          console.log(`Tool: ${block.name}(${JSON.stringify(block.input)})`);
          break;
      }
    }

    // Get tool results
    const toolResponse = await runner.generateToolResponse();
    if (toolResponse && typeof toolResponse.content !== 'string') {
      for (const block of toolResponse.content) {
        if (block.type === 'tool_result') {
          const toolUseBlock = message.content.find((b): b is BetaToolUseBlock => {
            return b.type === 'tool_use' && b.id === block.tool_use_id;
          });
          console.log(`Result: ${toolUseBlock?.name}() => ${block.content}`);
        }
      }
    }
  }
}

main();
```

### JSON Schema Tool Definition
```typescript
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';

const calculatorTool = betaTool({
  name: 'calculator',
  input_schema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide']
      },
      a: { type: 'number' },
      b: { type: 'number' },
    },
    required: ['operation', 'a', 'b'],
  },
  description: 'Perform basic arithmetic operations',
  run: (input) => {
    const { operation, a, b } = input;
    switch (operation) {
      case 'add':
        return String(a + b);
      case 'subtract':
        return String(a - b);
      case 'multiply':
        return String(a * b);
      case 'divide':
        return String(a / b);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  },
});
```

### Custom Configuration
```typescript
const client = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY'],
  maxRetries: 3,
  timeout: 20 * 1000, // 20 seconds
  logLevel: 'debug',
});

// Per-request configuration
const message = await client.messages.create(
  {
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello' }],
    model: 'claude-sonnet-4-5-20250929',
  },
  {
    maxRetries: 5,
    timeout: 30 * 1000,
  }
);
```

### Accessing Raw Response Data
```typescript
// Get raw response
const response = await client.messages
  .create({
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello, Claude' }],
    model: 'claude-sonnet-4-5-20250929',
  })
  .asResponse();

console.log(response.headers.get('X-My-Header'));
console.log(response.statusText);

// Get both data and response
const { data: message, response: raw } = await client.messages
  .create({
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello, Claude' }],
    model: 'claude-sonnet-4-5-20250929',
  })
  .withResponse();
```

### Beta Features - Extended Thinking
```typescript
const response = await client.beta.messages.create({
  max_tokens: 1024,
  model: 'claude-sonnet-4-5-20250929',
  messages: [
    {
      role: 'user',
      content: 'What is the capital of France?',
    },
  ],
  thinking: {
    type: 'enabled',
    budget_tokens: 2000,
  },
  betas: ['thinking-2025-01-15'],
});
```

### Auto-Pagination
```typescript
async function fetchAllMessageBatches() {
  const allMessageBatches = [];

  // Automatically fetches more pages
  for await (const messageBatch of client.messages.batches.list({ limit: 20 })) {
    allMessageBatches.push(messageBatch);
  }

  return allMessageBatches;
}

// Manual pagination
let page = await client.messages.batches.list({ limit: 20 });
for (const messageBatch of page.data) {
  console.log(messageBatch);
}

while (page.hasNextPage()) {
  page = await page.getNextPage();
  // Process page
}
```

## When to Use Anthropic SDK TypeScript

Use the Anthropic SDK TypeScript when you need:

1. **Type Safety**: Building production applications with compile-time type checking
2. **Node.js/Deno/Bun**: Developing server-side JavaScript/TypeScript applications
3. **Streaming**: Real-time response processing with event handlers
4. **Tool Integration**: Automated function calling with validation (Zod or JSON Schema)
5. **Batch Processing**: Efficient processing of multiple requests
6. **Error Handling**: Structured error types for robust applications
7. **Advanced Features**: Access to beta features like extended thinking, prompt caching
8. **Multi-runtime**: Support for Node.js, Deno, Bun, Cloudflare Workers, Vercel Edge

**When NOT to use:**
- Browser-only applications (security risk exposing API keys)
- Python projects (use anthropic-sdk-python instead)
- Simple REST API calls (can use fetch directly)

## Reference Files

Key files in the SDK repository:
- `/README.md` - Installation and basic usage
- `/api.md` - Complete API reference with all types and methods
- `/helpers.md` - Streaming and tool helpers documentation
- `/examples/demo.ts` - Basic message creation
- `/examples/streaming.ts` - Streaming responses
- `/examples/tools.ts` - Manual tool use
- `/examples/tools-helpers-zod.ts` - Automated tool execution with Zod
- `/examples/tools-helpers-advanced.ts` - Advanced tool runner patterns
- `/examples/tools-streaming.ts` - Streaming with tools
- `/examples/batch-results.ts` - Batch processing
- `/examples/count-tokens.ts` - Token counting
- `/package.json` - Dependencies and version info
