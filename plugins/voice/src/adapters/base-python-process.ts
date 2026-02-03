/**
 * Base Python Process Adapter
 *
 * Generic base class for adapters that communicate with Python servers
 * via JSON-RPC over stdin/stdout. Provides:
 * - Persistent process management (spawn, health check, restart)
 * - JSON-RPC 2.0 protocol handling
 * - Request/response correlation with timeouts
 * - Output buffer line-by-line parsing
 * - Ready signal detection
 * - Error recovery on process crash
 *
 * Usage:
 *   class MyAdapter extends BasePythonProcessAdapter<MyConfig> {
 *     protected getServerScriptPath() { return join(__dirname, "server.py"); }
 *     protected getServerArgs() { return ["--device", this.config.device]; }
 *   }
 */

import { spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/**
 * JSON-RPC 2.0 Request
 */
export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 2.0 Response
 */
export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  method?: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Base configuration for Python process adapters
 */
export interface BasePythonProcessConfig {
  /** Python interpreter path. Default: ~/.venvs/ml/bin/python */
  pythonPath?: string;
  /** Device for inference. Default: auto (uses CUDA if available) */
  device?: "cuda" | "cpu" | "auto";
  /** Request timeout in ms. Default: 30000 */
  requestTimeout?: number;
  /** Process startup timeout in ms. Default: 60000 (model loading is slow) */
  startupTimeout?: number;
}

/**
 * Default configuration
 */
const DEFAULT_BASE_CONFIG: Required<BasePythonProcessConfig> = {
  pythonPath: join(homedir(), ".venvs/ml/bin/python"),
  device: "auto",
  requestTimeout: 30000,
  startupTimeout: 60000,
};

/**
 * Pending RPC request entry
 */
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Maximum output buffer size (1MB) to prevent unbounded growth
 */
const MAX_OUTPUT_BUFFER_SIZE = 1024 * 1024;

/**
 * Get cuDNN library path for GPU support
 */
export function getCudnnLibPath(): string {
  const venvPath = join(homedir(), ".venvs/ml");
  return join(venvPath, "lib/python3.11/site-packages/nvidia/cudnn/lib");
}

/**
 * Base class for Python process adapters
 *
 * Subclasses must implement:
 * - getServerScriptPath(): Path to the Python server script
 * - getServerArgs(): Command line arguments for the server
 * - getPythonEnv() (optional): Additional environment variables
 */
export abstract class BasePythonProcessAdapter<TConfig extends BasePythonProcessConfig> {
  protected config: TConfig & Required<BasePythonProcessConfig>;
  protected pythonProcess: ChildProcess | null = null;
  protected ready = false;
  protected requestId = 0;
  protected pendingRequests = new Map<string | number, PendingRequest>();
  protected outputBuffer = "";
  protected deviceInfo: string | null = null;
  private adapterName: string;

  constructor(config: TConfig | undefined, defaults: TConfig, adapterName: string) {
    this.config = { ...DEFAULT_BASE_CONFIG, ...defaults, ...config } as TConfig & Required<BasePythonProcessConfig>;
    this.adapterName = adapterName;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Abstract methods - must be implemented by subclasses
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get path to the Python server script
   */
  protected abstract getServerScriptPath(): string;

  /**
   * Get command line arguments for the Python server
   */
  protected abstract getServerArgs(): string[];

  /**
   * Get additional environment variables for the Python process
   * Override to add adapter-specific environment setup
   */
  protected getPythonEnv(): Record<string, string> {
    return {};
  }

  /**
   * Validate Python environment (check required packages)
   * Override to add adapter-specific checks
   */
  protected async validatePythonEnv(): Promise<boolean> {
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if Python and required packages are available
   */
  async isProcessAvailable(): Promise<boolean> {
    // Check Python path exists
    if (!existsSync(this.config.pythonPath)) {
      console.error(`[${this.adapterName}] Python not found: ${this.config.pythonPath}`);
      return false;
    }

    // Check adapter-specific requirements
    if (!(await this.validatePythonEnv())) {
      return false;
    }

    // Check CUDA availability (optional, will fall back to CPU)
    try {
      const deviceResult = await this.runQuickCommand([
        "-c",
        "import torch; print('cuda' if torch.cuda.is_available() else 'cpu')",
      ]);
      this.deviceInfo = deviceResult.trim();
      if (this.deviceInfo === "cpu" && this.config.device === "cuda") {
        console.error(`[${this.adapterName}] CUDA requested but not available`);
        return false;
      }
    } catch {
      this.deviceInfo = "cpu";
    }

    return true;
  }

  /**
   * Get detected device info
   */
  getDeviceInfo(): string | null {
    return this.deviceInfo;
  }

  /**
   * Check if process is running and ready
   */
  isReady(): boolean {
    return this.pythonProcess !== null && this.ready;
  }

  /**
   * Shutdown the Python process
   */
  async shutdown(): Promise<void> {
    if (this.pythonProcess) {
      try {
        await this.callRPC("shutdown", {});
      } catch {
        // Ignore shutdown errors
      }
      this.pythonProcess.kill();
      this.pythonProcess = null;
      this.ready = false;

      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Process shutdown"));
        this.pendingRequests.delete(id);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Protected methods - available to subclasses
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Ensure the Python process is running and ready
   */
  protected async ensureProcess(): Promise<void> {
    if (this.pythonProcess && this.ready) {
      return;
    }

    await this.startProcess();
  }

  /**
   * Call a JSON-RPC method on the Python server
   */
  protected callRPC<T>(method: string, params: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.pythonProcess || !this.ready) {
        reject(new Error("Process not ready"));
        return;
      }

      const id = ++this.requestId;
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.config.requestTimeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      this.pythonProcess.stdin!.write(JSON.stringify(request) + "\n");
    });
  }

  /**
   * Run a quick Python command (for availability checks)
   */
  protected runQuickCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.config.pythonPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Start the Python inference server
   */
  private async startProcess(): Promise<void> {
    const scriptPath = this.getServerScriptPath();

    if (!existsSync(scriptPath)) {
      throw new Error(`Server script not found: ${scriptPath}`);
    }

    // Set up environment with cuDNN libs for GPU support
    const cudnnPath = getCudnnLibPath();
    const adapterEnv = this.getPythonEnv();
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      LD_LIBRARY_PATH: cudnnPath + (process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ""),
      ...adapterEnv,
    };

    const args = [scriptPath, ...this.getServerArgs()];

    try {
      // Spawn Python process
      this.pythonProcess = spawn(this.config.pythonPath, args, {
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Handle stdout (JSON-RPC responses)
      this.pythonProcess.stdout!.on("data", (data) => {
        this.handleStdout(data.toString());
      });

      // Handle stderr (logs)
      this.pythonProcess.stderr!.on("data", (data) => {
        console.error(`[${this.adapterName}] ${data.toString().trim()}`);
      });

      // Handle process exit
      this.pythonProcess.on("exit", (code) => {
        console.error(`[${this.adapterName}] Process exited with code ${code}`);
        this.ready = false;
        this.pythonProcess = null;
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(new Error(`Process exited with code ${code}`));
          this.pendingRequests.delete(id);
        }
      });

      // Wait for ready signal
      await this.waitForReady();
    } catch (error) {
      // Clean up process on startup failure
      if (this.pythonProcess) {
        this.pythonProcess.kill();
        this.pythonProcess = null;
      }
      this.ready = false;
      throw error;
    }
  }

  /**
   * Wait for the server to signal it's ready
   */
  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Server startup timeout"));
      }, this.config.startupTimeout);

      const checkReady = () => {
        // Check if process died during startup
        if (this.pythonProcess === null && !this.ready) {
          clearTimeout(timeout);
          reject(new Error("Process died during startup"));
          return;
        }

        if (this.ready && this.pythonProcess !== null) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }

  /**
   * Handle stdout data from Python process
   */
  private handleStdout(data: string): void {
    this.outputBuffer += data;

    // Prevent unbounded buffer growth (e.g., malformed output without newlines)
    if (this.outputBuffer.length > MAX_OUTPUT_BUFFER_SIZE) {
      console.error(`[${this.adapterName}] Output buffer overflow (>${MAX_OUTPUT_BUFFER_SIZE} bytes), clearing`);
      this.outputBuffer = "";
      return;
    }

    // Process complete lines
    const lines = this.outputBuffer.split("\n");
    this.outputBuffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const response: JSONRPCResponse = JSON.parse(line);

        // Check for ready signal
        if (response.method === "ready") {
          this.ready = true;
          continue;
        }

        // Match response to pending request
        if (response.id !== null && this.pendingRequests.has(response.id)) {
          const pending = this.pendingRequests.get(response.id)!;
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(response.id);

          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch (e) {
        console.error(`[${this.adapterName}] Failed to parse response: ${line}`);
      }
    }
  }
}
