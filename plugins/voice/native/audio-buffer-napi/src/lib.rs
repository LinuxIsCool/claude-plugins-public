//! Audio Buffer Manager - Native N-API Module
//!
//! This is the entry point for the native Node.js module.
//! It exposes the audio buffer management functionality to TypeScript.
//!
//! # Architecture
//!
//! ```text
//! TypeScript → N-API → AudioManager → Backend (PipeWire/Mock)
//!                                          ↓
//!                                     RingBuffer + HealthMonitor
//!                                          ↓
//!                                     PipeWire Audio Thread
//! ```

#![deny(clippy::all)]

mod backend;
mod buffer;
mod ducking;

use std::collections::HashMap;
use std::sync::Arc;

use napi::bindgen_prelude::*;
use napi_derive::napi;
use parking_lot::Mutex;

use backend::{Backend, BackendError, StreamConfig, StreamDirection, StreamHandle, StreamState, AudioFormat};
use backend::mock::MockBackend;
use buffer::HealthMetrics;

// Re-export for PipeWire backend (implemented separately)
#[cfg(target_os = "linux")]
mod pipewire_backend;

/// Stream configuration passed from TypeScript.
#[napi(object)]
#[derive(Debug, Clone)]
pub struct JsStreamConfig {
    /// Sample rate in Hz (default: 48000)
    pub sample_rate: Option<u32>,
    /// Number of channels (default: 1)
    pub channels: Option<u32>,
    /// Audio format: "f32le", "s16le", "s32le" (default: "f32le")
    pub format: Option<String>,
    /// Buffer size in milliseconds (default: 20)
    pub buffer_size_ms: Option<u32>,
    /// Prebuffer size in milliseconds (default: 50)
    pub prebuffer_ms: Option<u32>,
    /// Stream name for identification
    pub name: Option<String>,
    /// Stream direction: "playback" or "recording"
    pub direction: Option<String>,
}

impl From<JsStreamConfig> for StreamConfig {
    fn from(js: JsStreamConfig) -> Self {
        let format = match js.format.as_deref() {
            Some("s16le") => AudioFormat::S16LE,
            Some("s32le") => AudioFormat::S32LE,
            _ => AudioFormat::F32LE,
        };

        let direction = match js.direction.as_deref() {
            Some("recording") => StreamDirection::Recording,
            _ => StreamDirection::Playback,
        };

        StreamConfig {
            sample_rate: js.sample_rate.unwrap_or(48000),
            channels: js.channels.unwrap_or(1),
            format,
            buffer_size_ms: js.buffer_size_ms.unwrap_or(20),
            prebuffer_ms: js.prebuffer_ms.unwrap_or(50),
            name: js.name.unwrap_or_else(|| "claude-voice".to_string()),
            direction,
        }
    }
}

/// Buffer health metrics returned to TypeScript.
#[napi(object)]
#[derive(Debug, Clone)]
pub struct JsHealthMetrics {
    /// Buffer fill level (0.0 - 1.0)
    pub fill_level: f64,
    /// Number of underrun events
    pub underrun_count: u32,
    /// Number of overrun events
    pub overrun_count: u32,
    /// Estimated latency in milliseconds
    pub latency_ms: u32,
    /// Current state: "idle", "prebuffering", "running", "paused", "draining", "stopped", "error"
    pub state: String,
}

impl From<HealthMetrics> for JsHealthMetrics {
    fn from(metrics: HealthMetrics) -> Self {
        let state = match metrics.state {
            StreamState::Idle => "idle",
            StreamState::Prebuffering => "prebuffering",
            StreamState::Running => "running",
            StreamState::Paused => "paused",
            StreamState::Draining => "draining",
            StreamState::Stopped => "stopped",
            StreamState::Error => "error",
        };

        JsHealthMetrics {
            fill_level: metrics.fill_level as f64,
            underrun_count: metrics.underrun_count as u32,
            overrun_count: metrics.overrun_count as u32,
            latency_ms: metrics.latency_ms,
            state: state.to_string(),
        }
    }
}

/// Audio device information.
#[napi(object)]
#[derive(Debug, Clone)]
pub struct JsAudioDevice {
    pub id: String,
    pub name: String,
    pub description: String,
    pub is_default: bool,
    pub sample_rate: u32,
    pub channels: u32,
}

impl From<backend::AudioDevice> for JsAudioDevice {
    fn from(device: backend::AudioDevice) -> Self {
        JsAudioDevice {
            id: device.id,
            name: device.name,
            description: device.description,
            is_default: device.is_default,
            sample_rate: device.sample_rate,
            channels: device.channels,
        }
    }
}

