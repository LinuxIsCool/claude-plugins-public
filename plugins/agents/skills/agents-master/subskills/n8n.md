---
name: n8n
description: Workflow automation platform with AI/LangChain nodes for building intelligent agent workflows and integrations
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# n8n Mastery

n8n is a fair-code workflow automation platform that combines the flexibility of code with the speed of visual workflow building. With 400+ integrations, native AI capabilities built on LangChain, and support for both self-hosting and cloud deployment, n8n enables technical teams to build sophisticated automations while maintaining full control over their data.

## Territory Map

```
/packages/
├── @n8n/
│   ├── api-types/          # Shared TypeScript interfaces (FE/BE)
│   ├── nodes-langchain/    # AI/LangChain nodes and agents
│   │   ├── nodes/agents/   # AI agent implementations
│   │   ├── nodes/llms/     # Language model integrations
│   │   ├── nodes/tools/    # LangChain tools
│   │   ├── nodes/chains/   # LangChain chains
│   │   ├── nodes/memory/   # Conversation memory
│   │   └── nodes/vector_store/ # Vector databases
│   ├── design-system/      # Vue component library
│   └── config/             # Configuration management
├── workflow/               # Core workflow engine interfaces
├── core/                   # Workflow execution engine
├── cli/                    # Express server, REST API, CLI
├── editor-ui/              # Vue 3 frontend editor
├── nodes-base/             # 400+ integration nodes
│   ├── nodes/              # Node implementations
│   ├── credentials/        # Authentication configs
│   └── utils/              # Shared utilities
└── node-dev/               # CLI for creating custom nodes
```

## Core Capabilities

### Visual Workflow Builder
- Drag-and-drop node-based interface
- Real-time workflow execution
- Data transformation and routing
- Error handling and retry logic
- Conditional branching and loops

### AI-Native Platform
- LangChain integration for agent workflows
- Support for OpenAI, Anthropic, Google, AWS Bedrock, Ollama, and 20+ LLMs
- Vector stores (Pinecone, Supabase, Qdrant, Chroma, etc.)
- Embeddings and document loaders
- RAG (Retrieval Augmented Generation) workflows
- Conversation memory and context management

### 400+ Integrations
- HTTP Request node for any API
- Native integrations (Google Sheets, Slack, GitHub, Airtable, etc.)
- Database connections (PostgreSQL, MySQL, MongoDB, etc.)
- Webhook triggers and listeners
- Cron-based scheduling

### Code Flexibility
- JavaScript/Python code nodes
- npm package imports
- Custom node development (TypeScript)
- Expression language for data mapping
- Function items and binary data handling

### Enterprise Features
- Self-hosting with Docker/npm
- Fair-code license (Sustainable Use License)
- Advanced permissions and SSO
- Air-gapped deployments
- Workflow versioning and templates

## Beginner Techniques

### Basic Workflow Structure

Every n8n workflow consists of nodes connected together. Each node represents an action, trigger, or transformation.

**Simple HTTP Request Workflow:**
```json
{
  "nodes": [
    {
      "parameters": {},
      "name": "Manual Trigger",
      "type": "n8n-nodes-base.manualTrigger",
      "position": [250, 300]
    },
    {
      "parameters": {
        "url": "https://api.github.com/repos/n8n-io/n8n",
        "options": {}
      },
      "name": "HTTP Request",
      "type": "n8n-nodes-base.httpRequest",
      "position": [450, 300]
    }
  ],
  "connections": {
    "Manual Trigger": {
      "main": [[{"node": "HTTP Request", "type": "main", "index": 0}]]
    }
  }
}
```

### Installing n8n

**Via npx (quickest):**
```bash
npx n8n
# Access at http://localhost:5678
```

**Via Docker:**
```bash
docker volume create n8n_data
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```

**Self-hosted with environment variables:**
```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=password \
  -v ~/.n8n:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```

### Creating a Simple Custom Node

Use the n8n-node-dev CLI to scaffold a new node:

```bash
npm install -g n8n-node-dev
n8n-node-dev new
```

**Basic node implementation:**
```typescript
import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

export class MyCustomNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'My Custom Node',
    name: 'myCustomNode',
    group: ['transform'],
    version: 1,
    description: 'Transforms data in a custom way',
    defaults: {
      name: 'My Custom Node',
      color: '#772244',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Custom Field',
        name: 'customField',
        type: 'string',
        default: '',
        description: 'A custom input field',
      }
    ]
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const customValue = this.getNodeParameter('customField', 0) as string;

    for (let i = 0; i < items.length; i++) {
      items[i].json.customField = customValue;
    }

    return [items];
  }
}
```

