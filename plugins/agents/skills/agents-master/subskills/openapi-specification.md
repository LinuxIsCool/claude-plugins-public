---
name: openapi-specification
description: API contract standard for defining tool interfaces and agent integrations
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# OpenAPI Specification Mastery

The OpenAPI Specification (OAS) is the lingua franca for defining HTTP APIs in a machine-readable format. For AI agents, it serves as the contract language that enables automatic tool discovery, parameter validation, and seamless integration with external services. When an agent can parse an OpenAPI spec, it can understand how to call any API without custom code.

## Territory Map

The OpenAPI ecosystem consists of:

- **Core Specification** - YAML/JSON format defining API structure (v3.0.x and v3.1.x)
- **Schema Objects** - JSON Schema-based type definitions for request/response validation
- **Path Items & Operations** - HTTP methods, parameters, and endpoint definitions
- **Components** - Reusable schemas, parameters, responses, and security schemes
- **Security Schemes** - Authentication/authorization definitions (OAuth2, API keys, etc.)
- **Webhooks** - Incoming callback definitions for event-driven architectures
- **Servers** - Base URL definitions with variable templating
- **Examples & Documentation** - Rich metadata for human and machine consumption

## Core Capabilities

OpenAPI enables agents to:

1. **Auto-discover API capabilities** - Parse specs to understand available operations
2. **Validate tool parameters** - Use schemas to ensure correct input types
3. **Generate tool definitions** - Convert OpenAPI operations to agent tool interfaces
4. **Handle authentication** - Understand security requirements for API access
5. **Process responses** - Parse and validate API responses against schemas
6. **Navigate complex APIs** - Use references ($ref) to handle modular definitions
7. **Support webhooks** - Define bidirectional agent-API communication

## Beginner Techniques

### Basic API Definition

A minimal OpenAPI document defines the API version, metadata, and at least one endpoint:

```yaml
openapi: 3.1.0
info:
  title: Task Manager API
  version: 1.0.0
  description: Simple task management for AI agents

servers:
  - url: https://api.tasks.example.com/v1

paths:
  /tasks:
    get:
      summary: List all tasks
      operationId: listTasks
      responses:
        '200':
          description: Array of tasks
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Task'

components:
  schemas:
    Task:
      type: object
      required:
        - id
        - title
      properties:
        id:
          type: string
          format: uuid
        title:
          type: string
        completed:
          type: boolean
          default: false
```

### Simple Schema Definitions

Define data structures that agents can validate against:

```yaml
components:
  schemas:
    # Primitive with validation
    Email:
      type: string
      format: email
      pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

    # Enumeration for agent choices
    Priority:
      type: string
      enum: [low, medium, high, urgent]
      description: Task priority level

    # Object with nested properties
    User:
      type: object
      required: [id, email]
      properties:
        id:
          type: string
          format: uuid
        email:
          $ref: '#/components/schemas/Email'
        name:
          type: string
          minLength: 1
          maxLength: 100
```

### Path Parameters

Define dynamic URL segments for resource access:

```yaml
paths:
  /tasks/{taskId}:
    parameters:
      - name: taskId
        in: path
        required: true
        description: Unique task identifier
        schema:
          type: string
          format: uuid

    get:
      summary: Get task by ID
      operationId: getTask
      responses:
        '200':
          description: Task details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Task'
        '404':
          description: Task not found
```

## Intermediate Techniques

### Tool Definition for Agents

Convert OpenAPI operations into agent-callable tools with proper parameter handling:

```yaml
paths:
  /search/tasks:
    post:
      summary: Search tasks with filters
      operationId: searchTasks
      description: |
        Agent-friendly search endpoint that accepts multiple filter criteria.
        Returns ranked results based on relevance.
      tags:
        - agent-tools
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                query:
                  type: string
                  description: Natural language search query
                  example: "urgent tasks for project alpha"
                filters:
                  type: object
                  properties:
                    priority:
                      type: array
                      items:
                        type: string
                        enum: [low, medium, high, urgent]
                    completed:
                      type: boolean
                    dateRange:
                      type: object
                      properties:
                        start:
                          type: string
                          format: date-time
                        end:
                          type: string
                          format: date-time
                limit:
                  type: integer
                  minimum: 1
                  maximum: 100
                  default: 20
      responses:
        '200':
          description: Search results
          content:
            application/json:
              schema:
                type: object
                properties:
                  results:
                    type: array
                    items:
                      $ref: '#/components/schemas/Task'
                  total:
                    type: integer
                  page:
                    type: integer
```

