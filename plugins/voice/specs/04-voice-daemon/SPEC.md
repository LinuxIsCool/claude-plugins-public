# Spec: Voice Daemon

**Component**: Background Service
**Priority**: Medium
**Estimated Effort**: 6-8 hours
**Dependencies**: VAD, STT adapter, PipeWire/PulseAudio

---

## Overview

Implement an always-on background daemon that listens for speech, processes voice commands, and routes audio to appropriate handlers. This is the "ears" of the voice system - enabling hands-free interaction with Claude and the development environment.

## Goals

1. Continuous background listening with minimal resource usage
2. Wake word detection ("hey claude" or configurable)
3. Voice command routing (to tmux, Claude, or custom handlers)
4. Graceful startup/shutdown via systemd
5. Hot-reload configuration without restart

## Non-Goals

- GUI interface (CLI/headless only)
- Cloud-based wake word detection (local only)
- Multiple simultaneous listeners

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Voice Daemon                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Audio Input │ -> │     VAD      │ -> │  Wake Word   │  │
│  │  (PipeWire)  │    │  (Silero)    │    │  Detector    │  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘  │
│                                                  │          │
│                                          ┌───────▼───────┐  │
│                                          │  STT Engine   │  │
│                                          │  (Whisper)    │  │
│                                          └───────┬───────┘  │
│                                                  │          │
│                                          ┌───────▼───────┐  │
│                                          │ Intent Router │  │
│                                          └───────┬───────┘  │
│                                                  │          │
│         ┌────────────────────┬──────────────────┼─────┐    │
│         │                    │                  │     │    │
│  ┌──────▼──────┐  ┌─────────▼─────┐  ┌────────▼───┐  │    │
│  │ Tmux Handler│  │ Claude Handler│  │Custom Hook │  │    │
│  │ (navigation)│  │ (input stream)│  │ (extensible│  │    │
│  └─────────────┘  └───────────────┘  └────────────┘  │    │
│                                                       │    │
└───────────────────────────────────────────────────────┴────┘
                            │
                    ┌───────▼───────┐
                    │    Systemd    │
                    │   (manages)   │
                    └───────────────┘
```

---

## Configuration

### Daemon Configuration File

```yaml
# ~/.config/claude-voice/daemon.yaml

# Audio input
audio:
  device: "default"              # PulseAudio/PipeWire device name
  sample_rate: 16000
  channels: 1
  chunk_size: 512               # Samples per chunk

# Voice Activity Detection
vad:
  backend: "silero"
  threshold: 0.5                # Speech probability threshold
  min_speech_ms: 250            # Minimum speech duration
  max_silence_ms: 1000          # Max silence before end of speech
  padding_ms: 300               # Padding around speech

# Wake Word Detection
wake_word:
  enabled: true
  phrases:
    - "hey claude"
    - "okay claude"
  backend: "vosk"               # vosk or pocketsphinx
  sensitivity: 0.5
  timeout_ms: 5000              # How long to listen after wake word

# Speech-to-Text
stt:
  backend: "whisper"
  model: "base.en"              # tiny, base, small, medium, large
  language: "en"
  compute_type: "int8"          # int8, float16, float32

# Intent Routing
routing:
  tmux_prefix: "tmux"           # "tmux switch to window 2"
  claude_prefix: "claude"       # "claude help me with..."
  submit_phrase: "submit"       # Triggers Enter key
  cancel_phrase: "cancel"       # Cancels current input

# Handlers
handlers:
  tmux:
    enabled: true
    socket: "/tmp/tmux-default/default"
  claude:
    enabled: true
    target: "active"            # active, specific session ID
    mode: "stream"              # stream (live) or buffer (on submit)
  custom:
    enabled: false
    script: "~/.config/claude-voice/custom-handler.sh"

# Daemon
daemon:
  pid_file: "/run/user/1000/claude-voice.pid"
  log_file: "~/.local/share/claude-voice/daemon.log"
  log_level: "info"             # debug, info, warn, error
```

---

## Implementation Guide

### File Structure

```
plugins/voice/specs/04-voice-daemon/
├── SPEC.md
├── src/
│   ├── daemon.py               # Main daemon process
│   ├── audio_input.py          # Audio capture
│   ├── vad_processor.py        # Voice activity detection
│   ├── wake_word.py            # Wake word detection
│   ├── intent_router.py        # Route transcripts to handlers
│   ├── handlers/
│   │   ├── tmux_handler.py
│   │   ├── claude_handler.py
│   │   └── custom_handler.py
│   └── config.py               # Configuration loading
├── systemd/
│   └── claude-voice.service    # Systemd unit file
├── tests/
│   ├── test_vad.py
│   ├── test_wake_word.py
│   └── test_routing.py
└── scripts/
    ├── install.sh
    └── uninstall.sh
```

### Main Daemon

```python
# plugins/voice/specs/04-voice-daemon/src/daemon.py

"""
Claude Voice Daemon

Always-on voice interface for Claude Code and tmux.
"""

import asyncio
import signal
import logging
from pathlib import Path

from audio_input import AudioInput
from vad_processor import VADProcessor
from wake_word import WakeWordDetector
from intent_router import IntentRouter
from config import load_config, Config

logger = logging.getLogger("claude-voice")

class VoiceDaemon:
    def __init__(self, config: Config):
        self.config = config
        self.running = False

        # Initialize components
        self.audio = AudioInput(
            device=config.audio.device,
            sample_rate=config.audio.sample_rate,
            channels=config.audio.channels,
            chunk_size=config.audio.chunk_size,
        )

        self.vad = VADProcessor(
            backend=config.vad.backend,
            threshold=config.vad.threshold,
            min_speech_ms=config.vad.min_speech_ms,
            max_silence_ms=config.vad.max_silence_ms,
        )

        self.wake_word = WakeWordDetector(
            phrases=config.wake_word.phrases,
            backend=config.wake_word.backend,
            sensitivity=config.wake_word.sensitivity,
        )

        self.router = IntentRouter(config.routing, config.handlers)

    async def run(self):
        """Main daemon loop."""
        self.running = True
        logger.info("Voice daemon starting...")

        # Setup signal handlers
        for sig in (signal.SIGTERM, signal.SIGINT):
            asyncio.get_event_loop().add_signal_handler(
                sig, lambda: asyncio.create_task(self.shutdown())
            )

        # Write PID file
        pid_file = Path(self.config.daemon.pid_file).expanduser()
        pid_file.parent.mkdir(parents=True, exist_ok=True)
        pid_file.write_text(str(os.getpid()))

        try:
            await self._listen_loop()
        finally:
            pid_file.unlink(missing_ok=True)

    async def _listen_loop(self):
        """Continuous listening loop."""
        while self.running:
            try:
                # Get audio chunk
                audio_chunk = await self.audio.read_chunk()

                # Check for speech
                is_speech = await self.vad.process(audio_chunk)

                if is_speech:
                    # Accumulate speech
                    speech_audio = await self._accumulate_speech(audio_chunk)

                    # Check for wake word (if enabled)
                    if self.config.wake_word.enabled:
                        transcript = await self.wake_word.check(speech_audio)
                        if transcript:
                            # Wake word detected, now listen for command
                            command_audio = await self._listen_for_command()
                            await self._process_command(command_audio)
                    else:
                        # No wake word, process directly
                        await self._process_command(speech_audio)

            except Exception as e:
                logger.error(f"Error in listen loop: {e}")
                await asyncio.sleep(0.1)

    async def _accumulate_speech(self, initial_chunk: bytes) -> bytes:
        """Accumulate speech until silence."""
        chunks = [initial_chunk]
        silence_count = 0
        max_silence = self.config.vad.max_silence_ms // (
            self.config.audio.chunk_size * 1000 // self.config.audio.sample_rate
        )

        while silence_count < max_silence:
            chunk = await self.audio.read_chunk()
            is_speech = await self.vad.process(chunk)

            chunks.append(chunk)

            if is_speech:
                silence_count = 0
            else:
                silence_count += 1

        return b"".join(chunks)

    async def _listen_for_command(self) -> bytes:
        """Listen for command after wake word."""
        logger.info("Listening for command...")

        chunks = []
        start_time = asyncio.get_event_loop().time()
        timeout = self.config.wake_word.timeout_ms / 1000

        while asyncio.get_event_loop().time() - start_time < timeout:
            chunk = await self.audio.read_chunk()
            is_speech = await self.vad.process(chunk)

            if is_speech:
                speech = await self._accumulate_speech(chunk)
                chunks.append(speech)
                break

        return b"".join(chunks)

    async def _process_command(self, audio: bytes):
        """Process speech command."""
        # Transcribe
        transcript = await self.router.stt.transcribe(audio)
        logger.info(f"Transcript: {transcript}")

        # Route to handler
        await self.router.route(transcript)

    async def shutdown(self):
        """Graceful shutdown."""
        logger.info("Shutting down...")
        self.running = False
        await self.audio.close()


