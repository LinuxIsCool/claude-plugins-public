#!/usr/bin/env python3
"""
Meeting Transcript Ingestion Pipeline

Full pipeline: Audio → Transcription → Diarization → Alignment → Store

This script processes meeting recordings through the full transcript pipeline:
1. Transcription with faster-whisper (word-level timestamps)
2. Speaker diarization with PyAnnote
3. Alignment of transcription segments with speaker assignments
4. Output in plugin-compatible JSON format
"""

import json
import sys
import time
import os
from pathlib import Path
from datetime import datetime
from typing import Optional
import hashlib


def get_file_checksum(path: str) -> str:
    """Compute SHA256 checksum of file"""
    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(65536), b""):
            sha256.update(block)
    return sha256.hexdigest()[:16]


def transcribe_with_timestamps(audio_path: str, model_size: str = "small") -> dict:
    """
    Transcribe audio with word-level timestamps using faster-whisper
    """
    from faster_whisper import WhisperModel

    print(f"[transcribe] Loading Whisper '{model_size}' model...")
    start_load = time.time()
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    load_time = time.time() - start_load
    print(f"[transcribe] Model loaded in {load_time:.1f}s")

    print(f"[transcribe] Transcribing {audio_path}...")
    start_transcribe = time.time()

    # Transcribe with word timestamps
    segments, info = model.transcribe(
        audio_path,
        language="en",
        word_timestamps=True,
        vad_filter=True,  # Filter out non-speech
    )

    # Collect segments with timestamps
    utterances = []
    for segment in segments:
        utterance = {
            "start_ms": int(segment.start * 1000),
            "end_ms": int(segment.end * 1000),
            "text": segment.text.strip(),
            "words": [],
        }

        # Add word-level timestamps if available
        if segment.words:
            for word in segment.words:
                utterance["words"].append({
                    "word": word.word,
                    "start_ms": int(word.start * 1000),
                    "end_ms": int(word.end * 1000),
                    "confidence": word.probability,
                })

        utterances.append(utterance)

    transcribe_time = time.time() - start_transcribe
    duration_ms = int(info.duration * 1000)

    print(f"[transcribe] Done: {len(utterances)} segments, {duration_ms/1000/60:.1f} min")
    print(f"[transcribe] Speed: {info.duration / transcribe_time:.1f}x realtime")

    return {
        "utterances": utterances,
        "duration_ms": duration_ms,
        "language": info.language,
        "language_probability": info.language_probability,
        "transcribe_time_ms": int(transcribe_time * 1000),
        "model": model_size,
    }


def diarize_speakers(audio_path: str, num_speakers: Optional[int] = None) -> dict:
    """
    Run speaker diarization with PyAnnote
    """
    import torch
    import torchaudio
    from pyannote.audio import Pipeline

    hf_token = os.environ.get("HF_TOKEN")
    if not hf_token:
        raise ValueError("HF_TOKEN environment variable required for PyAnnote")

    print(f"[diarize] Loading PyAnnote pipeline...")
    start_load = time.time()

    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        use_auth_token=hf_token
    )

    device = "cuda" if torch.cuda.is_available() else "cpu"
    pipeline.to(torch.device(device))
    load_time = time.time() - start_load
    print(f"[diarize] Pipeline loaded in {load_time:.1f}s (device: {device})")

    # Load audio
    print(f"[diarize] Loading audio...")
    waveform, sample_rate = torchaudio.load(audio_path)
    audio_input = {"waveform": waveform, "sample_rate": sample_rate}
    duration_s = waveform.shape[1] / sample_rate

    # Run diarization
    print(f"[diarize] Running diarization on {duration_s/60:.1f} min audio...")
    start_diarize = time.time()

    kwargs = {}
    if num_speakers:
        kwargs["num_speakers"] = num_speakers

    output = pipeline(audio_input, **kwargs)
    diarize_time = time.time() - start_diarize

    # Collect segments
    segments = []
    speaker_labels = set()

    for turn, _, speaker in output.itertracks(yield_label=True):
        speaker_labels.add(speaker)
        segments.append({
            "speaker_label": speaker,
            "start_ms": int(turn.start * 1000),
            "end_ms": int(turn.end * 1000),
        })

    print(f"[diarize] Done: {len(segments)} segments, {len(speaker_labels)} speakers")
    print(f"[diarize] Speed: {duration_s / diarize_time:.1f}x realtime")

    return {
        "segments": segments,
        "speaker_count": len(speaker_labels),
        "speaker_labels": sorted(list(speaker_labels)),
        "duration_ms": int(duration_s * 1000),
        "diarize_time_ms": int(diarize_time * 1000),
    }


def align_transcription_with_diarization(transcription: dict, diarization: dict) -> list:
    """
    Align transcription utterances with speaker assignments from diarization.

    Strategy: For each transcription segment, find the dominant speaker
    based on time overlap with diarization segments.
    """
    utterances = transcription["utterances"]
    diar_segments = diarization["segments"]

    aligned = []

    for i, utt in enumerate(utterances):
        utt_start = utt["start_ms"]
        utt_end = utt["end_ms"]

        # Find overlapping diarization segments
        overlaps = {}
        for seg in diar_segments:
            seg_start = seg["start_ms"]
            seg_end = seg["end_ms"]

            # Calculate overlap
            overlap_start = max(utt_start, seg_start)
            overlap_end = min(utt_end, seg_end)
            overlap_ms = max(0, overlap_end - overlap_start)

            if overlap_ms > 0:
                speaker = seg["speaker_label"]
                overlaps[speaker] = overlaps.get(speaker, 0) + overlap_ms

        # Assign dominant speaker
        if overlaps:
            speaker = max(overlaps, key=overlaps.get)
            speaker_confidence = overlaps[speaker] / (utt_end - utt_start)
        else:
            speaker = "SPEAKER_UNKNOWN"
            speaker_confidence = 0.0

        aligned.append({
            "index": i,
            "speaker": {
                "id": f"spk_{speaker.lower()}",
                "name": speaker.replace("SPEAKER_", "Speaker "),
            },
            "text": utt["text"],
            "start_ms": utt_start,
            "end_ms": utt_end,
            "words": utt.get("words", []),
            "confidence": {
                "transcription": 0.9,  # Default whisper confidence
                "speaker": speaker_confidence,
                "timing": 0.95,
            },
        })

    return aligned


