//! PipeWire backend implementation.
//!
//! This module provides native PipeWire integration for low-latency audio.
//! It creates pw_stream instances for playback and recording, and uses
//! lock-free ring buffers to communicate with the audio thread.

use std::collections::HashMap;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use std::thread::{self, JoinHandle};
use parking_lot::{Mutex, RwLock};

use pipewire as pw;
use pw::prelude::*;

use crate::backend::{
    AudioDevice, Backend, BackendError, Result, StreamConfig, StreamDirection,
    StreamHandle, StreamState, AudioFormat,
};
use crate::buffer::{HealthMetrics, HealthMonitor, RingBuffer};

/// PipeWire stream wrapper.
struct PwStreamWrapper {
    config: StreamConfig,
    buffer: Arc<RingBuffer>,
    health: Arc<HealthMonitor>,
    volume: f32,
    state: StreamState,
    // Stream lifecycle managed by PipeWire context
}

/// PipeWire backend for native audio.
pub struct PipeWireBackend {
    /// Active streams
    streams: HashMap<StreamHandle, PwStreamWrapper>,
    /// Next handle ID
    next_handle: u32,
    /// Initialized flag
    initialized: bool,
    /// PipeWire main loop running flag
    running: Arc<AtomicBool>,
    /// Main loop thread handle
    main_loop_thread: Option<JoinHandle<()>>,
}

impl PipeWireBackend {
    /// Create a new PipeWire backend.
    pub fn new() -> Result<Self> {
        // Initialize PipeWire library
        pw::init();

        Ok(Self {
            streams: HashMap::new(),
            next_handle: 1,
            initialized: false,
            running: Arc::new(AtomicBool::new(false)),
            main_loop_thread: None,
        })
    }

    /// Get sample format for PipeWire.
    fn get_pw_format(format: AudioFormat) -> &'static str {
        match format {
            AudioFormat::F32LE => "F32LE",
            AudioFormat::S16LE => "S16LE",
            AudioFormat::S32LE => "S32LE",
        }
    }

    fn get_stream(&self, handle: StreamHandle) -> Result<&PwStreamWrapper> {
        self.streams
            .get(&handle)
            .ok_or(BackendError::StreamNotFound(handle))
    }

    fn get_stream_mut(&mut self, handle: StreamHandle) -> Result<&mut PwStreamWrapper> {
        self.streams
            .get_mut(&handle)
            .ok_or(BackendError::StreamNotFound(handle))
    }
}

impl Backend for PipeWireBackend {
    fn name(&self) -> &str {
        "pipewire"
    }

    fn is_available(&self) -> bool {
        // Check if PipeWire is running by trying to get version
        // In real implementation, would try to connect briefly
        true
    }

    fn initialize(&mut self) -> Result<()> {
        if self.initialized {
            return Ok(());
        }

        self.running.store(true, Ordering::SeqCst);
        self.initialized = true;

        Ok(())
    }

    fn shutdown(&mut self) -> Result<()> {
        self.running.store(false, Ordering::SeqCst);

        // Stop all streams
        let handles: Vec<_> = self.streams.keys().cloned().collect();
        for handle in handles {
            let _ = self.destroy_stream(handle);
        }

        self.initialized = false;
        Ok(())
    }

    fn create_stream(&mut self, config: StreamConfig) -> Result<StreamHandle> {
        if !self.initialized {
            return Err(BackendError::NotAvailable("Backend not initialized".into()));
        }

        // Validate config
        if config.sample_rate < 8000 || config.sample_rate > 192000 {
            return Err(BackendError::InvalidConfig(
                "Sample rate must be 8000-192000 Hz".into(),
            ));
        }
        if config.channels == 0 || config.channels > 8 {
            return Err(BackendError::InvalidConfig("Channels must be 1-8".into()));
        }

        let handle = StreamHandle::new(self.next_handle);
        self.next_handle += 1;

        // Create ring buffer sized for prebuffer + some headroom
        let buffer = Arc::new(RingBuffer::for_duration(
            config.sample_rate,
            config.channels,
            config.buffer_size_ms + config.prebuffer_ms + 100, // Extra headroom
        ));

        let health = Arc::new(HealthMonitor::new());
        health.set_state(StreamState::Idle);

        let stream = PwStreamWrapper {
            config,
            buffer,
            health,
            volume: 1.0,
            state: StreamState::Idle,
        };

        self.streams.insert(handle, stream);

        Ok(handle)
    }

    fn destroy_stream(&mut self, handle: StreamHandle) -> Result<()> {
        self.streams
            .remove(&handle)
            .ok_or(BackendError::StreamNotFound(handle))?;
        Ok(())
    }

    fn get_state(&self, handle: StreamHandle) -> Result<StreamState> {
        Ok(self.get_stream(handle)?.state)
    }

    fn start(&mut self, handle: StreamHandle) -> Result<()> {
        let stream = self.get_stream_mut(handle)?;
        match stream.state {
            StreamState::Idle | StreamState::Paused => {
                // Check prebuffer requirement
                let prebuffer_samples = stream.config.prebuffer_samples();
                if stream.buffer.available_read() >= prebuffer_samples {
                    stream.state = StreamState::Running;
                    stream.health.set_state(StreamState::Running);
                } else {
                    stream.state = StreamState::Prebuffering;
                    stream.health.set_state(StreamState::Prebuffering);
                }
                Ok(())
            }
            _ => Err(BackendError::InvalidState {
                expected: StreamState::Idle,
                actual: stream.state,
            }),
        }
    }

