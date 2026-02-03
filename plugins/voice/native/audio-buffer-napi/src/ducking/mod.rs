//! Audio ducking strategies.
//!
//! This module provides different algorithms for reducing the volume
//! of background audio when higher priority audio plays.

use std::collections::HashMap;
use crate::backend::StreamHandle;

/// Information about a stream for ducking calculation.
#[derive(Debug, Clone)]
pub struct StreamInfo {
    pub handle: StreamHandle,
    pub priority: u8,  // 0-100, higher = more important
    pub current_volume: f32,
    pub target_volume: f32,
}

/// Result of ducking calculation - volume changes to apply.
pub type VolumeMatrix = HashMap<StreamHandle, f32>;

/// Trait for ducking strategies.
pub trait DuckingStrategy: Send + Sync {
    /// Calculate new volumes for all streams based on priorities.
    fn calculate_volumes(&self, streams: &[StreamInfo]) -> VolumeMatrix;

    /// Get the name of this strategy.
    fn name(&self) -> &str;
}

/// Simple ducking - instantly reduce lower priority streams.
pub struct SimpleDucker {
    /// Volume level for ducked streams (0.0 - 1.0)
    pub duck_level: f32,
}

impl SimpleDucker {
    pub fn new(duck_level: f32) -> Self {
        Self {
            duck_level: duck_level.clamp(0.0, 1.0),
        }
    }
}

impl Default for SimpleDucker {
    fn default() -> Self {
        Self::new(0.3)  // Default to 30% volume
    }
}

impl DuckingStrategy for SimpleDucker {
    fn calculate_volumes(&self, streams: &[StreamInfo]) -> VolumeMatrix {
        let mut result = VolumeMatrix::new();

        if streams.is_empty() {
            return result;
        }

        // Find the highest priority
        let max_priority = streams.iter().map(|s| s.priority).max().unwrap_or(0);

        for stream in streams {
            if stream.priority == max_priority {
                // Highest priority streams stay at full volume
                result.insert(stream.handle, 1.0);
            } else {
                // Lower priority streams get ducked
                result.insert(stream.handle, self.duck_level);
            }
        }

        result
    }

    fn name(&self) -> &str {
        "simple"
    }
}

/// Gradual ducking with fade in/out.
pub struct FadeDucker {
    /// Volume level for ducked streams
    pub duck_level: f32,
    /// Fade duration in milliseconds
    pub fade_duration_ms: u32,
    /// Current fade progress per stream (0.0 = at target, 1.0 = at current)
    fade_progress: HashMap<StreamHandle, f32>,
}

impl FadeDucker {
    pub fn new(duck_level: f32, fade_duration_ms: u32) -> Self {
        Self {
            duck_level: duck_level.clamp(0.0, 1.0),
            fade_duration_ms,
            fade_progress: HashMap::new(),
        }
    }

    /// Update fade progress based on elapsed time.
    pub fn update(&mut self, elapsed_ms: u32) {
        let step = elapsed_ms as f32 / self.fade_duration_ms as f32;

        for progress in self.fade_progress.values_mut() {
            *progress = (*progress - step).max(0.0);
        }
    }
}

impl Default for FadeDucker {
    fn default() -> Self {
        Self::new(0.3, 200)  // 200ms fade
    }
}

impl DuckingStrategy for FadeDucker {
    fn calculate_volumes(&self, streams: &[StreamInfo]) -> VolumeMatrix {
        let mut result = VolumeMatrix::new();

        if streams.is_empty() {
            return result;
        }

        let max_priority = streams.iter().map(|s| s.priority).max().unwrap_or(0);

        for stream in streams {
            let target = if stream.priority == max_priority {
                1.0
            } else {
                self.duck_level
            };

            // Apply fade if we have progress data
            let progress = self.fade_progress.get(&stream.handle).copied().unwrap_or(0.0);
            let volume = stream.current_volume * progress + target * (1.0 - progress);

            result.insert(stream.handle, volume);
        }

        result
    }

    fn name(&self) -> &str {
        "fade"
    }
}

/// Priority-proportional ducking.
///
/// Lower priority streams are ducked more than slightly-lower priority streams.
pub struct ProportionalDucker {
    /// Minimum volume for lowest priority
    pub min_volume: f32,
}

impl ProportionalDucker {
    pub fn new(min_volume: f32) -> Self {
        Self {
            min_volume: min_volume.clamp(0.0, 1.0),
        }
    }
}

impl Default for ProportionalDucker {
    fn default() -> Self {
        Self::new(0.1)
    }
}

impl DuckingStrategy for ProportionalDucker {
    fn calculate_volumes(&self, streams: &[StreamInfo]) -> VolumeMatrix {
        let mut result = VolumeMatrix::new();

        if streams.is_empty() {
            return result;
        }

        let max_priority = streams.iter().map(|s| s.priority).max().unwrap_or(100) as f32;
        let min_priority = streams.iter().map(|s| s.priority).min().unwrap_or(0) as f32;
        let range = (max_priority - min_priority).max(1.0);

        for stream in streams {
            // Scale volume proportionally to priority
            let normalized = (stream.priority as f32 - min_priority) / range;
            let volume = self.min_volume + normalized * (1.0 - self.min_volume);

            result.insert(stream.handle, volume);
        }

        result
    }

    fn name(&self) -> &str {
        "proportional"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_streams(priorities: &[u8]) -> Vec<StreamInfo> {
        priorities
            .iter()
            .enumerate()
            .map(|(i, &p)| StreamInfo {
                handle: StreamHandle::new(i as u32 + 1),
                priority: p,
                current_volume: 1.0,
                target_volume: 1.0,
            })
            .collect()
    }

    #[test]
    fn test_simple_ducker() {
        let ducker = SimpleDucker::new(0.3);
        let streams = make_streams(&[50, 100, 50]);

        let volumes = ducker.calculate_volumes(&streams);

        // Highest priority (100) should be full volume
        assert!((volumes[&StreamHandle::new(2)] - 1.0).abs() < 0.01);

        // Lower priorities should be ducked
        assert!((volumes[&StreamHandle::new(1)] - 0.3).abs() < 0.01);
        assert!((volumes[&StreamHandle::new(3)] - 0.3).abs() < 0.01);
    }

    #[test]
    fn test_proportional_ducker() {
        let ducker = ProportionalDucker::new(0.1);
        let streams = make_streams(&[0, 50, 100]);

        let volumes = ducker.calculate_volumes(&streams);

        // Highest priority should be full volume
        assert!((volumes[&StreamHandle::new(3)] - 1.0).abs() < 0.01);

        // Middle priority should be ~0.55
        assert!((volumes[&StreamHandle::new(2)] - 0.55).abs() < 0.1);

        // Lowest priority should be min_volume
        assert!((volumes[&StreamHandle::new(1)] - 0.1).abs() < 0.01);
    }
}
