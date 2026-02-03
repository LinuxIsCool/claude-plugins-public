#!/usr/bin/env python3
"""
YouTube Transcript Extraction

Extracts transcripts from YouTube videos and converts to plugin-compatible format.
Integrates with the existing transcripts pipeline.

Usage:
  python youtube-transcript.py <url_or_video_id> [options]

Options:
  --output, -o PATH     Output JSON file path
  --language, -l LANG   Preferred language (default: en)
  --audio               Fallback: download audio and transcribe with Whisper
  --title TITLE         Override video title
  --to-staging          Output to transcripts staging directory

Examples:
  python youtube-transcript.py "https://www.youtube.com/watch?v=kFpLzCVLA20"
  python youtube-transcript.py kFpLzCVLA20 -o transcript.json
  python youtube-transcript.py <url> --audio  # When no captions available
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional


def get_repo_root() -> Path:
    """Find git repository root"""
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent
    )
    if result.returncode == 0:
        return Path(result.stdout.strip())
    return Path(__file__).parent.parent.parent.parent


def get_cache_dir() -> Path:
    """Get YouTube cache directory (shared with TypeScript adapter)"""
    cache_dir = Path.home() / ".claude" / "transcripts" / "youtube-cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def get_cached_transcript(video_id: str, language: str = "en") -> Optional[dict]:
    """Check cache for existing transcript.

    Returns the cached transcript dict if found, None otherwise.
    Cache file format matches TypeScript adapter: {video_id}.{language}.json
    """
    cache_file = get_cache_dir() / f"{video_id}.{language}.json"
    if cache_file.exists():
        try:
            with open(cache_file) as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"[cache] Warning: Could not read cache file: {e}", file=sys.stderr)
    return None


def cache_transcript(video_id: str, language: str, result: dict) -> Path:
    """Save transcript to cache.

    Returns the path to the cached file.
    """
    cache_file = get_cache_dir() / f"{video_id}.{language}.json"
    with open(cache_file, "w") as f:
        json.dump(result, f, indent=2)
    return cache_file


def determine_output_path(to_staging: bool, output: Optional[str], video_id: str) -> Optional[Path]:
    """Determine output path based on args."""
    if to_staging:
        repo_root = get_repo_root()
        staging_dir = repo_root / ".claude" / "transcripts" / "staging"
        staging_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
        return staging_dir / f"{timestamp}-yt-{video_id}.json"
    elif output:
        return Path(output)
    return None


def write_output(result: dict, output_path: Optional[Path], quiet: bool) -> None:
    """Write result to file or stdout."""
    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(result, f, indent=2)
        if not quiet:
            print(f"      Written to: {output_path}")
    else:
        print(json.dumps(result, indent=2))


def print_summary(result: dict, from_cache: bool) -> None:
    """Print extraction summary."""
    print(f"\n{'='*60}")
    message = "Returned from cache!" if from_cache else "Extraction complete!"
    print(message)
    print(f"  Transcript ID: {result.get('id', 'unknown')}")
    print(f"  Utterances: {len(result.get('utterances', []))}")
    duration_ms = result.get('processing', {}).get('duration_ms', 0)
    print(f"  Duration: {duration_ms / 1000 / 60:.1f} min")
    print(f"{'='*60}\n")


def extract_video_id(url_or_id: str) -> str:
    """Extract video ID from YouTube URL or return as-is if already an ID"""
    # Already a video ID (11 chars, alphanumeric + _-)
    if re.match(r'^[0-9A-Za-z_-]{11}$', url_or_id):
        return url_or_id

    patterns = [
        r'(?:v=|/v/)([0-9A-Za-z_-]{11})',
        r'(?:youtu\.be/)([0-9A-Za-z_-]{11})',
        r'(?:embed/)([0-9A-Za-z_-]{11})',
        r'(?:shorts/)([0-9A-Za-z_-]{11})',
    ]

    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)

    raise ValueError(f"Could not extract video ID from: {url_or_id}")


def generate_transcript_id(video_id: str, created_at: int) -> str:
    """Generate a transcript ID"""
    import base64
    data = f"yt:{video_id}:{created_at}".encode()
    hash_bytes = hashlib.sha256(data).digest()[:12]
    b64 = base64.urlsafe_b64encode(hash_bytes).decode().rstrip("=")
    return f"yt_{b64}"


def fetch_video_metadata(video_id: str) -> dict:
    """Fetch video metadata using yt-dlp"""
    try:
        result = subprocess.run(
            ["yt-dlp", "--dump-json", "--skip-download", f"https://www.youtube.com/watch?v={video_id}"],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
    except Exception as e:
        print(f"[metadata] Warning: Could not fetch metadata: {e}", file=sys.stderr)

    return {"id": video_id, "title": f"YouTube Video {video_id}"}


def fetch_transcript_api(video_id: str, language: str = "en") -> Optional[list]:
    """Fetch transcript using youtube-transcript-api"""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi

        ytt = YouTubeTranscriptApi()

        # Try requested language first, then English, then any available
        try:
            transcript = ytt.fetch(video_id, languages=[language, 'en'])
            return list(transcript)
        except Exception:
            pass

        # Try auto-generated transcripts
        try:
            transcript_list = ytt.list_transcripts(video_id)

            # Try generated transcript
            try:
                transcript = transcript_list.find_generated_transcript([language, 'en'])
                return list(transcript.fetch())
            except Exception:
                pass

            # Try any available transcript
            for transcript in transcript_list:
                return list(transcript.fetch())

        except Exception:
            pass

        return None

    except ImportError:
        print("[transcript] youtube-transcript-api not installed", file=sys.stderr)
        print("[transcript] Install with: pip install youtube-transcript-api", file=sys.stderr)
        return None
    except Exception as e:
        print(f"[transcript] API error: {e}", file=sys.stderr)
        return None


def fetch_transcript_ytdlp(video_id: str, language: str = "en") -> Optional[list]:
    """Fetch transcript using yt-dlp subtitle extraction"""
    import tempfile

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            # Download subtitles
            result = subprocess.run([
                "yt-dlp",
                "--write-subs",
                "--write-auto-subs",
                "--sub-langs", f"{language},en",
                "--sub-format", "vtt",
                "--skip-download",
                "-o", f"{tmpdir}/subs",
                f"https://www.youtube.com/watch?v={video_id}"
            ], capture_output=True, text=True, timeout=60)

            # Find the subtitle file
            vtt_files = list(Path(tmpdir).glob("*.vtt"))
            if not vtt_files:
                return None

            # Parse VTT
            return parse_vtt(vtt_files[0])

    except Exception as e:
        print(f"[transcript] yt-dlp error: {e}", file=sys.stderr)
        return None


def parse_vtt(vtt_path: Path) -> list:
    """Parse VTT subtitle file to transcript segments"""
    try:
        import webvtt

        segments = []
        for caption in webvtt.read(str(vtt_path)):
            # Parse timestamp to milliseconds
            start_ms = timestamp_to_ms(caption.start)
            end_ms = timestamp_to_ms(caption.end)

            # Clean text (remove HTML tags, speaker labels like "<v Speaker>")
            text = re.sub(r'<[^>]+>', '', caption.text)
            text = re.sub(r'\n', ' ', text).strip()

            if text:
                segments.append({
                    "text": text,
                    "start": start_ms / 1000,
                    "duration": (end_ms - start_ms) / 1000
                })

        return segments

    except ImportError:
        print("[transcript] webvtt-py not installed", file=sys.stderr)
        print("[transcript] Install with: pip install webvtt-py", file=sys.stderr)
        return None


def timestamp_to_ms(timestamp: str) -> int:
    """Convert VTT timestamp (HH:MM:SS.mmm) to milliseconds"""
    parts = timestamp.replace(',', '.').split(':')
    if len(parts) == 3:
        hours, minutes, seconds = parts
    elif len(parts) == 2:
        hours = 0
        minutes, seconds = parts
    else:
        return 0

    seconds, ms = (seconds.split('.') + ['0'])[:2]
    ms = ms.ljust(3, '0')[:3]

    return (int(hours) * 3600 + int(minutes) * 60 + int(seconds)) * 1000 + int(ms)


def download_audio_and_transcribe(video_id: str, title: str) -> dict:
    """Fallback: Download audio and transcribe with Whisper"""
    import tempfile

    print(f"[audio] Downloading audio for transcription...")

    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = Path(tmpdir) / "audio.wav"

        # Download audio
        result = subprocess.run([
            "yt-dlp",
            "-x",
            "--audio-format", "wav",
            "--audio-quality", "0",
            "-o", str(audio_path).replace('.wav', '.%(ext)s'),
            f"https://www.youtube.com/watch?v={video_id}"
        ], capture_output=True, text=True, timeout=300)

        if result.returncode != 0:
            raise RuntimeError(f"yt-dlp failed: {result.stderr}")

        # Find the actual output file
        wav_files = list(Path(tmpdir).glob("*.wav"))
        if not wav_files:
            # Try other formats yt-dlp might have produced
            audio_files = list(Path(tmpdir).glob("audio.*"))
            if audio_files:
                audio_path = audio_files[0]
            else:
                raise RuntimeError("No audio file produced")
        else:
            audio_path = wav_files[0]

        print(f"[audio] Downloaded: {audio_path.name}")

        # Use existing ingest-meeting.py if available
        ingest_script = Path(__file__).parent / "ingest-meeting.py"
        if ingest_script.exists():
            print("[audio] Using ingest-meeting.py pipeline...")
            result = subprocess.run([
                sys.executable, str(ingest_script),
                str(audio_path),
                "--title", title,
                "--skip-diarization",
                "--output", str(Path(tmpdir) / "result.json")
            ], capture_output=True, text=True, timeout=600)

            if result.returncode == 0:
                with open(Path(tmpdir) / "result.json") as f:
                    return json.load(f)

        # Fallback: Direct Whisper transcription
        print("[audio] Direct Whisper transcription...")
        return transcribe_with_whisper(str(audio_path), title)


def transcribe_with_whisper(audio_path: str, title: str) -> dict:
    """Transcribe audio with Whisper"""
    try:
        from faster_whisper import WhisperModel

        print("[whisper] Loading model...")
        model = WhisperModel("base", device="cpu", compute_type="int8")

        print("[whisper] Transcribing...")
        segments, info = model.transcribe(audio_path, language="en", word_timestamps=True)

        utterances = []
        for i, segment in enumerate(segments):
            utterances.append({
                "index": i,
                "speaker": {"id": "spk_unknown", "name": "Unknown Speaker"},
                "text": segment.text.strip(),
                "start_ms": int(segment.start * 1000),
                "end_ms": int(segment.end * 1000),
                "confidence": {
                    "transcription": 0.9,
                    "speaker": 0.0,
                    "timing": 0.95
                }
            })

        return {
            "utterances": utterances,
            "duration_ms": int(info.duration * 1000),
            "processing": {
                "backend": "faster-whisper",
                "model": "base",
                "language": info.language
            }
        }

    except ImportError:
        raise RuntimeError("faster-whisper not installed. Install with: pip install faster-whisper")


def convert_to_plugin_format(
    video_id: str,
    segments: list,
    metadata: dict,
    title: Optional[str] = None
) -> dict:
    """Convert transcript segments to plugin-compatible format"""

    created_at = int(time.time() * 1000)
    transcript_id = generate_transcript_id(video_id, created_at)

    # Build utterances
    utterances = []
    total_duration_ms = 0

    for i, segment in enumerate(segments):
        # Handle both dict and FetchedTranscriptSnippet objects
        if hasattr(segment, 'start'):
            # FetchedTranscriptSnippet object
            start = segment.start
            duration = segment.duration
            text = segment.text
        else:
            # Dictionary
            start = segment.get("start", 0)
            duration = segment.get("duration", 0)
            text = segment.get("text", "")

        start_ms = int(start * 1000)
        duration_ms = int(duration * 1000)
        end_ms = start_ms + duration_ms
        total_duration_ms = max(total_duration_ms, end_ms)

        utterances.append({
            "index": i,
            "speaker": {
                "id": "spk_unknown",
                "name": "Unknown Speaker"
            },
            "text": text,
            "start_ms": start_ms,
            "end_ms": end_ms,
            "confidence": {
                "transcription": 0.9,  # YouTube captions are generally good
                "speaker": 0.0,        # No speaker identification
                "timing": 0.95
            }
        })

    # Use provided title or metadata title
    final_title = title or metadata.get("title", f"YouTube Video {video_id}")

    return {
        "id": transcript_id,
        "title": final_title,
        "source": {
            "mode": "youtube",
            "video_id": video_id,
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "channel": metadata.get("channel", metadata.get("uploader")),
            "channel_id": metadata.get("channel_id", metadata.get("uploader_id")),
            "upload_date": metadata.get("upload_date"),
            "duration_seconds": metadata.get("duration"),
            "view_count": metadata.get("view_count"),
            "thumbnail": metadata.get("thumbnail"),
        },
        "utterances": utterances,
        "processing": {
            "backend": "youtube-captions",
            "source": "auto" if not metadata.get("subtitles") else "manual",
            "duration_ms": total_duration_ms,
        },
        "status": "complete",
        "created_at": created_at,
        "updated_at": created_at,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Extract transcripts from YouTube videos",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("url", help="YouTube URL or video ID")
    parser.add_argument("--output", "-o", help="Output JSON file path")
    parser.add_argument("--language", "-l", default="en", help="Preferred language (default: en)")
    parser.add_argument("--audio", action="store_true", help="Download audio and transcribe (fallback)")
    parser.add_argument("--title", help="Override video title")
    parser.add_argument("--to-staging", action="store_true", help="Output to staging directory")
    parser.add_argument("--force", "-f", action="store_true", help="Bypass cache and re-fetch transcript")
    parser.add_argument("--quiet", "-q", action="store_true", help="Minimal output")

    args = parser.parse_args()

    # Extract video ID
    try:
        video_id = extract_video_id(args.url)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    if not args.quiet:
        print(f"\n{'='*60}")
        print(f"YouTube Transcript Extraction")
        print(f"Video ID: {video_id}")
        print(f"{'='*60}\n")

    # Check cache first (always log cache status, even in quiet mode)
    if not args.force:
        cached_result = get_cached_transcript(video_id, args.language)
        if cached_result is not None:
            cache_file = get_cache_dir() / f"{video_id}.{args.language}.json"
            print(f"[cache] HIT: {cache_file}")
            output_path = determine_output_path(args.to_staging, args.output, video_id)
            write_output(cached_result, output_path, args.quiet)
            if not args.quiet:
                print_summary(cached_result, from_cache=True)
            return cached_result
    else:
        print(f"[cache] BYPASS: --force flag specified")

    # Fetch metadata
    if not args.quiet:
        print("[1/3] Fetching video metadata...")
    metadata = fetch_video_metadata(video_id)

    if not args.quiet:
        print(f"      Title: {metadata.get('title', 'Unknown')}")
        print(f"      Channel: {metadata.get('channel', metadata.get('uploader', 'Unknown'))}")
        duration = metadata.get('duration', 0)
        print(f"      Duration: {duration // 60}:{duration % 60:02d}")

    # Fetch transcript
    if not args.quiet:
        print("\n[2/3] Extracting transcript...")

    segments = None
    result = None

    if args.audio:
        # Direct audio transcription
        if not args.quiet:
            print("      Mode: Audio download + Whisper transcription")
        result = download_audio_and_transcribe(video_id, args.title or metadata.get('title', f'YouTube {video_id}'))
        # Result is already in plugin format from ingest-meeting.py
        if "utterances" in result and "source" not in result:
            # Need to wrap it
            segments = None  # Use result directly
    else:
        # Try youtube-transcript-api first
        if not args.quiet:
            print("      Trying: youtube-transcript-api...")
        segments = fetch_transcript_api(video_id, args.language)

        if segments is None:
            if not args.quiet:
                print("      Trying: yt-dlp subtitle extraction...")
            segments = fetch_transcript_ytdlp(video_id, args.language)

        if segments is None:
            print("\nNo captions available. Use --audio to download and transcribe.", file=sys.stderr)
            sys.exit(1)

        if not args.quiet:
            print(f"      Found {len(segments)} segments")

    # Convert to plugin format
    if not args.quiet:
        print("\n[3/3] Converting to plugin format...")

    if segments is not None:
        result = convert_to_plugin_format(video_id, segments, metadata, args.title)
    elif result is not None:
        # Already have result from audio transcription, just add YouTube metadata
        result["source"] = {
            "mode": "youtube",
            "video_id": video_id,
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "channel": metadata.get("channel", metadata.get("uploader")),
            "transcription_method": "whisper"
        }
        result["id"] = generate_transcript_id(video_id, int(time.time() * 1000))

    # Cache the result for future requests
    cache_file = cache_transcript(video_id, args.language, result)
    print(f"[cache] MISS: Cached to {cache_file}")

    # Output result
    output_path = determine_output_path(args.to_staging, args.output, video_id)
    write_output(result, output_path, args.quiet)
    if not args.quiet:
        print_summary(result, from_cache=False)

    return result


if __name__ == "__main__":
    main()
