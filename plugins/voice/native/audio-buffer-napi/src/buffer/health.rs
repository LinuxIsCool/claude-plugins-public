//! Buffer health monitoring with atomic metrics.
//!
//! Tracks buffer fill level, underruns, overruns, and latency.
//! All operations are lock-free using atomic types.

use std::sync::atomic::{AtomicU32, AtomicU64, AtomicU8, Ordering};
use crate::backend::StreamState;

/// Atomic health monitor for real-time metrics.
pub struct HealthMonitor {
    /// Fill level as fixed-point (0-1000 representing 0.0-1.0)
    fill_level: AtomicU32,
    /// Number of buffer underruns
    underrun_count: AtomicU64,
    /// Number of buffer overruns
    overrun_count: AtomicU64,
    /// Estimated latency in milliseconds
    latency_ms: AtomicU32,
    /// Current state (encoded as u8)
    state: AtomicU8,
}

impl HealthMonitor {
    /// Create a new health monitor.
    pub fn new() -> Self {
        Self {
            fill_level: AtomicU32::new(0),
            underrun_count: AtomicU64::new(0),
            overrun_count: AtomicU64::new(0),
            latency_ms: AtomicU32::new(0),
            state: AtomicU8::new(StreamState::Idle as u8),
        }
    }

    /// Update the fill level (0.0 - 1.0).
    pub fn set_fill_level(&self, level: f32) {
        let fixed = (level.clamp(0.0, 1.0) * 1000.0) as u32;
        self.fill_level.store(fixed, Ordering::Relaxed);
    }

    /// Get the fill level (0.0 - 1.0).
    pub fn get_fill_level(&self) -> f32 {
        self.fill_level.load(Ordering::Relaxed) as f32 / 1000.0
    }

    /// Record an underrun event.
    pub fn record_underrun(&self) {
        self.underrun_count.fetch_add(1, Ordering::Relaxed);
    }

    /// Get underrun count.
    pub fn get_underrun_count(&self) -> u64 {
        self.underrun_count.load(Ordering::Relaxed)
    }

    /// Record an overrun event.
    pub fn record_overrun(&self) {
        self.overrun_count.fetch_add(1, Ordering::Relaxed);
    }

    /// Get overrun count.
    pub fn get_overrun_count(&self) -> u64 {
        self.overrun_count.load(Ordering::Relaxed)
    }

    /// Update latency estimate.
    pub fn set_latency(&self, ms: u32) {
        self.latency_ms.store(ms, Ordering::Relaxed);
    }

    /// Get latency estimate.
    pub fn get_latency(&self) -> u32 {
        self.latency_ms.load(Ordering::Relaxed)
    }

    /// Update state.
    pub fn set_state(&self, state: StreamState) {
        self.state.store(state as u8, Ordering::Release);
    }

    /// Get current state.
    pub fn get_state(&self) -> StreamState {
        match self.state.load(Ordering::Acquire) {
            0 => StreamState::Idle,
            1 => StreamState::Prebuffering,
            2 => StreamState::Running,
            3 => StreamState::Paused,
            4 => StreamState::Draining,
            5 => StreamState::Stopped,
            _ => StreamState::Error,
        }
    }

    /// Get a snapshot of all metrics.
    pub fn snapshot(&self) -> HealthMetrics {
        HealthMetrics {
            fill_level: self.get_fill_level(),
            underrun_count: self.get_underrun_count(),
            overrun_count: self.get_overrun_count(),
            latency_ms: self.get_latency(),
            state: self.get_state(),
        }
    }

    /// Reset all metrics.
    pub fn reset(&self) {
        self.fill_level.store(0, Ordering::Relaxed);
        self.underrun_count.store(0, Ordering::Relaxed);
        self.overrun_count.store(0, Ordering::Relaxed);
        self.latency_ms.store(0, Ordering::Relaxed);
        self.state.store(StreamState::Idle as u8, Ordering::Release);
    }
}

impl Default for HealthMonitor {
    fn default() -> Self {
        Self::new()
    }
}

/// Snapshot of health metrics at a point in time.
#[derive(Debug, Clone)]
pub struct HealthMetrics {
    /// Buffer fill level (0.0 - 1.0)
    pub fill_level: f32,
    /// Number of underrun events
    pub underrun_count: u64,
    /// Number of overrun events
    pub overrun_count: u64,
    /// Estimated latency in milliseconds
    pub latency_ms: u32,
    /// Current stream state
    pub state: StreamState,
}

impl HealthMetrics {
    /// Check if the buffer is healthy (no recent issues).
    pub fn is_healthy(&self) -> bool {
        self.fill_level > 0.1 && self.state == StreamState::Running
    }

    /// Check if buffer is starving (near empty).
    pub fn is_starving(&self) -> bool {
        self.fill_level < 0.1 && self.state == StreamState::Running
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fill_level() {
        let health = HealthMonitor::new();

        health.set_fill_level(0.5);
        assert!((health.get_fill_level() - 0.5).abs() < 0.01);

        health.set_fill_level(1.0);
        assert!((health.get_fill_level() - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_underrun_tracking() {
        let health = HealthMonitor::new();

        assert_eq!(health.get_underrun_count(), 0);

        health.record_underrun();
        health.record_underrun();
        health.record_underrun();

        assert_eq!(health.get_underrun_count(), 3);
    }

    #[test]
    fn test_snapshot() {
        let health = HealthMonitor::new();

        health.set_fill_level(0.75);
        health.record_underrun();
        health.set_latency(50);
        health.set_state(StreamState::Running);

        let snapshot = health.snapshot();

        assert!((snapshot.fill_level - 0.75).abs() < 0.01);
        assert_eq!(snapshot.underrun_count, 1);
        assert_eq!(snapshot.latency_ms, 50);
        assert_eq!(snapshot.state, StreamState::Running);
    }
}