async def main():
    config = load_config()

    # Setup logging
    logging.basicConfig(
        level=getattr(logging, config.daemon.log_level.upper()),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.FileHandler(Path(config.daemon.log_file).expanduser()),
            logging.StreamHandler(),
        ],
    )

    daemon = VoiceDaemon(config)
    await daemon.run()


if __name__ == "__main__":
    asyncio.run(main())
```

### Audio Input

```python
# plugins/voice/specs/04-voice-daemon/src/audio_input.py

import asyncio
import numpy as np

class AudioInput:
    def __init__(
        self,
        device: str = "default",
        sample_rate: int = 16000,
        channels: int = 1,
        chunk_size: int = 512,
    ):
        self.device = device
        self.sample_rate = sample_rate
        self.channels = channels
        self.chunk_size = chunk_size
        self.stream = None

    async def open(self):
        """Open audio stream."""
        import sounddevice as sd

        self.stream = sd.InputStream(
            device=self.device if self.device != "default" else None,
            samplerate=self.sample_rate,
            channels=self.channels,
            blocksize=self.chunk_size,
            dtype=np.int16,
        )
        self.stream.start()

    async def read_chunk(self) -> bytes:
        """Read audio chunk."""
        if not self.stream:
            await self.open()

        data, overflowed = self.stream.read(self.chunk_size)
        return data.tobytes()

    async def close(self):
        """Close audio stream."""
        if self.stream:
            self.stream.stop()
            self.stream.close()
            self.stream = None