def generate_transcript_id(checksum: str, created_at: int) -> str:
    """Generate a transcript ID similar to the plugin's TID format"""
    import base64
    data = f"{checksum}:{created_at}".encode()
    hash_bytes = hashlib.sha256(data).digest()[:12]
    # Use base64 without special chars
    b64 = base64.urlsafe_b64encode(hash_bytes).decode().rstrip("=")
    return f"tx_{b64}"


def process_meeting(
    audio_path: str,
    title: Optional[str] = None,
    num_speakers: Optional[int] = None,
    skip_diarization: bool = False,
    output_path: Optional[str] = None,
) -> dict:
    """
    Full meeting processing pipeline
    """
    audio_path = os.path.abspath(audio_path)
    filename = os.path.basename(audio_path)

    if not title:
        # Extract title from filename
        stem = Path(audio_path).stem
        title = f"Meeting: {stem}"

    print(f"\n{'='*60}")
    print(f"Processing: {filename}")
    print(f"Title: {title}")
    print(f"{'='*60}\n")

    # Get file info
    file_stats = os.stat(audio_path)
    checksum = get_file_checksum(audio_path)
    created_at = int(time.time() * 1000)

    # Step 1: Transcription
    print("\n[STEP 1/3] Transcription")
    print("-" * 40)
    transcription = transcribe_with_timestamps(audio_path)

    # Step 2: Diarization (optional)
    diarization = None
    if not skip_diarization:
        print("\n[STEP 2/3] Speaker Diarization")
        print("-" * 40)
        try:
            diarization = diarize_speakers(audio_path, num_speakers)
        except Exception as e:
            print(f"[diarize] WARNING: Diarization failed: {e}")
            print("[diarize] Proceeding without speaker identification")
    else:
        print("\n[STEP 2/3] Skipping diarization (--skip-diarization)")

    # Step 3: Alignment
    print("\n[STEP 3/3] Alignment")
    print("-" * 40)

    if diarization:
        aligned = align_transcription_with_diarization(transcription, diarization)
        speaker_count = diarization["speaker_count"]
        speaker_labels = diarization["speaker_labels"]
    else:
        # No diarization - assign all to unknown speaker
        aligned = []
        for i, utt in enumerate(transcription["utterances"]):
            aligned.append({
                "index": i,
                "speaker": {
                    "id": "spk_unknown",
                    "name": "Unknown Speaker",
                },
                "text": utt["text"],
                "start_ms": utt["start_ms"],
                "end_ms": utt["end_ms"],
                "words": utt.get("words", []),
                "confidence": {
                    "transcription": 0.9,
                    "speaker": 0.0,
                    "timing": 0.95,
                },
            })
        speaker_count = 1
        speaker_labels = ["SPEAKER_UNKNOWN"]

    print(f"[align] Aligned {len(aligned)} utterances with {speaker_count} speakers")

    # Build output
    transcript_id = generate_transcript_id(checksum, created_at)

    result = {
        "id": transcript_id,
        "title": title,
        "source": {
            "mode": "file",
            "path": audio_path,
            "filename": filename,
            "checksum": checksum,
            "type": "audio",
            "audio": {
                "format": Path(audio_path).suffix.lstrip("."),
                "duration_ms": transcription["duration_ms"],
                "file_size_bytes": file_stats.st_size,
            },
        },
        "utterances": aligned,
        "processing": {
            "backend": "faster-whisper",
            "model": transcription["model"],
            "language": transcription["language"],
            "duration_ms": transcription["transcribe_time_ms"] + (diarization["diarize_time_ms"] if diarization else 0),
        },
        "diarization": {
            "backend": "pyannote" if diarization else None,
            "speaker_count": speaker_count,
            "speaker_labels": speaker_labels,
        } if diarization else None,
        "status": "complete",
        "created_at": created_at,
        "updated_at": created_at,
    }

    # Output
    if output_path:
        output_path = os.path.abspath(output_path)
        with open(output_path, "w") as f:
            json.dump(result, f, indent=2)
        print(f"\n[output] Written to: {output_path}")
    else:
        print("\n[output] JSON result:")
        print(json.dumps(result, indent=2))

    print(f"\n{'='*60}")
    print(f"Processing complete!")
    print(f"  Transcript ID: {transcript_id}")
    print(f"  Duration: {transcription['duration_ms']/1000/60:.1f} minutes")
    print(f"  Utterances: {len(aligned)}")
    print(f"  Speakers: {speaker_count}")
    print(f"{'='*60}\n")

    return result


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Process meeting recordings")
    parser.add_argument("audio_path", help="Path to audio/video file")
    parser.add_argument("--title", help="Meeting title")
    parser.add_argument("--speakers", type=int, help="Expected number of speakers")
    parser.add_argument("--skip-diarization", action="store_true", help="Skip speaker diarization")
    parser.add_argument("--output", "-o", help="Output JSON path")

    args = parser.parse_args()

    process_meeting(
        audio_path=args.audio_path,
        title=args.title,
        num_speakers=args.speakers,
        skip_diarization=args.skip_diarization,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
