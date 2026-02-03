//! Audio backend abstraction layer.
//!
//! This module defines the `Backend` trait that all audio implementations
//! (PipeWire, PulseAudio, ALSA) must implement. The abstraction allows
//! for easy fallback and testing.

pub mod pipewire;
pub mod mock;

use crate::buffer::HealthMetrics;
use thiserror::Error;

/// Unique identifier for an audio stream.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct StreamHandle(pub u32);

impl StreamHandle {
    pub fn new(id: u32) -> Self {
        Self(id)
    }

    pub fn id(&self) -> u32 {
        self.0
    }
}

/// Stream direction for configuration.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamDirection {
    Playback,
    Recording,
}

/// Audio format specification.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AudioFormat {
    /// 32-bit floating point, little endian
    F32LE,
    /// 16-bit signed integer, little endian
    S16LE,
    /// 32-bit signed integer, little endian
    S32LE,
}

impl AudioFormat {
    /// Bytes per sample for this format.
    pub fn bytes_per_sample(&self) -> usize {
        match self {
            AudioFormat::F32LE | AudioFormat::S32LE => 4,
            AudioFormat::S16LE => 2,
        }
    }
}

impl Default for AudioFormat {
    fn default() -> Self {
        AudioFormat::F32LE
    }
}

/// Stream lifecycle state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamState {
    /// Stream created but not started
    Idle,
    /// Accumulating prebuffer data
    Prebuffering,
    /// Actively playing/recording
    Running,
    /// Temporarily paused
    Paused,
    /// Finishing remaining buffer contents
    Draining,
    /// Stream stopped
    Stopped,
    /// Error state
    Error,
}

/// Configuration for creating a stream.
#[derive(Debug, Clone)]
pub struct StreamConfig {
    /// Sample rate in Hz (default: 48000)
    pub sample_rate: u32,
    /// Number of channels (default: 1)
    pub channels: u32,
    /// Audio format (default: F32LE)
    pub format: AudioFormat,
    /// Buffer size in milliseconds for latency (default: 20)
    pub buffer_size_ms: u32,
    /// Prebuffer size in milliseconds before playback starts (default: 50)
    pub prebuffer_ms: u32,
    /// Stream name for identification in mixer
    pub name: String,
    /// Stream direction
    pub direction: StreamDirection,
}

impl Default for StreamConfig {
    fn default() -> Self {
        Self {
            sample_rate: 48000,
            channels: 1,
            format: AudioFormat::F32LE,
            buffer_size_ms: 20,
            prebuffer_ms: 50,
            name: "claude-voice".to_string(),
            direction: StreamDirection::Playback,
        }
    }
}

impl StreamConfig {
    /// Calculate prebuffer size in samples.
    pub fn prebuffer_samples(&self) -> usize {
        ((self.sample_rate as usize) * (self.prebuffer_ms as usize) / 1000) * (self.channels as usize)
    }

    /// Calculate buffer size in samples.
    pub fn buffer_samples(&self) -> usize {
        ((self.sample_rate as usize) * (self.buffer_size_ms as usize) / 1000) * (self.channels as usize)
    }

    /// Calculate bytes per millisecond for this configuration.
    pub fn bytes_per_ms(&self) -> usize {
        (self.sample_rate as usize) * (self.channels as usize) * self.format.bytes_per_sample() / 1000
    }
}

/// Audio device information.
#[derive(Debug, Clone)]
pub struct AudioDevice {
    /// Device identifier
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Description
    pub description: String,
    /// Whether this is the system default
    pub is_default: bool,
    /// Native sample rate
    pub sample_rate: u32,
    /// Number of channels
    pub channels: u32,
}

/// Backend errors.
#[derive(Error, Debug)]
pub enum BackendError {
    #[error("Backend not available: {0}")]
    NotAvailable(String),

    #[error("Failed to connect: {0}")]
    ConnectionFailed(String),

    #[error("Stream not found: {0:?}")]
    StreamNotFound(StreamHandle),

    #[error("Buffer overrun: wrote {written} samples but capacity is {capacity}")]
    BufferOverrun { written: usize, capacity: usize },

    #[error("Buffer underrun: requested {requested} samples but only {available} available")]
    BufferUnderrun { requested: usize, available: usize },

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    #[error("Stream in invalid state: expected {expected:?}, got {actual:?}")]
    InvalidState { expected: StreamState, actual: StreamState },

    #[error("Internal error: {0}")]
    Internal(String),
}

pub type Result<T> = std::result::Result<T, BackendError>;

/// Trait for audio backend implementations.
///
/// All audio backends (PipeWire, PulseAudio, ALSA, Mock) implement this trait.
/// The Manager uses this trait to abstract over different implementations.
pub trait Backend: Send + Sync {
    /// Backend identifier.
    fn name(&self) -> &str;

    /// Check if backend is available and can be initialized.
    fn is_available(&self) -> bool;

    /// Initialize the backend.
    fn initialize(&mut self) -> Result<()>;

    /// Shutdown the backend and release resources.
    fn shutdown(&mut self) -> Result<()>;

    /// Create a new audio stream.
    fn create_stream(&mut self, config: StreamConfig) -> Result<StreamHandle>;

    /// Destroy a stream and release its resources.
    fn destroy_stream(&mut self, handle: StreamHandle) -> Result<()>;

    /// Get current stream state.
    fn get_state(&self, handle: StreamHandle) -> Result<StreamState>;

    /// Start the stream (begins playback/recording).
    fn start(&mut self, handle: StreamHandle) -> Result<()>;

    /// Stop the stream.
    fn stop(&mut self, handle: StreamHandle) -> Result<()>;

    /// Pause the stream.
    fn pause(&mut self, handle: StreamHandle) -> Result<()>;

    /// Resume a paused stream.
    fn resume(&mut self, handle: StreamHandle) -> Result<()>;

    /// Write audio samples to a playback stream.
    ///
    /// Returns the number of samples actually written.
    fn write(&self, handle: StreamHandle, samples: &[f32]) -> Result<usize>;

    /// Read audio samples from a recording stream.
    ///
    /// Returns the number of samples actually read.
    fn read(&self, handle: StreamHandle, buffer: &mut [f32]) -> Result<usize>;

    /// Set stream volume (0.0 - 1.0).
    fn set_volume(&mut self, handle: StreamHandle, volume: f32) -> Result<()>;

    /// Get current stream volume.
    fn get_volume(&self, handle: StreamHandle) -> Result<f32>;

    /// Get buffer health metrics for a stream.
    fn get_health(&self, handle: StreamHandle) -> Result<HealthMetrics>;

    /// Wait for a playback stream to finish all queued audio.
    fn drain(&self, handle: StreamHandle) -> Result<()>;

    /// List available playback devices.
    fn list_playback_devices(&self) -> Result<Vec<AudioDevice>>;

    /// List available recording devices.
    fn list_recording_devices(&self) -> Result<Vec<AudioDevice>>;

    /// Get default playback device.
    fn default_playback_device(&self) -> Result<AudioDevice>;

    /// Get default recording device.
    fn default_recording_device(&self) -> Result<AudioDevice>;
}
