#!/usr/bin/env python3
"""
Silero VAD Server

JSON-RPC server for Silero VAD voice activity detection.
Communicates via stdin/stdout for integration with TypeScript adapter.

Usage:
    python silero_server.py [--device auto|cuda|cpu] [--sample-rate 16000]

Protocol:
    Request:  {"jsonrpc": "2.0", "id": 1, "method": "process", "params": {...}}
    Response: {"jsonrpc": "2.0", "id": 1, "result": {...}}
    Error:    {"jsonrpc": "2.0", "id": 1, "error": {"code": -1, "message": "..."}}
"""

import argparse
import base64
import json
import sys
from typing import Optional


def log(message: str) -> None:
    """Log to stderr (doesn't interfere with JSON-RPC on stdout)."""
    print(f"[silero_server] {message}", file=sys.stderr, flush=True)


class SileroVADServer:
    """Silero VAD model wrapper."""

    def __init__(self, device: str = "auto", sample_rate: int = 16000):
        self.device = self._resolve_device(device)
        self.sample_rate = sample_rate
        self.model = None
        self.utils = None
        self._load_model()

    def _resolve_device(self, device: str) -> str:
        """Resolve 'auto' to actual device."""
        if device != "auto":
            return device
        try:
            import torch
            return "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            return "cpu"

    def _load_model(self) -> None:
        """Load Silero VAD model."""
        if self.model is not None:
            return

        log(f"Loading Silero VAD model on {self.device}...")
        import time
        start = time.time()

        import torch
        # Load Silero VAD model from torch hub
        model, utils = torch.hub.load(
            repo_or_dir='snakers4/silero-vad',
            model='silero_vad',
            force_reload=False,
            onnx=False,
        )

        self.model = model.to(self.device)
        self.utils = utils

        # Reset model state
        self.model.reset_states()

        load_time = time.time() - start
        log(f"Model loaded in {load_time:.2f}s")

    def process(
        self,
        audio_base64: str,
        sample_rate: int,
        threshold: float = 0.5,
    ) -> dict:
        """
        Process a single audio chunk.

        Args:
            audio_base64: Base64-encoded audio bytes (int16 PCM)
            sample_rate: Audio sample rate in Hz
            threshold: Speech probability threshold (0.0-1.0)

        Returns:
            dict with is_speech, probability
        """
        import torch
        import numpy as np

        # Decode base64 -> bytes -> int16 array -> float32 tensor
        audio_bytes = base64.b64decode(audio_base64)
        audio_np = np.frombuffer(audio_bytes, dtype=np.int16)
        audio_float = audio_np.astype(np.float32) / 32768.0  # Normalize to [-1, 1]
        audio_tensor = torch.from_numpy(audio_float)

        # Move to device if needed
        if self.device != "cpu":
            audio_tensor = audio_tensor.to(self.device)

        # Get speech probability
        # Silero VAD expects audio tensor and sample rate
        speech_prob = self.model(audio_tensor, sample_rate).item()

        return {
            "is_speech": speech_prob >= threshold,
            "probability": float(speech_prob),
        }

    def reset(self) -> dict:
        """Reset model internal state for new audio stream."""
        if self.model is not None:
            self.model.reset_states()
        return {"status": "reset"}

    def health(self) -> dict:
        """Health check."""
        return {
            "status": "ok",
            "model": "silero_vad",
            "device": self.device,
            "sample_rate": self.sample_rate,
            "model_loaded": self.model is not None,
        }


class JSONRPCHandler:
    """JSON-RPC 2.0 protocol handler."""

    def __init__(self, server: SileroVADServer):
        self.server = server
        self.methods = {
            "process": self._process,
            "reset": self._reset,
            "health": self._health,
            "shutdown": self._shutdown,
        }
        self.running = True

    def _process(self, params: dict) -> dict:
        return self.server.process(
            audio_base64=params["audio_base64"],
            sample_rate=params.get("sample_rate", 16000),
            threshold=params.get("threshold", 0.5),
        )

    def _reset(self, params: dict) -> dict:
        return self.server.reset()

    def _health(self, params: dict) -> dict:
        return self.server.health()

    def _shutdown(self, params: dict) -> dict:
        self.running = False
        return {"status": "shutting_down"}

    def handle_request(self, request: dict) -> dict:
        """Process a single JSON-RPC request."""
        req_id = request.get("id")
        method = request.get("method")
        params = request.get("params", {})

        if method not in self.methods:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {
                    "code": -32601,
                    "message": f"Method not found: {method}",
                },
            }

        try:
            result = self.methods[method](params)
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": result,
            }
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {
                    "code": -1,
                    "message": str(e),
                },
            }

    def run(self) -> None:
        """Main loop: read stdin, process, write stdout."""
        # Signal ready
        ready_msg = {
            "jsonrpc": "2.0",
            "id": None,
            "method": "ready",
            "result": self.server.health(),
        }
        print(json.dumps(ready_msg), flush=True)

        # Process requests
        while self.running:
            try:
                line = sys.stdin.readline()
                if not line:
                    break  # EOF

                line = line.strip()
                if not line:
                    continue

                request = json.loads(line)
                response = self.handle_request(request)
                print(json.dumps(response), flush=True)

            except json.JSONDecodeError as e:
                error_response = {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {
                        "code": -32700,
                        "message": f"Parse error: {e}",
                    },
                }
                print(json.dumps(error_response), flush=True)
            except KeyboardInterrupt:
                break


def main():
    """Entry point."""
    parser = argparse.ArgumentParser(description="Silero VAD Server")
    parser.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    parser.add_argument("--sample-rate", type=int, default=16000)
    args = parser.parse_args()

    try:
        log("Starting Silero VAD server...")
        server = SileroVADServer(device=args.device, sample_rate=args.sample_rate)
        handler = JSONRPCHandler(server)
        handler.run()
        log("Server shutdown complete")
    except Exception as e:
        log(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
