#!/usr/bin/env python3
"""
Audio Capture Server

Captures audio from microphone using sounddevice and streams
audio chunks via stdout. Uses binary protocol for efficiency.

Protocol:
  Each chunk is prefixed with a 4-byte little-endian length,
  followed by raw PCM data (int16).

Usage:
  python audio_capture.py --device default --sample-rate 16000 --channels 1 --chunk-size 512
"""

import argparse
import struct
import sys
import signal
import sounddevice as sd
import numpy as np
from threading import Event

# Global shutdown event
shutdown_event = Event()


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    shutdown_event.set()


def main():
    parser = argparse.ArgumentParser(description="Audio capture server")
    parser.add_argument("--device", default="default", help="Audio device")
    parser.add_argument("--sample-rate", type=int, default=16000, help="Sample rate")
    parser.add_argument("--channels", type=int, default=1, help="Number of channels")
    parser.add_argument("--chunk-size", type=int, default=512, help="Samples per chunk")
    args = parser.parse_args()

    # Setup signal handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    # Resolve device
    device = None if args.device == "default" else args.device
    if device and device.isdigit():
        device = int(device)

    # Print ready signal to stderr (stdout is for audio data)
    print(f"[audio_capture] Starting capture: device={args.device}, rate={args.sample_rate}, channels={args.channels}, chunk={args.chunk_size}", file=sys.stderr)
    print("READY", file=sys.stderr, flush=True)

    try:
        # Open input stream
        with sd.InputStream(
            device=device,
            samplerate=args.sample_rate,
            channels=args.channels,
            blocksize=args.chunk_size,
            dtype=np.int16,
        ) as stream:
            while not shutdown_event.is_set():
                # Read audio chunk
                data, overflowed = stream.read(args.chunk_size)

                if overflowed:
                    print("[audio_capture] Buffer overflow!", file=sys.stderr)

                # Check again before writing to prevent partial chunks on signal
                if shutdown_event.is_set():
                    break

                # Convert to bytes (int16 PCM)
                pcm_data = data.tobytes()

                # Write length-prefixed chunk to stdout atomically
                # Combine length and data into single write to prevent partial output
                length = len(pcm_data)
                chunk = struct.pack("<I", length) + pcm_data
                sys.stdout.buffer.write(chunk)
                sys.stdout.buffer.flush()

    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"[audio_capture] Error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        print("[audio_capture] Shutting down", file=sys.stderr)


if __name__ == "__main__":
    main()
