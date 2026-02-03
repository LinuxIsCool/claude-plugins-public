---
name: commander-cli
description: Commander.js CLI framework documentation for AgentNet
---

# Commander.js CLI Framework

Complete reference for building command-line interfaces with Commander.js, the complete solution for Node.js CLI applications.

## Overview

Commander.js is a library that helps you build command-line interfaces by:
- Parsing arguments into options and command-arguments
- Displaying usage errors for problems
- Implementing a help system automatically
- Supporting subcommands and nested command structures
- Handling both synchronous and asynchronous action handlers

**Current Version**: 14.x (requires Node.js v20+)

## Installation

```bash
npm install commander
```

For enhanced TypeScript support:
```bash
npm install commander @commander-js/extra-typings
```

## Basic Usage

### CommonJS
```javascript
const { Command } = require('commander');
const program = new Command();
```

### ECMAScript Modules
```javascript
import { Command } from 'commander';
const program = new Command();
```

### TypeScript
```typescript
import { Command } from 'commander';
const program = new Command();
```

## Defining Commands

### Main Program
```javascript
const program = new Command();

program
  .name('agentnet')
  .description('CLI for agent network operations')
  .version('1.0.0');
```

### Subcommands
```javascript
// Command with action handler
program
  .command('profile')
  .description('View agent profiles')
  .action((options) => {
    console.log('Showing profiles...');
  });

// Command with required arguments
program
  .command('message <agent>')
  .description('Send message to an agent')
  .action((agent, options) => {
    console.log(`Sending message to ${agent}`);
  });

// Command with optional arguments
program
  .command('post [content]')
  .description('Create a post')
  .action((content, options) => {
    if (content) {
      console.log(`Posting: ${content}`);
    } else {
      // Prompt for content interactively
    }
  });
```

### Stand-alone Executable Subcommands
For larger CLIs, put each subcommand in its own file:

```javascript
// main.js
program
  .command('profile', 'Manage agent profiles'); // Note: description as second arg

// Creates: agentnet-profile.js or agentnet-profile
```

### Nested Subcommands
```javascript
const profile = program
  .command('profile')
  .description('Profile management');

profile
  .command('list')
  .description('List all profiles')
  .action(() => { /* ... */ });

profile
  .command('view <name>')
  .description('View specific profile')
  .action((name) => { /* ... */ });
```

## Options and Flags

### Basic Options
```javascript
program
  .option('-d, --debug', 'enable debug mode')
  .option('-v, --verbose', 'verbose output');
```

### Options with Values
```javascript
// Required value (angle brackets)
program
  .option('-p, --port <number>', 'specify port number')
  .option('-c, --config <path>', 'config file path');

// Optional value (square brackets)
program
  .option('-o, --output [file]', 'output file (default: stdout)');
```

### Options with Default Values
```javascript
program
  .option('-p, --port <number>', 'port number', '3000')
  .option('-h, --host <address>', 'host address', 'localhost');
```

### Required Options
```javascript
program
  .requiredOption('-t, --token <token>', 'authentication token')
  .requiredOption('-u, --user <name>', 'username');
```

### Variadic Options
```javascript
// Multiple values
program
  .option('-a, --agents <names...>', 'agent names');

// Usage: agentnet --agents alice bob charlie
```

### Boolean Negation
```javascript
program
  .option('--no-color', 'disable color output');

// Accessed as: options.color (false when --no-color is passed)
```

### Custom Option Processing
```javascript
function parseInteger(value) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error('Not a number.');
  }
  return parsed;
}

program
  .option('-p, --port <number>', 'port number', parseInteger);
```

## Arguments

### Basic Arguments
```javascript
program
  .command('send')
  .argument('<recipient>', 'message recipient')
  .argument('[message]', 'message content')
  .action((recipient, message) => {
    console.log(`To: ${recipient}, Message: ${message || '(none)'}`);
  });
```

### Variadic Arguments
```javascript
// Must be the last argument
program
  .command('broadcast')
  .argument('<recipients...>', 'one or more recipients')
  .action((recipients) => {
    console.log(`Broadcasting to: ${recipients.join(', ')}`);
  });
```

### Custom Argument Processing
```javascript
program
  .command('delay')
  .argument('<duration>', 'delay in milliseconds', parseFloat)
  .action((duration) => {
    console.log(`Delaying ${duration}ms`);
  });
```

## Action Handlers

### Synchronous Handlers
```javascript
program
  .command('greet <name>')
  .action((name, options) => {
    console.log(`Hello, ${name}!`);
  });

program.parse();
```

### Asynchronous Handlers
Use `parseAsync()` instead of `parse()` for async handlers:

```javascript
program
  .command('fetch <url>')
  .action(async (url, options) => {
    const response = await fetch(url);
    const data = await response.json();
    console.log(data);
  });

// IMPORTANT: Use parseAsync for async handlers
await program.parseAsync(process.argv);
```

### Error Handling
```javascript
program
  .command('risky')
  .action(async (options) => {
    try {
      await riskyOperation();
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Global error handling
program.exitOverride((err) => {
  if (err.code !== 'commander.help') {
    console.error('Error:', err.message);
  }
  process.exit(err.exitCode);
});
```