### Data Transformation with Expressions

n8n uses `{{ }}` for expressions:
```javascript
// Access current item data
{{ $json.fieldName }}

// Access data from previous node
{{ $node["NodeName"].json.fieldName }}

// Use JavaScript functions
{{ $json.name.toUpperCase() }}

// Conditional logic
{{ $json.status === "active" ? "yes" : "no" }}
```

## Intermediate Techniques

### AI Agent Node Configuration

Build an AI agent that can use tools to accomplish tasks:

```json
{
  "nodes": [
    {
      "parameters": {
        "promptType": "define",
        "text": "Add this user to my database: {{ $json.toJsonString() }}",
        "hasOutputParser": false
      },
      "name": "AI Agent",
      "type": "@n8n/n8n-nodes-langchain.agent",
      "typeVersion": 3,
      "position": [600, 300]
    },
    {
      "parameters": {
        "model": "gpt-4o",
        "options": {
          "temperature": 0.2
        }
      },
      "name": "OpenAI",
      "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
      "position": [400, 450]
    },
    {
      "parameters": {
        "descriptionType": "manual",
        "toolDescription": "Add user to database",
        "operation": "insert",
        "table": "users",
        "columns": {
          "mappingMode": "defineBelow",
          "value": {
            "name": "={{ $fromAI('name') }}",
            "email": "={{ $fromAI('email') }}"
          }
        }
      },
      "name": "Database Tool",
      "type": "n8n-nodes-base.postgres",
      "position": [400, 600]
    }
  ],
  "connections": {
    "OpenAI": {
      "ai_languageModel": [[{
        "node": "AI Agent",
        "type": "ai_languageModel",
        "index": 0
      }]]
    },
    "Database Tool": {
      "ai_tool": [[{
        "node": "AI Agent",
        "type": "ai_tool",
        "index": 0
      }]]
    }
  }
}
```

### RAG Workflow with Vector Store

Implement Retrieval Augmented Generation:

**Node Types:**
- Document Loader (PDF, CSV, JSON, etc.)
- Text Splitter (recursive character, token-based)
- Embeddings (OpenAI, Cohere, HuggingFace)
- Vector Store (Pinecone, Supabase, Qdrant)
- Retriever (query vector store)
- AI Agent (uses retrieved context)

**Flow:**
1. Load documents → Split text → Generate embeddings → Store in vector DB
2. User query → Generate query embedding → Retrieve similar chunks → LLM generates answer

### Webhook Trigger Node

Create a webhook endpoint that triggers workflows:

```typescript
export class MyWebhookNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'My Webhook',
    name: 'myWebhook',
    group: ['trigger'],
    version: 1,
    description: 'Listens for webhook calls',
    defaults: { name: 'My Webhook' },
    inputs: [],
    outputs: ['main'],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'webhook',
      }
    ],
    properties: []
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const bodyData = this.getBodyData();
    return {
      workflowData: [[{ json: bodyData }]],
    };
  }
}
```

### Polling Trigger

Create a node that polls an API at intervals:

```typescript
export class MyPollingTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'My Polling Trigger',
    name: 'myPollingTrigger',
    group: ['trigger'],
    version: 1,
    description: 'Polls an API for new data',
    polling: true, // Enable polling
    inputs: [],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Poll Interval',
        name: 'pollInterval',
        type: 'number',
        default: 60,
        description: 'Seconds between polls',
      }
    ]
  };

  async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
    const staticData = this.getWorkflowStaticData('node');
    const lastPoll = staticData.lastPoll as number || 0;

    // Fetch new data since last poll
    const newData = await fetchDataSince(lastPoll);

    staticData.lastPoll = Date.now();

    if (newData.length === 0) {
      return null; // No new data
    }

    return [[newData.map(item => ({ json: item }))]];
  }
}
```

### Credential Configuration

Define authentication for your node:

```typescript
export class MyApiCredentials implements ICredentialType {
  name = 'myApi';
  displayName = 'My API';
  documentationUrl = 'https://docs.example.com';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
    }
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        'Authorization': '=Bearer {{$credentials.apiKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: 'https://api.example.com',
      url: '/auth/verify',
    },
  };
}
```

## Advanced Techniques

### LangChain Agent with Multiple Tools

Create a sophisticated AI agent with tool calling, memory, and fallback models:

