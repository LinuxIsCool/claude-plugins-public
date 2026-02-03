# Experimental Research Sub-Skill

## Philosophy: Concrete Computing

> "Sometimes we worked with systems that had like only 128KB of Memory.
> So just because we have 12GB doesn't mean we have to use it all at once."

This skill embodies **resource-conscious experimentation**:

1. **Probe before commit** - Always check resources before loading
2. **Start tiny** - Begin with smallest viable option
3. **Learn first** - Collect data before scaling up
4. **Never brick** - System stability is non-negotiable
5. **Progressive capacity** - Build understanding incrementally

## The Problem We're Solving

Large ML models can freeze a system for minutes when:
- Model loads into RAM before GPU transfer
- Available RAM is insufficient
- Swap is exhausted (common: 100% swap usage)
- System starts thrashing

**Symptoms**: 5+ minute freezes, unresponsive UI, potential OOM kills

## Resource Probing

### Before ANY Model Load

```typescript
import { probeMemoryState, canRunModel, getResourceSummary } from '../infrastructure/resource-probe';

// Step 1: Get current state
const state = probeMemoryState();
console.log(getResourceSummary());

// Step 2: Check if model is safe to run
const check = canRunModel('faster-whisper-small');
if (!check.can_run) {
  console.log(`BLOCKED: ${check.reason}`);
  console.log(`Recommendations: ${check.recommendations.join(', ')}`);
  return;
}

// Step 3: Only then proceed
```

### Warning Signs

| Indicator | Threshold | Action |
|-----------|-----------|--------|
| Swap usage | >90% | **STOP** - Do not load any model |
| Available RAM | <2GB | Use tiny models only |
| Available RAM | <1GB | CPU-only Vosk or abort |
| GPU VRAM | <500MB | CPU inference only |

## Progressive Testing Framework

### The Progression Path

Start small. Only advance when current level succeeds.

```
Level 0: Vosk Small (50MB RAM, CPU-only)
    ↓ success
Level 1: faster-whisper-tiny (150MB RAM, 300MB VRAM)
    ↓ success
Level 2: faster-whisper-base (250MB RAM, 400MB VRAM)
    ↓ success
Level 3: faster-whisper-small (600MB RAM, 700MB VRAM)
    ↓ success
Level 4: faster-whisper-medium (1.5GB RAM, 1.5GB VRAM)
    ↓ success + stable
Level 5: faster-whisper-large-int8 (2.5GB RAM, 3GB VRAM)
```

### Experiment Protocol

```typescript
interface ExperimentProtocol {
  // 1. Pre-flight checks
  check_swap_not_critical: boolean;
  check_ram_available: boolean;
  check_model_fits_budget: boolean;

  // 2. Test parameters
  test_audio_duration_seconds: 10;  // Short test first!
  timeout_seconds: 30;              // Kill if frozen

  // 3. Measurements
  measure_load_time: boolean;
  measure_inference_time: boolean;
  measure_peak_memory: boolean;

  // 4. Success criteria
  max_acceptable_load_time_ms: 10000;
  max_acceptable_inference_time_ms: 5000;
}
```

### Running an Experiment

```bash
# 1. Check resources first
python -c "
import psutil
mem = psutil.virtual_memory()
swap = psutil.swap_memory()
print(f'RAM available: {mem.available / 1e9:.1f}GB')
print(f'Swap used: {swap.percent}%')
if swap.percent > 90:
    print('⚠️  SWAP CRITICAL - Do not proceed')
"

# 2. Use timeout to prevent freezes
timeout 30s python experiment.py --model tiny --audio test_10s.wav

# 3. Record results
# Even failures are valuable data
```

## Model Requirements Database

