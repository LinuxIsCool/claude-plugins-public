---
name: lucid-agents
description: Protocol-agnostic commerce SDK for AI agents with payments and transactions
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Lucid Agents Mastery

Lucid Agents is a TypeScript-first framework for building and monetizing AI agents. It provides a protocol-agnostic commerce and payments SDK that enables AI agents to sell services, facilitate monetary transactions, and participate in agent-to-agent marketplaces.

## Territory Map

```
lucid-agents/
├── packages/
│   ├── types/           # Shared type definitions (zero dependencies)
│   ├── core/            # Protocol-agnostic agent runtime with extension system
│   ├── http/            # HTTP extension for request/response handling
│   ├── payments/        # x402 payment utilities with bi-directional tracking
│   ├── wallet/          # Wallet SDK for agent and developer wallets
│   ├── identity/        # ERC-8004 onchain identity and trust layer
│   ├── a2a/             # A2A Protocol client for agent-to-agent communication
│   ├── ap2/             # AP2 (Agent Payments Protocol) extension
│   ├── analytics/       # Payment analytics and reporting
│   ├── scheduler/       # Scheduled task execution
│   ├── hono/            # Hono HTTP server adapter
│   ├── express/         # Express HTTP server adapter
│   ├── tanstack/        # TanStack Start adapter
│   ├── cli/             # CLI scaffolding tool
│   └── examples/        # Integration examples
├── docs/
│   ├── ARCHITECTURE.md  # System design and dependency graphs
│   ├── PAYMENTS.md      # Payment capabilities documentation
│   └── WALLETS.md       # Wallet configuration guide
└── lucid-docs/          # Documentation site
```

## Core Capabilities

### Extension-Based Architecture

Lucid Agents uses a compositional extension system where features are added via `.use()`:

- **http()** - HTTP request/response handling, streaming, SSE
- **payments()** - x402 payment verification, bi-directional tracking, policy enforcement
- **wallets()** - Wallet management for agents (local, thirdweb, custom)
- **identity()** - ERC-8004 onchain identity and trust configuration
- **a2a()** - Agent-to-agent communication protocol
- **ap2()** - Agent Payments Protocol extension
- **analytics()** - Payment analytics and CSV/JSON export
- **scheduler()** - Scheduled task execution

### Multi-Network Payment Support

**EVM Networks:**
- base - Base mainnet (L2, low cost)
- base-sepolia - Base Sepolia testnet
- ethereum - Ethereum mainnet
- sepolia - Ethereum Sepolia testnet

**Solana Networks:**
- solana - Solana mainnet (high throughput, low fees)
- solana-devnet - Solana devnet

**Payment Features:**
- Bi-directional tracking (agent pays AND receives)
- Persistent storage (SQLite, In-Memory, Postgres)
- Payment policies with limits, time windows, allow/block lists
- Automatic x402 payment verification
- Multiple policy groups for flexible control

### Agent-to-Agent Communication

**A2A Protocol Support:**
- Agent Card discovery (`.well-known/agent-card.json`)
- Task-based operations with status tracking
- Multi-turn conversations with contextId
- Streaming responses via SSE
- Task cancellation
- Direct invocation and streaming

### Onchain Identity (ERC-8004)

- Register agents as ERC-721 NFTs
- Verifiable domain ownership
- Reputation management via peer feedback
- Work validation through validation registry
- Trust metadata in agent manifest

## Beginner Techniques

### Create a Simple Agent

```typescript
import { createAgent } from '@lucid-agents/core';
import { http } from '@lucid-agents/http';
import { createAgentApp } from '@lucid-agents/hono';
import { z } from 'zod';

// 1. Build agent with extensions
const agent = await createAgent({
  name: 'my-agent',
  version: '1.0.0',
  description: 'My first agent',
})
  .use(http())
  .build();

// 2. Create adapter app (Hono, Express, or TanStack)
const { app, addEntrypoint } = await createAgentApp(agent);

// 3. Add entrypoints (capabilities)
addEntrypoint({
  key: 'echo',
  description: 'Echo back the input',
  input: z.object({ text: z.string() }),
  output: z.object({ text: z.string() }),
  handler: async ({ input }) => {
    return {
      output: { text: input.text },
      usage: { total_tokens: input.text.length },
    };
  },
});

// 4. Export for deployment
export default {
  port: 3000,
  fetch: app.fetch,
};
```