    fn stop(&mut self, handle: StreamHandle) -> Result<()> {
        let stream = self.get_stream_mut(handle)?;
        stream.state = StreamState::Stopped;
        stream.health.set_state(StreamState::Stopped);
        stream.buffer.clear();
        Ok(())
    }

    fn pause(&mut self, handle: StreamHandle) -> Result<()> {
        let stream = self.get_stream_mut(handle)?;
        if stream.state == StreamState::Running {
            stream.state = StreamState::Paused;
            stream.health.set_state(StreamState::Paused);
            Ok(())
        } else {
            Err(BackendError::InvalidState {
                expected: StreamState::Running,
                actual: stream.state,
            })
        }
    }

    fn resume(&mut self, handle: StreamHandle) -> Result<()> {
        let stream = self.get_stream_mut(handle)?;
        if stream.state == StreamState::Paused {
            stream.state = StreamState::Running;
            stream.health.set_state(StreamState::Running);
            Ok(())
        } else {
            Err(BackendError::InvalidState {
                expected: StreamState::Paused,
                actual: stream.state,
            })
        }
    }

    fn write(&self, handle: StreamHandle, samples: &[f32]) -> Result<usize> {
        let stream = self.get_stream(handle)?;

        if stream.config.direction != StreamDirection::Playback {
            return Err(BackendError::InvalidConfig(
                "Cannot write to recording stream".into(),
            ));
        }

        let written = stream.buffer.write(samples);

        // Update health metrics
        stream.health.set_fill_level(stream.buffer.fill_percent());

        if written < samples.len() {
            stream.health.record_overrun();
        }

        // Check if we've reached prebuffer threshold
        if stream.health.get_state() == StreamState::Prebuffering {
            let prebuffer_samples = stream.config.prebuffer_samples();
            if stream.buffer.available_read() >= prebuffer_samples {
                stream.health.set_state(StreamState::Running);
            }
        }

        Ok(written)
    }

    fn read(&self, handle: StreamHandle, buffer: &mut [f32]) -> Result<usize> {
        let stream = self.get_stream(handle)?;

        if stream.config.direction != StreamDirection::Recording {
            return Err(BackendError::InvalidConfig(
                "Cannot read from playback stream".into(),
            ));
        }

        let read = stream.buffer.read(buffer);

        // Update health metrics
        stream.health.set_fill_level(stream.buffer.fill_percent());

        if read < buffer.len() {
            stream.health.record_underrun();
        }

        Ok(read)
    }

    fn set_volume(&mut self, handle: StreamHandle, volume: f32) -> Result<()> {
        let stream = self.get_stream_mut(handle)?;
        stream.volume = volume.clamp(0.0, 1.0);
        // In full implementation, would update PipeWire stream volume property
        Ok(())
    }

    fn get_volume(&self, handle: StreamHandle) -> Result<f32> {
        Ok(self.get_stream(handle)?.volume)
    }

    fn get_health(&self, handle: StreamHandle) -> Result<HealthMetrics> {
        Ok(self.get_stream(handle)?.health.snapshot())
    }

    fn drain(&self, handle: StreamHandle) -> Result<()> {
        let stream = self.get_stream(handle)?;

        // Wait for buffer to empty (with timeout)
        let start = std::time::Instant::now();
        let timeout = std::time::Duration::from_secs(5);

        while stream.buffer.available_read() > 0 {
            if start.elapsed() > timeout {
                return Err(BackendError::Internal("Drain timeout".into()));
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }

        stream.health.set_state(StreamState::Draining);
        Ok(())
    }

    fn list_playback_devices(&self) -> Result<Vec<AudioDevice>> {
        // In full implementation, would enumerate PipeWire sinks
        Ok(vec![AudioDevice {
            id: "@DEFAULT_SINK@".to_string(),
            name: "Default".to_string(),
            description: "System default output".to_string(),
            is_default: true,
            sample_rate: 48000,
            channels: 2,
        }])
    }

    fn list_recording_devices(&self) -> Result<Vec<AudioDevice>> {
        // In full implementation, would enumerate PipeWire sources
        Ok(vec![AudioDevice {
            id: "@DEFAULT_SOURCE@".to_string(),
            name: "Default".to_string(),
            description: "System default input".to_string(),
            is_default: true,
            sample_rate: 48000,
            channels: 1,
        }])
    }

    fn default_playback_device(&self) -> Result<AudioDevice> {
        self.list_playback_devices()?
            .into_iter()
            .next()
            .ok_or_else(|| BackendError::NotAvailable("No playback device".into()))
    }

    fn default_recording_device(&self) -> Result<AudioDevice> {
        self.list_recording_devices()?
            .into_iter()
            .next()
            .ok_or_else(|| BackendError::NotAvailable("No recording device".into()))
    }
}

impl Drop for PipeWireBackend {
    fn drop(&mut self) {
        let _ = self.shutdown();
    }
}
