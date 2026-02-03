---
name: composio
description: Production-ready tool integration platform connecting AI agents to 500+ apps with managed authentication
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Composio Mastery

Composio is a tool integration platform that equips AI agents and LLMs with 500+ production-ready integrations via function calling. It eliminates the complexity of individual API integrations, OAuth flows, and tool formatting by providing a unified interface for connecting agents to real-world applications like GitHub, Slack, Gmail, Notion, and more.

Unlike building custom integrations for each service, Composio handles authentication, token management, webhook configuration, and tool schema generation automatically - enabling agents to take real-world actions without infrastructure overhead.

## Territory Map

Composio's architecture consists of three core layers:

```
composio/
├── Core SDK Layer
│   ├── composio-core (TypeScript)    # Base SDK for JS/TS
│   ├── composio (Python)             # Base SDK for Python
│   └── Tool Management
│       ├── Tool discovery & retrieval
│       ├── Schema generation
│       └── User-scoped tool access
│
├── Integration Layer
│   ├── Framework Adapters
│   │   ├── @composio/openai        # OpenAI integration
│   │   ├── @composio/anthropic     # Claude integration
│   │   ├── @composio/langchain     # LangChain adapter
│   │   ├── composio-llamaindex     # LlamaIndex adapter
│   │   ├── composio-crewai         # CrewAI adapter
│   │   ├── composio-autogen        # AutoGen adapter
│   │   └── @composio/google        # Gemini integration
│   └── Protocol Support
│       └── MCP (Model Context Protocol)
│
└── Infrastructure Layer
    ├── Authentication
    │   ├── OAuth 2.1 with PKCE
    │   ├── API Key management
    │   ├── Bearer token handling
    │   └── Custom auth configs
    ├── Triggers & Events
    │   ├── Webhook delivery
    │   ├── WebSocket streaming
    │   └── Event listeners
    └── Security
        ├── Brokered credentials
        ├── Token refresh & rotation
        └── SOC 2 compliance
```

## Core Capabilities

### 1. Multi-Framework Integration
Seamlessly integrate with 15+ agent frameworks through dedicated adapters:
- **AI SDKs**: OpenAI, Anthropic (Claude), Google Gemini
- **Agent Frameworks**: LangChain, LlamaIndex, CrewAI, AutoGen
- **Protocols**: MCP (Model Context Protocol) for Claude, Cursor, Windsurf
- **Unified Interface**: Consistent API across all frameworks

### 2. 500+ Production-Ready Tools
Access pre-built integrations across categories:
- **Development**: GitHub, GitLab, Jira, Linear
- **Communication**: Slack, Discord, Microsoft Teams
- **Productivity**: Notion, Google Workspace, Trello, Asana
- **Email**: Gmail, Outlook
- **Calendar**: Google Calendar, Calendly
- **CRM & Sales**: Salesforce, HubSpot, 60+ SDR tools
- **Storage**: Google Drive, Dropbox, Amazon S3

### 3. Managed Authentication
Zero-effort auth handling with enterprise-grade security:
- **OAuth 2.1**: Automated flows with PKCE for headless agents
- **Token Management**: Auto-refresh, rotation, and expiration handling
- **Brokered Credentials**: LLMs never see API keys (prevent leakage)
- **Multi-Tenant**: User-scoped connections for SaaS applications
- **Custom Configs**: Use your own OAuth apps and domains

### 4. Triggers and Event Handling
React to real-world events with automated workflows:
- **Trigger Types**: New commits, Slack messages, emails, calendar events
- **Delivery Methods**: Webhooks (HTTP POST) or WebSockets (real-time)
- **Security**: HMAC signature verification for webhooks
- **Event Listeners**: Decorator-based callbacks for event processing

### 5. Tool Router
Advanced toolkit management for isolated sessions:
- **Multi-Service**: Access multiple tools in a single session
- **User-Specific**: Isolated permissions per user
- **Scoped Sessions**: Fine-grained authentication per toolkit
- **MCP Gateway**: Universal tool access for MCP clients

