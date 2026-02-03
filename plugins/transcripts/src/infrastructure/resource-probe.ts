/**
 * Resource Probe - Concrete Computing Approach
 *
 * Philosophy: Even with abundant resources, treat them as precious.
 * Always probe before committing. Start small. Learn first.
 *
 * "Sometimes we worked with systems that had like only 128KB of Memory.
 *  So just because we have 12GB doesn't mean we have to use it all at once."
 */

import { execSync } from 'child_process';

// --- Types ---

export interface MemoryState {
  ram: {
    total_gb: number;
    used_gb: number;
    available_gb: number;
    percent_used: number;
  };
  swap: {
    total_gb: number;
    used_gb: number;
    free_gb: number;
    percent_used: number;
    is_critical: boolean;  // >90% is critical
  };
  gpu: {
    available: boolean;
    total_mb: number;
    used_mb: number;
    free_mb: number;
    percent_used: number;
  } | null;
}

export interface ResourceBudget {
  max_ram_gb: number;
  max_gpu_mb: number;
  safety_margin: number;  // 0.0 - 1.0, how much headroom to leave
}

export interface ModelRequirements {
  name: string;
  ram_gb: number;      // RAM needed during loading
  vram_mb: number;     // GPU memory for inference
  disk_gb: number;     // Model file size
}

export interface CanRunResult {
  can_run: boolean;
  reason: string;
  warnings: string[];
  recommendations: string[];
}

// --- Model Size Database ---
// Based on research: actual measured requirements

export const MODEL_REQUIREMENTS: Record<string, ModelRequirements> = {
  // Whisper models (loading requires ~2x model size in RAM)
  'whisper-tiny': { name: 'Whisper Tiny', ram_gb: 0.2, vram_mb: 400, disk_gb: 0.039 },
  'whisper-base': { name: 'Whisper Base', ram_gb: 0.3, vram_mb: 500, disk_gb: 0.074 },
  'whisper-small': { name: 'Whisper Small', ram_gb: 1.0, vram_mb: 1000, disk_gb: 0.244 },
  'whisper-medium': { name: 'Whisper Medium', ram_gb: 2.5, vram_mb: 2500, disk_gb: 0.769 },
  'whisper-large': { name: 'Whisper Large', ram_gb: 5.0, vram_mb: 5000, disk_gb: 1.5 },
  'whisper-large-v3': { name: 'Whisper Large v3', ram_gb: 5.0, vram_mb: 5000, disk_gb: 1.5 },

  // faster-whisper with int8 quantization (much more efficient)
  'faster-whisper-tiny': { name: 'faster-whisper Tiny', ram_gb: 0.15, vram_mb: 300, disk_gb: 0.039 },
  'faster-whisper-base': { name: 'faster-whisper Base', ram_gb: 0.25, vram_mb: 400, disk_gb: 0.074 },
  'faster-whisper-small': { name: 'faster-whisper Small', ram_gb: 0.6, vram_mb: 700, disk_gb: 0.244 },
  'faster-whisper-medium': { name: 'faster-whisper Medium', ram_gb: 1.5, vram_mb: 1500, disk_gb: 0.769 },
  'faster-whisper-large-int8': { name: 'faster-whisper Large (int8)', ram_gb: 2.5, vram_mb: 3000, disk_gb: 0.8 },

  // Vosk - very lightweight
  'vosk-small': { name: 'Vosk Small', ram_gb: 0.05, vram_mb: 0, disk_gb: 0.05 },
  'vosk-large': { name: 'Vosk Large', ram_gb: 0.3, vram_mb: 0, disk_gb: 1.8 },

  // SenseVoice - efficient
  'sensevoice-small': { name: 'SenseVoice Small', ram_gb: 0.5, vram_mb: 500, disk_gb: 0.2 },

  // Diarization models
  'pyannote-3.1': { name: 'pyannote 3.1', ram_gb: 1.0, vram_mb: 2000, disk_gb: 0.3 },
};

// --- Probing Functions ---

/**
 * Get current memory state by probing the system
 */