### Security Schemes for Agent Authentication

Define authentication methods that agents must implement:

```yaml
components:
  securitySchemes:
    # API Key for simple agent auth
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
      description: API key provided during agent registration

    # OAuth2 for user-delegated access
    OAuth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://auth.example.com/oauth/authorize
          tokenUrl: https://auth.example.com/oauth/token
          scopes:
            read:tasks: Read task data
            write:tasks: Create and update tasks
            delete:tasks: Delete tasks

    # Bearer token (common for AI agent platforms)
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  # Default: require API key for all endpoints
  - ApiKeyAuth: []

paths:
  /tasks:
    get:
      # Override: this endpoint accepts OAuth2 OR API key
      security:
        - OAuth2: [read:tasks]
        - ApiKeyAuth: []
```

### Reusable Components

Leverage $ref to avoid duplication and maintain consistency:

```yaml
components:
  parameters:
    # Reusable pagination parameters
    PageNumber:
      name: page
      in: query
      schema:
        type: integer
        minimum: 1
        default: 1

    PageSize:
      name: pageSize
      in: query
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20

    # Common filter parameter
    SortBy:
      name: sortBy
      in: query
      schema:
        type: string
        enum: [created, updated, priority, title]
        default: created

  responses:
    # Standard error responses
    BadRequest:
      description: Invalid request parameters
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

    Unauthorized:
      description: Authentication required
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

  schemas:
    Error:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
          example: INVALID_PARAMETER
        message:
          type: string
          example: The 'priority' field must be one of [low, medium, high, urgent]
        details:
          type: object
          additionalProperties: true

paths:
  /tasks:
    get:
      parameters:
        - $ref: '#/components/parameters/PageNumber'
        - $ref: '#/components/parameters/PageSize'
        - $ref: '#/components/parameters/SortBy'
      responses:
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
```

### Request Body with Multiple Content Types

Support different serialization formats for agent flexibility:

```yaml
paths:
  /tasks:
    post:
      summary: Create a new task
      operationId: createTask
      requestBody:
        required: true
        content:
          # JSON - most common for agents
          application/json:
            schema:
              $ref: '#/components/schemas/TaskInput'
            examples:
              simple:
                summary: Simple task creation
                value:
                  title: Review pull request
                  priority: high
              detailed:
                summary: Task with full details
                value:
                  title: Deploy to production
                  description: Deploy version 2.5.0 to prod environment
                  priority: urgent
                  dueDate: "2025-12-15T17:00:00Z"

          # Form data - for file uploads
          multipart/form-data:
            schema:
              type: object
              properties:
                title:
                  type: string
                attachment:
                  type: string
                  format: binary
```

## Advanced Techniques

### Webhooks for Agent Event Handling

Define incoming requests that your agent might receive (3.1.0+):

```yaml
webhooks:
  # Agent receives notification when task is assigned
  taskAssigned:
    post:
      summary: Task assignment notification
      description: |
        Sent to agent when a task is assigned. Agent should acknowledge
        receipt and optionally take automated action.
      operationId: onTaskAssigned
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [eventId, task, assignedBy]
              properties:
                eventId:
                  type: string
                  format: uuid
                  description: Unique event identifier for deduplication
                timestamp:
                  type: string
                  format: date-time
                task:
                  $ref: '#/components/schemas/Task'
                assignedBy:
                  $ref: '#/components/schemas/User'
                context:
                  type: object
                  description: Additional context about the assignment
                  additionalProperties: true
      responses:
        '200':
          description: Agent acknowledged the event
          content:
            application/json:
              schema:
                type: object
                properties:
                  acknowledged:
                    type: boolean
                  action:
                    type: string
                    enum: [accepted, deferred, delegated]
        '422':
          description: Agent cannot process this event

  # Agent receives updates on task status changes
  taskStatusChanged:
    post:
      summary: Task status change notification
      operationId: onTaskStatusChanged
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [eventId, taskId, oldStatus, newStatus]
              properties:
                eventId:
                  type: string
                  format: uuid
                taskId:
                  type: string
                  format: uuid
                oldStatus:
                  type: string
                newStatus:
                  type: string
                changedBy:
                  $ref: '#/components/schemas/User'
      responses:
        '200':
          description: Event received
```