```

### Intent Router

```python
# plugins/voice/specs/04-voice-daemon/src/intent_router.py

import re
import asyncio
from typing import Optional

class IntentRouter:
    def __init__(self, routing_config, handlers_config):
        self.routing = routing_config
        self.handlers = {}

        if handlers_config.tmux.enabled:
            from handlers.tmux_handler import TmuxHandler
            self.handlers["tmux"] = TmuxHandler(handlers_config.tmux)

        if handlers_config.claude.enabled:
            from handlers.claude_handler import ClaudeHandler
            self.handlers["claude"] = ClaudeHandler(handlers_config.claude)

        if handlers_config.custom.enabled:
            from handlers.custom_handler import CustomHandler
            self.handlers["custom"] = CustomHandler(handlers_config.custom)

        # STT engine
        from stt import create_stt_engine
        self.stt = create_stt_engine(handlers_config.stt)

    async def route(self, transcript: str):
        """Route transcript to appropriate handler."""
        transcript = transcript.lower().strip()

        # Check for tmux prefix
        if transcript.startswith(self.routing.tmux_prefix):
            command = transcript[len(self.routing.tmux_prefix):].strip()
            if "tmux" in self.handlers:
                await self.handlers["tmux"].handle(command)
            return

        # Check for claude prefix
        if transcript.startswith(self.routing.claude_prefix):
            text = transcript[len(self.routing.claude_prefix):].strip()
            if "claude" in self.handlers:
                await self.handlers["claude"].handle(text)
            return

        # Check for submit phrase
        if self.routing.submit_phrase in transcript:
            if "claude" in self.handlers:
                await self.handlers["claude"].submit()
            return

        # Check for cancel phrase
        if self.routing.cancel_phrase in transcript:
            if "claude" in self.handlers:
                await self.handlers["claude"].cancel()
            return

        # Default: send to active Claude session
        if "claude" in self.handlers:
            await self.handlers["claude"].handle(transcript)