**Available Routes:**
- `GET /health` - Health check
- `GET /entrypoints` - List capabilities
- `GET /.well-known/agent-card.json` - Agent manifest
- `POST /entrypoints/:key/invoke` - Invoke entrypoint
- `POST /entrypoints/:key/stream` - Stream response (if streaming enabled)

### Accept Payments

```typescript
import { payments, paymentsFromEnv } from '@lucid-agents/payments';

const agent = await createAgent({
  name: 'paid-agent',
  version: '1.0.0',
})
  .use(http())
  .use(payments({ config: paymentsFromEnv() }))
  .build();

// Environment variables:
// PAYMENTS_RECEIVABLE_ADDRESS=0x... (or Solana address)
// FACILITATOR_URL=https://facilitator.daydreams.systems
// NETWORK=base-sepolia (or solana-devnet, etc.)

addEntrypoint({
  key: 'process',
  description: 'Process data',
  input: z.object({ data: z.string() }),
  price: '1000', // 0.001 USDC
  handler: async ({ input }) => {
    return {
      output: { result: `Processed: ${input.data}` },
    };
  },
});
```

### Stream Responses

```typescript
addEntrypoint({
  key: 'generate',
  description: 'Generate text',
  input: z.object({ prompt: z.string() }),
  streaming: true,
  async stream({ input }, emit) {
    for (const char of input.prompt) {
      await emit({ kind: 'delta', delta: char, mime: 'text/plain' });
    }

    await emit({
      kind: 'text',
      text: `Generated: ${input.prompt}`,
      mime: 'text/plain',
    });

    return {
      output: { done: true },
      usage: { total_tokens: input.prompt.length },
    };
  },
});
```

## Intermediate Techniques

### Call Other Agents (A2A)

```typescript
import { a2a, fetchAndInvoke, waitForTask } from '@lucid-agents/a2a';

const agent = await createAgent({
  name: 'orchestrator',
  version: '1.0.0',
})
  .use(http())
  .use(a2a())
  .build();

addEntrypoint({
  key: 'delegate',
  handler: async ({ input, runtime }) => {
    // Convenience: Fetch card and invoke in one call
    const result = await fetchAndInvoke(
      'https://worker-agent.example.com',
      'process',
      { data: input.data }
    );

    return { output: result.output };
  },
});

// Or use tasks for long-running operations:
addEntrypoint({
  key: 'delegate-async',
  handler: async ({ input, runtime }) => {
    const workerCard = await runtime.a2a.fetchCard(
      'https://worker-agent.example.com'
    );

    // Create task (returns immediately)
    const { taskId } = await runtime.a2a.client.sendMessage(
      workerCard,
      'process',
      { data: input.data }
    );

    // Wait for completion
    const task = await waitForTask(runtime.a2a.client, workerCard, taskId);

    return { output: task.result?.output };
  },
});
```

### Payment Policies

Create `payment-policies.json`:

```json
[
  {
    "name": "Daily Budget",
    "outgoingLimits": {
      "global": {
        "maxPaymentUsd": 10.0,
        "maxTotalUsd": 1000.0,
        "windowMs": 86400000
      }
    }
  },
  {
    "name": "Trusted Recipients",
    "allowedRecipients": [
      "https://trusted-agent.example.com",
      "0x1234567890123456789012345678901234567890"
    ]
  }
]
```

Use in agent:

```typescript
import { payments } from '@lucid-agents/payments';

const agent = await createAgent({
  name: 'policy-agent',
  version: '1.0.0',
})
  .use(http())
  .use(
    payments({
      config: paymentsFromEnv(),
      policies: 'payment-policies.json', // Enable policy enforcement
    })
  )
  .build();

// Now when this agent pays other agents:
import { createRuntimePaymentContext } from '@lucid-agents/payments';

addEntrypoint({
  key: 'pay-worker',
  handler: async ({ input, runtime }) => {
    const context = await createRuntimePaymentContext({
      runtime,
      network: 'base-sepolia',
    });

    // Policies automatically enforced
    // Returns 403 if policy violation
    const response = await context.fetchWithPayment(
      'https://worker.example.com/entrypoints/process/invoke',
      {
        method: 'POST',
        body: JSON.stringify({ input: input.data }),
      }
    );

    if (response.status === 403) {
      const error = await response.json();
      throw new Error(`Policy violation: ${error.reason}`);
    }

    return { output: await response.json() };
  },
});
```

