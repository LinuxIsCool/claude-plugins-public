---
name: bun-runtime
description: Bun runtime documentation for AgentNet development
---

# Bun Runtime

## Overview

Bun is an all-in-one toolkit for JavaScript and TypeScript applications. It ships as a single executable called `bun`. At its core is the Bun runtime, a fast JavaScript runtime designed as a drop-in replacement for Node.js. Written in Zig and powered by JavaScriptCore (instead of V8), Bun dramatically reduces startup times and memory usage.

**Key Features:**
- Native TypeScript, JSX, React, and CSS import support
- Built-in package manager, bundler, and test runner
- Drop-in replacement for Node.js with near-100% API compatibility
- Significantly faster startup times (6ms vs 170ms for npm scripts)
- Fast native transpiler for on-the-fly TypeScript execution

**Philosophy Difference:** Unlike Node.js which provides npm and leaves tooling to third parties, Bun ships with a complete toolkit (package manager, bundler, test runner) built-in. This means fewer configuration files and faster onboarding, but less flexibility for highly customized build pipelines.

## TypeScript Support

Bun can directly execute `.ts` and `.tsx` files just like vanilla JavaScript, with no extra configuration needed.

**How It Works:**
- Every file Bun executes (both `.js` and `.ts`) is transpiled internally before execution
- No typechecking is performed (use `tsc` for static type checking)
- The overhead of executing `.ts/.tsx` source files directly in production is negligible
- TSConfig path mappings (`compilerOptions.paths`) are respected by Bun's runtime—no other runtime does this

**Example:**
```typescript
// app.ts
const message: string = "Hello from Bun!";
console.log(message);
```

```bash
# Run directly without compilation
bun app.ts
```

**Transpilation Notes:**
- Files are transpiled on-the-fly by Bun's fast native transpiler
- You may not need to transpile TypeScript for production deployment
- Bun transpiles every file it executes internally

## File I/O

Bun provides heavily optimized file I/O through `Bun.file()` and `Bun.write()` APIs.

### Core APIs

**Creating a BunFile:**
```typescript
const file = Bun.file("./data.txt");
```

A `BunFile` represents a lazily-loaded file—initializing it doesn't read from disk. It's powered by the fastest system calls available for file operations.

**Reading File Contents:**
```typescript
const file = Bun.file("./data.json");

// Various read formats
const text = await file.text();           // String
const json = await file.json();           // Parsed JSON
const buffer = await file.arrayBuffer();  // ArrayBuffer
const bytes = await file.bytes();         // Uint8Array
const stream = file.stream();             // ReadableStream
```

**Writing Files:**
```typescript
// Simple write
await Bun.write("./output.txt", "Hello World");

// Write various formats
await Bun.write("./data.json", { key: "value" });
await Bun.write("./binary.bin", new Uint8Array([1, 2, 3]));
```

### Incremental Writing with FileSink

For streaming writes, use `FileSink`:

```typescript
const file = Bun.file("./log.txt");
const writer = file.writer();

// Write incrementally
writer.write("Line 1\n");
writer.write("Line 2\n");

// Auto-flushes when buffer is full
// Manually flush and close
await writer.end();
```

Configuration:
```typescript
const writer = file.writer({
  highWaterMark: 1024 * 1024  // 1MB buffer
});
```

The process stays alive until `.end()` is called explicitly.

### File Metadata

```typescript
const file = Bun.file("./data.txt");

// Auto-detected from extension
console.log(file.type);  // MIME type

// Size available after first read
console.log(file.size);

// Check existence (only for files/FIFOs, not directories)
const exists = await file.exists();
```

**Best Practice:** Instead of checking existence then operating, just perform the operation and handle errors—it's faster.

### Directory Operations

For operations not yet available with `Bun.file` (like `mkdir`, `readdir`), use Node.js APIs:

```typescript
import { readdir, mkdir } from "node:fs/promises";

const files = await readdir("./directory");
await mkdir("./new-dir", { recursive: true });
```

## Process Management

Bun provides process spawning through `Bun.spawn()` and `Bun.spawnSync()`.

### Spawning Processes

**Basic Usage:**
```typescript
const proc = Bun.spawn(["echo", "hello"]);
const output = await proc.stdout.text();
console.log(output);  // "hello"
```

**Synchronous Spawn:**
```typescript
const result = Bun.spawnSync(["ls", "-la"]);
console.log(result.stdout.toString());
```

### stdio Configuration

The `stdio` option controls standard file descriptors `[stdin, stdout, stderr]`:

**stdin Options:**
- `"ignore"` / `null` / `undefined`: No input (default)
- `"pipe"`: New FileSink for input
- `"inherit"`: Inherit from parent process
- `ArrayBufferView`, `Blob`, `Bun.file()`, `Response`, `Request`: Read from buffer/stream