```typescript
import { toolsAgentExecute } from '../agents/ToolsAgent/V3/execute';

export class AdvancedAgent implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Advanced AI Agent',
    name: 'advancedAgent',
    version: [3, 3.1],
    inputs: `={{
      ((hasOutputParser, needsFallback) => {
        const inputs = [
          { type: NodeConnectionTypes.Main },
          { type: NodeConnectionTypes.AiLanguageModel, displayName: 'Model' },
        ];
        if (needsFallback) {
          inputs.push({
            type: NodeConnectionTypes.AiLanguageModel,
            displayName: 'Fallback Model'
          });
        }
        inputs.push({
          type: NodeConnectionTypes.AiTool,
          displayName: 'Tools',
          maxConnections: undefined
        });
        if (hasOutputParser) {
          inputs.push({ type: NodeConnectionTypes.AiOutputParser });
        }
        return inputs;
      })($parameter.hasOutputParser, $parameter.needsFallback)
    }}`,
    properties: [
      {
        displayName: 'Enable Fallback Model',
        name: 'needsFallback',
        type: 'boolean',
        default: false,
      },
      {
        displayName: 'Require Specific Output Format',
        name: 'hasOutputParser',
        type: 'boolean',
        default: false,
      },
      {
        displayName: 'Enable Streaming',
        name: 'enableStreaming',
        type: 'boolean',
        default: false,
      }
    ]
  };

  async execute(
    this: IExecuteFunctions,
    response?: EngineResponse
  ): Promise<INodeExecutionData[][] | EngineRequest> {
    return await toolsAgentExecute.call(this, response);
  }
}
```

### Custom Tool for LangChain

Create a reusable tool that agents can use:

```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export class ToolCustomDatabase implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Database Query Tool',
    name: 'toolCustomDatabase',
    group: ['transform'],
    version: 1,
    description: 'Tool for querying database',
    inputs: [
      { type: NodeConnectionTypes.AiTool }
    ],
    outputs: [],
    outputNames: ['Tool'],
    properties: [
      {
        displayName: 'Tool Description',
        name: 'description',
        type: 'string',
        default: 'Query the user database for information',
      }
    ]
  };

  async supplyData(this: ISupplyDataFunctions): Promise<SupplyData> {
    const description = this.getNodeParameter('description', 0) as string;

    const tool = new DynamicStructuredTool({
      name: 'database_query',
      description,
      schema: z.object({
        query: z.string().describe('SQL query to execute'),
      }),
      func: async ({ query }) => {
        // Execute database query
        const result = await executeQuery(query);
        return JSON.stringify(result);
      },
    });

    return {
      response: tool,
    };
  }
}
```

### Declarative Node with Request Router

Use routing configuration instead of execute function:

```typescript
export class MyDeclarativeNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Declarative API',
    name: 'declarativeApi',
    version: 1,
    defaults: { name: 'Declarative API' },
    requestDefaults: {
      baseURL: 'https://api.example.com',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    },
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'User', value: 'user' },
          { name: 'Post', value: 'post' },
        ],
        default: 'user',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        displayOptions: { show: { resource: ['user'] } },
        options: [
          { name: 'Get', value: 'get' },
          { name: 'List', value: 'list' },
        ],
        default: 'list',
      }
    ],
    requestOperations: {
      user: {
        get: {
          method: 'GET',
          url: '/users/{{$parameter.userId}}',
        },
        list: {
          method: 'GET',
          url: '/users',
        }
      }
    }
  };
}
```

### Versioned Node Implementation

Support multiple versions with clean separation:

```typescript
import { VersionedNodeType } from 'n8n-workflow';
import { MyNodeV1 } from './V1/MyNodeV1.node';
import { MyNodeV2 } from './V2/MyNodeV2.node';
import { MyNodeV3 } from './V3/MyNodeV3.node';

export class MyNode extends VersionedNodeType {
  constructor() {
    const baseDescription: INodeTypeBaseDescription = {
      displayName: 'My Node',
      name: 'myNode',
      icon: 'file:mynode.svg',
      group: ['transform'],
      description: 'My versioned node',
      defaultVersion: 3,
    };

    const nodeVersions: IVersionedNodeType['nodeVersions'] = {
      1: new MyNodeV1(baseDescription),
      2: new MyNodeV2(baseDescription),
      3: new MyNodeV3(baseDescription),
    };

    super(nodeVersions, baseDescription);
  }
}
```

### Output Parser for Structured Responses