### Register Onchain Identity

```typescript
import { createAgentIdentity, getTrustConfig } from '@lucid-agents/identity';
import { wallets, walletsFromEnv } from '@lucid-agents/wallet';

// 1. Create agent with wallet
const agent = await createAgent({
  name: 'verified-agent',
  version: '1.0.0',
})
  .use(http())
  .use(wallets({ config: walletsFromEnv() }))
  .build();

// 2. Register identity (mints ERC-721 NFT)
const identity = await createAgentIdentity({
  runtime: agent,
  domain: 'agent.example.com',
  autoRegister: true, // Automatically register if not found
  chainId: 84532, // Base Sepolia
});

// 3. Add to agent app
const { app } = await createAgentApp(agent);

// Trust metadata automatically included in manifest
// Host metadata at: https://agent.example.com/.well-known/agent-metadata.json

console.log(`Agent ID: ${identity.record?.agentId}`);
console.log(`Owner: ${identity.record?.owner}`);
```

### Manage Wallet Connectors

```typescript
import { wallets } from '@lucid-agents/wallet';

// Local wallet (private key)
const agent1 = await createAgent({ ... })
  .use(wallets({
    config: {
      agent: {
        type: 'local',
        privateKey: process.env.AGENT_WALLET_PRIVATE_KEY,
      },
    },
  }))
  .build();

// thirdweb Engine server wallet
const agent2 = await createAgent({ ... })
  .use(wallets({
    config: {
      agent: {
        type: 'thirdweb',
        secretKey: process.env.AGENT_WALLET_SECRET_KEY,
        clientId: process.env.AGENT_WALLET_CLIENT_ID,
        walletLabel: 'agent-wallet',
        chainId: 84532,
      },
    },
  }))
  .build();

// Custom signer
import { createSignerConnector } from '@lucid-agents/wallet';

const customSigner = createSignerConnector({
  address: '0x...',
  signMessage: async (msg) => { /* your signing logic */ },
  signTypedData: async (data) => { /* your typed data signing */ },
});

const agent3 = await createAgent({ ... })
  .use(wallets({
    config: {
      agent: {
        type: 'local',
        signer: customSigner,
        provider: 'custom',
      },
    },
  }))
  .build();
```

## Advanced Techniques

### Multi-Agent Composition (Facilitator Pattern)

Agent 2 acts as both server (receives from Agent 3) and client (calls Agent 1):

```typescript
// Agent 1 (Worker) - Does the work
const worker = await createAgent({
  name: 'worker-agent',
  version: '1.0.0',
})
  .use(http())
  .use(a2a())
  .build();

const { app: app1, addEntrypoint: add1 } = await createAgentApp(worker);

add1({
  key: 'process',
  input: z.object({ data: z.array(z.number()) }),
  output: z.object({ result: z.number() }),
  handler: async ({ input }) => {
    const sum = input.data.reduce((acc, n) => acc + n, 0);
    return { output: { result: sum } };
  },
});

// Agent 2 (Facilitator) - Proxies to Agent 1
const facilitator = await createAgent({
  name: 'facilitator-agent',
  version: '1.0.0',
})
  .use(http())
  .use(a2a())
  .build();

const { app: app2, addEntrypoint: add2, runtime: runtime2 } =
  await createAgentApp(facilitator);

add2({
  key: 'process',
  input: z.object({ data: z.array(z.number()) }),
  output: z.object({ result: z.number() }),
  handler: async ({ input }) => {
    // Facilitator calls Worker
    const workerCard = await runtime2.a2a.fetchCard('http://agent1:8787');

    const { taskId } = await runtime2.a2a.client.sendMessage(
      workerCard,
      'process',
      { data: input.data }
    );

    const task = await waitForTask(runtime2.a2a.client, workerCard, taskId);

    return {
      output: task.result?.output,
      usage: task.result?.usage,
    };
  },
});

// Agent 3 (Client) - Calls Facilitator
const client = await createAgent({
  name: 'client-agent',
  version: '1.0.0',
})
  .use(a2a())
  .build();

// Flow: Client -> Facilitator -> Worker -> Facilitator -> Client
const result = await fetchAndInvoke(
  'http://agent2:8788',
  'process',
  { data: [1, 2, 3, 4, 5] }
);
// Result: { result: 15 }
```