### Handler Parameters
```javascript
program
  .command('example <required> [optional]')
  .option('-f, --flag', 'a flag')
  .action((required, optional, options, command) => {
    // required: first argument value
    // optional: second argument value (or undefined)
    // options: parsed options object
    // command: the Command object
    console.log('Required:', required);
    console.log('Optional:', optional);
    console.log('Flag:', options.flag);
    console.log('Command name:', command.name());
  });
```

## TypeScript Integration

### Basic TypeScript Usage
```typescript
import { Command } from 'commander';

const program = new Command();

program
  .name('agentnet')
  .version('1.0.0')
  .description('Agent network CLI');

program.parse();
```

### Enhanced Type Safety with extra-typings
```typescript
import { Command } from '@commander-js/extra-typings';

const program = new Command()
  .option('-p, --port <number>', 'port number')
  .option('-d, --debug', 'enable debug');

// TypeScript infers the correct types
const options = program.opts();
// options.port: string | undefined
// options.debug: boolean | undefined
```

### Typed Options Interface
```typescript
import { Command } from 'commander';

interface ProfileOptions {
  verbose?: boolean;
  format?: string;
}

const program = new Command();

program
  .command('profile')
  .option('-v, --verbose', 'verbose output')
  .option('-f, --format <type>', 'output format')
  .action((options: ProfileOptions) => {
    if (options.verbose) {
      console.log('Verbose mode enabled');
    }
    console.log(`Format: ${options.format || 'default'}`);
  });
```

### Ambient Module for extra-typings
```typescript
// commander.d.ts
declare module "commander" {
  export * from "@commander-js/extra-typings";
}
```

Now import from 'commander' and get enhanced typings automatically.

### Organizing Commands in Separate Files
```typescript
// commands/profile.ts
import { Command } from 'commander';

export function createProfileCommand(): Command {
  return new Command('profile')
    .description('Manage agent profiles')
    .option('-v, --verbose', 'verbose output')
    .action((options) => {
      // Implementation
    });
}

// main.ts
import { Command } from 'commander';
import { createProfileCommand } from './commands/profile';

const program = new Command();
program.addCommand(createProfileCommand());
program.parse();
```

## Interactive CLI Patterns

### Integration with Inquirer.js
Combine Commander for argument parsing with Inquirer for interactive prompts:

```javascript
import { Command } from 'commander';
import inquirer from 'inquirer';

const program = new Command();

program
  .command('create')
  .description('Create a new agent profile')
  .action(async () => {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Agent name:',
        validate: (input) => input.length > 0
      },
      {
        type: 'list',
        name: 'model',
        message: 'Select model:',
        choices: ['opus', 'sonnet', 'haiku']
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Create this profile?',
        default: true
      }
    ]);

    if (answers.confirm) {
      console.log(`Creating profile: ${answers.name} (${answers.model})`);
    }
  });

await program.parseAsync();
```

### Interactive Commander (Drop-in Replacement)
Use `node-interactive-commander` for automatic prompts:

```javascript
import { Command } from 'interactive-commander';

const program = new Command();

program
  .command('deploy')
  .option('-e, --environment <env>', 'environment')
  .option('-t, --token <token>', 'auth token')
  .action(async (options) => {
    // If options are missing, user is prompted automatically
    console.log(`Deploying to ${options.environment}`);
  });

await program.parseAsync();
```

### Combining with TUI (blessed)
```javascript
import { Command } from 'commander';
import blessed from 'neo-neo-blessed';

const program = new Command();

program
  .command('ui')
  .description('Launch interactive TUI')
  .action(() => {
    const screen = blessed.screen({
      smartCSR: true,
      title: 'AgentNet'
    });

    const box = blessed.box({
      top: 'center',
      left: 'center',
      width: '50%',
      height: '50%',
      content: 'Press q to quit',
      border: { type: 'line' },
      style: {
        border: { fg: 'blue' }
      }
    });

    screen.append(box);
    screen.key(['q', 'C-c'], () => process.exit(0));
    screen.render();
  });

program
  .command('list')
  .description('List agents (CLI mode)')
  .action(() => {
    console.log('Agent 1\nAgent 2\nAgent 3');
  });

program.parse();
```

## Advanced Features

### Help Customization
```javascript
program
  .addHelpText('beforeAll', 'AgentNet - Agent Network CLI\n')
  .addHelpText('afterAll', '\nFor more info: https://example.com/docs');

// Custom help command
program
  .helpCommand('help [command]', 'display help for command');
```

### Option Groups (Commander 14+)
```javascript
program
  .optionsGroup('Database Options:')
  .option('--db-host <host>', 'database host')
  .option('--db-port <port>', 'database port')
  .optionsGroup('Logging Options:')
  .option('--log-level <level>', 'log level')
  .option('--log-file <file>', 'log file path');
```

### Positional Options
```javascript
// Only process options before subcommands
program.enablePositionalOptions();

// Pass-through options after arguments
program.passThroughOptions();

// Allows: agentnet command arg1 arg2 --flag-for-another-program
```