## Beginner Techniques

### Installation and Setup

**Python:**
```bash
pip install composio-core
# Or with framework-specific packages
pip install composio-openai
pip install composio-langchain
pip install composio-llamaindex
```

**TypeScript:**
```bash
npm install @composio/core
# Or with framework-specific packages
npm install @composio/openai
npm install @composio/anthropic
npm install @composio/langchain
```

### Basic Tool Retrieval (Python)

```python
from composio import Composio, App

# Initialize Composio
composio = Composio(api_key="your_api_key")

# Get tools for a specific app
toolset = composio.get_toolset()
tools = toolset.get_tools(apps=[App.GITHUB])

# Get tools for specific user
user_tools = toolset.get_tools(
    apps=[App.GITHUB],
    user_id="user_123"
)

print(f"Available tools: {[tool.name for tool in tools]}")
```

### Basic Tool Retrieval (TypeScript)

```typescript
import { Composio } from '@composio/core';

// Initialize Composio
const composio = new Composio({ apiKey: 'your_api_key' });

// Get tools for specific toolkit
const tools = await composio.tools.get({
  toolkits: ['GITHUB'],
  userId: 'user_123'
});

console.log(`Available tools: ${tools.map(t => t.name)}`);
```

### Simple Integration with OpenAI

**Python:**
```python
from composio_openai import ComposioToolSet, Action
from openai import OpenAI

# Initialize
toolset = ComposioToolSet()
client = OpenAI()

# Get specific actions
tools = toolset.get_tools(actions=[Action.GITHUB_CREATE_ISSUE])

# Create agent with tools
response = client.chat.completions.create(
    model="gpt-4o",
    tools=tools,
    messages=[
        {"role": "user", "content": "Create a GitHub issue titled 'Bug fix'"}
    ]
)

# Execute tool calls
result = toolset.handle_tool_calls(response)
print(result)
```

**TypeScript:**
```typescript
import { OpenAI } from 'openai';
import { OpenAIToolSet } from '@composio/openai';

const openai = new OpenAI();
const toolset = new OpenAIToolSet();

// Get tools
const tools = await toolset.getTools({ apps: ['GITHUB'] });

// Create completion with tools
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  tools: tools,
  messages: [{ role: 'user', content: 'Create a GitHub issue' }]
});

// Handle tool calls
const result = await toolset.handleToolCall(response);
```

### Authenticating a Tool

**Using Connect Link (Recommended for SaaS):**
```python
from composio import Composio, App

composio = Composio()

# Generate connect link for user
connection = composio.get_entity(id="user_123").initiate_connection(
    app=App.GMAIL,
    redirect_url="https://yourapp.com/callback"
)

print(f"Send user to: {connection.redirectUrl}")
# User completes OAuth flow in browser
```

**Using SDK (Direct OAuth):**
```python
from composio import Composio, App

composio = Composio()
entity = composio.get_entity(id="user_123")

# Initiate OAuth and wait for completion
connection = entity.initiate_connection(
    app=App.GITHUB,
    redirect_url="http://localhost:3000/callback"
)

# Connection is now ready to use
tools = composio.get_toolset(user_id="user_123").get_tools(apps=[App.GITHUB])
```

## Intermediate Techniques

### LangChain Integration

```python
from langchain.agents import create_openai_functions_agent, AgentExecutor
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from composio_langchain import ComposioToolSet, Action, App

# Initialize
toolset = ComposioToolSet(entity_id="user_123")
tools = toolset.get_tools(apps=[App.GITHUB, App.SLACK])

# Create LangChain agent
llm = ChatOpenAI(model="gpt-4o")

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant with access to GitHub and Slack."),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad")
])

agent = create_openai_functions_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# Execute task
result = agent_executor.invoke({
    "input": "Create a GitHub issue and notify the team on Slack"
})
print(result)
```

### CrewAI Integration

