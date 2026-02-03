---
name: zod-validation
description: Zod schema validation documentation for AgentNet
---

# Zod Schema Validation

## Overview

Zod is a TypeScript-first schema validation library with static type inference. It provides runtime validation while maintaining compile-time type safety, making it ideal for validating untrusted data from external sources like API requests, user input, or database responses.

**Key characteristics:**
- Zero dependencies with minimal bundle size (2kb gzipped core)
- Declarative schema definitions that mirror TypeScript's type system
- Automatic type inference from schemas using `z.infer<>`
- Immutable API - methods return new instances
- Cross-platform support (Node.js and browsers)
- Requires TypeScript v5.5+ with strict mode enabled

**Why use Zod:**
- Eliminates duplication between runtime validation and type definitions
- Catches data shape mismatches before they cause runtime errors
- Provides detailed, structured error information for debugging
- Enables confident usage of validated data throughout your codebase

## Installation

```bash
npm install zod
```

## Schema Definition

### Basic Primitives

Zod provides validators for all JavaScript primitive types:

```typescript
import * as z from "zod";

const stringSchema = z.string();
const numberSchema = z.number();
const booleanSchema = z.boolean();
const bigintSchema = z.bigint();
const symbolSchema = z.symbol();
const undefinedSchema = z.undefined();
const nullSchema = z.null();
```

### Object Schemas

Define structured data with typed properties. All properties are required by default:

```typescript
const User = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  age: z.number(),
  isActive: z.boolean(),
});
```

**Object behavior:**
- Unrecognized keys are stripped from parsed results by default
- Use `z.strictObject()` to reject unknown keys (throws error)
- Use `z.looseObject()` to pass unknown keys through unchanged

### Array Schemas

Validate arrays with constraints:

```typescript
const tags = z.array(z.string());
const limitedTags = z.array(z.string()).min(1).max(5);
const exactLength = z.array(z.number()).length(3);

// Access inner schema
const innerSchema = tags.unwrap(); // returns z.string()
```

### Nested Objects

Schemas are composable for complex nested structures:

```typescript
const Address = z.object({
  street: z.string(),
  city: z.string(),
  zipCode: z.string(),
});

const Person = z.object({
  name: z.string(),
  age: z.number(),
  address: Address,
  phoneNumbers: z.array(z.string()),
});
```

## Type Inference

Extract static TypeScript types directly from schemas using `z.infer<>`:

```typescript
const Player = z.object({
  username: z.string(),
  xp: z.number(),
  level: z.number(),
});

// Extract the inferred type
type Player = z.infer<typeof Player>;
// Equivalent to: { username: string; xp: number; level: number }

// Use the type in your code
const player: Player = {
  username: "billie",
  xp: 1000,
  level: 5,
};
```

**Input vs Output types:**

For schemas with transformations, use `z.input<>` and `z.output<>`:

```typescript
const StringToNumber = z.string().transform((val) => parseInt(val, 10));

type Input = z.input<typeof StringToNumber>;  // string
type Output = z.output<typeof StringToNumber>; // number
```

## Parsing and Validation

### The `.parse()` Method

Validates input and throws a `ZodError` if validation fails:

```typescript
const User = z.object({
  name: z.string(),
  age: z.number(),
});

// Valid input - returns strongly-typed deep clone
const user = User.parse({ name: "Alice", age: 30 });
console.log(user.name); // TypeScript knows this is a string

// Invalid input - throws ZodError
try {
  User.parse({ name: "Bob", age: "thirty" });
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error(error.issues);
  }
}
```

**When to use `.parse()`:**
- High confidence in data structure
- Want to fail fast on validation errors
- Using try-catch blocks or error middleware

### The `.safeParse()` Method

Returns a discriminated union result object without throwing:

```typescript
const result = User.safeParse({ name: "Charlie", age: "25" });

if (!result.success) {
  // Type: { success: false; error: ZodError }
  console.error(result.error.issues);
} else {
  // Type: { success: true; data: User }
  console.log(result.data.name);
}
```