**stdout/stderr Options:**
- `"pipe"`: Capture as ReadableStream (default)
- `"inherit"`: Output to parent's stdout/stderr
- `"ignore"`: Discard output
- `Bun.file()`: Write to file

**Example:**
```typescript
const proc = Bun.spawn(["node", "script.js"], {
  stdin: "pipe",
  stdout: "pipe",
  stderr: "inherit"
});

// Write to stdin
proc.stdin.write("input data\n");
proc.stdin.end();

// Read stdout
const output = await proc.stdout.text();
```

**Important:** stdio may keep the parent process alive. Use `stdio: ["ignore", "ignore", "ignore"]` to prevent this.

### Reading Output

Output types differ from Node.js and Deno:
- Node.js returns strings
- Deno returns `Uint8Array`
- Bun returns `ReadableStream`

```typescript
const proc = Bun.spawn(["cat", "file.txt"]);

// Various read methods
const text = await proc.stdout.text();
const buffer = await proc.stdout.arrayBuffer();
const json = await proc.stdout.json();
```

### Inter-Process Communication (IPC)

Direct IPC channel between Bun processes:

```typescript
// Parent process
const proc = Bun.spawn(["bun", "child.js"], {
  ipc: (message) => {
    console.log("Received:", message);
  }
});

proc.send({ type: "command", data: "value" });

// Child process
process.on("message", (msg) => {
  console.log("Child received:", msg);
  process.send({ response: "acknowledged" });
});
```

Messages are serialized using JSC serialize API (same types as `postMessage`/`structuredClone`).

### Process Control

**Detached Processes:**
```typescript
const proc = Bun.spawn(["long-running-task"], {
  detached: true  // Runs in separate process group
});
```

On POSIX, calls `setsid()` so the child becomes process group leader and can outlive the parent.

**Abort Signal:**
```typescript
const controller = new AbortController();

const proc = Bun.spawn(["slow-task"], {
  signal: controller.signal,
  killSignal: "SIGTERM"  // default
});

// Later: abort the process
controller.abort();
```

**Max Buffer (spawnSync only):**
```typescript
const result = Bun.spawnSync(["generate-output"], {
  maxBuffer: 1024 * 1024  // Kill if output exceeds 1MB
});
```

## Node.js Compatibility

Bun aims for 100% Node.js API compatibility. Popular frameworks like Next.js, Express, and millions of npm packages work with Bun out of the box.

**Compatibility Testing:** Bun runs thousands of tests from Node.js's test suite before every release. If a package works in Node.js but not in Bun, it's considered a bug in Bun. Current compatibility targets Node.js v23.

### Fully Implemented APIs

Many core modules are fully or nearly fully implemented:
- Event emitters (100% test suite passing)
- File system APIs (node:fs)
- HTTP/HTTPS (node:http, node:https)
- Path utilities (node:path)
- Crypto (node:crypto)
- Streams (node:stream)
- Buffer (node:buffer)

**Recent Additions (Bun 1.2):**
- `node:http2` for HTTP/2 and gRPC servers
- `node:cluster` for spawning multiple Bun instances
- `node:dgram` for UDP sockets

### Partially Implemented APIs

**Process Module:**
- Mostly implemented
- `process.binding` partially implemented
- `process.title` is a no-op on macOS/Linux
- `getActiveResourcesInfo`, `setActiveResourcesInfo`, `getActiveResources`, `setSourceMapsEnabled` are stubs
- Missing: `process.loadEnvFile`, `process.getBuiltinModule`