/// Convert backend errors to napi errors.
impl From<BackendError> for napi::Error {
    fn from(err: BackendError) -> Self {
        napi::Error::new(napi::Status::GenericFailure, format!("{}", err))
    }
}

/// The main audio manager class exposed to TypeScript.
///
/// Usage from TypeScript:
/// ```typescript
/// import { AudioManager } from './audio-buffer-napi.node';
///
/// const manager = new AudioManager();
/// await manager.initialize('auto');
///
/// const handle = await manager.createStream({ prebufferMs: 50 });
/// await manager.write(handle, samples);
/// await manager.drain(handle);
/// await manager.destroyStream(handle);
/// ```
#[napi]
pub struct AudioManager {
    backend: Arc<Mutex<Box<dyn Backend>>>,
    initialized: bool,
}

#[napi]
impl AudioManager {
    /// Create a new AudioManager.
    ///
    /// The manager is not initialized until `initialize()` is called.
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            backend: Arc::new(Mutex::new(Box::new(MockBackend::new()))),
            initialized: false,
        }
    }

    /// Initialize the audio manager with the specified backend.
    ///
    /// @param backend - Backend name: "auto", "pipewire", or "mock"
    #[napi]
    pub async fn initialize(&mut self, backend_name: Option<String>) -> Result<()> {
        let backend_name = backend_name.unwrap_or_else(|| "auto".to_string());

        let mut backend: Box<dyn Backend> = match backend_name.as_str() {
            "mock" => Box::new(MockBackend::new()),
            "pipewire" | "auto" => {
                #[cfg(target_os = "linux")]
                {
                    // Try PipeWire first, fall back to mock
                    match pipewire_backend::PipeWireBackend::new() {
                        Ok(pw) => Box::new(pw),
                        Err(e) => {
                            eprintln!("PipeWire not available: {}, using mock backend", e);
                            Box::new(MockBackend::new())
                        }
                    }
                }
                #[cfg(not(target_os = "linux"))]
                {
                    eprintln!("PipeWire only available on Linux, using mock backend");
                    Box::new(MockBackend::new())
                }
            }
            _ => {
                return Err(napi::Error::new(
                    napi::Status::InvalidArg,
                    format!("Unknown backend: {}", backend_name),
                ));
            }
        };

        backend.initialize().map_err(|e| napi::Error::from(e))?;
        self.backend = Arc::new(Mutex::new(backend));
        self.initialized = true;

        Ok(())
    }

    /// Shutdown the audio manager.
    #[napi]
    pub async fn shutdown(&mut self) -> Result<()> {
        if self.initialized {
            self.backend.lock().shutdown().map_err(|e| napi::Error::from(e))?;
            self.initialized = false;
        }
        Ok(())
    }

    /// Get the name of the current backend.
    #[napi]
    pub fn get_backend_name(&self) -> String {
        self.backend.lock().name().to_string()
    }

    /// Check if the backend is available.
    #[napi]
    pub fn is_available(&self) -> bool {
        self.backend.lock().is_available()
    }

    /// Create a new audio stream.
    ///
    /// @param config - Stream configuration
    /// @returns Stream handle (number)
    #[napi]
    pub async fn create_stream(&self, config: Option<JsStreamConfig>) -> Result<u32> {
        let config: StreamConfig = config.unwrap_or_default().into();
        let handle = self
            .backend
            .lock()
            .create_stream(config)
            .map_err(|e| napi::Error::from(e))?;
        Ok(handle.id())
    }

    /// Destroy a stream.
    #[napi]
    pub async fn destroy_stream(&self, handle: u32) -> Result<()> {
        self.backend
            .lock()
            .destroy_stream(StreamHandle::new(handle))
            .map_err(|e| napi::Error::from(e))
    }

    /// Get the current state of a stream.
    #[napi]
    pub fn get_state(&self, handle: u32) -> Result<String> {
        let state = self
            .backend
            .lock()
            .get_state(StreamHandle::new(handle))
            .map_err(|e| napi::Error::from(e))?;

        Ok(match state {
            StreamState::Idle => "idle",
            StreamState::Prebuffering => "prebuffering",
            StreamState::Running => "running",
            StreamState::Paused => "paused",
            StreamState::Draining => "draining",
            StreamState::Stopped => "stopped",
            StreamState::Error => "error",
        }
        .to_string())
    }

    /// Start a stream.
    #[napi]
    pub async fn start(&self, handle: u32) -> Result<()> {
        self.backend
            .lock()
            .start(StreamHandle::new(handle))
            .map_err(|e| napi::Error::from(e))
    }

    /// Stop a stream.
    #[napi]
    pub async fn stop(&self, handle: u32) -> Result<()> {
        self.backend
            .lock()
            .stop(StreamHandle::new(handle))
            .map_err(|e| napi::Error::from(e))
    }

    /// Pause a stream.
    #[napi]
    pub async fn pause(&self, handle: u32) -> Result<()> {
        self.backend
            .lock()
            .pause(StreamHandle::new(handle))
            .map_err(|e| napi::Error::from(e))
    }

    /// Resume a paused stream.
    #[napi]
    pub async fn resume(&self, handle: u32) -> Result<()> {
        self.backend
            .lock()
            .resume(StreamHandle::new(handle))
            .map_err(|e| napi::Error::from(e))
    }

    /// Write audio samples to a playback stream.
    ///
    /// Samples should be Float32Array of interleaved samples.
    ///
    /// @param handle - Stream handle
    /// @param samples - Audio samples as Float32Array
    /// @returns Number of samples written
    #[napi]
    pub fn write(&self, handle: u32, samples: Float32Array) -> Result<u32> {
        let slice = samples.as_ref();
        let written = self
            .backend
            .lock()
            .write(StreamHandle::new(handle), slice)
            .map_err(|e| napi::Error::from(e))?;
        Ok(written as u32)
    }

    /// Read audio samples from a recording stream.
    ///
    /// @param handle - Stream handle
    /// @param size - Number of samples to read
    /// @returns Float32Array of samples
    #[napi]
    pub fn read(&self, handle: u32, size: u32) -> Result<Float32Array> {
        let mut buffer = vec![0.0f32; size as usize];
        let read = self
            .backend
            .lock()
            .read(StreamHandle::new(handle), &mut buffer)
            .map_err(|e| napi::Error::from(e))?;

        buffer.truncate(read);
        Ok(Float32Array::new(buffer))
    }

    /// Set stream volume (0.0 - 1.0).
    #[napi]
    pub fn set_volume(&self, handle: u32, volume: f64) -> Result<()> {
        self.backend
            .lock()
            .set_volume(StreamHandle::new(handle), volume as f32)
            .map_err(|e| napi::Error::from(e))
    }

    /// Get current stream volume.
    #[napi]
    pub fn get_volume(&self, handle: u32) -> Result<f64> {
        let volume = self
            .backend
            .lock()
            .get_volume(StreamHandle::new(handle))
            .map_err(|e| napi::Error::from(e))?;
        Ok(volume as f64)
    }

    /// Get buffer health metrics for a stream.
    #[napi]
    pub fn get_health(&self, handle: u32) -> Result<JsHealthMetrics> {
        let metrics = self
            .backend
            .lock()
            .get_health(StreamHandle::new(handle))
            .map_err(|e| napi::Error::from(e))?;
        Ok(metrics.into())
    }

    /// Wait for a playback stream to drain all queued audio.
    #[napi]
    pub async fn drain(&self, handle: u32) -> Result<()> {
        self.backend
            .lock()
            .drain(StreamHandle::new(handle))
            .map_err(|e| napi::Error::from(e))
    }

    /// List available playback devices.
    #[napi]
    pub fn list_playback_devices(&self) -> Result<Vec<JsAudioDevice>> {
        let devices = self
            .backend
            .lock()
            .list_playback_devices()
            .map_err(|e| napi::Error::from(e))?;
        Ok(devices.into_iter().map(|d| d.into()).collect())
    }

    /// List available recording devices.
    #[napi]
    pub fn list_recording_devices(&self) -> Result<Vec<JsAudioDevice>> {
        let devices = self
            .backend
            .lock()
            .list_recording_devices()
            .map_err(|e| napi::Error::from(e))?;
        Ok(devices.into_iter().map(|d| d.into()).collect())
    }

    /// Get default playback device.
    #[napi]
    pub fn default_playback_device(&self) -> Result<JsAudioDevice> {
        let device = self
            .backend
            .lock()
            .default_playback_device()
            .map_err(|e| napi::Error::from(e))?;
        Ok(device.into())
    }

    /// Get default recording device.
    #[napi]
    pub fn default_recording_device(&self) -> Result<JsAudioDevice> {
        let device = self
            .backend
            .lock()
            .default_recording_device()
            .map_err(|e| napi::Error::from(e))?;
        Ok(device.into())
    }
}

impl Default for AudioManager {
    fn default() -> Self {
        Self::new()
    }
}