### Payment Analytics & Reporting

```typescript
import { analytics } from '@lucid-agents/analytics';
import { getSummary, exportToCSV } from '@lucid-agents/analytics';
import { payments, paymentsFromEnv } from '@lucid-agents/payments';

const agent = await createAgent({
  name: 'analytics-agent',
  version: '1.0.0',
})
  .use(http())
  .use(payments({
    config: paymentsFromEnv(),
    storage: { type: 'sqlite' }, // Persistent storage
  }))
  .use(analytics())
  .build();

// Get payment summary
const summary = await getSummary(
  agent.analytics.paymentTracker,
  86400000 // Last 24 hours
);

console.log(`Outgoing: $${summary.outgoingTotal}`);
console.log(`Incoming: $${summary.incomingTotal}`);
console.log(`Net: $${summary.net}`);
console.log(`Transaction count: ${summary.count}`);

// Export to CSV for accounting systems
const csv = await exportToCSV(agent.analytics.paymentTracker);
// Write to file for QuickBooks, Xero, etc.

// Filter by time range
const weekSummary = await getSummary(
  agent.analytics.paymentTracker,
  7 * 24 * 60 * 60 * 1000 // Last 7 days
);
```

### Multi-Turn Conversations

```typescript
import { a2a } from '@lucid-agents/a2a';

const agent = await createAgent({
  name: 'chat-agent',
  version: '1.0.0',
})
  .use(http())
  .use(a2a())
  .build();

const contextId = `conversation-${Date.now()}`;

// First turn
const { taskId: task1 } = await agent.a2a.client.sendMessage(
  otherAgentCard,
  'chat',
  { message: 'Hello' },
  undefined,
  { contextId }
);

// Second turn (same conversation)
const { taskId: task2 } = await agent.a2a.client.sendMessage(
  otherAgentCard,
  'chat',
  { message: 'How are you?' },
  undefined,
  { contextId }
);

// List all tasks in conversation
const tasks = await agent.a2a.client.listTasks(otherAgentCard, {
  contextId,
  status: ['completed'],
});

console.log(`Conversation has ${tasks.tasks.length} messages`);
```

### Complex Policy Configuration

```json
[
  {
    "name": "Global Limits",
    "outgoingLimits": {
      "global": {
        "maxPaymentUsd": 10.0,
        "maxTotalUsd": 1000.0,
        "windowMs": 86400000
      },
      "perTarget": {
        "https://expensive-api.example.com": {
          "maxPaymentUsd": 50.0,
          "maxTotalUsd": 500.0,
          "windowMs": 86400000
        },
        "https://cheap-api.example.com": {
          "maxPaymentUsd": 1.0,
          "maxTotalUsd": 100.0,
          "windowMs": 86400000
        }
      },
      "perEndpoint": {
        "https://data-api.example.com/entrypoints/bulk-process/invoke": {
          "maxTotalUsd": 200.0,
          "windowMs": 86400000
        }
      }
    },
    "incomingLimits": {
      "global": {
        "maxTotalUsd": 5000.0,
        "windowMs": 86400000
      }
    },
    "allowedRecipients": [
      "https://trusted-agent-1.example.com",
      "https://trusted-agent-2.example.com"
    ],
    "blockedRecipients": [
      "https://untrusted.example.com"
    ],
    "blockedSenders": {
      "domains": ["https://spam-agent.example.com"],
      "addresses": ["0x1234567890123456789012345678901234567890"]
    },
    "rateLimits": {
      "maxPayments": 100,
      "windowMs": 3600000
    }
  }
]
```

### Reputation Management

```typescript
import { createAgentIdentity } from '@lucid-agents/identity';

const identity = await createAgentIdentity({ autoRegister: true });

// Give feedback to another agent
await identity.clients.reputation.giveFeedback({
  toAgentId: 42n,
  score: 90, // 0-100
  tag1: 'reliable',
  tag2: 'fast',
  feedbackUri: 'ipfs://QmFeedbackDetails',
});

// Check reputation before hiring
const agentToHire = 42n;
const reputation = await identity.clients.reputation.getSummary(agentToHire);

if (reputation.averageScore > 80) {
  console.log('Agent has good reputation, proceeding...');
  // Hire agent
}

// Get all feedback for an agent
const feedback = await identity.clients.reputation.getAllFeedback(42n);
feedback.forEach(f => {
  console.log(`Score: ${f.score}, Tags: ${f.tag1}, ${f.tag2}`);
});
```