```

### Tmux Handler

```python
# plugins/voice/specs/04-voice-daemon/src/handlers/tmux_handler.py

import subprocess
import re

class TmuxHandler:
    def __init__(self, config):
        self.socket = config.socket

    async def handle(self, command: str):
        """Handle tmux voice command."""
        # Parse command
        action = self._parse_command(command)
        if action:
            await self._execute(action)

    def _parse_command(self, command: str) -> Optional[str]:
        """Parse voice command into tmux command."""
        command = command.lower()

        # Window navigation
        if match := re.search(r"(switch|go) to window (\d+)", command):
            return f"select-window -t :{match.group(2)}"

        if "next window" in command:
            return "next-window"

        if "previous window" in command:
            return "previous-window"

        # Pane navigation
        if match := re.search(r"(switch|go) to pane (\d+)", command):
            return f"select-pane -t {match.group(2)}"

        if "next pane" in command:
            return "select-pane -t :.+"

        if "previous pane" in command:
            return "select-pane -t :.-"

        # Pane splitting
        if "split vertical" in command or "vertical split" in command:
            return "split-window -v"

        if "split horizontal" in command or "horizontal split" in command:
            return "split-window -h"

        # Window management
        if "new window" in command:
            return "new-window"

        if "close" in command and "pane" in command:
            return "kill-pane"

        if "close" in command and "window" in command:
            return "kill-window"

        return None

    async def _execute(self, tmux_cmd: str):
        """Execute tmux command."""
        full_cmd = ["tmux", "-S", self.socket, tmux_cmd]
        subprocess.run(full_cmd, check=True)
```

### Claude Handler

```python
# plugins/voice/specs/04-voice-daemon/src/handlers/claude_handler.py

import subprocess
import os

class ClaudeHandler:
    def __init__(self, config):
        self.target = config.target
        self.mode = config.mode
        self.buffer = []

    async def handle(self, text: str):
        """Handle Claude input."""
        if self.mode == "stream":
            # Stream directly to Claude input
            await self._stream_to_claude(text)
        else:
            # Buffer until submit
            self.buffer.append(text)

    async def submit(self):
        """Submit buffered input."""
        if self.buffer:
            full_text = " ".join(self.buffer)
            await self._send_to_claude(full_text)
            self.buffer = []
        else:
            # Just press Enter
            await self._send_key("Enter")

    async def cancel(self):
        """Cancel current input."""
        self.buffer = []
        await self._send_key("Escape")

    async def _stream_to_claude(self, text: str):
        """Stream text to Claude input using tmux send-keys."""
        # Find active Claude pane
        pane = await self._find_claude_pane()
        if pane:
            subprocess.run([
                "tmux", "send-keys", "-t", pane, text
            ])

    async def _send_to_claude(self, text: str):
        """Send complete text to Claude."""
        pane = await self._find_claude_pane()
        if pane:
            subprocess.run([
                "tmux", "send-keys", "-t", pane, text, "Enter"
            ])

    async def _send_key(self, key: str):
        """Send key to Claude pane."""
        pane = await self._find_claude_pane()
        if pane:
            subprocess.run(["tmux", "send-keys", "-t", pane, key])

    async def _find_claude_pane(self) -> Optional[str]:
        """Find tmux pane running Claude."""
        # List all panes and find one running claude
        result = subprocess.run(
            ["tmux", "list-panes", "-a", "-F", "#{pane_id}:#{pane_current_command}"],
            capture_output=True, text=True
        )

        for line in result.stdout.strip().split("\n"):
            pane_id, cmd = line.split(":", 1)
            if "claude" in cmd.lower():
                return pane_id

        return None
