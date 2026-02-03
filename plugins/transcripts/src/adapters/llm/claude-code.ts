/**
 * Claude Code LLM Backend Adapter
 *
 * Uses Claude Code in headless mode for LLM completions.
 * Runs as subprocess with `claude -p "prompt"` - no API costs, uses Max plan.
 *
 * Based on proven pattern from autocommit plugin and extraction adapter.
 */

import { spawn } from "child_process";
import { execSync } from "child_process";
import type {
  LLMBackendPort,
  LLMCapabilities,
  LLMCompletionOptions,
  LLMCompletionResult,
  ModelTier,
} from "../../ports/llm.js";

/**
 * Map model tier to Claude model name
 */
function tierToModel(tier: ModelTier): string {
  switch (tier) {
    case "haiku":
      return "haiku";
    case "sonnet":
      return "sonnet";
    case "opus":
      return "opus";
    default:
      return "sonnet";
  }
}

/**
 * Call Claude Code in headless mode
 */
async function callClaudeCode(
  prompt: string,
  options: {
    model?: ModelTier;
    timeout?: number;
  } = {}
): Promise<{ text: string; processing_time_ms: number }> {
  const { model = "sonnet", timeout = 120000 } = options;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      prompt,
      "--model",
      tierToModel(model),
      "--no-session-persistence",
      "--max-turns",
      "1",
      "--tools",
      "",
      "--setting-sources",
      "",
      "--output-format",
      "text",
    ];

    const proc = spawn("claude", args, {
      // Don't pass ANTHROPIC_API_KEY to ensure Max plan billing
      env: { ...process.env, ANTHROPIC_API_KEY: undefined },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // Provide empty stdin to prevent hanging
    proc.stdin.end();

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Claude Code timeout after ${timeout}ms`));
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);
      const processing_time_ms = Date.now() - startTime;

      if (code === 0) {
        resolve({
          text: stdout.trim(),
          processing_time_ms,
        });
      } else {
        reject(new Error(`Claude Code failed (code ${code}): ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Claude Code LLM Backend
 *
 * Uses Max plan subscription instead of per-token API billing.
 */
export class ClaudeCodeBackend implements LLMBackendPort {
  private defaultModel: ModelTier;

  constructor(defaultModel: ModelTier = "sonnet") {
    this.defaultModel = defaultModel;
  }

  name(): string {
    return "claude-code";
  }

  capabilities(): LLMCapabilities {
    return {
      name: "claude-code",
      models: ["haiku", "sonnet", "opus"],
      max_input_tokens: 128000, // Claude's context window
      max_output_tokens: 8192, // Default max output
      per_token_billing: false, // Uses Max plan
      streaming: false, // Headless mode doesn't stream
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      execSync("which claude", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  async complete(
    prompt: string,
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    const model = options?.model || this.defaultModel;
    const timeout = options?.timeout || 120000;

    // If system prompt provided, prepend it
    const fullPrompt = options?.system_prompt
      ? `${options.system_prompt}\n\n---\n\n${prompt}`
      : prompt;

    const result = await callClaudeCode(fullPrompt, { model, timeout });

    return {
      text: result.text,
      model: `claude-${model}`,
      processing_time_ms: result.processing_time_ms,
      truncated: false,
      // Token counts not available in headless mode
    };
  }
}

/**
 * Create a Claude Code backend instance
 */
export function createClaudeCodeBackend(
  defaultModel: ModelTier = "sonnet"
): ClaudeCodeBackend {
  return new ClaudeCodeBackend(defaultModel);
}
