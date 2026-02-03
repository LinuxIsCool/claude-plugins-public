//! Mock audio backend for testing.
//!
//! Simulates audio playback/recording without actual hardware.
//! Useful for unit tests and when PipeWire is unavailable.

use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::Mutex;

use crate::backend::{
    AudioDevice, Backend, BackendError, Result, StreamConfig, StreamDirection,
    StreamHandle, StreamState,
};
use crate::buffer::{HealthMetrics, HealthMonitor, RingBuffer};

/// Internal stream state for mock backend.
struct MockStream {
    config: StreamConfig,
    buffer: RingBuffer,
    health: HealthMonitor,
    volume: f32,
    state: StreamState,
}

impl MockStream {
    fn new(config: StreamConfig) -> Self {
        let buffer = RingBuffer::for_duration(
            config.sample_rate,
            config.channels,
            config.buffer_size_ms + config.prebuffer_ms,
        );

        Self {
            config,
            buffer,
            health: HealthMonitor::new(),
            volume: 1.0,
            state: StreamState::Idle,
        }
    }
}

/// Mock backend for testing.
pub struct MockBackend {
    streams: HashMap<StreamHandle, MockStream>,
    next_handle: u32,
    initialized: bool,
}

impl MockBackend {
    /// Create a new mock backend.
    pub fn new() -> Self {
        Self {
            streams: HashMap::new(),
            next_handle: 1,
            initialized: false,
        }
    }

    fn get_stream(&self, handle: StreamHandle) -> Result<&MockStream> {
        self.streams
            .get(&handle)
            .ok_or(BackendError::StreamNotFound(handle))
    }

    fn get_stream_mut(&mut self, handle: StreamHandle) -> Result<&mut MockStream> {
        self.streams
            .get_mut(&handle)
            .ok_or(BackendError::StreamNotFound(handle))
    }
}

impl Default for MockBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl Backend for MockBackend {
    fn name(&self) -> &str {
        "mock"
    }

    fn is_available(&self) -> bool {
        true // Mock is always available
    }

    fn initialize(&mut self) -> Result<()> {
        self.initialized = true;
        Ok(())
    }

    fn shutdown(&mut self) -> Result<()> {
        self.streams.clear();
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

        let stream = MockStream::new(config);
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

        // In mock, just check that buffer eventually empties
        // Real implementation would wait for audio callback to consume
        if stream.buffer.available_read() == 0 {
            Ok(())
        } else {
            // Simulate drain by clearing buffer
            stream.buffer.clear();
            Ok(())
        }
    }

    fn list_playback_devices(&self) -> Result<Vec<AudioDevice>> {
        Ok(vec![AudioDevice {
            id: "mock:playback:0".to_string(),
            name: "Mock Playback".to_string(),
            description: "Mock audio output device".to_string(),
            is_default: true,
            sample_rate: 48000,
            channels: 2,
        }])
    }

    fn list_recording_devices(&self) -> Result<Vec<AudioDevice>> {
        Ok(vec![AudioDevice {
            id: "mock:recording:0".to_string(),
            name: "Mock Recording".to_string(),
            description: "Mock audio input device".to_string(),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_and_destroy_stream() {
        let mut backend = MockBackend::new();
        backend.initialize().unwrap();

        let handle = backend
            .create_stream(StreamConfig::default())
            .unwrap();

        assert_eq!(backend.get_state(handle).unwrap(), StreamState::Idle);

        backend.destroy_stream(handle).unwrap();

        assert!(backend.get_state(handle).is_err());
    }

    #[test]
    fn test_write_and_read() {
        let mut backend = MockBackend::new();
        backend.initialize().unwrap();

        // Create playback stream
        let playback = backend
            .create_stream(StreamConfig {
                direction: StreamDirection::Playback,
                ..Default::default()
            })
            .unwrap();

        // Write samples
        let samples = vec![0.5f32; 1024];
        let written = backend.write(playback, &samples).unwrap();
        assert_eq!(written, 1024);

        // Create recording stream
        let recording = backend
            .create_stream(StreamConfig {
                direction: StreamDirection::Recording,
                ..Default::default()
            })
            .unwrap();

        // Write to recording buffer (simulating mic input)
        // In mock, we'd need to push data differently - this tests the error case
        let result = backend.write(recording, &samples);
        assert!(result.is_err());
    }

    #[test]
    fn test_volume_control() {
        let mut backend = MockBackend::new();
        backend.initialize().unwrap();

        let handle = backend
            .create_stream(StreamConfig::default())
            .unwrap();

        assert_eq!(backend.get_volume(handle).unwrap(), 1.0);

        backend.set_volume(handle, 0.5).unwrap();
        assert!((backend.get_volume(handle).unwrap() - 0.5).abs() < 0.01);

        // Test clamping
        backend.set_volume(handle, 2.0).unwrap();
        assert!((backend.get_volume(handle).unwrap() - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_health_metrics() {
        let mut backend = MockBackend::new();
        backend.initialize().unwrap();

        let handle = backend
            .create_stream(StreamConfig::default())
            .unwrap();

        let health = backend.get_health(handle).unwrap();
        assert_eq!(health.underrun_count, 0);
        assert_eq!(health.overrun_count, 0);
    }
}
