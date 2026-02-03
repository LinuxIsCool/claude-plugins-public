#!/usr/bin/env python3
"""
Whisper STT Inference Server

JSON-RPC server for faster-whisper speech-to-text transcription.
Communicates via stdin/stdout for integration with TypeScript adapter.

Supports:
- Batch transcription with word-level timestamps
- Streaming transcription with real-time events
- Language detection
- Multiple model sizes

Usage:
    python whisper_server.py --model small --device auto

Protocol:
    Request:  {"jsonrpc": "2.0", "id": 1, "method": "transcribe", "params": {...}}
    Response: {"jsonrpc": "2.0", "id": 1, "result": {...}}
    Error:    {"jsonrpc": "2.0", "id": 1, "error": {"code": -1, "message": "..."}}
"""

import base64
import json
import os
import sys
import threading
import time
import queue
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field


def log(message: str) -> None:
    """Log to stderr (doesn't interfere with JSON-RPC on stdout)."""
    print(f"[whisper_server] {message}", file=sys.stderr, flush=True)


@dataclass
class StreamSession:
    """Manages state for a streaming transcription session."""
    session_id: str
    options: Dict[str, Any]
    audio_chunks: List[bytes] = field(default_factory=list)
    is_final: bool = False
    cancelled: bool = False
    lock: threading.Lock = field(default_factory=threading.Lock)