**When to use `.safeParse()`:**
- Graceful error handling without exceptions
- API endpoints returning validation errors to clients
- Form validation with field-specific error messages
- Uncertain data quality requiring defensive programming

### Async Parsing

For schemas with async refinements or transforms:

```typescript
const UserWithAsyncCheck = z.object({
  email: z.string().email(),
}).refine(async (data) => {
  // Async validation (e.g., check if email exists in database)
  return await checkEmailAvailable(data.email);
}, "Email already in use");

// Must use async methods
const result = await UserWithAsyncCheck.parseAsync(input);
const safeResult = await UserWithAsyncCheck.safeParseAsync(input);
```

## Error Handling

### ZodError Structure

Validation errors are instances of `ZodError` containing an `issues` array:

```typescript
const result = User.safeParse({ name: 42, age: "invalid" });

if (!result.success) {
  result.error.issues.forEach((issue) => {
    console.log({
      code: issue.code,        // e.g., "invalid_type"
      path: issue.path,        // e.g., ["name"]
      message: issue.message,  // Human-readable message
    });
  });
}
```

### Custom Error Messages

**Basic string messages:**

```typescript
const name = z.string("Name must be a string");
const age = z.number().min(18, "Must be at least 18 years old");
```

**Error maps (functions) for dynamic messages:**

```typescript
const password = z.string({
  error: (iss) => {
    if (iss.input === undefined) {
      return "Password is required.";
    }
    return "Invalid password format.";
  }
});

const username = z.string().min(5, {
  error: (iss) => {
    if (iss.code === "too_small") {
      return `Username must be at least ${iss.minimum} characters.`;
    }
    return undefined; // Fall back to default
  }
});
```

**Error map context object (`iss`):**
- `code` - Issue code (e.g., "invalid_type", "too_small")
- `input` - The data being validated
- `inst` - The schema that originated the error
- `path` - Location of error in nested structures

### Error Formatting

**Format as nested object:**

```typescript
const result = schema.safeParse(data);
if (!result.success) {
  const formatted = result.error.format();
  // Nested object mirroring schema structure
}
```

**Flatten for simple field mapping:**

```typescript
const result = schema.safeParse(data);
if (!result.success) {
  const flattened = result.error.flatten();
  // Simplified field -> errors mapping
}
```

**Custom formatter for API responses:**

```typescript
function formatZodError(error: z.ZodError): Record<string, string[]> {
  const errorMap = new Map<string, string[]>();

  error.issues.forEach((issue) => {
    const field = issue.path.join('.');
    if (!errorMap.has(field)) {
      errorMap.set(field, []);
    }
    errorMap.get(field)?.push(issue.message);
  });

  return Object.fromEntries(errorMap);
}
```

## Advanced Patterns

### Optional Fields and Defaults

```typescript
const Config = z.object({
  host: z.string(),
  port: z.number().optional(),          // number | undefined
  timeout: z.number().default(5000),    // Returns 5000 if undefined
  retries: z.number().prefault(3),      // Input-level default, still validated
});

type Config = z.infer<typeof Config>;
// { host: string; port?: number; timeout: number; retries: number }
```

### Custom Validation with `.refine()`

Add custom constraints beyond built-in validators:

```typescript
// Simple refinement
const PositiveNumber = z.number().refine(
  (n) => n > 0,
  { message: "Number must be positive" }
);

// Cross-field validation
const PasswordForm = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Passwords do not match",
    path: ["confirmPassword"], // Point error to specific field
  }
);

// Multiple conditions
const Age = z.number().refine(
  (age) => age >= 18 && age <= 120,
  { message: "Age must be between 18 and 120" }
);
```

### Complex Validation with `.superRefine()`

For fine-grained control with multiple issues:

```typescript
const UserRegistration = z.object({
  email: z.string().email(),
  password: z.string(),
  age: z.number(),
}).superRefine((data, ctx) => {
  // Multiple validation rules with custom error paths
  if (data.password.length < 8) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_small,
      minimum: 8,
      type: "string",
      inclusive: true,
      message: "Password must be at least 8 characters",
      path: ["password"],
    });
  }

  if (!/[A-Z]/.test(data.password)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Password must contain an uppercase letter",
      path: ["password"],
    });
  }

  if (data.age < 18) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_small,
      minimum: 18,
      type: "number",
      inclusive: true,
      message: "Must be 18 or older",
      path: ["age"],
    });
  }
});
```

### Data Transformation with `.transform()`

Modify data during validation:

```typescript
// String cleanup
const TrimmedString = z.string().transform((val) => val.trim());

// Type conversion
const StringToNumber = z.string().transform((val) => parseInt(val, 10));

// Date parsing
const DateString = z.string().transform((val) => new Date(val));

// Complex transformation
const UserInput = z.object({
  name: z.string().transform((s) => s.trim().toLowerCase()),
  tags: z.string().transform((s) => s.split(',').map((t) => t.trim())),
  createdAt: z.string().transform((s) => new Date(s)),
});
```

### Validation Pipelines

Chain multiple validation and transformation steps:

```typescript
const DateValidation = z
  .string()
  .transform((val) => new Date(val))
  .refine((date) => !isNaN(date.getTime()), {
    message: "Invalid date format",
  })
  .refine((date) => date > new Date(), {
    message: "Date must be in the future",
  });

// Complex pipeline
const EmailNormalization = z
  .string()
  .transform((s) => s.trim().toLowerCase())
  .refine((s) => s.length > 0, "Email cannot be empty")
  .email("Invalid email format")
  .refine(async (email) => await checkEmailAvailable(email), {
    message: "Email already registered",
  });
```

### Schema Composition

**Extend existing schemas:**

```typescript
const BaseUser = z.object({
  id: z.string(),
  name: z.string(),
});

const AdminUser = BaseUser.extend({
  role: z.literal("admin"),
  permissions: z.array(z.string()),
});
```

**Pick and omit fields:**

```typescript
const User = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  password: z.string(),
});

const PublicUser = User.pick({ id: true, name: true });
const UserWithoutPassword = User.omit({ password: true });
```

**Partial and required:**

```typescript
const PartialUser = User.partial(); // All fields optional
const RequiredUser = User.required(); // All fields required
const MixedUser = User.partial({ email: true }); // Only email optional
```

### Union and Discriminated Unions

```typescript
// Basic union
const StringOrNumber = z.union([z.string(), z.number()]);

// Discriminated union for type narrowing
const Response = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), data: z.any() }),
  z.object({ status: z.literal("error"), message: z.string() }),
]);

const result = Response.parse({ status: "success", data: { id: 1 } });
if (result.status === "success") {
  console.log(result.data); // TypeScript knows 'data' exists
}
```

## AgentNet Patterns

### Agent Profile Validation

```typescript
const AgentProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  bio: z.string().max(500).optional(),
  tags: z.array(z.string()).max(10).default([]),
  metadata: z.record(z.string(), z.any()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  isActive: z.boolean().default(true),
});

type AgentProfile = z.infer<typeof AgentProfileSchema>;

// Usage
const result = AgentProfileSchema.safeParse(incomingData);
if (!result.success) {
  return { error: formatZodError(result.error) };
}

const profile: AgentProfile = result.data;
```

### Post Validation

```typescript
const PostSchema = z.object({
  id: z.string().uuid(),
  authorId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  visibility: z.enum(["public", "private", "followers"]).default("public"),
  attachments: z.array(z.object({
    type: z.enum(["image", "video", "document"]),
    url: z.string().url(),
    metadata: z.record(z.string(), z.any()).optional(),
  })).max(10).default([]),
  tags: z.array(z.string()).max(20).default([]),
  mentions: z.array(z.string().uuid()).default([]),
  createdAt: z.string().datetime(),
  editedAt: z.string().datetime().optional(),
}).refine(
  (data) => {
    // Ensure content or attachments exist
    return data.content.trim().length > 0 || data.attachments.length > 0;
  },
  { message: "Post must have content or attachments" }
);

type Post = z.infer<typeof PostSchema>;
```