### Hook Events
```javascript
program
  .hook('preAction', (thisCommand, actionCommand) => {
    console.log(`About to execute: ${actionCommand.name()}`);
  })
  .hook('postAction', (thisCommand, actionCommand) => {
    console.log(`Finished executing: ${actionCommand.name()}`);
  });
```

### Version from package.json
```javascript
import { readFileSync } from 'fs';
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

program.version(packageJson.version);
```

## Code Examples

### Complete CLI Application
```typescript
import { Command } from 'commander';
import chalk from 'chalk';

interface GlobalOptions {
  config?: string;
  verbose?: boolean;
}

const program = new Command();

program
  .name('agentnet')
  .description('Agent network management CLI')
  .version('1.0.0')
  .option('-c, --config <path>', 'config file path')
  .option('-v, --verbose', 'verbose output');

// List command
program
  .command('list')
  .description('List all agents')
  .option('-f, --format <type>', 'output format', 'table')
  .action(async (options) => {
    const global = program.opts<GlobalOptions>();
    if (global.verbose) {
      console.log(chalk.gray('Loading agents...'));
    }

    const agents = await loadAgents(global.config);
    displayAgents(agents, options.format);
  });

// Profile command
program
  .command('profile')
  .description('Manage agent profiles')
  .argument('<name>', 'agent name')
  .option('-e, --edit', 'edit profile')
  .action(async (name, options) => {
    if (options.edit) {
      await editProfile(name);
    } else {
      const profile = await loadProfile(name);
      console.log(chalk.bold(profile.name));
      console.log(profile.description);
    }
  });

// Message command
program
  .command('message')
  .description('Send message to agent')
  .argument('<recipient>', 'recipient agent')
  .argument('[message]', 'message content')
  .option('-f, --file <path>', 'message from file')
  .action(async (recipient, message, options) => {
    const content = options.file
      ? await readFile(options.file, 'utf8')
      : message;

    if (!content) {
      console.error(chalk.red('Error: No message provided'));
      process.exit(1);
    }

    await sendMessage(recipient, content);
    console.log(chalk.green(`Message sent to ${recipient}`));
  });

// Parse arguments
await program.parseAsync(process.argv);
```

### Multi-Command with Shared State
```typescript
import { Command } from 'commander';

class AgentNetCLI {
  private config: Config;

  constructor() {
    this.config = loadConfig();
  }

  createProgram(): Command {
    const program = new Command();

    program
      .name('agentnet')
      .version('1.0.0');

    program
      .command('status')
      .action(() => this.showStatus());

    program
      .command('deploy')
      .action(async () => await this.deploy());

    return program;
  }

  private showStatus(): void {
    console.log(`Config: ${this.config.path}`);
    console.log(`Status: ${this.config.status}`);
  }

  private async deploy(): Promise<void> {
    console.log('Deploying with config:', this.config);
    // Deployment logic
  }
}

const cli = new AgentNetCLI();
const program = cli.createProgram();
await program.parseAsync();
```

## Common Patterns

### Check if Command Executed
```javascript
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
```

### Fallback to Interactive Mode
```javascript
program
  .command('interactive')
  .description('Interactive mode')
  .action(async () => {
    // Launch TUI or inquirer prompts
  });

// If no command specified, launch interactive mode
if (process.argv.length === 2) {
  program.parse(['', '', 'interactive']);
} else {
  program.parse();
}
```

### Environment-aware Defaults
```javascript
program
  .option('-e, --env <environment>', 'environment', process.env.NODE_ENV || 'development')
  .option('--api-url <url>', 'API URL', process.env.API_URL || 'http://localhost:3000');
```

## Sources

- [Commander.js npm Package](https://www.npmjs.com/package/commander)
- [Commander.js GitHub Repository](https://github.com/tj/commander.js)
- [Commander.js API Documentation (jsDocs.io)](https://www.jsdocs.io/package/commander)
- [Commander.js extra-typings Package](https://www.npmjs.com/package/@commander-js/extra-typings)
- [Commander.js extra-typings GitHub](https://github.com/commander-js/extra-typings)
- [Building a TypeScript CLI with Node.js and Commander - LogRocket](https://blog.logrocket.com/building-typescript-cli-node-js-commander/)
- [The Definitive Guide to Commander.js - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/commander-explained/)
- [Mastering Commander.js with TypeScript - xjavascript.com](https://www.xjavascript.com/blog/commander-js-typescript/)
- [Inquirer.js GitHub Repository](https://github.com/SBoudrias/Inquirer.js)
- [Interactive Commander GitHub](https://github.com/fardjad/node-interactive-commander)
- [How To Create Interactive Command-line Prompts with Inquirer.js - DigitalOcean](https://www.digitalocean.com/community/tutorials/nodejs-interactive-command-line-prompts)
- [Building a CLI with Commander and Inquirer - Medium](https://medium.com/swlh/how-to-prototype-a-cli-using-commanderjs-and-inquirerjs-in-less-than-3-hours-6d5f0d1b9725)