Force AI to return structured data:

```typescript
import { StructuredOutputParser } from 'langchain/output_parsers';
import { z } from 'zod';

const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    name: z.string().describe('User full name'),
    email: z.string().email().describe('User email'),
    age: z.number().optional().describe('User age'),
    tags: z.array(z.string()).describe('Relevant tags'),
  })
);

// Use with AI Agent node
// Connect parser to the "Output Parser" input
```

### Development Workflow

**Monorepo development:**
```bash
# Clone and setup
git clone https://github.com/n8n-io/n8n.git
cd n8n
corepack enable
corepack prepare --activate
pnpm install

# Build all packages
pnpm build > build.log 2>&1
tail -n 20 build.log

# Run in dev mode
pnpm dev

# Run only backend
pnpm dev:be

# Run AI/LangChain development
pnpm dev:ai

# Run tests
pnpm test

# Lint and typecheck
cd packages/cli
pnpm lint
pnpm typecheck

# Create new node
cd packages/nodes-base
pnpm n8n-node-dev new
```

### Testing Custom Nodes

**Unit test example:**
```typescript
import { executeWorkflow } from '@test/nodes/Helpers';
import nock from 'nock';

describe('MyNode', () => {
  it('should fetch user data', async () => {
    nock('https://api.example.com')
      .get('/users/123')
      .reply(200, { id: 123, name: 'John' });

    const result = await executeWorkflow(
      {
        nodes: [
          {
            name: 'MyNode',
            type: 'myNode',
            parameters: { userId: '123' },
          }
        ]
      }
    );

    expect(result.data.length).toBe(1);
    expect(result.data[0][0].json.name).toBe('John');
  });
});
```

## When to Use n8n

**Perfect For:**
- Building AI agent workflows with LangChain integration
- Automating business processes with 400+ integrations
- Creating RAG (Retrieval Augmented Generation) systems
- Self-hosted automation with full data control
- Rapid prototyping with visual workflow builder
- Teams needing both no-code and full-code flexibility
- Integration orchestration across multiple services
- Webhook processing and API composition
- Database automation and ETL pipelines
- AI-powered customer support and chatbots

**Not Ideal For:**
- Real-time stream processing (sub-second latency)
- High-frequency trading systems
- Ultra-high-volume event processing (>10k/sec)
- Simple one-time scripts (use shell/Python instead)
- Mobile-first applications (n8n is backend/workflow focused)

**Choose n8n Over Alternatives When:**
- You need AI/LangChain native support (vs Zapier/Make)
- Self-hosting and data sovereignty are critical (vs cloud-only tools)
- You want fair-code licensing (vs proprietary or pure open-source)
- Visual + code flexibility is important (vs Airflow's code-only)
- You need sub-workflow composition (vs linear automations)

## Reference Files

### Essential Documentation
- `/packages/nodes-base/AGENTS.md` - Node development guide
- `/AGENTS.md` - Repository structure and architecture
- `/CONTRIBUTING.md` - Contributing guidelines
- `/packages/node-dev/README.md` - Custom node creation
- `/packages/@n8n/nodes-langchain/README.md` - LangChain integration

### Key Code References
- `/packages/nodes-base/nodes/` - 400+ node implementations
- `/packages/@n8n/nodes-langchain/nodes/agents/` - AI agent nodes
- `/packages/@n8n/nodes-langchain/nodes/llms/` - LLM integrations
- `/packages/@n8n/nodes-langchain/nodes/tools/` - LangChain tools
- `/packages/workflow/src/Interfaces.ts` - Core interfaces
- `/packages/core/src/` - Workflow execution engine
- `/packages/cli/src/` - Backend API and CLI
- `/packages/editor-ui/src/` - Vue frontend application

### Templates and Examples
- `/packages/node-dev/templates/` - Node scaffolding templates
- `/packages/workflow/test/fixtures/` - Workflow test fixtures
- `/docker/images/n8n/Dockerfile` - Docker deployment reference

### Development Tools
- `pnpm build` - Build all packages
- `pnpm dev` - Run development environment
- `pnpm test` - Run test suite
- `pnpm typecheck` - Type checking
- `n8n-node-dev new` - Create new node
- `n8n-node-dev build` - Build custom node

### Community Resources
- Documentation: https://docs.n8n.io
- AI Guide: https://docs.n8n.io/advanced-ai/
- Templates: https://n8n.io/workflows
- Forum: https://community.n8n.io
- GitHub: https://github.com/n8n-io/n8n