### Message Validation

```typescript
const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().uuid(),
  recipientId: z.string().uuid(),
  content: z.string().min(1).max(10000),
  type: z.enum(["text", "system", "notification"]).default("text"),
  metadata: z.object({
    readAt: z.string().datetime().optional(),
    deliveredAt: z.string().datetime().optional(),
    encrypted: z.boolean().default(false),
  }).optional(),
  createdAt: z.string().datetime(),
});

type Message = z.infer<typeof MessageSchema>;

// Validation with custom error handling
function validateMessage(data: unknown): { success: true; data: Message } | { success: false; errors: Record<string, string[]> } {
  const result = MessageSchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      errors: formatZodError(result.error),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
```

### API Request/Response Validation

```typescript
// Request validation
const CreateAgentRequest = z.object({
  name: z.string().min(1).max(100),
  bio: z.string().max(500).optional(),
  tags: z.array(z.string()).max(10).optional(),
}).strict(); // Reject unknown fields

// Response validation
const AgentResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  bio: z.string().optional(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
});

// Middleware pattern
async function createAgent(req: Request, res: Response) {
  const validation = CreateAgentRequest.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: formatZodError(validation.error),
    });
  }

  const agentData = validation.data;
  // Process validated data...
}
```

### Configuration Validation

```typescript
const AgentNetConfigSchema = z.object({
  database: z.object({
    host: z.string(),
    port: z.number().min(1).max(65535),
    name: z.string(),
    ssl: z.boolean().default(true),
  }),
  api: z.object({
    baseUrl: z.string().url(),
    timeout: z.number().min(1000).default(30000),
    retries: z.number().min(0).max(5).default(3),
  }),
  features: z.object({
    messaging: z.boolean().default(true),
    notifications: z.boolean().default(true),
    analytics: z.boolean().default(false),
  }),
  limits: z.object({
    maxPostLength: z.number().min(100).max(50000).default(5000),
    maxAttachments: z.number().min(0).max(20).default(10),
    maxFollowers: z.number().min(0).optional(),
  }),
});

type AgentNetConfig = z.infer<typeof AgentNetConfigSchema>;

// Load and validate config
function loadConfig(configData: unknown): AgentNetConfig {
  return AgentNetConfigSchema.parse(configData);
}
```

## Code Examples

### Complete Validation Flow

```typescript
import * as z from "zod";

// 1. Define schema
const UserSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  age: z.number().min(13),
  bio: z.string().max(500).optional(),
  tags: z.array(z.string()).max(5).default([]),
});

// 2. Infer type
type User = z.infer<typeof UserSchema>;

// 3. Validate data
function processUser(input: unknown): User {
  const result = UserSchema.safeParse(input);

  if (!result.success) {
    throw new Error(`Validation failed: ${JSON.stringify(result.error.format())}`);
  }

  return result.data;
}

// 4. Usage
try {
  const user = processUser({
    username: "alice",
    email: "alice@example.com",
    age: 25,
    tags: ["developer", "typescript"],
  });

  console.log(user); // Fully typed and validated
} catch (error) {
  console.error(error);
}
```

### Form Validation with Error Mapping