| Model | RAM (GB) | VRAM (MB) | Disk (GB) | Notes |
|-------|----------|-----------|-----------|-------|
| vosk-small | 0.05 | 0 | 0.05 | **Safest start** |
| vosk-large | 0.3 | 0 | 1.8 | CPU-only |
| faster-whisper-tiny | 0.15 | 300 | 0.04 | Fast experiments |
| faster-whisper-base | 0.25 | 400 | 0.07 | Good baseline |
| faster-whisper-small | 0.6 | 700 | 0.24 | Balance point |
| faster-whisper-medium | 1.5 | 1500 | 0.77 | Quality bump |
| faster-whisper-large-int8 | 2.5 | 3000 | 0.8 | **Best for 12GB GPU** |
| whisper-large-v3 | 5.0 | 5000 | 1.5 | Needs headroom |
| sensevoice-small | 0.5 | 500 | 0.2 | Very fast |
| pyannote-3.1 | 1.0 | 2000 | 0.3 | Diarization |

## Safety Budgets

### Conservative (Recommended)

```typescript
const conservativeBudget = {
  max_ram_gb: 2.0,           // Never use more than 2GB
  max_gpu_mb: 4000,          // Leave 8GB headroom on 12GB card
  safety_margin: 0.3,        // Add 30% buffer to estimates
};
```

### Moderate (After Successful Tests)

```typescript
const moderateBudget = {
  max_ram_gb: 3.0,
  max_gpu_mb: 6000,
  safety_margin: 0.2,
};
```

### Aggressive (Only If System Stable)

```typescript
const aggressiveBudget = {
  max_ram_gb: 4.0,
  max_gpu_mb: 8000,
  safety_margin: 0.1,
};
```

## Experiment Log Schema

Track what works and what doesn't:

```typescript
interface ExperimentResult {
  model: string;
  test_audio_seconds: number;
  load_time_ms: number;
  inference_time_ms: number;
  peak_ram_gb: number;
  peak_vram_mb: number;
  success: boolean;
  error?: string;
  system_state_before: MemoryState;
  timestamp: number;
}
```

Store in: `.claude/transcripts/experiments/log.jsonl`

## Decision Tree

```
START: Want to transcribe audio
  │
  ├─ Is swap > 90%?
  │   └─ YES → STOP. Free memory first.
  │
  ├─ Is available RAM < 1GB?
  │   └─ YES → Use Vosk (CPU-only) or abort
  │
  ├─ Have we tested tiny model?
  │   └─ NO → Test faster-whisper-tiny first
  │
  ├─ Did tiny succeed?
  │   └─ NO → Debug before proceeding
  │
  ├─ Have we tested current progression level?
  │   └─ NO → Test next level
  │
  └─ All levels tested and stable?
      └─ YES → Use largest successful model
```

## Integration with Researcher Agent

The `transcripts:researcher` agent uses this skill to:

1. **Assess capacity** - Run resource probes
2. **Plan experiments** - Determine safe test parameters
3. **Execute safely** - Use timeouts and monitoring
4. **Learn** - Record results to build knowledge
5. **Recommend** - Suggest best model for conditions

## Example Session

```
User: I want to transcribe a podcast

Researcher Agent:
  1. Probing resources...
     - RAM: 3.5GB available
     - Swap: 100% used ⚠️
     - GPU: 7.9GB free

  2. Assessment: CAUTION
     - Swap is critical
     - Recommending conservative approach

  3. Safe options:
     - vosk-small (safest, lower quality)
     - faster-whisper-tiny (safe, decent quality)

  4. NOT recommended right now:
     - Any model > 500MB RAM requirement
     - Reason: Swap exhaustion risk

  Would you like to:
  a) Proceed with faster-whisper-tiny
  b) Free up memory first, then use larger model
  c) Use Vosk for guaranteed stability
```

## Anti-Patterns (AVOID)

❌ Loading large model without checking resources
❌ Assuming 12GB VRAM means any model will work
❌ Ignoring swap state
❌ Skipping progression levels
❌ No timeout on model loading
❌ Not recording experiment results

## Best Practices (DO)

✅ Always probe before load
✅ Start with tiny, advance on success
✅ Use timeouts (30s default)
✅ Record every experiment (success AND failure)
✅ Monitor swap as early warning
✅ Leave 30% safety margin
✅ Build knowledge incrementally

## Links

- [[resource-probe.ts]] - Probing utilities
- [[transcripts:researcher]] - Agent using this skill
- [[18-17-transcription-research]] - Research on options