```python
from crewai import Agent, Task, Crew
from composio_crewai import ComposioToolSet, Action, App

# Initialize Composio tools
toolset = ComposioToolSet(entity_id="user_123")
tools = toolset.get_tools(apps=[App.GITHUB])

# Create agent with Composio tools
developer_agent = Agent(
    role="Senior Developer",
    goal="Manage GitHub repositories and issues",
    backstory="You are an experienced developer managing code repositories",
    tools=tools,
    verbose=True
)

# Create task
github_task = Task(
    description="Create a new issue for implementing user authentication",
    expected_output="GitHub issue created with detailed requirements",
    agent=developer_agent
)

# Execute with crew
crew = Crew(
    agents=[developer_agent],
    tasks=[github_task],
    verbose=True
)

result = crew.kickoff()
```

### LlamaIndex Integration

```python
from llama_index.core.agent import ReActAgent
from llama_index.llms.openai import OpenAI
from composio_llamaindex import ComposioToolSet, Action, App

# Initialize
toolset = ComposioToolSet(entity_id="user_123")
tools = toolset.get_tools(apps=[App.NOTION, App.GOOGLE_CALENDAR])

# Create LlamaIndex agent
llm = OpenAI(model="gpt-4o")
agent = ReActAgent.from_tools(
    tools=tools,
    llm=llm,
    verbose=True
)

# Query agent
response = agent.query(
    "Schedule a meeting and create a Notion page with the agenda"
)
print(response)
```

### Setting Up Triggers (Webhooks)

```python
from composio import Composio, App
from flask import Flask, request

composio = Composio()
app = Flask(__name__)

# Create trigger for GitHub commits
trigger = composio.triggers.create(
    app=App.GITHUB,
    trigger_name="github_commit_event",
    entity_id="user_123",
    config={
        "owner": "your-org",
        "repo": "your-repo"
    }
)

# Webhook endpoint
@app.route('/webhook', methods=['POST'])
def handle_webhook():
    # Verify webhook signature
    signature = request.headers.get('webhook-signature')

    # Process event
    event_data = request.json
    print(f"New commit: {event_data['commit']['message']}")

    # Trigger agent action
    # ... your agent logic here

    return {'status': 'ok'}

# Configure webhook URL in Composio dashboard
print(f"Configure webhook URL: https://yourapp.com/webhook")
```

### Setting Up Triggers (WebSockets)

```python
from composio import Composio, App
import asyncio

composio = Composio()

# Create listener for Slack messages
listener = composio.triggers.subscribe(
    app=App.SLACK,
    trigger_name="slackbot_receive_message",
    entity_id="user_123",
    config={"channel": "general"}
)

@listener.callback
def handle_slack_message(event_data):
    """Process incoming Slack messages in real-time"""
    message = event_data['message']
    user = event_data['user']

    print(f"New message from {user}: {message}")

    # Trigger agent to respond
    # ... your agent logic here

# Start listening
listener.listen()
```

### Custom OAuth Configuration

```python
from composio import Composio, App

composio = Composio()

# Use your own OAuth app credentials
custom_integration = composio.integrations.create(
    app=App.GITHUB,
    auth_scheme="OAUTH2",
    auth_config={
        "client_id": "your_github_client_id",
        "client_secret": "your_github_client_secret",
        "scopes": ["repo", "user", "workflow"]
    },
    use_composio_auth=False  # Use your own credentials
)

# Users will see your domain in OAuth consent screen
connection = composio.get_entity(id="user_123").initiate_connection(
    integration_id=custom_integration.id,
    redirect_url="https://yourdomain.com/callback"
)
```

### Multi-Toolkit Session with Tool Router

```python
from composio import Composio, App

composio = Composio()

# Create isolated session with multiple toolkits
session = composio.tool_router.create_session(
    user_id="user_123",
    toolkits=[App.GITHUB, App.SLACK, App.JIRA],
    scoped_auth=True  # Each toolkit gets isolated permissions
)

# Get all tools for the session
tools = session.get_tools()

# Use with any framework
# Tools are scoped to this specific user and session
```