class WhisperInferenceServer:
    """Whisper model wrapper with batch and streaming support."""

    def __init__(self, model_size: str = "small", device: str = "auto", compute_type: str = "auto"):
        self.model_size = model_size
        self.device = self._resolve_device(device)
        self.compute_type = self._resolve_compute_type(compute_type)
        self.model = None
        self.sessions: Dict[str, StreamSession] = {}
        self.session_threads: Dict[str, threading.Thread] = {}
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

    def _resolve_compute_type(self, compute_type: str) -> str:
        """Resolve 'auto' to optimal compute type for device."""
        if compute_type != "auto":
            return compute_type
        # int8 is fastest for CPU, float16 for GPU
        return "float16" if self.device == "cuda" else "int8"

    def _load_model(self) -> None:
        """Load Whisper model (cached on subsequent calls)."""
        if self.model is not None:
            return

        log(f"Loading Whisper model '{self.model_size}' on {self.device} ({self.compute_type})...")
        start = time.time()

        from faster_whisper import WhisperModel

        self.model = WhisperModel(
            self.model_size,
            device=self.device,
            compute_type=self.compute_type,
        )

        load_time = time.time() - start
        log(f"Model loaded in {load_time:.2f}s")

    def _segment_to_dict(self, segment, include_words: bool = False) -> Dict[str, Any]:
        """Convert a faster-whisper segment to a dictionary."""
        seg_dict = {
            "text": segment.text.strip(),
            "startMs": int(segment.start * 1000),
            "endMs": int(segment.end * 1000),
            "confidence": 1.0 - segment.no_speech_prob if hasattr(segment, 'no_speech_prob') else None,
        }

        if include_words and segment.words:
            seg_dict["words"] = [
                {
                    "word": word.word.strip(),
                    "startMs": int(word.start * 1000),
                    "endMs": int(word.end * 1000),
                    "confidence": word.probability if hasattr(word, 'probability') else None,
                }
                for word in segment.words
            ]

        return seg_dict

    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        beam_size: int = 5,
        vad_filter: bool = True,
        word_timestamps: bool = False,
        initial_prompt: Optional[str] = None,
        temperature: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Transcribe audio file (batch mode).

        Args:
            audio_path: Path to audio file
            language: Language code (None for auto-detect)
            beam_size: Beam search width
            vad_filter: Filter out silence
            word_timestamps: Include word-level timing
            initial_prompt: Context prompt for better accuracy
            temperature: Sampling temperature (0 for greedy)

        Returns:
            Transcription result with text, segments, language, timing
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        start_time = time.time()

        segments_iter, info = self.model.transcribe(
            audio_path,
            language=language,
            beam_size=beam_size,
            vad_filter=vad_filter,
            word_timestamps=word_timestamps,
            initial_prompt=initial_prompt,
            temperature=temperature,
        )

        # Collect segments
        segments = []
        text_parts = []

        for segment in segments_iter:
            seg_dict = self._segment_to_dict(segment, include_words=word_timestamps)
            segments.append(seg_dict)
            text_parts.append(segment.text)

        processing_time = time.time() - start_time

        return {
            "text": " ".join(text_parts).strip(),
            "segments": segments,
            "language": info.language,
            "languageConfidence": info.language_probability,
            "durationMs": int(info.duration * 1000),
            "processingTimeMs": int(processing_time * 1000),
            "model": self.model_size,
        }

    def detect_language(self, audio_path: str) -> Dict[str, Any]:
        """
        Detect spoken language in audio file.

        Args:
            audio_path: Path to audio file

        Returns:
            Language code and confidence
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Use first 30 seconds for detection
        _, info = self.model.transcribe(
            audio_path,
            beam_size=1,  # Fast detection
            vad_filter=False,
        )

        return {
            "language": info.language,
            "confidence": info.language_probability,
        }

    def start_stream(self, session_id: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """
        Start a streaming transcription session.

        Args:
            session_id: Unique session identifier
            options: Transcription options

        Returns:
            Status confirmation
        """
        if session_id in self.sessions:
            raise ValueError(f"Session already exists: {session_id}")

        session = StreamSession(session_id=session_id, options=options)
        self.sessions[session_id] = session

        # Start processing thread
        thread = threading.Thread(
            target=self._stream_worker,
            args=(session,),
            daemon=True,
        )
        self.session_threads[session_id] = thread
        thread.start()

        return {"status": "started", "session_id": session_id}

    def add_audio_chunk(
        self,
        session_id: str,
        chunk_base64: str,
        is_final: bool = False
    ) -> None:
        """
        Add an audio chunk to a streaming session.

        Args:
            session_id: Session identifier
            chunk_base64: Base64-encoded audio data
            is_final: True if this is the last chunk
        """
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        chunk = base64.b64decode(chunk_base64)

        with session.lock:
            session.audio_chunks.append(chunk)
            if is_final:
                session.is_final = True

    def cancel_stream(self, session_id: str) -> Dict[str, Any]:
        """
        Cancel a streaming session.

        Args:
            session_id: Session identifier

        Returns:
            Status confirmation
        """
        session = self.sessions.get(session_id)
        if not session:
            return {"status": "not_found"}

        with session.lock:
            session.cancelled = True

        return {"status": "cancelled"}

    def _stream_worker(self, session: StreamSession) -> None:
        """Background thread for processing streaming audio."""
        import tempfile
        import numpy as np

        try:
            accumulated_audio = b""
            last_process_time = time.time()
            process_interval = 1.0  # Process every 1 second of audio

            while True:
                # Check for cancellation
                with session.lock:
                    if session.cancelled:
                        self._send_stream_event(session.session_id, {
                            "type": "error",
                            "error": {"message": "Stream cancelled by user"}
                        })
                        break

                    # Get new chunks
                    new_chunks = session.audio_chunks.copy()
                    session.audio_chunks.clear()
                    is_final = session.is_final

                if new_chunks:
                    accumulated_audio += b"".join(new_chunks)

                # Check if we should process
                current_time = time.time()
                should_process = (
                    is_final or
                    (current_time - last_process_time >= process_interval and len(accumulated_audio) > 0)
                )

                if should_process and accumulated_audio:
                    # Write to temp file for processing
                    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                        temp_path = f.name
                        f.write(accumulated_audio)

                    try:
                        # Transcribe accumulated audio
                        options = session.options
                        segments_iter, info = self.model.transcribe(
                            temp_path,
                            language=options.get("language"),
                            beam_size=options.get("beam_size", 5),
                            vad_filter=options.get("vad_filter", True),
                            word_timestamps=options.get("word_timestamps", True),
                        )

                        # Emit segment events
                        all_segments = []
                        include_words = options.get("word_timestamps", True)
                        for segment in segments_iter:
                            # Emit VAD events
                            if segment.no_speech_prob < 0.5:
                                self._send_stream_event(session.session_id, {
                                    "type": "vad",
                                    "isSpeech": True,
                                    "timestampMs": int(segment.start * 1000)
                                })

                            # Convert segment using shared helper
                            seg_dict = self._segment_to_dict(segment, include_words=include_words)
                            all_segments.append(seg_dict)

                            if is_final:
                                self._send_stream_event(session.session_id, {
                                    "type": "final",
                                    "segment": seg_dict
                                })
                            else:
                                self._send_stream_event(session.session_id, {
                                    "type": "partial",
                                    "text": segment.text.strip(),
                                    "isFinal": False,
                                    "timestampMs": int(segment.start * 1000)
                                })

                            # End of speech VAD event
                            self._send_stream_event(session.session_id, {
                                "type": "vad",
                                "isSpeech": False,
                                "timestampMs": int(segment.end * 1000)
                            })

                        last_process_time = current_time

                        # If final, send completion event
                        if is_final:
                            full_text = " ".join(s["text"] for s in all_segments).strip()
                            self._send_stream_event(session.session_id, {
                                "type": "completed",
                                "result": {
                                    "text": full_text,
                                    "segments": all_segments,
                                    "language": info.language,
                                    "languageConfidence": info.language_probability,
                                    "durationMs": int(info.duration * 1000),
                                    "model": self.model_size,
                                }
                            })
                            break

                    finally:
                        try:
                            os.unlink(temp_path)
                        except OSError:
                            pass

                elif is_final and not accumulated_audio:
                    # Final signal with no audio - send empty completion
                    self._send_stream_event(session.session_id, {
                        "type": "completed",
                        "result": {
                            "text": "",
                            "segments": [],
                            "language": "en",
                            "durationMs": 0,
                            "model": self.model_size,
                        }
                    })
                    break
                else:
                    # Wait for more audio
                    time.sleep(0.1)

        except Exception as e:
            log(f"Stream error: {e}")
            self._send_stream_event(session.session_id, {
                "type": "error",
                "error": {"message": str(e)}
            })
        finally:
            # Cleanup session
            self._cleanup_session(session.session_id)

    def _send_stream_event(self, session_id: str, event: Dict[str, Any]) -> None:
        """Send a streaming event notification."""
        notification = {
            "jsonrpc": "2.0",
            "method": "stream_event",
            "params": {
                "session_id": session_id,
                "event": event
            }
        }
        print(json.dumps(notification), flush=True)

    def _cleanup_session(self, session_id: str) -> None:
        """Clean up a streaming session."""
        self.sessions.pop(session_id, None)
        self.session_threads.pop(session_id, None)

    def health(self) -> Dict[str, Any]:
        """Health check."""
        return {
            "status": "ok",
            "model": self.model_size,
            "device": self.device,
            "compute_type": self.compute_type,
            "model_loaded": self.model is not None,
            "active_sessions": len(self.sessions),
        }


class JSONRPCHandler:
    """JSON-RPC 2.0 protocol handler."""

    def __init__(self, server: WhisperInferenceServer):
        self.server = server
        self.methods = {
            "transcribe": self._transcribe,
            "detect_language": self._detect_language,
            "start_stream": self._start_stream,
            "audio_chunk": self._audio_chunk,
            "cancel_stream": self._cancel_stream,
            "health": self._health,
            "shutdown": self._shutdown,
        }
        self.running = True

    def _transcribe(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return self.server.transcribe(
            audio_path=params["audio_path"],
            language=params.get("language"),
            beam_size=params.get("beam_size", 5),
            vad_filter=params.get("vad_filter", True),
            word_timestamps=params.get("word_timestamps", False),
            initial_prompt=params.get("initial_prompt"),
            temperature=params.get("temperature", 0.0),
        )

    def _detect_language(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return self.server.detect_language(
            audio_path=params["audio_path"],
        )

    def _start_stream(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return self.server.start_stream(
            session_id=params["session_id"],
            options=params.get("options", {}),
        )

    def _audio_chunk(self, params: Dict[str, Any]) -> None:
        """Handle audio chunk (notification - no response)."""
        self.server.add_audio_chunk(
            session_id=params["session_id"],
            chunk_base64=params["chunk_base64"],
            is_final=params.get("is_final", False),
        )

    def _cancel_stream(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return self.server.cancel_stream(
            session_id=params["session_id"],
        )

    def _health(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return self.server.health()

    def _shutdown(self, params: Dict[str, Any]) -> Dict[str, Any]:
        self.running = False
        return {"status": "shutting_down"}

    def handle_request(self, request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Process a single JSON-RPC request."""
        req_id = request.get("id")  # May be None for notifications
        method = request.get("method")
        params = request.get("params", {})

        if method not in self.methods:
            if req_id is not None:
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {
                        "code": -32601,
                        "message": f"Method not found: {method}",
                    },
                }
            return None  # Don't respond to unknown notifications

        try:
            result = self.methods[method](params)

            # Notifications (no id) don't get responses
            if req_id is None:
                return None

            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": result,
            }
        except Exception as e:
            log(f"Error in {method}: {e}")
            if req_id is None:
                return None

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

                if response is not None:
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
    import argparse

    parser = argparse.ArgumentParser(description="Whisper STT Inference Server")
    parser.add_argument(
        "--model",
        default="small",
        choices=["tiny", "base", "small", "medium", "large-v3", "turbo"],
        help="Model size (default: small)"
    )
    parser.add_argument(
        "--device",
        default="auto",
        choices=["auto", "cuda", "cpu"],
        help="Device for inference (default: auto)"
    )
    parser.add_argument(
        "--compute-type",
        default="auto",
        choices=["auto", "int8", "float16", "float32"],
        help="Compute type (default: auto)"
    )
    args = parser.parse_args()

    try:
        log(f"Starting Whisper server (model={args.model}, device={args.device})...")
        server = WhisperInferenceServer(
            model_size=args.model,
            device=args.device,
            compute_type=args.compute_type,
        )
        handler = JSONRPCHandler(server)
        handler.run()
        log("Server shutdown complete")
    except Exception as e:
        log(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