### Using CLI for Quick Start

```bash
# Interactive mode
bunx @lucid-agents/cli my-agent

# Non-interactive with options
bunx @lucid-agents/cli my-agent \
  --adapter=hono \
  --template=axllm \
  --AGENT_NAME="Trading Agent" \
  --AGENT_DESCRIPTION="AI-powered trading agent" \
  --OPENAI_API_KEY=sk-... \
  --PAYMENTS_RECEIVABLE_ADDRESS=0x... \
  --NETWORK=base-sepolia \
  --DEFAULT_PRICE=1000

cd my-agent
bun install
bun run dev
```

**Available Adapters:**
- `hono` - Traditional HTTP server (edge-compatible)
- `express` - Node.js/Express server
- `tanstack-ui` - Full-stack React with dashboard
- `tanstack-headless` - API-only (no UI)

**Available Templates:**
- `blank` - Minimal agent skeleton
- `axllm` - LLM-powered agent (OpenAI, Anthropic, etc.)
- `axllm-flow` - Multi-step workflow agent
- `identity` - Onchain identity-enabled agent
- `trading-data-agent` - Merchant agent example
- `trading-recommendation-agent` - Shopper agent example

## When to Use Lucid Agents

**Perfect For:**
- Building monetized AI services with payment infrastructure
- Creating agent marketplaces where agents buy/sell services
- Multi-agent systems with agent-to-agent transactions
- Agents that need verifiable onchain identity
- Commerce applications requiring payment tracking and analytics
- Agents that call other agents (orchestration, delegation)
- Services that need policy-controlled spending limits
- Applications requiring multi-network payment support (EVM + Solana)

**Not Ideal For:**
- Simple scripts without payment/commerce needs
- Agents that don't interact with other agents
- Applications that don't need payment tracking
- Projects requiring non-TypeScript/JavaScript stack

**Key Advantages:**
- Protocol-agnostic core (not tied to HTTP)
- Extension-based architecture (use only what you need)
- Multi-network support (EVM + Solana)
- Bi-directional payment tracking (pay AND receive)
- Built-in policy enforcement
- Onchain identity and reputation
- Production-ready payment infrastructure
- Type-safe with full TypeScript support

## Reference Files

**Core Documentation:**
- `resources/agents/lucid-agents/README.md` - Main documentation
- `resources/agents/lucid-agents/AGENTS.md` - AI agent guide
- `resources/agents/lucid-agents/docs/ARCHITECTURE.md` - System architecture
- `resources/agents/lucid-agents/docs/PAYMENTS.md` - Payment capabilities
- `resources/agents/lucid-agents/docs/WALLETS.md` - Wallet configuration

**Package READMEs:**
- `resources/agents/lucid-agents/packages/core/README.md` - Core runtime
- `resources/agents/lucid-agents/packages/a2a/README.md` - A2A protocol
- `resources/agents/lucid-agents/packages/identity/README.md` - ERC-8004 identity
- `resources/agents/lucid-agents/packages/payments/README.md` - Payment utilities
- `resources/agents/lucid-agents/packages/wallet/README.md` - Wallet SDK

**Examples:**
- `resources/agents/lucid-agents/packages/core/examples/full-agent.ts` - Full-featured agent
- `resources/agents/lucid-agents/packages/examples/src/a2a/full-integration.ts` - A2A composition
- `resources/agents/lucid-agents/packages/examples/src/payments/policy-agent.ts` - Payment policies
- `resources/agents/lucid-agents/packages/examples/src/identity/` - Identity examples
- `resources/agents/lucid-agents/packages/examples/src/wallet/` - Wallet examples

**External Resources:**
- [ERC-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004) - Onchain agent identity standard
- [x402 Protocol](https://github.com/paywithx402) - HTTP-native payment protocol
- [A2A Protocol](https://a2a-protocol.org/) - Agent-to-agent communication standard
- [Hono Framework](https://hono.dev/) - Lightweight web framework
- [TanStack Start](https://tanstack.com/start) - Full-stack React framework