## Advanced Techniques

### Building Autonomous Slack Bot with Triggers

```python
from composio import Composio, App
from openai import OpenAI
import json

composio = Composio()
openai_client = OpenAI()
toolset = composio.get_toolset(user_id="slack_bot_user")

# Get Slack tools
tools = toolset.get_tools(apps=[App.SLACK])

# Create Slack message listener
listener = composio.triggers.subscribe(
    app=App.SLACK,
    trigger_name="slackbot_receive_message",
    entity_id="slack_bot_user",
    config={
        "bot_token": "xoxb-your-token",
        "channel": "#general"
    }
)

@listener.callback
def process_slack_message(event_data):
    """Generate and send AI responses to Slack messages"""
    message = event_data.get('message', '')
    channel = event_data.get('channel', '')
    user = event_data.get('user', '')

    # Skip bot's own messages
    if event_data.get('bot_id'):
        return

    print(f"Processing message from {user}: {message}")

    # Generate response with OpenAI
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        tools=tools,
        messages=[
            {"role": "system", "content": "You are a helpful Slack bot."},
            {"role": "user", "content": message}
        ]
    )

    # Handle tool calls (e.g., send_slack_message)
    if response.choices[0].message.tool_calls:
        result = toolset.handle_tool_calls(
            response=response,
            entity_id="slack_bot_user"
        )
        print(f"Bot responded: {result}")

# Start listening for messages
print("Slack bot is listening...")
listener.listen()
```

### Multi-Agent Workflow with GitHub + Gmail

```python
from composio_openai import ComposioToolSet, Action, App
from openai import OpenAI
import json

toolset = ComposioToolSet(entity_id="developer_123")
client = OpenAI()

# Get tools for GitHub and Gmail
github_tools = toolset.get_tools(apps=[App.GITHUB])
gmail_tools = toolset.get_tools(apps=[App.GMAIL])

# Agent 1: Code reviewer that checks PRs
def code_review_agent(pr_url: str):
    """Review PR and provide feedback"""
    response = client.chat.completions.create(
        model="gpt-4o",
        tools=github_tools,
        messages=[{
            "role": "user",
            "content": f"Review the pull request at {pr_url} and suggest improvements"
        }]
    )

    result = toolset.handle_tool_calls(response)
    return result

# Agent 2: Notification agent that emails summary
def notification_agent(review_summary: str, recipient: str):
    """Send email summary of code review"""
    response = client.chat.completions.create(
        model="gpt-4o",
        tools=gmail_tools,
        messages=[{
            "role": "user",
            "content": f"Send an email to {recipient} with this review summary: {review_summary}"
        }]
    )

    result = toolset.handle_tool_calls(response)
    return result

# Orchestrate workflow
pr_url = "https://github.com/org/repo/pull/123"
review = code_review_agent(pr_url)
notification = notification_agent(
    review_summary=str(review),
    recipient="team@company.com"
)

print("Workflow completed!")
```

### Enterprise MCP Integration

```typescript
import { MCPGateway } from '@composio/mcp';
import { OpenAI } from 'openai';

// Initialize MCP Gateway with Composio
const gateway = new MCPGateway({
  apiKey: process.env.COMPOSIO_API_KEY,
  toolkits: ['GITHUB', 'SLACK', 'NOTION', 'GMAIL'],
  userId: 'user_123'
});

// Connect to gateway
await gateway.connect();

// Get all tools through MCP
const tools = await gateway.getTools();

// Use with any MCP-compatible client
const openai = new OpenAI();
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  tools: tools,
  messages: [
    { role: 'user', content: 'Create a GitHub issue and notify team on Slack' }
  ]
});

// Gateway handles authentication and execution
const result = await gateway.executeToolCalls(response.choices[0].message.tool_calls);
console.log(result);
```

### Advanced Error Handling and Retry Logic