export function probeMemoryState(): MemoryState {
  // Parse free -b output
  const freeOutput = execSync('free -b').toString();
  const memLine = freeOutput.split('\n')[1].split(/\s+/);
  const swapLine = freeOutput.split('\n')[2].split(/\s+/);

  const toGB = (bytes: string) => parseInt(bytes) / (1024 ** 3);

  const ramTotal = toGB(memLine[1]);
  const ramUsed = toGB(memLine[2]);
  const ramAvailable = toGB(memLine[6]);

  const swapTotal = toGB(swapLine[1]);
  const swapUsed = toGB(swapLine[2]);
  const swapFree = toGB(swapLine[3]);

  // Probe GPU if available
  let gpu = null;
  try {
    const nvidiaSmi = execSync(
      'nvidia-smi --query-gpu=memory.total,memory.used,memory.free --format=csv,noheader,nounits'
    ).toString().trim();
    const [total, used, free] = nvidiaSmi.split(',').map(s => parseInt(s.trim()));
    gpu = {
      available: true,
      total_mb: total,
      used_mb: used,
      free_mb: free,
      percent_used: (used / total) * 100,
    };
  } catch {
    // No GPU or nvidia-smi not available
  }

  const swapPercentUsed = swapTotal > 0 ? (swapUsed / swapTotal) * 100 : 0;

  return {
    ram: {
      total_gb: ramTotal,
      used_gb: ramUsed,
      available_gb: ramAvailable,
      percent_used: (ramUsed / ramTotal) * 100,
    },
    swap: {
      total_gb: swapTotal,
      used_gb: swapUsed,
      free_gb: swapFree,
      percent_used: swapPercentUsed,
      is_critical: swapPercentUsed > 90,
    },
    gpu,
  };
}

/**
 * Check if a model can safely run given current resources
 */
export function canRunModel(
  modelKey: string,
  budget: ResourceBudget = { max_ram_gb: 2.0, max_gpu_mb: 4000, safety_margin: 0.3 }
): CanRunResult {
  const model = MODEL_REQUIREMENTS[modelKey];
  if (!model) {
    return {
      can_run: false,
      reason: `Unknown model: ${modelKey}`,
      warnings: [],
      recommendations: [`Use one of: ${Object.keys(MODEL_REQUIREMENTS).join(', ')}`],
    };
  }

  const state = probeMemoryState();
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check swap state first - this is the early warning system
  if (state.swap.is_critical) {
    warnings.push(`SWAP CRITICAL: ${state.swap.percent_used.toFixed(0)}% used - system may freeze on load`);
    recommendations.push('Free up RAM before loading any model');
    recommendations.push('Close unused applications (browsers, IDEs)');
  }

  // Calculate required resources with safety margin
  const requiredRam = model.ram_gb * (1 + budget.safety_margin);
  const requiredVram = model.vram_mb * (1 + budget.safety_margin);

  // Check RAM
  const ramOk = state.ram.available_gb >= requiredRam && requiredRam <= budget.max_ram_gb;
  if (!ramOk) {
    if (state.ram.available_gb < requiredRam) {
      warnings.push(`Insufficient RAM: need ${requiredRam.toFixed(1)}GB, have ${state.ram.available_gb.toFixed(1)}GB`);
    }
    if (requiredRam > budget.max_ram_gb) {
      warnings.push(`Model exceeds budget: needs ${requiredRam.toFixed(1)}GB, budget is ${budget.max_ram_gb}GB`);
    }
  }

  // Check GPU (if model needs it and GPU is available)
  let gpuOk = true;
  if (model.vram_mb > 0) {
    if (!state.gpu) {
      warnings.push('Model benefits from GPU but no GPU detected');
      recommendations.push('Consider CPU-only model like Vosk');
      gpuOk = false;
    } else if (state.gpu.free_mb < requiredVram) {
      warnings.push(`Insufficient VRAM: need ${requiredVram}MB, have ${state.gpu.free_mb}MB`);
      gpuOk = false;
    } else if (requiredVram > budget.max_gpu_mb) {
      warnings.push(`Model exceeds GPU budget: needs ${requiredVram}MB, budget is ${budget.max_gpu_mb}MB`);
      gpuOk = false;
    }
  }

  const can_run = ramOk && gpuOk && !state.swap.is_critical;

  // Generate recommendations
  if (!can_run) {
    // Suggest smaller alternatives
    const alternatives = findSmallerAlternatives(modelKey, state, budget);
    if (alternatives.length > 0) {
      recommendations.push(`Consider smaller models: ${alternatives.join(', ')}`);
    }
  }

  return {
    can_run,
    reason: can_run
      ? `Safe to run ${model.name}`
      : `Cannot safely run ${model.name}: ${warnings[0]}`,
    warnings,
    recommendations,
  };
}

/**
 * Find smaller model alternatives that would fit
 */