```typescript
import * as z from "zod";

const SignupFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  terms: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms and conditions",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupForm = z.infer<typeof SignupFormSchema>;

interface FormErrors {
  [field: string]: string;
}

function validateSignupForm(data: unknown): { success: true; data: SignupForm } | { success: false; errors: FormErrors } {
  const result = SignupFormSchema.safeParse(data);

  if (!result.success) {
    const errors: FormErrors = {};

    result.error.issues.forEach((issue) => {
      const field = issue.path.join('.');
      if (!errors[field]) {
        errors[field] = issue.message;
      }
    });

    return { success: false, errors };
  }

  return { success: true, data: result.data };
}

// Usage in form handler
const formResult = validateSignupForm({
  email: "user@example.com",
  password: "securepass123",
  confirmPassword: "securepass123",
  terms: true,
});

if (!formResult.success) {
  console.error("Form errors:", formResult.errors);
  // Display errors to user
} else {
  console.log("Valid form data:", formResult.data);
  // Submit form
}
```

### Async Validation Example

```typescript
import * as z from "zod";

// Simulated async database check
async function checkUsernameAvailable(username: string): Promise<boolean> {
  // In real app: await db.users.findOne({ username })
  return username !== "admin";
}

const UserRegistrationSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username cannot exceed 20 characters")
    .refine(async (username) => {
      return await checkUsernameAvailable(username);
    }, {
      message: "Username is already taken",
    }),
  email: z.string().email(),
  password: z.string().min(8),
});

// Must use async parsing
async function registerUser(input: unknown) {
  const result = await UserRegistrationSchema.safeParseAsync(input);

  if (!result.success) {
    return { error: result.error.format() };
  }

  // Proceed with registration
  return { success: true, user: result.data };
}

// Usage
const registration = await registerUser({
  username: "newuser",
  email: "newuser@example.com",
  password: "securepass123",
});
```

### Type-safe API Client

```typescript
import * as z from "zod";

// Define schemas for API responses
const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  followers: z.number(),
});

const AgentListResponseSchema = z.object({
  data: z.array(AgentSchema),
  total: z.number(),
  page: z.number(),
});

type Agent = z.infer<typeof AgentSchema>;
type AgentListResponse = z.infer<typeof AgentListResponseSchema>;

// Type-safe API client
async function fetchAgents(page: number = 1): Promise<AgentListResponse> {
  const response = await fetch(`/api/agents?page=${page}`);
  const json = await response.json();

  // Validate response matches expected schema
  return AgentListResponseSchema.parse(json);
}

// Usage - fully typed without manual type assertions
const agentsData = await fetchAgents(1);
agentsData.data.forEach((agent: Agent) => {
  console.log(`${agent.name} has ${agent.followers} followers`);
});
```

## Sources

- [Zod Official Documentation](https://zod.dev/)
- [Zod Basic Usage](https://zod.dev/basics)
- [Zod API Reference - Defining Schemas](https://zod.dev/api)
- [Zod Error Customization](https://zod.dev/error-customization)
- [Zod Error Formatting](https://zod.dev/error-formatting)
- [Zod GitHub Repository](https://github.com/colinhacks/zod)
- [Zod npm Package](https://www.npmjs.com/package/zod)
- [Schema Validation in TypeScript with Zod - LogRocket](https://blog.logrocket.com/schema-validation-typescript-zod/)
- [A Complete Guide to Zod - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/zod-explained/)
- [Zod: The Ultimate TypeScript-first Schema Validation Library - Medium](https://imrankhani.medium.com/zod-the-ultimate-typescript-first-schema-validation-library-93869bcde880)
- [Master Zod Validation: Schema, Typescript & Documentation - Tecktol](https://tecktol.com/zod-schema-validation-the-complete-guide/)
- [Using the Refine Method in Zod - BasicUtils](https://basicutils.com/learn/zod/zod-refine-custom-validation)
- [Advanced Zod: Designing Complex Validation Schemas - Valentin Prugnaud](https://valentinprugnaud.dev/posts/zod-series/3/advanced-zod-designing-complex-validation-schemas)
- [The Essential Functions of Zod Validation Pipelines - DiDoesDigital](https://didoesdigital.com/blog/zod-essential-functions/)
- [Data Validation with Zod - Mohammad Shehadeh](https://mohammadshehadeh.com/general/data-validation-with-zod/)