```python
from composio import Composio, App
from composio.exceptions import (
    ComposioAuthError,
    ComposioRateLimitError,
    ComposioToolExecutionError
)
import time

composio = Composio()
toolset = composio.get_toolset(user_id="user_123")

def execute_with_retry(action, params, max_retries=3):
    """Execute Composio action with exponential backoff"""
    for attempt in range(max_retries):
        try:
            result = toolset.execute_action(
                action=action,
                params=params,
                entity_id="user_123"
            )
            return result

        except ComposioAuthError as e:
            print(f"Auth error: {e}")
            # Re-authenticate user
            connection = composio.get_entity(id="user_123").initiate_connection(
                app=App.GITHUB
            )
            print("Please re-authenticate")
            raise

        except ComposioRateLimitError as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff
                print(f"Rate limited. Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise

        except ComposioToolExecutionError as e:
            print(f"Tool execution failed: {e}")
            # Log error and notify monitoring
            raise

# Use with retry logic
result = execute_with_retry(
    action=Action.GITHUB_CREATE_ISSUE,
    params={
        "title": "Bug Report",
        "body": "Description of the bug",
        "owner": "your-org",
        "repo": "your-repo"
    }
)
```

### Custom Tool Creation

```python
from composio import Composio, App
from composio.tools import BaseTool
from pydantic import BaseModel, Field

class CustomDatabaseTool(BaseTool):
    """Custom tool for internal database access"""

    class InputSchema(BaseModel):
        query: str = Field(description="SQL query to execute")
        database: str = Field(description="Database name")

    class OutputSchema(BaseModel):
        results: list = Field(description="Query results")
        row_count: int = Field(description="Number of rows")

    name: str = "query_internal_database"
    description: str = "Execute SQL queries on internal databases"

    def execute(self, input_data: InputSchema) -> OutputSchema:
        """Execute the custom tool logic"""
        # Your custom implementation
        # Connect to database, execute query, return results
        results = self._execute_query(input_data.query, input_data.database)

        return self.OutputSchema(
            results=results,
            row_count=len(results)
        )

    def _execute_query(self, query: str, database: str):
        # Custom database logic
        pass

# Register custom tool with Composio
composio = Composio()
custom_tool = CustomDatabaseTool()

# Use alongside Composio tools
toolset = composio.get_toolset(user_id="user_123")
composio_tools = toolset.get_tools(apps=[App.SLACK])

all_tools = composio_tools + [custom_tool]
```

### Production Monitoring and Logging

```python
from composio import Composio, App
from composio.client import ComposioClient
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MonitoredComposioClient:
    """Wrapper for Composio with monitoring"""

    def __init__(self, api_key: str):
        self.client = Composio(api_key=api_key)
        self.metrics = {
            'tool_calls': 0,
            'auth_requests': 0,
            'errors': 0
        }

    def execute_action(self, action, params, entity_id):
        """Execute action with monitoring"""
        start_time = datetime.now()

        try:
            logger.info(f"Executing {action} for entity {entity_id}")

            result = self.client.get_toolset(user_id=entity_id).execute_action(
                action=action,
                params=params,
                entity_id=entity_id
            )

            self.metrics['tool_calls'] += 1
            duration = (datetime.now() - start_time).total_seconds()

            logger.info(f"Action completed in {duration}s")

            # Send to monitoring service (DataDog, New Relic, etc.)
            self._track_metric('composio.action.duration', duration, {
                'action': action,
                'entity_id': entity_id,
                'status': 'success'
            })

            return result

        except Exception as e:
            self.metrics['errors'] += 1
            logger.error(f"Action failed: {str(e)}", exc_info=True)

            self._track_metric('composio.action.error', 1, {
                'action': action,
                'entity_id': entity_id,
                'error': type(e).__name__
            })

            raise

    def _track_metric(self, metric_name, value, tags):
        """Send metrics to monitoring service"""
        # Implement your monitoring integration
        # statsd.gauge(metric_name, value, tags=tags)
        pass

    def get_metrics(self):
        """Get current metrics"""
        return self.metrics

# Usage
monitored_client = MonitoredComposioClient(api_key="your_key")
result = monitored_client.execute_action(
    action=Action.GITHUB_CREATE_ISSUE,
    params={"title": "Bug"},
    entity_id="user_123"
)
```

