//! Audio buffer management.
//!
//! This module provides:
//! - Lock-free ring buffer for audio samples (SPSC)
//! - Health monitoring with atomic metrics
//! - Prebuffering state management

pub mod ring;
pub mod health;

pub use ring::RingBuffer;
pub use health::{HealthMonitor, HealthMetrics};
