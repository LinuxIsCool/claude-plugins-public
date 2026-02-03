//! Lock-free ring buffer for audio streaming.
//!
//! Designed for single-producer, single-consumer (SPSC) scenarios where:
//! - Producer: TypeScript code writing audio samples
//! - Consumer: PipeWire audio callback reading samples
//!
//! The buffer uses power-of-2 sizing for efficient modulo operations.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::cell::UnsafeCell;

/// Lock-free ring buffer for audio samples.
///
/// Thread-safe for single producer, single consumer.
/// Uses relaxed atomics for indices since we only need visibility, not ordering.
pub struct RingBuffer {
    /// Sample storage
    buffer: Box<[UnsafeCell<f32>]>,
    /// Capacity (power of 2)
    capacity: usize,
    /// Mask for efficient modulo (capacity - 1)
    mask: usize,
    /// Read position (consumer)
    read_pos: AtomicUsize,
    /// Write position (producer)
    write_pos: AtomicUsize,
}

// SAFETY: RingBuffer is designed for SPSC where producer and consumer
// are on different threads. The indices are atomic and buffer cells
// are only accessed by one thread at a time.
unsafe impl Send for RingBuffer {}
unsafe impl Sync for RingBuffer {}

impl RingBuffer {
    /// Create a new ring buffer with the given capacity.
    ///
    /// Capacity will be rounded up to the next power of 2.
    pub fn new(min_capacity: usize) -> Self {
        // Round up to power of 2 for efficient modulo
        let capacity = min_capacity.next_power_of_two();
        let mask = capacity - 1;

        // Initialize buffer with zeros
        let buffer: Vec<UnsafeCell<f32>> = (0..capacity)
            .map(|_| UnsafeCell::new(0.0))
            .collect();

        Self {
            buffer: buffer.into_boxed_slice(),
            capacity,
            mask,
            read_pos: AtomicUsize::new(0),
            write_pos: AtomicUsize::new(0),
        }
    }

    /// Create a ring buffer sized for a given duration at sample rate.
    pub fn for_duration(sample_rate: u32, channels: u32, duration_ms: u32) -> Self {
        let samples = (sample_rate as usize) * (channels as usize) * (duration_ms as usize) / 1000;
        // Add some headroom
        Self::new(samples * 2)
    }

    /// Write samples to the buffer.
    ///
    /// Returns the number of samples actually written.
    /// May return less than `samples.len()` if buffer is full.
    pub fn write(&self, samples: &[f32]) -> usize {
        let read = self.read_pos.load(Ordering::Relaxed);
        let write = self.write_pos.load(Ordering::Relaxed);

        let available = self.capacity - (write.wrapping_sub(read));
        let to_write = samples.len().min(available);

        for (i, &sample) in samples.iter().take(to_write).enumerate() {
            let idx = (write + i) & self.mask;
            // SAFETY: Only producer thread writes to this index
            unsafe {
                *self.buffer[idx].get() = sample;
            }
        }

        self.write_pos.store(write.wrapping_add(to_write), Ordering::Release);
        to_write
    }

    /// Read samples from the buffer.
    ///
    /// Returns the number of samples actually read.
    /// May return less than `output.len()` if buffer doesn't have enough data.
    pub fn read(&self, output: &mut [f32]) -> usize {
        let read = self.read_pos.load(Ordering::Relaxed);
        let write = self.write_pos.load(Ordering::Acquire);

        let available = write.wrapping_sub(read);
        let to_read = output.len().min(available);

        for i in 0..to_read {
            let idx = (read + i) & self.mask;
            // SAFETY: Only consumer thread reads from this index
            unsafe {
                output[i] = *self.buffer[idx].get();
            }
        }

        self.read_pos.store(read.wrapping_add(to_read), Ordering::Release);
        to_read
    }

    /// Peek at samples without consuming them.
    ///
    /// Returns the number of samples actually peeked.
    pub fn peek(&self, output: &mut [f32]) -> usize {
        let read = self.read_pos.load(Ordering::Relaxed);
        let write = self.write_pos.load(Ordering::Acquire);

        let available = write.wrapping_sub(read);
        let to_read = output.len().min(available);

        for i in 0..to_read {
            let idx = (read + i) & self.mask;
            unsafe {
                output[i] = *self.buffer[idx].get();
            }
        }

        to_read
    }

    /// Number of samples available to read.
    pub fn available_read(&self) -> usize {
        let read = self.read_pos.load(Ordering::Relaxed);
        let write = self.write_pos.load(Ordering::Acquire);
        write.wrapping_sub(read)
    }

    /// Number of samples that can be written.
    pub fn available_write(&self) -> usize {
        let read = self.read_pos.load(Ordering::Acquire);
        let write = self.write_pos.load(Ordering::Relaxed);
        self.capacity - write.wrapping_sub(read)
    }

    /// Total capacity in samples.
    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// Fill percentage (0.0 - 1.0).
    pub fn fill_percent(&self) -> f32 {
        self.available_read() as f32 / self.capacity as f32
    }

    /// Clear all samples from the buffer.
    pub fn clear(&self) {
        self.read_pos.store(0, Ordering::Release);
        self.write_pos.store(0, Ordering::Release);
    }

    /// Check if buffer is empty.
    pub fn is_empty(&self) -> bool {
        self.available_read() == 0
    }

    /// Check if buffer is full.
    pub fn is_full(&self) -> bool {
        self.available_write() == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_write_read_basic() {
        let buffer = RingBuffer::new(8);
        let samples = [0.1, 0.2, 0.3, 0.4];

        let written = buffer.write(&samples);
        assert_eq!(written, 4);
        assert_eq!(buffer.available_read(), 4);

        let mut output = [0.0; 4];
        let read = buffer.read(&mut output);

        assert_eq!(read, 4);
        assert!((output[0] - 0.1).abs() < 0.001);
        assert!((output[3] - 0.4).abs() < 0.001);
    }

    #[test]
    fn test_wrap_around() {
        let buffer = RingBuffer::new(8); // Actual capacity will be 8

        // Fill partially
        let samples1 = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0];
        buffer.write(&samples1);

        // Read some
        let mut output1 = [0.0; 4];
        buffer.read(&mut output1);

        // Write more (causes wrap)
        let samples2 = [7.0, 8.0, 9.0, 10.0];
        buffer.write(&samples2);

        // Read all
        let mut output2 = [0.0; 6];
        let read = buffer.read(&mut output2);

        assert_eq!(read, 6);
        assert!((output2[0] - 5.0).abs() < 0.001);
        assert!((output2[5] - 10.0).abs() < 0.001);
    }

    #[test]
    fn test_fill_percent() {
        let buffer = RingBuffer::new(100); // Power of 2: 128

        buffer.write(&vec![0.0; 64]);
        assert!((buffer.fill_percent() - 0.5).abs() < 0.01);

        buffer.write(&vec![0.0; 64]);
        assert!((buffer.fill_percent() - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_overwrite_protection() {
        let buffer = RingBuffer::new(4);

        // Try to write more than capacity
        let samples = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0];
        let written = buffer.write(&samples);

        // Should only write what fits
        assert!(written <= 4);
    }
}