## When to Use Composio

### Use Composio When:
- Building AI agents that need to interact with external tools and services
- Integrating with multiple SaaS applications (GitHub, Slack, Gmail, etc.)
- Creating multi-tenant applications requiring user-specific tool access
- Implementing event-driven workflows with triggers and webhooks
- Need production-ready OAuth handling without building auth infrastructure
- Building agents with LangChain, CrewAI, LlamaIndex, or other frameworks
- Requiring secure credential management (brokered credentials pattern)
- Prototyping quickly with 500+ pre-built integrations
- Building MCP-compatible tools for Claude, Cursor, or Windsurf
- Need automatic token refresh and rotation for long-running agents
- Creating autonomous agents that respond to real-world events
- Building SDR/sales agents with CRM and communication tool access

### Consider Alternatives When:
- Building single-app integrations with simple API calls (use SDK directly)
- Need ultra-low latency with direct API control (no abstraction layer)
- Working with internal/proprietary APIs not in Composio's catalog
- Building simple chatbots without external tool requirements
- Budget constraints for API gateway services
- Require complete control over authentication flows and token storage
- Working with legacy systems without REST APIs

### Composio vs Building Custom Integrations:
- **Composio**: 500+ tools ready, managed auth, automatic updates, enterprise security
- **Custom**: Full control, no third-party dependency, tailored to specific needs

### Composio vs Zapier/Make:
- **Composio**: Agent-first, programmatic control, real-time tool calling, framework integration
- **Zapier/Make**: No-code, human-triggered workflows, scheduled automation

### Composio vs LangChain Tools:
- **Composio**: Managed auth, multi-framework, 500+ apps, production security
- **LangChain Tools**: Framework-specific, manual auth, smaller catalog

## Best Practices

1. **Entity Management**: Use consistent entity IDs (user_123, org_456) to scope tools per user
2. **Error Handling**: Always wrap Composio calls in try/except with specific exception types
3. **Token Security**: Use brokered credentials pattern - never expose tokens to LLM context
4. **Webhook Verification**: Always verify HMAC signatures for incoming webhooks
5. **Tool Selection**: Request only necessary tools to reduce token overhead in prompts
6. **Connection Status**: Check connection health before executing critical operations
7. **Rate Limiting**: Implement exponential backoff for rate-limited APIs
8. **Monitoring**: Track tool usage, latency, and errors in production
9. **Testing**: Use sandbox accounts for development, production accounts for deployment
10. **Documentation**: Keep tool schemas and action descriptions up-to-date for agent understanding
11. **Custom OAuth**: Use your own OAuth apps for production to control branding and limits
12. **Trigger Filtering**: Configure triggers with specific filters to reduce noise
13. **Multi-Tenant**: Isolate user data by using entity_id consistently across all operations
14. **Caching**: Cache tool schemas to reduce initialization overhead
15. **Async Execution**: Use async methods for high-concurrency applications

## Common Patterns

### The Notification Pattern
```
Trigger (GitHub PR) → Agent analyzes → Send Slack notification
```

### The Automation Pattern
```
Trigger (Email received) → Extract info → Update CRM → Schedule follow-up
```

### The Orchestration Pattern
```
User request → Agent plans → Execute tools in sequence → Report results
```

### The Event-Driven Pattern
```
External event → Webhook → Agent processes → Take action → Log outcome
```

### The Multi-Tool Pattern
```
Agent decision → Parallel tool calls → Aggregate results → Synthesize response
```

## Reference Files

Since the Composio resource directory is empty, refer to official documentation:

**Official Documentation:**
- Main Docs: https://docs.composio.dev/
- Authentication Guide: https://docs.composio.dev/docs/authenticating-tools
- Triggers Guide: https://docs.composio.dev/docs/using-triggers
- Custom Auth: https://docs.composio.dev/docs/custom-auth-configs
- Tool Catalog: https://composio.dev/tools
- MCP Integration: https://mcp.composio.dev/

**Framework-Specific Guides:**
- LangChain: https://docs.composio.dev/frameworks/langchain
- CrewAI: Install `composio-crewai` and import `ComposioToolSet`
- LlamaIndex: Install `composio-llamaindex` and import `ComposioToolSet`
- OpenAI: Install `composio-openai` and import `ComposioToolSet`

**GitHub Repository:**
- Main Repo: https://github.com/ComposioHQ/composio
- Examples: Check `/examples` directory in repo
- SDK Source: `/python/composio` and `/typescript/composio`

**Installation:**
```bash
# Python Core
pip install composio-core

# Framework-specific
pip install composio-openai
pip install composio-langchain
pip install composio-llamaindex
pip install composio-crewai
pip install composio-autogen

# TypeScript Core
npm install @composio/core

# Framework-specific
npm install @composio/openai
npm install @composio/anthropic
npm install @composio/langchain
npm install @composio/google
```

**Key Features:**
- 500+ pre-built tool integrations
- 15+ framework adapters
- OAuth 2.1 with PKCE
- Managed token refresh and rotation
- Triggers via webhooks and WebSockets
- MCP (Model Context Protocol) support
- SOC 2 compliant infrastructure
- User-scoped tool access for multi-tenant apps
- Tool Router for session management
- Brokered credentials for security
- Custom OAuth configuration
- Production-ready reliability

## Troubleshooting

**Issue**: Authentication failing for connected accounts
- Verify token hasn't expired: Check connection status in dashboard
- Re-initiate connection: Use `entity.initiate_connection()` to refresh OAuth
- Check scopes: Ensure requested permissions match OAuth app configuration
- Custom OAuth: Verify client_id and client_secret are correct

**Issue**: Tools not appearing for specific user
- Ensure entity_id is consistent across tool retrieval and execution
- Check connection exists: Use `composio.get_entity(id="user").get_connections()`
- Verify app is connected: Connection must be established before tool retrieval
- Check app name: Use `App.GITHUB` enum, not string "github"

**Issue**: Webhook not receiving events
- Verify webhook URL is publicly accessible (use ngrok for local testing)
- Check trigger configuration: Ensure filter parameters are correct
- Verify signature: Implement HMAC verification for security
- Check trigger status: Ensure trigger is active in Composio dashboard
- Review logs: Check Composio dashboard for delivery failures

**Issue**: Rate limiting errors
- Implement exponential backoff: Retry with increasing delays
- Use custom OAuth app: Default apps share rate limits across users
- Batch operations: Group multiple operations when possible
- Check provider limits: GitHub, Gmail have different rate limits

**Issue**: Tool execution fails silently
- Enable verbose logging: Set logging level to DEBUG
- Check tool parameters: Ensure all required fields are provided
- Verify permissions: Some actions require specific OAuth scopes
- Review response: Check return value for error messages
- Test manually: Use Composio dashboard to test tool execution

**Issue**: MCP integration not working
- Verify MCP client compatibility: Ensure client supports MCP protocol
- Check gateway configuration: Ensure toolkits are specified
- Update packages: Use latest @composio/mcp version
- Review connection: Test gateway.connect() completes successfully

**Issue**: Token refresh failures
- Check connection lifetime: Tokens may be revoked by user
- Verify refresh token: Ensure refresh_token hasn't expired
- Custom OAuth: Ensure your OAuth app supports refresh tokens
- Re-authenticate: Prompt user to reconnect if refresh fails

**Issue**: TypeScript/JavaScript async issues
- Use await: All Composio methods are async and return Promises
- Handle errors: Wrap calls in try/catch blocks
- Check initialization: Ensure Composio client is initialized before use
- Review types: Use TypeScript for better error detection