### Complex Schema Patterns

#### Polymorphism with Discriminators

Handle multiple task types with shared base properties:

```yaml
components:
  schemas:
    # Base task type
    BaseTask:
      type: object
      required: [id, type, title]
      properties:
        id:
          type: string
          format: uuid
        type:
          type: string
          description: Discriminator field
        title:
          type: string
        created:
          type: string
          format: date-time
      discriminator:
        propertyName: type
        mapping:
          simple: '#/components/schemas/SimpleTask'
          scheduled: '#/components/schemas/ScheduledTask'
          recurring: '#/components/schemas/RecurringTask'

    # Simple one-off task
    SimpleTask:
      allOf:
        - $ref: '#/components/schemas/BaseTask'
        - type: object
          properties:
            type:
              type: string
              enum: [simple]
            priority:
              type: string
              enum: [low, medium, high]

    # Task with specific due date
    ScheduledTask:
      allOf:
        - $ref: '#/components/schemas/BaseTask'
        - type: object
          required: [dueDate]
          properties:
            type:
              type: string
              enum: [scheduled]
            dueDate:
              type: string
              format: date-time
            reminders:
              type: array
              items:
                type: object
                properties:
                  minutesBefore:
                    type: integer

    # Recurring task with schedule
    RecurringTask:
      allOf:
        - $ref: '#/components/schemas/BaseTask'
        - type: object
          required: [schedule]
          properties:
            type:
              type: string
              enum: [recurring]
            schedule:
              type: object
              required: [frequency]
              properties:
                frequency:
                  type: string
                  enum: [daily, weekly, monthly]
                interval:
                  type: integer
                  minimum: 1
                  default: 1
```

#### oneOf for Alternative Schemas

Define mutually exclusive options for agent decision-making:

```yaml
components:
  schemas:
    TaskFilter:
      oneOf:
        # Filter by date range
        - type: object
          required: [dateRange]
          properties:
            dateRange:
              type: object
              required: [start, end]
              properties:
                start:
                  type: string
                  format: date-time
                end:
                  type: string
                  format: date-time
          title: Date Range Filter

        # Filter by tags
        - type: object
          required: [tags]
          properties:
            tags:
              type: array
              items:
                type: string
              minItems: 1
            matchAll:
              type: boolean
              default: false
              description: If true, task must have all tags
          title: Tag Filter

        # Filter by assignee
        - type: object
          required: [assigneeId]
          properties:
            assigneeId:
              type: string
              format: uuid
            includeUnassigned:
              type: boolean
              default: false
          title: Assignee Filter
      discriminator:
        propertyName: filterType
```

#### anyOf for Combinable Schemas

Support multiple valid combinations for flexible agent queries:

```yaml
components:
  schemas:
    TaskUpdate:
      type: object
      anyOf:
        # Can update basic fields
        - required: [title]
          properties:
            title:
              type: string
              minLength: 1
        # Can update status
        - required: [completed]
          properties:
            completed:
              type: boolean
        # Can update priority
        - required: [priority]
          properties:
            priority:
              type: string
              enum: [low, medium, high, urgent]
        # Can update assignment
        - required: [assigneeId]
          properties:
            assigneeId:
              type: string
              format: uuid
              nullable: true
      # Common optional fields available in all cases
      properties:
        notes:
          type: string
          description: Optional notes about this update
        notifyAssignee:
          type: boolean
          default: true
          description: Whether to send notification
```

