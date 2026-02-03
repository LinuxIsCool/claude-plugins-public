#!/usr/bin/env python3
"""
XTTS v2 Inference Server

JSON-RPC server for XTTS v2 text-to-speech synthesis.
Communicates via stdin/stdout for integration with TypeScript adapter.

Usage:
    python xtts_server.py

Protocol:
    Request:  {"jsonrpc": "2.0", "id": 1, "method": "synthesize", "params": {...}}
    Response: {"jsonrpc": "2.0", "id": 1, "result": {...}}
    Error:    {"jsonrpc": "2.0", "id": 1, "error": {"code": -1, "message": "..."}}
"""

import base64
import json
import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Optional


class XTTSInferenceServer:
    """XTTS v2 model wrapper with caching."""

    def __init__(self, device: str = "auto"):
        self.device = self._resolve_device(device)
        self.model = None
        self.model_name = "tts_models/multilingual/multi-dataset/xtts_v2"
        self.speaker_embeddings: dict = {}  # Cache: wav_path -> embedding
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
        """Load XTTS model (cached on subsequent calls)."""
        if self.model is not None:
            return

        log(f"Loading XTTS model on {self.device}...")
        start = time.time()

        from TTS.api import TTS
        self.model = TTS(self.model_name).to(self.device)

        load_time = time.time() - start
        log(f"Model loaded in {load_time:.2f}s")

    def synthesize(
        self,
        text: str,
        speaker_wav: Optional[str] = None,
        language: str = "en",
    ) -> dict:
        """
        Synthesize speech from text.

        Args:
            text: Text to synthesize
            speaker_wav: Path to speaker WAV file for voice cloning (optional)
            language: Language code (default: "en")

        Returns:
            dict with audio_base64, duration_ms, sample_rate
        """
        start = time.time()

        # Create temp file for output
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            output_path = f.name

        try:
            # Synthesize
            if speaker_wav and os.path.exists(speaker_wav):
                # Validate speaker audio file
                if not self._validate_audio_file(speaker_wav):
                    raise ValueError(f"Invalid speaker audio file: {speaker_wav}")
                # Voice cloning mode
                self.model.tts_to_file(
                    text=text,
                    speaker_wav=speaker_wav,
                    language=language,
                    file_path=output_path,
                )
            else:
                # Default speaker mode
                self.model.tts_to_file(
                    text=text,
                    language=language,
                    file_path=output_path,
                )

            # Read audio file
            with open(output_path, "rb") as f:
                audio_bytes = f.read()

            # Get duration
            import torchaudio
            waveform, sample_rate = torchaudio.load(output_path)
            duration_s = waveform.shape[1] / sample_rate

            synthesis_time = time.time() - start

            return {
                "audio_base64": base64.b64encode(audio_bytes).decode("utf-8"),
                "duration_ms": int(duration_s * 1000),
                "sample_rate": sample_rate,
                "synthesis_time_ms": int(synthesis_time * 1000),
                "device": self.device,
            }
        finally:
            # Cleanup temp file
            try:
                os.unlink(output_path)
            except OSError:
                pass

    def _is_safe_audio_path(self, path: str) -> bool:
        """
        Validate that a path is safe to use as audio source.
        Prevents path traversal attacks by restricting to allowed directories.
        """
        try:
            real_path = os.path.realpath(path)
            allowed_dirs = [
                os.path.realpath(os.path.expanduser("~/.cache/claude-voice")),
                os.path.realpath(os.path.expanduser("~/Music")),
                os.path.realpath("/tmp"),
            ]
            # Also allow .claude directories in any working directory
            if ".claude" in real_path and "voice" in real_path:
                return True
            return any(real_path.startswith(d + os.sep) or real_path == d for d in allowed_dirs)
        except (OSError, ValueError):
            return False

    def _validate_audio_file(self, path: str) -> bool:
        """Check if file is valid audio."""
        try:
            import torchaudio
            torchaudio.load(path)
            return True
        except Exception:
            return False

    def clone_voice(self, name: str, audio_paths: list[str], cache_dir: str) -> dict:
        """
        Create a cloned voice from audio samples.

        Args:
            name: Name for the cloned voice
            audio_paths: List of paths to audio sample files
            cache_dir: Directory to save the speaker embedding

        Returns:
            dict with speaker_id, embedding_path
        """
        # Validate inputs - check paths exist, are safe, and are valid audio
        valid_paths = [
            p for p in audio_paths
            if os.path.exists(p) and self._is_safe_audio_path(p) and self._validate_audio_file(p)
        ]
        if not valid_paths:
            raise ValueError("No valid audio files provided. Files must be valid audio in allowed directories.")

        # For XTTS, we store the reference audio directly
        # (it uses audio directly, not embeddings like some other models)
        cache_path = Path(cache_dir)
        cache_path.mkdir(parents=True, exist_ok=True)

        # Copy first valid audio as reference
        import shutil
        ref_path = cache_path / f"{name}.wav"
        shutil.copy2(valid_paths[0], ref_path)

        # Save metadata
        metadata = {
            "id": name,
            "name": name,
            "source": "cloned",
            "source_files": valid_paths,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }

        meta_path = cache_path / f"{name}.json"
        with open(meta_path, "w") as f:
            json.dump(metadata, f, indent=2)

        return {
            "speaker_id": name,
            "reference_path": str(ref_path),
            "metadata_path": str(meta_path),
        }

    def list_speakers(self, cache_dir: str) -> list[dict]:
        """
        List available speakers from cache directory.

        Args:
            cache_dir: Directory containing speaker files

        Returns:
            List of speaker metadata dicts
        """
        speakers = []
        cache_path = Path(cache_dir)

        if not cache_path.exists():
            return speakers

        for meta_file in cache_path.glob("*.json"):
            try:
                with open(meta_file) as f:
                    metadata = json.load(f)
                speakers.append(metadata)
            except (json.JSONDecodeError, OSError):
                continue

        return speakers

    def health(self) -> dict:
        """Health check."""
        return {
            "status": "ok",
            "model": self.model_name,
            "device": self.device,
            "model_loaded": self.model is not None,
        }