**V8 Module:**
- `writeHeapSnapshot` and `getHeapSnapshot` implemented
- `serialize`/`deserialize` use JavaScriptCore wire format (not V8's)
- Other methods not implemented
- For profiling, use `bun:jsc` instead

**VM Module:**
- Core functionality and ES modules implemented
- Supported: `vm.Script`, `vm.createContext`, `vm.runInContext`, `vm.runInNewContext`, `vm.runInThisContext`, `vm.compileFunction`, `vm.isContext`, `vm.Module`, `vm.SourceTextModule`, `vm.SyntheticModule`
- `timeout` and `breakOnSigint` options fully supported
- Missing: `vm.measureMemory`, some `cachedData` functionality

**Worker Threads:**
- Core functionality implemented
- Missing options: `stdin`, `stdout`, `stderr`, `trackedUnmanagedFds`, `resourceLimits`
- Missing methods: `markAsUntransferable`, `moveMessagePortToContext`, `getHeapSnapshot`

### Child Process Module

Bun supports Node.js `child_process` module alongside native `Bun.spawn`:

```typescript
import { spawn, exec, execFile } from "node:child_process";

const proc = spawn("ls", ["-la"]);
proc.stdout.on("data", (data) => {
  console.log(data.toString());
});
```

The `stdio` property is a sparse array: `subprocess.stdio[0]` (stdin), `subprocess.stdio[1]` (stdout), `subprocess.stdio[2]` (stderr).

### Limitations and Differences

**Native Modules:**
- Popular frameworks (Next.js, Express, Prisma) work
- Some native add-ons and less-maintained packages may fail
- Bun is still developing native module compatibility

**Security:**
- Bun lacks a permissions model and sandboxing (unlike Deno)
- Security features are still developing
- Future security audits planned

**Performance Trade-offs:**
- Much faster startup and execution for standard workloads
- Express can serve 3x more HTTP requests in Bun vs Node.js
- Simple HTTP servers: 100K+ req/s (Bun) vs 25-30K req/s (Node.js)
- WebSocket message throughput is demonstrably higher

**Recommendation:** If you rely on obscure database drivers or enterprise auth SDKs, stick to Node.js today. For modern stacks built on standard Web APIs, Bun coverage is already solid.

## Package Management

Bun includes a superfast, Node.js-compatible package manager.

### Installing Dependencies

```bash
# Install from package.json
bun install

# Add packages
bun add express
bun add -d typescript

# Remove packages
bun remove express
```

**Performance:** Bun's package manager is significantly faster than npm, pnpm, and yarn.

### Workspaces

Workspaces are supported out of the box:

```json
{
  "name": "my-monorepo",
  "workspaces": ["packages/*"]
}
```

Bun reads the `workspaces` key from `package.json` and installs all workspace packages in a single pass.

### Monorepo Scripts

Execute scripts across multiple packages:

```bash
# Run script in packages matching pattern
bun run --filter "api-*" build

# Run in all packages
bun run --filter "*" test
```

### Package.json Features

- Supports comments and trailing commas
- Configure main fields lookup (target-dependent defaults)
- Lifecycle hooks respected (pre/post scripts)

## Build and Run

### Running Scripts

**Execute Package Scripts:**
```bash
# Long form
bun run start

# Short form (if no built-in command conflicts)
bun start
```

**Performance:** Startup time is 6ms (Bun) vs 170ms (npm) on Linux.

**Lifecycle Hooks:**
Bun respects `pre<script>` and `post<script>` hooks:

```json
{
  "scripts": {
    "preclean": "echo 'Before clean'",
    "clean": "rm -rf dist",
    "postclean": "echo 'After clean'"
  }
}
```

Running `bun run clean` executes all three scripts in order. If `preclean` fails, `clean` won't execute.

### Building

**Bundle and Minify:**
```bash
# Production build
bun build ./index.ts --production

# HTML entry point
bun build ./index.html --production
```

Tree-shaking, minification, and code splitting work out of the box.

**Standalone Executables:**
```bash
# Build standalone binary
bun build --compile ./cli.ts --outfile mycli

# Cross-compile for other platforms
bun build --compile --target linux-x64 ./app.ts
```

**Configuration (Bun v1.3.4+):**
Executables built with `--compile` skip loading `tsconfig.json` and `package.json` from the filesystem at runtime by default (improves startup and prevents unexpected behavior).

Opt back in if needed:
```bash
bun build --compile --compile-autoload-tsconfig --compile-autoload-package-json ./app.ts
```

Or via API:
```typescript
await Bun.build({
  entrypoints: ["./app.ts"],
  compile: true,
  autoloadTsconfig: true,
  autoloadPackageJson: true
});
```

### The --bun Flag

Override Node.js execution behavior:

```bash
# Run Node.js CLI with Bun runtime
bun --bun some-node-cli command
```

This runs the CLI with Bun's runtime instead of Node.js, providing speed improvements.

## Sources

- [Bun Official Website](https://bun.com/)
- [Bun Runtime Documentation](https://bun.com/docs/runtime)
- [TypeScript Runtime Documentation](https://bun.sh/docs/runtime/typescript)
- [File I/O Documentation](https://bun.com/docs/runtime/file-io)
- [Spawn/Child Process Documentation](https://bun.com/docs/runtime/child-process)
- [Node.js Compatibility Guide](https://bun.com/docs/runtime/nodejs-compat)
- [Bun Package Manager](https://bun.com/package-manager)
- [Bun vs Node.js Performance Comparison (Strapi)](https://strapi.io/blog/bun-vs-nodejs-performance-comparison-guide)
- [Node.js vs Deno vs Bun Comparison (Better Stack)](https://betterstack.com/community/guides/scaling-nodejs/nodejs-vs-deno-vs-bun/)
- [Bun 1.2 Compatibility Improvements (InfoWorld)](https://www.infoworld.com/article/3809862/bun-1-2-squashes-node-js-compatibility-bugs.html)
- [Bun v1.3.4 Release Notes](https://bun.sh/blog/bun-v1.3.4)
- [Bun API Reference - spawn](https://bun.com/reference/bun/spawn)
- [Bun API Reference - file](https://bun.com/reference/bun/file)
