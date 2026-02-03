/**
 * Audio Adapter Exports
 *
 * Factory functions and types for audio buffer management.
 */

export {
  AudioBufferManager,
  createAudioBufferManager,
  getAudioBufferManager,
  type AudioBufferManagerOptions,
  type DuckingStrategy,
} from "./manager.js";

export {
  SubprocessAudioAdapter,
  createSubprocessAudio,
} from "./subprocess.js";