function findSmallerAlternatives(
  modelKey: string,
  state: MemoryState,
  budget: ResourceBudget
): string[] {
  const modelFamily = modelKey.split('-').slice(0, -1).join('-');

  return Object.entries(MODEL_REQUIREMENTS)
    .filter(([key, model]) => {
      // Same family, smaller size
      if (!key.startsWith(modelFamily)) return false;

      const requiredRam = model.ram_gb * (1 + budget.safety_margin);
      const requiredVram = model.vram_mb * (1 + budget.safety_margin);

      const ramFits = requiredRam <= state.ram.available_gb && requiredRam <= budget.max_ram_gb;
      const gpuFits = !state.gpu || requiredVram <= state.gpu.free_mb;

      return ramFits && gpuFits;
    })
    .map(([key]) => key)
    .slice(0, 3);  // Top 3 alternatives
}

/**
 * Get a human-readable summary of current resources
 */
export function getResourceSummary(): string {
  const state = probeMemoryState();

  const lines = [
    '=== Resource State ===',
    `RAM: ${state.ram.available_gb.toFixed(1)}GB available of ${state.ram.total_gb.toFixed(0)}GB (${state.ram.percent_used.toFixed(0)}% used)`,
    `Swap: ${state.swap.free_gb.toFixed(1)}GB free of ${state.swap.total_gb.toFixed(0)}GB (${state.swap.percent_used.toFixed(0)}% used)${state.swap.is_critical ? ' ⚠️ CRITICAL' : ''}`,
  ];

  if (state.gpu) {
    lines.push(`GPU: ${state.gpu.free_mb}MB free of ${state.gpu.total_mb}MB (${state.gpu.percent_used.toFixed(0)}% used)`);
  } else {
    lines.push('GPU: Not available');
  }

  return lines.join('\n');
}

/**
 * Suggest the best model for current conditions
 */
export function suggestBestModel(
  family: 'whisper' | 'faster-whisper' | 'vosk' | 'sensevoice' = 'faster-whisper'
): string | null {
  const state = probeMemoryState();

  // Conservative budget - leave plenty of headroom
  const budget: ResourceBudget = {
    max_ram_gb: Math.min(state.ram.available_gb * 0.5, 2.0),  // Use at most 50% of available, max 2GB
    max_gpu_mb: state.gpu ? state.gpu.free_mb * 0.6 : 0,      // Use at most 60% of free VRAM
    safety_margin: 0.3,
  };

  // Try models from smallest to largest
  const modelsToTry = Object.entries(MODEL_REQUIREMENTS)
    .filter(([key]) => key.startsWith(family))
    .sort((a, b) => a[1].ram_gb - b[1].ram_gb);

  let bestFit: string | null = null;

  for (const [key] of modelsToTry) {
    const result = canRunModel(key, budget);
    if (result.can_run) {
      bestFit = key;
      // Keep going to find the largest that fits
    }
  }

  return bestFit;
}

// --- Experimental Framework ---

export interface ExperimentResult {
  model: string;
  test_audio_seconds: number;
  load_time_ms: number;
  inference_time_ms: number;
  peak_ram_gb: number;
  peak_vram_mb: number;
  success: boolean;
  error?: string;
  timestamp: number;
}

export interface ExperimentLog {
  experiments: ExperimentResult[];
  last_updated: number;
}

/**
 * Progressive model testing - start tiny, only scale up if successful
 */
export function getProgressionPath(family: 'whisper' | 'faster-whisper' = 'faster-whisper'): string[] {
  if (family === 'faster-whisper') {
    return [
      'faster-whisper-tiny',
      'faster-whisper-base',
      'faster-whisper-small',
      'faster-whisper-medium',
      'faster-whisper-large-int8',
    ];
  }
  return [
    'whisper-tiny',
    'whisper-base',
    'whisper-small',
    'whisper-medium',
    'whisper-large-v3',
  ];
}

/**
 * Determine the next safe step in progression
 */
export function getNextSafeStep(
  completedExperiments: ExperimentResult[],
  family: 'whisper' | 'faster-whisper' = 'faster-whisper'
): { model: string; reason: string } | null {
  const path = getProgressionPath(family);
  const successful = new Set(
    completedExperiments.filter(e => e.success).map(e => e.model)
  );

  // Find the next model in progression that hasn't been tested successfully
  for (const model of path) {
    if (!successful.has(model)) {
      const check = canRunModel(model);
      if (check.can_run) {
        return {
          model,
          reason: `Next in progression, resources available`,
        };
      } else {
        return {
          model,
          reason: `Blocked: ${check.reason}`,
        };
      }
    }
  }

  return null;  // All models tested
}