```

### Systemd Service

```ini
# plugins/voice/specs/04-voice-daemon/systemd/claude-voice.service

[Unit]
Description=Claude Voice Daemon
Documentation=https://github.com/anthropics/claude-code
After=sound.target pipewire.service
Wants=pipewire.service

[Service]
Type=simple
ExecStart=/usr/bin/python3 %h/.local/share/claude-voice/daemon.py
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5

# Run as user
User=%I

# Environment
Environment=PYTHONUNBUFFERED=1
Environment=XDG_RUNTIME_DIR=/run/user/%U

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=claude-voice

[Install]
WantedBy=default.target
```

### Installation Script

```bash
#!/bin/bash
# plugins/voice/specs/04-voice-daemon/scripts/install.sh

set -e

INSTALL_DIR="$HOME/.local/share/claude-voice"
CONFIG_DIR="$HOME/.config/claude-voice"
SYSTEMD_DIR="$HOME/.config/systemd/user"

echo "Installing Claude Voice Daemon..."

# Create directories
mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$SYSTEMD_DIR"

# Copy daemon files
cp -r src/* "$INSTALL_DIR/"

# Copy default config if not exists
if [ ! -f "$CONFIG_DIR/daemon.yaml" ]; then
    cp config/daemon.yaml.example "$CONFIG_DIR/daemon.yaml"
fi

# Install systemd service
cp systemd/claude-voice.service "$SYSTEMD_DIR/"

# Reload systemd
systemctl --user daemon-reload

echo "Installation complete!"
echo ""
echo "To start the daemon:"
echo "  systemctl --user start claude-voice"
echo ""
echo "To enable on boot:"
echo "  systemctl --user enable claude-voice"
echo ""
echo "Configure at: $CONFIG_DIR/daemon.yaml"
```

---

## Testing Requirements

### Unit Tests

```python
# plugins/voice/specs/04-voice-daemon/tests/test_routing.py

import pytest
from src.handlers.tmux_handler import TmuxHandler

class TestTmuxCommandParsing:
    def test_window_navigation(self):
        handler = TmuxHandler({"socket": "/tmp/tmux"})

        assert handler._parse_command("switch to window 3") == "select-window -t :3"
        assert handler._parse_command("go to window 1") == "select-window -t :1"

    def test_pane_navigation(self):
        handler = TmuxHandler({"socket": "/tmp/tmux"})

        assert handler._parse_command("next pane") == "select-pane -t :.+"
        assert handler._parse_command("previous pane") == "select-pane -t :.-"

    def test_splitting(self):
        handler = TmuxHandler({"socket": "/tmp/tmux"})

        assert handler._parse_command("split vertical") == "split-window -v"
        assert handler._parse_command("horizontal split") == "split-window -h"

    def test_unknown_command(self):
        handler = TmuxHandler({"socket": "/tmp/tmux"})

        assert handler._parse_command("do something random") is None
```

---

## Success Criteria

1. [ ] Daemon starts and runs continuously
2. [ ] Responds to wake word
3. [ ] Routes tmux commands correctly
4. [ ] Streams input to Claude
5. [ ] Systemd service works (start/stop/restart)
6. [ ] Hot-reload config without restart
7. [ ] Resource usage < 5% CPU when idle
8. [ ] Logs to journal and file

---

## Deliverables

```
plugins/voice/specs/04-voice-daemon/
├── SPEC.md
├── src/
│   ├── daemon.py
│   ├── audio_input.py
│   ├── vad_processor.py
│   ├── wake_word.py
│   ├── intent_router.py
│   ├── config.py
│   └── handlers/
│       ├── tmux_handler.py
│       ├── claude_handler.py
│       └── custom_handler.py
├── config/
│   └── daemon.yaml.example
├── systemd/
│   └── claude-voice.service
├── tests/
│   ├── test_vad.py
│   ├── test_wake_word.py
│   └── test_routing.py
├── scripts/
│   ├── install.sh
│   └── uninstall.sh
└── README.md
```