class JSONRPCHandler:
    """JSON-RPC 2.0 protocol handler."""

    def __init__(self, server: XTTSInferenceServer):
        self.server = server
        self.methods = {
            "synthesize": self._synthesize,
            "clone_voice": self._clone_voice,
            "list_speakers": self._list_speakers,
            "health": self._health,
            "shutdown": self._shutdown,
        }
        self.running = True

    def _synthesize(self, params: dict) -> dict:
        return self.server.synthesize(
            text=params["text"],
            speaker_wav=params.get("speaker_wav"),
            language=params.get("language", "en"),
        )

    def _clone_voice(self, params: dict) -> dict:
        return self.server.clone_voice(
            name=params["name"],
            audio_paths=params["audio_paths"],
            cache_dir=params.get("cache_dir", os.path.expanduser("~/.cache/claude-voice/speakers")),
        )

    def _list_speakers(self, params: dict) -> list:
        return self.server.list_speakers(
            cache_dir=params.get("cache_dir", os.path.expanduser("~/.cache/claude-voice/speakers")),
        )

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


def log(message: str) -> None:
    """Log to stderr (doesn't interfere with JSON-RPC on stdout)."""
    print(f"[xtts_server] {message}", file=sys.stderr, flush=True)


def main():
    """Entry point."""
    import argparse
    parser = argparse.ArgumentParser(description="XTTS v2 Inference Server")
    parser.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    args = parser.parse_args()

    try:
        log("Starting XTTS server...")
        server = XTTSInferenceServer(device=args.device)
        handler = JSONRPCHandler(server)
        handler.run()
        log("Server shutdown complete")
    except Exception as e:
        log(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