### Runtime Expressions for Callbacks

Use dynamic values from requests in callback/webhook definitions:

```yaml
paths:
  /tasks/{taskId}/subscribe:
    post:
      summary: Subscribe to task updates
      operationId: subscribeToTask
      parameters:
        - name: taskId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [callbackUrl]
              properties:
                callbackUrl:
                  type: string
                  format: uri
                  description: URL where agent receives updates
                events:
                  type: array
                  items:
                    type: string
                    enum: [updated, completed, deleted, commented]
      responses:
        '201':
          description: Subscription created
      callbacks:
        taskUpdated:
          # Runtime expression: use callbackUrl from request body
          '{$request.body#/callbackUrl}':
            post:
              summary: Task update notification
              requestBody:
                required: true
                content:
                  application/json:
                    schema:
                      type: object
                      required: [taskId, event, timestamp]
                      properties:
                        taskId:
                          type: string
                          format: uuid
                        event:
                          type: string
                          enum: [updated, completed, deleted, commented]
                        timestamp:
                          type: string
                          format: date-time
                        changes:
                          type: object
                          description: What changed in the task
              responses:
                '200':
                  description: Callback received successfully
```

### Advanced Security Patterns

#### Multiple Security Schemes

Support different auth methods for different agent contexts:

```yaml
components:
  securitySchemes:
    # Human user on behalf of agent
    UserOAuth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://auth.example.com/authorize
          tokenUrl: https://auth.example.com/token
          scopes:
            tasks:read: Read tasks
            tasks:write: Modify tasks

    # Machine-to-machine agent auth
    ClientCredentials:
      type: oauth2
      flows:
        clientCredentials:
          tokenUrl: https://auth.example.com/token
          scopes:
            agent:automation: Automated task operations

    # Emergency fallback with API key
    ApiKey:
      type: apiKey
      in: header
      name: X-API-Key

# Global security requirements (any one scheme)
security:
  - UserOAuth2: [tasks:read, tasks:write]
  - ClientCredentials: [agent:automation]
  - ApiKey: []

paths:
  # High-security endpoint requires OAuth2 only
  /tasks/bulk-delete:
    delete:
      summary: Bulk delete tasks
      security:
        - UserOAuth2: [tasks:write]
      # This endpoint explicitly disallows API key auth
```

### Server Variables for Environment-Aware Agents

Define flexible server URLs that adapt to deployment context:

```yaml
servers:
  - url: https://{environment}.api.tasks.example.com/{version}
    description: Multi-environment task API
    variables:
      environment:
        default: production
        enum:
          - production
          - staging
          - development
        description: Deployment environment
      version:
        default: v1
        enum:
          - v1
          - v2
          - beta
        description: API version

  - url: https://{customerId}.tasks.example.com/api
    description: Customer-specific endpoint
    variables:
      customerId:
        default: demo
        description: Customer identifier for multi-tenant agents
```

### Content Negotiation

Support multiple response formats for agent consumption preferences:

```yaml
paths:
  /tasks/{taskId}/export:
    get:
      summary: Export task data
      operationId: exportTask
      parameters:
        - name: taskId
          in: path
          required: true
          schema:
            type: string
        - name: format
          in: query
          schema:
            type: string
            enum: [json, xml, csv, markdown]
            default: json
      responses:
        '200':
          description: Task data in requested format
          content:
            # Structured data for agent processing
            application/json:
              schema:
                $ref: '#/components/schemas/Task'

            # XML for legacy system integration
            application/xml:
              schema:
                type: object

            # CSV for spreadsheet import
            text/csv:
              schema:
                type: string

            # Markdown for human-readable reports
            text/markdown:
              schema:
                type: string
                example: |
                  # Task: Deploy to Production

                  **Status:** In Progress
                  **Priority:** High
                  **Assignee:** agent-bot-01
```

## When to Use OpenAPI Specification

### Perfect For:

- **Agent tool integration** - Define APIs that agents can automatically discover and call
- **API-first agent development** - Design agent capabilities as OpenAPI operations
- **Multi-agent systems** - Standardize communication between different agent types
- **LLM function calling** - Convert OpenAPI to tool schemas for Claude, GPT, etc.
- **Validation and testing** - Ensure agent requests/responses match API contracts
- **Auto-generated SDKs** - Create type-safe client libraries for agent platforms
- **Documentation** - Provide machine and human-readable API reference
- **Service mesh integration** - Enable agent discovery in microservice architectures
- **Webhook management** - Define bidirectional agent-service communication
- **Security definition** - Clearly specify auth requirements for agent access

### Consider Alternatives When:

- **GraphQL APIs** - Use GraphQL SDL instead (though OpenAPI 3.1+ can describe some GraphQL)
- **gRPC services** - Protocol Buffers are more natural (though tools exist to convert)
- **WebSocket streams** - OpenAPI focuses on request/response, not persistent connections
- **Internal Python APIs** - Pydantic models might be simpler for pure Python systems
- **Simple scripts** - Overhead not worth it for trivial single-use tools

### Anti-Patterns to Avoid:

- **Over-specifying** - Don't define every possible response code; focus on agent-relevant ones
- **Ignoring $ref** - Duplicating schemas makes maintenance nightmares
- **Weak schemas** - Agents need strong validation; avoid `type: object` with no properties
- **Missing operationId** - Agents use this to map operations; always include it
- **Incomplete security** - Always define security schemes, even for internal APIs
- **No examples** - Examples help agents understand expected usage patterns
- **Version skipping** - Use proper semantic versioning in `info.version`

## Reference Files

The OpenAPI Specification is maintained at:
- **Main Specification**: `resources/agents/OpenAPI-Specification/versions/3.1.1.md`
- **Security Considerations**: `resources/agents/OpenAPI-Specification/SECURITY_CONSIDERATIONS.md`
- **Examples**: `resources/agents/OpenAPI-Specification/_archive_/schemas/v3.0/pass/`

Key online resources:
- Official spec: https://spec.openapis.org/oas/latest.html
- Learning site: https://learn.openapis.org/
- Format registry: https://spec.openapis.org/registry/format/
- Extension registry: https://spec.openapis.org/registry/extension/

### Quick Reference: Common Schema Patterns

```yaml
# String with constraints
type: string
minLength: 1
maxLength: 255
pattern: '^[a-zA-Z0-9_-]+$'

# Number with range
type: integer
minimum: 0
maximum: 100
multipleOf: 5

# Array with limits
type: array
items:
  type: string
minItems: 1
maxItems: 50
uniqueItems: true

# Object with required fields
type: object
required: [id, name]
properties:
  id:
    type: string
  name:
    type: string
additionalProperties: false

# Nullable field (3.1.0+)
type: [string, "null"]

# Enum with descriptions (annotated)
oneOf:
  - const: pending
    title: Pending
    description: Task is waiting to be started
  - const: active
    title: Active
    description: Task is currently in progress
  - const: done
    title: Done
    description: Task is completed

# File upload
type: string
format: binary
contentMediaType: image/png

# Date/time formats
type: string
format: date-time  # RFC 3339 full timestamp
# OR
format: date  # YYYY-MM-DD
# OR
format: time  # HH:MM:SS

# UUID
type: string
format: uuid

# Email
type: string
format: email

# URI
type: string
format: uri

# JSON Schema $ref (local)
$ref: '#/components/schemas/Task'

# JSON Schema $ref (external)
$ref: './common-schemas.yaml#/components/schemas/User'

# readOnly (response only)
type: object
properties:
  id:
    type: string
    readOnly: true
  createdAt:
    type: string
    format: date-time
    readOnly: true

# writeOnly (request only)
type: object
properties:
  password:
    type: string
    writeOnly: true
```

### Version Compatibility Notes

- **3.0.x**: Stable, widely supported, use for maximum compatibility
- **3.1.x**: Adds webhooks, better JSON Schema alignment, nullable handling improvements
- Key difference: 3.1.0 uses `type: [string, "null"]` instead of `nullable: true`
- Most agent platforms support 3.0.x; verify 3.1.x support before using advanced features
